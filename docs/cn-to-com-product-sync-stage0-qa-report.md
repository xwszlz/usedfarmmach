# Stage 0 独立验证报告 — .cn → .com 产品同步

> 验证人：Edward（QA Engineer）
> 日期：2026-10-04
> 被验对象：Stage 0 工作区改动（未提交 / 未 push）
> 验证方式：**独立复现**（不采信 engineer 自述结论）+ 对抗性边界探针
> 验证原则：**只读验证**；未修改任何源码；临时探针写完即删

---

## 0. 结论速览

| 项 | 结果 |
| --- | --- |
| **最终判定** | ✅ **PASS**（Stage 0 代码层面；6 条用户硬性要求全部满足） |
| 复现 engineer 声称 | 5/5 全部可复现，**未发现伪造的「假通过」** |
| 本次新增探针 | 白名单边界 11 例 + 接口路由 26 例，**全部通过** |
| 真实问题 | **3 项 MEDIUM**（应在 Stage 1 / 部署前修复）+ 6 项 LOW |
| 数据泄露类问题 | **0**（坐标 / PII / Valuation 均确认不出境，且 fail-closed） |

> 硬性要求逐条判定全部 **通过**；下述 MEDIUM 问题**不影响 Stage 0 的安全正确性与合规定性**，属功能完整性 / 可运维性 / 测试可持续性范畴。

---

## 一、逐项结论（含真实命令与真实输出）

### ① engineer 声称的 5 项验证 — 独立复现

| # | 声称 | 我的复现 | 判定 |
| --- | --- | --- | --- |
| 1 | `npx prisma validate` → valid | `The schema at prisma\schema.prisma is valid 🚀`，EXIT=0 | ✅ 通过 |
| 2 | `npm run db:generate` → 成功 | `✔ Generated Prisma Client (v5.22.0)`，EXIT=0；`node_modules/.prisma/client/index.d.ts` 中 `ProductSyncMap`×425 / `ProductSyncTombstone`×415 出现 | ✅ 通过 |
| 3 | `npx tsc --noEmit` → exit=0 | 全仓库 EXIT=0（无任何 TS 诊断输出）；复现两次 | ✅ 通过 |
| 4 | `npx tsx .../field-whitelist.test.ts` → 7 passed | `结果：7 passed, 0 failed`，EXIT=0 | ✅ 通过 |
| 5 | 接口探针（tsx 直调 GET，mock env） | 我用 **Module._load 拦截 `@/lib/db`** 独立构造 26 例（见下），**26/26 通过** | ✅ 通过（我的覆盖为其超集） |

**说明**：仓库确实**无** type-check 脚本（`package.json` scripts 仅 `dev/build/start/lint/db:*/import:*`），engineer 直用 `tsc --noEmit` 属实；仓库确实**未装** vitest/jest（`devDependencies` 无），故用 `tsx + node:assert` 属实。此两点自述**准确**。

### ② 白名单深扫描边界（重点项 1）— 我的对抗性探针

文件：`src/lib/cn-sync/field-whitelist.ts`

| 用例 | 预期 | 实测 |
| --- | --- | --- |
| E1 经**白名单标量字段**夹带 `{descriptionZh:{latitude}}` | 抛错（fail-closed） | ✅ 抛错 |
| E2 **数组元素内** `{mainConfig:[{longitude}]}` | 抛错 | ✅ 抛错 |
| E3 **三层嵌套** `{tradePort:{a:{b:{contactPhone}}}}` | 抛错 | ✅ 抛错 |
| E4 空对象 `{}` | 26+4=30 个 key 全 null，不抛 | ✅ 通过 |
| E5 `null` / `undefined` | 返回 `{}`，不抛 | ✅ 通过 |
| E6 `images:"oops"` / `videos:null` / `[null]` | 健壮，不抛 | ✅ 通过 |
| E8 全量 `FORBIDDEN_FIELDS` 顶层注入 | 全部丢弃，序列化无泄漏 | ✅ 通过 |
| E10 `brand` 内嵌 `latitude` | 被 pick 丢弃（默认拒绝） | ✅ 通过 |
| E11 `Date` 值 | 原样保留 | ✅ 通过 |

**结论**：`assertNoForbidden`（L108-120）**递归覆盖对象/数组任意深度**，一旦禁字段残留即抛错 → **fail-closed 确实成立**。`null/undefined/空对象/空数组/错误类型` 均不抛异常（E6 中 `[null]` 产出 `[{url:null,sortOrder:null,isPrimary:null}]`，属可接受的确定性行为）。

