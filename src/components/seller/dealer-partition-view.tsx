"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Store, Globe, Layers, MapPin, ShieldCheck } from "lucide-react";
import type { DealerPublic, DealerPartitions } from "@/lib/sales-strategy/types";
import {
  resolveGrade,
  type DealerGrade,
  type GradeContext,
} from "@/lib/sales-strategy/grading";
import { aggregateByRegion } from "@/lib/sales-strategy/region-stats";

/** 分级配色（A/B/C） */
const GRADE_BADGE: Record<string, string> = {
  A: "bg-green-100 text-green-700",
  B: "bg-blue-100 text-blue-700",
  C: "bg-gray-100 text-gray-600",
};

/** 分级顺序（用于筛选 chip 渲染） */
const GRADE_ORDER: DealerGrade[] = ["A", "B", "C"];

interface DealerPartitionViewProps {
  /** 默认查询口径，默认 all（本站两分区） */
  partition?: "all" | "cn" | "intl";
  locale?: string;
  /** 标题（默认按 locale 自动） */
  title?: string;
  /** 可选产品上下文（提供时按品牌/机型实时算分级；缺省沿用库内 grade） */
  gradeContext?: GradeContext;
}

/**
 * 双站经销商分区视图（T4）
 * ─────────────────────────────────────────────────────────
 * 调用 /api/agents/seller-helper/sales-strategy/dealers，按「境内 / 跨境候选」
 * 两分区展示渠道经销商（联系方式已脱敏）。
 *
 * T5 落地：
 *   - <DealerGradePanel/>   —— A/B/C 实时分级 + 点击筛选（容器持有 selectedGrades，
 *                              过滤后传给 DealerSection，标题显示「过滤后/总数」）
 *   - <DealerRegionMap/>    —— 区域聚合水平条形列表（MVP 列表，不引入 d3 地图）
 */
export default function DealerPartitionView({
  partition = "all",
  locale = "zh",
  title,
  gradeContext,
}: DealerPartitionViewProps) {
  const [data, setData] = useState<DealerPartitions | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // T5：当前选中的分级集合（空集合 = 全选，避免用户点到空列表）
  const [selectedGrades, setSelectedGrades] = useState<Set<DealerGrade>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/agents/seller-helper/sales-strategy/dealers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partition, locale }),
      });
      const json = await res.json();
      if (json?.success) {
        setData(json.data as DealerPartitions);
      } else {
        setError(json?.error || "加载失败");
      }
    } catch {
      setError("网络错误，无法加载经销商分区");
    } finally {
      setLoading(false);
    }
  }, [partition, locale]);

  useEffect(() => {
    load();
  }, [load]);

  // 全部分区经销商（境内 + 跨境候选）
  const allDealers = useMemo(
    () => (data ? [...data.domestic, ...data.international] : []),
    [data]
  );

  // 单个经销商是否命中当前分级筛选（空集合 = 全选）
  const matches = useCallback(
    (d: DealerPublic) =>
      selectedGrades.size === 0 || selectedGrades.has(resolveGrade(d, gradeContext)),
    [selectedGrades, gradeContext]
  );

  const filteredDomestic = useMemo(
    () => (data?.domestic ?? []).filter(matches),
    [data, matches]
  );
  const filteredInternational = useMemo(
    () => (data?.international ?? []).filter(matches),
    [data, matches]
  );

  const toggleGrade = useCallback((g: DealerGrade) => {
    setSelectedGrades((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next; // 全部取消 = 空集合 = 视为全选
    });
  }, []);

  const defaultTitle = locale === "zh" ? "渠道经销商分区" : "Channel Dealers";

  return (
    <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50/50 to-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Layers className="h-5 w-5 text-blue-600" />
        <h3 className="text-base font-bold text-gray-900">{title || defaultTitle}</h3>
        {data && (
          <span className="text-xs text-gray-400">
            {locale === "zh" ? "站点" : "site"}: {data.site}
          </span>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-8 text-sm text-gray-400">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
          {locale === "zh" ? "正在加载经销商分区..." : "Loading dealer partitions..."}
        </div>
      )}

      {error && (
        <div className="py-4 text-sm text-gray-400">
          {error}
        </div>
      )}

      {data && !loading && (
        <div className="space-y-4">
          {/* T5：A/B/C 分级与筛选 */}
          <DealerGradePanel
            dealers={allDealers}
            locale={locale}
            ctx={gradeContext}
            selected={selectedGrades}
            onToggle={toggleGrade}
          />

          {/* 境内分区（过滤后） */}
          <DealerSection
            icon={<Store className="h-4 w-4 text-green-600" />}
            heading={locale === "zh" ? "境内经销商" : "Domestic Dealers"}
            count={filteredDomestic.length}
            total={data.domestic.length}
            dealers={filteredDomestic}
            emptyText={locale === "zh" ? "本站点无境内经销商" : "No domestic dealers on this site"}
            locale={locale}
            gradeContext={gradeContext}
          />

          {/* 跨境候选分区（过滤后） */}
          <DealerSection
            icon={<Globe className="h-4 w-4 text-purple-600" />}
            heading={locale === "zh" ? "跨境候选经销商" : "International Candidates"}
            count={filteredInternational.length}
            total={data.international.length}
            dealers={filteredInternational}
            emptyText={locale === "zh" ? "暂无跨境候选" : "No international candidates"}
            locale={locale}
            gradeContext={gradeContext}
          />

          {/* T5：区域聚合（MVP 水平条形列表） */}
          <DealerRegionMap dealers={allDealers} locale={locale} ctx={gradeContext} />

          <p className="text-center text-xs text-gray-400">
            {locale === "zh"
              ? "联系方式已脱敏；解锁明文需积分解锁（unlock-contact）"
              : "Contacts masked; unlock plaintext via credits (unlock-contact)"}
          </p>
        </div>
      )}
    </div>
  );
}

