import { z } from "zod";

export const SUPPORTED_LANGS = ["zh", "en", "ru", "es", "pt", "ar", "fr", "hi"] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];

export const ContentEngineInputSchema = z.object({
  productId: z.string().optional(),
  brandName: z.string().optional(),
  modelName: z.string().optional(),
  year: z.number().int().optional(),
  category: z.string().optional(),
  enginePower: z.number().int().optional(),
  condition: z.string().optional(),
  workingHours: z.number().int().optional(),
  location: z.string().optional(),
  priceCny: z.number().optional(),
  languages: z.array(z.enum(SUPPORTED_LANGS)).default(["zh", "en"] as SupportedLang[]),
  contentType: z.enum(["product_description", "meta_tags", "category_landing"]).default("product_description"),
});
export type ContentEngineInput = z.infer<typeof ContentEngineInputSchema>;

export interface GeneratedContent {
  lang: string;
  title: string;
  description: string;
  metaDescription: string;
  keywords: string[];
}

export interface ContentEngineResult {
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  contentType: string;
  contents: GeneratedContent[];
  log: string[];
  error?: string;
}

export interface ContentEngineStatus {
  ok: boolean;
  agentName: "content-engine";
  version: string;
  supportedLanguages: readonly SupportedLang[];
  supportedContentTypes: string[];
}