### ③ 键集合精确性 + 无 `valuation`（重点项 2）

- 输出 top-level key **恰好 = `PRODUCT_ALLOW`(26) + `brand/category/images/videos`(4) = 30**，不多不少（E7 双向断言：无缺失、无多余）。
- 显式验证 **`"valuation"` / `"valuations"` 均不在输出 key 中**（E7 传入 `{valuation:{},valuations:[]}` 仍被丢弃）。
- `PRODUCT_ALLOW` 26 字段与设计文档 §5.1 表格**逐字一致**（id/modelName/year/condition/priceCny/priceUsd/location/province/city/country/descriptionZh/priceMode/tradeTerm/tradePort/enginePower/engineType/driveSystem/mainConfig/netWeight/overallLength/overallWidth/overallHeight/status/aiGenerated/createdAt/updatedAt）。
- 路由 `include`（route.ts L104-116）= `brand/category/images/videos`，**无 `valuations`**（探针 I2 断言 include key 集合恰为这 4 个）。
- 附加断言 E9：**无任何一个白名单字段名本身属于禁字段**（否则会自触发抛错）→ 通过。

### ④ `mode=full` 只返回 id 集合（重点项 3）

探针 F1/F2/F8：

- 响应 key 集合**恰好** `["ids","mode","nextCursor","success"]` → **无任何业务字段**。
- Prisma 查询参数 `select` **恰好** `{id:true}`，且**无 `include`** → 结构上不可能带出业务字段。

### ⑤ 分页正确性（重点项 4）

**`limit` 上限约束**（探针 L，全部通过）：`99999→500` / `500→500` / `abc→100` / `""→100` / `0→100` / `-5→100` / `1.9→1`。

**`mode=full` 游标**（F3/F4）：`nextCursor` **仅在** `rows.length === limit` 时为末条 id，否则 `null`（无死循环）；`cursor` 传入时正确生成 `skip:1, cursor:{id}`。

**⚠️ 增量模式存在「同时间戳漏项」缺陷（见 §二 MED-1）**：`updatedAt > since`（严格大于）+ `nextSince = last.updatedAt` + `orderBy updatedAt asc`（**无 id 次级排序**）→ 分页边界落在同一毫秒多行中间时，剩余行**永久漏同步**。

### ⑥ 鉴权实现（重点项 5）

| 用例 | 预期 | 实测 |
| --- | --- | --- |
| A1 `SITE=com` | 404 且**不查库** | ✅ 404，`findMany` 未调用 |
| A2 `SITE=cn` 无 key | 401 且不查库 | ✅ 401，未查库 |
| A3 同长度错误 key | 401 | ✅ 401 |
| A4 **短** key（长度不等） | 401 而非 500 | ✅ 401（`timingSafeEqual` 未抛） |
| A5 **长** key | 401 | ✅ 401 |
| A6 `CN_SYNC_API_KEY` **未配置** | 401（fail-closed） | ✅ 401 |
| A7 `SITE` 未设 | 默认 com → 404 | ✅ 404 |

- **常量时间比较确实实现**：`crypto.timingSafeEqual`（route.ts L29-34），**非** `===`。
- **密钥隔离确认**：`grep INTERNAL_API_KEY` 于 export route / whitelist → **0 匹配**；只用 `CN_SYNC_API_KEY`。
- **fail-closed 确认**：`if (!expected) return false`（L39）。
- 注意：长度不等时提前 `return false`（L32）会泄露**密钥长度**——业界标准做法，**可接受**（LOW-3）。

### ⑦ 「只改了该改的」git 证据核对（重点项 6）

**工作区整体极脏**（96 个文件有 diff，分支落后 origin/main 21 提交），故我用 **mtime 归属 + 定向 diff** 双重取证：

