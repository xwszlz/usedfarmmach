# Stage 1 QA v2 独立复验报告 — .cn → .com 产品同步（同步核心 + 对账 + Cron）

> 复验人：team-lead（代跑关键实测项）｜日期：2026-10-04
> 复验对象：`D:\神雕农机\_wt-cn-sync-s1`，分支 `feat/cn-com-product-sync-stage1`，基线 `origin/main` = `a18254b`
> 上游报告：`docs/cn-to-com-product-sync-stage1-qa-report.md`（QA v1，判定 **PASS**，0 HIGH · 3 MEDIUM · 6 LOW）
> 本轮目标：**对 v1 的 6 条整改建议逐条复验「是否真修」**，并补 v1 自认的覆盖盲区
> 硬约束：全程 **mock `@/lib/db`，绝不连真库**；未做任何 git 写操作；探针用完即删（已归档至仓库外）

---

## 0. 判定速览

| 项 | 结果 |
| --- | --- |
| **最终判定** | ✅ **PASS** |
| 工程单测 | **14 passed / 0 failed**（`npm run test:cn-sync-s1`） |
| 对抗性探针 | A **9/0** ｜ B **25/3** ｜ C **9/0** |
| 探针 B 的 3 处失败 | **全部定性为「探针自身缺陷 / HTTP 规范行为」，非代码缺陷**（见 §五） |
| v1 六条建议 | **4 条确认已修**、**2 条部分**、**1 条未修**（承为 LOW） |
| 遗留问题（本 feature 口径） | **0 HIGH · 0 MEDIUM · 5 LOW**（4 条承自 v1，1 条本轮新增） |
| 数据安全红线 | ✅ 坐标 / PII 未出境；✅ 无「失败当空结果」；✅ 四重护栏成立；✅ 已泄漏密钥通道已封 |
| `tsc --noEmit` | 仅 **1 处存量**报错（`test/cookie-secure.test.ts` TS5097，自 PR #109 起未改动）→ **非本 feature 引入** |

---

## 一、v1 六条整改建议 — 逐条复验

| # | v1 建议 | 复验方式 | 结论 |
| --- | --- | --- | --- |
| 1 | **MEDIUM-1** 两条 Cron 移除 `?token=` 兜底，仅认 `CRON_SECRET` | 探针 B：**4 例 × 2 路由**（未配密钥 + 泄漏 token；已配密钥 + `?token=`；无 header；错 bearer …） | ✅ **已修** |
| 2 | **MEDIUM-2** `run-sync.ts` 失败分支补 `stats.error = errorMessage` | 探针 A：T6b / T6c 两条失败路径 | ✅ **已修** |
| 3 | **MEDIUM-3** `resolveBrand` 匹配既有 brand 时校验 `isImported` 并告警 | 探针 A：T4b（`isImported=false` 场景） | ✅ **已修** |
| 4 | **LOW-1** `iterateIncremental` 增加「游标未推进」显式守卫 | 探针 B：C1–C4 四边界 | ✅ **已修** |
| 5a | **LOW-2** 护栏② `recentRunsHealthy` 按 `job` 过滤 | 代码取证 `reconcile.ts:143` | ❌ **未修** → 承为本轮 LOW-1 |
| 5b | **LOW-4** 部署清单显式要求配置 `CRON_SECRET` | `.env.example` diff + 路由返回码 | 🟡 **已部分缓解**（见下） |
| 6 | 把 **cron 鉴权**与 **reconcile 护栏**纳入工程单测 | 单测用例全览 | 🟡 **部分**（见下） |

### 5b 补充：LOW-4 的实际改善（比 v1 的预判更好）

v1 的判断是「未配 `CRON_SECRET` → 两条 cron **永久 401**（fail-closed 安全，但**静默不跑**）」。
实际实现把这一分支改成了 **显式 503 `cron-misconfigured`**，并附 `console.error`：

```ts
if (!process.env.CRON_SECRET) {
  console.error("[cn-sync] CRON_SECRET 未配置，cron 无法鉴权，同步/对账不会运行");
  return NextResponse.json({ ok: false, error: "cron-misconfigured" }, { status: 503 });
}
```

探针 B 实测：未配密钥时**返回 503 而非 401**（两条路由各 1 例通过）。
→ 「静默不跑」这一核心担忧**已被消除**：配置缺失是可被监控直接捕获的 5xx，而非伪装成鉴权失败的 4xx。
`.env.example` 亦已加显式警示行（`⚠️ 必须配置，否则两条新 cron 永久 503`）。

**残留**：手动补跑通道收窄 —— 移除 `?token=` 后必须持有 `CRON_SECRET` 才能手工触发（见 §八 LOW-3）。

