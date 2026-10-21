# Stage 1 独立对抗性验证报告 — .cn → .com 产品同步（同步核心 + 对账 + Cron）

> 验证人：Edward（QA Engineer）｜日期：2026-10-04
> 验证对象：`D:\神雕农机\_wt-cn-sync-s1`（基于 `origin/main` = `a18254b`，11 项改动：7 新增 + 4 修改）
> 验证方式：**独立对抗性探针**（不采信 engineer 自述）+ 真实命令复跑 + git 取证
> 硬约束遵守：**全程 mock `@/lib/db`，绝不连真库**；只读源码；探针用完即删；未做任何 git 写操作

---

## 0. 判定速览

| 项 | 结果 |
| --- | --- |
| **最终判定** | ✅ **PASS**（Stage 1 核心功能与安全护栏成立；无数据丢失级缺陷） |
| 探针用例 | **43 通过 / 1 按预期失败（用于记录真实缺陷）** |
| 新增问题 | **0 HIGH · 3 MEDIUM · 6 LOW** |
| 「假通过」 | **无**（engineer 11 项自述逐项核实为真；但其单测**未覆盖** cron 鉴权 / 对账护栏 / 响应契约） |
| 数据安全红线 | ✅ 未发现坐标/PII 出境；✅ 未发现「失败当空结果」；✅ 四重护栏逐条成立 |

---

## 1. 逐项攻击面结果（29 条，分组）

### A. 分页 / 游标（最高优先级）—— 6/6 通过

| # | 攻击 | 结果 | 证据 |
| --- | --- | --- | --- |
| A1 | **同毫秒 6 条 + 跨毫秒 2 条，`limit=2` 逐页拉完** | ✅ **不漏不重**（并集=全集 8 条）；且**逐页断言第 2 页起 `since` 与 `sinceId` 二者均携带**（仅带一个 = Stage 0 的同毫秒漏项复现） | 探针 A1 |
| A2 | `items.length < limit` 停止 | ✅ `limit=5` → 2 页停止 | 探针 A2 |
| A3 | 满页但缺 `nextSince` 或 `nextId` → 停止 | ✅ 二者分别缺失均在第 1 页停止，无死循环 | 探针 A3 |
| A4 | **`nextId` 不推进** → 必须能退出 | ✅ 退出（`MAX_PAGES=1000` 后以 `page-limit-exceeded` 报错，非真死循环） | 探针 A4 |
| A5 | `fetchPage` 返回 `null` | ✅ `export-unreachable`，`processed=0` | 探针 A5 |
| — | `fetchFullIdSet` 分页聚合 + 游标 | ✅ 多页聚合、URL 带 `cursor`、失败/畸形体/不推进均返回 `null` | 探针 B1/B3/B4/B5 |

### B. 失败语义（不得把失败当空结果）—— 4/4 通过

| # | 攻击 | 结果 |
| --- | --- | --- |
| 5 | `fetchPage=null` → 停止本轮，**不得**置 `ProductSyncMap.isActive=false`、**不得**删除 | ✅ 探针 C9：`ok=false`；`product.delete` 未调用；`mapUpdate` 0 次；run log 记录 `errorMessage="export-unreachable"` |
| 6 | `mode=full` 快照 `null` / 空 / 解析失败 → reconcile **0 删除** | ✅ 探针 D1（null）、D2（空 Set）、B3/B4（客户端层返回 null） |
| 7 | `cursorReset=true` 从头重来 + `Set` 去重 | ✅ 探针 B6（失效重启后收敛、无重复）；B2（跨页重复 id 去重） |
| — | 缺 `CN_SYNC_API_KEY` → 不请求（fail-closed） | ✅ 探针 B7：`fetchFullIdSet()` → `null` |

### C. 白名单 / 禁字段（合规红线）—— 3/3 通过