| 文件 | 最后一次修改 mtime | Stage 0 窗口(10-04 13:57~13:58)是否被改 | 结论 |
| --- | --- | --- | --- |
| `src/lib/cn-sync/field-whitelist.ts` | 2026-10-04 13:57 | 是（新增） | Stage 0 |
| `src/lib/cn-sync/__tests__/field-whitelist.test.ts` | 2026-10-04 13:57 | 是（新增） | Stage 0 |
| `src/app/api/internal/products/export/route.ts` | 2026-10-04 13:57 | 是（新增） | Stage 0 |
| `prisma/schema.prisma` | 2026-10-04 13:58 | 是（修改） | Stage 0 + **其它**（见 LOW-1） |
| `src/app/api/internal/products/route.ts` | 2026-10-04 13:58 | 是（文案） | Stage 0 |
| `src/app/api/miniapp/products/route.ts` | 2026-10-04 13:58 | 是（文案） | Stage 0 |
| **`src/app/api/products/route.ts`** | **2026-09-10 22:48** | **否** | ✅ 未触碰 |
| **`src/app/[locale]/products/[id]/page.tsx`** | **2026-09-12 00:02** | **否** | ✅ 未触碰 |
| **`src/lib/db.ts`** | **2026-09-10 22:48** | **否** | ✅ 干净，零改动 |

**禁改文件明细**：
- `src/lib/db.ts`：`git status` **完全干净** → ✅ 零改动。
- `src/app/api/products/route.ts`、`src/app/[locale]/products/[id]/page.tsx`：相对 HEAD **存在 staged 改动**（前者加 `export const revalidate = 300`；后者加 QuickContact / 担保交易 UI / siteConfig），但 **mtime 分别停留在 09-10 / 09-12** → **Stage 0 未触碰**，属**另外工作流**的既有暂存改动。

**schema.prisma diff（`git diff --numstat` = `46 0`，即 46 增 0 删）**：
- **纯追加，`grep -c '^-[^-]'` = 0 → 未修改 / 未删除任何既有模型或字段** ✅（additive 成立）
- 但含 **3 个 hunk**，非 engineer 自述的「末尾追加」：
  - `@@ -269` → `Product` 加 `@@index([country/province/city])`
  - `@@ -631` → `RawListing` 加 `productId` / `convertedAt`
  - `@@ -2212` → 追加 `ProductSyncMap` + `ProductSyncTombstone`（Stage 0 本尊）
  - 前两 hunk 疑似 **raw-listing 工作流**（存在未跟踪目录 `src/lib/raw-listing/`、`src/app/[locale]/admin/raw-listings/`），**归属需澄清**（LOW-1）。

**两处文案 diff**：
- `internal/products/route.ts`：unstaged diff **仅 1 行**（L897-899 文案）→ ✅ 只有文案。
- `miniapp/products/route.ts`：unstaged diff **仅 1 行**（L235 文案）→ ✅；但该文件 `MM`，**另有 staged 改动删除了 `export const dynamic = "force-dynamic"`（L12 附近）**——**非 Stage 0**，会改变 .cn 构建期静态化行为，**需澄清归属**（LOW-1 同类）。

### ⑧ 行尾（重点项 7）

| 文件 | 字节 | CRLF | 纯 LF | 结尾 LF |
| --- | --- | --- | --- | --- |
| `field-whitelist.ts` | 5112 | **0** | ✅ | ✅ |
| `field-whitelist.test.ts` | 6916 | **0** | ✅ | ✅ |
| `export/route.ts` | 5085 | **0** | ✅ | ✅ |
| `prisma/schema.prisma` | 80275 | **0** | ✅ | ✅ |

**结论**：新增文件**均为纯 LF**，无 CRLF 混入 ✅。（`git diff` 的 "LF will be replaced by CRLF" 提示属仓库 `core.autocrlf` 全局配置噪声，非本次改动引入。）

### ⑨ 用户 6 条硬性要求 — 逐条对照

| # | 要求 | 证据 | 判定 |
| --- | --- | --- | --- |
| 1 | 只同步「国际品牌 + active」(`status=active AND seller.email=miniprogram@shendiao.com AND brand.isImported=true`) | route.ts L76-80；探针 I1 断言 where 三条件逐字匹配 | ✅ |
| 2 | 坐标 `latitude`/`longitude` 排除，只带 `location` | whitelist 无坐标；探针 E1/E2/E8/E10/I5 端到端确认 | ✅ |
| 3 | 估值完全不同步 | whitelist 无 Valuation；route include 无 valuations（探针 E7/I2/I5） | ✅ |
| 4 | 仅 `SITE==='cn'` 生效否则 404 | route.ts L60-62；探针 A1/A7 | ✅ |
| 5 | 新增独立密钥 `CN_SYNC_API_KEY`，不复用 `INTERNAL_API_KEY` | route.ts L38；`grep INTERNAL_API_KEY` = 0；探针 A1-A7 | ✅（另见 MED-2） |
| 6 | 增量扩展，不改既有逻辑；不触碰 3 个指定文件 | mtime + diff 取证（§一⑦） | ✅ |

