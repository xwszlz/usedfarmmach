import type { Metadata } from "next";
import { listPublicSourced, getSourcedSourceList, type SourcedListResult } from "@/lib/raw-listing/publish";
import { SITE } from "@/config/site";
import OverseasClient from "./OverseasClient";

export const dynamic = "force-dynamic";

/**
 * /{locale}/overseas —— 去交易化只读「海外车源 / 急需车源」栏目
 *
 * SEO：整栏 noindex,follow（与 /products 的 JSON-LD Product 结构彻底隔离）。
 * 数据：服务端 SSR 直读 RawListing(isPublic=true)，与客户端筛选 refetch 共用 /api/sourced-listings。
 */
export const metadata: Metadata = {
  title: "海外车源 · 国际在售参考 · 神雕农机",
  description:
    "第三方平台在售农机挂牌（去交易化只读展示，非本平台库存），含客户急需车型，供行情对标与采购线索。",
  robots: { index: false, follow: true },
};

export default async function OverseasPage() {
  let initialData: (SourcedListResult & { sources: string[] }) | null = null;
  try {
    const data = await listPublicSourced({ site: SITE, pageSize: 30 });
    const sources = (await getSourcedSourceList(SITE)).slice(0, 50);
    initialData = { ...data, sources };
  } catch {
    initialData = null;
  }

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <OverseasClient initialData={initialData} />
        </div>
      </div>
    </main>
  );
}
