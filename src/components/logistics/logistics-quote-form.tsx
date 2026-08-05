"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Ship, MapPin, Calculator, Send, CheckCircle2 } from "lucide-react";

const PROVINCES = [
  "北京", "天津", "河北", "山西", "内蒙古", "辽宁", "吉林", "黑龙江",
  "上海", "江苏", "浙江", "安徽", "福建", "江西", "山东", "河南",
  "湖北", "湖南", "广东", "广西", "海南", "重庆", "四川", "贵州",
  "云南", "西藏", "陕西", "甘肃", "青海", "宁夏", "新疆",
];

const PORT_MAP: Record<string, string> = {
  "北京": "天津港", "天津": "天津港", "河北": "天津港", "山西": "天津港", "内蒙古": "天津港",
  "辽宁": "大连港", "吉林": "大连港", "黑龙江": "大连港",
  "山东": "青岛港", "江苏": "上海港", "上海": "上海港", "浙江": "宁波港", "安徽": "上海港",
  "福建": "厦门港", "河南": "青岛港", "湖北": "上海港", "湖南": "广州港",
  "广东": "广州港", "广西": "广州港", "海南": "海口港",
  "重庆": "上海港", "四川": "上海港", "贵州": "广州港", "云南": "广州港",
  "陕西": "青岛港", "甘肃": "青岛港", "青海": "青岛港", "宁夏": "天津港", "新疆": "天津港",
  "西藏": "上海港",
};

const EQUIPMENT_TYPES = [
  { value: "tractor", labelZh: "拖拉机", labelEn: "Tractor" },
  { value: "harvester", labelZh: "收割机", labelEn: "Harvester" },
  { value: "baler", labelZh: "打捆机", labelEn: "Baler" },
  { value: "forage-harvester", labelZh: "青储机", labelEn: "Forage Harvester" },
  { value: "implement", labelZh: "农机具", labelEn: "Implement" },
  { value: "other", labelZh: "其他", labelEn: "Other" },
];

const DESTINATIONS = [
  { value: "russia", labelZh: "俄罗斯", labelEn: "Russia" },
  { value: "central-asia", labelZh: "中亚五国", labelEn: "Central Asia" },
  { value: "eastern-europe", labelZh: "东欧", labelEn: "Eastern Europe" },
  { value: "africa", labelZh: "非洲", labelEn: "Africa" },
  { value: "southeast-asia", labelZh: "东南亚", labelEn: "Southeast Asia" },
  { value: "south-america", labelZh: "南美", labelEn: "South America" },
  { value: "middle-east", labelZh: "中东", labelEn: "Middle East" },
];

