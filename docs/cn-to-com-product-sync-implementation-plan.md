# 小程序产品 .cn → .com 同步 实施步骤与代码改动清单

> 配套设计文档：`docs/cn-to-com-product-sync-architecture.md`  
> 前置侦察：`docs/cn-content-sync-solution-2026-08-12.md`、`docs/site-split-architecture.md`  
> 状态：**实施清单（待批准后编码）**。本轮不写业务代码。  
> 日期：2026-09

---

## 0. 拍板结论汇总与实施前置条件

| #  | 议题               | 拍板结果                                                    | 对本清单的影响                                                                                                         |
| -- | ---------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 1  | 合规定性             | ✅ 采纳**选项一**：产品公开信息不属红线管辖，**采用方案 A**                     | 方案 A 定稿                                                                                                         |
| 1a | 合规定性——**实施前置条件** | ⚠️ 保留「**须业务/法务书面确认**」                                   | **Stage 0 开工前**必须拿到书面件（现有唯一书面依据仅 `site-split-architecture.md` §9.9 L563「OSS 资产跨境不视为数据出境」）。**未获确认前不得进入 Stage 0** |
| 2  | 同步范围             | ✅ 仅同步「国际品牌 + active」                                    | 导出接口在源头过滤                                                                                                       |
| 3  | 延迟口径             | ✅ 增量 **15 分钟**；文案写「**有延迟**」                             | §1.5 两处文案按"有延迟"定稿                                                                                               |
| 4  | 下线语义             | ⚠️ **真删（物理删除）**                                         | **reconcile 改为物理删除 + 补齐安全护栏**（见 §3.4）                                                                           |
| 5  | 坐标处置             | ✅ (a) 只同步 `location` 文字地址，**不传 `latitude`/`longitude`** | 白名单排除坐标（**待复核项，见 §7-Q3**）                                                                                       |
| 6  | Valuation        | ⚠️ **要求同步到 `.com` 详情页**                                 | §5.1 改为同步；**但因 `.com` 详情页是"实时重算"而非读表，需同步改 `/api/valuation`（关键发现，见 §3.9）**                                       |
| 7  | 独立密钥             | ✅ 新增 `CN_SYNC_API_KEY`                                  | 见 §4                                                                                                            |

> ⚠️ **两条与原始设计相左、且必须让工程师明确知晓的点**：
>
> - **【硬删】** 用户选物理删除（与设计推荐的软删相反）→ 必须严格落地 §3.4 的四条护栏，否则可能**批量误删 `.com` 数据**。
> - **【Valuation 关键发现】** `.com` 详情页**不读 `Valuation` 表**，而是调用 `/api/valuation` **实时重算**；因此"同步 Valuation"**必须**配套改 `/api/valuation` 才能生效（详见 §3.9）。team-lead 原始设想的「改 page.tsx + 产品读接口 include」**不是正确改动点**。

---

## 1. 变更总览（文件清单）

| #  | 文件（相对仓库根）                                             | 类型          | Stage | 一句话职责                                        |
| -- | ----------------------------------------------------- | ----------- | ----- | -------------------------------------------- |
| 1  | `src/app/api/internal/products/export/route.ts`       | 🆕 .cn      | S0    | 只读导出接口（鉴权 + 白名单 + 增量/全量）                     |
| 2  | `src/lib/cn-sync/field-whitelist.ts`                  | 🆕          | S0    | 白名单 pick + 禁字段断言                             |
| 3  | `prisma/schema.prisma`                                | ✏️ additive | S0    | 新增 `ProductSyncMap` + `ProductSyncTombstone` |
| 4  | `src/lib/cn-sync/run-sync.ts`                         | 🆕 .com     | S1    | 同步核心（拉取/清洗/upsert/对账/硬删）                     |
| 5  | `src/lib/cn-sync/reconcile.ts`                        | 🆕 .com     | S1    | 全量对账 + 硬删护栏 + tombstone                      |
| 6  | `src/app/api/cron/cn-product-sync/route.ts`           | 🆕 .com     | S1    | Vercel Cron 入口（增量）                           |
| 7  | `src/app/api/cron/cn-product-sync-reconcile/route.ts` | 🆕 .com     | S1    | Vercel Cron 入口（每日对账）                         |
| 8  | `vercel.json`                                         | 🆕/✏️       | S1    | 声明 2 条 cron                                  |
| 9  | `src/app/api/valuation/route.ts`                      | ✏️ .com     | S1    | **Valuation fast-path**（读已同步行，见 §3.9）        |
| 10 | `src/lib/wecom/group-webhook.ts`（复用）                  | ↩️          | S1    | 失败告警（无需改，仅调用）                                |
| 11 | `src/app/api/internal/products/route.ts`              | ✏️ 文案       | S0    | 修正 L897-899 失真文案                             |
| 12 | `src/app/api/miniapp/products/route.ts`               | ✏️ 文案       | S0    | 修正 L235 失真文案                                 |
| 13 | `scripts/cn-product-sync.js`                          | 🆕 可选       | S0    | 本地/离线回退 CLI（Stage 0 优先走 HTTP 触发，见 §6）        |

> **不改动**：`src/app/api/products/route.ts`（`.com` 列表读接口）、`src/app/[locale]/products/[id]/page.tsx`（`.com` 详情 SSR 查询）、`src/lib/db.ts`、任何 `.cn` 既有业务路由。

---

## 2. 数据库变更方式

