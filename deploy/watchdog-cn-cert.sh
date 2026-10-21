#!/usr/bin/env bash
# ============================================================
# deploy/watchdog-cn-cert.sh — .cn 站点 TLS 证书「续签看门狗」（在 ECS 主机上运行）
#
# 【为什么需要它】
#   .cn 证书由 Let's Encrypt 签发，续签必须访问 acme-v02.api.letsencrypt.org。
#   2026-10-16 在北京 ECS 上实测该端点（走 Cloudflare 专线段 172.65.32.0/24）：
#     - ping 丢包 50%、RTT 341ms（同机对照：github.com 0% 丢包/108ms，国内 0%/0.98ms）
#     - 生产端点连测 5 次：2 次 45s 硬超时，1 次 TCP 连通但 0 字节返回
#   => certbot.timer 单次续签有相当概率失败。而 certbot 的失败是「静默」的：
#      不告警、不通知，直到证书过期、站点中断才会被人发现。
#   本脚本把「静默失败」变成「高频重试 + 主动告警」。
#
# 【与 certbot.timer 的关系】
#   certbot.timer 保持原样运行（每日 2 次空跑，仅在到期前 30 天才真正动手），
#   本脚本不替代它，只在证书进入危险窗口后追加更高频的重试与告警。两者并存无冲突。
#   续签成功后由 certbot 触发 renewal 配置里的 deploy-hook
#   （即 /opt/cn/deploy/renew-cn-ssl.sh deploy）完成证书拷贝 + nginx reload。
#   —— 这也是为什么 renew-cn-ssl.sh 必须由 CI 同步到 ECS：它是本脚本成功路径的依赖。
#
# 【用法（ECS 主机，root）】
#   bash /opt/cn/deploy/watchdog-cn-cert.sh check       # 手动跑一次（也可用普通用户跑）
#   bash /opt/cn/deploy/watchdog-cn-cert.sh install     # 安装 cron（需 root）
#   bash /opt/cn/deploy/watchdog-cn-cert.sh uninstall   # 卸载 cron（需 root）
#
# 【告警通道（可选）】
#   在 /opt/cn/.env.cn 增加一行（企业微信机器人 webhook，境内可达，不受跨境影响）：
#     CN_CERT_ALERT_WEBHOOK=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=<真实key>
#   未配置、或值仍是占位符（如 "你的key" / "xxxx" / "YOUR_KEY"）时，仅写日志 + syslog，
#   不会报错 —— 但会明确打印「仍是占位符」，避免出现"以为配好了其实没配"。
#
#   ⚠️ 判断是否真的发出，必须看 errcode，不能只看 curl 退出码：
#      企业微信 webhook 即使 key 无效也只返回 HTTP 200（curl 退出码仍为 0），
#      错误信息在响应体的 errcode/errmsg 里。本脚本解析 errcode，仅 errcode=0
#      记为「已发出」，否则记为「被拒绝」并打印原始响应体。
#
#   自测连通性（在 ECS 上跑，期望输出 {"errcode":0,"errmsg":"ok"}）：
#     H="$(grep -E '^CN_CERT_ALERT_WEBHOOK=' /opt/cn/.env.cn | head -1 | cut -d= -f2-)"
#     curl -sS -X POST "$H" -H 'Content-Type: application/json' \
#       -d '{"msgtype":"text","text":{"content":"[神雕农机 .cn] webhook 连通性测试（可忽略）"}}'
# ============================================================
set -uo pipefail

DOMAIN="usedfarmmach.cn"
CERT_FILE="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
ENV_FILE="/opt/cn/.env.cn"
LOG_FILE="/var/log/cn-cert-watchdog.log"
CRON_FILE="/etc/cron.d/cn-cert-watchdog"

WARN_DAYS=21   # 剩余天数低于此值 → 进入危险窗口，开始主动重试续签
ALERT_DAYS=7   # 剩余天数低于此值 → 无论重试结果如何都告警
RETRIES=3      # 危险窗口内每次运行的 certbot 重试次数
RETRY_SLEEP=90 # 重试间隔（秒）

SELF="$(readlink -f "$0" 2>/dev/null || echo "$0")"

log() { echo "$(date -Is) [watchdog] $*"; }

# 返回证书剩余有效天数；解析失败返回 -1
cert_days_left() {
  if [ ! -f "$CERT_FILE" ]; then
    echo "-1"
    return
  fi
  local end_raw end_ts now_ts
  end_raw="$(openssl x509 -enddate -noout -in "$CERT_FILE" 2>/dev/null | cut -d= -f2)"
  if [ -z "$end_raw" ]; then
    echo "-1"
    return
  fi
  end_ts="$(date -d "$end_raw" +%s 2>/dev/null)"
  now_ts="$(date +%s)"
  if [ -z "$end_ts" ]; then
    echo "-1"
    return
  fi
  echo "$(( (end_ts - now_ts) / 86400 ))"
}

