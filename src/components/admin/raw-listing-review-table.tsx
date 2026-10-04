"use client";

/**
 * 采集审核表格（T04 客户端组件）
 *
 * - 行勾选 + 批量工具条（批量通过/拒绝/发布/下线 + 同型号批量套用）
 * - 行内品牌▾ / 品类▾ 下拉 → 「通过并转换」（人工补齐外键，走同一 API）
 * - converted 行显示「发布」，published 行显示「下线」
 * - `reasons[]` 直接来自服务端（不前端解析 notes）
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RawListingListItem } from "@/lib/raw-listing/review";

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
  items: RawListingListItem[];
  brands: BrandOpt[];
  categories: CatOpt[];
  locale: string;
}

type Action = "approve" | "reject" | "reevaluate" | "publish" | "unpublish";

const STATUS_STYLE: Record<string, string> = {
  needs_review: "bg-amber-100 text-amber-700",
  auto_rejected: "bg-red-100 text-red-700",
  approved: "bg-cyan-100 text-cyan-700",
  converted: "bg-blue-100 text-blue-700",
  published: "bg-green-100 text-green-700",
  converting: "bg-gray-200 text-gray-600",
  rejected: "bg-red-100 text-red-700",
  pending: "bg-gray-100 text-gray-600",
};

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

export function RawListingReviewTable({ items, brands, categories, locale }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [brandSel, setBrandSel] = useState<Record<string, string>>({});
  const [catSel, setCatSel] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [batchBrand, setBatchBrand] = useState("");
  const [batchCat, setBatchCat] = useState("");
  const [modelName, setModelName] = useState("");
  const [yearInput, setYearInput] = useState<Record<string, string>>({});
  const [priceInput, setPriceInput] = useState<Record<string, string>>({});

  const allChecked = items.length > 0 && selected.size === items.length;
  const toggleAll = () => {
    setSelected(allChecked ? new Set() : new Set(items.map((i) => i.id)));
  };
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  async function singleAct(id: string, action: Action) {
    setBusy(true);
    try {
      const body: Record<string, unknown> = { action };
      if (action === "approve") {
        if (brandSel[id]) body.brandId = brandSel[id];
        if (catSel[id]) body.categoryId = catSel[id];
        const y = Number(yearInput[id]);
        if (yearInput[id] && Number.isInteger(y)) body.year = y;
        const p = Number(priceInput[id]);
        if (priceInput[id] && Number.isFinite(p) && p > 0) body.priceCny = p;
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

  async function batchAct(action: Action) {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      const body: Record<string, unknown> = { action, mode: "ids", ids: Array.from(selected) };
      if (action === "approve") {
        const overrides: Record<string, string> = {};
        if (batchBrand) overrides.brandId = batchBrand;
        if (batchCat) overrides.categoryId = batchCat;
        if (Object.keys(overrides).length) body.overrides = overrides;
      }
      const data = await postJson("/api/admin/raw-listings", body);
      if (data.success) {
        const s = data.data?.summary;
        alert(`批量完成：成功 ${s?.ok ?? 0} / 转换 ${s?.converted ?? 0} / 跳过 ${s?.skipped ?? 0} / 失败 ${s?.failed ?? 0}`);
        setSelected(new Set());
        router.refresh();
      } else {
        alert(`批量失败：${data.error || "未知错误"}${data.code ? ` (${data.code})` : ""}`);
      }
    } catch {
      alert("网络错误，请重试");
    } finally {
      setBusy(false);
    }
  }

  async function batchByModel() {
    const model = modelName.trim();
    if (!model) {
      alert("请先填写要套用的型号（精确匹配）");
      return;
    }
    if (!batchBrand && !batchCat) {
      alert("同型号批量套用至少需要选择品牌或品类");
      return;
    }
    setBusy(true);
    try {
      const overrides: Record<string, string> = {};
      if (batchBrand) overrides.brandId = batchBrand;
      if (batchCat) overrides.categoryId = batchCat;
      const data = await postJson("/api/admin/raw-listings", {
        action: "approve",
        mode: "by_model",
        modelName: model,
        overrides,
        limit: 200,
      });
      if (data.success) {
        const s = data.data?.summary;
        alert(`同型号「${model}」批量完成：成功 ${s?.ok ?? 0} / 转换 ${s?.converted ?? 0} / 跳过 ${s?.skipped ?? 0} / 失败 ${s?.failed ?? 0}`);
        setSelected(new Set());
        router.refresh();
      } else {
        alert(`批量失败：${data.error || "未知错误"}${data.code ? ` (${data.code})` : ""}`);
      }
    } catch {
      alert("网络错误，请重试");
    } finally {
      setBusy(false);
    }
  }

  const brandOptions = brands;
  const catLabel = (c: CatOpt) => (c.parentId ? `  ↳ ${c.nameZh}` : c.nameZh);
  // 行内品牌下拉预选：按归一/原始名称在 brands 里匹配第一条（纯客户端，不改 API）
  const matchBrandId = (it: RawListingListItem): string => {
    const hit = brands.find(
      (b) =>
        b.nameZh === it.brandNormalized ||
        b.nameEn === it.brandNormalized ||
        b.nameZh === it.brandName ||
        b.nameEn === it.brandName
    );
    return hit ? hit.id : "";
  };

  return (
    <div className="rounded-xl border bg-white shadow-sm">
      {/* 批量工具条 */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b bg-amber-50 px-4 py-3">
          <span className="text-sm font-medium text-gray-700">已选 {selected.size} 条</span>
          <select value={batchBrand} onChange={(e) => setBatchBrand(e.target.value)} className="rounded border px-2 py-1 text-xs">
            <option value="">品牌(不指定)</option>
            {brandOptions.map((b) => (
              <option key={b.id} value={b.id}>{b.nameZh}</option>
            ))}
          </select>
          <select value={batchCat} onChange={(e) => setBatchCat(e.target.value)} className="rounded border px-2 py-1 text-xs">
            <option value="">品类(不指定)</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.nameZh}</option>
            ))}
          </select>
          <button disabled={busy} onClick={() => batchAct("approve")} className="rounded bg-cyan-600 px-3 py-1 text-xs font-medium text-white hover:bg-cyan-700 disabled:opacity-50">
            批量通过并转换
          </button>
          <button disabled={busy} onClick={() => batchAct("reject")} className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50">
            批量拒绝
          </button>
          <button disabled={busy} onClick={() => batchAct("publish")} className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50">
            批量发布
          </button>
          <button disabled={busy} onClick={() => batchAct("unpublish")} className="rounded border px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50">
            批量下线
          </button>
          <span className="mx-1 h-5 w-px bg-gray-300" />
          <input
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            placeholder="同型号精确匹配..."
            className="w-40 rounded border px-2 py-1 text-xs"
          />
          <button disabled={busy} onClick={batchByModel} className="rounded bg-primary-600 px-3 py-1 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50">
            同型号批量套用
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-xs text-gray-500">
              <th className="px-3 py-3">
                <input type="checkbox" checked={allChecked} onChange={toggleAll} />
              </th>
              <th className="px-3 py-3 font-medium">状态</th>
              <th className="px-3 py-3 font-medium">来源</th>
              <th className="px-3 py-3 font-medium">品牌</th>
              <th className="px-3 py-3 font-medium">型号</th>
              <th className="px-3 py-3 font-medium">年份/小时</th>
              <th className="px-3 py-3 font-medium">价格(CNY)</th>
              <th className="px-3 py-3 font-medium">位置</th>
              <th className="px-3 py-3 font-medium">命中规则</th>
              <th className="px-3 py-3 font-medium">产物</th>
              <th className="px-3 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const badge = STATUS_STYLE[it.status] || "bg-gray-100 text-gray-600";
              const priceOut = it.effectivePriceCny != null && (it.effectivePriceCny < 3000 || it.effectivePriceCny > 20000000);
              const priceOutlier = it.reasons.includes("price_outlier");
              return (
                <tr key={it.id} className="border-b align-top last:border-0 hover:bg-gray-50">
                  <td className="px-3 py-2.5">
                    <input type="checkbox" checked={selected.has(it.id)} onChange={() => toggleOne(it.id)} />
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${badge}`}>{it.status}</span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-500">
                    <div>{it.source}</div>
                    {it.sourceUrl ? (
                      /^https?:\/\//i.test(it.sourceUrl) ? (
                        <a href={it.sourceUrl} target="_blank" rel="noreferrer" className="text-primary-600 hover:underline" title={it.sourceUrl}>
                          {it.sourceUrl.length > 28 ? it.sourceUrl.slice(0, 28) + "…" : it.sourceUrl}
                        </a>
                      ) : (
                        <span className="text-gray-400" title={it.sourceUrl}>
                          {it.sourceUrl.length > 28 ? it.sourceUrl.slice(0, 28) + "…" : it.sourceUrl}
                        </span>
                      )
                    ) : (
                      <span className="text-gray-400">(无链接)</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-gray-700">
                    {it.brandName}
                    {it.brandNormalized && it.brandNormalized !== it.brandName && (
                      <span className="text-xs text-gray-400"> → {it.brandNormalized}</span>
                    )}
                  </td>
                  <td className="max-w-[220px] truncate px-3 py-2.5 font-medium text-gray-900" title={it.modelName}>
                    {it.modelName}
                  </td>
                  <td className="px-3 py-2.5 text-gray-600">
                    {it.year ?? "-"} / {it.workingHours ?? "-"}
                  </td>
                  <td className={`px-3 py-2.5 font-medium ${priceOut ? "text-red-600" : priceOutlier ? "text-amber-600" : "text-gray-900"}`}>
                    {it.priceCny != null ? (
                      `¥${Math.round(it.priceCny).toLocaleString()}`
                    ) : it.effectivePriceCny != null ? (
                      <span className="text-gray-400">≈¥{Math.round(it.effectivePriceCny).toLocaleString()}</span>
                    ) : (
                      "-"
                    )}
                    {it.currency && it.priceRaw != null && (
                      <span className="ml-1 text-xs text-gray-400">({it.priceRaw}{it.currency})</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-gray-500">{it.location}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1" title={it.notes || ""}>
                      {it.reasons.length === 0 ? (
                        <span className="text-xs text-gray-400">—</span>
                      ) : (
                        it.reasons.map((r) => (
                          <span key={r} className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600">
                            {r}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    {it.productId ? (
                      <a href={`/${locale}/admin/products/${it.productId}`} className="text-primary-600 hover:underline">
                        {it.productId.slice(-6)}
                      </a>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col gap-1.5">
                      <a href={`/${locale}/admin/raw-listings/${it.id}`} className="text-[11px] text-primary-600 hover:underline">详情</a>
                      {(it.status === "needs_review" || it.status === "pending" || it.status === "approved") && (
                        <>
                          <div className="flex gap-1">
                            <select
                              value={brandSel[it.id] || matchBrandId(it) || ""}
                              onChange={(e) => setBrandSel((p) => ({ ...p, [it.id]: e.target.value }))}
                              className="w-24 rounded border px-1 py-0.5 text-[11px]"
                            >
                              <option value="">品牌▾</option>
                              {brandOptions.map((b) => (
                                <option key={b.id} value={b.id}>{b.nameZh}</option>
                              ))}
                            </select>
                            <select
                              value={catSel[it.id] || ""}
                              onChange={(e) => setCatSel((p) => ({ ...p, [it.id]: e.target.value }))}
                              className="w-24 rounded border px-1 py-0.5 text-[11px]"
                            >
                              <option value="">品类▾</option>
                              {categories.map((c) => (
                                <option key={c.id} value={c.id}>{catLabel(c)}</option>
                              ))}
                            </select>
                          </div>
                          {it.reasons.includes("invalid_year") && (
                            <input value={yearInput[it.id] || ""} onChange={(e) => setYearInput((prev) => ({ ...prev, [it.id]: e.target.value }))}
                              inputMode="numeric" placeholder="年份 如2015" className="w-24 rounded border px-1 py-0.5 text-[11px]" />
                          )}
                          {it.reasons.includes("no_price") && (
                            <input value={priceInput[it.id] || ""} onChange={(e) => setPriceInput((prev) => ({ ...prev, [it.id]: e.target.value }))}
                              inputMode="numeric" placeholder="价格 CNY" className="w-24 rounded border px-1 py-0.5 text-[11px]" />
                          )}
                          <div className="flex gap-1">
                            <button disabled={busy} onClick={() => singleAct(it.id, "approve")} className="rounded bg-cyan-600 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-cyan-700 disabled:opacity-50">
                              通过并转换
                            </button>
                            <button disabled={busy} onClick={() => singleAct(it.id, "reject")} className="rounded bg-red-600 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-red-700 disabled:opacity-50">
                              拒绝
                            </button>
                            <button disabled={busy} onClick={() => singleAct(it.id, "reevaluate")} className="rounded border px-2 py-0.5 text-[11px] font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50">
                              重新评估
                            </button>
                          </div>
                        </>
                      )}
                      {it.status === "converted" && (
                        <div className="flex gap-1">
                          <button disabled={busy} onClick={() => singleAct(it.id, "publish")} className="rounded bg-green-600 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-green-700 disabled:opacity-50">
                            发布
                          </button>
                          <button disabled={busy} onClick={() => singleAct(it.id, "reevaluate")} className="rounded border px-2 py-0.5 text-[11px] font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50">
                            重新评估
                          </button>
                        </div>
                      )}
                      {it.status === "published" && (
                        <button disabled={busy} onClick={() => singleAct(it.id, "unpublish")} className="rounded border px-2 py-0.5 text-[11px] font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50">
                          下线
                        </button>
                      )}
                      {(it.status === "auto_rejected" || it.status === "rejected" || it.status === "converting") && (
                        <button disabled={busy} onClick={() => singleAct(it.id, "reevaluate")} className="rounded border px-2 py-0.5 text-[11px] font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50">
                          重新评估
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-gray-400">
                  没有匹配的采集记录
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