### 2.1 结论：**additive 模型，随 `prisma db push` 落地，无需 migrate deploy**

| 库                  | 现有变更方式（证据）                                                                                                                              | 本次如何落地                     |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `.cn`（cn-postgres） | `deploy/deploy-cn.sh` L172-202：按 schema hash 变化执行 `prisma db push --skip-generate --accept-data-loss`                                   | schema 新增模型 → 下次部署自动建表（幂等） |
| `.com`（Neon）       | `.github/workflows/deploy-com.yml` Step 5：`npx prisma db push --skip-generate --accept-data-loss`（env `DATABASE_URL=NEON_DATABASE_URL`） | 同上，随 `.com` 部署建表           |

> 两站 schema 同源（`site-split-architecture.md` §3.2）。两个新模型属 **additive（纯新增，无删列/改列）**，`db push` 在两边都会创建；`.cn` 侧创建后不写入（仅 `.com` 使用），**无副作用**。

### 2.2 新增模型（Prisma 草案）

```prisma
/// .cn → .com 产品同步映射与存活账本（additive）
/// 作用：来源追溯 + 内容哈希（变更检测）+ 对账存活判定 + 物理删除后审计轨迹
model ProductSyncMap {
  id              String    @id @default(cuid())
  cnProductId     String    @unique   // .cn 侧 Product.id
  neonProductId   String    @unique   // .com 侧 Product.id（= cnProductId 直通）
  sourceHash      String              // 白名单内容 sha256
  sourceUpdatedAt DateTime            // .cn 侧 updatedAt（增量水位依据）
  syncedAt        DateTime  @default(now())
  lastSeenAt      DateTime  @default(now())
  isActive        Boolean   @default(true)
  /// 【硬删护栏·审计轨迹】非空 = 曾同步、已在 .com 物理删除（Product 行已不存在）
  deletedAt       DateTime?

  @@index([isActive, lastSeenAt])
  @@index([sourceUpdatedAt])
}

/// 【硬删护栏·删除前留档】物理删除前写入最小快照，供人工恢复
model ProductSyncTombstone {
  id            String   @id @default(cuid())
  cnProductId   String
  neonProductId String
  /// 删除前的最小快照（白名单字段 JSON.stringify），排除 PII/坐标
  snapshot      String
  reason        String   @default("reconcile-absent")
  deletedAt     DateTime @default(now())

  @@index([cnProductId])
  @@index([deletedAt])
}
```

---

## 3. 逐文件改动点（方法级）

### 3.1 `src/app/api/internal/products/export/route.ts`（🆕 `.cn`）

**职责**：只读导出；`SITE=cn` 才生效；独立密钥鉴权；源头过滤「国际品牌 + active + 小程序」；支持**增量**（`since`）与**全量 id 集合**（对账）；输出经白名单裁剪（去 PII / 坐标）。

**关键函数**：

| 函数               | 签名                                            | 逻辑                                                    |
| ---------------- | --------------------------------------------- | ----------------------------------------------------- |
| `GET`            | `(req: NextRequest) => Promise<NextResponse>` | 见下                                                    |
| `requireSyncKey` | `(req) => boolean`                            | 读 `x-sync-key`，与 `process.env.CN_SYNC_API_KEY` 常量时间比较 |

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { pickProductWhitelist } from "@/lib/cn-sync/field-whitelist";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MINIAPP_SELLER_EMAIL = "miniprogram@shendiao.com";
const LIMIT_DEFAULT = 100;
const LIMIT_MAX = 500;

function requireSyncKey(req: NextRequest): boolean {
  const expected = process.env.CN_SYNC_API_KEY;
  if (!expected) return false;                     // 未配置密钥 → 一律拒绝（fail-closed）
  const provided = req.headers.get("x-sync-key") ?? "";
  return provided.length > 0 && provided === expected;
}

