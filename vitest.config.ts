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
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // 排除既有 tsx 脚本测试（其顶层 process.exit 会与 vitest 冲突）与构建产物
    exclude: ["**/node_modules/**", "src/lib/cn-sync/**", "**/.next/**"],
    globals: true,
  },
});
