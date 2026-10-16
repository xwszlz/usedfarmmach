#!/usr/bin/env bash
# ============================================================
# deploy/renew-cn-ssl.sh — .cn 站 Let's Encrypt 证书签发/续签（在 ECS 上运行）
#
# 设计前提（已实测 2026-10-15）：
#   - 域名 NS 在阿里云 DNS（vip1/vip2.alidns.com），A 记录直指 ECS 101.200.125.199（无 Cloudflare 代理）
#   - nginx 容器 :80 已开，需为 /.well-known/acme-challenge 放行（见 cn.conf / docker-compose 调整）
#   - 证书挂载点：/opt/cn/deploy/nginx/ssl/cn/{fullchain,privkey}.pem（容器 /etc/nginx/ssl/cn）
#   - deploy-cn.sh 只 reload nginx，不续签 → 本脚本补齐「自动续签」缺口
#
# 用法：
#   首次签发： bash /opt/cn/deploy/renew-cn-ssl.sh issue
#   续签钩子（certbot 自动调用，勿手动）： bash /opt/cn/deploy/renew-cn-ssl.sh deploy
#
# 后续自动化：certbot 安装后自带 systemd timer（certbot.timer），每日两次跑
#   `certbot renew`；真实续签时自动触发本脚本的 deploy 子命令。
#   若未启用： systemctl enable --now certbot.timer
# ============================================================
set -euo pipefail

DOMAIN="usedfarmmach.cn"
WWW="www.usedfarmmach.cn"
ADMIN_MAIL="admin@usedfarmmach.cn"

DEPLOY_DIR="/opt/cn"
COMPOSE_FILE="$DEPLOY_DIR/docker-compose.yml"
ENV_FILE="$DEPLOY_DIR/.env.cn"
SSL_DST="$DEPLOY_DIR/deploy/nginx/ssl/cn"
WEBROOT_HOST="$DEPLOY_DIR/deploy/nginx/certbot-webroot"   # ECS 主机路径（certbot 写挑战文件处）
WEBROOT_NGINX="/var/www/certbot"                          # nginx 容器内路径（见 docker-compose 挂载）
SELF="$0"

deploy() {
  local LIVE="/etc/letsencrypt/live/$DOMAIN"
  if [ ! -f "$LIVE/fullchain.pem" ] || [ ! -f "$LIVE/privkey.pem" ]; then
    echo "ERROR: 未找到 certbot 签发的证书 $LIVE，请先跑 issue" >&2
    exit 1
  fi
  cp -f "$LIVE/fullchain.pem" "$SSL_DST/fullchain.pem"
  cp -f "$LIVE/privkey.pem"  "$SSL_DST/privkey.pem"
  # 证书是只读挂载，reload 即可加载新文件
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T nginx nginx -s reload
  echo "$(date -Is) deployed $DOMAIN cert -> $SSL_DST + nginx reloaded" >> /var/log/cn-ssl-renew.log
}

issue() {
  mkdir -p "$WEBROOT_HOST" "$SSL_DST"
  certbot certonly --webroot -w "$WEBROOT_HOST" \
    -d "$DOMAIN" -d "$WWW" \
    --non-interactive --agree-tos -m "$ADMIN_MAIL" \
    --expand --deploy-hook "$SELF deploy"
  deploy
}

case "${1:-issue}" in
  issue)  issue ;;
  deploy) deploy ;;
  *) echo "usage: $0 [issue|deploy]" >&2; exit 1 ;;
esac
