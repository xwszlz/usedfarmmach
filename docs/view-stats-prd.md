# 简单 PRD：网站浏览量统计与标注显示（product_view_stats）

> 文档类型：简单 PRD（无竞品分析）
> 负责人：许清楚（产品经理）
> 适用范围：usedfarmmach 跨境二手农机交易平台（.com 国际站 / .cn 国内站 共用一套 Next.js 代码，各自独立数据库，各自统计）
> 日期：2025-07-29

---

## 1. 项目信息

- **Language**：中文（zh）
- **Programming Language**：Next.js 14（App Router）+ next-intl（8 语）+ Prisma + PostgreSQL（Neon / 阿里云）
  - UI 沿用现有 MUI + Tailwind 组件库，不引入新框架
  - 两站同源代码，各自 `prisma migrate deploy` 到自己库；本功能一套代码、两库各自统计
- **Project Name**：`product_view_stats`
- **原始需求复述**（用户已确认，必须全部覆盖）：
  1. **显示对象**：公开标注 + 后台看板都做。
     - 公开标注：访客可见浏览量 badge，出现在「产品详情页 / 产品列表·栏目页 / 视频播放处」。
     - 后台看板：管理员/卖家登录可见运营统计面板，含「网站总览 / 按栏目 / 按视频」多维。
  2. **实时方式**：累计实时读取 —— 每次页面/视频访问 +1，前端显示最新累计值；后台看板定时自动刷新（轮询 30s~60s），**不需要 WebSocket 真·实时推送**。
  3. **视频范围**：两类都统计 —— (a) `ProductVideo`（产品详情里的视频）；(b) 地头展现场作业视频。
  4. **统计维度**：① 网站总浏览量（PV 累计）；② 每个产品栏目（Category）浏览量；③ 地头展作业视频浏览量（两类视频分别/合计呈现）。

---

## 2. 产品定义

### 2.1 Product Goals（3 个清晰、正交目标）
1. **访客感知热度**：在产品详情、栏目/列表、视频播放处展示浏览量标注，让访客直观判断商品/栏目/视频的热度，提升信任与决策效率。
2. **运营掌握流量分布**：为管理员/卖家提供后台看板（总览 + 栏目排行 + 视频排行），多维度掌握网站流量分布，支撑选品、推荐位与运营决策。
3. **低成本可维护的统计**：以「服务端累计 +1 + 前端读最新值 + 后台轮询刷新」的轻量方案实现，避免 WebSocket 等重架构，一套代码两站通用。

### 2.2 User Stories
- **访客视角**：
  1. As a visitor, I want to see “已被浏览 N 次” on a product detail page so that I can gauge how popular the machine is.
  2. As a visitor, I want to see a view-count badge on category/listing pages and on video players so that I know which categories and operation videos are worth my attention.
- **管理员/卖家视角**：
  3. As an admin, I want a dashboard showing total site views / per-category ranking / per-video ranking that auto-refreshes every 30–60s so that I can monitor traffic without manual refresh.
  4. As a seller, I want to filter the dashboard to only my own products and videos so that I can evaluate my listings’ performance.
  5. As an admin, I want the two video types (product video vs. 地头展现场作业视频) shown separately and combined so that I can compare content engagement across types.

---

## 3. 技术规范

### 3.1 前置调研结论（基于 `prisma/schema.prisma` 真实状态，非推测）

| 模型 | 行号 | 现有相关字段 | 结论 |
|---|---|---|---|
| `Product` | L191–257 | 无计数类字段（id/sellerId/brandId/categoryId/modelName/year/priceCny/...） | **需新增 `viewCount Int @default(0)`**，位置建议放在 `status`/计数类语义区，紧邻 `refreshedAt` 后或 `promotedUntil` 前；当前无任何统计字段，加字段无冲突。 |
| `ProductVideo` | L270–283 | id/productId/url/sortOrder/title/duration/fileSize/moderatedAt/moderationStatus | **无播放量字段**；需新增 `playCount Int @default(0)`（用 playCount 精确表达“播放”，区别于页面 view）。无 `type` 字段，无法在表内区分“产品视频”与“地头展视频”。 |
| `Category` | L174–189 | id/nameZh/nameEn/parentId/name{Ru,Es,Pt,Ar,Fr,Hi}/parent/children | **无聚合浏览量字段**；自关联层级（parentId/children），**无 `level` 字段**（深度靠 parentId 递归）。需新增 `viewCount Int @default(0)` 用于栏目页访问计数与后台排行。 |
| `ShowcaseItem` | L1408–1466 | `videos String[]`（L1420）、`viewCount Int @default(0)`（L1426，展品页浏览量）、`inquiryCount` | 展商展台体系，已有 `videos String[]`（视频 URL 数组）与展品 `viewCount`。<br>**本功能不依赖它的 `viewCount`**，但“地头展现场作业视频”真实落库位置就是 `ShowcaseItem.videos`（见 3.1.1）。 |
| `Expo` / `Booth` | L1358–1406 | 均无视频字段 | 确认无视频字段。 |