### 6 补充：单测覆盖的实际进展

单测由 v1 时代的 9 例增至 **14 例**，新增 7 例集中覆盖 v1 的盲区：

| 新增用例 | 对应 v1 盲区 |
| --- | --- |
| `upsertProduct()：id 被非同步产品占用（卖家不符）→ conflict 且零写库` | 冲突守卫 |
| `upsertProduct()：同 id 同属系统卖家 → 认领（adopted）` | 幂等 / 认领 |
| `upsertProduct()：同 id 同卖家但 modelName 不符 → 仍认领 + lineageWarning` | 血缘校验 |
| `upsertProduct()：哈希未变且 isActive → skipped` | 幂等 |
| `upsertProduct()：既有品牌 isImported=false → 上报 brandMismatchBrand` | **v1 MEDIUM-3** |
| `iterateIncremental()：满页 + 游标不变 → cursor-stalled 停手` | **v1 LOW-1** |
| `reconcile()：单条删除抛非外键错 → 不中断整批，计入 skipped 并告警` | **v1 LOW-5** |

**未纳入**：cron 鉴权（`CRON_SECRET` 的 404 / 503 / 401 / 200 四态）**仍无工程单测**，本轮仅由临时探针覆盖（探针已删）→ 记为 §八 LOW-5。

---

## 二、核心实测：T1 双轮重放（本轮唯一「必须真跑」项）

> 为什么是关键项：两库共享 cuid，`.cn` 库中 10 条产品系 2026-08-03~08-25 从 `.com` 复制。
> 若「同 id 历史副本」被误判为 `conflict`，则**每轮同步都会产生告警**（告警风暴）+ **产品永不入账本**。
> 因此判据是：**第二轮及以后 `conflict` 必须恒为 0**。

```
=== QA S1-v2 PROBE A: two-round replay / adopt / conflict / lineage / error ===
  [r1] {"ok":true,"processed":11,"created":1,"updated":0,"skipped":0,"adopted":10,"conflict":0,"errors":0,"brandMismatch":0,"lineageMismatch":0}
  [r2] {"ok":true,"processed":11,"created":0,"updated":0,"skipped":11,"adopted":0,"conflict":0,"errors":0,"brandMismatch":0,"lineageMismatch":0}
  ✓ T1 ★ round1 adopt(10)+create(1); round2 replay -> conflict MUST be 0
      [3 rounds conflict] 0,0,0 | skipped 0,11,11
  ✓ T1b ★ larger replay: 3 consecutive rounds stay conflict=0 (no alert storm)
```

**结论**：第 1 轮 10 条走 **adopt（认领，仅补账本、Product 零字段改动）**、1 条新建；
第 2 轮全部 `skipped:11`，`created/adopted/conflict` 全 0；**连跑 3 轮 `conflict` 恒为 `0,0,0`** → **无告警风暴**。✅

---

## 三、探针 A 全量结果（9 passed / 0 failed）

| 用例 | 原始输出 | 结论 |
| --- | --- | --- |
| T1 ★ 双轮重放 conflict 必须 0 | 见 §二 | ✅ |
| T1b ★ 三轮连跑仍 0 | `0,0,0` | ✅ |
| T2 adopt 只写账本，Product 零改动，`sourceHash === contentHash(item)` | — | ✅ |
| T3 同 id + **非系统卖家** → `conflict` + 零写入 | — | ✅ |
| T4 血缘不符（modelName/year）→ 仍 `adopted`，**不阻断**，`lineageMismatch` 计数 + ≤1 条告警 | `{"adopted":10,"lineageMismatch":10,"conflict":0}` | ✅ |
| T4b 品牌 `isImported=false` → `brandMismatch:2`、`brand.update=0`、≤1 条告警 | `{"created":2,"brandMismatch":2}` | ✅ |
| T6a 单条读失败 → `errors:1`，**循环继续**（其余 2 条仍处理） | `{"processed":3,"created":2,"errors":1}` | ✅ |
| T6b `iterateIncremental` 失败 → `stats.error = "export-unreachable"` | `{"ok":false,"error":"export-unreachable"}` | ✅ |
| T6c 外层 catch → `stats.error = "boom-outer"` | `{"ok":false,"error":"boom-outer"}` | ✅ |

**PROBE A RESULT: 9 passed, 0 failed**

---

## 四、探针 B 全量结果（25 passed / 3 failed）

覆盖：**cron 鉴权口径（12 例）+ `since` 透传（1）+ 游标四边界 C1–C4（4）+ 对账隔离 R1（1）**，×2 路由。

