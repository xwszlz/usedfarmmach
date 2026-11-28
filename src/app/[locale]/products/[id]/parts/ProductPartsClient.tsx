"use client";

import { translate } from "@/lib/i18n-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Layers,
  Package,
  Search,
  SlidersHorizontal,
  Wrench,
  X,
} from "lucide-react";
import PartCard from "@/components/parts/PartCard";
import { Pagination } from "@/components/ui/pagination";
import type { PartFacetNode, ProductPartItem, ProductPartsResult } from "@/lib/product-parts";

interface ProductSummary {
  id: string;
  brand: string;
  modelName: string;
  year: number | null;
  categoryName: string;
  imageUrl: string | null;
}

interface Props {
  locale: string;
  product: ProductSummary;
  result: ProductPartsResult;
  /** 该整机推断出的机型 code（无法判断时为 null） */
  ownMachineType: string | null;
}

const MATCH_LABEL: Record<string, { zh: string; cls: string }> = {
  machine: { zh: "整机精选配对", cls: "bg-green-50 text-green-700 border-green-200" },
  brand: { zh: "按品牌匹配", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  generic: { zh: "通用配件", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  none: { zh: "暂无匹配", cls: "bg-gray-50 text-gray-600 border-gray-200" },
};

function facetLocalName(node: PartFacetNode, locale: string) {
  if (locale === "zh") return node.nameZh;
  return node.nameEn || node.nameZh;
}

export default function ProductPartsClient({ locale, product, result, ownMachineType }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentMt = searchParams.get("mt") || (ownMachineType ?? "__all__");
  const currentSs = searchParams.get("ss") || "";
  const currentCg = searchParams.get("cg") || "";
  const currentBrand = searchParams.get("brand") || "";
  const currentQ = searchParams.get("q") || "";

  const [keyword, setKeyword] = useState(currentQ);
  const [expandedSs, setExpandedSs] = useState<Set<string>>(new Set(currentSs ? [currentSs] : []));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 外部（浏览器前进/后退、清除筛选）导致 q 变化时同步输入框
  useEffect(() => {
    setKeyword(currentQ);
  }, [currentQ]);

  const pushParams = useCallback(
    (patch: Record<string, string | null>, resetPage = true) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      if (resetPage) next.delete("page");
      const qs = next.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const onSearchChange = (value: string) => {
    setKeyword(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => pushParams({ q: value.trim() || null }), 400);
  };

  const selectedMtFacet = useMemo(
    () => result.machineTypes.find((m) => m.code === currentMt) || null,
    [result.machineTypes, currentMt]
  );

  // 选中机型下的子系统树
  const ssTree = useMemo(() => {
    const node = result.facetTree.find((n) => n.code === currentMt);
    return node?.children ?? [];
  }, [result.facetTree, currentMt]);

  const activeFilters =
    (currentMt !== "__all__" ? 1 : 0) +
    (currentSs ? 1 : 0) +
    (currentCg ? 1 : 0) +
    (currentBrand ? 1 : 0) +
    (currentQ ? 1 : 0);

  const matchLabel = MATCH_LABEL[result.matchedBy] ?? MATCH_LABEL.none;

  const toggleSs = (code: string) =>
    setExpandedSs((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 面包屑 */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-3 text-xs text-gray-500 sm:px-6 lg:px-8">
          <Link href={`/${locale}`} className="hover:text-orange-600">
            {translate("首页", locale)}
          </Link>
          <span className="mx-2">/</span>
          <Link href={`/${locale}/products`} className="hover:text-orange-600">
            {translate("设备市场", locale)}
          </Link>
          <span className="mx-2">/</span>
          <Link href={`/${locale}/products/${product.id}`} className="hover:text-orange-600">
            {product.brand} {product.modelName}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900">{translate("零部件", locale)}</span>
        </div>
      </div>

      {/* 设备横幅 */}
      <div className="border-b border-gray-200 bg-gradient-to-r from-orange-600 via-red-500 to-amber-600 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-7 sm:flex-row sm:items-center sm:px-6 lg:px-8">
          {product.imageUrl && (
            <img
              src={product.imageUrl}
              alt={`${product.brand} ${product.modelName}`}
              className="h-24 w-32 flex-shrink-0 rounded-xl object-cover ring-2 ring-white/40"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <Package className="h-5 w-5 text-white/80" />
              <span className="text-xs font-medium text-white/80">
                {translate("整机适配零部件", locale)}
              </span>
            </div>
            <h1 className="truncate text-2xl font-bold sm:text-3xl">
              {product.brand} {product.modelName}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-white/90">
              {product.categoryName && <span>{product.categoryName}</span>}
              {product.year ? <span>· {product.year}</span> : null}
              <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold">
                {result.total} {translate("个适配件", locale)}
              </span>
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${matchLabel.cls}`}>
                {translate(matchLabel.zh, locale)}
              </span>
            </div>
          </div>
          <Link
            href={`/${locale}/products/${product.id}`}
            className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-xl border border-white/40 bg-white/15 px-4 py-2.5 text-sm font-medium backdrop-blur hover:bg-white/25"
          >
            <ArrowLeft className="h-4 w-4" />
            {translate("返回整机详情", locale)}
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* 机型 chips */}
        {result.machineTypes.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-medium text-gray-500">
              {translate("机型分类", locale)}
            </span>
            <button
              type="button"
              onClick={() => pushParams({ mt: "__all__", ss: null, cg: null })}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                currentMt === "__all__" || !selectedMtFacet
                  ? "border-orange-500 bg-orange-500 text-white"
                  : "border-gray-200 bg-white text-gray-700 hover:border-orange-400 hover:text-orange-600"
              }`}
            >
              {translate("全部机型", locale)}
              <span className="ml-1 opacity-80">
                ({result.machineTypes.reduce((s, m) => s + m.count, 0) + (result.unclassified || 0)})
              </span>
            </button>
            {result.machineTypes.map((mt) => {
              const active = currentMt === mt.code;
              const isOwn = ownMachineType === mt.code;
              return (
                <button
                  key={mt.code}
                  type="button"
                  onClick={() => pushParams({ mt: mt.code, ss: null, cg: null })}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? "border-orange-500 bg-orange-500 text-white"
                      : isOwn
                        ? "border-orange-300 bg-orange-50 text-orange-700 hover:border-orange-400"
                        : "border-gray-200 bg-white text-gray-700 hover:border-orange-400 hover:text-orange-600"
                  }`}
                >
                  {locale === "zh" ? mt.nameZh : mt.nameEn || mt.nameZh}
                  <span className="ml-1 opacity-80">({mt.count})</span>
                </button>
              );
            })}
          </div>
        )}

        {ownMachineType && currentMt !== ownMachineType && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-blue-800">
            <span>
              {translate("当前显示范围超出了本机型，包含其他机型的配件。", locale)}
            </span>
            <button
              type="button"
              onClick={() => pushParams({ mt: ownMachineType, ss: null, cg: null })}
              className="font-semibold underline hover:no-underline"
            >
              {translate("只看本机型适配件", locale)}
            </button>
          </div>
        )}

        <div className="flex flex-col gap-6 lg:flex-row">
          {/* 左侧：子系统 / 部件组导航 */}
          {ssTree.length > 0 && (
            <aside className="w-full flex-shrink-0 lg:w-64">
              <div className="rounded-xl border border-gray-200 bg-white p-3 lg:sticky lg:top-4">
                <div className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <Layers className="h-4 w-4 text-orange-500" />
                  {translate("系统分类", locale)}
                </div>
                <button
                  type="button"
                  onClick={() => pushParams({ ss: null, cg: null })}
                  className={`mb-1 flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-sm ${
                    !currentSs
                      ? "bg-orange-50 font-semibold text-orange-700"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span>{translate("全部系统", locale)}</span>
                  <span className="text-xs text-gray-400">{selectedMtFacet?.count ?? 0}</span>
                </button>
                {ssTree.map((ss) => {
                  const open = expandedSs.has(ss.code);
                  const active = currentSs === ss.code;
                  return (
                    <div key={ss.code}>
                      <div className="flex items-center">
                        <button
                          type="button"
                          onClick={() => {
                            toggleSs(ss.code);
                            pushParams({ ss: ss.code, cg: null });
                          }}
                          className={`flex flex-1 items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm ${
                            active
                              ? "bg-orange-50 font-semibold text-orange-700"
                              : "text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          <span className="truncate">{facetLocalName(ss, locale)}</span>
                          <span className="ml-2 flex-shrink-0 text-xs text-gray-400">{ss.count}</span>
                        </button>
                        {ss.children.length > 0 && (
                          <button
                            type="button"
                            onClick={() => toggleSs(ss.code)}
                            className="ml-0.5 rounded p-1 text-gray-400 hover:text-gray-700"
                            aria-label={translate("展开", locale)}
                          >
                            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          </button>
                        )}
                      </div>
                      {open && ss.children.length > 0 && (
                        <div className="ml-3 border-l border-gray-100 pl-2">
                          {ss.children.map((cg) => (
                            <button
                              key={cg.code}
                              type="button"
                              onClick={() => pushParams({ ss: ss.code, cg: cg.code })}
                              className={`flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-xs ${
                                currentCg === cg.code
                                  ? "bg-orange-50 font-semibold text-orange-700"
                                  : "text-gray-600 hover:bg-gray-50"
                              }`}
                            >
                              <span className="truncate">{facetLocalName(cg, locale)}</span>
                              <span className="ml-1 flex-shrink-0 text-gray-400">{cg.count}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </aside>
          )}

          {/* 右侧：筛选 + 列表 */}
          <main className="min-w-0 flex-1">
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-3">
              <div className="relative min-w-[220px] flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={translate("搜索配件名称、品牌、OEM编号...", locale)}
                  className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
                {keyword && (
                  <button
                    type="button"
                    onClick={() => onSearchChange("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500">{translate("品牌:", locale)}</span>
                <select
                  value={currentBrand}
                  onChange={(e) => pushParams({ brand: e.target.value || null })}
                  className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                >
                  <option value="">{translate("全部", locale)}</option>
                  {result.brands.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              {activeFilters > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setKeyword("");
                    pushParams({ mt: ownMachineType ?? "__all__", ss: null, cg: null, brand: null, q: null });
                  }}
                  className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-orange-600 hover:text-orange-700"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  {translate("清除筛选", locale)}
                </button>
              )}
            </div>

            {/* 结果统计 */}
            <div className="mb-3 text-sm text-gray-500">
              {translate("共", locale)} <span className="font-semibold text-gray-900">{result.total}</span>{" "}
              {translate("个适配件", locale)}
              {currentSs && (
                <span className="ml-2 text-xs text-gray-400">
                  {translate("已按系统筛选", locale)}
                </span>
              )}
            </div>

            {result.items.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white py-16 text-center">
                <Wrench className="mx-auto mb-3 h-10 w-10 text-gray-300" />
                <p className="text-sm text-gray-500">
                  {translate("当前筛选条件下暂无零部件", locale)}
                </p>
                <Link
                  href={`/${locale}/parts`}
                  className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-orange-600 hover:text-orange-700"
                >
                  {translate("前往零配件专区逛逛 →", locale)}
                </Link>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {result.items.map((part: ProductPartItem) => (
                    <div key={part.id} className="relative">
                      <PartCard
                        part={part}
                        locale={locale}
                        // 历史件（PartLegacy）无独立详情页，卡片不可点击
                        detailHref={part.machineType ? undefined : null}
                      />
                      {!part.machineType && (
                        <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-gray-900/70 px-2 py-0.5 text-[10px] font-medium text-white">
                          {translate("历史配件", locale)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {result.totalPages > 1 && (
                  <div className="mt-8 flex justify-center">
                    <Pagination
                      currentPage={result.page}
                      totalPages={result.totalPages}
                      onPageChange={(p) => {
                        const next = new URLSearchParams(searchParams.toString());
                        next.set("page", String(p));
                        router.push(`${pathname}?${next.toString()}`, { scroll: false });
                        if (typeof window !== "undefined") {
                          window.scrollTo({ top: 260, behavior: "smooth" });
                        }
                      }}
                    />
                  </div>
                )}
              </>
            )}

            {/* CTA */}
            <div className="mt-10 rounded-2xl bg-gradient-to-r from-orange-600 to-red-500 p-6 text-white sm:p-8">
              <h2 className="mb-2 text-xl font-bold">
                {translate("找不到需要的配件？", locale)}
              </h2>
              <p className="mb-4 max-w-xl text-sm text-white/90">
                {translate("告诉我们您的设备型号和需求，我们专业团队帮您全球 sourcing，48小时内报价", locale)}
              </p>
              <Link
                href={`/${locale}/products/${product.id}#inquiry`}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-orange-600 hover:bg-orange-50"
              >
                {translate("提交需求", locale)}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
