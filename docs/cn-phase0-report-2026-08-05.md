# .cn 国内站阶段0 代码收口报告

- 日期：2026-08-05
- 执行人：寇豆码（software-engineer-2）
- 仓库：`D:\神雕农机\usedfarmmach`（main HEAD=f52ab2c，基线干净）
- 分支：`feat/cn-phase0`（基于 main，**未 push，未开 PR**，由主理人处理）
- 提交：`ec75739 fix(cn-phase0): 部署脚本补齐数据库初始化 + 中间件 /api 精确路径豁免`

---

## 0. 结论速览

| 项 | 结论 |
|---|---|
| 阶段0 代码改动 | **有**，2 个文件（deploy/deploy-cn.sh、src/middleware.ts），见 §1 |
| 代码就绪度 | **有条件 PASS**（代码本身可部署，但依赖 §3 用户侧待办全部就绪 + §2 风险项处置） |
| 最高优先级风险 | **数据库初始化缺失**：deploy-cn.sh 原无任何建表步骤，空 PG 库启动后 app 首页 SSR 必 500，healthcheck `/zh` 必失败 → 部署脚本超时退出。已修复（§1.1） |
| expo 展会页 | **不建议以 (cn)/expo 路由合入**：会与 [locale]/expo 路由冲突（曾致 Vercel 构建失败，见 §2.2） |
| 中间件 | 主逻辑正确，发现 1 个真实小漏洞已修（`/api` 无尾斜杠未豁免 301），其余为设计注意事项（§2.3） |
| 部署自洽性 | 基本自洽；发现 CI build 阶段依赖 `secrets.DATABASE_URL_CN` 可达性、Dockerfile build-arg 冗余（无害）、ECS 缺少 prisma 目录（已用镜像内 schema 规避）等（§2.4） |

---

## 1. 阶段0 代码改动清单

### 1.1 `deploy/deploy-cn.sh`（改动 +37 行）— 数据库初始化（#1 核心）

**问题**：
- 原脚本仅 4 步：pull 镜像 → `up -d app` → 等健康检查 → reload nginx，**无任何建表步骤**。
- docker-compose `postgres` 为全新空库（volume `cn-pg-data` 首次为空），`depends_on: service_healthy` 只保证 PG 进程就绪、**不保证表存在**。
- app 首页 `src/app/[locale]/page.tsx` 为 **SSR 直连 Prisma**（`prisma.article/product/showcaseItem` 查询），而 `(cn)` 分组下**没有 page.tsx**，即 .cn 站 `/zh` 首页命中该页 → 空库直接 500。
- 容器 healthcheck 为 `wget http://localhost:3000/zh`（compose 与 Dockerfile.cn 一致）→ 首页 500 → healthcheck 超时 → deploy-cn.sh 循环 30 次后 `exit 1`，**部署必失败**。
- **为什么不能用 `prisma migrate deploy`**：`prisma/migrations/` 仅 2 个**增量**迁移——`20260710000000_add_product_location_fields`（`ALTER TABLE "Product" ADD COLUMN ...`）与 `20260725000000_p1_user_quota_audit`（`ALTER TABLE "User" ...` + `CREATE TABLE "UsageLog"`），均依赖基础表已存在；对空库按序执行第一个迁移即报 `relation "Product" does not exist`。本项目基础表历史上由 **`prisma db push`** 驱动（package.json `db:push` 脚本），从未有初始建表迁移。

**方案（已落地）**：在 `up -d app` 之后、健康检查之前，插入**幂等建表步骤**：

```bash
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d app          # 拉起容器（server.js 可起，查询才 500）
DB_URL_CN="$(grep -E '^DATABASE_URL_CN=' "$ENV_FILE" | head -1 | cut -d= -f2-)"
docker cp cn-app:/app/prisma/schema.prisma /tmp/cn-schema.prisma           # 从镜像内取 schema（Dockerfile.cn 已 COPY prisma）
docker run --rm --network cn-net \
  -e DATABASE_URL="$DB_URL_CN" \
  -v /tmp/cn-schema.prisma:/app/schema.prisma \
  -w /app \
  node:22-alpine \
  npx --yes prisma@5.14.0 db push --skip-generate --accept-data-loss --schema=/app/schema.prisma
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" restart app       # 表就绪后重启 app
```