#### 3.1.1 「地头展现场作业视频」真实模型归属（已确认结论，不含糊）
- 在 schema 中 grep `video`/`Video`/`expo`/`showcase`/`booth`/`Expo`/`ShowcaseItem`/`Booth` 结果：
  - `Expo`：无视频字段；`Booth`：无视频字段；
  - `ShowcaseItem`：**含 `videos String[]`（视频 URL 数组）**；
  - 全 schema **不存在独立的“地头展视频”表**（无 `FieldVideo` / `ExpoVideo` 等）。
- **结论**：地头展现场作业视频在现有 schema 中真实归属 = **`ShowcaseItem.videos`（`String[]` 视频 URL 数组）**。项目根的「地头展现场作业视频上传使用说明.html」「地头展上传视频二维码.png」说明展商通过扫码向 booth 的 ShowcaseItem 上传现场作业视频，最终落库于 `ShowcaseItem.videos`。
- **设计矛盾与建议**（写入待确认）：`ShowcaseItem.videos` 是 `String[]`，没有逐视频主键，无法对单条视频精确 +1 计数；且团队已明确 `ShowcaseItem.viewCount` 是“展品页”独立计数体系，本功能不应耦合。
  - **推荐方案**：新建独立的 `FieldVideo` 模型（`boothId` 外键 + `url` + `title?` + `playCount Int @default(0)`），与 `ProductVideo` 平级，专承“地头展现场作业视频”的播放统计，彻底解耦展台体系。
  - **备选方案**：复用 `ShowcaseItem.videos`，则播放量只能做到“展品（ShowcaseItem）维度”汇总（无法逐视频），在 `ShowcaseItem` 上加 `videoViews Int @default(0)`。
  - 此决策影响 schema 结构，列为 P0 待确认项（见 §3.4 Q1）。

#### 3.1.2 与既有统计体系的关系
- `ShowcaseItem.viewCount`（L1426）、`Article.viewCount`（L461）、`Auction.viewCount`（L928）、`IndustryReport.viewCount`（L859）均为**既有独立计数**，本功能新增的 Product/Category/Video 计数为一套新建体系，互不影响。
- `UsageLog`（L134）记录的是 action（publish/inquiry/aiValuation/viewContact/guarantee），**不是页面浏览日志**，本功能不复用，但 P2 防刷可参考其“同用户月度计数”思路。

### 3.2 三维度统计方案（核心）
- **① 网站总浏览量（PV 累计）**：推荐用 `SiteStat` 单例（`id='global'`, `totalPageViews Int`）在每次 track 时原子 +1，后台 O(1) 读取。零 schema 变更的备选：运行时 `sum(Product.viewCount) + sum(Category.viewCount) + sum(视频播放)`（见 Q5）。
- **② 每个栏目（Category）浏览量**：`Category.viewCount`，栏目/列表页每次访问 +1；后台“按栏目”排行直接读取。可选叠加子栏目产品视图递归汇总（Q6）。
- **③ 地头展作业视频浏览量**：`ProductVideo.playCount` 与 `FieldVideo.playCount`（或 ShowcaseItem 维度）**两类分别统计、分别 + 合计呈现**；后台“视频排行表”含类型列，可切换/合并查看。

### 3.3 Requirements Pool

