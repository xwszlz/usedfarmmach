# 每日自动化报告与国际价格/卖方采集统筹协调方案

> 日期：2026-08-13  
> 背景：#1 卖方采集、#3 国际价格采集、BrandBenchmark 基准价、AI 日报四套定时任务并行，存在时间冲突、重复采集、数据割裂问题。本方案以 Orchestrator 为统一指挥中心，建立"采集 → 价格 → 基准 → 报告"的依赖链。

---

## 一、现状诊断

| 任务 | 当前调度 | 产出数据 | 问题 |
|------|---------|---------|------|
| #1 卖方采集 | 每天 06:00 (cron) | `RawListing` / `Product` | 单独跑，无下游感知 |
| #3 国际价格采集 | 每周一 07:00 (Vercel Cron) | `InternationalPrice` + 套利缓存 | 频次低；与 BrandBenchmark 重复抓国际价 |
| BrandBenchmark | 每天 07:30 (Vercel Cron) | `BrandBenchmark` | 与 AI 日报 07:30 并发，互相抢资源 |
| AI 日报 | 每天 07:30 (WorkBuddy automation) | `public/daily-reports/` + 企微推送 | 生成时未读取 BrandBenchmark；采集失败仍可能生成旧数据报告 |

核心问题：
1. **调度入口不统一**：Vercel Cron、WorkBuddy automation、Agent Orchestrator 三套各跑各的。
2. **时间冲突**：07:30 同时触发 BrandBenchmark（300s 长任务）和 AI 日报，Vercel 并发函数资源被占。
3. **无依赖链**：日报生成不检查上游数据是否已刷新，可能用前一天数据。
4. **重复采集**：#3 与 BrandBenchmark 都访问 Agriaffaires/Agroline/Mascus 等国际源。
5. **数据未融合**：BrandBenchmark 的 18 品牌全球基准价指数未进入日报内容。

---

## 二、目标

1. **单一指挥中心**：Orchestrator 的 `agentDefinition` / `agentRunLog` 成为唯一状态真相源。
2. **时间错峰**：将 07:30 的并发任务拆到 06:00–07:30 四个时间槽。
3. **失败阻断下游**：上游失败时，下游自动跳过并告警，避免用脏数据出报告。
4. **数据融合**：AI 日报每日自动引用 `BrandBenchmark` + `InternationalPrice` + `RawListing` 最新数据。
5. **去重提效**：#3 国际价格采集从"每周一跑"改为"每日跑但只做站内 Product 匹配"，BrandBenchmark 负责"全品牌市场指数"。

---

## 三、统一时间槽与数据流（北京时间）

```
06:00  #1 卖方采集          → RawListing / Product
06:30  #3 国际价格采集      → InternationalPrice（仅匹配站内已有 Product）
07:00  BrandBenchmark 刷新  → BrandBenchmark（18 品牌 × 7 源全球指数）
07:30  AI 日报生成          → 读取上述三表 + 生成 MD/PDF + 企微推送
08:00  报告分发/监控汇总    → 企微卡片 + Orchestrator 健康检查
```

数据依赖关系：

```
seller-scout ──► price-intel ──► BrandBenchmark ──► AI 日报
     │                │                │
     └─ RawListing    └─ IntlPrice     └─ 品牌基准价指数
        Product         套利缓存        18品牌×7源
```

---

## 四、三层架构设计

### 4.1 调度层：Orchestrator 作为唯一入口

- 保留 Vercel Cron 和 WorkBuddy automation，但**仅作为触发器**，调用 `/api/agents/orchestrator?agentId=xxx`。
- Orchestrator 内部维护 `dependencies` 和 `pipeline` 状态。
- 新增内置 Agent：`daily-pipeline`（虚拟调度器），负责按顺序触发 4 个任务并记录单一日志。

建议改动：

```ts
// src/lib/agents/orchestrator/types.ts
{
  agentId: "daily-pipeline",
  name: "每日数据流水线",
  description: "按依赖链依次执行卖方采集→国际价格→基准价→日报生成",
  version: "1.0.0",
  triggerType: "cron",
  schedule: "0 6 * * *", // 06:00 启动整个流水线
  endpoint: "/api/agents/orchestrator",
  dependencies: [],
}
```

### 4.2 执行层：原有 Agent 职责不变，仅调整调度

| Agent | 调整后调度 | 调整内容 |
|-------|-----------|---------|
| seller-scout | 06:00 每日 | 无逻辑改动，仍是 RawListing/Product |
| price-intel | 06:30 每日 | 频次从每周一改为每天；仅做站内 Product 匹配，不再做全品牌扫描 |
| BrandBenchmark | 07:00 每日 | 由 Vercel Cron 触发 `/api/cron/benchmark`；保留 300s maxDuration |
| AI 日报 | 07:30 每日 | 生成前检查上游三表 `lastVerified` 是否为今日；读取 BrandBenchmark 数据入报告 |

