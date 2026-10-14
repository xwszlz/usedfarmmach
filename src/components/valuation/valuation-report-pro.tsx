"use client";

/**
 * 顶级数据报告（Phase 1）— 基于 866 万条真实补贴成交的 8 大模块，使用 recharts 呈现。
 *
 * 数据来源：/api/valuation 在「服务端」按 品牌/品类/型号/省份 切片的 intelligence 片段
 * （valuation_intelligence.json，绝不下发全量 5.4MB 到客户端）。
 *
 * 8 大模块：
 *  ① 核心结论 + 数据驱动置信区间（P25~P75，取代拍脑袋 ±15%）
 *  ② 同款 / 同品牌同品类真实成交分布（箱线式柱状）
 *  ③ 补贴后净购置价（市场均价 vs 农户净支出 vs 中央补贴）
 *  ④ 区域比价（省份价格指数，高亮当前省）
 *  ⑤ 折旧曲线（品类机龄残值率）
 *  ⑥ 品牌残值率（同品类保值排行，高亮本品牌）
 *  ⑦ 补贴退坡趋势（逐年均价/补贴，真实历史）
 *  ⑧ 专业机构对标（神雕AI vs IronGuides / KBB / 农机360）
 */

import { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  LineChart,
  Line,
  ReferenceLine,
  Legend,
} from "recharts";
import { formatValuationMoney } from "@/lib/valuation/formulas";
import { getSubsidyPriceHistory, type SubsidyYearDatum } from "@/lib/valuation/brand-data";
import type { ValuationReportMeta, ValuationReportResult } from "./valuation-report-section";
import type { ValuationIntelligence } from "@/lib/valuation/intelligence";

interface Props {
  channel: "domestic" | "international" | "export";
  meta: ValuationReportMeta;
  result: ValuationReportResult;
  intelligence: ValuationIntelligence | null;
  locale?: string;
}

const COLORS = {
  primary: "#1d4ed8",
  primaryLight: "#93c5fd",
  green: "#10b981",
  greenLight: "#6ee7b7",
  amber: "#f59e0b",
  gray: "#cbd5e1",
  red: "#ef4444",
};

function ChartCard({
  title,
  subtitle,
  children,
  zh,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  zh: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h4 className="text-sm font-semibold text-gray-800">{title}</h4>
        {subtitle && <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function PriceTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-md">
      <div className="mb-1 font-medium text-gray-700">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded" style={{ background: p.color || p.fill }} />
          <span className="text-gray-500">{p.name}：</span>
          <span className="font-semibold text-gray-800">{formatValuationMoney(Number(p.value))}</span>
        </div>
      ))}
    </div>
  );
}