export async function GET(req: NextRequest) {
  // ① 仅 .cn 生效（防止 .com 误暴露 Neon 数据）
  if ((process.env.SITE ?? "com") !== "cn") {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }
  // ② 鉴权（失败返回 401，非 403/404）
  if (!requireSyncKey(req)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const sp = new URL(req.url).searchParams;
  const mode = sp.get("mode");                                  // null | "full"
  const since = sp.get("since") ? new Date(sp.get("since")!) : null;
  const limit = Math.min(Number(sp.get("limit") ?? LIMIT_DEFAULT) || LIMIT_DEFAULT, LIMIT_MAX);
  const cursor = sp.get("cursor");                              // full 模式分页游标（Product.id）

  // ③ 源头过滤：小程序 + active + 国际品牌
  const baseWhere = {
    status: "active",
    seller: { email: MINIAPP_SELLER_EMAIL },
    brand: { isImported: true },
  } as const;

  // ④ 全量对账模式：仅返回 id 集合（轻量、分页）
  if (mode === "full") {
    const rows = await prisma.product.findMany({
      where: baseWhere,
      select: { id: true },
      orderBy: { id: "asc" },
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    return NextResponse.json({
      success: true, mode: "full",
      ids: rows.map((r) => r.id),
      nextCursor: rows.length === limit ? rows[rows.length - 1].id : null,
    });
  }

  // ⑤ 增量模式：updatedAt > since
  const products = await prisma.product.findMany({
    where: since ? { ...baseWhere, updatedAt: { gt: since } } : baseWhere,
    orderBy: { updatedAt: "asc" },
    take: limit,
    include: {
      brand: { select: { nameZh: true, nameEn: true, originCountry: true, isImported: true } },
      category: { select: { nameZh: true, nameEn: true } },
      images: { select: { url: true, sortOrder: true, isPrimary: true }, orderBy: { sortOrder: "asc" } },
      videos: {
        where: { moderationStatus: { not: "rejected" } },          // 违规视频不外传
        select: { url: true, sortOrder: true, title: true, duration: true, moderationStatus: true },
        orderBy: { sortOrder: "asc" },
      },
      valuations: {                                                 // 【拍板⑥】同步估值（取最新一条）
        orderBy: { id: "desc" }, take: 1,
        select: { estimatedPriceCny: true, estimatedPriceUsd: true, confidenceScore: true, factors: true },
      },
    },
  });

  const items = products.map(pickProductWhitelist);                 // ⑥ 白名单裁剪（去 PII/坐标）
  const nextSince = products.length
    ? products[products.length - 1].updatedAt.toISOString()
    : (since?.toISOString() ?? null);

  return NextResponse.json({ success: true, mode: "incremental", count: items.length, nextSince, items });
}
```

> 说明：`valuations` 为 Product 的反向关系（`schema.prisma` L178 `valuations Valuation[]`）。

---

### 3.2 `src/lib/cn-sync/field-whitelist.ts`（🆕）

**白名单 pick（默认拒绝）+ 禁字段断言**（与 `scripts/export-cn-content.js` 的 `pick()` 同款范式）。

```ts
const PRODUCT_ALLOW = [
  "id", "modelName", "year", "condition", "priceCny", "priceUsd",
  "location", "province", "city", "country",
  "descriptionZh", "priceMode", "tradeTerm", "tradePort",
  "enginePower", "engineType", "driveSystem", "mainConfig", "netWeight",
  "overallLength", "overallWidth", "overallHeight",
  "status", "aiGenerated", "createdAt", "updatedAt",
] as const;

/** 【硬禁】绝不出现于出境 payload：精确坐标 + 卖家身份 + 自然人联系方式 */
export const FORBIDDEN_FIELDS = [
  "latitude", "longitude",
  "sellerId",
  "contactName", "contactPhone", "contactWechat", "contactEmail",
] as const;

export function pickProductWhitelist(p: any) {
  const out: any = {};
  for (const f of PRODUCT_ALLOW) out[f] = p[f] ?? null;

  out.brand = p.brand
    ? { nameZh: p.brand.nameZh, nameEn: p.brand.nameEn, originCountry: p.brand.originCountry, isImported: p.brand.isImported }
    : null;
  out.category = p.category ? { nameZh: p.category.nameZh, nameEn: p.category.nameEn } : null;
  out.images = (p.images ?? []).map((i: any) => ({ url: i.url, sortOrder: i.sortOrder, isPrimary: i.isPrimary }));
  out.videos = (p.videos ?? []).map((v: any) => ({
    url: v.url, sortOrder: v.sortOrder, title: v.title, duration: v.duration, moderationStatus: v.moderationStatus,
  }));
  out.valuation = p.valuations?.[0]
    ? {
        estimatedPriceCny: p.valuations[0].estimatedPriceCny,
        estimatedPriceUsd: p.valuations[0].estimatedPriceUsd,
        confidenceScore: p.valuations[0].confidenceScore,
        factors: p.valuations[0].factors ?? null,               // 见 §3.9：建议保留（含 details，供 UI 展开）
      }
    : null;

  // 运行时自检：任何禁字段残留 → 抛错（fail-closed）
  for (const f of FORBIDDEN_FIELDS) if (f in out) throw new Error(`[export] forbidden field leaked: ${f}`);
  return out;
}
```

> **单元测试**（`src/lib/cn-sync/__tests__/field-whitelist.test.ts`，S0 一并加）：构造含 `latitude/longitude/contactPhone/sellerId` 的假产品 → 断言输出不含这些键。

---

### 3.3 `src/lib/cn-sync/run-sync.ts`（🆕 `.com`，同步核心）


**对外函数**：`runCnProductSync(opts: { mode: "incremental"; since?: string }): Promise<SyncStats>`

**内部函数**（方法级）：

| 函数                                       | 职责                                                              |
| ---------------------------------------- | --------------------------------------------------------------- |
| `fetchIncremental(since)`                | GET `.cn` 导出接口（携带 `CN_SYNC_API_KEY`），返回 `items[]` 与 `nextSince` |
| `normalize(item)`                        | 稳定序列化（字段排序）用于 sha256                                            |
| `sha256(str)`                            | 内容哈希                                                            |
| `resolveSystemSeller()`                  | 复用/创建 Neon 系统账号 `miniprogram@shendiao.com`（见 §3.3.1）            |
| `resolveBrand(b)` / `resolveCategory(c)` | 按名解析/创建，确保 `isImported` 一致                                      |
| `upsertProduct(item)`                    | 幂等 upsert（见下）                                                   |
| `mapProductScalars(item)`                | 白名单 → Prisma 标量（剔 sellerId/坐标）                                  |

```ts
export async function runCnProductSync(opts: { mode: "incremental"; since?: string }) {
  const t0 = Date.now();
  const stats: SyncStats = { created: 0, updated: 0, skipped: 0, conflict: 0, errors: 0 };
  try {
    let since = opts.since;
    let hasMore = true;
    while (hasMore) {
      const { items, nextSince } = await fetchIncremental(since);
      if (!items.length) break;
      for (const item of items) {
        try {
          const r = await upsertProduct(item);
          stats[r]++;                                  // "created" | "updated" | "skipped" | "conflict"
        } catch (e) { stats.errors++; logError(item.id, e); }
      }
      since = nextSince ?? since;
      hasMore = items.length === LIMIT_MAX;            // 分页续拉
    }
    await writeRunLog("success", stats, Date.now() - t0);
  } catch (e) {
    await writeRunLog("error", stats, Date.now() - t0, String(e));
    await alertWecom(`❌ .cn→.com 产品同步失败：${String(e)}`);
    throw e;
  }
  return stats;
}
```

**`upsertProduct`（幂等 + 冲突守卫 + 内容哈希）**：

```ts
async function upsertProduct(item: any): Promise<"created"|"updated"|"skipped"|"conflict"> {
  const neonId = item.id;                                   // cuid 直通
  const map = await prisma.productSyncMap.findUnique({ where: { cnProductId: item.id } });

  // 冲突守卫：从未登记，但 Neon 已有同 id 的原生产品 → 跳过 + 告警（绝不覆盖）
  if (!map) {
    const exists = await prisma.product.findUnique({ where: { id: neonId }, select: { id: true } });
    if (exists) { await alertWecom(`⚠️ id 冲突：${neonId} 已被非同步产品占用，跳过`); return "conflict"; }
  }

  const hash = sha256(JSON.stringify(normalize(item)));
  if (map && map.isActive && map.sourceHash === hash) {      // 内容未变 → 仅刷新 lastSeenAt
    await prisma.productSyncMap.update({ where: { cnProductId: item.id }, data: { lastSeenAt: new Date() } });
    return "skipped";
  }

  const sellerId = await resolveSystemSeller();
  const brandId = await resolveBrand(item.brand);
  const categoryId = await resolveCategory(item.category);

  await prisma.$transaction(async (tx) => {
    await tx.product.upsert({
      where: { id: neonId },
      create: { id: neonId, sellerId, brandId, categoryId, ...mapProductScalars(item), status: item.status },
      update: { brandId, categoryId, ...mapProductScalars(item), status: item.status },
    });
    // 关联表：先删后建（幂等）
    await tx.productImage.deleteMany({ where: { productId: neonId } });
    if (item.images.length) await tx.productImage.createMany({ data: item.images.map((i: any) => ({ productId: neonId, ...i })) });
    await tx.productVideo.deleteMany({ where: { productId: neonId } });
    if (item.videos.length) await tx.productVideo.createMany({ data: item.videos.map((v: any) => ({ productId: neonId, ...v })) });

    // 【拍板⑥】估值行同步（同一 Product.id 下保留最新一条）
    if (item.valuation) {
      await tx.valuation.deleteMany({ where: { productId: neonId } });
      await tx.valuation.create({ data: {
        productId: neonId, brandId, modelName: item.modelName, year: item.year,
        estimatedPriceCny: item.valuation.estimatedPriceCny,
        estimatedPriceUsd: item.valuation.estimatedPriceUsd,
        confidenceScore: item.valuation.confidenceScore,
        factors: item.valuation.factors ?? null,
      }});
    }

    await tx.productSyncMap.upsert({
      where: { cnProductId: item.id },
      create: { cnProductId: item.id, neonProductId: neonId, sourceHash: hash,
                sourceUpdatedAt: new Date(item.updatedAt), isActive: true, lastSeenAt: new Date() },
      update: { sourceHash: hash, sourceUpdatedAt: new Date(item.updatedAt), isActive: true, deletedAt: null, lastSeenAt: new Date() },
    });
  });

  return map ? "updated" : "created";
}
```

#### 3.3.1 `resolveSystemSeller()`（卖家归属映射，零 PII）

```ts
const MINIAPP_SELLER_EMAIL = "miniprogram@shendiao.com";
async function resolveSystemSeller(): Promise<string> {
  const existing = await prisma.user.findUnique({ where: { email: MINIAPP_SELLER_EMAIL } });
  if (existing) return existing.id;
  const created = await prisma.user.create({ data: {
    email: MINIAPP_SELLER_EMAIL, username: "miniprogram",
    passwordHash: await hashPassword(crypto.randomBytes(32).toString("hex")),  // 不可登录
    role: "seller", companyName: "小程序发布", country: "CN",
    preferredLanguage: "zh", credits: 999999, isActive: true,
  }});
  return created.id;
}
```

> **为什么必须挂这个 email**：`.com` `/api/products` 可见性规则以 `seller.email === 'miniprogram@shendiao.com'` 为判定键（`src/app/api/products/route.ts` L66/L82/L84）。挂到该账号，产品才会被规则放行。

---

### 3.4 `src/lib/cn-sync/reconcile.ts`（🆕 `.com`）— **硬删护栏（拍板④ 重点）**

**对外函数**：`reconcile(): Promise<ReconcileStats>`

**四条护栏（缺一不可）**：

1. **仅在"全量快照成功且非空"时才执行删除**；快照为空/请求失败 → **一律不删**。
2. **连续 N 轮异常一律不删**：以 `AgentRunLog` 最近 N 次结果判定；`env CN_SYNC_RECONCILE_GUARD_N`（默认 3）未满足则跳过。
3. **只动"曾同步"的对象**：仅遍历 `ProductSyncMap.isActive=true` 的记录，**绝不触碰**任何 `.com` 原生产品。
4. **删除前留档**：物理删除前，将该产品最小快照写入 `ProductSyncTombstone`（可追溯 + 可人工恢复）。

```ts
export async function reconcile(): Promise<ReconcileStats> {
  const stats: ReconcileStats = { deleted: 0, archivedFallback: 0, skipped: 0, checked: 0 };

  // 护栏 2：连续 N 轮异常 → 跳过
  if (!(await recentRunsHealthy(Number(process.env.CN_SYNC_RECONCILE_GUARD_N ?? 3)))) {
    log("reconcile skipped: recent runs unhealthy"); return stats;
  }

  // 拉全量 id 集合（分页聚合，避免截断）
  const idSet = await fetchFullIdSet();                 // 见下（分页循环）
  // 护栏 1：空快照 → 不删
  if (!idSet || idSet.size === 0) { log("reconcile skipped: empty snapshot"); return stats; }

  const maps = await prisma.productSyncMap.findMany({ where: { isActive: true } });
  for (const m of maps) {
    stats.checked++;
    if (idSet.has(m.cnProductId)) continue;             // 仍存在 → 保留
    const r = await hardDeleteSyncedProduct(m.neonProductId, m.cnProductId);
    if (r === "deleted") stats.deleted++;
    else if (r === "archived-fallback") stats.archivedFallback++;
    else stats.skipped++;
  }
  await writeRunLog("reconcile-success", stats, 0);
  return stats;
}

/** 分页拉全量 id（cursor 循环直到 nextCursor 为空），防止"截断导致误删" */
async function fetchFullIdSet(): Promise<Set<string>> {
  const ids = new Set<string>();
  let cursor: string | null = null;
  for (let i = 0; i < 1000; i++) {                      // 硬上限防死循环
    const r = await fetchCnExport({ mode: "full", cursor, limit: 500 });
    if (!r || !Array.isArray(r.ids)) return new Set();  // 失败 → 返回空集（触发护栏1，不删）
    r.ids.forEach((id: string) => ids.add(id));
    if (!r.nextCursor) break;
    cursor = r.nextCursor;
  }
  return ids;
}

async function hardDeleteSyncedProduct(neonProductId: string, cnProductId: string):
  Promise<"deleted"|"archived-fallback"|"missing"> {
  const snap = await prisma.product.findUnique({
    where: { id: neonProductId },
    include: { brand: true, category: true, images: true, videos: true, valuations: true },
  });
  if (!snap) {                                          // 已不存在 → 仅标记账本
    await prisma.productSyncMap.update({ where: { cnProductId }, data: { isActive: false, deletedAt: new Date() } });
    return "missing";
  }

  // 护栏 4：删除前留档（tombstone，白名单快照）
  await prisma.productSyncTombstone.create({ data: {
    cnProductId, neonProductId, snapshot: JSON.stringify(pickProductWhitelist(snap)), reason: "reconcile-absent",
  }});

  try {
    await prisma.$transaction(async (tx) => {
      await tx.productImage.deleteMany({ where: { productId: neonProductId } });
      await tx.productVideo.deleteMany({ where: { productId: neonProductId } });
      await tx.valuation.deleteMany({ where: { productId: neonProductId } });
      await tx.product.delete({ where: { id: neonProductId } });      // 物理删除
      await tx.productSyncMap.update({ where: { cnProductId }, data: { isActive: false, deletedAt: new Date() } });
    });
    return "deleted";
  } catch (e) {
    // 【关键护栏】存在下游依赖（Favorite/Inquiry/Auction 等无 onDelete:Cascade 的引用）导致 FK 冲突
    // → 降级为 archived，绝不强行删断，避免破坏买家侧数据
    if (isForeignKeyViolation(e)) {
      await prisma.product.update({ where: { id: neonProductId }, data: { status: "archived" } });
      await prisma.productSyncMap.update({ where: { cnProductId }, data: { isActive: false } });
      await alertWecom(`⚠️ 产品 ${neonProductId} 存在下游依赖，已降级为 archived（未物理删除）`);
      return "archived-fallback";
    }
    throw e;
  }
}
```

> **为什么需要 `archived-fallback`**：`prisma/schema.prisma` 中多个引用 `Product` 的模型**没有 `onDelete: Cascade`**（如 L354 / L960 / L1024 / L1170 / L1196 / L1378 等），一旦该产品在 `.com` 被买家 Favorited / 产生 Inquiry / Auction，物理删除会因外键冲突失败。降级为 `archived` 既尊重"真删"意图（正常情况确为真删），又**杜绝删一半 / 删失败 / 破坏买家数据**。

---

### 3.5 `src/app/api/cron/cn-product-sync/route.ts`（🆕 `.com`，增量）

```ts
import { NextRequest, NextResponse } from "next/server";
import { runCnProductSync } from "@/lib/cn-sync/run-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if ((process.env.SITE ?? "com") === "cn") {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  // Vercel Cron 鉴权（Vercel 自动注入 CRON_SECRET 并以 Authorization: Bearer 发送）
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const since = new URL(req.url).searchParams.get("since") ?? undefined;
  const stats = await runCnProductSync({ mode: "incremental", since });
  return NextResponse.json({ ok: true, stats });
}
```

### 3.6 `src/app/api/cron/cn-product-sync-reconcile/route.ts`（🆕 `.com`，对账）

```ts
export async function GET(req: NextRequest) {
  if ((process.env.SITE ?? "com") === "cn") return NextResponse.json({ ok: false }, { status: 404 });
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ ok: false }, { status: 401 });
  const stats = await reconcile();
  return NextResponse.json({ ok: true, stats });
}
```

> 拆成两个路由，避免 Vercel Cron path 带 query 的兼容性风险。


### 3.7 `vercel.json`（🆕/✏️）

```json
{
  "crons": [
    { "path": "/api/cron/cn-product-sync",           "schedule": "*/15 * * * *" },
    { "path": "/api/cron/cn-product-sync-reconcile", "schedule": "0 19 * * *" }
  ]
}
```

> `0 19 * * *`（UTC）= 北京 03:00。**若仓库已有 `vercel.json`，只追加 `crons` 字段，勿覆盖其他配置。**

### 3.8 文案修正（拍板③：写「有延迟」）

| 文件                                       | 位置       | 现值                                               | 改为                                                       |
| ---------------------------------------- | -------- | ------------------------------------------------ | -------------------------------------------------------- |
| `src/app/api/internal/products/route.ts` | L897-899 | `isImported ? "国际品牌，手机+网站同时展示" : "国产品牌，仅在小程序展示"` | `isImported ? "国际品牌，产品将同步至网站展示（可能有延迟）" : "国产品牌，仅在小程序展示"` |
| `src/app/api/miniapp/products/route.ts`  | L235     | `"产品发布成功！网站同步展示中。"`                              | `"产品发布成功！产品将同步至网站展示（可能有延迟）。"`                            |

> 两处均为**纯文案**改动，无逻辑变更。

### 3.9 【关键发现】Valuation 同步 + `.com` 读取改动

#### 现状（证据）

| 事实                                                            | 证据                                                                                                                                    |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `.com` 详情页**渲染** `ValuationCard`                              | `src/app/[locale]/products/[id]/page.tsx` **L20（import）/ L410（渲染）**                                                                   |
| `ValuationCard` 通过 **HTTP** 取数（非 props）                       | `src/components/valuation/valuation-card.tsx` **L102**：`fetch('/api/valuation?productId=...')`                                        |
| `/api/valuation` **实时重算**（含图片/视频 AI 分析），**从不读 `Valuation` 表** | `src/app/api/valuation/route.ts` **GET L339-454**（`prisma.product.findUnique` → `calculateValuationV4`）；**全文无 `prisma.valuation` 查询** |
| 详情页 SSR 的 prisma include **不含** `valuations`                  | `page.tsx` **L148-164**（include 仅 brand/category/images/videos/internationalPrices/seller/auctions）                                   |

#### 结论

- **只同步产品数据**，`.com` 详情页**已经能显示估值**（实时重算得到）——**但与 `.cn` 的数值不一定一致**，且每次浏览都会触发 GPT-4o-mini 图片分析（**成本 + 延迟**）。
- **"同步 `Valuation` 表"本身不会在 `.com` 生效**：因为详情页走 `/api/valuation` 重算，不读表。因此 team-lead 原设想的「改 `page.tsx` + 产品读接口 include」**不是正确改动点**（且会改动 SSR 查询，违反"不改前端 SSR"）。

#### 两个子方案（请 team-lead 选）

| 方案          | 做法                                                                                                | 满足用户      | 代价                                                 |
| ----------- | ------------------------------------------------------------------------------------------------- | --------- | -------------------------------------------------- |
| **V-A 零改动** | 不同步 Valuation，依赖 `.com` 重算                                                                        | ❌ 不满足"同步" | 每次浏览重算（成本/延迟），数值可能与 `.cn` 不一致                      |
| **V-B 推荐**  | **同步** Valuation 行 **+** 改 `/api/valuation` 加 **fast-path**：产品来自同步且存在 Valuation 行 → 由存储行重建结果，跳过重算 | ✅         | 需改 **`/api/valuation/route.ts`（读 API，非 SSR 页面查询）** |

**V-B fast-path 伪代码（在 GET 与 POST 的 `productId` 分支前置）**：

```ts
// 命中 fast-path：该产品是同步来源且存在已存估值
const map = await prisma.productSyncMap.findUnique({ where: { cnProductId: productId } });
const stored = map
  ? await prisma.valuation.findFirst({ where: { productId }, orderBy: { id: "desc" } })
  : null;