| # | 攻击 | 结果 |
| --- | --- | --- |
| 8 | **恶意 item** 夹带 `latitude/longitude/sellerId/contactName/contactPhone/contactWechat/contactEmail/email/phone/passwordHash/valuation/valuations/seller:{email}` | ✅ `mapProductScalars` 输出**一个都不含**（含序列化深扫描） |
| 8b | **深层/嵌套夹带**（`mainConfig={latitude:1}`、`province={seller:{email}}`、`tradePort=[{...}]`） | ✅ 标量字段被 `String()` 强制转字符串，**无对象嵌套泄漏** |
| 9 | 输出键集合**精确**白名单 | ✅ **恰好 22 键**（与 `ProductScalars` 接口逐字一致），不多不少 |
| 10 | `createdAt` 仅 create 传；**`updatedAt` 从未显式写入** | ✅ 探针 C3：`create` 有 `createdAt`、无 `updatedAt`；`update` 两者皆无；且 `createData.sellerId` = **解析出的系统卖家 id**（非 .cn item 的 `sellerId`） |

### D. 幂等与冲突守卫 —— 3/3 通过

| # | 攻击 | 结果 |
| --- | --- | --- |
| 11 | 无 map 且 .com 已有同 id → `conflict`，**零写库** + 告警 | ✅ 探针 C4：`product.upsert`/`$transaction`/`map.upsert` 调用数**全 0**，且已发企微告警 |
| 12 | 有 map + hash 相同 + `isActive` → `skipped` | ✅ 探针 C5：**仅** 1 次 `map.update({lastSeenAt})`；不写产品、不重建图片/视频 |
| 13 | hash 变化 → `updated`，媒体 `deleteMany→createMany` 幂等重建 | ✅ 探针 C6 |

### E. `resolveBrand` / `resolveCategory` 覆盖风险 —— 2/2 通过（另有 MEDIUM-3）

| # | 攻击 | 结果 |
| --- | --- | --- |
| 14 | 已存在 brand（带 `expoSlug/brandTier`） → **只取 id**，无 `brand.update`、无字段回写 | ✅ 探针 C7：返回既有 id；`brand.update`/`brand.create` 均 **0 次** |
| 15 | brand 不存在 → 才创建 | ✅ 探针 C8：`nameZh/nameEn/originCountry/isImported` 逐字正确 |

> ⚠️ 但「匹配到既有 brand 时**未校验/对齐 `isImported`**」——见 **MEDIUM-3**。

### F. `reconcile` 四条护栏（逐条打）—— 9/9 通过

| # | 攻击 | 结果 |
| --- | --- | --- |
| 16 | 护栏①：快照 `null` / 空 Set → 0 删除 | ✅ D1 / D2 |
| 17 | 护栏②：最近 N 轮含 `status="error"` → 跳过且 0 删除；**读历史抛错也保守跳过** | ✅ D3（error 日志 → `guardSkipped`）；D4（`findMany` 抛错 → 保守跳过，0 删除） |
| 18 | 护栏③：只遍历 `isActive=true`；**.com 原生产品绝不被触碰** | ✅ D5：`findMany({where:{isActive:true}})`；仅删 map 中的 id，断言删除目标 = `gone1` |
| 19 | 护栏④：删除前**必写** tombstone，快照无禁字段，且**写在事务外** | ✅ D6：调用顺序 `tombstone → tx`；快照无 `latitude/longitude/sellerId/contactPhone` |
| 20 | 外键冲突（P2003）→ 降级 `status="archived"` + 告警，**不抛错** | ✅ D7：`archivedFallback=1`、`ok=true`、告警已发 |
| 21 | 快照里仍有该 id → 保留（不删） | ✅ D8 |
| — | 产品行已不存在 → 仅标记账本（`missing`），不删 | ✅ D9：`skipped=1`；map 置 `isActive:false` + `deletedAt` |

### G. cron 鉴权（fail-closed 硬要求）—— 12/12 通过

| # | 攻击 | 结果 |
| --- | --- | --- |
| 22 | `SITE=cn` → 404 | ✅ 两条路由均 404 |
| 23 | **`CRON_SECRET` 未配置 + `Authorization: Bearer <任意值>` → 401**（绝不能万能放行） | ✅ 两条路由均 **401** |
| 24 | 错 `token` → 401；正确 Bearer / `?token=CRON_API_KEY` → 200 | ✅ 全部符合 |
| — | `?token=INTERNAL_API_KEY` → 200 | ⚠️ **可放行**（见 **MEDIUM-1**） |
| 25 | `vercel.json`：crons 共 **6** 条；原 4 条 + `env` 块**逐字未变** | ✅ `first 4 crons identical: true` / `env identical: true` / `keys identical: true`；追加 2 条（`*/15`、`0 19 * * *`） |