### 4.3 数据层：三表融合为日报素材

AI 日报生成脚本需要新增一个"数据快照"步骤：

```ts
// 伪代码：日报生成前的数据就绪检查
async function prepareDailyReportInput() {
  const today = getTodayStr();
  const sellerFresh = await prisma.rawListing.findFirst({ orderBy: { scrapedAt: 'desc' } });
  const priceFresh = await prisma.internationalPrice.findFirst({ orderBy: { lastVerified: 'desc' } });
  const benchmarkFresh = await prisma.brandBenchmark.findFirst({ orderBy: { lastVerified: 'desc' } });

  const ready = [
    sellerFresh?.scrapedAt >= today,
    priceFresh?.lastVerified >= today,
    benchmarkFresh?.lastVerified >= today,
  ];

  if (!ready.every(Boolean)) {
    throw new Error(`上游数据未就绪: seller=${ready[0]} price=${ready[1]} benchmark=${ready[2]}`);
  }

  return {
    benchmarkSnapshot: await getBenchmarkSummary(today),
    topArbitrage: await getTopArbitrage(10),
    newListings: await getNewListings(today, 20),
  };
}
```

---

## 五、具体实施步骤

### 步骤 1：调整 #3 国际价格采集频次（PR #67）

- 文件：`src/lib/agents/orchestrator/types.ts`
- 修改 `price-intel.schedule` 从 `"0 7 * * 1"` 改为 `"30 6 * * *"`。
- 文件：`vercel.json`
- 将 `/api/cron/update-prices` 从 `"0 23 * * 0"` 改为 `"30 22 * * *"`（UTC 对应北京时间 06:30）。
- 说明：#3 只负责"站内已有 Product 的国际比价"，不再承担全品牌市场扫描职责。

### 步骤 2：把 BrandBenchmark 时间提前到 07:00（PR #67）

- 文件：`vercel.json`
- 将 `/api/cron/benchmark` 从 `"30 23 * * *"` 改为 `"0 23 * * *"`（UTC 对应北京时间 07:00）。
- 文件：`src/app/api/cron/benchmark/route.ts`
- 在返回结果中增加 `lastVerified` 时间戳写入，便于下游检查。

### 步骤 3：新增 `daily-pipeline` 虚拟 Agent（PR #69）

- 文件：`src/lib/agents/orchestrator/types.ts`、`src/lib/agents/orchestrator/agent.ts`
- 新增 `daily-pipeline` 的执行逻辑：
  1. 触发 `seller-scout`；等待完成；失败则中止并告警。
  2. 触发 `price-intel`；等待完成；失败则记录但继续（套利数据非日报强依赖）。
  3. 触发 `BrandBenchmark`；等待完成；失败则中止并告警。
  4. 触发 AI 日报生成（调用现有生成脚本/endpoint）；失败则告警。
- 所有步骤写入同一条 `agentRunLog.result.pipeline` 数组，便于在 Orchestrator 后台看整条链路。

### 步骤 4：AI 日报接入 BrandBenchmark（PR #69）

- 文件：日报生成脚本（需定位到具体文件，当前由 WorkBuddy automation `ai` 触发）
- 新增输入：
  - 各品牌机型昨日 vs 今日中位价涨跌。
  - 样本量前三的源站（如 Agroline 27 条）。
  - 俄线代理状态（若未配 `RESIDENTIAL_PROXY`，报告里诚实标注"俄线待激活"）。
- 新增输出：在日报 MD 中增加 `### 全球基准价指数（18品牌）` 章节。

### 步骤 5：企微告警与监控卡片（PR #69）

- 复用 `scripts/push-daily-to-wecom.js` 的 webhook 能力。
- 新增 `scripts/alert-pipeline.js`：
  - 读取当日 `daily-pipeline` 运行结果。
  - 任一环节失败，推送告警 Markdown 到企微。
  - 全部成功，推送绿色汇总卡片（含新增国际价条数、BrandBenchmark 成功源数、日报文件链接）。

### 步骤 6：清理重复自动化

- WorkBuddy automation `automation-1786547266219`（多品牌基准价每日刷新）保持 `PAUSED`（避免与 Vercel Cron 双刷）。
- WorkBuddy automation `ai`（AI 日报）继续保留作为备用触发，但建议最终迁移到 Orchestrator `daily-pipeline` 尾部统一触发。

---

## 六、数据融合：日报里展示 BrandBenchmark

建议日报新增章节模板：

```markdown
## 全球二手农机基准价指数（2026-08-13）

| 品牌 | 机型 | 源站 | 样本数 | 中位价（外币） | 折算人民币 | 较昨日 |
|------|------|------|--------|----------------|------------|--------|
| 芬特 | 724 Vario | Agroline | 14 | €143,000 | 113.0万 | +2.1% |
| 克拉斯 | Jaguar 970 | Agroline | 8 | €315,000 | 248.9万 | 持平 |
| 约翰迪尔 | 8R 410 | Mascus | 0 | - | - | 源站无数据 |

> 注：Mascus 为客户端渲染，当前结构化解析返回 0；俄线 Avito/OLX 待配置住宅代理后激活。
```

