# 代码摘要：网站浏览量统计与标注显示（product_view_stats）

> 工程师：Alex（software-engineer）
> 对应架构：`docs/view-stats-arch.md`（架构师 高见远）/ PRD：`docs/view-stats-prd.md`
> 交付日期：2025-07-29
> 范围：T1–T6 全量实现；已通过 `npx tsc --noEmit`（0 错误）与全局一致性审查（IS_PASS: YES）

---

## 一、新增 / 修改文件清单

### 新建文件（17 个）
| 文件 | 说明 |
|---|---|
| `prisma/migrations/20250729120000_add_view_stats/migration.sql` | 纯 additive 迁移 SQL（ADD COLUMN + CREATE TABLE + 索引 + 外键） |
| `prisma/migrations/migration_lock.toml` | Prisma 迁移锁（provider = postgresql） |
| `scripts/migrate-field-videos.ts` | 历史迁移脚本：仅迁 OSS db.json → FieldVideo（按 url 去重），upsert SiteStat 全局行 |
| `src/lib/track-guard.ts` | 服务端埋点扩展点 `shouldSkipTracking(req)`（本期恒 false） |
| `src/lib/stats.ts` | 前端 `trackView(scope, id): Promise<number|null>` |
| `src/lib/stats-queries.ts` | 看板查询封装（总览 / 栏目排行 / 视频合并排行） |
| `src/types/stats.ts` | 看板响应类型（Overview / CategoryRank / VideoRank / …） |
| `src/app/api/stats/track/route.ts` | 公开埋点 API（四类 scope 原子自增 + 返回最新值） |
| `src/app/api/admin/analytics/views/route.ts` | 后台看板 API（总览 + 排行 + 角色/卖家过滤） |
| `src/components/stats/ProductViewBadge.tsx` | 产品详情页浏览量标注（挂载即 track） |
| `src/components/stats/CategoryViewBadge.tsx` | 栏目浏览量标注（挂载即 track） |
| `src/components/stats/VideoPlayBadge.tsx` | 视频播放量标注（纯展示，父级更新） |
| `src/components/stats/ProductVideoGallery.tsx` | 产品视频区客户端包装（onPlay 调 track + 展示 badge） |
| `src/app/[locale]/admin/analytics/views/page.tsx` | 管理看板 server wrapper（角色校验后渲染 client） |
| `src/app/[locale]/admin/analytics/views/ViewsAnalyticsClient.tsx` | 看板客户端（30s 轮询 + 4 卡 + 栏目表 + 视频表类型切换） |
| `src/app/[locale]/seller/analytics/views/page.tsx` | 卖家自视图入口（复用 admin client，variant=seller） |
| （含上表共 17 新建；其中 `migration.sql` 自动归类到"迁移"） | |

### 修改文件（9 个）
| 文件 | 改动 |
|---|---|
| `prisma/schema.prisma` | `Product` +`viewCount`；`ProductVideo` +`playCount`；`Category` +`viewCount`；新增 `FieldVideo`、`SiteStat`；`Booth` +`fieldVideos` 反向关系 |
| `src/app/[locale]/products/[id]/page.tsx` | 标题下挂 `ProductViewBadge`；视频区改用 `ProductVideoGallery`（onPlay 计数） |
| `src/app/[locale]/category/[slug]/CategoryClient.tsx` | 顶部挂 `CategoryViewBadge`（传入 categoryId + viewCount）；`CategoryWithSlug` 加 `viewCount?` |
| `src/app/[locale]/products/page.tsx` | 栏目选项带入 `id` 供徽标使用 |
| `src/app/[locale]/products/ProductsClient.tsx` | 栏目筛选生效时挂 `CategoryViewBadge`（按 slug 反查 categoryId） |
| `src/app/[locale]/admin/admin-sidebar.tsx` | 侧边栏加"浏览量看板"导航（hideForEditor: true） |
| `src/app/api/field-videos/upload/route.ts` | POST 确认后双写 `FieldVideo`（保留 OSS db.json） |
| `src/app/api/field-videos/list/route.ts` | 改读 `FieldVideo`，返回含 `id`/`playCount` |
| `src/app/[locale]/expo/field-videos/page.tsx` | `<video onPlay>` 调 `track('fieldVideo', id)`；展示 `VideoPlayBadge` |

---

## 二、新增模型与字段（schema.prisma）

```prisma
model Product      { viewCount   Int @default(0) }                 // 产品详情页访问累计
model ProductVideo { playCount   Int @default(0) }                 // 产品视频播放累计
model Category     { viewCount   Int @default(0) }                 // 栏目页访问累计

model FieldVideo {                                              // 地头展现场作业视频（新）
  id          String   @id @default(cuid())
  boothId     String?                                        // 可空：历史 QR 上传无 booth
  url         String
  title       String?                                        // 品牌名
  machineType String?
  playCount   Int      @default(0)
  source      String   @default("qr")                         // 'qr' | 'showcase'
  createdAt   DateTime @default(now())
  booth       Booth?   @relation(fields: [boothId], references: [id], onDelete: SetNull)
  @@index([boothId]) @@index([source])
}

model SiteStat {                                              // 网站总览单例行（新）
  id                String   @id                              // 固定 'global'
  totalPageViews    Int      @default(0)                     // 仅 product+category（视频不计入 PV）
  totalProductViews Int      @default(0)
  totalCategoryViews Int     @default(0)
  totalVideoPlays   Int      @default(0)                     // video+fieldVideo
  updatedAt         DateTime @updatedAt
}

model Booth { ... fieldVideos FieldVideo[] }                 // 反向关系
```