### H. 合规与卫生 —— 8/8 通过

| # | 攻击 | 结果 |
| --- | --- | --- |
| 26 | schema 相对 `origin/main` **0 删除行**；`CnSyncRunLog` 无 FK 到 `AgentDefinition` | ✅ `git diff --numstat = 16 0`；`grep -c '^-[^-]' = 0`；`model CnSyncRunLog` 内无 `@relation`/`AgentDefinition` |
| 27 | 禁改文件未被触碰 | ✅ `git status --porcelain` **仅** 11 项 Stage-1 改动；`field-whitelist.ts`/`export/route.ts`/`api/products/route.ts`/`products/[id]/page.tsx`/`lib/db.ts` 与 HEAD **字节一致**（工作树所有文件 mtime 相同=一次性 checkout，故以 `git status` 为准） |
| 28 | 新增文件**纯 LF** | ✅ 7 个新文件 CRLF 全为 0，`endsWithLF=true` |
| 29a | `npx tsc --noEmit` | ✅ **仅 1 条**既有错误 `test/cookie-secure.test.ts(3,42) TS5097`，与 Stage-1 改动无关 |
| 29b | `prisma validate` | ⚠️ 工作树**无 `.env`** → 先报 `P1012 DATABASE_URL not found`；补 `DATABASE_URL=<占位>` 后 → **valid 🚀**（schema 本身无缺陷，属环境） |
| 29c | `npm run test:cn-sync` / `test:cn-sync-s1` | ✅ **7 passed** / **9 passed** |
| 29d | `node scripts/check-route-dynamic.mjs` | ✅ 通过：无构建期会被静态固化的读库 GET 路由 |

---

## 2. 新增问题清单（按严重度）

### 🟠 MEDIUM-1【安全】两条 Cron 路由接受**已泄露的 `INTERNAL_API_KEY`**，其中一条是**不可逆物理删除**
- **文件:行号**：`src/app/api/cron/cn-product-sync/route.ts` L24-26；`src/app/api/cron/cn-product-sync-reconcile/route.ts` L22-24
- **机理**：`tokenOk = (CRON_API_KEY && token===…) || (INTERNAL_API_KEY && token===…)`。而 `INTERNAL_API_KEY` 同时以明文出现在**本仓库** `vercel.json` 的 `env` 块与 4 条既有 cron 的 URL 里，且设计文档 §1.2 明确记载其**硬编码在小程序包内、客户端可反解**。→ 任何掌握该值者可触发 `GET /api/cron/cn-product-sync-reconcile`（物理删除）。
- **证据性质**：**实测**（探针 3：`?token=INTERNAL_API_KEY` → 200）。
- **实际影响评估（不夸大）**：盲触发通常为**空操作**（攻击者无法控制 `.cn` 快照），四重护栏仍在。真实风险为：①无速率限制 → 反复触发造成 `CnSyncRunLog` 写入膨胀 / 成本；②当 `.cn` 导出**非空但部分降级**时（护栏①唯一盲区）可放大误删面。**注意**：`?token=` 方案是**仓库既有约定**（`update-prices`/`benchmark`/`daily-report` 同款），并非本次新发明的违规；设计 §4.1 的「禁用 INTERNAL_API_KEY」原文针对的是**导出接口**，而 Stage 0 已确认导出接口**未**复用它。
- **建议**：两条新 Cron **只保留 `CRON_SECRET` Bearer**（移除 `?token=` 兜底），或改为独立 `CN_SYNC_CRON_KEY`；若坚持沿袭旧约定，至少在 reconcile 路由上禁用 INTERNAL_API_KEY 并加限流。

### 🟠 MEDIUM-2【代码缺陷】`SyncStats.error` 声明了却**永不赋值**
- **文件:行号**：`src/lib/cn-sync/run-sync.ts` L43（声明 `error?: string`）、L424/L447/L452（只写局部变量 `errorMessage`，从未 `stats.error = …`）
- **机理**：失败时只把原因写进 `CnSyncRunLog.errorMessage` 与告警文案，**响应体 `stats.error` 始终为 `undefined`**（`reconcile.ts` L185 则正确赋值，二者不一致）。Cron 路由返回 `{ok, stats}` → 调用方/Stage 2 监控读不到失败原因。
- **证据性质**：**实测**（探针 C9b 按预期失败：`stats.error === undefined`；`stats` 序列化为 `{"ok":false,...,"errors":0}` 无 `error` 键）。
- **建议**：在两处失败分支补 `stats.error = errorMessage;`（1 行）。

