# .cn 国内站 — 运维部署 Runbook（阿里云 ECS）

> 配套架构文档：[`docs/cn-deploy-architecture.md`](./cn-deploy-architecture.md)
> 适用镜像：`usedfarmmach-cn`（Dockerfile：`Dockerfile.cn`，standalone 输出）
> 部署形态：单台 ECS（北京）+ Docker Compose（nginx + app 两容器，bridge 网络 `cn-net`）

---

## ⛔ 红线（交付前必读，违反任一条即合规事故）

1. **数据不出境**：`.cn` 站点数据库 **只能** 使用境内实例（`DATABASE_URL_CN`），OSS **只能** 用 `oss-cn-beijing`。任何 `DATABASE_URL`（Neon 境外）、非北京 OSS、境外第三方服务 **一律禁止** 出现在 `.cn` 运行时。
2. **.cn 不碰资金**：微信相关接口 **仅允许** `createGuaranteeIntent`（担保交易意向）+ `verifyCallback`（回调验签）两类；**不得** 在 `.cn` 实现/暴露收款、退款、提现、分账、Stripe 等资金动作。资金在微信小程序收付通闭环，服务端只存意向与订单号。
3. **备案前不公开**：在 `CN_ICP_NO` 拿到工信部备案号之前：
   - **不得** 将 DNS 的 A 记录切到 ECS 公网 IP（`101.200.125.199`）；
   - **不得** 在云防火墙 / 安全组开放 80 / 443 入站；
   - 仅允许内部通过 ECS 私网 / 跳板机做功能验证（见步骤 ⑥）。
   - `CN_ICP_NO` 在 `.env.cn` 中先填占位 `冀ICP备XXXXXXXX号`，备案通过后替换为真实号。
4. **密钥隔离**：运行时密钥（`DATABASE_URL_CN` / `JWT_SECRET` / `OSS_*` / `WECHAT_PAY_*`）**只** 存在于 ECS 主机 `/opt/cn/.env.cn`，**绝不** 进入 CI 日志或镜像以外的任何仓库文件。`deploy-cn.yml` 只推送镜像、通过 SSH 触发主机脚本，不注入运行时密钥。

---

## 0. 前置条件清单

| 项 | 说明 | 负责人 |
| --- | --- | --- |
| 阿里云 ECS（北京） | Ubuntu 26.04，建议 ≥2C4G，绑定公网 IP `101.200.125.199` | 运维 |
| 阿里云 RDS PostgreSQL（北京） | 境内库，得到 `DATABASE_URL_CN` | 运维/DBA |
| 阿里云 OSS（oss-cn-beijing） | 得到 `OSS_*` 一组凭证 | 运维 |
| 微信支付「电商收付通」子商户 | 得到 `WECHAT_PAY_*` 一组凭证（仅担保交易） | 业务 |
| 阿里云 ACR 命名空间 | 得到 `ALIYUN_ACR_*` 一组凭证 | 运维 |
| 域名 `usedfarmmach.cn` | 已实名，待 ICP 备案 | 业务 |
| ICP 备案 | 取得真实 `CN_ICP_NO` 前不得公开 | 业务 |
| SSL 证书 | 备案通过后下发 `.cn` 证书（`fullchain.pem` + `privkey.pem`） | 运维 |
| GitHub Secrets | `DATABASE_URL_CN` / `DEPLOY_SSH_KEY` / `ALIYUN_ACR_*` | 负责人 |

---

## ① ECS 首次 SSH → 安装 Docker

首次以 root 登录 ECS 后，安装 Docker 并创建非 root 部署用户 `deploy`（nginx/app 容器以该用户所属 `docker` 组管理）：

```bash
# 方式 A：使用仓库内置脚本（推荐）
sudo bash scripts/install-docker.sh

# 方式 B：直接用官方安装器（等价效果，二选一）
curl -fsSL https://get.docker.com | sudo bash
sudo systemctl enable --now docker
sudo useradd -m -s /bin/bash deploy
sudo usermod -aG docker deploy
```

