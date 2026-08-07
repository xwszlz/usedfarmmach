"use client";

import { useEffect, useState, useCallback } from "react";
import { Wrench, Package, Loader2, ArrowRight, AlertCircle } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PartCard, { type PartCardData } from "@/components/parts/PartCard";

interface CompatiblePartsSectionProps {
  productId: string;
  locale: string;
}

interface ApiResponse {
  success: boolean;
  data?: {
    parts: PartCardData[];
    matchedBy: "brand" | "generic" | "none";
    matchDetail: { brand: string; model: string } | null;
    product: { id: string; modelName: string; brand: string };
  };
  error?: string;
}

export default function CompatiblePartsSection({
  productId,
  locale,
}: CompatiblePartsSectionProps) {
  const isZh = locale === "zh";
  const [parts, setParts] = useState<PartCardData[]>([]);
  const [matchedBy, setMatchedBy] = useState<"brand" | "generic" | "none" | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/products/${productId}/compatible-parts?limit=8`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("failed");
      const json: ApiResponse = await res.json();
      if (!json.success) throw new Error("failed");
      setParts(json.data?.parts ?? []);
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

  return (
    <Card>
      <CardHeader>
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

        {!loading && !error && parts.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {parts.map((part) => (
                <PartCard key={part.id} part={part} locale={locale} />
              ))}
            </div>
            <div className="mt-6 text-center">
              <Link
                href={`/${locale}/parts`}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
              >
                {isZh ? "查看全部零配件" : "View all parts"}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