if (stored) {
  const parsed = stored.factors ? safeJsonParse(stored.factors) : null;
  return NextResponse.json({ success: true, blurred: false, source: "synced", data: {
    estimatedValue: stored.estimatedPriceCny,
    confidenceScore: stored.confidenceScore,
    priceRange: { low: Math.round(stored.estimatedPriceCny * 0.9), high: Math.round(stored.estimatedPriceCny * 1.1) }, // 存储行无区间，按 ±10% 近似
    details: parsed?.details ?? [],
    analysis: null,
    version: "synced",
  }});
}
// 否则回退到原重算逻辑（不变）
```

> **`factors` 是否要传 → 建议"传"**：`factors` 为**派生数据（非 PII）**，且其内**含 `details`**，正是 fast-path 还原 UI「估值详情」展开项所必需。若最小化不传 `factors`，fast-path 只能显示**数值 + 置信度**（无法展开详情）——需产品确认是否接受。  
> **改动边界**：只改 `/api/valuation/route.ts`（读 API）；**不改** `page.tsx` 的 SSR prisma 查询，**不改** `/api/products`。

---

## 4. 环境变量清单

| 变量                          | 站点                               | 值来源                                                                                 | 说明                   |
| --------------------------- | -------------------------------- | ----------------------------------------------------------------------------------- | -------------------- |
| `CN_SYNC_API_KEY`           | **`.com`（Vercel）**               | 新生成（`openssl rand -hex 32`），存 GitHub Secrets → 由 `deploy-com.yml` 的 `upsert_env` 注入 | 同步任务调用 `.cn` 导出接口时携带 |
| `CN_SYNC_API_KEY`           | **`.cn`（ECS `/opt/cn/.env.cn`）** | **与上同值**；由运维手工写入 ECS（**绝不经 CI 注入**，遵数据红线）                                           | 导出接口校验               |
| `CN_EXPORT_BASE_URL`        | `.com`（Vercel）                   | 固定 `https://usedfarmmach.cn`                                                        | 导出接口基址               |
| `CRON_SECRET`               | `.com`（Vercel）                   | 配置 Vercel Cron 时 Vercel 自动注入（亦可自定义）                                                 | Cron 入口鉴权            |
| `CN_SYNC_RECONCILE_GUARD_N` | `.com`（Vercel）                   | 可选，默认 `3`                                                                           | 连续 N 轮异常则跳过对账删除      |
| `SITE`                      | 两边                               | 已有（`.com`=`com`，`.cn`=`cn`）                                                         | —                    |

