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
  // 项目 tsconfig 是 `"jsx": "preserve"`（由 Next/SWC 负责注入），esbuild 不认这个值，
  // 会退回 classic 转换（`React.createElement`），于是「组件里带 JSX」的 .tsx 在 vitest
  // 里一被渲染就 `ReferenceError: React is not defined`。这里显式指定 React 18 的
  // automatic runtime，让组件级渲染测试（如首页日报区块的多语种回归）可跑。
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // 排除既有 tsx 脚本测试（其顶层 process.exit 会与 vitest 冲突）与构建产物
    exclude: ["**/node_modules/**", "src/lib/cn-sync/**", "**/.next/**"],
    globals: true,
  },
});