export default function ValuationReportPro({
  channel,
  meta,
  result,
  intelligence,
  locale = "zh",
}: Props) {
  const zh = locale === "zh";

  // 非国产通道：提示
  if (channel !== "domestic") {
    return (
      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-500 shadow-sm">
        <div className="mb-1 flex items-center gap-2 font-semibold text-gray-700">
          📊 {zh ? "顶级数据报告" : "Premium Data Report"}
        </div>
        {zh
          ? "国际 / 出口通道估值基于全球二手农机市场模型（小时折旧 + 排放系数）。中国农机购置补贴真实交易深度报告目前仅支持国产通道。"
          : "The premium data report (built on China's farm-machinery subsidy transactions) is available for the domestic channel only."}
      </div>
    );
  }

  // 国产但无情报（样本不足 / API 兜底）
  if (!intelligence || !intelligence.available) {
    return (
      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-500 shadow-sm">
        <div className="mb-1 flex items-center gap-2 font-semibold text-gray-700">
          📊 {zh ? "顶级数据报告" : "Premium Data Report"}
        </div>
        {zh
          ? "该品牌 / 品类在 866 万条真实补贴交易中样本不足，暂无法生成数据深度报告。建议补充型号或选择主流品牌。"
          : "Insufficient real-transaction samples for this brand/category to generate the premium report."}
      </div>
    );
  }

  const stat = intelligence.model || intelligence.brandCat;
  const statLevelLabel =
    intelligence.model ? (zh ? "同款型号" : "Same model") : zh ? "同品牌同品类" : "Same brand & category";

  // ① 区间可视化（CSS）
  const box = useMemo(() => {
    if (!stat) return null;
    const lo = stat.min;
    const hi = stat.max;
    const span = hi - lo || 1;
    const pct = (v: number) => Math.max(0, Math.min(100, ((v - lo) / span) * 100));
    return {
      lo,
      hi,
      p25: pct(stat.p25),
      p75: pct(stat.p75),
      median: pct(stat.median),
      engine: pct(result.value),
    };
  }, [stat, result.value]);

  const confidenceText = useMemo(() => {
    const c = intelligence?.confidence;
    if (!c) return zh ? "数据置信度：未知" : "Confidence: unknown";
    const map = {
      high: zh ? "高（样本充足，统计显著）" : "High (ample samples)",
      medium: zh ? "中（样本较充足）" : "Medium (adequate)",
      low: zh ? "低（样本较少，仅供参考）" : "Low (sparse)",
    } as const;
    return `${zh ? "数据置信度" : "Confidence"}：${map[c.level]} · ${zh ? "样本" : "n"}=${c.n.toLocaleString()} · ${zh ? "变异系数" : "CV"}=${(c.cv * 100).toFixed(0)}%`;
  }, [intelligence, zh]);

  // ③ 补贴后净购置价
  const subsidyBlock =
    stat && stat.median > 0
      ? {
          market: stat.median,
          net: stat.netMedian,
          central: stat.medCentral,
          ratio: ((stat.median - stat.netMedian) / stat.median) * 100,
        }
      : null;

  // ⑦ 补贴退坡趋势
  const subsidyHistory: SubsidyYearDatum[] = useMemo(
    () => (meta.isChineseBrand ? getSubsidyPriceHistory(meta.brand, meta.category || "") : []),
    [meta.brand, meta.category, meta.isChineseBrand],
  );

  const fmtPct = (v: number) => `${v.toFixed(0)}%`;

  return (
    <div className="mt-4 space-y-4">
      {/* 报告头 */}
      <div className="overflow-hidden rounded-xl border border-indigo-100 bg-white shadow-sm">
        <div
          className="px-5 py-4 text-white"
          style={{ background: "linear-gradient(135deg, #4f46e5, #4338ca)" }}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">📊</span>
            <h3 className="text-base font-bold">{zh ? "真实交易数据深度报告" : "Premium Data Report"}</h3>
            <span className="ml-auto rounded-full bg-white/15 px-2 py-0.5 text-[10px]">
              {zh ? "顶级 · 数据驱动" : "Top-Tier · Data-Driven"}
            </span>
          </div>
          <p className="mt-1 text-xs opacity-80">
            {zh
              ? `基于 ${intelligence.global.totalRecords.toLocaleString()} 条中国农机购置补贴真实成交 · ${intelligence.global.nProvinces} 省 · ${intelligence.global.nCategories} 品类`
              : `Built on ${intelligence.global.totalRecords.toLocaleString()} real China subsidy transactions · ${intelligence.global.nProvinces} provinces · ${intelligence.global.nCategories} categories`}
          </p>
        </div>

        {/* ① 核心结论 + 数据驱动区间 */}
        <div className="border-b border-gray-100 p-5">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="text-3xl font-extrabold text-indigo-700">{formatValuationMoney(result.value)}</span>
            <span className="text-xs text-gray-500">
              {zh ? "AI估值" : "AI Estimate"}
            </span>
            <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">
              {zh ? "置信度" : "Confidence"} {Math.round(result.confidence)}%
            </span>
          </div>

          {box && stat && (
            <div className="mt-4">
              <div className="mb-1 text-xs text-gray-500">
                {zh ? `${statLevelLabel}真实成交区间（P25 ~ P75）` : `${statLevelLabel} real range (P25 ~ P75)`}
                <span className="ml-1 text-gray-400">· n={stat.n.toLocaleString()}</span>
              </div>
              <div className="relative h-9 rounded-lg bg-gray-50">
                {/* P25~P75 阴影带 */}
                <div
                  className="absolute top-1 bottom-1 rounded bg-indigo-100"
                  style={{ left: `${box.p25}%`, right: `${100 - box.p75}%` }}
                />
                {/* 中位数刻度 */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-indigo-600"
                  style={{ left: `${box.median}%` }}
                  title={`${zh ? "中位" : "Median"} ${formatValuationMoney(stat.median)}`}
                />
                {/* AI 估值标记 */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-amber-500"
                  style={{ left: `${box.engine}%` }}
                  title={`${zh ? "AI估值" : "AI"} ${formatValuationMoney(result.value)}`}
                />
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-gray-400">
                <span>低 {formatValuationMoney(box.lo)}</span>
                <span className="text-indigo-600">中位 {formatValuationMoney(stat.median)}</span>
                <span>高 {formatValuationMoney(box.hi)}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500">
                <span>
                  {zh ? "P25" : "P25"}：<b className="text-gray-700">{formatValuationMoney(stat.p25)}</b>
                </span>
                <span>
                  {zh ? "P75" : "P75"}：<b className="text-gray-700">{formatValuationMoney(stat.p75)}</b>
                </span>
                <span className="text-indigo-600">{confidenceText}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ② 同款 / 同品牌同品类真实成交分布 */}
      {stat && (
        <ChartCard
          title={zh ? `① ${statLevelLabel}真实成交分布` : `① ${statLevelLabel} Transaction Distribution`}
          subtitle={zh ? `${meta.brand} ${meta.category}${meta.modelName ? " " + meta.modelName : ""} · 真实成交样本 ${stat.n.toLocaleString()} 条` : `${meta.brand} ${meta.category} · n=${stat.n.toLocaleString()}`}
          zh={zh}
        >
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={[
                { name: zh ? "最小" : "Min", v: stat.min },
                { name: "P25", v: stat.p25 },
                { name: zh ? "中位" : "Median", v: stat.median },
                { name: "P75", v: stat.p75 },
                { name: zh ? "最大" : "Max", v: stat.max },
              ]} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tickFormatter={(v) => formatValuationMoney(Number(v))} tick={{ fontSize: 10 }} stroke="#94a3b8" width={56} />
                <Tooltip content={<PriceTooltip />} cursor={{ fill: "#f8fafc" }} />
                <ReferenceLine y={result.value} stroke={COLORS.amber} strokeDasharray="4 2" label={{ value: zh ? "AI估值" : "AI", fontSize: 10, fill: COLORS.amber }} />
                <Bar dataKey="v" name={zh ? "成交价" : "Price"} radius={[4, 4, 0, 0]}>
                  {[stat.min, stat.p25, stat.median, stat.p75, stat.max].map((_, i) => (
                    <Cell key={i} fill={i === 2 ? COLORS.primary : COLORS.primaryLight} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[11px] text-gray-400">
            {zh
              ? "箱体显示 P25~P75 集中区间，虚线为本次 AI 估值位置。区间越窄，市场定价越透明。"
              : "The box shows the P25–P75 concentration; the dashed line marks this AI estimate."}
          </p>
        </ChartCard>
      )}

      {/* ③ 补贴后净购置价 */}
      {subsidyBlock && (
        <ChartCard
          title={zh ? "② 补贴后净购置价" : "② Net Price After Subsidy"}
          subtitle={zh ? "市场均价 vs 农户实际净支出 vs 中央补贴" : "Market avg vs farmer net outlay vs central subsidy"}
          zh={zh}
        >
          <div style={{ width: "100%", height: 200 }}>
            <ResponsiveContainer>
              <BarChart data={[
                { name: zh ? "市场均价" : "Market", v: subsidyBlock.market },
                { name: zh ? "农户净支出" : "Net", v: subsidyBlock.net },
                { name: zh ? "中央补贴" : "Subsidy", v: subsidyBlock.central },
              ]} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tickFormatter={(v) => formatValuationMoney(Number(v))} tick={{ fontSize: 10 }} stroke="#94a3b8" width={56} />
                <Tooltip content={<PriceTooltip />} cursor={{ fill: "#f8fafc" }} />
                <Bar dataKey="v" radius={[4, 4, 0, 0]}>
                  <Cell fill={COLORS.primary} />
                  <Cell fill={COLORS.green} />
                  <Cell fill={COLORS.amber} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[11px] text-gray-500">
            {zh
              ? `中央补贴覆盖约 ${fmtPct(subsidyBlock.ratio)}（市场均价 ${formatValuationMoney(subsidyBlock.market)} → 农户净支出 ${formatValuationMoney(subsidyBlock.net)}）。`
              : `Central subsidy covers ~${fmtPct(subsidyBlock.ratio)} (market ${formatValuationMoney(subsidyBlock.market)} → net ${formatValuationMoney(subsidyBlock.net)}).`}
          </p>
        </ChartCard>
      )}

      {/* ④ 区域比价 */}
      {intelligence.regional && (
        <ChartCard
          title={zh ? "③ 区域比价（省份价格指数）" : "③ Regional Price Index"}
          subtitle={zh ? "以全国均价为基准（1.0）；蓝柱为当前所选省份" : "National avg = 1.0; blue bar = your selected province"}
          zh={zh}
        >
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={intelligence.regional.list} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="province" tick={{ fontSize: 10 }} stroke="#94a3b8" interval={0} angle={-20} textAnchor="end" height={48} />
                <YAxis tickFormatter={(v) => `${Number(v).toFixed(1)}`} tick={{ fontSize: 10 }} stroke="#94a3b8" width={36} />
                <Tooltip
                  content={({ active, payload }: any) => {
                    if (!active || !payload || !payload.length) return null;
                    const p = payload[0].payload as { province: string; index: number; median: number };
                    return (
                      <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-md">
                        <div className="font-medium text-gray-700">{p.province}</div>
                        <div className="text-gray-500">指数：<b className="text-gray-800">{p.index.toFixed(2)}</b></div>
                        <div className="text-gray-500">均价：<b className="text-gray-800">{formatValuationMoney(p.median)}</b></div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="index" name={zh ? "价格指数" : "Index"} radius={[4, 4, 0, 0]}>
                  {intelligence.regional!.list.map((p, i) => (
                    <Cell key={i} fill={intelligence.regional!.current?.province === p.province ? COLORS.primary : COLORS.primaryLight} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {intelligence.regional.current && (
            <p className="mt-2 text-[11px] text-gray-500">
              {zh
                ? `当前省份「${intelligence.regional.current.province}」价格指数 ${intelligence.regional.current.index.toFixed(2)}（${intelligence.regional.current.index >= 1 ? "高于" : "低于"}全国均价），样本 ${intelligence.regional.current.n.toLocaleString()} 条。`
                : `Your province "${intelligence.regional.current.province}" index ${intelligence.regional.current.index.toFixed(2)} (${intelligence.regional.current.index >= 1 ? "above" : "below"} national avg), n=${intelligence.regional.current.n.toLocaleString()}.`}
            </p>
          )}
        </ChartCard>
      )}

      {/* ⑤ 折旧曲线 */}
      {intelligence.depreciation && intelligence.depreciation.curve.length > 0 && (
        <ChartCard
          title={zh ? "④ 折旧曲线（品类机龄残值率）" : "④ Depreciation Curve"}
          subtitle={zh ? `${intelligence.depreciation.category} · 残值率 = 该机龄均价 / 参考新机中位价` : `${intelligence.depreciation.category} · residual = age price / ref new median`}
          zh={zh}
        >
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <LineChart data={intelligence.depreciation.curve.map((p) => ({ age: p.age, residual: Math.round(p.residual * 100) }))} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="age" tick={{ fontSize: 11 }} stroke="#94a3b8" unit={zh ? "年" : "y"} />
                <YAxis tickFormatter={(v) => `${Number(v)}%`} tick={{ fontSize: 10 }} stroke="#94a3b8" width={40} domain={[0, 130]} />
                <Tooltip formatter={(v: any) => [`${Number(v)}%`, zh ? "残值率" : "Residual"]} />
                {meta.ageYears != null && meta.ageYears > 0 && (
                  <ReferenceLine x={meta.ageYears} stroke={COLORS.amber} strokeDasharray="4 2" label={{ value: zh ? `本机${meta.ageYears}年` : `${meta.ageYears}y`, fontSize: 10, fill: COLORS.amber }} />
                )}
                <Line type="monotone" dataKey="residual" name={zh ? "残值率" : "Residual"} stroke={COLORS.primary} strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[11px] text-gray-400">
            {zh
              ? `参考新机中位价 ${formatValuationMoney(intelligence.depreciation.refNewMedian)}；极端机龄样本已隐藏。`
              : `Ref new median ${formatValuationMoney(intelligence.depreciation.refNewMedian)}; extreme-age samples hidden.`}
          </p>
        </ChartCard>
      )}

      {/* ⑥ 品牌残值率（同品类保值排行） */}
      {intelligence.brandRanking && intelligence.brandRanking.top.length > 0 && (
        <ChartCard
          title={zh ? "⑤ 品牌残值率（同品类保值排行）" : "⑤ Brand Residual Ranking"}
          subtitle={zh ? `${intelligence.brandRanking.category} · 按净购置价排序，共 ${intelligence.brandRanking.total} 个品牌` : `${intelligence.brandRanking.category} · by net price, ${intelligence.brandRanking.total} brands`}
          zh={zh}
        >
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={intelligence.brandRanking.top} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tickFormatter={(v) => formatValuationMoney(Number(v))} tick={{ fontSize: 9 }} stroke="#94a3b8" />
                <YAxis type="category" dataKey="brand" tick={{ fontSize: 10 }} stroke="#94a3b8" width={72} />
                <Tooltip content={<PriceTooltip />} cursor={{ fill: "#f8fafc" }} />
                <Bar dataKey="netMedian" name={zh ? "净购置价" : "Net"} radius={[0, 4, 4, 0]}>
                  {intelligence.brandRanking.top.map((b, i) => (
                    <Cell key={i} fill={intelligence.brandRanking!.current?.brand === b.brand ? COLORS.green : COLORS.greenLight} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {intelligence.brandRanking.current && intelligence.brandRanking.currentRank && (
            <p className="mt-2 text-[11px] text-gray-500">
              {zh
                ? `本品牌「${intelligence.brandRanking.current.brand}」在同品类 ${intelligence.brandRanking.total} 个品牌中保值排名第 ${intelligence.brandRanking.currentRank}（净购置价 ${formatValuationMoney(intelligence.brandRanking.current.netMedian)}）。`
                : `Your brand ranks #${intelligence.brandRanking.currentRank} of ${intelligence.brandRanking.total} (net ${formatValuationMoney(intelligence.brandRanking.current.netMedian)}).`}
            </p>
          )}
        </ChartCard>
      )}

      {/* ⑦ 补贴退坡趋势 */}
      {subsidyHistory.length > 0 && (
        <ChartCard
          title={zh ? "⑥ 补贴退坡趋势（真实历史）" : "⑥ Subsidy Retreat Trend"}
          subtitle={zh ? `${meta.brand} ${meta.category} 逐年均价 / 平均补贴` : `${meta.brand} ${meta.category} yearly avg price / subsidy`}
          zh={zh}
        >
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <LineChart data={subsidyHistory} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tickFormatter={(v) => formatValuationMoney(Number(v))} tick={{ fontSize: 10 }} stroke="#94a3b8" width={56} />
                <Tooltip content={<PriceTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="avgPrice" name={zh ? "平均售价" : "Avg Price"} stroke={COLORS.primary} strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="avgSubsidy" name={zh ? "平均补贴" : "Avg Subsidy"} stroke={COLORS.green} strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[11px] text-gray-400">
            {zh
              ? `数据来源：${subsidyHistory.reduce((s, d) => s + (d.count || 0), 0).toLocaleString()} 条真实交易记录。`
              : `Source: ${subsidyHistory.reduce((s, d) => s + (d.count || 0), 0).toLocaleString()} real records.`}
          </p>
        </ChartCard>
      )}

      {/* ⑧ 专业机构对标 */}
      <ChartCard
        title={zh ? "⑦ 专业机构对标" : "⑦ vs Professional Benchmarks"}
        subtitle={zh ? "神雕 AI 估值 vs 国际二手农机估值标杆" : "ShenDiao AI vs global used-machinery valuation benchmarks"}
        zh={zh}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="py-1.5 pr-2 font-medium">{zh ? "维度" : "Dimension"}</th>
                <th className="py-1.5 px-2 font-semibold text-indigo-700">{zh ? "神雕 AI 估值" : "ShenDiao AI"}</th>
                <th className="py-1.5 px-2 font-medium">{zh ? "IronGuides" : "IronGuides"}</th>
                <th className="py-1.5 px-2 font-medium">{zh ? "KBB(农机)" : "KBB"}</th>
                <th className="py-1.5 px-2 font-medium">{zh ? "农机360" : "Nongji360"}</th>
              </tr>
            </thead>
            <tbody className="text-gray-700">
              <tr className="border-b border-gray-50">
                <td className="py-1.5 pr-2 text-gray-500">{zh ? "数据规模" : "Data scale"}</td>
                <td className="py-1.5 px-2 font-semibold text-indigo-700">{zh ? "866万条" : "8.66M"}</td>
                <td className="py-1.5 px-2">~900亿美元</td>
                <td className="py-1.5 px-2">—</td>
                <td className="py-1.5 px-2">样本有限</td>
              </tr>
              <tr className="border-b border-gray-50">
                <td className="py-1.5 pr-2 text-gray-500">{zh ? "覆盖区域" : "Coverage"}</td>
                <td className="py-1.5 px-2 font-semibold text-indigo-700">{zh ? "中国 25 省" : "25 CN provinces"}</td>
                <td className="py-1.5 px-2">全球</td>
                <td className="py-1.5 px-2">北美</td>
                <td className="py-1.5 px-2">中国</td>
              </tr>
              <tr className="border-b border-gray-50">
                <td className="py-1.5 pr-2 text-gray-500">{zh ? "更新频率" : "Freshness"}</td>
                <td className="py-1.5 px-2 font-semibold text-indigo-700">{zh ? "每日" : "Daily"}</td>
                <td className="py-1.5 px-2">季度</td>
                <td className="py-1.5 px-2">月度</td>
                <td className="py-1.5 px-2">不定期</td>
              </tr>
              <tr className="border-b border-gray-50">
                <td className="py-1.5 pr-2 text-gray-500">{zh ? "多模态识别" : "Multimodal"}</td>
                <td className="py-1.5 px-2 font-semibold text-indigo-700">{zh ? "图片+视频 AI" : "Img+Video"}</td>
                <td className="py-1.5 px-2">否</td>
                <td className="py-1.5 px-2">否</td>
                <td className="py-1.5 px-2">否</td>
              </tr>
              <tr>
                <td className="py-1.5 pr-2 text-gray-500">{zh ? "置信区间" : "CI"}</td>
                <td className="py-1.5 px-2 font-semibold text-indigo-700">{zh ? "真实P25~P75" : "Real P25~P75"}</td>
                <td className="py-1.5 px-2">区间估值</td>
                <td className="py-1.5 px-2">区间估值</td>
                <td className="py-1.5 px-2">无</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-gray-400">
          {zh
            ? "注：国际二手农机无统一「Kelley Blue Book」，IronGuides 为行业金标准；神雕以中国真实补贴成交为底座，提供带数据置信区间的透明估值。"
            : "Note: no unified farm-machinery KBB exists globally; IronGuides is the gold standard. ShenDiao is grounded in real China subsidy transactions with data-driven CIs."}
        </p>
      </ChartCard>

      <div className="px-1 pb-1 text-center text-[10px] text-gray-400">
        {zh
          ? "神雕农机 usedfarmmach.com · 本报告由真实交易数据驱动生成，仅供参考，不构成交易建议"
          : "usedfarmmach.com · data-driven report for reference only"}
      </div>
    </div>
  );
}
