"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, Info, Loader2, ShieldCheck } from "lucide-react";

interface PublicBrand {
  brand: string;
  brandNameZh: string | null;
  lowWan: number;
  highWan: number;
  sampleSize: number;
  modelCount: number;
  regions: string[];
  sourceCount: number;
  asOf: string | null;
}

interface PublicResponse {
  ok: boolean;
  error?: string;
  available: boolean;
  site: string;
  generatedAt: string;
  unit: string;
  minSample: number;
  summary: { brandCount: number; sampleTotal: number; sourceCount: number };
  brands: PublicBrand[];
}

type ViewState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; data: PublicResponse };

/**
 * 游客可见的「品牌级脱敏基准价摘要」。
 * 数据只来自 /api/benchmark/public（白名单聚合），不触碰 admin 全量接口，
 * 因此不会像旧版那样把 401 权限拒绝误报成「无法获取数据」。
 */
export default function PublicBenchmarkSummary() {
  const t = useTranslations("benchmarkPublic");
  const [state, setState] = useState<ViewState>({ phase: "loading" });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/benchmark/public", { cache: "no-store" });
        const json = (await res.json()) as PublicResponse;
        if (!res.ok || !json.ok) {
          throw new Error(json.error || `HTTP ${res.status}`);
        }
        if (alive) setState({ phase: "ready", data: json });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "request failed";
        if (alive) setState({ phase: "error", message });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (state.phase === "loading") {
    return (
      <div className="border rounded-lg p-10 bg-white shadow-sm text-center text-gray-500">
        <Loader2 className="h-6 w-6 animate-spin inline-block mr-2" />
        {t("loading")}
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div className="border border-amber-200 rounded-lg p-8 bg-amber-50 text-amber-900">
        <div className="flex items-center gap-2 font-semibold mb-2">
          <AlertCircle className="h-5 w-5" />
          {t("errorTitle")}
        </div>
        <p className="text-sm break-all">{state.message}</p>
      </div>
    );
  }

  const { data } = state;

  return (
    <div className="space-y-5">
      <div className="border border-blue-100 rounded-lg p-5 bg-blue-50 text-blue-900 text-sm">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <p>{t("notice")}</p>
        </div>
      </div>

      {!data.available || data.brands.length === 0 ? (
        <div className="border rounded-lg p-10 bg-white shadow-sm text-center text-gray-600">
          <p className="font-semibold mb-1">{t("empty")}</p>
          <p className="text-sm text-gray-500">{t("emptyHint")}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="border rounded-lg p-4 bg-white shadow-sm">
              <div className="text-xs text-gray-500">{t("brandsLabel")}</div>
              <div className="text-2xl font-semibold text-gray-900">{data.summary.brandCount}</div>
            </div>
            <div className="border rounded-lg p-4 bg-white shadow-sm">
              <div className="text-xs text-gray-500">{t("samplesLabel")}</div>
              <div className="text-2xl font-semibold text-gray-900">
                {data.summary.sampleTotal.toLocaleString()}
              </div>
            </div>
            <div className="border rounded-lg p-4 bg-white shadow-sm">
              <div className="text-xs text-gray-500">{t("sourcesLabel")}</div>
              <div className="text-2xl font-semibold text-gray-900">{data.summary.sourceCount}</div>
            </div>
          </div>

          <div className="border rounded-lg bg-white shadow-sm overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">{t("brand")}</th>
                  <th className="px-4 py-3 text-right">
                    {t("priceRange")}（{t("unitWan")}）
                  </th>
                  <th className="px-4 py-3 text-right">{t("sample")}</th>
                  <th className="px-4 py-3 text-right">{t("models")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.brands.map((b) => (
                  <tr key={b.brand} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {b.brandNameZh || b.brand}
                      </div>
                      <div className="text-xs text-gray-400">
                        {b.brand}
                        {b.regions.length > 0 ? ` · ${b.regions.join(" / ")}` : ""}
                        {b.asOf ? ` · ${b.asOf}` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-900">
                      {b.lowWan} – {b.highWan}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                      {b.sampleSize.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                      {b.modelCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400">{t("unitHint")}</p>
        </>
      )}

      <div className="flex items-start gap-2 border rounded-lg p-4 bg-white shadow-sm text-sm text-gray-600">
        <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0 text-gray-400" />
        <p>{t("loginHint")}</p>
      </div>
    </div>
  );
}