> `.com` 环境变量注入路径参考 `deploy-com.yml` 的 `upsert_env`（L37-63）；`.cn` 仅需在 `/opt/cn/.env.cn` 增加 `CN_SYNC_API_KEY` 一行（`docker-compose.yml` 的 `env_file` 已加载）。

---

## 5. 验证命令

### 5.1 本地验证（开发机）

```bash
# ① 白名单单元测试（断言不泄露坐标/联系方式/sellerId）
npx vitest run src/lib/cn-sync/__tests__/field-whitelist.test.ts

# ② 本地起 .cn（连本地/测试库），验证导出接口
SITE=cn CN_SYNC_API_KEY=testkey DATABASE_URL_CN="postgresql://..." npm run dev

# ③ 无 key → 期望 401（应用层鉴权，非网关 403/404）
curl -i "http://localhost:3000/api/internal/products/export?limit=5"
# ④ 有 key → 期望 200，且 payload 无 latitude/longitude/contact*/sellerId
curl -s -H "x-sync-key: testkey" "http://localhost:3000/api/internal/products/export?limit=5" | \
  node -e "const d=JSON.parse(require('fs').readFileSync(0));console.log('count',d.count); \
           console.log('leak?', d.items.some(i=>('latitude' in i)||('longitude' in i)||('sellerId' in i)))"

# ⑤ 本地跑同步核心（连 Neon），dry-run 统计
CN_SYNC_API_KEY=testkey CN_EXPORT_BASE_URL="http://localhost:3000" DATABASE_URL="postgresql://...neon" \
  npx tsx -e "import('./src/lib/cn-sync/run-sync').then(m=>m.runCnProductSync({mode:'incremental'}).then(console.log))"
```

