"use client";

/**
 * 采集单详情页 —— 外键选择器 + 审核动作（T05 客户端组件）
 *
 * - 品牌▾ / 品类▾：初始值取服务端预解析（preselectedBrandId / preselectedCategoryId）
 * - 命中 `invalid_year` → 显示年份输入框；命中 `no_price` → 折叠显示价格输入框（谨慎填价）
 * - 动作与服务调用完全对齐 `raw-listing-review-table.tsx`（POST /api/admin/raw-listings/${id}）
 * - 成功后 `router.refresh()` 重新拉取服务端数据
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RawListingListItem, ProductBrief } from "@/lib/raw-listing/review";

interface BrandOpt {
  id: string;
  nameZh: string;
  nameEn: string;
}
interface CatOpt {
  id: string;
  nameZh: string;
  nameEn: string;
  parentId: string | null;
}

interface Props {
  id: string;
  item: RawListingListItem;
  product: ProductBrief | null;
  brands: BrandOpt[];
  categories: CatOpt[];
  locale: string;
  preselectedBrandId: string;
  preselectedCategoryId: string;
}

type Action = "approve" | "reject" | "reevaluate" | "publish" | "unpublish";

async function postJson(url: string, body: unknown): Promise<{ success: boolean; data?: any; error?: string; code?: string }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  try {
    return await res.json();
  } catch {
    return { success: false, error: `HTTP ${res.status}` };
  }
}

export function RawListingFkSelect({
  id,
  item,
  product,
  brands,
  categories,
  locale,
  preselectedBrandId,
  preselectedCategoryId,
}: Props) {
  const router = useRouter();
  const [brandSel, setBrandSel] = useState<string>(preselectedBrandId);
  const [catSel, setCatSel] = useState<string>(preselectedCategoryId);
  const [yearInput, setYearInput] = useState<string>(item.year != null ? String(item.year) : "");
  const [priceInput, setPriceInput] = useState<string>(item.priceCny != null ? String(item.priceCny) : "");
  const [busy, setBusy] = useState(false);

  const catLabel = (c: CatOpt) => (c.parentId ? `  ↳ ${c.nameZh}` : c.nameZh);

  async function act(action: Action) {
    setBusy(true);
    try {
      const body: Record<string, unknown> = { action };
      if (action === "approve") {
        if (brandSel) body.brandId = brandSel;
        if (catSel) body.categoryId = catSel;
        const y = Number(yearInput);
        if (yearInput && Number.isInteger(y)) body.year = y;
        const p = Number(priceInput);
        if (priceInput && Number.isFinite(p) && p > 0) body.priceCny = p;
      }
      const data = await postJson(`/api/admin/raw-listings/${id}`, body);
      if (data.success) {
        if (data.data?.status === "needs_review" && data.data?.skippedReason) {
          alert(`未转换（转人工）：${data.data.skippedReason}`);
        }
        router.refresh();
      } else {
        alert(`操作失败：${data.error || "未知错误"}${data.code ? ` (${data.code})` : ""}`);
      }
    } catch {
      alert("网络错误，请重试");
    } finally {
      setBusy(false);
    }
  }

  const status = item.status;
  const canApprove = status === "needs_review" || status === "pending" || status === "approved";
  const showYear = item.reasons.includes("invalid_year");
  const showPrice = item.reasons.includes("no_price");

  return (
    <div className="flex flex-col gap-3">
      {product && (
        <div className="text-xs text-gray-500">
          当前产物状态：<span className="font-medium text-gray-700">{product.status}</span>
          <a href={`/${locale}/admin/products/${product.id}`} className="ml-2 text-primary-600 hover:underline">
            查看产物 →
          </a>
        </div>
      )}

      {canApprove && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <select
              value={brandSel}
              onChange={(e) => setBrandSel(e.target.value)}
              className="rounded border px-2 py-1 text-xs"
            >
              <option value="">品牌▾（不指定）</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nameZh}
                </option>
              ))}
            </select>
            <select
              value={catSel}
              onChange={(e) => setCatSel(e.target.value)}
              className="rounded border px-2 py-1 text-xs"
            >
              <option value="">品类▾（不指定）</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {catLabel(c)}
                </option>
              ))}
            </select>
          </div>

          {showYear && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={yearInput}
                onChange={(e) => setYearInput(e.target.value)}
                inputMode="numeric"
                placeholder="年份 如2015"
                className="w-40 rounded border px-2 py-1 text-xs"
              />
              <span className="text-[11px] text-gray-400">命中 invalid_year，请补全年份</span>
            </div>
          )}

          {showPrice && (
            <details className="rounded border border-amber-300 bg-amber-50 p-2">
              <summary className="cursor-pointer text-xs font-medium text-amber-700">
                补录价格（谨慎填价，有失真风险）
              </summary>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  inputMode="numeric"
                  placeholder="价格 CNY"
                  className="w-40 rounded border px-2 py-1 text-xs"
                />
                <span className="text-[11px] text-amber-700">命中 no_price，填错会导致成交价失真</span>
              </div>
            </details>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              disabled={busy}
              onClick={() => act("approve")}
              className="rounded bg-cyan-600 px-3 py-1 text-xs font-medium text-white hover:bg-cyan-700 disabled:opacity-50"
            >
              通过并转换
            </button>
            <button
              disabled={busy}
              onClick={() => act("reject")}
              className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              拒绝
            </button>
            <button
              disabled={busy}
              onClick={() => act("reevaluate")}
              className="rounded border px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              重新评估
            </button>
          </div>
        </div>
      )}

      {status === "converted" && item.productId != null && (
        <div className="flex flex-wrap gap-2">
          <button
            disabled={busy}
            onClick={() => act("publish")}
            className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            发布
          </button>
          <button
            disabled={busy}
            onClick={() => act("reevaluate")}
            className="rounded border px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            重新评估
          </button>
        </div>
      )}

      {status === "published" && (
        <button
          disabled={busy}
          onClick={() => act("unpublish")}
          className="self-start rounded border px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        >
          下线
        </button>
      )}

      {(status === "auto_rejected" || status === "rejected" || status === "converting") && (
        <button
          disabled={busy}
          onClick={() => act("reevaluate")}
          className="self-start rounded border px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        >
          重新评估
        </button>
      )}
    </div>
  );
}
