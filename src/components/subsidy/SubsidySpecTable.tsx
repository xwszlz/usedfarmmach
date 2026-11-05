/**
 * SubsidySpecTable —— 补贴归档机型规格表
 * ===========================================================================
 * 镜像 src/components/product/specification-table.tsx 的表格样式（overflow-hidden
 * rounded-lg border / tbody tr 交替底色 / lucide 图标 / 内联 LABELS），但**不读
 * messages/*.json**（8 语全 CRLF，禁止重序列化）。.cn 仅需 zh/en，故只内置这两套。
 *
 * 只展示【公开聚合层】字段，绝不含购机者姓名 / 出厂编号 / 县乡 / 单条成交价等 PII。
 */

import {
  Tag,
  Wrench,
  Factory,
  Layers,
  MapPin,
  CalendarRange,
  Hourglass,
  Hash,
  TrendingUp,
  PiggyBank,
  Package,
  Clock,
} from "lucide-react";

interface SubsidySpecTableProps {
  brandName: string;
  category: string;
  modelName: string;
  manufacturer: string;
  subsidyTier: string;
  provinceCoverage: string;
  policyYearRange: string;
  machineAgeRange: string;
  sampleSize: number;
  p25PriceCny: number | null;
  medianPriceCny: number;
  p75PriceCny: number | null;
  medianCentralSubsidy: number | null;
  medianTotalSubsidy: number | null;
  batchCode: string;
  updatedAt: string;
  locale: string;
}

const LABELS: Record<string, Record<string, string>> = {
  zh: {
    brand: "品牌",
    category: "品类",
    model: "型号",
    manufacturer: "生产厂家（法人全称）",
    subsidyTier: "补贴分档",
    provinceCoverage: "覆盖省份",
    policyYearRange: "兑付年份区间",
    machineAgeRange: "机龄区间",
    sampleSize: "样本量 n",
    priceBand: "新机成交价（元）",
    median: "中位数",
    p25: "P25（低）",
    p75: "P75（高）",
    subsidy: "补贴额（元）",
    central: "中央补贴中位数",
    total: "总补贴中位数",
    batch: "数据批次",
    updated: "更新时间",
    notAvailable: "暂无",
  },
  en: {
    brand: "Brand",
    category: "Category",
    model: "Model",
    manufacturer: "Manufacturer (legal name)",
    subsidyTier: "Subsidy tier",
    provinceCoverage: "Provinces covered",
    policyYearRange: "Payout year range",
    machineAgeRange: "Machine age range",
    sampleSize: "Sample size n",
    priceBand: "New-machine price (CNY)",
    median: "Median",
    p25: "P25 (low)",
    p75: "P75 (high)",
    subsidy: "Subsidy (CNY)",
    central: "Median central subsidy",
    total: "Median total subsidy",
    batch: "Data batch",
    updated: "Updated at",
    notAvailable: "N/A",
  },
};

function fmtCny(v: number | null | undefined): string {
  if (v == null) return "";
  return "¥" + Math.round(v).toLocaleString("zh-CN");
}

export function SubsidySpecTable({
  brandName,
  category,
  modelName,
  manufacturer,
  subsidyTier,
  provinceCoverage,
  policyYearRange,
  machineAgeRange,
  sampleSize,
  p25PriceCny,
  medianPriceCny,
  p75PriceCny,
  medianCentralSubsidy,
  medianTotalSubsidy,
  batchCode,
  updatedAt,
  locale,
}: SubsidySpecTableProps) {
  const l = LABELS[locale] || LABELS.zh;

  const priceValue = `${fmtCny(p25PriceCny) || l.notAvailable} / ${fmtCny(
    medianPriceCny
  )} / ${fmtCny(p75PriceCny) || l.notAvailable}`;

  const subsidyValue =
    medianCentralSubsidy != null || medianTotalSubsidy != null
      ? `${fmtCny(medianCentralSubsidy) || l.notAvailable} / ${fmtCny(
          medianTotalSubsidy
        ) || l.notAvailable}`
      : l.notAvailable;

  const rows: { icon: React.ReactNode; label: string; value: string }[] = [
    { icon: <Tag className="h-4 w-4 text-gray-400" />, label: l.category, value: category },
    { icon: <Wrench className="h-4 w-4 text-gray-400" />, label: l.model, value: modelName },
    {
      icon: <Factory className="h-4 w-4 text-gray-400" />,
      label: l.manufacturer,
      value: manufacturer,
    },
    {
      icon: <Layers className="h-4 w-4 text-gray-400" />,
      label: l.subsidyTier,
      value: subsidyTier,
    },
    {
      icon: <MapPin className="h-4 w-4 text-gray-400" />,
      label: l.provinceCoverage,
      value: provinceCoverage,
    },
    {
      icon: <CalendarRange className="h-4 w-4 text-gray-400" />,
      label: l.policyYearRange,
      value: policyYearRange,
    },
    {
      icon: <Hourglass className="h-4 w-4 text-gray-400" />,
      label: l.machineAgeRange,
      value: machineAgeRange,
    },
    {
      icon: <Hash className="h-4 w-4 text-gray-400" />,
      label: l.sampleSize,
      value: String(sampleSize),
    },
    {
      icon: <TrendingUp className="h-4 w-4 text-gray-400" />,
      label: l.priceBand,
      value: priceValue,
    },
    {
      icon: <PiggyBank className="h-4 w-4 text-gray-400" />,
      label: l.subsidy,
      value: subsidyValue,
    },
    {
      icon: <Package className="h-4 w-4 text-gray-400" />,
      label: l.batch,
      value: batchCode,
    },
    {
      icon: <Clock className="h-4 w-4 text-gray-400" />,
      label: l.updated,
      value: updatedAt,
    },
  ];

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <table className="w-full">
        <tbody>
          <tr className="bg-white">
            <td className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-gray-600">
              {rows[0].icon}
              {rows[0].label}
            </td>
            <td className="px-4 py-3 text-sm text-gray-900">{brandName}</td>
          </tr>
          {rows.slice(1).map((row, idx) => (
            <tr
              key={row.label}
              className={(idx + 1) % 2 === 0 ? "bg-gray-50/50" : "bg-white"}
            >
              <td className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-gray-600">
                {row.icon}
                {row.label}
              </td>
              <td className="px-4 py-3 text-sm text-gray-900">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
