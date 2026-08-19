#!/bin/sh
# ============================================================
# run-domestic-scout.sh — #1 卖方采集 ECS 运行器
# 由 cn-scout 容器内的 busybox crond 每日调用：
#   1) python3 跑国内全平台爬虫 -> scripts/domestic_sellers_data_v2.json
#   2) 校验爬虫产出；若被 WAF 拦截/0 条，则回退到随镜像部署的
#      种子台账 domestic_sellers_seed.json（WebSearch 采集的 114 条）
#   3) node 跑入库脚本 -> cn-postgres(RawListing)
# 容器基于 node:22-alpine（已 apk 安装 python3 + py3-requests）。
#
# 设计要点：国内平台普遍 WAF 拦截裸客户端，爬虫长期 0 条。
# 种子台账是人工 WebSearch 采集的权威兜底源，确保 RawListing 持续有数据，
# 且数据只进 cn-postgres（import 脚本自带合规护栏）。
# ============================================================
set -u

cd /app || exit 1

SEED="scripts/domestic_sellers_seed.json"
OUT="scripts/domestic_sellers_data_v2.json"

echo "[scout] $(date -Iseconds) 开始国内卖方全平台采集"
python3 scripts/seller_scout_domestic_scraper.py || echo "[scout] 警告：爬虫返回非零（部分平台可能失败或被反爬）"

# 校验爬虫产出是否有效（totalListings > 0）
if python3 -c "import json,sys; d=json.load(open('$OUT')); sys.exit(0 if d.get('totalListings',0) > 0 else 1)" 2>/dev/null; then
  echo "[scout] $(date -Iseconds) 爬虫产出有效，采用实时采集结果"
else
  # 爬虫无效/被WAF拦截/文件缺失 -> 回退种子台账
  if [ -f "$SEED" ]; then
    cp "$SEED" "$OUT"
    echo "[scout] $(date -Iseconds) 爬虫无效/被WAF拦截，回退使用种子台账(WebSearch 114条)"
  else
    echo "[scout] $(date -Iseconds) 爬虫无效且无种子台账，跳过入库"
    exit 0
  fi
fi

echo "[scout] $(date -Iseconds) 采集完成，开始写入 cn-postgres"
node scripts/import-seller-scout-domestic.js

echo "[scout] $(date -Iseconds) 入库完成"