---

## 二、真实问题清单（按严重度排序）

### 🟠 MED-1【功能 / 数据完整性】增量模式「同时间戳漏项」——产品可能永久漏同步
- **文件:行号**：`src/app/api/internal/products/export/route.ts` L100-102（`where updatedAt:{gt:since}` + `orderBy:{updatedAt:"asc"}`）、L124-125（`nextSince = last.updatedAt`）
- **机理**：游标用**严格大于** `updatedAt > since`，且 `orderBy` **只有 `updatedAt`、无 `id` 次级排序**。当一页 `take=limit` 的边界恰好落在**同一毫秒的多行中间**时，下一页以 `since = 边界行的 updatedAt` 请求，**同毫秒的其余行因 `>` 被排除** → 永久漏同步。
- **证据性质**：**基于查询语义的代码级推断（未在真实库复现**——需真实数据量 + 毫秒并列）。代码证据：L101 `gt: since`、L102 `orderBy` 无 tiebreaker、响应**无 `nextCursor`**（仅 `nextSince`）。
- **触发条件**：.cn 存在并列 `updatedAt`（批量导入 / `createMany` 常见）× 总量跨页（>100 默认 / >500 上限）。
- **影响**：与设计文档 §3.3 `runCnProductSync` 的 `since = nextSince` 续拉循环叠加 → 「每日个位数~数十条」量级下概率低，但**历史回填**（存量一次性补齐）批量写入场景风险显著。
- **建议**：`orderBy: [{updatedAt:"asc"},{id:"asc"}]` 并改用 keyset 游标 `OR[(updatedAt>since), (updatedAt=since AND id>lastId)]`；或回填阶段走 `mode=full` 的稳定 id 游标。

### 🟠 MED-2【可运维性 / 部署前置】`CN_SYNC_API_KEY` 未登记到 env 示例
- **文件**：`.env.cn.example`、`.env.example`（均无该变量）
- **证据**：`grep -rn "CN_SYNC_API_KEY" .env.cn.example .env.example .env` → **0 匹配**（仅 `export/route.ts` 源码内出现）
- **影响**：实施清单 §4 明确要求该变量入 `.env.cn`；无登记 → 部署 S0-T3 极易漏配 → 接口对所有人 **401**（fail-closed，**安全但业务不通**）。
- **建议**：在两个 env 示例补 `CN_SYNC_API_KEY=`（留空 + 注释 `openssl rand -hex 32`）。

### 🟠 MED-3【测试可持续性】单测是「孤儿脚本」，无 CI / npm 接入
- **证据**：`package.json` **无 `test` 脚本**；未装 vitest/jest；实施清单 §5.1 写的是 `npx vitest run src/lib/cn-sync/__tests__/...` —— **与实际使用的 `tsx + node:assert` 不符**。
- **影响**：`7 passed` 无法被 CI 自动守门 → **未来回归无人拦截**（本报告的白名单安全断言最需要长期守护）。
- **建议**：加 `"test": "tsx src/lib/cn-sync/__tests__/field-whitelist.test.ts"` 并在 CI 调用（或引入 vitest 对齐文档）。

### 🟡 LOW-1【范围 / 归属】schema.prisma diff 范围大于「末尾追加」自述
- 3 个 hunk 中 2 个与本功能无关（`Product` @@index、`RawListing.productId/convertedAt`）。
- **未破坏 additive 性质**（0 删除行），疑似 raw-listing 工作流 → **需在合入前隔离提交**，避免混入本 feature 的 commit。
- 同类：`miniapp/products/route.ts` 的 staged `force-dynamic` 删除，亦需澄清归属。

### 🟡 LOW-2【健壮性 / 可观测】非法 `since` 静默降级为全量拉取
- `parseSince`（L52-56）对非法日期返回 `null` → L101 变成**无 updatedAt 过滤的全量**。cron 参数笔误会**每轮全量重拉**且**无告警**。建议非法值返回 **400**。

### 🟡 LOW-3【安全】`safeEqual` 长度不等即提前返回，泄露密钥长度
- route.ts L32。业界标准、**可接受**；如追求极致可哈希后再比较。

