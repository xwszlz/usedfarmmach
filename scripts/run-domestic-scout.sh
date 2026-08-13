#!/bin/sh
# ============================================================
# run-domestic-scout.sh — #1 卖方采集 ECS 运行器
# 由 cn-scout 容器内的 busybox crond 每日调用：
#   1) python3 跑国内全平台爬虫 -> scripts/domestic_sellers_data_v2.json
#   2) node 跑入库脚本 -> cn-postgres(RawListing)
# 容器基于 node:22-alpine（已 apk 安装 python3 + py3-requests）。
# ============================================================
set -u

cd /app || exit 1

echo "[scout] $(date -Iseconds) 开始国内卖方全平台采集"
python3 scripts/seller_scout_domestic_scraper.py || echo "[scout] 警告：爬虫返回非零（部分平台可能失败或被反爬），仍尝试入库已有结果"

echo "[scout] $(date -Iseconds) 采集完成，开始写入 cn-postgres"
node scripts/import-seller-scout-domestic.js

echo "[scout] $(date -Iseconds) 入库完成"
