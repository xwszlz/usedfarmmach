/**
 * AI 深度分析的**共享限额常量**。
 *
 * ⚠️ 本文件被 `"use client"` 组件（`src/components/product/deep-analysis-card.tsx`）
 * 与服务端 Route Handler（`src/app/api/agents/seller-helper/deep-analysis/route.ts`）
 * **同时** import，因此有两条硬约束，改动前务必确认：
 *
 *   1. **零运行时依赖**：不许 import 任何 `node:*` 内置模块（`node:crypto` / `node:fs` …），
 *      也不许 import `next/server`、`@prisma/client`、`server-only` 之类只在服务端可用的包。
 *      客户端 bundle 一旦链路到 `node:` 内置模块，`next build` 会直接失败；
 *      而 `tsc` / `vitest` 都拦不住（只有真跑 `next build` 才暴露）。
 *   2. **只放常量，不放函数**：函数会带来运行时求值与 tree-shaking 行为的不确定性，
 *      而这里只需要一个「前后端必须一致的数字」。要加逻辑请放到别的模块。
 *
 * 存在的意义：这个数字曾经前后端各写一份（前端截取、服务端夹取），
 * 改一处忘一处就会出现「前端只送 8 张、服务端按 3 张夹」这类静默不一致。
 */

/**
 * 单次深度分析最多送进模型的图片张数。
 *
 * 老板 2026-10-29 拍板：**3 → 8**。
 * 放开张数的前提（缺一不可，否则会吃穿总预算）：
 *   ① 图片必须**并行下载**（`buildDoubaoContent` 内部 `Promise.allSettled`）——
 *      串行 8 × 20s = 160s 足够把 `DEEP_ANALYSIS_TOTAL_BUDGET_MS` 吃穿；
 *   ② 下载阶段整体受 `DEEP_ANALYSIS_DOWNLOAD_BUDGET_MS`(45s) 封顶。
 * 实测（600px 商品图，8 图并行下载）：下载阶段 348–358ms；
 * 8 图 → prompt 11,309 tokens / 输出 8,366 tokens / 墙钟 264.1s。
 *
 * 用法：
 *   - 前端 `deep-analysis-card.tsx`：`imageUrls.slice(0, MAX_DEEP_ANALYSIS_IMAGES)`（第一道截取）；
 *   - 服务端 `deep-analysis/route.ts`：由本常量派生 `DEEP_ANALYSIS_MAX_IMAGES` 再夹一次
 *     （接口登录即可调，不能只信前端）。
 */
export const MAX_DEEP_ANALYSIS_IMAGES = 8;
