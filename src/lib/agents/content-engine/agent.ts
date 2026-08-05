import { prisma } from "@/lib/db";
import type { ContentEngineInput, ContentEngineResult, ContentEngineStatus, GeneratedContent } from "./types";
import { SUPPORTED_LANGS, type SupportedLang } from "./types";

export const AGENT_NAME = "content-engine";
export const AGENT_VERSION = "0.1.0";

// Template strings per language
const LANG_META: Record<SupportedLang, { name: string; currency: string; market: string }> = {
  zh: { name: "中文", currency: "人民币", market: "中国" },
  en: { name: "English", currency: "CNY", market: "global" },
  ru: { name: "Русский", currency: "CNY", market: "СНГ" },
  es: { name: "Espanol", currency: "CNY", market: "Latam" },
  pt: { name: "Portugues", currency: "CNY", market: "Brasil/Angola" },
  ar: { name: "العربية", currency: "CNY", market: "MENA" },
  fr: { name: "Francais", currency: "CNY", market: "Afrique" },
  hi: { name: "हिन्दी", currency: "CNY", market: "India" },
};

function generateProductDescription(input: ContentEngineInput, lang: SupportedLang): GeneratedContent {
  const meta = LANG_META[lang];
  const brand = input.brandName || "知名品牌";
  const model = input.modelName || "";
  const year = input.year || "";
  const power = input.enginePower ? `${input.enginePower}HP` : "";
  const hours = input.workingHours ? `${input.workingHours}h` : "";
  const cond = input.condition || "good";
  const price = input.priceCny ? `¥${input.priceCny.toLocaleString()}` : "";
  const loc = input.location || "";

  const title = `${brand} ${model} ${year} ${power}`.trim().replace(/\s+/g, " ");

  let description: string;
  switch (lang) {
    case "zh":
      description = `${brand} ${model} ${year ? `(${year}年)` : ""}二手农机出售。`;
      if (power) description += `额定功率${power}，`;
      if (hours) description += `工作时长${hours}，`;
      description += `车况${cond === "excellent" ? "优秀" : cond === "good" ? "良好" : "一般"}。`;
      if (price) description += `售价${price}。`;
      if (loc) description += `所在地：${loc}。`;
      description += `支持在线询价、线下看货。神雕农机平台提供出口合规咨询、国际物流、多语客服等一站式服务。`;
      break;
    case "en":
      description = `Used ${brand} ${model} ${year ? `from ${year}` : ""} for sale. `;
      if (power) description += `Engine: ${power}. `;
      if (hours) description += `Working hours: ${hours}. `;
      description += `Condition: ${cond}. `;
      if (price) description += `Price: ${price}. `;
      if (loc) description += `Location: ${loc}, China. `;
      description += `Supports online inquiry and on-site inspection. Shendiao Agricultural Machinery provides export compliance, international logistics, and multilingual service.`;
      break;
    case "ru":
      description = `Б/у ${brand} ${model} ${year ? `${year} года` : ""} продается. `;
      if (power) description += `Мощность: ${power}. `;
      if (hours) description += `Наработка: ${hours}. `;
      description += `Состояние: ${cond}. `;
      if (price) description += `Цена: ${price}. `;
      description += `Поддержка онлайн-запроса и осмотра на месте.`;
      break;
    default:
      // For es/pt/ar/fr/hi — use English base with locale note
      description = `[${meta.name}] Used ${brand} ${model} ${year ? `(${year})` : ""} for sale. `;
      if (power) description += `${power}. `;
      if (hours) description += `${hours}. `;
      description += `Condition: ${cond}. `;
      if (price) description += `${price}. `;
      description += `Online inquiry & on-site inspection supported.`;
  }

  const metaDescription = description.slice(0, 155);
  const keywords = [brand, model, year ? String(year) : "", "used", "tractor", "farm machinery", "agriculture", "China"].filter(Boolean);

  return { lang, title, description, metaDescription, keywords };
}

function generateMetaTags(input: ContentEngineInput, lang: SupportedLang): GeneratedContent {
  const desc = generateProductDescription(input, lang);
  return {
    lang,
    title: `${desc.title} | Shendiao Agricultural Machinery`,
    description: `<meta name="description" content="${desc.metaDescription}">\n<meta name="keywords" content="${desc.keywords.join(", ")}">\n<meta property="og:title" content="${desc.title}">\n<meta property="og:description" content="${desc.metaDescription}">`,
    metaDescription: desc.metaDescription,
    keywords: desc.keywords,
  };
}

function generateCategoryLanding(input: ContentEngineInput, lang: SupportedLang): GeneratedContent {
  const cat = input.category || "agricultural machinery";
  const meta = LANG_META[lang];
  const title = lang === "zh" ? `${cat} - 二手农机出口 | 神雕农机` : `Used ${cat} for Sale | Shendiao`;
  const description = lang === "zh"
    ? `神雕农机提供${cat}二手农机出口服务，覆盖${meta.market}市场。支持在线询价、AI估值、出口合规咨询。8语客服，全球配送。`
    : `Shendiao Agricultural Machinery offers used ${cat} for export to ${meta.market} markets. Online inquiry, AI valuation, export compliance consultation. 8-language service, global shipping.`;
  return { lang, title, description, metaDescription: description.slice(0, 155), keywords: [cat, "used", "export", "China", "farm machinery"] };
}

export class ContentEngineAgent {
  private logs: string[] = [];
  private log(msg: string) { this.logs.push(`[${new Date().toISOString()}] ${msg}`); console.log(this.logs[this.logs.length-1]); }

  async run(input: ContentEngineInput): Promise<ContentEngineResult> {
    const startedAt = new Date();
    this.logs = [];
    this.log(`Agent #5 content-engine@${AGENT_VERSION} started`);

    // If productId provided, pull from DB
    if (input.productId) {
      try {
        const product = await prisma.product.findUnique({
          where: { id: input.productId },
          include: { brand: true, category: true },
        });
        if (product) {
          input.brandName = input.brandName || product.brand?.nameZh || product.brand?.nameEn;
          input.modelName = input.modelName || product.modelName;
          input.year = input.year || product.year;
          input.enginePower = input.enginePower || product.enginePower || undefined;
          input.condition = input.condition || product.condition;
          input.workingHours = input.workingHours || product.workingHours || undefined;
          input.location = input.location || product.location;
          input.priceCny = input.priceCny || product.priceCny;
          input.category = input.category || product.category?.nameZh;
          this.log(`Loaded product: ${input.brandName} ${input.modelName}`);
        }
      } catch (e) {
        this.log(`Product load failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    const langs = input.languages as SupportedLang[];
    const contents: GeneratedContent[] = [];

    for (const lang of langs) {
      let content: GeneratedContent;
      switch (input.contentType) {
        case "meta_tags":
          content = generateMetaTags(input, lang);
          break;
        case "category_landing":
          content = generateCategoryLanding(input, lang);
          break;
        default:
          content = generateProductDescription(input, lang);
      }
      contents.push(content);
      this.log(`Generated ${lang}: ${content.title.slice(0, 40)}...`);
    }

    const finishedAt = new Date();
    return {
      ok: true, startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      contentType: input.contentType, contents, log: this.logs,
    };
  }

  async getStatus(): Promise<ContentEngineStatus> {
    return {
      ok: true, agentName: AGENT_NAME, version: AGENT_VERSION,
      supportedLanguages: SUPPORTED_LANGS,
      supportedContentTypes: ["product_description", "meta_tags", "category_landing"],
    };
  }
}

export const contentEngineAgent = new ContentEngineAgent();
