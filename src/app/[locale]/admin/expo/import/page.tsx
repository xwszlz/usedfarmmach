"use client";

import { useState, useEffect } from "react";
import { Upload, FileSpreadsheet, CheckCircle, XCircle, Loader2, Download, AlertCircle } from "lucide-react";
import Link from "next/link";

interface Booth {
  id: string;
  name: string;
  hall: string;
}

interface ImportResult {
  success: boolean;
  model?: string;
  error?: string;
}

const CSV_TEMPLATE = `deviceType,brand,model,year,workingHours,condition,price,currency,images,description
拖拉机,CLAAS,ARS730,2020,1500,good,280000,CNY,https://oss.example.com/img1.jpg;https://oss.example.com/img2.jpg,描述文本
收割机,John Deere,W210,2019,2200,excellent,350000,CNY,https://oss.example.com/img3.jpg,描述文本`;

const FIELD_HELP: Record<string, string> = {
  deviceType: "设备类型（必填）：拖拉机/收割机/播种机/打捆机等",
  brand: "品牌：CLAAS/John Deere/纽荷兰等",
  model: "型号：如 ARS730",
  year: "年份：如 2020",
  workingHours: "工作小时数：如 1500",
  condition: "状况：excellent/good/fair/poor",
  price: "价格（数字）：如 280000",
  currency: "货币：CNY/USD/EUR",
  images: "图片URL（分号分隔）：https://...;https://...",
  description: "描述文本",
};

export default function BatchImportPage() {
  const [booths, setBooths] = useState<Booth[]>([]);
  const [selectedBooth, setSelectedBooth] = useState("");
  const [csvText, setCsvText] = useState("");
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<{ summary: { total: number; success: number; failed: number }; results: ImportResult[] } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    // Fetch all booths (admin can see all)
    fetch("/api/expo/booth", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setBooths(d.data);
          if (d.data.length > 0) setSelectedBooth(d.data[0].id);
        }
      })
      .catch(console.error);
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCsvText(String(ev.target?.result || ""));
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!selectedBooth || !csvText.trim()) return;

    setImporting(true);
    setResults(null);

    // Parse CSV
    const lines = csvText.trim().split(/\r?\n/);
    if (lines.length < 2) {
      alert("CSV数据不足");
      setImporting(false);
      return;
    }

    const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
    const items: Record<string, unknown>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map(v => v.trim());
      const item: Record<string, unknown> = {};
      headers.forEach((header, idx) => {
        item[header] = values[idx] || "";
      });
      items.push(item);
    }

    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/expo/batch-import", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ boothId: selectedBooth, items }),
      });
      const data = await res.json();
      if (data.success) {
        setResults(data);
      } else {
        alert(data.error || "导入失败");
      }
    } catch (e) {
      alert("网络错误");
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "expo-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link href="/zh/admin/expo" className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          ← 返回博览会管理
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Upload className="h-6 w-6 text-blue-600" />
          批量设备导入
        </h1>
        <p className="mt-1 text-sm text-gray-500">上传CSV文件，批量导入展品到指定展位</p>
      </div>

      {/* Step 1: Select booth */}
      <section className="mb-6 rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-gray-900">1. 选择目标展位</h2>
        <select value={selectedBooth} onChange={(e) => setSelectedBooth(e.target.value)}
          className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-500">
          {booths.map(b => (
            <option key={b.id} value={b.id}>{b.name} ({b.hall})</option>
          ))}
        </select>
      </section>

      {/* Step 2: Upload CSV */}
      <section className="mb-6 rounded-xl border bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900">2. 上传CSV文件</h2>
          <button onClick={downloadTemplate}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
            <Download className="h-3.5 w-3.5" />下载模板
          </button>
        </div>

        <div className="mb-3 rounded-lg border-2 border-dashed p-6 text-center">
          <FileSpreadsheet className="mx-auto mb-2 h-10 w-10 text-gray-300" />
          <label className="cursor-pointer">
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileUpload} />
            <span className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              选择CSV文件
            </span>
          </label>
          <p className="mt-2 text-xs text-gray-400">或手动粘贴CSV内容到下方</p>
        </div>

        <textarea
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          rows={6}
          placeholder="deviceType,brand,model,year,workingHours,condition,price,currency,images,description&#10;拖拉机,CLAAS,ARS730,2020,1500,good,280000,CNY,https://...;https://...,描述"
          className="w-full rounded-lg border px-3 py-2 font-mono text-xs outline-none focus:border-blue-500"
        />

        {/* Field help */}
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">字段说明</summary>
          <div className="mt-2 grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
            {Object.entries(FIELD_HELP).map(([field, desc]) => (
              <div key={field} className="flex gap-2">
                <code className="rounded bg-gray-100 px-1.5 py-0.5 font-bold text-blue-600">{field}</code>
                <span className="text-gray-500">{desc}</span>
              </div>
            ))}
          </div>
        </details>
      </section>

      {/* Step 3: Import */}
      <section className="mb-6 rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-gray-900">3. 执行导入</h2>
        <button
          onClick={handleImport}
          disabled={!selectedBooth || !csvText.trim() || importing}
          className="flex items-center gap-2 rounded-lg bg-green-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50">
          {importing ? <><Loader2 className="h-4 w-4 animate-spin" />导入中...</> : <><Upload className="h-4 w-4" />开始导入</>}
        </button>
      </section>

      {/* Results */}
      {results && (
        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-bold text-gray-900">导入结果</h2>
          <div className="mb-4 grid grid-cols-3 gap-4">
            <div className="rounded-lg bg-gray-50 p-3 text-center">
              <p className="text-2xl font-bold text-gray-900">{results.summary.total}</p>
              <p className="text-xs text-gray-500">总计</p>
            </div>
            <div className="rounded-lg bg-green-50 p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{results.summary.success}</p>
              <p className="text-xs text-gray-500">成功</p>
            </div>
            <div className="rounded-lg bg-red-50 p-3 text-center">
              <p className="text-2xl font-bold text-red-600">{results.summary.failed}</p>
              <p className="text-xs text-gray-500">失败</p>
            </div>
          </div>
          {results.results.some(r => !r.success) && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-red-700">
                <AlertCircle className="h-4 w-4" />失败详情：
              </p>
              <div className="space-y-1">
                {results.results.filter(r => !r.success).map((r, i) => (
                  <div key={i} className="text-xs text-red-600">
                    {r.model}: {r.error}
                  </div>
                ))}
              </div>
            </div>
          )}
          {results.summary.success > 0 && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700">
              <CheckCircle className="h-4 w-4" />
              成功导入 {results.summary.success} 台设备，可前往
              <Link href="/zh/admin/expo" className="underline">博览会管理</Link>
              查看
            </div>
          )}
        </section>
      )}
    </div>
  );
}