#### P0（Must have）
- **DB 字段**
  - [P0-DB-1] `Product` 新增 `viewCount Int @default(0)`（产品详情页浏览计数 + 公开标注 + 热度）。
  - [P0-DB-2] `ProductVideo` 新增 `playCount Int @default(0)`（产品视频播放计数）。
  - [P0-DB-3] `Category` 新增 `viewCount Int @default(0)`（栏目/列表页计数 + 栏目 badge + 后台排行）。
  - [P0-DB-4] 地头展视频模型：**推荐新建 `FieldVideo` 模型**（见 3.1.1），含 `boothId`/`url`/`title?`/`playCount Int @default(0)`；若确认复用 `ShowcaseItem.videos`，则改为在 `ShowcaseItem` 加 `videoViews Int @default(0)`（Q1 拍板）。
  - [P0-DB-5] `SiteStat` 单例（`id String @id`, `totalPageViews Int @default(0)`）用于网站总览 O(1) 读取（Q5 备选运行时 sum 二选一）。
- **埋点 API**
  - [P0-API-1] `POST /api/stats/track`，body `{ scope: 'product'|'category'|'video'|'fieldVideo', id: string }`：
    - `product` → `Product.update({ data: { viewCount: { increment: 1 } } })` 返回最新值，并 `SiteStat.totalPageViews` +1；
    - `category` → `Category.viewCount` +1 + `SiteStat` +1；
    - `video` → `ProductVideo.playCount` +1（视频播放是否计入 SiteStat 总 PV 见 Q3）；
    - `fieldVideo` → `FieldVideo.playCount` +1（或 ShowcaseItem.videoViews +1）。
    - 服务端用 Prisma `increment` 原子自增，避免并发覆盖；返回最新累计值供前端即时展示。
  - [P0-API-2] 前端在「产品详情页加载 / 栏目页加载 / 视频开始播放」时调用 track，拿到返回值渲染 badge（累计实时读取）。
- **公开标注组件**
  - [P0-UI-1] `ProductViewBadge`：产品详情页标题下方「已被浏览 N 次」。
  - [P0-UI-2] `CategoryViewBadge`：栏目/列表页顶部统计条「本栏目已被浏览 N 次」。
  - [P0-UI-3] `VideoPlayBadge`：视频播放器下方「播放 N 次」（ProductVideo 与 FieldVideo 共用）。

#### P1（Should have）
- [P1-1] **后台运营看板** `/[locale]/admin/analytics/views`（参考既有 `/[locale]/seller/booth/analytics` UI 风格）：
  - 顶部「网站总览」数字卡：总 PV（SiteStat）+ 产品总浏览 + 栏目总浏览 + 视频总播放。
  - 中部「按栏目」排行表：Category 列表按 `viewCount` 降序，含栏目名/浏览量/占比。
  - 下部「按视频」排行表：ProductVideo + FieldVideo 合并，含 视频标题/类型(产品视频|地头展视频)/播放量，支持分别/合计切换与降序。
  - 定时轮询自动刷新（默认 30s，可配置 30–60s），无需手动刷新、无需 WebSocket。
- [P1-2] **卖家维度过滤**：看板支持「仅看我的产品/视频/栏目」（基于登录 sellerId 过滤 Product.sellerId 与 FieldVideo 归属 booth 的 merchantId）。
- [P1-3] **权限**：管理员（admin/super_admin）看全站；卖家看自有数据；未登录不可访问看板。

#### P2（Nice to have / 边界与优化，需拍板或后续迭代）
- [P2-1] **防刷去重**：同一 IP / 登录用户短时间（如 10–30min）重复刷新是否去重。建议基于滑动窗口（内存/Redis 或参考 UsageLog 思路），默认“计入但可配置去重”。（Q2）
- [P2-2] **搜索引擎爬虫不计**：UA / 常见 bot 列表过滤，避免 PV 虚高。（Q4）
- [P2-3] **匿名用户是否计入**：建议 PV 计入匿名访客，去重粒度见 P2-1。（Q2）
- [P2-4] **栏目聚合是否含子栏目递归汇总**：Category 无 `level` 字段，递归需 CTE 或应用层遍历；默认“仅直接栏目”，可选开启子栏目滚动汇总。（Q6）
- [P2-5] **聚合查询性能**：栏目/视频排行用 SQL `groupBy`/`orderBy` 聚合 vs 应用层；SiteStat 单例 vs 运行时 sum；数据量大时引入缓存。（Q5）
- [P2-6] **历史浏览量**：新字段默认 0；是否需从日志/估填历史值（建议从 0 起，Q7）。