### 🟡 LOW-4【合规纵深防御】设计文档 §5.2 的 `location`/`descriptionZh` 轻量 PII 扫描（正则命中手机号/身份证 → 告警置空）**未实现**。
- 因白名单已从源头排除结构化 PII，此为其**补充**防御；Stage 0 可延后，但应登记待办。

### 🟡 LOW-5【健壮性】`mode=full` 的 `cursor` 若指向已被删除的产品，Prisma 会抛错 → 接口 500、分页中断。
- route.ts L89。建议捕获并回退（或改用 `where.id > cursor` keyset）。

### 🟡 LOW-6【安全】接口**无速率限制 / IP 白名单**（设计文档 §8.1 曾列缓解项）。Stage 0 未实施；如 `.cn` 网关另有限制则可接受。

---

## 三、是否存在「假通过」？

**结论：未发现伪造的「假通过」。**

- engineer 的 5 项声称（prisma validate / db:generate / tsc / 7 passed / 接口探针）**逐项独立复现成功**，无一项是"声称通过实则未验证"。
- 其**自述准确性**：`无 type-check 脚本`、`无 vitest/jest` 两点**属实**。
- 但其**自查存在盲区**（非"假通过"，而是"未覆盖"）：
  1. **未测**增量分页同时间戳边界（→ MED-1）。
  2. **未核对** env 变量登记（→ MED-2）。
  3. **未评估**单测接入 CI（→ MED-3）。
  4. **自述「schema.prisma 末尾追加」不完整**——实际含 2 处其它 hunk（→ LOW-1）。
  5. **未触及**行尾核对（我已补测：纯 LF ✅）。

---

## 四、验证过程与副作用声明

- **只读**：未修改任何源码。
- **临时探针**（已删除，不留痕）：
  - `_qa_probe_whitelist.ts`（11 例白名单边界）— 运行后 `rm` 删除
  - `_qa_probe_route.ts`（26 例接口路由，`Module._load` 拦截 `@/lib/db`）— 运行后 `rm` 删除
- **非源码副作用**：`npm run db:generate` 重新生成了 Prisma Client（构建产物）；`npx tsc --noEmit` 可能刷新了 `tsconfig.tsbuildinfo`（构建缓存）。二者均非源码。
- **未执行**：`git commit` / `git push` / `git add` / 任何破坏性 git 操作；`next build`（成本高，未纳入）。
- **未实测项（明确标注）**：MED-1 属**代码级推断**（需真实库与数据量方能复现）；`prisma db push` 的真实建表、以及 .cn 部署后的 V0/V2b/V2c 端到端（需 ECS 环境）**不在本次范围**。

---

## 五、最终判定

# ✅ PASS

**Stage 0 代码层面通过。** 用户 6 条硬性要求**逐条满足**；白名单默认拒绝 + 深度 fail-closed 自检经对抗性验证**成立**；坐标 / PII / Valuation **零出境**；鉴权独立密钥 + 常量时间 + fail-closed **成立且先于查库**；`SITE` 门禁正确；新增文件纯 LF；三个指定禁改文件经 mtime 取证**未被 Stage 0 触碰**。

### 必须在**进入 Stage 1 / 部署前**处置的前置项
1. **MED-2**（阻塞部署）：把 `CN_SYNC_API_KEY` 补进 `.env.cn.example` / `.env.example`。
2. **MED-1**（阻塞 Stage 1 增量）：为增量分页补 `id` 次级排序 + keyset 游标，消除同时间戳漏项。
3. **MED-3**（阻塞"可持续验收"）：把单测接入 `npm test` / CI。
4. **LOW-1**（合入卫生）：隔离 schema.prisma 中 2 处非本功能 hunk、以及 miniapp 路由的 staged `force-dynamic` 删除，确保 Stage 0 提交**只含该含的**。

> 以上 4 项**均不构成 Stage 0 的安全 / 合规缺陷**，但 1、2 若在部署 / Stage 1 前不修，将分别导致「部署后接口全 401」与「部分产品永不出现」的实际业务故障。

---
---

# 第 2 轮回归验证（Round 2 Regression）

> 验证人：Edward（QA Engineer）｜日期：2026-10-04｜验证方式：独立复现 + 对抗性探针（重点攻击 keyset 游标）
> 只读；临时探针用完即删；未做任何 git 写操作
> **判定：✅ PASS**（修复正确、无回归）；**新发现问题：2 项 LOW（无 MEDIUM/HIGH）**

