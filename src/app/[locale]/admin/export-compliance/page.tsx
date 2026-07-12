"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Shield,
  FileText,
  Calculator,
  Award,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// ── 类型定义 ──

interface IPCheckResult {
  brandId: string;
  brandName: string;
  parentCompany: string;
  trademarkCountries: string[];
  patentRegions: string[];
  exportSafety: {
    countryCode: string;
    countryName: string;
    isSafe: boolean;
    severity: "none" | "caution" | "restricted";
    restriction: string | null;
  }[];
}

interface CertMatchResult {
  countryCode: string;
  countryName: string;
  certificationName: string;
  certificationCode: string;
  authority: string;
  estimatedCost: number;
  estimatedDays: number;
  notes: string;
}

interface CostBreakdown {
  countryCode: string;
  countryName: string;
  totalLandedCostCny: number;
  totalLandedCostUsd: number;
  costItems: { label: string; amountCny: number; isRefund: boolean }[];
}

interface DocumentTemplate {
  documentType: string;
  documentName: string;
  templateFields: string[];
  htmlTemplate: string;
  notes: string;
}

interface ValuationLinkResult {
  latestValuation: {
    id: string;
    estimatedPriceCny: number;
    estimatedPriceUsd: number;
    confidenceScore: number;
    factors: string | null;
  } | null;
  countryProfit: {
    countryCode: string;
    countryName: string;
    intlMarketPriceCny: number | null;
    landedCostCny: number;
    estimatedSellingPriceCny: number;
    grossProfitCny: number;
    grossMarginPct: number;
    recommendation: "strong" | "moderate" | "weak" | "not_recommended";
    reason: string;
  }[];
  bestChoice: {
    countryCode: string;
    countryName: string;
    reason: string;
  };
}

interface AgentResult {
  ok: boolean;
  input: {
    brandId?: string;
    brandName?: string;
    modelName?: string;
    productId?: string;
    purchasePriceCny?: number;
    year?: number;
    category?: string;
    hsCode?: string;
  };
  ipCheck: IPCheckResult | null;
  certificationMatch: CertMatchResult[];
  costBreakdown: CostBreakdown[];
  documentTemplates: DocumentTemplate[];
  valuationLink: ValuationLinkResult | null;
}

const COUNTRY_LABELS: Record<string, string> = {
  KZ: "哈萨克斯坦", RU: "俄罗斯", UZ: "乌兹别克斯坦", BR: "巴西", AR: "阿根廷",
  SA: "沙特阿拉伯", AE: "阿联酋", EG: "埃及", NG: "尼日利亚", ZA: "南非",
  IN: "印度", MX: "墨西哥", AU: "澳大利亚", TR: "土耳其",
};

const BRAND_OPTIONS = [
  { id: "claas", name: "CLAAS 克拉斯" },
  { id: "john-deere", name: "John Deere 约翰迪尔" },
  { id: "case-ih", name: "Case IH 凯斯" },
  { id: "new-holland", name: "New Holland 纽荷兰" },
  { id: "massey-ferguson", name: "Massey Ferguson 麦赛福格森" },
  { id: "mtz", name: "MTZ/Belarus 明斯克" },
  { id: "kubota", name: "Kubota 久保田" },
  { id: "krone", name: "Krone 科罗尼" },
  { id: "mchale", name: "McHale 麦克海尔" },
];

const REC_COLORS: Record<string, string> = {
  strong: "bg-green-50 text-green-700 border-green-200",
  moderate: "bg-blue-50 text-blue-700 border-blue-200",
  weak: "bg-yellow-50 text-yellow-700 border-yellow-200",
  not_recommended: "bg-red-50 text-red-700 border-red-200",
};

const REC_LABELS: Record<string, string> = {
  strong: "强烈推荐",
  moderate: "可考虑",
  weak: "利润薄",
  not_recommended: "不建议",
};