### 5.2 部署后验证

| #       | 步骤                                                                                                      | 期望                                                                      | 说明                                                   |
| ------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------- |
| V0      | `curl -i https://usedfarmmach.cn/api/internal/products`（GET）                                            | **405**                                                                 | **基线**：证明 `/api/internal/*` 已穿透网关到达 Next.js（方案 A 命门） |
| **V2b** | `curl -i https://usedfarmmach.cn/api/internal/products/export`（**不带 key**）                              | **401**                                                                 | ✅ 路径放行 + 应用层鉴权生效。**若返 403/404 → 网关拦截，先解决放行**         |
| V2c     | 同上**带** `x-sync-key`                                                                                    | 200，payload 无 `latitude/longitude/contact*/sellerId`                    | 白名单生效                                                |
| V3      | 手动触发增量：`curl -H "Authorization: Bearer $CRON_SECRET" https://usedfarmmach.com/api/cron/cn-product-sync` | `{ok:true, stats}`                                                      | `.com` 拉取写 Neon                                      |
| V4      | 访问 `https://usedfarmmach.com/zh/products`                                                               | 出现小程序「国际品牌」产品；图片正常                                                      | 端到端                                                  |
| V5      | 小程序发布「国产品牌」 → 等 15 分钟                                                                                   | `.com` **始终不可见**                                                        | 过滤正确                                                 |
| V6      | `.cn` 删除该国际品牌产品 → 手动触发 reconcile                                                                        | 该产品在 `.com` 消失；`ProductSyncTombstone` 有留档；`ProductSyncMap.deletedAt` 非空 | 硬删 + 审计                                              |
| V7      | 触发一次 `/api/cron/cn-product-sync-reconcile`（`.cn` 导出接口临时不可达场景）                                           | **不删除任何产品**（护栏 1）                                                       | 防误删                                                  |