```
  ✓ incremental / reconcile: SITE=cn -> 404
  ✓ 两条路由: CRON_SECRET UNSET -> 503 cron-misconfigured (NOT 401)
  ✓ 两条路由: CRON_SECRET unset + ?token=<leaked INTERNAL_API_KEY> -> 503 (token branch GONE)
  ✓ 两条路由: CRON_SECRET set + ?token=<secret> in query -> 401 (token branch GONE)
  ✓ 两条路由: CRON_SECRET set + no auth header -> 401
  ✓ 两条路由: CRON_SECRET set + wrong bearer -> 401
  ✓ 两条路由: CRON_SECRET set + Bearer no space -> 401
  ✓ 两条路由: CRON_SECRET set + lowercase bearer -> 401
  ✓ 两条路由: CRON_SECRET set + raw secret only -> 401
  ✗ 两条路由: CRON_SECRET set + Bearer with trailing space -> 401 :: status 200   ← §五-①
  ✓ 两条路由: correct Bearer -> 200
  ✓ incremental: 'since' query param IS still read & forwarded
  ✓ C1 first round (no since) does NOT false-trip cursor-stalled
  ✓ C2 since given, nextSince===since but nextId advances -> NOT stalled (continues)
  ✓ C3 full page + identical since AND sinceId -> cursor-stalled
  ✓ C4 missing nextSince/nextId on full page -> stops cleanly (no stall)
  ✗ R1 reconcile: 2 non-FK failures do NOT abort batch; 1 aggregated alert :: checked=undefined  ← §五-②

PROBE B RESULT: 25 passed, 3 failed
```

**关键结论**：`?token=` 分支在**两条路由上均已彻底移除**（未配密钥 / 已配密钥两种环境下各测 1 例，
并额外验证「传入已泄漏的 `INTERNAL_API_KEY`」不再放行）→ **v1 MEDIUM-1 关闭**。

---

## 五、3 处失败的定性（含反证）

### ① & ② `Bearer <secret> + 尾随空格 → 200`（2 例）

**这不是代码缺陷，是 HTTP 规范行为。**

按 RFC 9110，header 字段值的**首尾 OWS（空格 / tab）在解析时被剥离**，且**两侧都会剥**。
`Headers` 构造时即完成规范化 → 抵达路由时 `` `Bearer SEC ` `` 与 `Bearer SEC` **已不可区分**。

**反证（探针 C，3 例全绿）**：

```
  ✓ Headers 构造时剥掉尾随空格  [输入 "Bearer SEC " → 读出 "Bearer SEC"]
  ✓ Headers 构造时剥掉前导空格  [输入 " Bearer SEC" → 读出 "Bearer SEC"]
  ✓ Headers.set 也剥掉尾随 OWS  [读出 "Bearer SEC"]
  ✓ 内部双空格【不会】被规范化（必须仍不匹配）  [读出 "Bearer  SEC"]
  ✓ NextRequest 中带尾随空格的 header 读出来也是规范化的  [读出 "Bearer SEC"]
```

即：**内部**双空格 `Bearer  SEC` 不被规范化 → 探针 B 中该例返回 401（通过）。
两个 `route.ts` 的鉴权均为严格比较 `` headers.get("authorization") === `Bearer ${secret}` `` 且**不含 `.includes(`**（探针 C 静态断言 `strict=true noIncludes=true`）→ 无子串绕过风险。

### ③ `R1 reconcile ... :: checked=undefined`（1 例）

**这是探针 B 自身的缺陷，不是代码缺陷。**

探针 B 第 9–10 行用 `Module._load` 打了全局桩：

```ts
if (request === "@/lib/cn-sync/run-sync") return { runCnProductSync: async (o: any) => { incCalls.push(o); return { ok: true }; } };
if (request === "@/lib/cn-sync/reconcile") return { reconcile: async (o: any) => { recCalls.push(o); return { ok: true }; } };
```

→ R1 里 `await reconcile(...)` 拿到的是返回 `{ok:true}` 的 **stub**，自然没有 `checked/deleted/skipped`。
**探针 C 已实证该劫持生效**：

```
  ✓ require('@/lib/cn-sync/reconcile') 被 Module._load 换成 stub  [返回 {"ok":true}（真函数不可能只返回这个键）]
  ✓ 真 reconcile.ts 的 stats 确实含 checked/deleted/skipped  [源码中三者均初始化为 0]
```

**v1-LOW-5 的独立验证并未因此落空** —— 由**工程单测**覆盖，且断言比 R1 更精确：

```
  ✓ reconcile()：单条删除抛非外键错 → 不中断整批，计入 skipped 并告警
```

