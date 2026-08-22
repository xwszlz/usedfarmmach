# DEPLOYMENT.md — usedfarmmach 部署手册

> 本文档是 usedfarmmach 双站（`.com` 国际站 + `.cn` 国内站）部署与运维的**唯一入口**。
> 重点覆盖：数据库选型、`.cn` 阿里云 ECS 初始化、SSL 证书、环境变量、上线与回滚。
> 配套文档：`docs/cn-deploy-runbook.md`（运维 runbook）、`docs/cn-deploy-architecture.md`（架构）、`deploy/deploy-cn.sh`（ECS 部署脚本本体）。

---

## 一、架构总览

| 站点 | 域名 | 平台 | 形态 |
| --- | --- | --- | --- |
| 国际站 `.com` | usedfarmmach.com | Vercel | Next.js 14 App Router（8 语言），Stripe 支付 |
| 国内站 `.cn` | usedfarmmach.cn | 阿里云 ECS（北京）`101.200.125.199` | 单台 ECS + Docker Compose（4 容器，bridge 网络 `cn-net`） |

`.cn` 容器拓扑（`docker-compose.yml`）：

| 容器 | 镜像 | 说明 |
| --- | --- | --- |
| `cn-nginx` | nginx:1.27-alpine | 对外 80/443，强制 HTTPS + 反代 app |
| `cn-app` | `usedfarmmach-cn:<SHA>` | Next.js standalone，仅内部 `app:3000`，不暴露宿主机端口 |
| `cn-postgres` | postgres:17-alpine | ECS 本地 PG，volume `cn-pg-data`，数据不出境 |
| `cn-scout` | 复用 cn-app 镜像 | #1 卖方采集 sidecar，每日 07:10 爬虫入库 |

---

## 二、数据库（⚠️ 已弃用 Neon，改用本地 Postgres）

**结论：不使用 Neon。**

- 早期规划曾考虑 Neon（serverless Postgres），但因 `.cn` 站有**「数据不出境」红线**，Neon 属境外数据库，被明确禁止。
- 现状：
  - **`.cn`**：使用 ECS 本机 Docker `postgres:17-alpine`（`cn-postgres` 容器，volume 持久化），连接串在 `.env.cn` 的 `DATABASE_URL_CN`，形如 `postgresql://cn_app:xxx@cn-postgres:5432/usedfarmmach_cn`。
  - **`.com`**：本地开发用 `postgres@localhost`（`.env.example`）；生产连接串 `DATABASE_URL` 在 Vercel 环境变量中配置，仓库不落盘。
- 依据：`.env.cn.example` 内注释明确「绝不指向 `*.neon.tech` 等境外地址（数据不出境红线）」。

> 因此，部署清单中的「Neon 创建（console.neon.tech）」**已不再需要执行**。

---

## 三、`.cn` ECS 初始化（阿里云北京）

前置：ECS（Ubuntu，≥2C4G，公网 IP `101.200.125.199`）、OSS（`oss-cn-beijing`，bucket `usedfarmmach-oss`）、微信支付「电商收付通」子商户、域名 `usedfarmmach.cn` 已实名、GitHub Secrets（`DEPLOY_SSH_KEY` / `OSS_ACCESS_KEY_ID` / `OSS_ACCESS_KEY_SECRET`）。

### ① 首次 SSH → 安装 Docker

```bash
sudo bash scripts/install-docker.sh
# 等价手动：curl -fsSL https://get.docker.com | sudo bash
sudo systemctl enable --now docker
sudo useradd -m -s /bin/bash deploy
sudo usermod -aG docker deploy   # 后续 SSH 一律用 deploy 用户
```

### ② 拉取代码到 `/opt/cn`

```bash
sudo -u deploy git clone <repo-url> /opt/cn
# 确认存在：Dockerfile.cn、docker-compose.yml、deploy/、scripts/install-docker.sh
```

### ③ 生成运行时环境变量 `.env.cn` 并填值

```bash
sudo -u deploy cp /opt/cn/.env.cn.example /opt/cn/.env.cn
sudo chmod 600 /opt/cn/.env.cn
sudo -u deploy vim /opt/cn/.env.cn
```

必填项（详见 `.env.cn.example` 注释）：

- `SITE=cn`、`NEXT_PUBLIC_SITE=cn`、`NEXT_PUBLIC_APP_URL=https://usedfarmmach.cn`
- `DATABASE_URL_CN=postgresql://...`（境内库，指向 `cn-postgres`）
- `JWT_SECRET`、`OSS_REGION=oss-cn-beijing`、`OSS_BUCKET=usedfarmmach-oss`、`OSS_ACCESS_KEY_ID/SECRET`
- `WECHAT_PAY_*`（7 项必填，仅担保交易 `createGuaranteeIntent` + `verifyCallback`）
- `CN_ICP_NO=冀ICP备XXXXXXXX号`（备案前占位，通过后替换真实号）

> **红线校验**：确认文件里**没有** `DATABASE_URL=`（境外 Neon）、非 `oss-cn-beijing` 的 OSS、微信资金类变量。
> 运行时密钥**只**存在于 ECS 的 `/opt/cn/.env.cn`，绝不进 git / CI 日志。

### ④ 安装 ossutil（镜像包下载用，`deploy-cn.sh` 已内置幂等安装）

