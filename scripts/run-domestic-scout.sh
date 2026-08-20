#!/bin/sh
# ============================================================
# run-domestic-scout.sh — #1 卖方采集 ECS 运行器
# 由 cn-scout 容器内的 busybox crond 每日调用。
# 已移除 Python 爬虫（被国内平台 WAF 拦截且会挂死），
# 改为直接使用随镜像打包的种子台账 domestic_sellers_seed.json。
# ============================================================
set -u

cd /app || exit 1

echo "[scout] $(date -Iseconds) 国内卖方采集：使用种子台账(WebSearch 采集)"

# 种子台账随镜像打包在 /app/scripts/domestic_sellers_seed.json
if [ ! -f scripts/domestic_sellers_seed.json ]; then
  echo "[scout] 错误：种子台账 domestic_sellers_seed.json 不存在，中止"
  exit 1
fi

# 复制种子为采集数据文件（import 脚本固定读这个文件名）
cp scripts/domestic_sellers_seed.json scripts/domestic_sellers_data_v2.json

echo "[scout] $(date -Iseconds) 采集完成，开始写入 cn-postgres"
node scripts/import-seller-scout-domestic.js

echo "[scout] $(date -Iseconds) 入库完成"