**关键约定（已落实）**
- 全部 additive：只加字段/新表，零改删既有；两站各自 `migrate deploy` 幂等安全。
- 视频播放**不计入 PV**：`totalPageViews` 仅 product+category；视频只增 `totalVideoPlays`。
- 所有 +1 走 Prisma `increment` 原子自增，禁止"先查后改"。
- 历史从 0 起：迁移脚本仅创建 `FieldVideo(playCount=0)`，不臆造历史值；`migrate-field-videos.ts` **仅迁 OSS db.json，跳过 ShowcaseItem.videos**（主理人拍板）。

---

## 三、API 签名

### 1. 埋点（公开，无需登录）
```
POST /api/stats/track
Body:  { "scope": "product"|"category"|"video"|"fieldVideo", "id": string }
Resp:  { "success": true,  "data": { "scope": string, "id": string, "count": number } }
       { "success": false, "error": string }   // 404 id 不存在 / 400 scope 非法或 id 缺失
约束:  export const dynamic = "force-dynamic"; export const revalidate = 0;
      入口调用 shouldSkipTracking(req)（本期恒 false，P2 扩展点）
```

### 2. 看板（需登录鉴权）
```
GET /api/admin/analytics/views?type=all|product|field[&sellerId=xxx]
Header: Authorization: Bearer <token>
Resp:  { "success": true, "data": {
          "overview":        { totalPageViews, totalProductViews, totalCategoryViews, totalVideoPlays },
          "categoryRanking": [ { id, name, viewCount, ratio } ],          // Top10，ratio 为占比%
          "videoRanking":    [ { id, title, type:"product"|"field", playCount } ], // Top20 合并
          "scope":           "all" | "mine"
        } }
Err:   { "success": false, "error": "请先登录" } 401 / "Token无效" 401 / "权限不足" 403
鉴权:  getTokenFromHeaders + verifyToken 复用；
       role∈{admin,super_admin} 看全站（可 ?sellerId= 钻取），seller 强制只看自有（scope=mine）
```

---

## 四、前端挂载点

| 页面 / 组件 | 挂载内容 | 触发行为 |
|---|---|---|
| 产品详情页 `products/[id]/page.tsx` | `<ProductViewBadge productId initialViewCount={product.viewCount} />`（标题下） | 挂载即 `track('product', id)` |
| 产品详情页（视频区） | `<ProductVideoGallery videos onPlay/>` | 每个 `<video onPlay>` → `track('video', id)`，实时更新 `VideoPlayBadge` |
| 栏目页 `category/[slug]/CategoryClient.tsx` | `<CategoryViewBadge categoryId initialViewCount={data.category.viewCount} />` | 挂载即 `track('category', id)` |
| 列表页 `products/ProductsClient.tsx` | 栏目筛选生效时 `<CategoryViewBadge categoryId />` | 挂载即 `track('category', id)` |
| 地头展大屏 `expo/field-videos/page.tsx` | `<video onPlay>` → `track('fieldVideo', id)`；`<VideoPlayBadge playCount badgeLabel="地头展现场" />` | 播放即计数并展示 |
| 后台看板 `admin/analytics/views` + `seller/analytics/views` | `ViewsAnalyticsClient`（轮询 30s） | GET 看板 API |

---

## 五、Migration 如何执行（两站各自，不串库）

1. **生成客户端（本地，仅需一次）**
   ```bash
   npx prisma generate
   ```
2. **应用迁移（.com / Neon）**
   ```bash
   npx prisma migrate deploy
   ```
3. **应用迁移（.cn / 阿里云 RDS）**
   ```bash
   SITE=cn npx prisma migrate deploy
   ```
   > `migrate deploy` 直接执行 `prisma/migrations/20250729120000_add_view_stats/migration.sql`（纯 additive SQL），无需 `migrate dev`，适合 CI/生产幂等部署。
4. **历史数据迁移（仅地头展视频，按需执行一次）**
   ```bash
   # .com
   npx tsx scripts/migrate-field-videos.ts
   # .cn
   SITE=cn npx tsx scripts/migrate-field-videos.ts
   ```
   - 读取 OSS `uploads/field-expo-videos/db.json`，按 `url` 去重 `upsert FieldVideo(source='qr', playCount=0)`；
   - 幂等 `upsert SiteStat(id='global')`；
   - **跳过 ShowcaseItem.videos**（展品视频，语义不同、已有展品页 viewCount，按主理人决策不混计）；
   - 重复执行幂等，不影响 OSS 旧链路。

---

## 六、一致性审查结论（IS_PASS: YES）

- increment 字段名全局一致：`viewCount`(Product/Category) / `playCount`(ProductVideo/FieldVideo) / `total*`(SiteStat) 在 track、queries、badge、gallery、page 间完全对齐。
- API 响应结构与 `types/stats.ts`、`src/lib/stats.ts` 调用方一致。
- 前端 `trackView` 四次调用参数（product / category / video / fieldVideo）均为合法 scope。
- 跨文件 import 路径（`@/lib/*`、`@/types/stats`、`@/components/stats/*`）均解析通过，`npx tsc --noEmit` 0 错误。
- `force-dynamic` + `revalidate = 0` 已加于 track 路由；看板 API 亦 `force-dynamic`。
- 双写兼容：upload 保留 OSS db.json 且新增 FieldVideo；list 改读 FieldVideo；大屏 onPlay 用 FieldVideo.id 调 track。

> 未做 git 操作（不 commit/push），仅本地实现与类型校验。
