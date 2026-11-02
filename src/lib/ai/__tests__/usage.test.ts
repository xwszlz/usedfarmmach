/**
 * 单测：多次 LLM 调用的 token 用量累加（`src/lib/ai/usage.ts`）
 * ─────────────────────────────────────────────────────────
 * 背景：AI 深度分析一次请求会发起多次 LLM 调用（初稿 + 输出被 `max_tokens` 截断后的
 * 续写轮），每次调用都真实产生 token 费用。若归集点写成**赋值覆盖**而不是**累加**，
 * 前面几轮的 token 会被静默丢掉 ⇒ 平台少扣用户积分（无报错、无告警，只能靠单测钉住）。
 *
 * 覆盖：
 *   ① 从零开始累加一次调用
 *   ② 多轮续写逐轮累加（初稿 + 2 轮续写 = 三次用量之和）
 *   ③ 累加顺序无关（核心不变量：任何顺序都不丢量）
 *   ④ 缺失字段 / null / undefined / 非数值 ⇒ 按 0 处理，不丢已归集部分
 *   ⑤ 纯函数：不修改入参
 *
 * 运行：npx vitest run src/lib/ai/__tests__/usage.test.ts --no-file-parallelism
 */
import { describe, it, expect } from "vitest";

import { accumulateUsage, accumulateUsages, emptyUsage, type LlmTokenUsage } from "@/lib/ai/usage";

/** 构造一份用量（便于用例里一行写完） */
function u(inputTokens: number, outputTokens: number): LlmTokenUsage {
  return { inputTokens, outputTokens };
}

describe("accumulateUsage —— 多次 LLM 调用用量累加", () => {
  it("① 从零用量开始累加一次调用", () => {
    const total = accumulateUsage(emptyUsage(), u(12_000, 8_000));
    expect(total).toEqual({ inputTokens: 12_000, outputTokens: 8_000 });
  });

  it("② 初稿 + 2 轮续写：三次数次用量逐字段相加", () => {
    const draft = u(12_000, 8_000);
    const cont1 = u(20_000, 4_000); // 续写要把已写内容带回上下文，输入更大
    const cont2 = u(28_000, 1_500);

    let total = emptyUsage();
    total = accumulateUsage(total, draft);
    total = accumulateUsage(total, cont1);
    total = accumulateUsage(total, cont2);

    expect(total).toEqual({
      inputTokens: 12_000 + 20_000 + 28_000,
      outputTokens: 8_000 + 4_000 + 1_500,
    });
  });

  it("③ 累加顺序无关（任何顺序都得到同一个总和）", () => {
    const a = u(1_000, 200);
    const b = u(3_000, 400);
    const c = u(5_000, 600);

    const forward = accumulateUsages([a, b, c]);
    const reversed = accumulateUsages([c, b, a]);
    const shuffled = accumulateUsages([b, c, a]);

    expect(forward).toEqual({ inputTokens: 9_000, outputTokens: 1_200 });
    expect(reversed).toEqual(forward);
    expect(shuffled).toEqual(forward);
  });

  it("④ 回归：后一次调用不得覆盖已归集的用量", () => {
    // 覆盖式写法的错误结果 = 只保留最后一次调用；累加式必须大于它。
    const draft = u(12_000, 8_000);
    const cont1 = u(20_000, 4_000);

    let total = accumulateUsage(emptyUsage(), draft);
    total = accumulateUsage(total, cont1);

    expect(total.inputTokens).toBeGreaterThan(cont1.inputTokens);
    expect(total).toEqual({ inputTokens: 32_000, outputTokens: 12_000 });
  });

  it("⑤ 缺失字段 / null / undefined / 非数值 ⇒ 按 0 处理", () => {
    expect(accumulateUsage(u(100, 50), null)).toEqual({ inputTokens: 100, outputTokens: 50 });
    expect(accumulateUsage(u(100, 50), undefined)).toEqual({ inputTokens: 100, outputTokens: 50 });
    expect(accumulateUsage(null, u(100, 50))).toEqual({ inputTokens: 100, outputTokens: 50 });
    expect(accumulateUsage(u(100, 50), {})).toEqual({ inputTokens: 100, outputTokens: 50 });
    // 只有一侧缺字段时，另一侧照常计入
    expect(accumulateUsage(u(100, 50), { outputTokens: 7 })).toEqual({
      inputTokens: 100,
      outputTokens: 57,
    });
    // 非数值 / NaN 不污染结果
    expect(
      accumulateUsage(u(100, 50), {
        inputTokens: Number.NaN,
        outputTokens: undefined as unknown as number,
      })
    ).toEqual({ inputTokens: 100, outputTokens: 50 });
  });

  it("⑥ 纯函数：不修改入参对象", () => {
    const base = u(1_000, 500);
    const delta = u(2_000, 300);
    const snapshotBase = { ...base };

    const total = accumulateUsage(base, delta);

    expect(base).toEqual(snapshotBase);
    expect(delta).toEqual({ inputTokens: 2_000, outputTokens: 300 });
    expect(total).not.toBe(base);
    expect(total).toEqual({ inputTokens: 3_000, outputTokens: 800 });
  });

  it("⑦ 空列表归集为零用量，且不返回共享可变对象", () => {
    const zero = accumulateUsages([]);
    expect(zero).toEqual({ inputTokens: 0, outputTokens: 0 });

    const a = emptyUsage();
    const b = emptyUsage();
    expect(a).not.toBe(b);
  });
});