设计要点：
- **幂等**：`db push` 对空库全量建表；对已有库仅增量同步，可重复执行。
- **不依赖 ECS 主机有 prisma 目录**：schema 从 app 镜像内 `docker cp` 取出（镜像 `/app/prisma/schema.prisma` 存在）。
- **不依赖镜像内有 prisma CLI**：standalone 输出不含 CLI，故用一次性 `node:22-alpine` 容器 + `npx prisma@5.14.0`（版本与 package.json `^5.14.0` 一致）。
- **红线**：`DATABASE_URL` 显式传 `.env.cn` 的 `DATABASE_URL_CN`（host=cn-postgres，境内），数据不出境。注：prisma CLI 读 schema 内 `env("DATABASE_URL")`，而 `.env.cn` 中 `DATABASE_URL=` 为空，故必须显式传值。
- `--accept-data-loss`：允许破坏性变更（阶段0 新库无风险）；避免 CI 无交互环境因确认提示挂起。
- 已知代价：ECS 首次需访问 npm registry 拉取 prisma（约 20–60s），可接受。

### 1.2 `src/middleware.ts`（改动 +1/-1 行）— `/api` 精确路径豁免（#3 小修）

**问题**：`.com` 命中境内 IP 时 `isApiPath = pathname.startsWith("/api/")`，不覆盖精确的 `/api`（无尾斜杠）→ 该路径会被 301 到 .cn，可能拦截小程序/第三方以 `/api` 结尾的调用。

**修复**：
```ts
const isApiPath = pathname === "/api" || pathname.startsWith("/api/");
```

### 1.3 未改动的结论（避免过度修改）

| 项 | 结论 |
|---|---|
| expo 页 | **未合入**（理由见 §2.2） |
| Dockerfile.cn | 未改（db init 方案不依赖镜像内 CLI） |
| .github/workflows/deploy-cn.yml | 未改（`--build-arg SITE=cn` 冗余但无害，见 §2.4） |
| .env.cn | 未改（OSS 占位属用户线上配置，见 §3） |
| prisma/migrations | 未新增 baseline 迁移（阶段0 用 db push，后续建议补 baseline，见 §2.1） |

---

## 2. 上线前代码就绪度结论与风险项

### 2.1 就绪度：**有条件 PASS**

代码层面已满足可部署条件；以下风险项必须逐条确认后方可上线。

### 2.2 风险项清单（按优先级）

