"use client";

import { useEffect, useState, useCallback } from "react";
import { Wrench, Package, Loader2, ArrowRight, AlertCircle, ChevronUp } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PartCard, { type PartCardData } from "@/components/parts/PartCard";
import { getImageUrl } from "@/lib/image-url";

interface CompatiblePartsSectionProps {
  productId: string;
  locale: string;
}

interface ApiResponse {
  success: boolean;
  data?: {
    parts: PartCardData[];
    total: number;
    matchedBy: "brand" | "generic" | "none";
    matchDetail: { brand: string; model: string } | null;
    product: { id: string; modelName: string; brand: string };
  };
  error?: string;
}

const COMPACT_LIMIT = 4; // 紧凑行显示 4 个 +「查看全部」按钮

export default function CompatiblePartsSection({
  productId,
  locale,
}: CompatiblePartsSectionProps) {
  const isZh = locale === "zh";
  const [parts, setParts] = useState<PartCardData[]>([]);
  const [total, setTotal] = useState(0);
  const [matchedBy, setMatchedBy] = useState<"brand" | "generic" | "none" | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // 展开态：完整配件列表（点击"查看全部"后按需加载）
  const [expanded, setExpanded] = useState(false);
  const [allParts, setAllParts] = useState<PartCardData[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/products/${productId}/compatible-parts?limit=${COMPACT_LIMIT}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("failed");
      const json: ApiResponse = await res.json();
      if (!json.success) throw new Error("failed");
      setParts(json.data?.parts ?? []);
      setTotal(json.data?.total ?? 0);
      setMatchedBy(json.data?.matchedBy ?? "none");
    } catch (e) {
      console.error("Failed to load compatible parts:", e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    load();
  }, [load]);

  // 展开时再拉取完整列表（最多 200 条）
  const expand = useCallback(async () => {
    setExpanded(true);
    if (allParts.length > 0) return;
    setLoadingAll(true);
    try {
      const res = await fetch(`/api/products/${productId}/compatible-parts?limit=200`, {
        cache: "no-store",
      });
      const json: ApiResponse = await res.json();
      if (json.success) setAllParts(json.data?.parts ?? []);
    } catch (e) {
      console.error("Failed to load all compatible parts:", e);
    } finally {
      setLoadingAll(false);
    }
  }, [productId, allParts.length]);

  const showViewAll = total > parts.length;
  const compactParts = parts.slice(0, COMPACT_LIMIT);
  const displayParts = allParts.length > 0 ? allParts : parts;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary-600" />
          {isZh ? "适配零部件" : "Compatible Parts"}
          {matchedBy === "brand" && !loading && (
            <span className="text-xs font-normal text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
              {isZh ? "按品牌匹配" : "Brand matched"}
            </span>
          )}
          {matchedBy === "generic" && !loading && (
            <span className="text-xs font-normal text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
              {isZh ? "通用配件" : "Generic parts"}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="flex items-center justify-center py-10 text-gray-400">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span className="text-sm">{isZh ? "加载中..." : "Loading..."}</span>
          </div>
        )}

        {!loading && error && (
          <div className="flex items-center justify-center py-10 text-gray-400">
            <AlertCircle className="h-6 w-6 mr-2" />
            <span className="text-sm">
              {isZh ? "配件加载失败，请稍后重试" : "Failed to load parts. Please retry."}
            </span>
          </div>
        )}

        {!loading && !error && parts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Wrench className="h-10 w-10 text-gray-300 mb-3" />
            <p className="text-sm text-gray-500 mb-1">
              {isZh
                ? "该机型暂无已登记的适配零部件"
                : "No compatible parts registered for this model yet"}
            </p>
            <Link
              href={`/${locale}/parts`}
              className="text-sm font-medium text-primary-600 hover:text-primary-700 inline-flex items-center gap-1 mt-2"
            >
              {isZh ? "前往零配件专区逛逛 →" : "Browse parts catalog →"}
            </Link>
          </div>
        )}

        {/* 紧凑态：详情页一行（移动端自动换行成两行），每个 chip 带缩略图 */}
        {!loading && !error && !expanded && parts.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {compactParts.map((part) => {
              const name = isZh ? part.nameZh : (part.nameEn || part.nameZh);
              const thumb = part.images && part.images.length > 0 ? part.images[0] : null;
              return (
                <Link
                  key={part.id}
                  href={`/${locale}/parts/${part.id}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 pl-1 pr-3 py-1 text-xs text-gray-700 hover:border-primary-600 hover:text-primary-700 transition-colors"
                >
                  {thumb ? (
                    <img
                      src={getImageUrl(thumb)}
                      alt={name}
                      loading="lazy"
                      className="h-5 w-5 rounded-full object-cover bg-white border border-gray-200"
                    />
                  ) : (
                    <span className="h-5 w-5 rounded-full bg-gray-200 inline-flex items-center justify-center">
                      <Package className="h-3 w-3 text-gray-400" />
                    </span>
                  )}
                  <span className="max-w-[12rem] truncate">{name}</span>
                  <span className="font-semibold text-orange-600">¥{part.price.toLocaleString()}</span>
                </Link>
              );
            })}
            {showViewAll && (
              <button
                type="button"
                onClick={expand}
                className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700 hover:bg-primary-100 transition-colors"
              >
                {isZh ? `查看全部零部件 (${total})` : `View all parts (${total})`}
                <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
        )}

        {/* 展开态：自由编排的完整配件网格 */}
        {!loading && !error && expanded && (
          <div>
            {loadingAll ? (
              <div className="flex items-center justify-center py-10 text-gray-400">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span className="text-sm">{isZh ? "加载全部配件..." : "Loading all parts..."}</span>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {displayParts.map((part) => (
                    <PartCard key={part.id} part={part} locale={locale} />
                  ))}
                </div>
                <div className="mt-6 text-center">
                  <button
                    type="button"
                    onClick={() => setExpanded(false)}
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
                  >
                    <ChevronUp className="h-4 w-4" />
                    {isZh ? "收起" : "Collapse"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}