```bash
# deploy-cn.sh 会自动装到 /opt/cn/bin/ossutil；手动验证可用：
ossutil cp -f "oss://usedfarmmach-oss/cn-images/cn-app-<SHA>.tar.gz" /opt/cn/images/ \
  -e oss-cn-beijing.aliyuncs.com -i "$OSS_ACCESS_KEY_ID" -k "$OSS_ACCESS_KEY_SECRET"
```

### ⑤ 推送 `main` 触发 CI 自动构建 + 部署

代码合入 `main`（或 `workflow_dispatch`）触发 `.github/workflows/deploy-cn.yml`：

1. `npm ci` → `prisma generate` → `next build`（SITE=cn）。
2. `docker build --build-arg SITE=cn -f Dockerfile.cn` → `docker save | gzip` → ossutil 上传 `oss://usedfarmmach-oss/cn-images/cn-app-<SHA>.tar.gz`。
3. `appleboy/ssh-action` 以 `deploy` 登 ECS，执行 `CN_IMAGE_REF=<SHA> bash /opt/cn/deploy/deploy-cn.sh`：
   - ossutil 下载 tarball → `docker load`
   - `up -d app scout` → `prisma db push`（幂等建表）→ 等待健康检查 → `nginx -s reload`

> CI **不注入**运行时密钥；ECS 用本地 `/opt/cn/.env.cn`（`env_file`）供给容器。

### ⑥ 备案前：仅内部验证（不公开）

```bash
ssh deploy@101.200.125.199
curl -H "Host: usedfarmmach.cn" http://127.0.0.1:3000/zh   # 期望 200 中文首页
```

备案完成前安全组**不开放** 80/443，公网不可达。

### ⑦ 备案通过后：正式上线

1. `CN_ICP_NO` 替换为真实备案号 → `docker compose ... up -d app` 热更。
2. SSL 证书放到 `deploy/nginx/ssl/cn/`（见第四节）。
3. DNS 的 `usedfarmmach.cn` A 记录指向 `101.200.125.199`。
4. 安全组开放 80/443 入站。
5. 验证：`http://usedfarmmach.cn` → 301 跳 https；`https://usedfarmmach.cn/zh` 返回 200 且响应头含 `Strict-Transport-Security`；footer 备案号链接 `beian.miit.gov.cn` 正常。

---

## 四、SSL 证书

`.cn` 站点 HTTPS 由 `deploy/nginx/conf.d/cn.conf` 提供（80→301 跳 https、443 SSL、HSTS），证书路径：

```
/etc/nginx/ssl/cn/fullchain.pem     ← 容器内路径
/etc/nginx/ssl/cn/privkey.pem
# 宿主机挂载：deploy/nginx/ssl/cn/  →  /etc/nginx/ssl（见 docker-compose.yml）
```

**方式 A：certbot（Let's Encrypt，推荐免费自动化）**

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d usedfarmmach.cn -d www.usedfarmmach.cn
# 生成后把证书软链/复制到 /opt/cn/deploy/nginx/ssl/cn/：
#   fullchain.pem  +  privkey.pem
docker compose -f /opt/cn/docker-compose.yml --env-file /opt/cn/.env.cn restart nginx
```

**方式 B：阿里云免费 DV 证书**（域名控制台申请后下载，把 `fullchain.pem` / `privkey.pem` 放到上述路径，同样重启 nginx）。

> 注：`.cn` 域名已备案，两种方式均可；当前生产证书来源以 ECS 上实际放置的证书为准。

---

## 五、回滚 / 故障排查

| 现象 | 处置 |
| --- | --- |
| app 健康检查 `unhealthy` | `docker compose -f /opt/cn/docker-compose.yml --env-file /opt/cn/.env.cn logs app`；多为 `.env.cn` 缺 `DATABASE_URL_CN` 或 PG 未就绪 |
| nginx 502 | 确认 `app` 容器在 `cn-net`、`upstream app { server app:3000; }` 可达；`docker network inspect cn-net` |
| 镜像下载失败（OSS 401/404） | 核对 `.env.cn` 的 `OSS_ACCESS_KEY_ID/SECRET` 与 bucket；`ossutil ls oss://usedfarmmach-oss/cn-images/` |
| 数据库连不上 | 核对 `DATABASE_URL_CN` 指向 `cn-postgres:5432`；PG 容器 `docker compose ... ps` |
| 上线后回滚 | `CN_IMAGE_REF=<上一SHA> bash /opt/cn/deploy/deploy-cn.sh`（OSS 保留历史 tarball，`docker load` 即回退） |

核心日志：

```bash
docker compose -f /opt/cn/docker-compose.yml --env-file /opt/cn/.env.cn ps
docker compose -f /opt/cn/docker-compose.yml --env-file /opt/cn/.env.cn logs -f app
docker compose -f /opt/cn/docker-compose.yml logs -f nginx
```

---

## 六、合规自检清单（每次上线前勾选）

- [ ] `.env.cn` 中无 `DATABASE_URL`（境外 Neon）、无 `oss-cn-beijing` 以外的 OSS
- [ ] `.cn` 仅调用 `createGuaranteeIntent` + `verifyCallback`，无收款/退款/分账
- [ ] `CN_ICP_NO` 为真实备案号
- [ ] DNS A 记录已指向 `101.200.125.199`
- [ ] 安全组 80/443 已开放
- [ ] SSL 证书已就位 `deploy/nginx/ssl/cn/`
- [ ] footer 备案号链接 `https://beian.miit.gov.cn` 正常渲染
- [ ] 运行时密钥仅存 `/opt/cn/.env.cn`，未进 git / CI 日志
