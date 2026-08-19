# 套利总报告 → 网站落地 执行手册（2026-08-19）

> 范围：把《神雕农机_国内外套利总报告_2026-08-16.html》的三类内容落到网站。  
> 执行模式（用户确认）：**A 数据 + B 分析 + C 前端全做**；交付物为「产出文件 + 脚本 + 本 ECS 手册」，所有 DB 写入在 **ECS 终端**执行（沙箱不可达 cn-postgres；ECS 可同时达 Neon 与 cn-postgres）。



---

## 0. 三类内容与落地映射

| 报告内容                     | 落地目标                                     | 表 / 组件                       | 是否合规出境          |
| ------------------------ | ---------------------------------------- | ---------------------------- | --------------- |
| 境内二手国际品牌农机底数（114 条，含手机号） | cn-postgres `RawListing`                 | `/benchmark` ④ 面板（境内侧）       | ❌ 仅境内库（PII 不出境） |
| 欧系农机具国际基准（53 条，公开挂牌）     | `BrandBenchmark`（Neon + cn-postgres 各一份） | `/benchmark` ①/② + ④ 面板（国际侧） | ✅ 公开数据可双向       |
| 套利分析文章（中/英/俄）            | `MarketIntel`（Neon → 同步 .cn）             | `/intelligence`、首页情报卡        | ✅ 公开衍生分析        |
| /benchmark 价差可视化面板（代码）   | 前端组件（已改完，待部署）                            | `BenchmarkClient.tsx` ④      | —               |

---

## 1. 合规红线（必读，执行前确认）

- **境内卖方数据（含手机号等个人信息）只能写入 cn-postgres（数据不出境）**。
  - `import-seller-scout-domestic.js` 自带护栏：未设置 `DATABASE_URL_CN` 且非 `SITE=cn` 时直接 `exit 2` 拒绝导入。
  - `seed-cn-base-data.mjs` 的 `SKIPPED_TABLES` 已含 `RawListing`，基础镜像同步不会把境内卖方带出。
- **国际基准 / 市场情报为公开数据衍生**，可合法写入 Neon（.com）与 cn-postgres（.cn）双向。
- 切勿把 `domestic_sellers_data_v2.json` 或境内 `RawListing` 导入 Neon/境外库。

---

## 2. 前置产物（已生成，待执行）