## 0. 本轮修复点核对（engineer 自述 → 我的实测）

| 自述 | 实测 | 判定 |
| --- | --- | --- |
| MED-1：`sinceId` 解析（L75）、`incrementalWhere` OR keyset（L117-127）、`orderBy [updatedAt,id]`（L131）、响应 `nextId`（L155/L157-164） | 逐行核对一致；探针 K5/K6 断言 where 结构 + orderBy | ✅ 属实 |
| LOW-5：`findUnique` 游标守卫（L88-95）、`cursorReset`（L107） | 核对一致；探针 L5a/L5b/L5c | ✅ 属实 |
| MED-2：`.env.example`、`.env.cn.example` 新增 `CN_SYNC_API_KEY` | 均存在，且**值为空、无真实密钥** | ✅ 属实 |
| MED-3：`package.json` 新增 `"test:cn-sync"` | 存在，`npm run test:cn-sync` 实跑 **7 passed** | ✅ 属实 |

**mtime 归属**：`export/route.ts`(14:07)、`.env.example`/`.env.cn.example`(14:07)、`package.json`(14:07) 为本轮改动；**`prisma/schema.prisma` 仍为 13:58、`miniapp/products/route.ts` 仍为 13:58 → 本轮未再触碰**。

## 1. 逐项结论（真实命令与输出）

### ① MED-1 keyset 复合游标 —— **重点攻击，通过**

探针用 `Module._load` 拦截 `@/lib/db`，以**忠实复现 Prisma 语义**的内存求值器（`baseWhere` AND + `OR` keyset + `orderBy [updatedAt asc,id asc]` + `take`）驱动真实 route：

| 用例 | 场景 | 结果 |
| --- | --- | --- |
| **K1** | **5 条 `updatedAt` 完全相同**（同毫秒）+ 另 2 条，`limit=2` 逐页拉完 | ✅ **不漏项、不重复**（两页并集 = 全集 7 条，无 dup） |
| **K2** | 6 条（含同毫秒并列）、`limit=3`（**正好整除**） | ✅ 完整、终止、无 dup；多出的一次空页正确停止 |
| **K3** | 最后一行 / 空结果 | ✅ 末页 `nextId`=最后一条 id；空结果 `nextId=null`；空结果带 `sinceId` → `nextId=sinceId` |
| **K4** | **向后兼容**：只传 `since` 不传 `sinceId` | ✅ where 仍为 `{updatedAt:{gt}}`、**无 OR** —— 与修复前逐字一致 |
| **K5** | `since`+`sinceId` | ✅ `OR[ {updatedAt.gt}, {updatedAt==since, id.gt} ]`，且 `baseWhere`（active/email/isImported）仍被 AND |
| **K6** | orderBy | ✅ `[{updatedAt:"asc"},{id:"asc"}]`（已补 id 次级排序） |

**结论**：MED-1 修复**正确**——同毫秒并列 + 分页边界场景下**杜绝了永久漏项**，且**向后兼容**。

### ② LOW-5 full cursor 守卫 —— 通过

| 用例 | 预期 | 实测 |
| --- | --- | --- |
| L5a cursor 不存在 | 200 + `cursorReset=true` + 从第 1 页 | ✅ `ids=["f1","f2"]` |
| L5b cursor 存在 | 正常续页 + `cursorReset=false` | ✅ `ids=["f2","f3"]` |
| L5c 无 cursor | `cursorReset=false` | ✅ |

### ③ MED-2 环境变量模板 —— 通过

- `.env.example` L95-98、`.env.cn.example` L56-59 均含 `CN_SYNC_API_KEY`，**值为空**。
- 正则 `CN_SYNC_API_KEY\s*=\s*["']?[0-9a-fA-F]{16,}` 于两文件 → **0 匹配** → **未写入任何真实密钥** ✅
- 注：`.env.example`/`.env.cn.example` 的 diff 含 40/12 行，其中**夹带其它工作流改动**（如 `.env.example` 的 `WECHAT_PRIVATE_KEY_PATH`→`WECHAT_PRIVATE_KEY`）→ 属本轮之外的既有暂存/未暂存改动，**非本次 Stage 0 引入**（见「新发现问题 L2」的归属澄清）。

### ④ MED-3 测试脚本 —— 通过

