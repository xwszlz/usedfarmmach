import { Wrench, Calendar, Clock, Cpu, Gauge, Cog, Settings, Ruler, Weight, CheckCircle2, MapPin, Tag } from "lucide-react";

interface SpecRow {
  label: string;
  value: string | number | null | undefined;
  fallback?: string;
}

interface SpecificationTableProps {
  brandName: string;
  modelName: string;
  year: number;
  workingHours: number | null;
  engineType: string | null;
  enginePower: number | null;
  driveSystem: string | null;
  mainConfig: string | null;
  overallLength: number | null;
  overallWidth: number | null;
  overallHeight: number | null;
  netWeight: number | null;
  conditionLabel: string;
  categoryName: string;
  location: string;
  locale: string;
}

const LABELS: Record<string, Record<string, string>> = {
  zh: {
    brand: "品牌",
    model: "型号",
    year: "年份",
    workingHours: "工作小时",
    engineType: "发动机类型",
    ratedPower: "额定功率(HP)",
    driveSystem: "传动方式",
    mainConfig: "主要配置",
    overallDimension: "外形尺寸(长×宽×高 mm)",
    netWeight: "整机重量(KG)",
    category: "品类",
    location: "产地",
    condition: "设备状况",
    hoursUnit: "小时",
    notAvailable: "暂无",
  },
  en: {
    brand: "Brand",
    model: "Model",
    year: "Year",
    workingHours: "Working Hours",
    engineType: "Engine Type",
    ratedPower: "Rated Power(HP)",
    driveSystem: "Drive System",
    mainConfig: "Main Configuration",
    overallDimension: "Overall Dimension(L×W×H mm)",
    netWeight: "Net Weight(KG)",
    category: "Category",
    location: "Location",
    condition: "Condition",
    hoursUnit: "hrs",
    notAvailable: "N/A",
  },
  ru: {
    brand: "Бренд",
    model: "Модель",
    year: "Год",
    workingHours: "Моточасы",
    engineType: "Тип двигателя",
    ratedPower: "Мощность(л.с.)",
    driveSystem: "Привод",
    mainConfig: "Конфигурация",
    overallDimension: "Габариты(Д×Ш×В мм)",
    netWeight: "Вес(КГ)",
    category: "Категория",
    location: "Местоположение",
    condition: "Состояние",
    hoursUnit: "моточасов",
    notAvailable: "Н/Д",
  },
};

export function SpecificationTable({
  brandName,
  modelName,
  year,
  workingHours,
  engineType,
  enginePower,
  driveSystem,
  mainConfig,
  overallLength,
  overallWidth,
  overallHeight,
  netWeight,
  conditionLabel,
  categoryName,
  location,
  locale,
}: SpecificationTableProps) {
  const l = LABELS[locale] || LABELS.en;

  const formatDimension = (): string => {
    const parts = [overallLength, overallWidth, overallHeight];
    if (parts.every((p) => p == null)) return l.notAvailable;
    const formatted = parts.map((p) => (p != null ? String(p) : "—"));
    return `${formatted[0]}×${formatted[1]}×${formatted[2]}`;
  };

  const rows: { icon: React.ReactNode; label: string; value: string }[] = [
    { icon: <Wrench className="h-4 w-4 text-gray-400" />, label: l.brand, value: brandName },
    { icon: <Settings className="h-4 w-4 text-gray-400" />, label: l.model, value: modelName },
    { icon: <Tag className="h-4 w-4 text-gray-400" />, label: l.category, value: categoryName },
    { icon: <Calendar className="h-4 w-4 text-gray-400" />, label: l.year, value: String(year) },
    {
      icon: <Clock className="h-4 w-4 text-gray-400" />,
      label: l.workingHours,
      value: workingHours != null ? `${workingHours.toLocaleString()} ${l.hoursUnit}` : l.notAvailable,
    },
    {
      icon: <Cpu className="h-4 w-4 text-gray-400" />,
      label: l.engineType,
      value: engineType || l.notAvailable,
    },
    {
      icon: <Gauge className="h-4 w-4 text-gray-400" />,
      label: l.ratedPower,
      value: enginePower != null ? String(enginePower) : l.notAvailable,
    },
    {
      icon: <Cog className="h-4 w-4 text-gray-400" />,
      label: l.driveSystem,
      value: driveSystem || l.notAvailable,
    },
    {
      icon: <Settings className="h-4 w-4 text-gray-400" />,
      label: l.mainConfig,
      value: mainConfig || l.notAvailable,
    },
    {
      icon: <Ruler className="h-4 w-4 text-gray-400" />,
      label: l.overallDimension,
      value: formatDimension(),
    },
    {
      icon: <Weight className="h-4 w-4 text-gray-400" />,
      label: l.netWeight,
      value: netWeight != null ? netWeight.toLocaleString() : l.notAvailable,
    },
    {
      icon: <MapPin className="h-4 w-4 text-gray-400" />,
      label: l.location,
      value: location || l.notAvailable,
    },
    {
      icon: <CheckCircle2 className="h-4 w-4 text-gray-400" />,
      label: l.condition,
      value: conditionLabel,
    },
  ];

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <table className="w-full">
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={row.label}
              className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}
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
