#!/usr/bin/env bash
# ============================================================
# deploy/deploy-cn.sh — ECS 上由 CI（appleboy/ssh-action）远程执行的部署脚本本体
# 作用：拉取最新 app 镜像、以新镜像起 app、等待健康检查、reload nginx。
#
# 前置（在 ECS 主机上已就绪）：
#   - /opt/cn/docker-compose.yml（本文件对应版本）
#   - /opt/cn/.env.cn（运行时 secrets，绝不进 CI 日志）
#   - /opt/cn/deploy/nginx/*（nginx 配置 + ssl 证书）
#   - docker + docker-compose-plugin（scripts/install-docker.sh 已装）
#   - ECS 主机已 docker login 到阿里云 ACR（私有仓库拉取需要；见下方可选登录块）
#
# CI 调用（appleboy/ssh-action 远程执行）：
#   export CN_IMAGE=registry.cn-beijing.aliyuncs.com/<ns>/usedfarmmach-cn:<sha>
#   bash /opt/cn/deploy/deploy-cn.sh
# ============================================================
set -euo pipefail

# 部署基目录
DEPLOY_DIR="/opt/cn"
COMPOSE_FILE="$DEPLOY_DIR/docker-compose.yml"
ENV_FILE="$DEPLOY_DIR/.env.cn"

# CN_IMAGE 必须由调用方（CI）注入；缺失则中止，避免误用本地镜像
if [ -z "${CN_IMAGE:-}" ]; then
  echo "ERROR: CN_IMAGE 未设置。CI 需先 export CN_IMAGE=..." >&2
  exit 1
fi

cd "$DEPLOY_DIR"

# 可选：若主机已配置 ACR 凭据（以下为「主机侧」变量，非 CI secrets），
# 则先登录私有仓库，确保 docker pull 成功。
if [ -n "${ACR_REGISTRY:-}" ] && [ -n "${ACR_USERNAME:-}" ] && [ -n "${ACR_PASSWORD:-}" ]; then
  echo "==> 登录阿里云 ACR：$ACR_REGISTRY"
  echo "$ACR_PASSWORD" | docker login "$ACR_REGISTRY" --username "$ACR_USERNAME" --password-stdin
fi

echo "==> 拉取镜像 $CN_IMAGE"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" pull app

# ------------------------------------------------------------
# 数据库初始化（幂等，可重复执行）
# 背景：postgres 空库启动（docker-compose 的 depends_on: service_healthy
#       只保证 PG 进程就绪，不保证表存在）；若漏建表，app 一启动
#       首页 SSR 即 500（见 src/app/[locale]/page.tsx 直接查库），
#       且 healthcheck（wget /zh）失败导致部署脚本超时退出。
# 方案：prisma/migrations 目前仅含 2 个增量迁移（ALTER TABLE / 建 UsageLog，
#       依赖基础表已存在），对空库 migrate deploy 会直接失败；
#       本项目基础表历史上由 db push 驱动（见 package.json db:push）。
#       故此处用 prisma db push 全量同步表结构（幂等，可重复执行）：
#       - 首次执行：空库全量建表；
#       - 后续执行：仅按 schema 增量同步（--accept-data-loss 允许破坏性变更，
#         阶段0 新库无风险；上线后如需严格变更管理请引入 baseline 迁移）。
# 实现：schema.prisma 从 app 镜像内复制（Dockerfile.cn 已 COPY /app/prisma），
#       再用一次性 node:22-alpine 容器 + npx prisma 执行，无需改动镜像。
# 注意：prisma CLI 读取 schema 内 env("DATABASE_URL")，此处显式传入
#       .env.cn 的 DATABASE_URL_CN（境内 cn-postgres，数据不出境红线）。
# ------------------------------------------------------------
echo "==> 拉起 app 容器（首次拉起，表结构尚未初始化）"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d app

echo "==> 初始化数据库表结构（prisma db push，幂等）"
DB_URL_CN="$(grep -E '^DATABASE_URL_CN=' "$ENV_FILE" | head -1 | cut -d= -f2-)"
if [ -z "$DB_URL_CN" ]; then
  echo "ERROR: .env.cn 缺少 DATABASE_URL_CN，无法初始化数据库" >&2
  exit 1
fi
docker cp cn-app:/app/prisma/schema.prisma /tmp/cn-schema.prisma
docker run --rm --network cn-net \
  -e DATABASE_URL="$DB_URL_CN" \
  -v /tmp/cn-schema.prisma:/app/schema.prisma \
  -w /app \
  node:22-alpine \
  npx --yes prisma@5.14.0 db push --skip-generate --accept-data-loss --schema=/app/schema.prisma

echo "==> 表结构就绪，重启 app 应用新表"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" restart app

echo "==> 等待 app 健康检查通过（最多约 90s）"
for i in $(seq 1 30); do
  status=$(docker inspect -f '{{.State.Health.Status}}' cn-app 2>/dev/null || echo "starting")
  if [ "$status" = "healthy" ]; then
    echo "==> app 健康检查通过"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "ERROR: app 健康检查超时（当前状态：$status）" >&2
    exit 1
  fi
  sleep 3
done

echo "==> reload nginx（应用最新证书 / 配置）"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T nginx nginx -s reload || \
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" restart nginx

echo "==> 部署完成：$CN_IMAGE"