`npm run test:cn-sync` → `结果：7 passed, 0 failed`，EXIT=0；**未引入新依赖**（`git diff package.json` 仅 1 行新增）。

### ⑤ 回归检查（必做）—— 通过（无回归）

| 组 | 用例数 | 结果 |
| --- | --- | --- |
| 白名单深扫描 fail-closed（E1/E2/E3 嵌套夹带抛错）+ 健壮性 + 键集合精确无 valuation + Date | 11 | ✅ 11/11 |
| 路由：404 / 401 / 未配密钥 fail-closed / `mode=full` 只回 id / `select={id:true}` / `limit` 钳制 / include 无 valuation / 端到端白名单剥离 | 8 | ✅ 8/8 |

**合计本轮探针 28 例（17 路由 + 11 白名单）全部通过**；上一轮 37 例的关键部分均已覆盖并保持通过 → **修复未破坏原有行为**。

### ⑥ `npx tsc --noEmit` → **exit=0** ✅

### ⑦ 只读取证：工程师仍**未触碰**他人改动 ✅

| 目标 | 证据 | 结论 |
| --- | --- | --- |
| `src/lib/db.ts` | git 完全干净；mtime 2026-09-10 | ✅ 未触碰 |
| `src/app/api/products/route.ts` | mtime 2026-09-10（本轮未变） | ✅ 未触碰 |
| `src/app/[locale]/products/[id]/page.tsx` | mtime 2026-09-12（本轮未变） | ✅ 未触碰 |
| schema `Product @@index` + `RawListing.*` 两处 hunk | `git diff --numstat = 46 0`、0 删除行；numstat 与 hunks 数不变 | ✅ 原样保留，未改动 |
| miniapp 路由他方 staged 删 `force-dynamic` | `git diff --cached` 中 `force-dynamic` **仍为 1 处** | ✅ 原样保留，未改动 |

### ⑧ 行尾

| 文件 | 结果 |
| --- | --- |
| `src/app/api/internal/products/export/route.ts` | ✅ **纯 LF**（CRLF=0, LF=165） |
| `src/lib/cn-sync/field-whitelist.ts` | ✅ 纯 LF（未在本轮改动） |
| `.env.example` / `.env.cn.example` / `package.json` | 工作区为 CRLF，但 `git diff` 无 EOL churn（`package.json` 仅 1 行、`.env.example` 无整文件重写）→ 系仓库 `core.autocrlf` 常规行为，**非缺陷** |

## 2. 新发现的问题

- **未发现 MEDIUM / HIGH 级新问题。**

- 🟡 **新-1（LOW·健壮性）**：`export/route.ts` L88-95 —— LOW-5 的游标守卫 `findUnique` **仅校验 id 存在性，未按 `baseWhere` 作用域校验**。若 cursor 指向一个「存在于表内但不属于过滤集合」的产品（如 inactive / 非小程序 / 非国际品牌），守卫会放行并继续用 `cursor:{id}` seek，其行为取决于 Prisma 对「cursor 行不在结果集内」的实现细节（不同版本可能报错或错位），**未在真实库实测**（属推断）。建议：把存在性校验改为 `findFirst({ where: { AND: [baseWhere, { id: cursor }] } })`，语义更明确。

- 🟡 **新-2（LOW·合入卫生 / 非本轮引入）**：`.env.example` / `.env.cn.example` 的 diff **混入其它工作流改动**（`WECHAT_PRIVATE_KEY_PATH`→`WECHAT_PRIVATE_KEY` 等）。与上一轮 LOW-1 同类：**非本 feature 引入**，但合入前仍应隔离，避免混入 Stage 0 提交。

## 3. 最终判定

# ✅ PASS（第 2 轮）

MED-1（keyset 复合游标）**修复正确且已实测杜绝同毫秒漏项、向后兼容**；LOW-5（cursor 守卫）、MED-2（env 登记，无真实密钥）、MED-3（`test:cn-sync` 实跑 7 passed）**全部通过**；`npx tsc --noEmit` exit=0；**28 例探针全绿、无回归**；工程师**未触碰**任何他人改动。

**遗留（不阻塞本轮 PASS，建议 Stage 1 前处理）**：新-1 游标守卫作用域建议收紧；新-2 合入前隔离非本 feature 的 diff。上一轮的 LOW-2（非法 `since` 静默全量）、LOW-3、LOW-4、LOW-6 仍为既有事项，本轮未变。
