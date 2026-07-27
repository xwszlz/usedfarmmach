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

echo "==> 以新镜像重启 app"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d app

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