export default function ExportCompliancePage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedCost, setExpandedCost] = useState<string | null>(null);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);

  // Form state
  const [brandId, setBrandId] = useState("claas");
  const [modelName, setModelName] = useState("Jaguar 850");
  const [purchasePrice, setPurchasePrice] = useState("280000");
  const [year, setYear] = useState("2010");
  const [selectedCountries, setSelectedCountries] = useState<string[]>(["KZ", "RU", "UZ", "SA", "AE", "BR", "TR"]);

  const toggleCountry = (cc: string) => {
    setSelectedCountries((prev) =>
      prev.includes(cc) ? prev.filter((c) => c !== cc) : [...prev, cc]
    );
  };

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/agents/export-compliance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId,
          modelName,
          purchasePriceCny: parseFloat(purchasePrice) || 0,
          year: year ? parseInt(year) : undefined,
          targetCountries: selectedCountries,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">#10 出口合规 Agent</h1>
          </div>
          <p className="text-gray-500 text-sm">
            品牌知识产权核查 · 目标国认证匹配 · 出口全链条成本 · 报关单据模板 · 估值联动推荐
          </p>
        </div>

        {/* Input Form */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-400" />
            分析参数
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1">品牌</label>
              <select
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                {BRAND_OPTIONS.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">型号</label>
              <input
                type="text"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">采购价 (¥)</label>
              <input
                type="number"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">年份</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-500 mb-2">目标国（可多选）</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(COUNTRY_LABELS).map(([cc, name]) => (
                <button
                  key={cc}
                  onClick={() => toggleCountry(cc)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                    selectedCountries.includes(cc)
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={runAnalysis}
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg flex items-center justify-center gap-2 hover:from-blue-700 hover:to-blue-800 transition disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                分析中...
              </>
            ) : (
              <>
                <Shield className="w-5 h-5" />
                启动出口合规分析
              </>
            )}
          </button>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Results */}
        {result && (
          <>
            {/* Input Summary */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="text-gray-500">品牌: <strong className="text-gray-900">{result.input.brandName || "-"}</strong></span>
                <span className="text-gray-500">型号: <strong className="text-gray-900">{result.input.modelName || "-"}</strong></span>
                <span className="text-gray-500">采购价: <strong className="text-gray-900">¥{result.input.purchasePriceCny?.toLocaleString()}</strong></span>
                <span className="text-gray-500">HS编码: <strong className="text-gray-900">{result.input.hsCode}</strong></span>
                <span className="text-gray-500">品类: <strong className="text-gray-900">{result.input.category}</strong></span>
              </div>
            </div>

            {/* 1. IP Check */}
            {result.ipCheck && (
              <ResultCard icon={<Shield className="w-5 h-5" />} title="1. 品牌知识产权核查" color="blue">
                <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
                  <div>
                    <span className="text-gray-500">品牌:</span> <strong>{result.ipCheck.brandName}</strong>
                  </div>
                  <div>
                    <span className="text-gray-500">母公司:</span> <strong>{result.ipCheck.parentCompany}</strong>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {result.ipCheck.exportSafety.map((s) => (
                    <div
                      key={s.countryCode}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-sm ${
                        s.severity === "restricted"
                          ? "bg-red-50 border-red-200"
                          : s.severity === "caution"
                          ? "bg-yellow-50 border-yellow-200"
                          : "bg-green-50 border-green-200"
                      }`}
                    >
                      {s.isSafe ? (
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                      )}
                      <span className="font-medium">{s.countryName}</span>
                      {s.restriction && (
                        <span className="text-xs text-gray-500 ml-auto truncate" title={s.restriction}>
                          {s.restriction.slice(0, 30)}...
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </ResultCard>
            )}

            {/* 5. Valuation Link - Best Choice (shown prominently) */}
            {result.valuationLink && (
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl shadow-lg p-6">
                <div className="flex items-center gap-3 mb-3">
                  <TrendingUp className="w-6 h-6" />
                  <h2 className="text-xl font-bold">最优出口目标国推荐</h2>
                </div>
                <div className="text-3xl font-bold mb-1">
                  {result.valuationLink.bestChoice.countryName || "暂无推荐"}
                </div>
                <p className="text-blue-100 text-sm">{result.valuationLink.bestChoice.reason}</p>
                {result.valuationLink.latestValuation && (
                  <div className="mt-3 pt-3 border-t border-blue-400/30 text-sm text-blue-100">
                    AI估值参考: ¥{result.valuationLink.latestValuation.estimatedPriceCny.toLocaleString()} / ${result.valuationLink.latestValuation.estimatedPriceUsd.toLocaleString()}
                    （置信度 {Math.round(result.valuationLink.latestValuation.confidenceScore * 100)}%）
                  </div>
                )}
              </div>
            )}

            {/* 5b. Country Profit Ranking */}
            {result.valuationLink && result.valuationLink.countryProfit.length > 0 && (
              <ResultCard icon={<TrendingUp className="w-5 h-5" />} title="5. 估值联动 · 各国利润排名" color="green">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 border-b">
                        <th className="text-left py-2 px-2">排名</th>
                        <th className="text-left py-2 px-2">目标国</th>
                        <th className="text-right py-2 px-2">到岸成本</th>
                        <th className="text-right py-2 px-2">预估售价</th>
                        <th className="text-right py-2 px-2">毛利润</th>
                        <th className="text-right py-2 px-2">毛利率</th>
                        <th className="text-center py-2 px-2">推荐等级</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.valuationLink.countryProfit.map((c, i) => (
                        <tr key={c.countryCode} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-2 font-bold text-gray-400">{i + 1}</td>
                          <td className="py-2 px-2 font-medium">{c.countryName}</td>
                          <td className="py-2 px-2 text-right">¥{c.landedCostCny.toLocaleString()}</td>
                          <td className="py-2 px-2 text-right">¥{c.estimatedSellingPriceCny.toLocaleString()}</td>
                          <td className={`py-2 px-2 text-right font-bold ${c.grossProfitCny >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {c.grossProfitCny >= 0 ? "+" : ""}¥{c.grossProfitCny.toLocaleString()}
                          </td>
                          <td className={`py-2 px-2 text-right font-bold ${c.grossMarginPct >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {c.grossMarginPct >= 0 ? "+" : ""}{c.grossMarginPct}%
                          </td>
                          <td className="py-2 px-2 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs border ${REC_COLORS[c.recommendation]}`}>
                              {REC_LABELS[c.recommendation]}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ResultCard>
            )}

            {/* 2. Certification */}
            {result.certificationMatch.length > 0 && (
              <ResultCard icon={<Award className="w-5 h-5" />} title="2. 目标国认证要求" color="yellow">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {result.certificationMatch.map((c) => (
                    <div key={c.countryCode} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-sm">{c.countryName}</span>
                        <span className="text-xs text-gray-400">{c.certificationCode}</span>
                      </div>
                      <div className="text-xs text-gray-500 mb-1">{c.certificationName}</div>
                      <div className="text-xs text-gray-500 mb-1">机构: {c.authority}</div>
                      <div className="flex gap-3 text-xs text-gray-600">
                        <span>费用 ¥{c.estimatedCost.toLocaleString()}</span>
                        <span>周期 {c.estimatedDays} 天</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{c.notes}</p>
                    </div>
                  ))}
                </div>
              </ResultCard>
            )}

            {/* 3. Cost Breakdown */}
            {result.costBreakdown.length > 0 && (
              <ResultCard icon={<Calculator className="w-5 h-5" />} title="3. 出口全链条成本" color="green">
                <div className="space-y-2">
                  {result.costBreakdown.map((cb) => (
                    <div key={cb.countryCode} className="border border-gray-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setExpandedCost(expandedCost === cb.countryCode ? null : cb.countryCode)}
                        className="w-full flex items-center justify-between p-3 hover:bg-gray-50"
                      >
                        <span className="font-medium text-sm">{cb.countryName}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-green-600">¥{cb.totalLandedCostCny.toLocaleString()}</span>
                          <span className="text-xs text-gray-400">${cb.totalLandedCostUsd.toLocaleString()}</span>
                          {expandedCost === cb.countryCode ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        </div>
                      </button>
                      {expandedCost === cb.countryCode && (
                        <div className="border-t bg-gray-50 p-3">
                          <table className="w-full text-xs">
                            <tbody>
                              {cb.costItems.map((item, i) => (
                                <tr key={i} className={item.isRefund ? "text-green-700" : ""}>
                                  <td className="py-1 px-2 text-gray-600">{item.label}</td>
                                  <td className="py-1 px-2 text-right font-medium">
                                    {item.isRefund ? "-" : ""}¥{Math.abs(item.amountCny).toLocaleString()}
                                  </td>
                                </tr>
                              ))}
                              <tr className="border-t-2 border-gray-300 font-bold">
                                <td className="py-2 px-2">到岸总成本</td>
                                <td className="py-2 px-2 text-right text-green-700">¥{cb.totalLandedCostCny.toLocaleString()}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ResultCard>
            )}

            {/* 4. Document Templates */}
            {result.documentTemplates.length > 0 && (
              <ResultCard icon={<FileText className="w-5 h-5" />} title="4. 报关单据模板" color="gray">
                <div className="space-y-2">
                  {result.documentTemplates.map((doc) => (
                    <div key={doc.documentType} className="border border-gray-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setExpandedDoc(expandedDoc === doc.documentType ? null : doc.documentType)}
                        className="w-full flex items-center justify-between p-3 hover:bg-gray-50"
                      >
                        <span className="font-medium text-sm">{doc.documentName}</span>
                        {expandedDoc === doc.documentType ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                      </button>
                      {expandedDoc === doc.documentType && (
                        <div className="border-t p-3">
                          <div className="mb-2">
                            <span className="text-xs text-gray-500">字段: </span>
                            {doc.templateFields.map((f) => (
                              <span key={f} className="inline-block bg-gray-100 rounded px-2 py-0.5 text-xs mr-1 mb-1">{f}</span>
                            ))}
                          </div>
                          <div className="overflow-x-auto" dangerouslySetInnerHTML={{ __html: doc.htmlTemplate }} />
                          <p className="text-xs text-gray-400 mt-2">{doc.notes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ResultCard>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── 通用卡片组件 ──

function ResultCard({
  icon,
  title,
  color,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  color: "blue" | "green" | "yellow" | "gray";
  children: React.ReactNode;
}) {
  const colorMap = {
    blue: "text-blue-600 bg-blue-50",
    green: "text-green-600 bg-green-50",
    yellow: "text-yellow-600 bg-yellow-50",
    gray: "text-gray-600 bg-gray-50",
  };
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className={`p-2 rounded-lg ${colorMap[color]}`}>{icon}</div>
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}