此章节由 BrandBenchmark 表自动生成，不依赖人工粘贴。

---

## 七、监控告警

| 场景 | 级别 | 动作 |
|------|------|------|
| seller-scout 失败 | critical | 阻断下游，企微告警 |
| price-intel 失败 | warning | 不阻断，日报标注"国际价未更新" |
| BrandBenchmark 失败 | critical | 阻断日报生成，企微告警 |
| AI 日报生成失败 | critical | 企微告警，保留昨日报告 |
| 日报用非今日数据 | warning | 生成时检查 `lastVerified`，不符合抛错 |
| 任一 Agent 运行超过 30 分钟 | warning | Orchestrator 健康检查告警 |

---

## 八、合规注意

1. **数据不出境**：`BrandBenchmark` 外国行情入 Neon（新加坡）合法；`.cn` 展示需通过现有 `export-cn-content` → `import-*-to-cn` 流程复制到 `cn-postgres`。
2. **未备案红线**：日报中不得出现"交易服务费""资金托管"等未备案业务表述；国际价格仅供"参考/信息发布"。
3. **品牌称谓**：涉及协会内容严格使用"中国农机流通协会·二手农机流通分会 副会长单位"，不得省略"分会"。

---

## 九、下一步行动

1. 用户确认本方案后，按 PR #67（时间调整）、PR #69（pipeline + 数据融合）分批实施。
2. 先改时间槽（步骤 1、2），观察 1–2 天无冲突后再做 pipeline（步骤 3、4、5）。
3. 俄线住宅代理配置后，BrandBenchmark 会自然产出俄线数据，日报无需额外改动即可展示。

---

## 十、#1 国际采集（Agriaffaires）补回与路径修复（2026-08-13）

### 10.1 背景
`src/lib/agents/seller-scout/execute.ts` 的国际分支（mode=international / all）原本依赖两个**不存在**的文件：
`scripts/scrape_agriaffaires.py` 与 `scripts/import-seller-scout.ts`，导致 #1 国际采集长期为空跑（`intlCount` 恒为 0）。
本次把这两个文件补回，并把 #1 与第三节流水线对齐。

### 10.2 补回的文件
| 文件 | 作用 | 输出/写入 |
|------|------|----------|
| `scripts/scrape_agriaffaires.py` | Agriaffaires 国际爬虫（9 大品牌） | `scripts/agriaffaires_data.json`（与国内爬虫同一 JSON 契约） |
| `scripts/import-seller-scout.ts` | 国际数据导入 | 写入 `RawListing`（source=`agriaffaires`，EUR→CNY 折算） |

### 10.3 与流水线的对齐点
- 国际采集是 #1 卖方采集的 `international` 子任务，与国内采集同跑（默认 `all`），统一落 `RawListing`。
- `RawListing` 经 `reviewedAt` 审核上架为 `Product` 后，由 #3 `price-intel` 匹配站内已有 `Product` 生成 `InternationalPrice`（套利数据）—— 形成 `seller-scout → Product → price-intel` 的依赖链。
- 在 `RawListing.source` 中以 `agriaffaires` 明确标识国际挂牌，便于运营区分国内外数据源。

### 10.4 反爬现实（与 BrandBenchmark 一致）
Agriaffaires 对裸 HTTP 客户端返回 **403**。已实测：沙箱直连返回 0 条。
两种解法（爬虫已内置 `HTTPS_PROXY` 支持）：
1. 配置住宅代理 `HTTPS_PROXY`（EU 出口最优）；
2. 改由 EU 区域服务器运行（Vercel 法兰克福/巴黎区域）。
命中 0 条属"诚实空跑"，清晰打印日志，不伪造数据。配 EU 代理后即可自然产出真实国际挂牌。

### 10.5 路径 bug 修复（影响国内+国际两支）
此前 `execute.ts` 的 `findRepoRoot` 与 Python 爬虫 OUTPUT 路径假设互相矛盾（国内分支其实也在 Vercel 上读不到文件）。本次统一修复：
- `findRepoRoot` 改为**向上爬到含 `scripts/` 的目录**作为仓库根；
- 两个爬虫的 `OUTPUT_FILE` 改为写到**脚本同级 `scripts/`**（与导入脚本 `__dirname` 一致）；
- `execute.ts` 国内/国际分支的结果文件与导入脚本路径去掉多余的 `usedfarmmach` 段，统一用 `scriptsDir`。
三处读/写路径现在完全一致，国内与国际采集在 Vercel/本地均能被正确读取。

### 10.6 合规说明
国际卖家为外国主体（Agriaffaires 以法国/欧洲为主），其挂牌信息属**外国公开行情**，写入 Neon（新加坡境外库）合法，区别于"中国卖家 PII 出境"的合规红线。