脚本完成项：`docker.io` + `docker-compose-plugin` 安装、`systemctl enable --now docker`、创建 `deploy` 用户并加入 `docker` 组、验证 `docker version`。
**注意**：后续 SSH 部署统一使用 `deploy` 用户（密钥 `DEPLOY_SSH_KEY`），不再用 root。

---

## ② 拉取/分发代码到 `/opt/cn`

在 ECS 上以 `deploy` 用户准备部署目录（代码来源二选一）：

```bash
# 方式 A：git 克隆（推荐，便于后续 pull 更新）
sudo -u deploy git clone <repo-url> /opt/cn

# 方式 B：本地 scp 整包（无 git 环境时）
# 本地执行：scp -r ./usedfarmmach deploy@101.200.125.199:/opt/cn
```

确认 `/opt/cn` 下存在：`Dockerfile.cn`、`docker-compose.yml`、`deploy/`、`scripts/install-docker.sh`。

---

## ③ 生成运行时环境变量文件并填值

复制模板、填入真实密钥（**只在此文件落地运行时密钥**，权限收紧）：

```bash
sudo -u deploy cp /opt/cn/.env.cn.example /opt/cn/.env.cn
sudo chmod 600 /opt/cn/.env.cn
sudo -u deploy vim /opt/cn/.env.cn   # 逐项填真实值
```

必填项核对（详见 `.env.cn.example` 注释）：
- `SITE=cn`、`NEXT_PUBLIC_SITE=cn`、`NEXT_PUBLIC_APP_URL=https://usedfarmmach.cn`
- `DATABASE_URL_CN=postgresql://...`（**境内 RDS**）
- `JWT_SECRET`、`OSS_REGION=oss-cn-beijing`、`OSS_*`
- `WECHAT_PAY_*`（6 项必填 + `WECHAT_PAY_PLATFORM_CERT` 可选）
- `CN_ICP_NO=冀ICP备XXXXXXXX号`（备案前占位；备案后替换真实号）

**红线校验**：确认文件中 **没有** 任何 `DATABASE_URL=`（境外 Neon）、非 `oss-cn-beijing` 的 OSS、`WECHAT_*` 支付资金类变量（仅 `WECHAT_PAY_*` 命名空间合法）。

---

## ④ 登录阿里云 ACR

部署主机需能拉取私有镜像，提前登录一次（凭据缓存在 `deploy` 用户）：

```bash
sudo -u deploy docker login \
  -u "$ALIYUN_ACR_USERNAME" \
  -p "$ALIYUN_ACR_PASSWORD" \
  "$ALIYUN_ACR_REGISTRY"
# 变量来自 ALIYUN_ACR_* secrets；也可在 deploy/deploy-cn.sh 中按需自动登录
```

---

## ⑤ 推送 `main` 触发 CI 自动构建+部署

代码合入 `main`（或手动 `workflow_dispatch`）即触发 `.github/workflows/deploy-cn.yml`：

1. 安装依赖 → `prisma generate`（取 `secrets.DATABASE_URL_CN`）→ `next build`（SITE=cn）。
2. `docker build --build-arg SITE=cn --build-arg DATABASE_URL=${{ secrets.DATABASE_URL_CN }} -f Dockerfile.cn` → 打标签 → 推 ACR。
3. `appleboy/ssh-action` 以 `deploy` 登 ECS，执行 `/opt/cn/deploy/deploy-cn.sh`：
   - `docker compose -f /opt/cn/docker-compose.yml --env-file /opt/cn/.env.cn pull app`
   - `up -d app`（滚动替换，依赖 `app` 健康检查 `healthy`）
   - `nginx -s reload`（若 nginx 容器已在跑）

> CI **不注入** 任何运行时密钥——ECS 用本地 `/opt/cn/.env.cn`（`env_file`）供给 app 容器。
> 镜像标签 = `registry.cn-beijing.aliyuncs.com/<ACR_NS>/usedfarmmach-cn:<GITHUB_SHA前8位>`。