| # | 风险 | 级别 | 说明与建议 |
|---|---|---|---|
| R1 | **数据库初始化缺失** | 已修复 | §1.1。合入 PR 后 CI 重建镜像 + 主机执行新 deploy-cn.sh 即生效。**注意**：db push 属"直接同步 schema"而非迁移管理；上线稳定后建议用 `prisma migrate diff` 生成 baseline 迁移，切换到 migrate deploy 规范管理 |
| R2 | **基础数据缺失（seed）** | 高 | .cn 是全新空库，db push 只建表不灌数据；Brand/Category/MachineType 等基础字典、展会样例、政府数据均无。**需用户确认阶段0 是否需预置基础数据**（可复用 prisma/seed-*.ts，但涉及数据出境/拷贝决策，需主理人拍板） |
| R3 | **CI 构建期依赖 `secrets.DATABASE_URL_CN` 可达** | 高 | workflow 在 `npm run build` 与 `--build-arg DATABASE_URL` 处注入 `secrets.DATABASE_URL_CN`。若该 secret 未配置、或指向 `cn-postgres` 这类仅 ECS 内网可达的地址，GitHub Actions 无法连接 → build 失败。**需用户提供 CI 可达的构建期库**（建议：ECS 临时开放 5432 白名单给 GitHub Actions IP，或提供境内 RDS 只读/专用构建库；不得指向境外 Neon，红线） |
| R4 | **首次部署时 app 短暂 500 窗口** | 中 | 新流程先 `up -d app`（表未建，查询 500）→ db push → restart。容器本身能起、健康检查在 restart 后重新计时，无实际用户流量窗口（备案/切 DNS 前）。可接受 |
| R5 | **expo 展会页路由冲突** | 中 | `git log` 证实：`4bca143 fix(build): 删除 .cn 分站占位 page.tsx 修复路由冲突` 因 `(cn)/expo/page.tsx` 与 `[locale]/expo/page.tsx` 解析到同一路径 `[locale]/expo` 导致 Vercel 构建失败而删除。`feature/cn-split-t04t05` / `feat/expo-new-pavilions` 上的 `(cn)/expo/page.tsx` 是硬编码 SAMPLE_EVENTS 样例页（不依赖 .com 专属组件，无组件级冲突）。**建议**：① 若 .cn 需展会页，改在 `[locale]/expo/page.tsx` 内按 `SITE=cn` 分支渲染国内内容（复用同一路由）；或② 新建不冲突路径 `[locale]/cn-expo`。**不要**重新引入 `(cn)/expo` 路由 |
| R6 | **中间件设计注意点（非阻塞）** | 低 | ① `x-vercel-ip-country`/`cf-ipcountry` 为 Vercel/CF 专有头，.cn 站（ECS+nginx）下恒为空——但 .cn 站 `site=cn` 直接放行，无影响；若未来 .com 迁 ECS，需 nginx geoip 补头。② `.com→.cn` 为 301 永久重定向，浏览器会缓存，后续回退 .com 需清缓存/换 302。③ 非 zh/en locale 前缀（如 /ru）从 .com 301 到 .cn 后 .cn 不支持该 locale，可能 404/回退（next-intl 兜底），低概率。④ matcher 中 locale 列表硬编码 8 个，若 .cn 增加 locale 需同步。⑤ 鉴权 cookie 域 .com/.cn 不同，跳转后登录态不共享（预期内） |
| R7 | **Dockerfile build-arg 冗余（无害）** | 低 | CI 传 `--build-arg SITE=cn`，但 Dockerfile.cn 未声明 `ARG SITE`（用 `ENV SITE=cn` 硬编码），BuildKit 仅告警不报错。可后续清理 CI 或补 `ARG SITE` |
| R8 | **ECS 主机缺 prisma 目录** | 已规避 | CI 未向 ECS 同步 prisma/ 目录；新方案从镜像 `docker cp` schema，不依赖主机目录。若未来改走 migrate deploy，需在 CI 增加同步步骤 |
| R9 | **SSL 证书缺失** | 高 | 仓库 `deploy/nginx/` 下无 `ssl/` 目录；nginx.conf 引用 `/etc/nginx/ssl/cn/fullchain.pem`、`privkey.pem`（挂载 `./deploy/nginx/ssl`）。证书需用户提供并放置 ECS `/opt/cn/deploy/nginx/ssl/cn/`（见 §3） |

### 2.3 中间件核验结论（#3）

| 检查点 | 结果 |
|---|---|
| .com 命中境内 IP → 301 .cn | ✅ `ipCountry === "CN"` 时 301 到 `usedfarmmach.cn` 保留完整路径，并带 `x-domestic-redirect` 头 |
| /api 例外 | ✅ 主路径豁免；`/api` 无尾斜杠漏洞**已修复**（§1.2） |
| locale 前缀 | ⚠️ 301 保留原 locale；.cn 仅支持 zh/en，非 zh/en 前缀到 .cn 可能 404/回退（R6③） |
| 根路径 | ✅ matcher 含 `/`；.com 境内 `/` → 301 .cn `/` → next-intl 307 → `/zh`，无死循环 |
| www 子域 | ✅ `host.includes("usedfarmmach.cn")` 覆盖 www；301 目标统一为裸域 |
| 重定向循环 | ✅ .cn 站 `site=cn` 直接放行，无 .com→.cn→.com 回路 |
| matcher | ✅ 覆盖 `/`、8 个 locale 前缀、`/api/:path*`；静态资源已在函数内跳过 |

### 2.4 部署自洽性结论（#4）

| 检查点 | 结果 |
|---|---|
| Dockerfile.cn build-arg 与 CI | ⚠️ CI `--build-arg DATABASE_URL=secrets.DATABASE_URL_CN` 与 Dockerfile `ARG DATABASE_URL` 一致 ✅；CI 多传 `--build-arg SITE=cn`（Dockerfile 未声明，无害，R7） |
| standalone 输出路径 | ✅ `output: SITE==="cn" ? "standalone"`（next.config.js）；Dockerfile 复制 `/app/.next/standalone` → 根目录 `server.js`，`CMD ["node","server.js"]` 正确 |
| 运行时 app 读 env_file | ✅ compose `env_file: /opt/cn/.env.cn`；db.ts 按 `SITE=cn` 读 `DATABASE_URL_CN`（host=cn-postgres），`new PrismaClient({datasources:{db:{url}}})` 运行时覆盖，正确 |
| .env.cn OSS 与代码读取 | ✅ bucket `usedfarmmach-oss`、region `oss-cn-beijing` 在代码中**硬编码**（`ai-image-upload`、`field-videos/upload`、`miniapp/oss-token` 等 route 内常量），与 .env.cn 一致；运行时必需仅为 `OSS_ACCESS_KEY_ID/SECRET`（oss-upload.ts 读取，占位待替换） |
| nginx | ✅ 80→443 301；443 SSL 反代 app:3000；HSTS；`/zh` 探针；健康检查与容器一致 |
| 镜像内 prisma | ✅ Dockerfile.cn `COPY --from=builder /app/prisma ./prisma`，新 db init 方案依赖此路径取 schema |