### 🟠 MEDIUM-3【设计偏差】匹配到既有 brand 时**未对齐 `isImported`、未记录冲突** → 同步成功但 `.com` 静默不可见
- **文件:行号**：`src/lib/cn-sync/run-sync.ts` L238-244（`if (found) return found.id;`）
- **机理**：设计 §3.3 要求 `resolveBrand`「确保 `isImported` 一致并记录冲突」，§8.1 将其列为「中」风险（可见性异常）。实现**直接复用既有 brand id、不校验 `isImported`**。若 `.com` 已存在同名但 `isImported=false` 的 brand，则同步产品挂到该 brand → 命中 `.com` 可见性规则 `brand.isImported=true` 的**否定条件** → 产品同步进来却**在网站不可见**，且无任何告警。
- **证据性质**：**代码级推断**（机制可从代码确定；未做端到端复现——需真实库中存在同名 `isImported=false` 品牌）。
- **建议**：匹配到既有 brand 时若 `found.isImported !== true`，按设计**记录冲突 + 告警**（并明确是复用还是新建策略）。

### 🟡 LOW-1【健壮性】`iterateIncremental` 缺「游标未推进」显式守卫（与 `fetchFullIdSet` 不一致）
- **文件:行号**：`src/lib/cn-sync/cn-export-client.ts` L118-137
- **机理**：仅靠 `MAX_PAGES=1000` 兜底。服务端返回「满页 + 游标不变」时，会**重复处理同一批 1000 次**（UPSERT 幂等但浪费），最终以 `page-limit-exceeded` 报错。`fetchFullIdSet` 有 `next === cursor → null` 的显式判断，此处缺失。
- **证据**：**实测**（探针 A4：`pages=1000`、`error=page-limit-exceeded`，能退出）。
- **建议**：加 `if (page.nextId === sinceId && page.nextSince === since) return {..., error:"cursor-stalled"}`。

### 🟡 LOW-2【护栏边界】护栏② `recentRunsHealthy` **未按 job 过滤**
- **文件:行号**：`src/lib/cn-sync/runtime.ts` L60-64
- **机理**：取最近 N 条 `CnSyncRunLog`（跨 `incremental`/`reconcile` 两个 job）。因 incremental 每 15 分钟一次，最近 3 条几乎总是 incremental → 该护栏实质检的是「增量健康度」，且最近 ~45 分钟内**任一** incremental 错误即会**跳过当日对账**。方向保守（fail-safe），但可能导致对账被长期饿死。
- **证据**：**实测**（D3/D4 行为正确）+ 代码级推断（跨 job 语义）。
- **建议**：`findMany({ where: { job: "incremental" }, … })` 或与设计明确口径。

### 🟡 LOW-3【匹配精度】`resolveBrand`/`resolveCategory` 按名匹配可能**误挂到同名异实体**
- **文件:行号**：`run-sync.ts` L238-243、L267-272
- **机理**：`nameZh` 精确 或 `nameEn` 大小写不敏感即视为同一品牌/分类。若 `.com` 存在同名但不同实体的记录，会错误复用其 id。
- **证据性质**：**代码级推断**。
- **建议**：增加二次校验（如 `originCountry` 一致）或记录「按名匹配」审计。

### 🟡 LOW-4【部署可运维】新增 2 条 cron **未在 path 带 token**，完全依赖 `CRON_SECRET`
- **文件:行号**：`vercel.json` L23-30
- **机理**：既有 4 条 cron 的 path 内嵌 `?token=…`；新增 2 条**无 token** → 仅当 Vercel 配置了 `CRON_SECRET`（自动注入 `Authorization: Bearer`）才可用。**未配置则两条 cron 永久 401**（fail-closed 安全，但**静默不跑**，同步/对账皆不通且无告警）。
- **证据**：**实测**（探针 3：无 token 时仅 Bearer 生效）+ 代码级推断（Vercel 注入行为）。
- **建议**：在部署清单明确「必须配置 `CRON_SECRET`」，或与既有一致在 path 内嵌 token。