### 3.4 UI Design Draft（文字 + 简易布局，不画图）

**公开标注（访客可见）**
- **产品详情页**：标题（modelName + brand）正下方一行小字 badge ——
  `🔥 已被浏览 1,234 次`（`ProductViewBadge`，MUI `Chip` 风格，置于标题与价格之间）。
- **栏目/列表页**：顶部筛选/排序条下方一条浅色统计条 ——
  `本栏目「拖拉机」已被浏览 5,678 次 · 共 120 台在售`（`CategoryViewBadge`）。
- **视频播放处**：播放器控件下方、标题右侧小字 ——
  `▶ 播放 89 次`（ProductVideo 与 FieldVideo 共用 `VideoPlayBadge`；地头展视频额外标注「地头展现场」标签区分类型）。

**后台看板（管理员/卖家）** `/[locale]/admin/analytics/views`
```
┌─────────────────────────────────────────────────────────────┐
│  网站浏览量总览                           [每30s自动刷新 ●]    │
├──────────────┬──────────────┬──────────────┬──────────────────┤
│ 总浏览量(PV) │ 产品总浏览   │ 栏目总浏览   │ 视频总播放       │
│  128,540     │   98,200     │   21,340     │    9,000         │
├──────────────┴──────────────┴──────────────┴──────────────────┤
│  按栏目排行（Top 10）           [卖家视角：仅我的] [全部]      │
│  栏目名            浏览量      占比   趋势                     │
│  拖拉机            5,678       26%    ▲                       │
│  收割机            4,210       19%    ▲                       │
│  ...                                                        │
├─────────────────────────────────────────────────────────────┤
│  按视频排行  [全部|产品视频|地头展现场作业视频]                │
│  视频标题          类型            播放量                     │
│  约翰迪尔作业实拍   地头展现场作业   320                        │
│  产品介绍视频A     产品视频         210                        │
│  ...（合计：产品 X + 地头展 Y = Z）                           │
└─────────────────────────────────────────────────────────────┘
```
- 顶部 4 个数字卡（总览）；中部栏目排行表（降序 + 占比）；下部视频排行表（类型切换 + 合计）。
- 风格对齐既有 `/[locale]/seller/booth/analytics`（MUI Card/Table），右上角显示轮询状态与下次刷新倒计时。

### 3.5 Open Questions（待确认问题清单，需用户/技术拍板）
- **Q1（关键）**：地头展现场作业视频模型最终确认 —— 新建独立 `FieldVideo` 模型（推荐，逐视频精确计数、解耦展台体系），还是复用 `ShowcaseItem.videos`（降为展品维度汇总、无逐视频计数）？此决策影响 P0 的 schema 结构。
- **Q2**：防刷去重粒度 —— 同 IP/登录用户短时间重复刷新是否去重？去重时间窗（建议 10–30min）？匿名用户是否计入？（关联 P2-1/P2-3）
- **Q3**：视频播放是否计入“网站总浏览量(PV)”？还是 PV 仅指页面访问、视频播放单列？（影响 SiteStat 自增逻辑）
- **Q4**：搜索引擎爬虫/机器人是否排除？采用 UA 黑名单还是更严格策略？（关联 P2-2）
- **Q5**：网站总览读取方式 —— `SiteStat` 单例 O(1)（推荐） vs 运行时 `sum` 各表（零新增表，但轮询成本高）？
- **Q6**：栏目浏览量是否递归汇总子栏目（Category 无 level 字段，需 CTE/应用层遍历）？默认仅直接栏目？
- **Q7**：历史浏览量是否从 0 起？是否需要回填估算历史（建议从 0 起，避免虚高）？
- **Q8**：两站（.com/.cn）是否各自独立统计、互不串库？（按分站架构默认各自统计，请确认无跨站汇总需求）

---

> 备注：本文档基于 `prisma/schema.prisma`（2025-07-29 实测版本）撰写，所有模型行号与字段均来自真实代码，未做推测。