export default function LogisticsQuoteForm({ locale }: { locale: string }) {
  const isZh = locale === "zh";
  const [form, setForm] = useState({
    originProvince: "",
    destination: "",
    equipmentType: "",
    equipmentSize: "medium",
    weight: "",
    length: "",
    width: "",
    height: "",
    quantity: "1",
    contactName: "",
    contactPhone: "",
    notes: "",
  });
  const [estimatedPort, setEstimatedPort] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleProvinceChange = (province: string) => {
    setForm({ ...form, originProvince: province });
    setEstimatedPort(PORT_MAP[province] || "天津港");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch("/api/logistics-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setSubmitted(true);
    } catch {
      // ignore
    }
  };

  // 运费估算（简化版）
  const getEstimate = () => {
    if (!form.equipmentType || !form.destination) return null;
    const baseCosts: Record<string, number> = {
      russia: 8000, "central-asia": 12000, "eastern-europe": 15000,
      africa: 25000, "southeast-asia": 10000, "south-america": 35000, "middle-east": 18000,
    };
    const sizeMultiplier: Record<string, number> = { small: 0.6, medium: 1, large: 1.8 };
    const base = baseCosts[form.destination] || 10000;
    const multiplier = sizeMultiplier[form.equipmentSize] || 1;
    const qty = parseInt(form.quantity) || 1;
    const low = Math.round(base * multiplier * qty * 0.85);
    const high = Math.round(base * multiplier * qty * 1.3);
    return { low, high, currency: "CNY" };
  };

  const estimate = getEstimate();

  if (submitted) {
    return (
      <Card className="border-2 border-green-200 bg-green-50">
        <CardContent className="p-8 text-center">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            {isZh ? "询价已提交！" : "Quote Request Submitted!"}
          </h3>
          <p className="text-gray-600">
            {isZh
              ? "我们的物流顾问将在24小时内联系您，提供详细报价方案。"
              : "Our logistics advisor will contact you within 24 hours with a detailed quote."}
          </p>
          <button
            onClick={() => setSubmitted(false)}
            className="mt-4 text-sm text-blue-500 hover:underline"
          >
            {isZh ? "提交新的询价" : "Submit another request"}
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-blue-100 shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="rounded-lg bg-blue-100 p-2">
            <Calculator className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              {isZh ? "在线询价" : "Online Quote Request"}
            </h3>
            <p className="text-sm text-gray-500">
              {isZh ? "填写信息获取运费估算" : "Fill in details for shipping estimate"}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Origin & Destination */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <MapPin className="inline h-4 w-4 mr-1" />
                {isZh ? "起运省份" : "Origin Province"}
              </label>
              <select
                value={form.originProvince}
                onChange={(e) => handleProvinceChange(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-400 focus:outline-none"
                required
              >
                <option value="">{isZh ? "请选择" : "Select"}</option>
                {PROVINCES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              {estimatedPort && (
                <p className="text-xs text-blue-500 mt-1 flex items-center gap-1">
                  <Ship className="h-3 w-3" />
                  {isZh ? `预计出口港口: ${estimatedPort}` : `Suggested port: ${estimatedPort}`}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Ship className="inline h-4 w-4 mr-1" />
                {isZh ? "目的地区域" : "Destination Region"}
              </label>
              <select
                value={form.destination}
                onChange={(e) => setForm({ ...form, destination: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-400 focus:outline-none"
                required
              >
                <option value="">{isZh ? "请选择" : "Select"}</option>
                {DESTINATIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {isZh ? d.labelZh : d.labelEn}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Equipment info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isZh ? "设备类型" : "Equipment Type"}
              </label>
              <select
                value={form.equipmentType}
                onChange={(e) => setForm({ ...form, equipmentType: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-400 focus:outline-none"
                required
              >
                <option value="">{isZh ? "请选择" : "Select"}</option>
                {EQUIPMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {isZh ? t.labelZh : t.labelEn}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isZh ? "设备尺寸" : "Equipment Size"}
              </label>
              <select
                value={form.equipmentSize}
                onChange={(e) => setForm({ ...form, equipmentSize: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-400 focus:outline-none"
              >
                <option value="small">{isZh ? "小型（<50HP）" : "Small (<50HP)"}</option>
                <option value="medium">{isZh ? "中型（50-150HP）" : "Medium (50-150HP)"}</option>
                <option value="large">{isZh ? "大型（>150HP）" : "Large (>150HP)"}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isZh ? "数量" : "Quantity"}
              </label>
              <input
                type="number"
                min="1"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Estimate */}
          {estimate && (
            <div className="rounded-lg bg-blue-50 p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{isZh ? "预估运费区间" : "Estimated Shipping Cost"}</p>
                <p className="text-2xl font-bold text-blue-600">
                  ¥{estimate.low.toLocaleString()} - ¥{estimate.high.toLocaleString()}
                </p>
              </div>
              <Ship className="h-10 w-10 text-blue-300" />
            </div>
          )}

          {/* Contact */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isZh ? "联系人" : "Contact Name"}
              </label>
              <input
                type="text"
                value={form.contactName}
                onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-400 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isZh ? "联系电话" : "Phone"}
              </label>
              <input
                type="tel"
                value={form.contactPhone}
                onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-400 focus:outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isZh ? "备注" : "Notes"}
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              placeholder={isZh ? "补充设备尺寸、特殊要求等..." : "Equipment dimensions, special requirements..."}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-400 focus:outline-none resize-none"
            />
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 transition-colors"
          >
            <Send className="h-5 w-5" />
            {isZh ? "提交询价" : "Submit Request"}
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