| 文件                                                                                     | 说明                                   | 生成方式                                     |
| -------------------------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------- |
| `scripts/domestic_sellers_data_v2.json`                                                | 境内 114 条（86 有价 / 28 面议），由台账转换        | `node scripts/build-domestic-import.mjs` |
| `scripts/domestic_sellers_seed.json`                                                  | 同上**种子快照**，随镜像部署、爬虫失效兜底（已生成） | `cp domestic_sellers_data_v2.json domestic_sellers_seed.json` |
| `scripts/seed-brand-benchmark-eu.ts`                                                   | 读欧系证据 JSON → upsert `BrandBenchmark` | 直接运行                                     |
| `二手国际品牌农机_欧系农机具证据_2026-08-16.json`（仓库根目录外 `D:\神雕农机\`）                                  | 53 条 WebSearch 国际挂牌                  | 已就绪                                      |
| `scripts/seed-market-intel-arbitrage.ts` + `market_intel_arbitrage_2026-08-19.json`    | 套利文章 upsert `MarketIntel`（固定 id）     | 直接运行                                     |
| 前端：`src/app/api/benchmark/route.ts` + `src/app/[locale]/benchmark/BenchmarkClient.tsx` | ④ 价差面板（已加，tsc 通过）                    | 走 PR 部署                                  |

> 台账源：`D:\神雕农机\中国境内二手国际品牌农机台账_2026-08-16.json`（114 条，权威合并版）。  
> 重新生成境内 JSON：`node scripts/build-domestic-import.mjs`（幂等，覆盖写）。  
> ⚠️ **git 跟踪提醒**：`.gitignore` 忽略整个 `scripts/`，种子文件与已跟踪脚本需 `git add -f`；本次新增的 `domestic_sellers_seed.json` 必须 `git add -f` 并提交，否则 GitHub Actions 打包镜像时缺失该文件，Dockerfile 的 `COPY` 会失败、自动化中断。

---

## 3. 执行步骤（严格按顺序）

### 步骤 1 — 境内 114 条入库 cn-postgres（A·境内）【已自动化，免手动 scp】

已改造为**随镜像部署 + cn-scout cron 自动回退**，无需手动传文件：

1. **提交种子文件**（关键：`.gitignore` 忽略整个 `scripts/`，必须强制跟踪）：
   ```bash
   git add -f scripts/domestic_sellers_seed.json
   git commit -m "chore: add domestic WebSearch ledger seed (114 listings)"
   ```
   配套改动（已随本手册就绪，一并合入 PR）：
   - `Dockerfile.cn` 已 `COPY domestic_sellers_seed.json` 进 `cn-scout` 镜像；
   - `scripts/run-domestic-scout.sh` 已改：爬虫被 WAF 拦/0 条时自动把种子复制为
     `domestic_sellers_data_v2.json` 再入库。

2. **部署即生效**：合并 PR → ECS 重建 `cn-scout` 镜像（`deploy-cn.sh`）→ 容器每日 07:10 cron：
   - 爬虫有效 → 用实时采集；
   - 爬虫被 WAF 拦（当前常态）→ 回退种子台账 → 写入 cn-postgres（114 条，contentHash 去重）。
   全程无需人工登录 ECS 执行命令。
3. **可选手动验证**（部署后或想立即确认时，登录 ECS 执行）：
   ```bash
   docker exec cn-scout node scripts/import-seller-scout-domestic.js
   docker exec cn-postgres psql -U cn_app -d usedfarmmach_cn -t -c \
     "SELECT count(*) FROM \"RawListing\" WHERE source LIKE 'domestic_%';"
   ```
   预期 ≥ 114（重复跑不增，contentHash 去重）。


---

### 步骤 2 — 欧系 53 条 BrandBenchmark 双库（A·国际）

> 国际公开数据，可双向。`.ts` 需 `tsx`，ECS 容器内用 `npx tsx`（首次会临时拉取 tsx；若离线先 `npm i -g tsx`）。幂等（按 `brand+model+sourceSite+sourceUrl`）。

对 **.com(Neon)** 与 **.cn(cn-postgres)** 各跑一次：

```bash
# .com / Neon
ssh root@120.200.125.199 "docker exec -e DATABASE_URL='<Neon 连接串>' cn-app \
  npx tsx scripts/seed-brand-benchmark-eu.ts"

# .cn / 境内（容器 env 已含 DATABASE_URL_CN）
ssh root@120.200.125.199 "docker exec -e SITE=cn cn-app \
  npx tsx scripts/seed-brand-benchmark-eu.ts"
```

验证（Neon 与 cn 各查一次，行数应一致 = 53）：

```bash
ssh root@120.200.125.199 "docker exec cn-postgres psql -U cn_app -d usedfarmmach_cn -t -c \
  \"SELECT count(*) FROM \"BrandBenchmark\" WHERE \"lastVerified\" >= '2026-08-16'::date;\""