该用例断言 `res.ok === true`、`res.checked === 3`、`res.deleted === 1`、`res.archivedFallback === 0`、`res.skipped === 1`
（构造 3 条 map：1 条保留 + 1 条正常删 + 1 条抛非外键错）→ **结论：v1 LOW-5 覆盖充分，可关闭**。

---

## 六、探针 C 定性证据（9 passed / 0 failed）

| 用例 | 读出值 |
| --- | --- |
| `Headers` 构造剥尾随空格 | `"Bearer SEC "` → `"Bearer SEC"` |
| `Headers` 构造剥前导空格 | `" Bearer SEC"` → `"Bearer SEC"` |
| `Headers.set` 剥尾随 OWS | `"Bearer SEC"` |
| 内部双空格**不**规范化 | `"Bearer  SEC"`（≠ `H`） |
| `NextRequest` header 同样被规范化 | `"Bearer SEC"` |
| 两条 `route.ts` 鉴权均为严格 `===` 且无 `includes` | `strict=true noIncludes=true` |
| `Module._load` 劫持 `@/lib/cn-sync/reconcile` 生效 | 返回 `{"ok":true}` |
| 真 `reconcile.ts` 的 stats 含 `checked/deleted/skipped` | 源码中三者均初始化为 `0` |

**PROBE C RESULT: 9 passed, 0 failed**

---

## 七、v1 覆盖盲区补测对照

| v1 自认盲区 | 本轮处理 |
| --- | --- |
| cron 鉴权未测（掩盖 MEDIUM-1） | ✅ 探针 B 12 例 × 2 路由；`?token=` 通道确认封死 |
| `reconcile` 四重护栏未测 | ✅ 探针 B R1（作废，见 §五-③）+ 工程单测 + 源码逐条核对（护栏①空快照 / ②健康度 / ③只动 `isActive` map / ④ tombstone） |
| `SyncStats.error` 契约未测（掩盖 MEDIUM-2） | ✅ 探针 A T6b / T6c |
| `resolveBrand` 的 `isImported` 对齐未测（掩盖 MEDIUM-3） | ✅ 探针 A T4b（`brandMismatch:2`、`brand.update=0`） |
| `vercel.json` 结构化比对未测 | ✅ 本轮 diff 取证：**新增 8 行、删除 0 行**；原 4 条 cron（`update-prices` / `benchmark` / `daily-report` / `keep-alive`）**逐字未变** |
| `fetchFullIdSet` 的 cursorReset / 去重 / 失败即 null | ✅ 探针 B C1–C4 |
| **仍无法验证**（同 v1 §4） | 真实库行为（RLS / 真实 P2003 / `$transaction` 语义 / `.com` 是否已存在同名 `isImported=false` 品牌）；Vercel Cron 是否真注入 `Authorization: Bearer`；`.cn` 导出接口真实契约；`pushToGroup` 真实投递；端到端「`.cn` 发布 → ≤15min `.com` 可见」 |

---

## 八、遗留问题（0 HIGH · 0 MEDIUM · 5 LOW）

| ID | 等级 | 标题 | 证据性质 | 处置建议 |
| --- | --- | --- | --- | --- |
| **LOW-1** | 🟡 健壮性 | 护栏②`recentRunsHealthy` **未按 `job` 过滤**（承自 v1 LOW-2） | 代码级（`reconcile.ts:143`） | `findMany({ where: { job: "incremental" }, … })`，或明确口径。**方向保守**（fail-safe），但 incremental 每 15 分钟一次，最近 3 条几乎必为 incremental → 对账可能被长期饿死。Stage 2 |
| **LOW-2** | 🟡 匹配精度 | `resolveBrand`/`resolveCategory` 按名匹配可能**误挂同名异实体**（承自 v1 LOW-3） | 代码级（`run-sync.ts:262-268 / 294-300`） | 增加二次校验。⚠️ **本机已具象化**：`.cn` 品牌表已有重复行（`krone`(科罗尼) vs `Cmuthrf…`(Krone)、`claas`(克拉斯) vs `Cmut9ecr…`(CLAAS)），正是该机制的暴露面。Stage 2 |
| **LOW-3** | 🟡 可运维 | 手动补跑通道收窄：移除 `?token=` 后**必须持有 `CRON_SECRET`** 才能手工触发（承自 v1 LOW-4，已部分缓解） | 设计取舍 | 保留现状（安全优先）；在 Runbook 中写明「手动补跑需 `CRON_SECRET`」 |
| **LOW-4** | 🟡 安全 | 两条 cron **无速率限制 / IP 白名单**（承自 v1 LOW-6） | 代码级 | Stage 2，或依赖 `.com` 平台侧限制 |
| **LOW-5** | 🟡 测试可持续性 | **cron 鉴权仍无工程单测**（仅临时探针覆盖，探针已删）→ 本轮**新增** | 单测用例全览 | 把 404/503/401/200 四态纳入 `test:cn-sync-s1`。这是 v1 建议第 6 条的**未完成部分** |