send_alert() {
  local msg="$1"
  log "ALERT: ${msg}"
  logger -t cn-cert-watchdog "ALERT: ${msg}" 2>/dev/null || true

  local hook=""
  if [ -f "$ENV_FILE" ]; then
    hook="$(grep -E '^CN_CERT_ALERT_WEBHOOK=' "$ENV_FILE" | head -1 | cut -d= -f2- || true)"
  fi

  # 空值 / 占位符一律按「未配置」处理，并明确说出当前值是什么。
  # 2026-10-16 实测教训：`echo '...key=你的key' >> .env.cn` 这类占位符会被
  # 原样写进去；若不识别，就会被当作"已配置"而永远静默失效。
  case "$hook" in
    "")
      log "未配置 CN_CERT_ALERT_WEBHOOK，本次仅记录日志（未发出外部通知）"
      return 0
      ;;
    *你的key*|*你的KEY*|*YOUR_KEY*|*your_key*|*CHANGE_ME*|*change_me*|*xxxx*|*XXXX*)
      log "CN_CERT_ALERT_WEBHOOK 仍是占位符（当前值：${hook}），本次仅记录日志（未发出外部通知）"
      return 0
      ;;
  esac

  local payload resp errcode
  payload="$(printf '{"msgtype":"text","text":{"content":"[神雕农机 .cn] %s"}}' "$msg")"

  if ! resp="$(curl -sS --max-time 15 -X POST "$hook" \
       -H 'Content-Type: application/json' -d "$payload" 2>&1)"; then
    log "告警 webhook 请求失败（curl 返回非 0）：${resp}"
    return 1
  fi

  # ⚠️ 关键：企业微信 webhook 即使 key 无效也返回 HTTP 200，只在响应体里给
  # errcode/errmsg，curl 退出码仍为 0。2026-10-16 用无效 key 实测得到：
  #   {"errcode":93000,"errmsg":"invalid webhook url, hint: [...]"}
  # 所以绝不能只看 curl 退出码 —— 那会把「key 填错」误报成「告警已发出」，
  # 等于让人以为有监控、实际全程静默。必须解析 errcode==0 才算真正发出。
  errcode="$(printf '%s' "$resp" | sed -n 's/.*"errcode"[[:space:]]*:[[:space:]]*\(-\{0,1\}[0-9]\{1,\}\).*/\1/p')"
  if [ "$errcode" = "0" ]; then
    log "告警已通过 webhook 发出（errcode=0）"
    return 0
  fi
  log "告警 webhook 被拒绝：errcode=${errcode:-<未解析到>}，响应体=${resp}"
  return 1
}

do_check() {
  if [ ! -f "$CERT_FILE" ]; then
    send_alert "证书文件不存在：${CERT_FILE}。需人工执行 bash /opt/cn/deploy/renew-cn-ssl.sh issue"
    return 1
  fi

  local d_before d_after i rc
  d_before="$(cert_days_left)"
  if [ "$d_before" -lt 0 ]; then
    send_alert "无法解析 ${CERT_FILE} 的到期时间（文件可能损坏），请人工检查"
    return 1
  fi

  log "证书 ${DOMAIN} 剩余 ${d_before} 天（阈值：<${WARN_DAYS} 天进入重试窗口，<${ALERT_DAYS} 天告警）"

  if [ "$d_before" -ge "$WARN_DAYS" ]; then
    log "尚未进入危险窗口，无需干预"
    return 0
  fi

  log "进入危险窗口，开始重试续签（最多 ${RETRIES} 次，间隔 ${RETRY_SLEEP}s）"
  rc=1
  for i in $(seq 1 "$RETRIES"); do
    log "第 ${i}/${RETRIES} 次尝试：certbot renew"
    if certbot renew --quiet 2>&1; then
      rc=0
      break
    fi
    log "本次尝试失败（certbot 返回非 0）"
    if [ "$i" -lt "$RETRIES" ]; then
      sleep "$RETRY_SLEEP"
    fi
  done

  d_after="$(cert_days_left)"
  log "续签尝试结束：剩余天数 ${d_before} → ${d_after}（certbot rc=${rc}）"

  if [ "$d_after" -gt "$d_before" ]; then
    log "续签成功，证书已更新（certbot deploy-hook 会自动拷贝证书并 reload nginx）"
    return 0
  fi

  if [ "$d_after" -lt "$ALERT_DAYS" ]; then
    send_alert "续签失败且证书仅剩 ${d_after} 天，站点即将因证书过期中断，请立即人工介入（日志 ${LOG_FILE}）"
    return 1
  fi

  log "本次未续签成功（剩余 ${d_after} 天，尚未触及告警线 ${ALERT_DAYS} 天），下次运行将继续重试"
  return 0
}

do_install() {
  if [ "$(id -u)" -ne 0 ]; then
    echo "ERROR: install 需要 root 权限（写入 ${CRON_FILE}）" >&2
    exit 1
  fi

  cat > "$CRON_FILE" <<EOF
# 神雕农机 .cn 证书续签看门狗 —— 由 deploy/watchdog-cn-cert.sh install 生成，勿手工编辑
# 每日 03:17 / 15:17（ECS 本地时间 CST）各检查一次。
# 刻意避开 certbot.timer 的 00:00/12:00，并避开跨境链路最差的 20:00-23:00 晚高峰。
# cron 环境极简，故显式设置 PATH（certbot 位于 /usr/bin）。
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
17 3,15 * * * root /bin/bash ${SELF} check >> ${LOG_FILE} 2>&1
EOF

  chmod 0644 "$CRON_FILE"
  touch "$LOG_FILE"
  chmod 0644 "$LOG_FILE"
  log "已安装定时任务：${CRON_FILE}（root 每日 03:17 / 15:17 CST）"
  log "手动验证：/bin/bash ${SELF} check"
}

do_uninstall() {
  if [ "$(id -u)" -ne 0 ]; then
    echo "ERROR: uninstall 需要 root 权限（删除 ${CRON_FILE}）" >&2
    exit 1
  fi
  if [ -f "$CRON_FILE" ]; then
    rm -f "$CRON_FILE"
    log "已卸载定时任务：${CRON_FILE}"
  else
    log "定时任务不存在，无需卸载：${CRON_FILE}"
  fi
}

case "${1:-check}" in
  check)     do_check ;;
  install)   do_install ;;
  uninstall) do_uninstall ;;
  *)
    echo "用法: $0 [check|install|uninstall]" >&2
    exit 2
    ;;
esac