```

---

### 步骤 3 — MarketIntel 套利文章（B 分析）

1. 写 Neon（固定 id `arb-report-2026-08-19`，幂等）：
   ```bash
   ssh root@120.200.125.199 "docker exec -e DATABASE_URL='<Neon 连接串>' cn-app \
     npx tsx scripts/seed-market-intel-arbitrage.ts"
   ```
2. 导出 .cn 同步 JSON（**必须用 `2026-08-19`，与 JSON 内 `date` 字段一致**，否则按日过滤会漏）：
   ```bash
   ssh root@120.200.125.199 "docker exec -e DATABASE_URL='<Neon 连接串>' cn-app \
     node scripts/export-cn-content.js 2026-08-19"
   ```
   产物：`public/daily-reports/intelligence_2026-08-19.json`（读取 Neon → 写静态 JSON，**不直接连 .cn**）。
3. 同步进 .cn：该 JSON 随 PR 进 `main`、打进 .cn 镜像，`deploy-cn.sh` 自动执行 `import-intelligence-to-cn.js` 入 cn-postgres。
   - 或 ECS 手动触发（需镜像已含该 JSON）：
     ```bash
     ssh root@120.200.125.199 "docker exec cn-app node scripts/import-intelligence-to-cn.js"
     ```
4. 验证：
   ```bash
   ssh root@120.200.125.199 "docker exec cn-postgres psql -U cn_app -d usedfarmmach_cn -t -c \
     \"SELECT id, region FROM \"MarketIntel\" WHERE id='arb-report-2026-08-19';\""
   ```

---

### 步骤 4 — 前端价差面板部署（C）

- 代码已改完（`route.ts` 计算 `spread` 数组 + `BenchmarkClient.tsx` ④ 渲染），`tsc --noEmit` 通过（仅无关视频子项目有预存错误）。
- 提交 PR → 合并 `main`：
  - **.com**：Vercel 监听 `main`，合并即部署。
  - **.cn**：ECS 重建镜像（`deploy-cn.sh` 会 COPY `public/daily-reports/intelligence_*.json` 并导入 cn-postgres）后部署。
- `/benchmark` ④ 面板在「境内 RawListing 与该品牌国际 BrandBenchmark 同时存在」后自动出数（否则显示「价差暂无可计算」提示）。

---

## 4. 验证总表

| 项    | 查什么                         | 位置 / 命令                         |
| ---- | --------------------------- | ------------------------------- |
| 境内底数 | `RawListing` domestic\_% 行数 | cn-postgres（步骤 1 验证）            |
| 欧系基准 | `BrandBenchmark` 本次新增行数     | Neon + cn-postgres（步骤 2 验证）= 53 |
| 套利文章 | `MarketIntel` 固定 id 行       | Neon + cn-postgres（步骤 3 验证）     |
| 前端面板 | `/benchmark` ④ 是否出数         | 浏览器访问 `/benchmark`，需 A 两类数据齐备   |
| 情报页  | `/intelligence` 是否出现文章      | 双站                              |

---

## 5. 回滚

```bash
# 境内 RawListing：仅删本次（scrapedAt ≥ 采集日），不影响其他 domestic 源
DELETE FROM "RawListing" WHERE source LIKE 'domestic_%' AND "scrapedAt" >= '2026-08-16';

# 欧系 BrandBenchmark：仅删本次 lastVerified 行
DELETE FROM "BrandBenchmark" WHERE "lastVerified" >= '2026-08-16'::date;

# MarketIntel（Neon）：删固定 id
DELETE FROM "MarketIntel" WHERE id='arb-report-2026-08-19';
# .cn 侧：重新跑 import-intelligence-to-cn.js 会按日重建（删除当日全部再写入），无需手工删

# 前端：revert 对应 PR 即可
```

---

## 6. 已知限制 / 备注

- **品类级均价受型号结构影响**：百姓网低价小拖拉机拉低境内拖拉机均价，面板为「指示级」，UI 已注明；精确套利须同型号/马力/配置逐台比对（报告 §4.2 已列 52 条逐台机会）。
- **国际基准口径**：欧系 53 条为二手挂牌价（非拍卖成交），与拖拉机所用拍卖成交口径略有差异。
- **库恩反向价差**：属进口方向，受中国二手设备进口品类准入限制，实操审慎（面板已标「进口方向」）。
- **scout cron 覆盖**：见步骤 1 提醒；本次导入行持久，cron 不清除。

---

## 7. 相关文档

- `docs/cn-content-sync-solution-2026-08-12.md`（双站内容同步方案）
- `docs/cn-deploy-runbook.md`（.cn 部署 / deploy-cn.sh）
- `docs/cn-db-runbook.md`（ECS 数据库与 cron 运维）
- 套利总报告：`D:\神雕农机\神雕农机_国内外套利总报告_2026-08-16.html`
