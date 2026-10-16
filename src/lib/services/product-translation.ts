/**
 * Auto product translation service (8-locale).
 *
 * When a product is published/updated we translate the source (zh) title and
 * description into the other 7 locales via Doubao (Volcengine Ark). Uses the
 * shared `chatCompletionDoubao` client so the Ark API key is read from env
 * internally (no process.exit at load time). Scoped to graceful degradation:
 * this module NEVER throws out of the publish path.
 *
 * Storage: a `translationMeta` Json column on Product holds per-locale
 * translated values + human-override flags. We also back-fill the existing
 * per-locale `description{Xx}` columns so the product detail page (which reads
 * them directly) shows the translations with no UI change.
 *
 * Human override: if `translationMeta.overrides[locale][field]` is true, the
 * stored value is preserved and never overwritten by auto-translation.
 *
 * NOTE: requires `prisma db push` after merge to create the Json column. Do NOT
 * run `prisma migrate` for this additive column.
 */
import { prisma } from "@/lib/db";
import { chatCompletionDoubao, getArkModelId } from "@/lib/ai/ark-client";
import { RT_LOCALES, type RtLocale } from "@/lib/i18n-types";
import type { Prisma } from "@prisma/client";

const SOURCE_LOCALE: RtLocale = "zh";
const TARGET_LOCALES: RtLocale[] = RT_LOCALES.filter((l) => l !== SOURCE_LOCALE);

// Language names for the translation prompt (mirror i18n-translate-core.cjs).
const LANG_NAME: Record<string, string> = {
  en: "English",
  ru: "Russian",
  es: "Spanish",
  pt: "Portuguese",
  ar: "Arabic",
  fr: "French",
  hi: "Hindi",
};

// Brand names that must stay untranslated (mirror i18n-translate-core.cjs).
const BRANDS = "神雕农机, CLAAS, John Deere, New Holland, Fendt, Agriaffaires, usedfarmmach";

export type ProductTranslationField = "title" | "description";

export interface ProductTranslationMeta {
  version: 1;
  sourceLocale: "zh";
  updatedAt: string;
  values: Partial<Record<RtLocale, Partial<Record<ProductTranslationField, string>>>>;
  overrides: Partial<Record<RtLocale, Partial<Record<ProductTranslationField, boolean>>>>;
}