---

## 6. 任务列表（按 Stage 排序，含依赖与验收）

> 依赖图：`S0-T1 → S0-T2 → S1-T3 → S1-T4 → S2-T5`（S0 是 S1 的前置；S0 内 T1/T2 可并行）

### Stage 0 — 存量补齐（前置：**法务书面确认**）

| ID        | 任务                                              | 源文件                                                          | 依赖           | 验收标准                            |
| --------- | ----------------------------------------------- | ------------------------------------------------------------ | ------------ | ------------------------------- |
| **S0-T1** | 导出接口 + 白名单 + schema                             | `export/route.ts`、`field-whitelist.ts`、`schema.prisma`（+ 单测） | —            | 单测通过；本地 401/200 正确；payload 无禁字段 |
| **S0-T2** | 文案修正                                            | `internal/products/route.ts`、`miniapp/products/route.ts`     | —            | 两处文案改为"有延迟"                     |
| **S0-T3** | 部署 `.cn`（含 `CN_SYNC_API_KEY`）+ 部署后 V0/V2b/V2c   | —                                                            | S0-T1, S0-T2 | **V2b 返 401**（以 V0 的 405 为基线）   |
| **S0-T4** | 存量回填：部署 `.com`（建表）后，手动触发增量一次（不带 `since` = 全量拉取） | —                                                            | S1-T1..T3    | `.com` 可见现存国际品牌小程序产品            |

