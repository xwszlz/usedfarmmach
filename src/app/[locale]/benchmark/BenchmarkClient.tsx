"use client";
import { useState, useEffect, useMemo } from "react";
import { Loader2, RefreshCw, Globe2, TrendingUp, Store, ExternalLink, AlertCircle, CheckCircle2, } from "lucide-react";
import { useTr } from "@/lib/i18n-tr";
interface BenchmarkItem {
    id: string;
    brand: string;
    brandNameZh: string | null;
    model: string;
    category: string;
    sourceSite: string;
    region: string | null;
    currency: string;
    priceForeign: number;
    priceCny: number;
    medianPrice: number | null;
    sampleSize: number;
    listingCount: number;
    confidenceScore: number;
    lastVerified: string | null;
    sourceUrl: string | null;
}
interface ArbItem {
    id: string;
    source: string;
    country: string | null;
    currency: string;
    priceForeignCny: number;
    priceForeignRaw: number | null;
    confidenceScore: number;
    lastVerified: string | null;
    notes: string | null;
    product: {
        id: string;
        modelName: string | null;
        year: number | null;
        priceCny: number | null;
        price: number | null;
        brand: {
            name: string;
        } | null;
    } | null;
}
interface DomesticItem {
    id: string;
    brandName: string;
    modelName: string;
    year: number | null;
    priceCny: number | null;
    currency: string | null;
    location: string;
    source: string;
    sourceUrl: string;
    scrapedAt: string;
    reviewedAt: string | null;
}
interface SpreadItem {
    brand: string;
    domesticAvgWan: number;
    intlAvgWan: number;
    spreadWan: number;
    pct: number;
    direction: "export" | "import";
    domesticCount: number;
    intlCount: number;
}
interface BenchmarkResponse {
    ok: boolean;
    error?: string;
    generatedAt: string;
    summary: {
        benchmarkCount: number;
        freshCount: number;
        arbitrageCount: number;
        sampleTotal: number;
        domesticCount: number;
        spreadCount: number;
    };
    benchmark: BenchmarkItem[];
    arbitrage: ArbItem[];
    domestic: DomesticItem[];
    spread: SpreadItem[];
}
async function fetchBenchmark(): Promise<BenchmarkResponse> {
    const res = await fetch("/api/benchmark", { cache: "no-store" });
    if (!res.ok)
        throw new Error("\u65E0\u6CD5\u83B7\u53D6\u6570\u636E");
    const data = (await res.json()) as BenchmarkResponse;
    if (!data.ok)
        throw new Error(data.error || "\u6570\u636E\u5F02\u5E38");
    return data;
}
function fmtCny(n: number | null | undefined): string {
    if (n == null)
        return "\u2014";
    return "\u00A5" + Math.round(n).toLocaleString("zh-CN");
}
function daysSince(iso: string | null): number | null {
    if (!iso)
        return null;
    return (Date.now() - new Date(iso).getTime()) / 86400000;
}
function FreshBadge({ iso }: {
    iso: string | null;
}) {
  const tr = useTr();
    const d = daysSince(iso);
    if (d == null)
        return <span className="text-xs text-gray-400">{tr("无验证")}</span>;
    if (d <= 2)
        return (<span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded">
        <CheckCircle2 className="h-3 w-3"/>{tr("实时")}</span>);
    return (<span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
      <AlertCircle className="h-3 w-3"/> {Math.round(d)}{tr("天前")}</span>);
}
export default function BenchmarkClient() {
    const tr = useTr();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<BenchmarkResponse | null>(null);
    const [onlyFresh, setOnlyFresh] = useState(false);
    async function load() {
        setLoading(true);
        setError(null);
        try {
            setData(await fetchBenchmark());
        }
        catch (e) {
            setError(e instanceof Error ? e.message : "\u52A0\u8F7D\u5931\u8D25");
        }
        finally {
            setLoading(false);
        }
    }
    useEffect(() => {
        load();
    }, []);
    const shownBenchmark = useMemo(() => {
        if (!data)
            return [];
        if (!onlyFresh)
            return data.benchmark;
        return data.benchmark.filter((b) => {
            const d = daysSince(b.lastVerified);
            return d != null && d <= 2;
        });
    }, [data, onlyFresh]);
    if (loading && !data) {
        return (<div className="border rounded-lg p-8 bg-white shadow-sm text-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4"/>
        <p className="text-gray-600">{tr("正在读取 Neon 实时数据…")}</p>
      </div>);
    }
    if (error) {
        return (<div className="border rounded-lg p-6 bg-white shadow-sm">
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-700">{error}</p>
          <button onClick={load} className="mt-3 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">{tr("重试")}</button>
        </div>
      </div>);
    }
    if (!data)
        return null;
    const { summary } = data;
    return (<div className="space-y-10">
      {/* 概览卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <p className="text-sm text-gray-600 font-medium">{tr("基准价条目")}</p>
          <p className="text-2xl font-bold text-gray-900">{summary.benchmarkCount}</p>
          <p className="text-xs text-green-600 mt-1">{tr("其中实时")}{summary.freshCount}</p>
        </div>
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <p className="text-sm text-gray-600 font-medium">{tr("有效样本量")}</p>
          <p className="text-2xl font-bold text-blue-600">{summary.sampleTotal}</p>
          <p className="text-xs text-gray-500 mt-1">{tr("挂牌样本合计")}</p>
        </div>
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <p className="text-sm text-gray-600 font-medium">{tr("套利匹配")}</p>
          <p className="text-2xl font-bold text-green-600">{summary.arbitrageCount}</p>
          <p className="text-xs text-gray-500 mt-1">{tr("已绑定国内库存")}</p>
        </div>
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <p className="text-sm text-gray-600 font-medium">{tr("国内采集挂牌")}</p>
          <p className="text-2xl font-bold text-amber-600">{summary.domesticCount}</p>
          <p className="text-xs text-gray-500 mt-1">{tr("待审核上架")}</p>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={load} disabled={loading} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium rounded-md flex items-center gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin"/> : <RefreshCw className="h-4 w-4"/>}
          {loading ? "\u5237\u65B0\u4E2D" : "\u5237\u65B0"}
        </button>
      </div>

      {/* ① 全球基准价指数 */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Globe2 className="h-5 w-5 text-blue-600"/>
          <h2 className="text-xl font-semibold text-gray-900">{tr("① 全球品牌基准价指数")}</h2>
          <span className="text-sm text-gray-500">{tr("（与国内库存解耦，不需匹配）")}</span>
        </div>
        <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">{tr("品牌")}</th>
                  <th className="px-4 py-3 text-left">{tr("机型")}</th>
                  <th className="px-4 py-3 text-left">{tr("源站")}</th>
                  <th className="px-4 py-3 text-left">{tr("地区")}</th>
                  <th className="px-4 py-3 text-right">{tr("外币基准价")}</th>
                  <th className="px-4 py-3 text-right">{tr("折算 CNY")}</th>
                  <th className="px-4 py-3 text-right">{tr("样本")}</th>
                  <th className="px-4 py-3 text-center">{tr("置信度")}</th>
                  <th className="px-4 py-3 text-center">{tr("新鲜度")}</th>
                  <th className="px-4 py-3 text-center">{tr("来源")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {shownBenchmark.map((b) => (<tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {b.brandNameZh || b.brand}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{b.model}</td>
                    <td className="px-4 py-3 text-gray-600">{b.sourceSite}</td>
                    <td className="px-4 py-3 text-gray-600">{b.region || "\u2014"}</td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {b.currency} {Math.round(b.priceForeign).toLocaleString("zh-CN")}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {fmtCny(b.priceCny)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{b.sampleSize}</td>
                    <td className="px-4 py-3 text-center text-gray-600">
                      {(b.confidenceScore * 100).toFixed(0)}%
                    </td>
                    <td className="px-4 py-3 text-center">
                      <FreshBadge iso={b.lastVerified}/>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {b.sourceUrl ? (<a href={b.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-900 inline-flex items-center gap-1">
                          <ExternalLink className="h-3 w-3"/>
                        </a>) : ("\u2014")}
                    </td>
                  </tr>))}
                {shownBenchmark.length === 0 && (<tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-gray-500">{tr("暂无数据")}</td>
                  </tr>)}
              </tbody>
            </table>
          </div>
        </div>
        {summary.freshCount < summary.benchmarkCount && (<label className="inline-flex items-center gap-2 mt-3 text-sm text-gray-600">
            <input type="checkbox" checked={onlyFresh} onChange={(e) => setOnlyFresh(e.target.checked)} className="rounded border-gray-300"/>{tr("仅看实时数据（隐藏")}{summary.benchmarkCount - summary.freshCount}{tr("条历史残留）")}</label>)}
      </section>

      {/* ② 跨境套利匹配 */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-green-600"/>
          <h2 className="text-xl font-semibold text-gray-900">{tr("② 跨境套利匹配")}</h2>
          <span className="text-sm text-gray-500">{tr("（InternationalPrice ↔ 国内库存，需两边匹配）")}</span>
        </div>
        <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">{tr("国内库存机器")}</th>
                  <th className="px-4 py-3 text-right">{tr("国内标价")}</th>
                  <th className="px-4 py-3 text-right">{tr("国际收购参考")}</th>
                  <th className="px-4 py-3 text-right">{tr("价差(套利空间)")}</th>
                  <th className="px-4 py-3 text-left">{tr("机会 / 备注")}</th>
                  <th className="px-4 py-3 text-center">{tr("库存")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.arbitrage.map((a) => {
            const p = a.product;
            const domPrice = p?.priceCny ?? p?.price ?? null;
            const diff = domPrice != null ? domPrice - a.priceForeignCny : null;
            const pct = diff != null && a.priceForeignCny ? (diff / a.priceForeignCny) * 100 : null;
            return (<tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">
                          {p?.brand?.name || "\u2014"} {p?.modelName || ""} {p?.year || ""}
                        </p>
                        <p className="text-xs text-gray-500">{a.source}</p>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">{fmtCny(domPrice)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {fmtCny(a.priceForeignCny)}
                        <span className="block text-xs text-gray-400">
                          {a.currency} · {a.country || "\u2014"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold" style={{ color: diff != null && diff > 0 ? "#c0392b" : "#27ae60" }}>
                        {diff != null ? (diff > 0 ? "+" : "") + fmtCny(diff) : "\u2014"}
                        {pct != null && (<span className="block text-xs font-normal text-gray-400">
                            {pct > 0 ? "+" : ""}
                            {pct.toFixed(1)}%
                          </span>)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-xs">
                        {a.notes ? a.notes.replace(/\n/g, " ") : "\u2014"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {p ? (<a href={`/products/${p.id}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-900 inline-flex items-center gap-1">
                            <ExternalLink className="h-3 w-3"/>
                          </a>) : ("\u2014")}
                      </td>
                    </tr>);
        })}
                {data.arbitrage.length === 0 && (<tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">{tr("暂无匹配")}</td>
                  </tr>)}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ③ 国内卖方采集挂牌 */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Store className="h-5 w-5 text-amber-600"/>
          <h2 className="text-xl font-semibold text-gray-900">{tr("③ 国内卖方采集挂牌")}</h2>
          <span className="text-sm text-gray-500">{tr("（RawListing · domestic_*，爬虫跑通后入库）")}</span>
        </div>
        {data.domestic.length === 0 ? (<div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
            <AlertCircle className="h-6 w-6 text-amber-500 mx-auto mb-2"/>
            <p className="text-amber-800 font-medium">{tr("国内采集尚未入库")}</p>
            <p className="text-sm text-amber-700 mt-1">{tr("当前 RawListing 国内平台（Mascus中国 / 58同城 / 农机通 / traktorpool）为 0 行。 需运行 #1 卖方采集（路径 bug 已修，等下次 cron 或手动触发）后才会在此显示。")}</p>
          </div>) : (<div className="bg-white border rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">{tr("品牌")}</th>
                    <th className="px-4 py-3 text-left">{tr("机型")}</th>
                    <th className="px-4 py-3 text-left">{tr("年份")}</th>
                    <th className="px-4 py-3 text-right">{tr("价格")}</th>
                    <th className="px-4 py-3 text-left">{tr("地区")}</th>
                    <th className="px-4 py-3 text-left">{tr("来源平台")}</th>
                    <th className="px-4 py-3 text-center">{tr("审核")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.domestic.map((d) => (<tr key={d.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{d.brandName}</td>
                      <td className="px-4 py-3 text-gray-700">{d.modelName}</td>
                      <td className="px-4 py-3 text-gray-600">{d.year || "\u2014"}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{fmtCny(d.priceCny)}</td>
                      <td className="px-4 py-3 text-gray-600">{d.location}</td>
                      <td className="px-4 py-3 text-gray-600">{d.source.replace("domestic_", "")}</td>
                      <td className="px-4 py-3 text-center">
                        {d.reviewedAt ? (<span className="text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded">{tr("已审核")}</span>) : (<span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{tr("待审核")}</span>)}
                      </td>
                    </tr>))}
                </tbody>
              </table>
            </div>
          </div>)}
      </section>

      {/* ④ 境内 vs 全球基准价差 */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-purple-600"/>
          <h2 className="text-xl font-semibold text-gray-900">{tr("④ 境内 vs 全球基准价差")}</h2>
          <span className="text-sm text-gray-500">{tr("（品牌级：境内 RawListing 均价 − 国际 BrandBenchmark 均价）")}</span>
        </div>
        {data.spread.length === 0 ? (<div className="bg-purple-50 border border-purple-200 rounded-lg p-6 text-center">
            <AlertCircle className="h-6 w-6 text-purple-500 mx-auto mb-2"/>
            <p className="text-purple-800 font-medium">{tr("价差暂无可计算")}</p>
            <p className="text-sm text-purple-700 mt-1">{tr("需境内采集（RawListing）与国际基准（BrandBenchmark）同时存在同一品牌才会显示。 导入境内台账并补齐欧系基准后此处自动出数。")}</p>
          </div>) : (<div className="bg-white border rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">{tr("品牌")}</th>
                    <th className="px-4 py-3 text-right">{tr("境内均价(万)")}</th>
                    <th className="px-4 py-3 text-right">{tr("国际均价(万)")}</th>
                    <th className="px-4 py-3 text-right">{tr("价差(万)")}</th>
                    <th className="px-4 py-3 text-right">{tr("价差%")}</th>
                    <th className="px-4 py-3 text-center">{tr("方向")}</th>
                    <th className="px-4 py-3 text-center">{tr("样本")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.spread.map((s) => {
                const isExport = s.direction === "export";
                return (<tr key={s.brand} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{s.brand}</td>
                        <td className="px-4 py-3 text-right text-gray-700">
                          {s.domesticAvgWan.toLocaleString("zh-CN")}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">
                          {s.intlAvgWan.toLocaleString("zh-CN")}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold" style={{ color: isExport ? "#c0392b" : "#27ae60" }}>
                          {isExport ? "+" : ""}
                          {s.spreadWan.toLocaleString("zh-CN")}
                        </td>
                        <td className="px-4 py-3 text-right font-medium" style={{ color: isExport ? "#c0392b" : "#27ae60" }}>
                          {isExport ? "+" : ""}
                          {s.pct.toFixed(1)}%
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded ${isExport
                        ? "text-green-700 bg-green-100"
                        : "text-amber-700 bg-amber-100"}`}>
                            {isExport ? "\u51FA\u53E3\u5957\u5229" : "\u8FDB\u53E3\u65B9\u5411"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-500">{tr("内")}{s.domesticCount}{tr("/外")}{s.intlCount}
                        </td>
                      </tr>);
            })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400 px-4 py-3">{tr("说明：品牌级均价受型号/马力结构影响（如百姓网低价小拖拉机会拉低境内拖拉机均价），属指示级；精确套利须同型号/马力/配置逐台比对。")}</p>
          </div>)}
      </section>

      <p className="text-xs text-gray-400 text-center">{tr("数据更新时间：")}{new Date(data.generatedAt).toLocaleString("zh-CN")}{tr("· 数据源 Neon（新加坡）／ 境内采集 cn-postgres")}</p>
    </div>);
}
