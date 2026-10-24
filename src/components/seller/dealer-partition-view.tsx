"use client";

import { useState, useEffect, useCallback } from "react";
import { Store, Globe, Layers, MapPin, ShieldCheck } from "lucide-react";
import type { DealerPublic, DealerPartitions } from "@/lib/sales-strategy/types";

/** 分级配色（A/B/C） */
const GRADE_BADGE: Record<string, string> = {
  A: "bg-green-100 text-green-700",
  B: "bg-blue-100 text-blue-700",
  C: "bg-gray-100 text-gray-600",
};

interface DealerPartitionViewProps {
  /** 默认查询口径，默认 all（本站两分区） */
  partition?: "all" | "cn" | "intl";
  locale?: string;
  /** 标题（默认按 locale 自动） */
  title?: string;
}

/**
 * 双站经销商分区视图（T4）
 * ─────────────────────────────────────────────────────────
 * 调用 /api/agents/seller-helper/sales-strategy/dealers，按「境内 / 跨境候选」
 * 两分区展示渠道经销商（联系方式已脱敏）。
 *
 * 挂载点预留（实际逻辑留 T5）：
 *   - <DealerGradePanel/>   —— A/B/C 分级与筛选（T5）
 *   - <DealerRegionMap/>    —— 区域地图聚合（T5，复用 d3 / topojson-client）
 * 二者当前为占位骨架，T5 可直接替换实现而不动本容器。
 */
export default function DealerPartitionView({
  partition = "all",
  locale = "zh",
  title,
}: DealerPartitionViewProps) {
  const [data, setData] = useState<DealerPartitions | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          {/* 预留挂载点：A/B/C 分级与筛选（T5 实现） */}
          <DealerGradePanel dealers={[...data.domestic, ...data.international]} locale={locale} />

          {/* 境内分区 */}
          <DealerSection
            icon={<Store className="h-4 w-4 text-green-600" />}
            heading={locale === "zh" ? "境内经销商" : "Domestic Dealers"}
            count={data.domestic.length}
            dealers={data.domestic}
            emptyText={locale === "zh" ? "本站点无境内经销商" : "No domestic dealers on this site"}
            locale={locale}
          />

          {/* 跨境候选分区 */}
          <DealerSection
            icon={<Globe className="h-4 w-4 text-purple-600" />}
            heading={locale === "zh" ? "跨境候选经销商" : "International Candidates"}
            count={data.international.length}
            dealers={data.international}
            emptyText={locale === "zh" ? "暂无跨境候选" : "No international candidates"}
            locale={locale}
          />

          {/* 预留挂载点：区域地图聚合（T5 实现，复用 d3 / topojson-client） */}
          <DealerRegionMap dealers={[...data.domestic, ...data.international]} locale={locale} />

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
  dealers,
  emptyText,
  locale,
}: {
  icon: React.ReactNode;
  heading: string;
  count: number;
  dealers: DealerPublic[];
  emptyText: string;
  locale: string;
}) {
  if (count === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white/80 p-3">
        <div className="mb-2 flex items-center gap-1.5">
          {icon}
          <span className="text-sm font-semibold text-gray-700">{heading}</span>
          <span className="text-xs text-gray-400">0</span>
        </div>
        <p className="text-sm text-gray-400">{emptyText}</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-gray-200 bg-white/80 p-3">
      <div className="mb-2 flex items-center gap-1.5">
        {icon}
        <span className="text-sm font-semibold text-gray-700">{heading}</span>
        <span className="text-xs text-gray-400">{count}</span>
      </div>
      <div className="space-y-2">
        {dealers.map((d) => (
          <DealerRow key={d.id} dealer={d} locale={locale} />
        ))}
      </div>
    </div>
  );
}

/** 单个经销商行 */
function DealerRow({ dealer, locale }: { dealer: DealerPublic; locale: string }) {
  return (
    <div className="rounded border border-gray-100 bg-white p-2.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-900">{dealer.name || "—"}</span>
        {dealer.grade && (
          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${GRADE_BADGE[dealer.grade] || "bg-gray-100 text-gray-600"}`}>
            {dealer.grade}
          </span>
        )}
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
 * ── T5 挂载点 1：A/B/C 分级与筛选（当前为占位骨架）──
 * T5 将在内部实现 gradeDealer() 实时算 + 按分级筛选，不改动本容器。
 */
export function DealerGradePanel({ dealers, locale }: { dealers: DealerPublic[]; locale: string }) {
  const dist = dealers.reduce<Record<string, number>>((acc, d) => {
    const g = d.grade || "未分级";
    acc[g] = (acc[g] || 0) + 1;
    return acc;
  }, {});
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-white/60 p-3">
      <div className="mb-1.5 flex items-center gap-1.5">
        <ShieldCheck className="h-4 w-4 text-gray-500" />
        <span className="text-sm font-semibold text-gray-600">
          {locale === "zh" ? "A/B/C 分级分布" : "A/B/C Grade Distribution"}
        </span>
        <span className="text-[10px] text-gray-400">{locale === "zh" ? "（T5 上线）" : "(T5)"}</span>
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-gray-500">
        {Object.keys(dist).length === 0 ? (
          <span>{locale === "zh" ? "暂无数据" : "No data"}</span>
        ) : (
          Object.entries(dist).map(([g, n]) => (
            <span key={g} className={`rounded px-1.5 py-0.5 ${GRADE_BADGE[g] || "bg-gray-100 text-gray-600"}`}>
              {g}: {n}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * ── T5 挂载点 2：区域地图聚合（当前为占位骨架）──
 * T5 将复用 d3 + topojson-client 渲染（MVP 先用地区聚合列表）。
 */
export function DealerRegionMap({ dealers, locale }: { dealers: DealerPublic[]; locale: string }) {
  const byRegion = dealers.reduce<Record<string, number>>((acc, d) => {
    for (const r of d.regions) acc[r] = (acc[r] || 0) + 1;
    return acc;
  }, {});
  const entries = Object.entries(byRegion).sort((a, b) => b[1] - a[1]);
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-white/60 p-3">
      <div className="mb-1.5 flex items-center gap-1.5">
        <MapPin className="h-4 w-4 text-gray-500" />
        <span className="text-sm font-semibold text-gray-600">
          {locale === "zh" ? "区域聚合" : "Region Aggregation"}
        </span>
        <span className="text-[10px] text-gray-400">{locale === "zh" ? "（T5 上线地图）" : "(T5 map)"}</span>
      </div>
      {entries.length === 0 ? (
        <span className="text-xs text-gray-400">{locale === "zh" ? "暂无数据" : "No data"}</span>
      ) : (
        <div className="flex max-h-40 flex-wrap gap-2 overflow-auto text-xs text-gray-500">
          {entries.map(([r, n]) => (
            <span key={r} className="rounded bg-gray-100 px-1.5 py-0.5">
              {r}: {n}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
