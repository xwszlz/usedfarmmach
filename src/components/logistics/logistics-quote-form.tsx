"use client";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Ship, MapPin, Calculator, Send, CheckCircle2 } from "lucide-react";
import { useTr } from "@/lib/i18n-tr";
const PROVINCES = [
    "\u5317\u4EAC",
    "\u5929\u6D25",
    "\u6CB3\u5317",
    "\u5C71\u897F",
    "\u5185\u8499\u53E4",
    "\u8FBD\u5B81",
    "\u5409\u6797",
    "\u9ED1\u9F99\u6C5F",
    "\u4E0A\u6D77",
    "\u6C5F\u82CF",
    "\u6D59\u6C5F",
    "\u5B89\u5FBD",
    "\u798F\u5EFA",
    "\u6C5F\u897F",
    "\u5C71\u4E1C",
    "\u6CB3\u5357",
    "\u6E56\u5317",
    "\u6E56\u5357",
    "\u5E7F\u4E1C",
    "\u5E7F\u897F",
    "\u6D77\u5357",
    "\u91CD\u5E86",
    "\u56DB\u5DDD",
    "\u8D35\u5DDE",
    "\u4E91\u5357",
    "\u897F\u85CF",
    "\u9655\u897F",
    "\u7518\u8083",
    "\u9752\u6D77",
    "\u5B81\u590F",
    "\u65B0\u7586",
];
const PORT_MAP: Record<string, string> = {
    "\u5317\u4EAC": "\u5929\u6D25\u6E2F",
    "\u5929\u6D25": "\u5929\u6D25\u6E2F",
    "\u6CB3\u5317": "\u5929\u6D25\u6E2F",
    "\u5C71\u897F": "\u5929\u6D25\u6E2F",
    "\u5185\u8499\u53E4": "\u5929\u6D25\u6E2F",
    "\u8FBD\u5B81": "\u5927\u8FDE\u6E2F",
    "\u5409\u6797": "\u5927\u8FDE\u6E2F",
    "\u9ED1\u9F99\u6C5F": "\u5927\u8FDE\u6E2F",
    "\u5C71\u4E1C": "\u9752\u5C9B\u6E2F",
    "\u6C5F\u82CF": "\u4E0A\u6D77\u6E2F",
    "\u4E0A\u6D77": "\u4E0A\u6D77\u6E2F",
    "\u6D59\u6C5F": "\u5B81\u6CE2\u6E2F",
    "\u5B89\u5FBD": "\u4E0A\u6D77\u6E2F",
    "\u798F\u5EFA": "\u53A6\u95E8\u6E2F",
    "\u6CB3\u5357": "\u9752\u5C9B\u6E2F",
    "\u6E56\u5317": "\u4E0A\u6D77\u6E2F",
    "\u6E56\u5357": "\u5E7F\u5DDE\u6E2F",
    "\u5E7F\u4E1C": "\u5E7F\u5DDE\u6E2F",
    "\u5E7F\u897F": "\u5E7F\u5DDE\u6E2F",
    "\u6D77\u5357": "\u6D77\u53E3\u6E2F",
    "\u91CD\u5E86": "\u4E0A\u6D77\u6E2F",
    "\u56DB\u5DDD": "\u4E0A\u6D77\u6E2F",
    "\u8D35\u5DDE": "\u5E7F\u5DDE\u6E2F",
    "\u4E91\u5357": "\u5E7F\u5DDE\u6E2F",
    "\u9655\u897F": "\u9752\u5C9B\u6E2F",
    "\u7518\u8083": "\u9752\u5C9B\u6E2F",
    "\u9752\u6D77": "\u9752\u5C9B\u6E2F",
    "\u5B81\u590F": "\u5929\u6D25\u6E2F",
    "\u65B0\u7586": "\u5929\u6D25\u6E2F",
    "\u897F\u85CF": "\u4E0A\u6D77\u6E2F",
};
const EQUIPMENT_TYPES = [
    { value: "tractor", labelZh: "\u62D6\u62C9\u673A", labelEn: "Tractor" },
    { value: "harvester", labelZh: "\u6536\u5272\u673A", labelEn: "Harvester" },
    { value: "baler", labelZh: "\u6253\u6346\u673A", labelEn: "Baler" },
    { value: "forage-harvester", labelZh: "\u9752\u50A8\u673A", labelEn: "Forage Harvester" },
    { value: "implement", labelZh: "\u519C\u673A\u5177", labelEn: "Implement" },
    { value: "other", labelZh: "\u5176\u4ED6", labelEn: "Other" },
];
const DESTINATIONS = [
    { value: "russia", labelZh: "\u4FC4\u7F57\u65AF", labelEn: "Russia" },
    { value: "central-asia", labelZh: "\u4E2D\u4E9A\u4E94\u56FD", labelEn: "Central Asia" },
    { value: "eastern-europe", labelZh: "\u4E1C\u6B27", labelEn: "Eastern Europe" },
    { value: "africa", labelZh: "\u975E\u6D32", labelEn: "Africa" },
    { value: "southeast-asia", labelZh: "\u4E1C\u5357\u4E9A", labelEn: "Southeast Asia" },
    { value: "south-america", labelZh: "\u5357\u7F8E", labelEn: "South America" },
    { value: "middle-east", labelZh: "\u4E2D\u4E1C", labelEn: "Middle East" },
];
export default function LogisticsQuoteForm({ locale }: {
    locale: string;
}) {
    const tr = useTr();
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
        setEstimatedPort(PORT_MAP[province] || "\u5929\u6D25\u6E2F");
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
        }
        catch {
            // ignore
        }
    };
    // 运费估算（简化版）
    const getEstimate = () => {
        if (!form.equipmentType || !form.destination)
            return null;
        const baseCosts: Record<string, number> = {
            russia: 8000,
            "central-asia": 12000,
            "eastern-europe": 15000,
            africa: 25000,
            "southeast-asia": 10000,
            "south-america": 35000,
            "middle-east": 18000,
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
        return (<Card className="border-2 border-green-200 bg-green-50">
        <CardContent className="p-8 text-center">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4"/>
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            {tr("询价已提交！")}
          </h3>
          <p className="text-gray-600">
            {tr("我们的物流顾问将在24小时内联系您，提供详细报价方案。")}
          </p>
          <button onClick={() => setSubmitted(false)} className="mt-4 text-sm text-blue-500 hover:underline">
            {tr("提交新的询价")}
          </button>
        </CardContent>
      </Card>);
    }
    return (<Card className="border-2 border-blue-100 shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="rounded-lg bg-blue-100 p-2">
            <Calculator className="h-6 w-6 text-blue-600"/>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              {tr("在线询价")}
            </h3>
            <p className="text-sm text-gray-500">
              {tr("填写信息获取运费估算")}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Origin & Destination */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <MapPin className="inline h-4 w-4 mr-1"/>
                {tr("起运省份")}
              </label>
              <select value={form.originProvince} onChange={(e) => handleProvinceChange(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-400 focus:outline-none" required>
                <option value="">{tr("请选择")}</option>
                {PROVINCES.map((p) => (<option key={p} value={p}>{p}</option>))}
              </select>
              {estimatedPort && (<p className="text-xs text-blue-500 mt-1 flex items-center gap-1">
                  <Ship className="h-3 w-3"/>
                  {isZh ? `预计出口港口: ${estimatedPort}` : `Suggested port: ${estimatedPort}`}
                </p>)}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Ship className="inline h-4 w-4 mr-1"/>
                {tr("目的地区域")}
              </label>
              <select value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-400 focus:outline-none" required>
                <option value="">{tr("请选择")}</option>
                {DESTINATIONS.map((d) => (<option key={d.value} value={d.value}>
                    {isZh ? d.labelZh : d.labelEn}
                  </option>))}
              </select>
            </div>
          </div>

          {/* Equipment info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {tr("设备类型")}
              </label>
              <select value={form.equipmentType} onChange={(e) => setForm({ ...form, equipmentType: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-400 focus:outline-none" required>
                <option value="">{tr("请选择")}</option>
                {EQUIPMENT_TYPES.map((t) => (<option key={t.value} value={t.value}>
                    {isZh ? t.labelZh : t.labelEn}
                  </option>))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {tr("设备尺寸")}
              </label>
              <select value={form.equipmentSize} onChange={(e) => setForm({ ...form, equipmentSize: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-400 focus:outline-none">
                <option value="small">{tr("小型（<50HP）")}</option>
                <option value="medium">{tr("中型（50-150HP）")}</option>
                <option value="large">{tr("大型（>150HP）")}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {tr("数量")}
              </label>
              <input type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-400 focus:outline-none"/>
            </div>
          </div>

          {/* Estimate */}
          {estimate && (<div className="rounded-lg bg-blue-50 p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{tr("预估运费区间")}</p>
                <p className="text-2xl font-bold text-blue-600">
                  ¥{estimate.low.toLocaleString()} - ¥{estimate.high.toLocaleString()}
                </p>
              </div>
              <Ship className="h-10 w-10 text-blue-300"/>
            </div>)}

          {/* Contact */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {tr("联系人")}
              </label>
              <input type="text" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-400 focus:outline-none" required/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {tr("联系电话")}
              </label>
              <input type="tel" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-400 focus:outline-none" required/>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {tr("备注")}
            </label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} placeholder={tr("补充设备尺寸、特殊要求等...")} className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-400 focus:outline-none resize-none"/>
          </div>

          <button type="submit" className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 transition-colors">
            <Send className="h-5 w-5"/>
            {tr("提交询价")}
          </button>
        </form>
      </CardContent>
    </Card>);
}
