#!/usr/bin/env bash
# ============================================================
# deploy/deploy-cn.sh — ECS 上由 CI（appleboy/ssh-action）远程执行的部署脚本本体
# 作用：从 OSS 下载镜像 tarball → docker load → 以新镜像起 app → 数据库初始化 →
#       等待健康检查 → reload nginx。
#
# 镜像传输方案：弃用阿里云 ACR（¥314/月），改用阿里云 OSS 存镜像 tarball
#   （复用现有 bucket usedfarmmach-oss，北京 oss-cn-beijing，与 ECS 同地域）。
#   版本命名：cn-app-<git commit SHA>.tar.gz（对象路径 cn-images/cn-app-<SHA>.tar.gz）。
#
# 前置（在 ECS 主机上已就绪）：
#   - /opt/cn/docker-compose.yml（本文件对应版本）
#   - /opt/cn/.env.cn（运行时 secrets，含 OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET /
#     DATABASE_URL_CN；绝不进 CI 日志）
#   - /opt/cn/deploy/nginx/*（nginx 配置 + ssl 证书）
#   - docker + docker-compose-plugin（scripts/install-docker.sh 已装）
#   - ossutil 可选：脚本会自动安装到 /opt/cn/bin/ossutil（幂等）
#
# CI 调用（appleboy/ssh-action 远程执行）：
#   export CN_IMAGE_REF=<完整 git commit SHA>   # 与 OSS 对象名 cn-app-<SHA>.tar.gz 一致
#   bash /opt/cn/deploy/deploy-cn.sh
# ============================================================
set -euo pipefail

# 部署基目录
DEPLOY_DIR="/opt/cn"
COMPOSE_FILE="$DEPLOY_DIR/docker-compose.yml"
ENV_FILE="$DEPLOY_DIR/.env.cn"

# OSS 常量（与 .env.cn 中 OSS_REGION/OSS_BUCKET/OSS_ENDPOINT 对齐；与 ECS 同地域）
OSS_BUCKET="usedfarmmach-oss"
OSS_ENDPOINT="oss-cn-beijing.aliyuncs.com"
OSS_IMAGE_PREFIX="cn-images"
OSSUTIL_BIN="$DEPLOY_DIR/bin/ossutil"
OSSUTIL_CP_DIR="$DEPLOY_DIR/tmp/ossutil_checkpoint"
IMAGE_NAME="usedfarmmach-cn"
IMAGE_DIR="$DEPLOY_DIR/images"

# CN_IMAGE_REF 必须由调用方（CI）注入；缺失则中止，避免误用本地镜像
if [ -z "${CN_IMAGE_REF:-}" ]; then
  echo "ERROR: CN_IMAGE_REF 未设置。CI 需先 export CN_IMAGE_REF=<git commit sha>" >&2
  exit 1
fi

# 版本命名约定：cn-app-<SHA>.tar.gz（可被 CN_IMAGE_FILE / CN_IMAGE 覆盖）
CN_IMAGE_FILE="${CN_IMAGE_FILE:-cn-app-${CN_IMAGE_REF}.tar.gz}"
CN_IMAGE="${CN_IMAGE:-${IMAGE_NAME}:${CN_IMAGE_REF}}"
OSS_OBJECT="oss://${OSS_BUCKET}/${OSS_IMAGE_PREFIX}/${CN_IMAGE_FILE}"
LOCAL_IMAGE_FILE="$IMAGE_DIR/$CN_IMAGE_FILE"

cd "$DEPLOY_DIR"

# ------------------------------------------------------------
# 加载 OSS AccessKey：优先取环境变量（CI 或手动注入），否则从 .env.cn 读取。
# 只抽取 OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET 两个变量，避免 source 整个
# .env.cn（其中 WECHAT_PAY_PRIVATE_KEY 等多行/转义值可能破坏 shell 语法）。
# ------------------------------------------------------------
load_oss_env() {
  if [ -z "${OSS_ACCESS_KEY_ID:-}" ] && [ -f "$ENV_FILE" ]; then
    OSS_ACCESS_KEY_ID="$(grep -E '^OSS_ACCESS_KEY_ID=' "$ENV_FILE" | head -1 | cut -d= -f2-)"
  fi
  if [ -z "${OSS_ACCESS_KEY_SECRET:-}" ] && [ -f "$ENV_FILE" ]; then
    OSS_ACCESS_KEY_SECRET="$(grep -E '^OSS_ACCESS_KEY_SECRET=' "$ENV_FILE" | head -1 | cut -d= -f2-)"
  fi
  if [ -z "${OSS_ACCESS_KEY_ID:-}" ] || [ -z "${OSS_ACCESS_KEY_SECRET:-}" ]; then
    echo "ERROR: 缺少 OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET（环境变量或 $ENV_FILE）" >&2
    exit 1
  fi
  export OSS_ACCESS_KEY_ID OSS_ACCESS_KEY_SECRET
}