---

## 九、是否存在「假通过」

**无。**

- engineer 自述的修复项**逐条实测为真**：MEDIUM-1/2/3 与 LOW-1 均由**本轮独立探针**复现通过，
  非「看代码像修好了」。
- 工程单测 **14/0** 实跑通过（命令：`npm run test:cn-sync-s1`）。
- `vercel.json`「追加 2 条 cron、原 4 条未变」**实测为真**（`8 additions / 0 deletions`）。
- `.env.example` 新增 3 项（`CN_SYNC_BASE_URL` / `CN_SYNC_RECONCILE_GUARD_N` / `CRON_SECRET`）
  均**无真实密钥值**（`=""` 占位）→ 无密钥入库。

**反向诚实声明（本轮自己的问题）**：探针 B 的 3 处失败**是我写的探针不对**（误把 HTTP 规范化当缺陷、
误把自身打的 stub 当被测代码），已在 §五 用反证逐条定性；**不应记入代码缺陷**。

---

## 十、副作用与合规声明

- **未连任何真实数据库**：全部探针 mock `@/lib/db` / 注入内存 fake，硬约束遵守。
- **未做 git 写操作**：本轮仅读取 + 在 worktree 内新建本报告。
- **探针已清理**：`_qa_v2_probeA/B/C.ts` 已从 worktree 移出并归档至仓库外
  `D:\神雕农机\_scratch-cnsync\qa-v2\`（保证可复现，又不进入发布 diff）。
  探针之一曾触发 `tsc` 的 3 条 `TS7031`；**清理后复跑 `tsc --noEmit` 只剩 1 条存量报错**，
  证明该 3 条系探针引入、非 feature 引入。
- **行尾核对**：`core.autocrlf=true`，新建 7 个文件入库 blob 均为**纯 LF**
  （实测 `run-sync.ts` blob = `CRLF 0 / bare LF 613`），与仓库既有 TS 源文件一致；无 EOL churn。
  对比：`.github/workflows/deploy-cn.yml` 的 blob 是 **CRLF**（网页端提交所致），两者不矛盾。

---

## 十一、最终判定与发布前置项

# ✅ PASS

v1 的 **MEDIUM-1 / MEDIUM-2 / MEDIUM-3 / LOW-1 / LOW-5** 五项整改**全部实测验证通过**；
`?token=` 泄漏通道在两条路由上**彻底封死**；双轮重放 `conflict` 恒为 0（**无告警风暴**）；
白名单 / 失败语义 / 四重护栏无回归；单测 **14/0**、探针合计 **43 例 = 40 通过 / 3 失败**（3 例失败已用反证逐条定性为**探针自身缺陷 / HTTP 规范行为**，非代码缺陷）。
剩余项**均为 LOW**，无数据丢失、无合规红线。

### 发布前必办（阻塞）

| # | 事项 | 说明 |
| --- | --- | --- |
| P1 | **rebase 到当前 main `03ecbe2cf`** | worktree 基线 `a18254b` 已过期（main 期间前进 2 个 commit：PR #228、#229/#230） |
| P2 | Vercel 配 **3 个 env** | `CN_SYNC_API_KEY`（与 ECS `.env.cn` 同值）、`CN_SYNC_BASE_URL=https://usedfarmmach.cn`、`CRON_SECRET`（两条新 cron **只认它**；未配 → 503） |
| P3 | 确认 `CnSyncRunLog` 建表 | 本 feature 新增该 model（`schema.prisma +16/-0`）；由 `deploy-com.yml` / `deploy-cn.yml` 的 `prisma db push` 自动创建，**无需手工补** |
| P4 | 合并 `fix/deploy-cn-concurrency` | 消除并行 `.cn` 部署互踩（`+15/-0`，PR 入口已给） |

### 不阻塞（Stage 2 收口）

§八 的 5 条 LOW；其中 **cron 鉴权单测（LOW-5）** 与 **护栏②按 job 过滤（LOW-1）** 建议优先。

---

*本报告为 Stage 1 的 QA v2 复验结论；探针原始输出见 §二 / §四 / §六，探针源码归档于 `D:\神雕农机\_scratch-cnsync\qa-v2\`。*
