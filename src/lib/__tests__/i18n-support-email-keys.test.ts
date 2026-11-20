/**
 * 字典键一致性守卫（2026-11-20）。
 *
 * 背景：`i18n-dictionary.ts` 的键是「中文源串」。expo 页有 3 条文案的源串里内嵌了
 * 历史客服邮箱字面量，而组件侧曾经把它们写成 `932133255@qq.com`（另一个历史地址）。
 * 键差一个字符 ⇒ `translate()` 查不到译文 ⇒ 静默回落到中文源串
 * ⇒ **英文/俄语/西语站的付款说明整句漏出中文**，而邮件地址本身又是对的，
 * 所以肉眼扫"邮箱对不对"根本发现不了。
 *
 * 本测试把「组件实际构造出的源串」与「字典里真实存在的键」钉在一起：
 * 谁改坏了 SUPPORT_EMAIL_DICT_KEY，或者谁把字典键改了，这里立刻红。
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { I18N_DICT } from "@/lib/i18n-dictionary";
import { translate } from "@/lib/i18n-runtime";
import { SUPPORT_EMAIL_DICT_KEY, getSupportEmail } from "@/config/support-email";

/** 与两个调用点（SelfBoothLanding.tsx / BrandClaimClient.tsx）逐字节一致的源串构造。 */
const DICT_KEYS = [
  `付款后请将截图发送至 ${SUPPORT_EMAIL_DICT_KEY} 或致电 +86 18633878701 确认`,
  `📌 付款后请将截图发至 ${SUPPORT_EMAIL_DICT_KEY} 或致电 +86 18633878701，24小时内开通自助展台。`,
  `提交后我们将在2个工作日内审核。如需加急，请联系 ${SUPPORT_EMAIL_DICT_KEY} 或致电 +86 18633878701`,
];

const LOCALES = ["zh", "en", "ru", "es", "pt", "ar", "fr", "hi"];

describe("付款说明文案的字典键一致性", () => {
  it("SUPPORT_EMAIL_DICT_KEY 就是字典里内嵌的那个历史字面量", () => {
    expect(SUPPORT_EMAIL_DICT_KEY).toBe("jiusei0319@gmail.com");
  });

  it.each(DICT_KEYS)("字典中存在该键：%s", (key) => {
    expect(I18N_DICT[key]).toBeTruthy();
  });

  it.each(LOCALES)("%s 语客服邮箱已收敛为分站地址，且不残留历史字面量", (locale) => {
    const support = getSupportEmail();
    for (const key of DICT_KEYS) {
      const out = translate(key, locale);
      // 展示给用户的必须是分站客服地址
      expect(out).toContain(support);
      expect(out).not.toContain("jiusei0319@gmail.com");
      expect(out).not.toContain("932133255@qq.com");

      // 非 zh 语必须真的查到了译文：整句中文源串若被原样吐回来，就是"键没命中"。
      // 判定用整句而不是"含任意汉字"——ru 条目里既有混进个别中文（「自」），
      // 那是字典自身的另一个既有问题，不在本守卫的射程内。
      if (locale !== "zh") {
        expect(out).not.toContain("付款后请将截图");
        expect(out).not.toContain("提交后我们将在");
      }
    }
  });
});

describe("调用点不得再写死历史客服字面量", () => {
  const CALL_SITES = [
    "src/app/[locale]/expo/booth/SelfBoothLanding.tsx",
    "src/app/[locale]/expo/brand-claim/BrandClaimClient.tsx",
  ];

  it.each(CALL_SITES)("%s 使用 SUPPORT_EMAIL_DICT_KEY 拼接源串", (rel) => {
    const source = readFileSync(resolve(process.cwd(), rel), "utf8");
    // 硬编码 qq/gmail 是这次「英文站漏中文」的根因，必须挡住回流
    expect(source).not.toContain("932133255@qq.com");
    expect(source).not.toContain("jiusei0319@gmail.com");
    expect(source).toContain("SUPPORT_EMAIL_DICT_KEY");
  });
});