> **Stage 0 回填方式**：优先**部署后手动 `curl` 触发** `GET /api/cron/cn-product-sync`（首次不带 `since`，即拉取全量）；无需单独 CLI。`scripts/cn-product-sync.js` 仅为**可选**离线回退（本地/无网时使用）。

### Stage 1 — 增量常态

| ID        | 任务                                 | 源文件                              | 依赖           | 验收标准                                             |
| --------- | ---------------------------------- | -------------------------------- | ------------ | ------------------------------------------------ |
| **S1-T1** | 同步核心 + 系统 seller/brand/category 解析 | `run-sync.ts`                    | S0-T1        | 幂等：重复执行 `skipped` 递增；发布新国际品牌产品 ≤15min 出现在 `.com` |
| **S1-T2** | 对账 + 硬删护栏 + tombstone              | `reconcile.ts`                   | S1-T1        | V6/V7 通过；下游依赖存在时降级 archived                      |
| **S1-T3** | 两条 Cron 入口 + `vercel.json`         | `cron/*`、`vercel.json`           | S1-T1, S1-T2 | Cron 触发成功；`CRON_SECRET` 鉴权生效                     |
| **S1-T4** | Valuation fast-path                | `src/app/api/valuation/route.ts` | S0-T1        | `.com` 详情页显示与 `.cn` 一致的估值；不再触发重算                 |
| **S1-T5** | 失败告警接入                             | 复用 `wecom/group-webhook.ts`      | S1-T1        | 模拟失败收到企微告警                                       |

### Stage 2 — 监控与运维

| ID        | 任务                                               | 依赖    | 验收标准                                        |
| --------- | ------------------------------------------------ | ----- | ------------------------------------------- |
| **S2-T1** | `AgentRunLog`（`agentId=cn-product-sync`）成功率看板/巡检 | S1    | 可查每轮 created/updated/skipped/deleted/errors |
| **S2-T2** | 运维 Runbook（异常处置、手动补跑、tombstone 恢复流程）             | S2-T1 | 文档可执行                                       |
| **S2-T3** | 评估并入现有流水线 `automation-1777885493367`             | S2-T1 | 编排收敛                                        |

---

## 7. 风险与待复核项

### 7.1 风险表增补（对应设计文档 §8.1）

| 风险                            | 等级    | 影响       | 缓解                                                                                                                      |
| ----------------------------- | ----- | -------- | ----------------------------------------------------------------------------------------------------------------------- |
| **【真删】批量误删 `.com` 数据**        | **高** | 数据丢失     | 护栏 1（空快照不删）+ 护栏 2（连续 N 轮异常不删）+ 护栏 3（只动曾同步对象）+ 护栏 4（tombstone 留档）；`fetchFullIdSet` **分页聚合防截断**（若 `nextCursor` 缺失视同失败→不删） |
| **【真删】FK 冲突致删除失败/半删**         | 中     | 状态不一致    | `$transaction` 原子化；捕获 FK 冲突 → **降级 archived**；`archived-fallback` 计数 + 告警                                               |
| Valuation fast-path 改动触及读 API | 中     | 影响既有估值展示 | 仅**新增**前置分支（命中同步来源才走 fast-path），**保留原重算逻辑为回退**；改动面最小                                                                    |
| 坐标处置语义歧义（拍板⑤）                 | 中     | 合规       | 见 §7.2-Q3                                                                                                               |

### 7.2 需复核 / 二次确认

- **Q1（前置，阻塞 S0）**：**法务书面确认**尚未取得——目前唯一书面依据是 `site-split-architecture.md` §9.9 L563。**未落纸前不得开工 Stage 0。**
- **Q2（Valuation）**：确认采用 **V-B（同步 + fast-path）** 还是 **V-A（仅重算）**；并确认 `factors`（含 `details`）是否出境。若选 V-A，则 §3.9 与 S1-T4 可整体删除。
- **Q3（坐标语义，请复核用户原话）**：用户原话「确认标注真实地址」，team-lead 解读为 **(a) 只同步 `location` 文字地址、不传坐标**——本清单**按 (a) 定稿**。**但"确认标注真实地址"亦可被读作"要精确坐标"**（即选项 (c)）。建议向用户复述确认：**"详情页只显示文字地址（如「河北 石家庄」），地图坐标留在 `.cn` 不出境"** —— 若用户意图为 (c)，则白名单需回加 `latitude`/`longitude` 并重做合规评估。
- **Q4（硬删兜底）**：确认是否接受「存在下游依赖（收藏/询盘/竞价）时降级 `archived`」——这是对"真删"的**唯一**让步（正常情况仍真删）。

---

*本清单为实施蓝图，未含已落地的业务代码。经批准后按 Stage 0 → 1 → 2 编码。*