---

## 3. 用户侧线上资源待办清单

> 代码已就绪；以下均为**用户/主理人需在阿里云、GitHub、域名侧完成**的事项。标 ✅ 表示已就绪，标 ⏳ 表示待用户提供/操作。

| # | 事项 | 状态 | 说明 |
|---|---|---|---|
| U1 | **OSS AccessKey 填入 ECS .env.cn** | ⏳（密钥已备，待落主机） | `OSS_ACCESS_KEY_ID` / `OSS_ACCESS_KEY_SECRET` 当前为 `your-aliyun-access-key-id` 占位；oss-upload.ts 运行时读取。将已备好的 RAM 子用户 Key（仅 OSS 写 usedfarmmach-oss 权限）填入 ECS `/opt/cn/.env.cn` |
| U2 | **GitHub secrets 配置** | ⏳ 用户提供 | 需配置：`DEPLOY_SSH_KEY`（deploy 用户私钥，见 U3）、`ALIYUN_ACR_REGISTRY`、`ALIYUN_ACR_USERNAME`、`ALIYUN_ACR_PASSWORD`（ACR 登录）、`DATABASE_URL_CN`（**CI 可达**的境内构建库，见 R3） |
| U3 | **ECS deploy 用户 + SSH 免密** | ⏳ 用户操作 | workflow 以 `deploy` 用户 SSH 到 `101.200.125.199`；需在 ECS 创建 deploy 用户、配 sudo/权限（docker 组）、将公钥加入 authorized_keys；`DEPLOY_SSH_KEY` 对应私钥写入 GitHub secret |
| U4 | **ECS 主机 /opt/cn 目录初始化** | ⏳ 用户操作 | 放置 `docker-compose.yml`（仓库版）、`.env.cn`（填 U1 等真实值）、`deploy/nginx/*`；首次执行 `docker compose up -d postgres` 建本地 PG 卷 |
| U5 | **SSL 证书** | ⏳ 用户提供 | 阿里云免费 DV 或 Let's Encrypt；`fullchain.pem` + `privkey.pem` 放 ECS `/opt/cn/deploy/nginx/ssl/cn/`（仓库无 ssl/ 目录） |
| U6 | **ICP 备案 + DNS 切换** | ⏳ 用户操作 | `.env.cn` 中 `CN_ICP_NO=冀ICP备2024053719号-4` 已填；**备案通过前** usedfarmmach.cn 的 DNS 不得指向 `101.200.125.199`（阿里云拦截未备案域名）。备案通过后将 A 记录指向 `101.200.125.199` |
| U7 | **微信支付/小程序（阶段1 前置）** | ⏳ 用户提供 | `WECHAT_PAY_*` 全部为占位（appid/mchid/v3key/证书/子商户号）；阶段0 若不开担保交易可暂缓，相关 route 缺配置时返回 503（按注释设计） |
| U8 | **基础数据预置（seed）** | ⏳ 需拍板 | 见 R2：全新空库是否需要预置 Brand/Category/展会/政府数据；涉及数据拷贝合规决策，需主理人确认方案后执行 |
| U9 | **CI 构建期数据库** | ⏳ 用户提供 | 见 R3：GitHub Actions 需能连接 `secrets.DATABASE_URL_CN` 指向的库（境内） |

---

## 4. 提交与后续动作

- 改动分支：`feat/cn-phase0`（commit `ec75739`，基于 main f52ab2c，**未 push**）
- 建议后续：
  1. 主理人 review `feat/cn-phase0` → 开 PR → 合 main（触发 deploy-cn.yml 全链路）
  2. 合入前完成 U1–U6、U9（否则 CI/部署会失败）
  3. 上线稳定后：补 baseline 迁移（R1）、决策 .cn expo 页形态（R5）、清理 build-arg（R7）