---

## ⑥ 备案前：仅内部验证（不公开）

备案未完成、80/443 未开放时，用 ECS 私网 + `Host` 头做功能验证（不依赖公网 DNS / 端口）：

```bash
# 在能访问 ECS 私网/跳板机的机器上
ssh deploy@101.200.125.199
curl -H "Host: usedfarmmach.cn" http://127.0.0.1:3000/zh
# 期望：返回 200 且含中文首页内容；可继续验证 /zh/... 各路由与 ICP 占位号渲染
```

说明：`docker-compose.yml` 中 `app` expose `3000` 仅在 `cn-net` 内部/本机可达；备案前安全组 **不开放** 80/443，公网不可达。验证仅确认应用可启动、首页与 footer（含 `CN_ICP_NO` 占位）正常。

---

## ⑦ 备案通过后：正式上线

1. 将 `CN_ICP_NO` 由占位替换为 **真实备案号**，并 `docker compose ... --env-file /opt/cn/.env.cn up -d app` 热更（或等下次 CI）。
2. 将 SSL 证书放到 `deploy/nginx/ssl/cn/`：`fullchain.pem` + `privkey.pem`（路径与 `conf.d/cn.conf` 一致）。
3. 域名控制台将 `usedfarmmach.cn` 的 **A 记录指向 `101.200.125.199`**。
4. 云安全组 / 防火墙 **开放 80 / 443 入站**（80 用于 ACME/重定向，443 用于 HTTPS）。
5. 触发一次部署或 `nginx -s reload`，确认：
   - `http://usedfarmmach.cn` → 301 跳 `https://usedfarmmach.cn`
   - `https://usedfarmmach.cn/zh` 返回 200，且响应头含 `Strict-Transport-Security`
   - footer「ICP 备案号」为真实号且链接 `https://beian.miit.gov.cn`

---

## 回滚 / 故障排查

| 现象 | 处置 |
| --- | --- |
| app 健康检查一直 `unhealthy` | `docker compose -f /opt/cn/docker-compose.yml --env-file /opt/cn/.env.cn logs app` 查启动日志；多为 `.env.cn` 缺 `DATABASE_URL_CN` 或 RDS 白名单问题 |
| nginx 502 | 确认 `app` 容器在 `cn-net` 内且 `upstream app { server app:3000; }` 可达；`docker network inspect cn-net` |
| 镜像拉取 401 | 重新执行步骤 ④ `docker login` ACR |
| 数据库连不上 | 核对 `.env.cn` 的 `DATABASE_URL_CN` 为境内 RDS；RDS 安全组放行 ECS 私网 IP |
| 上线后需回滚 | `docker compose` 指定上一镜像标签 `up -d app`（保留历史 tag 即可快速回退） |

**核心日志命令**：
```bash
docker compose -f /opt/cn/docker-compose.yml --env-file /opt/cn/.env.cn ps
docker compose -f /opt/cn/docker-compose.yml --env-file /opt/cn/.env.cn logs -f app
docker compose -f /opt/cn/docker-compose.yml logs -f nginx
```

---

## 合规自检清单（每次上线前勾选）

- [ ] `.env.cn` 中无 `DATABASE_URL`（境外）、无 `oss-cn-beijing` 以外的 OSS
- [ ] 代码中 `.cn` 仅调用 `createGuaranteeIntent` + `verifyCallback`
- [ ] `CN_ICP_NO` 为真实备案号（备案通过后）
- [ ] DNS A 记录已指向 `101.200.125.199`（备案通过后）
- [ ] 安全组 80/443 已开放（备案通过后）
- [ ] SSL 证书已就位 `deploy/nginx/ssl/cn/`
- [ ] footer 备案号链接 `https://beian.miit.gov.cn` 正常渲染
- [ ] 运行时密钥仅存 `/opt/cn/.env.cn`，未进入 git/CI 日志