/** 单分区区块 */
function DealerSection({
  icon,
  heading,
  count,
  total,
  dealers,
  emptyText,
  locale,
  gradeContext,
}: {
  icon: React.ReactNode;
  heading: string;
  count: number;
  total: number;
  dealers: DealerPublic[];
  emptyText: string;
  locale: string;
  gradeContext?: GradeContext;
}) {
  const zh = locale === "zh";
  const countLabel = total !== count ? `${count}/${total}` : `${total}`;

  if (count === 0) {
    const msg = total > 0 ? (zh ? "无符合当前筛选的经销商" : "No dealers match the filter") : emptyText;
    return (
      <div className="rounded-lg border border-gray-200 bg-white/80 p-3">
        <div className="mb-2 flex items-center gap-1.5">
          {icon}
          <span className="text-sm font-semibold text-gray-700">{heading}</span>
          <span className="text-xs text-gray-400">{countLabel}</span>
        </div>
        <p className="text-sm text-gray-400">{msg}</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-gray-200 bg-white/80 p-3">
      <div className="mb-2 flex items-center gap-1.5">
        {icon}
        <span className="text-sm font-semibold text-gray-700">{heading}</span>
        <span className="text-xs text-gray-400">{countLabel}</span>
      </div>
      <div className="space-y-2">
        {dealers.map((d) => (
          <DealerRow key={d.id} dealer={d} locale={locale} gradeContext={gradeContext} />
        ))}
      </div>
    </div>
  );
}

/** 单个经销商行 */
function DealerRow({
  dealer,
  locale,
  gradeContext,
}: {
  dealer: DealerPublic;
  locale: string;
  gradeContext?: GradeContext;
}) {
  const grade = resolveGrade(dealer, gradeContext);
  return (
    <div className="rounded border border-gray-100 bg-white p-2.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-900">{dealer.name || "—"}</span>
        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${GRADE_BADGE[grade] || "bg-gray-100 text-gray-600"}`}>
          {grade}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap gap-1 text-xs text-gray-500">
        {dealer.brands.map((b) => (
          <span key={b} className="rounded bg-gray-100 px-1.5 py-0.5">{b}</span>
        ))}
        {dealer.models.slice(0, 4).map((m) => (
          <span key={m} className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-600">{m}</span>
        ))}
        {dealer.regions.map((r) => (
          <span key={r} className="rounded bg-green-50 px-1.5 py-0.5 text-green-700">{r}</span>
        ))}
        {dealer.nature && (
          <span className="rounded bg-orange-50 px-1.5 py-0.5 text-orange-600">{dealer.nature}</span>
        )}
      </div>
      <div className="mt-1 text-xs text-gray-400">
        {dealer.phoneMasked && <span className="mr-3">📞 {dealer.phoneMasked}</span>}
        {dealer.wechatMasked && <span className="mr-3">💬 {dealer.wechatMasked}</span>}
        {dealer.emailMasked && <span>✉️ {dealer.emailMasked}</span>}
      </div>
      {dealer.sourceUrl && (
        <a
          href={dealer.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-block text-xs text-blue-500 hover:underline"
        >
          {locale === "zh" ? "来源链接" : "Source"} ↗
        </a>
      )}
    </div>
  );
}

/**
 * ── T5 挂载点 1：A/B/C 分级与筛选 ──
 * 三个可点 chip（A/B/C + 数量）。受控优先：传入 selected + onToggle 即受控；
 * 否则内部自持 state。**空集合 = 全选**（避免用户点到空列表）。
 */
export function DealerGradePanel({
  dealers,
  locale,
  ctx,
  selected,
  onToggle,
}: {
  dealers: DealerPublic[];
  locale: string;
  ctx?: GradeContext;
  selected?: Set<DealerGrade>;
  onToggle?: (g: DealerGrade) => void;
}) {
  const zh = locale === "zh";
  const [internal, setInternal] = useState<Set<DealerGrade>>(new Set());
  const active = selected ?? internal;

  const toggle = (g: DealerGrade) => {
    if (onToggle) {
      onToggle(g);
      return;
    }
    setInternal((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });
  };

  const dist: Record<DealerGrade, number> = { A: 0, B: 0, C: 0 };
  for (const d of dealers) {
    dist[resolveGrade(d, ctx)] += 1;
  }

  const isAll = active.size === 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-white/80 p-3">
      <div className="mb-1.5 flex items-center gap-1.5">
        <ShieldCheck className="h-4 w-4 text-blue-600" />
        <span className="text-sm font-semibold text-gray-700">
          {zh ? "A/B/C 分级分布" : "A/B/C Grade Distribution"}
        </span>
        <span className="text-[10px] text-gray-400">
          {zh ? "（点击筛选）" : "(click to filter)"}
        </span>
        {!isAll && (
          <button
            type="button"
            onClick={() => {
              // 清空全部选中 → 回到全选
              for (const g of GRADE_ORDER) {
                if (active.has(g)) toggle(g);
              }
            }}
            className="ml-auto text-[11px] text-gray-400 underline hover:text-gray-600"
          >
            {zh ? "清除筛选" : "Clear"}
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        {GRADE_ORDER.map((g) => {
          const on = isAll || active.has(g);
          return (
            <button
              key={g}
              type="button"
              onClick={() => toggle(g)}
              aria-pressed={on}
              className={`rounded px-2 py-0.5 font-medium transition ${GRADE_BADGE[g]} ${
                on ? "border-2 border-current" : "border-2 border-transparent opacity-40"
              }`}
            >
              {g}: {dist[g]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * ── T5 挂载点 2：区域聚合 ──
 * 渲染「地区 → 数量 + A/B/C 分级分布」水平条形列表：
 *   - 条宽按 total / maxTotal 百分比；
 *   - 条内按 A/B/C 分段堆叠（A 绿 / B 蓝 / C 灰）。
 * MVP 走列表，不引入 d3 地图（避免往客户端塞 250KB）。
 */
export function DealerRegionMap({
  dealers,
  locale,
  ctx,
}: {
  dealers: DealerPublic[];
  locale: string;
  ctx?: GradeContext;
}) {
  const zh = locale === "zh";
  const stats = aggregateByRegion(dealers, ctx);
  const maxTotal = stats.reduce((m, s) => Math.max(m, s.total), 0) || 1;

  return (
    <div className="rounded-lg border border-gray-200 bg-white/80 p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <MapPin className="h-4 w-4 text-blue-600" />
        <span className="text-sm font-semibold text-gray-700">
          {zh ? "区域聚合" : "Region Aggregation"}
        </span>
      </div>
      {stats.length === 0 ? (
        <span className="text-xs text-gray-400">{zh ? "暂无数据" : "No data"}</span>
      ) : (
        <div className="space-y-2">
          {stats.map((s) => {
            const barPct = (s.total / maxTotal) * 100;
            return (
              <div key={s.region}>
                <div className="mb-0.5 flex items-center justify-between text-xs">
                  <span className="text-gray-600">{s.region}</span>
                  <span className="text-gray-500">
                    {s.total}
                    <span className="ml-1 text-[10px] text-gray-400">
                      {s.A > 0 && <span className="text-green-600">A{s.A} </span>}
                      {s.B > 0 && <span className="text-blue-600">B{s.B} </span>}
                      {s.C > 0 && <span className="text-gray-500">C{s.C}</span>}
                    </span>
                  </span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded bg-gray-100">
                  <div className="flex h-full" style={{ width: `${barPct}%` }}>
                    {s.A > 0 && (
                      <div
                        className="h-full bg-green-500"
                        style={{ width: `${(s.A / s.total) * 100}%` }}
                        title={`A: ${s.A}`}
                      />
                    )}
                    {s.B > 0 && (
                      <div
                        className="h-full bg-blue-500"
                        style={{ width: `${(s.B / s.total) * 100}%` }}
                        title={`B: ${s.B}`}
                      />
                    )}
                    {s.C > 0 && (
                      <div
                        className="h-full bg-gray-400"
                        style={{ width: `${(s.C / s.total) * 100}%` }}
                        title={`C: ${s.C}`}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