# ------------------------------------------------------------
# 幂等安装 ossutil（阿里云官方二进制 1.7.19，Linux x86_64）。
# 安装在 deploy 用户可写的 /opt/cn/bin 下，避免 /usr/local/bin 权限问题；
# 解压优先 unzip，缺失时回退 python3 zipfile（Ubuntu 均自带 python3）。
# ------------------------------------------------------------
install_ossutil() {
  if [ -x "$OSSUTIL_BIN" ] && "$OSSUTIL_BIN" --version >/dev/null 2>&1; then
    echo "==> ossutil 已就绪：$("$OSSUTIL_BIN" --version)"
    return 0
  fi
  echo "==> 安装 ossutil（阿里云官方二进制 1.7.19）"
  local TMP_DIR="$DEPLOY_DIR/tmp"
  local ZIP_URL="https://gosspublic.alicdn.com/ossutil/1.7.19/ossutil-v1.7.19-linux-amd64.zip"
  mkdir -p "$TMP_DIR" "$DEPLOY_DIR/bin" "$IMAGE_DIR"
  curl -fSL --retry 3 -o "$TMP_DIR/ossutil.zip" "$ZIP_URL"
  rm -rf "$TMP_DIR/ossutil-x" && mkdir -p "$TMP_DIR/ossutil-x"
  if command -v unzip >/dev/null 2>&1; then
    unzip -o "$TMP_DIR/ossutil.zip" -d "$TMP_DIR/ossutil-x"
  elif command -v python3 >/dev/null 2>&1; then
    python3 -c "import sys, zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])" \
      "$TMP_DIR/ossutil.zip" "$TMP_DIR/ossutil-x"
  else
    echo "ERROR: 解压 ossutil 需要 unzip 或 python3" >&2
    exit 1
  fi
  local BIN
  BIN="$(find "$TMP_DIR/ossutil-x" -maxdepth 2 -type f \( -name 'ossutil' -o -name 'ossutil64' \) | head -1)"
  if [ -z "$BIN" ]; then
    echo "ERROR: ossutil 解压产物中未找到可执行文件" >&2
    exit 1
  fi
  install -m 0755 "$BIN" "$OSSUTIL_BIN"
  rm -rf "$TMP_DIR/ossutil.zip" "$TMP_DIR/ossutil-x"
  echo "==> ossutil 安装完成：$("$OSSUTIL_BIN" --version)"
}

# ossutil 1.x：-e/-i/-k 可置于子命令后（与官方文档示例一致）
# --checkpoint-dir 指向 deploy 用户可写的 $DEPLOY_DIR/tmp 子目录，
# 避免 ossutil 默认在当前工作目录（/opt/cn，root 属主、deploy 无写权限）
# 创建 .ossutil_checkpoint 时报 permission denied。
ossutil_cp() {
  mkdir -p "$OSSUTIL_CP_DIR"
  "$OSSUTIL_BIN" "$@" -e "$OSS_ENDPOINT" -i "$OSS_ACCESS_KEY_ID" -k "$OSS_ACCESS_KEY_SECRET" \
    --checkpoint-dir "$OSSUTIL_CP_DIR"
}

# ------------------------------------------------------------
# 主流程
# ------------------------------------------------------------
load_oss_env
install_ossutil

echo "==> 从 OSS 下载镜像包：$OSS_OBJECT"
ossutil_cp cp -f "$OSS_OBJECT" "$LOCAL_IMAGE_FILE"
ls -lh "$LOCAL_IMAGE_FILE"

echo "==> docker load 镜像（tag: $CN_IMAGE）"
docker load -i "$LOCAL_IMAGE_FILE"

# 导出 CN_IMAGE 供 docker-compose.yml 插值（image: ${CN_IMAGE}）
export CN_IMAGE

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
#       再用一次性 node:22-slim 容器 + npx prisma 执行，无需改动镜像。
# 注意：绝不可用 node:*-alpine —— Prisma 5.x 的 query/schema engine 二进制是
#       glibc 构建，在 Alpine（musl）上无法加载，会报 "Error load..." 非 JSON
#       响应导致 "Could not parse schema engine response"；且 Alpine 默认不带
#       openssl/libssl，触发 "Prisma failed to detect the libssl/openssl version"。
#       node:22-slim 为 Debian bookworm，自带 libssl3，Prisma 5.14 可正常加载引擎。
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
# schema.prisma 临时文件固定写在 deploy 用户可写的 $DEPLOY_DIR/tmp 下，
# 而非 /tmp：docker cp 写入 /tmp 的文件会变成 root 属主，后续运行（或 sticky-bit
# /tmp）下 deploy 用户无法覆盖，报 "unlinkat ... operation not permitted"。
# 先确保目录存在，并删除可能残留的 root 属主旧文件，避免 docker cp 被阻塞。
SCHEMA_TMP="$DEPLOY_DIR/tmp/cn-schema.prisma"
mkdir -p "$DEPLOY_DIR/tmp"
rm -f "$SCHEMA_TMP"
docker cp cn-app:/app/prisma/schema.prisma "$SCHEMA_TMP"
docker run --rm --network cn_cn-net \
  -e DATABASE_URL="$DB_URL_CN" \
  -v "$SCHEMA_TMP":/app/schema.prisma \
  -w /app \
  node:22-slim \
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

echo "==> 部署完成：$CN_IMAGE（$CN_IMAGE_FILE）"
