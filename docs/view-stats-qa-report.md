# 测试报告：网站浏览量统计与标注显示（product_view_stats）

> QA 工程师：严过关（software-qa-engineer）
> 测试文件：`scripts/qa-view-stats.ts`（复用项目既有 `tsx` 轻量断言模式，零新依赖）
> 运行命令：`npx tsx scripts/qa-view-stats.ts`
> 日期：2025-07-31

## 一、Summary

- **总断言数**：122 ｜ **通过**：122 ｜ **失败**：0
- **覆盖率（估算）**：核心后端逻辑（track API、看板 API、迁移脚本、前端 trackView、扩展点）已实现关键路径全覆盖；前端 React 组件（ProductViewBadge 等"挂载即 track"）因需 React 渲染环境，采用 `trackView` 工具契约测试 + 源码挂载逻辑确认，未做组件渲染断言（非强制项）。
- **路由决策（Smart Routing）**：**NoOne** —— 全部通过，未发现源码 Bug。
- **轮次**：第 1 轮即全绿（过程中仅修复了 QA 脚本自身的 1 处正则误判 + 迁移 mock 注入方式，均属测试代码自修，不涉及源码）。无需进入第 2 轮。

## 二、测试覆盖点（A–K）

| 区块 | 覆盖内容 | 关键断言 |
|---|---|---|
| **A. track-guard** | `shouldSkipTracking` 恒返回 false（P2 扩展点） | 返回 false |
| **B. track 四类 scope** | product/category/video/fieldVideo 各自 `prisma.x.update({ data:{field:{increment:1}}, select:{field:true} })` 并返回最新 count | update.where.id、increment=1、select、返回 count、siteStat.upsert where.id='global' |
| **C. SiteStat 幂等** | 首建：create 段 `total*=1`；后续：upsert 仍带初始值 1 + update 段 `{increment:1}` | create.totalPageViews=1 / update.totalPageViews.increment=1 |
| **D. 错误分支** | 非法 scope→400；id 缺失→400；id 空串→400；非法 JSON→400；id 不存在(P2025)→404；其他异常→500 | 状态码 + success=false |
| **E. 视频不计入 PV** | video / fieldVideo 仅增 `totalVideoPlays`，**不增** `totalPageViews`/`totalProductViews`/`totalCategoryViews` | update 含 totalVideoPlays、不含 totalPageViews |
| **F. 看板鉴权** | 无 token→401；token 无效→401；buyer 角色→403 | 401 / 403 |
| **G. 看板全站视角** | 总览 O(1) 读取；栏目排行 Top10 降序 + 占比；视频合并排行降序 + 类型标记；`?type=all/product/field` 过滤 | overview 值、ratio(拖拉机 75.0% / 收割机 25.0%)、orderBy desc + take 10、type 过滤下 findMany 调用判定 |
| **H. 看板卖家视角** | scope='mine'；栏目按 `product.sellerId` 聚合；视频按 `product.sellerId` / `fieldVideo.booth.merchantId` 过滤 | scope=mine、聚合 viewCount=8/ratio=100、where 过滤参数正确 |
| **I. 前端 trackView** | mock fetch：成功返回 count；404→null；网络异常→null（UI 不崩） | 返回值契约 |
| **J. 迁移脚本** | mock OSS fetch(db.json) + mock PrismaClient：按 url 去重 upsert FieldVideo(source='qr', playCount=0)；跨次幂等（预置 url 不重复插入）；SiteStat upsert(id='global')；**跳过 ShowcaseItem 模型**（源码 `prisma.showcaseItem`/`showcaseItem.find*` 查询不存在） | 新建 2 条、跳过 2 条、source='qr'、playCount=0、id='global'；源码 5 项约束断言 |
| **K. 路由缓存约束** | track 路由 `dynamic="force-dynamic"` + `revalidate=0`；看板路由 `force-dynamic` | export 值正确 |

> 迁移脚本为**真实执行**验证：脚本自身日志显示「新建 FieldVideo 2 条，跳过（已存在/重复）2 条」，证明去重与跨次幂等逻辑在源码中确实生效（非复刻算法）。

## 三、Failed Tests

无。

## 四、已知问题 / 遗留项

无。源码（工程师：寇豆码）在已验证的关键路径上表现正确，未发现需返工修复的缺陷。

## 五、测试策略说明（数据库 mock 方式）

- **不连接真实数据库**：track / 看板 / 迁移均依赖 Prisma，但测试环境未配 DB，故全程 mock。
- **路由/查询层**：在 import 业务模块之前将可控 fake prisma 注入 `globalThis.prisma`（`src/lib/db.ts` 启动逻辑 `globalThis.prisma ?? new PrismaClient()` 会捕获该对象），业务代码的 `prisma.x` 调用即落到 fake，断言 `increment` 参数与返回逻辑。
- **迁移脚本层**：通过 `createRequire(import.meta.url)` 拿到 `@prisma/client` 真实 CJS `module.exports` 并替换 `PrismaClient` 为 Fake（ESM 命名空间对 CJS 导出为实时 getter，故脚本 `import { PrismaClient }` 拿到 Fake），同时 mock 全局 `fetch` 返回 OSS `db.json`，实现真实执行 + 零真实 DB 连接。
- **前端 badge（可选）**：未做 React 渲染，改以 `trackView` 契约测试 + 源码确认挂载即调用覆盖。

## 六、交付物

- 测试脚本：`D:\神雕农机\usedfarmmach\scripts\qa-view-stats.ts`
- 本报告：`D:\神雕农机\usedfarmmach\docs\view-stats-qa-report.md`
- 未执行任何 git 操作。