### 🟡 LOW-5【批量健壮性】单条产品的**非外键**错误会中断整批对账
- **文件:行号**：`reconcile.ts` L176 + L183-201
- **机理**：`hardDeleteSyncedProduct` 对非 FK 异常 `throw e` → 冒泡到 reconcile 外层 catch → 整轮中止（`ok=false`），其后的 map 不再处理。已删的前 N 条不回滚（事务仅包单条产品）。
- **证据性质**：**代码级推断**。
- **建议**：per-product try/catch 累计 `errors`，继续处理其余。

### 🟡 LOW-6【安全】两条 cron 无速率限制 / IP 白名单（设计 §8.1 曾列缓解项）。
- **证据性质**：代码级（无相关实现）。

> 说明：`contentHash` 含 `updatedAt`/数组顺序，可能造成「.cn 轻触即被判 `updated` 而全量重写」的轻微写放大——**属设计语义，非缺陷**，不单列。

---

## 3. 是否存在「假通过」

**无。** engineer 的 11 项自述（7 新增 + 4 修改）经 `git status` 逐项核实**完全一致**；其声称的自测 `test:cn-sync-s1 = 9 passed` **实测为真**；`vercel.json`「追加 2 条 cron、原 4 条与 env 未变」**实测为真**。

但存在**覆盖盲区**（非虚报，而是**未测**）：
1. **cron 鉴权**未测（尤其「未配 `CRON_SECRET` 时 Bearer 任意值」与「INTERNAL_API_KEY 放行」）——本轮由我发现 MEDIUM-1。
2. **`reconcile` 四重护栏**完全未测（D1-D9 全部由我补测）。
3. **`fetchFullIdSet` 的 cursorReset / 去重 / 失败即 null** 未测（B1-B7 由我补测）。
4. **`SyncStats.error` 契约**未测 → 掩盖了 MEDIUM-2。
5. **`resolveBrand` 的 `isImported` 对齐**未测 → 掩盖 MEDIUM-3。
6. `vercel.json` 结构化比对未测。

---

## 4. 未覆盖 / 无法验证项（明确标注）

- **真实数据库行为**（硬约束：禁止连真库）：RLS、真实外键 P2003 触发路径、真实 Prisma `$transaction` 语义、`mode:"insensitive"` 在目标库的实际行为、`.com` 是否已存在同名 `isImported=false` 品牌（决定 MEDIUM-3 的实际暴露面）——**均未验证**。
- **Vercel Cron 平台行为**（是否真的自动注入 `Authorization: Bearer <CRON_SECRET>`）——未在真实平台验证。
- **`.cn` 导出接口真实契约**：本轮按团队提供的契约 mock（`items`/`nextSince`/`nextId`/`ids`/`nextCursor`/`cursorReset`）；**未对真实 `.cn` 发请求**。
- **`pushToGroup` 真实投递**（已用桩拦截，只验证「被调用」与标题文案）。
- **`bcrypt.hash` 真实耗时/成本**（只在创建系统卖家分支触发；本轮用既有卖家绕过）。
- **端到端**：`.cn` 发布 → ≤15min `.com` 可见 / 改价 / 下线（需真实跨站环境）。
- **`prisma validate` 的「干净复跑」**：本工作树无 `.env`，需占位 `DATABASE_URL` 才能通过；已在报告中如实标注。

---

## 5. 建议（Stage 2 / 合入前）

1. **MEDIUM-1**：两条 Cron 仅保留 `CRON_SECRET`（移除 `?token=INTERNAL_API_KEY` 兜底），或为 reconcile 单独密钥 + 限流。
2. **MEDIUM-2**：`run-sync.ts` 失败分支补 `stats.error = errorMessage;`。
3. **MEDIUM-3**：`resolveBrand` 匹配到既有 brand 时校验/落告警 `isImported`，补上设计的「记录冲突」。
4. **LOW-1**：`iterateIncremental` 增加游标停滞守卫（对齐 `fetchFullIdSet`）。
5. **LOW-2/LOW-4**：护栏②按 job 过滤；部署清单显式要求配置 `CRON_SECRET`。
6. 把 **cron 鉴权** 与 **reconcile 护栏** 纳入工程单测（当前完全依赖人工验证）。

> 上述各项**均不构成数据丢失或合规红线缺陷**；核心同步链路、白名单强制、失败语义、四重护栏经 43 例对抗性验证**全部成立**。
