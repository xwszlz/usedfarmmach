/**
 * 最小 vitest 配置（QA 验证专用）。
 * 库原本用 tsx 跑零依赖脚本（test:cn-sync）；本配置为「AI 销售策略」模块新增的
 * 单测/集成测引入 vitest，并解析项目既有的 `@/` 路径别名。
 *
 * 运行：npm install && npm test
 */
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: [{ find: /^@\/(.*)$/, replacement: resolve(__dirname, "src") + "/$1" }],
  },
  // 组件源码用的是新版 JSX 转换（tsconfig 里 `jsx: "preserve"`，由 Next/SWC 负责注入），
  // 而 esbuild 默认走 classic runtime，会让 `renderToStaticMarkup` 渲染 .tsx 组件时报
  // `React is not defined`。这里显式切到 automatic runtime，让组件级渲染测试可用。
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // 排除既有 tsx 脚本测试（其顶层 process.exit 会与 vitest 冲突）与构建产物
    exclude: ["**/node_modules/**", "src/lib/cn-sync/**", "**/.next/**"],
    globals: true,
  },
});