/** Minimal product shape needed for translation (read fresh from DB). */
type TranslateSource = {
  modelName: string;
  descriptionZh: string | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// 豆包（火山方舟 ARK，数据不出境）翻译调用 —— 复用全站统一 AI 出口
// ─────────────────────────────────────────────────────────────────────────────

async function callOnce(
  sources: string[],
  srcLang: string,
  tgtLang: string
): Promise<string[]> {
  const n = sources.length;
  const sys =
    `You are a professional translator for an agricultural machinery trading platform (used farm equipment, cross-border trade). ` +
    `Translate each of the ${n} strings from ${srcLang} to ${tgtLang}. ` +
    `Return a JSON array of exactly ${n} strings, in the same order. ` +
    `Rules: 1) Output ONLY the JSON array, no markdown code fences, no commentary, no numbering. ` +
    `2) Preserve ALL placeholders EXACTLY: {count}, {price}, {name}, {{var}}, %s, \\n, and HTML tags like <b></b> <a></a> must remain unchanged. ` +
    `3) Keep brand names unchanged: ${BRANDS}. ` +
    `4) For RTL target languages (Arabic) output natural RTL text. ` +
    `5) UI text must be concise and natural in the target language.`;
  const user = JSON.stringify(sources);

  const res = await chatCompletionDoubao({
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
    model: getArkModelId(),
    maxTokens: 4000,
    timeoutMs: 60000,
  });

  let txt = res.text?.trim() || "";
  // Strip possible ```json fences.
  txt = txt.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  let arr: unknown;
  try {
    arr = JSON.parse(txt);
  } catch {
    arr = null;
  }
  if (!Array.isArray(arr) || arr.length !== n) {
    throw new Error(`PARSE_FAIL len=${arr ? (arr as unknown[]).length : "null"} expected=${n}`);
  }
  return (arr as unknown[]).map((s) => (typeof s === "string" ? s : String(s)));
}

async function translateBatchDoubao(
  sources: string[],
  srcLang: string,
  tgtLang: string
): Promise<string[]> {
  let lastErr: unknown;
  // 3 attempts with backoff for 429 / 5xx / parse failures.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await callOnce(sources, srcLang, tgtLang);
    } catch (e) {
      lastErr = e;
      const status = (e as { status?: number }).status;
      const backoff = Math.min(8000, 500 * 2 ** attempt) + Math.random() * 300;
      if (status === 429 || (typeof status === "number" && status >= 500)) {
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
      if (String((e as Error)?.message ?? "").startsWith("PARSE_FAIL")) {
        await new Promise((r) => setTimeout(r, 400));
        continue;
      }
      throw e;
    }
  }
  // Batch failed 3x → per-item fallback (degrade to source on persistent error).
  const out: string[] = [];
  for (const s of sources) {
    for (let a = 0; a < 3; a++) {
      try {
        const r = await callOnce([s], srcLang, tgtLang);
        out.push(r[0]);
        break;
      } catch (e) {
        lastErr = e;
        if (a === 2) out.push(s);
        else await new Promise((r) => setTimeout(r, 500));
      }
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Meta helpers
// ─────────────────────────────────────────────────────────────────────────────

function emptyMeta(): ProductTranslationMeta {
  return {
    version: 1,
    sourceLocale: "zh",
    updatedAt: new Date().toISOString(),
    values: {},
    overrides: {},
  };
}

function parseMeta(raw: unknown): ProductTranslationMeta | null {
  if (!raw) return null;
  try {
    const m = (typeof raw === "string" ? JSON.parse(raw) : raw) as ProductTranslationMeta;
    if (m && typeof m === "object" && m.version === 1) return m;
  } catch {
    /* ignore malformed meta */
  }
  return null;
}

function sourceValue(product: TranslateSource, field: ProductTranslationField): string {
  return field === "title" ? product.modelName || "" : product.descriptionZh || "";
}

// ─────────────────────────────────────────────────────────────────────────────
// Core: compute updated translation meta (pure, async, never throws)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the new translation meta for a product.
 *
 * - If the Doubao call fails (missing key / network / parse) → the per-locale
 *   catch keeps previous values; never throw.
 * - Per locale (parallelized): translate the non-overridden, non-empty fields.
 * - On any per-locale failure → keep previous values, log, continue.
 */
export async function translateProductFields(
  product: TranslateSource,
  existingMeta: ProductTranslationMeta | null
): Promise<ProductTranslationMeta> {
  const meta: ProductTranslationMeta = existingMeta
    ? {
        ...existingMeta,
        values: { ...(existingMeta.values ?? {}) },
        overrides: { ...(existingMeta.overrides ?? {}) },
        updatedAt: new Date().toISOString(),
      }
    : emptyMeta();
  if (!meta.values) meta.values = {};
  if (!meta.overrides) meta.overrides = {};

  const fields: ProductTranslationField[] = ["title", "description"];

  await Promise.all(
    TARGET_LOCALES.map(async (locale) => {
      const tgtLang = LANG_NAME[locale];
      const pending = fields.filter(
        (f) => !meta.overrides?.[locale]?.[f] && sourceValue(product, f)
      );
      if (pending.length === 0) return;

      const sources = pending.map((f) => sourceValue(product, f));
      try {
        const trs = await translateBatchDoubao(sources, "Chinese", tgtLang);
        if (!meta.values[locale]) meta.values[locale] = {};
        pending.forEach((f, i) => {
          if (meta.values[locale]) meta.values[locale]![f] = trs[i];
        });
      } catch (e) {
        // Graceful degradation: keep previous value for this locale, never throw.
        console.error(
          `[product-translation] 翻译 ${locale} 失败（降级保留既有值）:`,
          e instanceof Error ? e.message : String(e)
        );
        if (!meta.values[locale]) meta.values[locale] = {};
      }
    })
  );

  return meta;
}

// ─────────────────────────────────────────────────────────────────────────────
// Publish hook: persist meta + back-fill description columns. NEVER throws.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook to call after a product is created/updated. Loads the product, runs
 * translation, then persists the meta into the `translationMeta` Json column and
 * back-fills the per-locale `description{Xx}` columns so the site displays them.
 *
 * Fail-closed by design: any error (missing key, network, parse, DB) is logged
 * and swallowed — the product publish is never affected.
 */
export async function translateProductOnPublish(productId: string): Promise<void> {
  try {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return;

    const existingMeta = parseMeta((product as { translationMeta?: unknown }).translationMeta);
    const newMeta = await translateProductFields(product, existingMeta);

    const updateData: Prisma.ProductUpdateInput = {
      // Cast via unknown: ProductTranslationMeta lacks an index signature so it
      // is not directly assignable to Prisma's stricter InputJsonValue.
      translationMeta: newMeta as unknown as Prisma.InputJsonValue,
    };
    // Back-fill per-locale description columns for site display (no UI change).
    for (const locale of TARGET_LOCALES) {
      const val = newMeta.values?.[locale]?.description;
      if (val) {
        const col = `description${locale.charAt(0).toUpperCase()}${locale.slice(1)}`;
        (updateData as Record<string, unknown>)[col] = val;
      }
    }

    await prisma.product.update({ where: { id: productId }, data: updateData });
  } catch (e) {
    console.error(
      "[product-translation] 自动翻译异常（非阻塞，发布不受影响）:",
      e instanceof Error ? e.message : String(e)
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Reader: resolve a translated field for a locale (override → auto → column → source)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve the best available translation of a product field for a locale.
 * Falls back to the source (zh) value so the UI is never blank.
 */
export function getProductTranslation(
  product: TranslateSource & { translationMeta?: unknown },
  field: ProductTranslationField,
  locale: string
): string {
  const loc = (locale || "zh") as RtLocale;
  const src = sourceValue(product, field);
  if (loc === "zh" || loc === SOURCE_LOCALE) return src;

  const meta = parseMeta(product.translationMeta);
  const override = meta?.values?.[loc]?.[field];
  if (override) return override;

  if (field === "description") {
    const col = `description${loc.charAt(0).toUpperCase()}${loc.slice(1)}`;
    const colVal = (product as Record<string, unknown>)[col];
    if (typeof colVal === "string" && colVal) return colVal;
  }
  return src;
}
