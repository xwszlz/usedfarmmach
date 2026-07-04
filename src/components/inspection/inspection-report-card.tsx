"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ClipboardCheck, AlertCircle } from "lucide-react";

interface InspectionItem {
  category: string;
  categoryLabel: string;
  items: { name: string; result: string; score: number; note?: string }[];
}

interface Report {
  id: string;
  inspectorName: string;
  inspectionOrg: string | null;
  inspectionDate: string;
  overallGrade: string;
  overallScore: number;
  inspectionItems: InspectionItem[];
  summary: string | null;
  recommendations: string | null;
  photos: string[];
  validUntil: string | null;
}

const GRADE_CONFIG: Record<string, { color: string; bg: string; label: string; labelEn: string }> = {
  A: { color: "text-green-700", bg: "bg-green-100", label: "优秀", labelEn: "Excellent" },
  B: { color: "text-blue-700", bg: "bg-blue-100", label: "良好", labelEn: "Good" },
  C: { color: "text-amber-700", bg: "bg-amber-100", label: "一般", labelEn: "Fair" },
  D: { color: "text-red-700", bg: "bg-red-100", label: "需维修", labelEn: "Needs Repair" },
};

export function InspectionReportCard({ productId, locale }: { productId: string; locale: string }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const isZh = locale === "zh";

  useEffect(() => {
    async function fetchReports() {
      try {
        const res = await fetch(`/api/inspection-reports?productId=${productId}`);
        if (res.ok) {
          const data = await res.json();
          setReports(data.reports || []);
        }
      } catch (e) {
        console.error("Failed to fetch inspection reports:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchReports();
  }, [productId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-gray-400">
          {isZh ? "加载检验报告..." : "Loading inspection reports..."}
        </CardContent>
      </Card>
    );
  }

  if (reports.length === 0) {
    return null; // No reports, don't show the card
  }

  const latestReport = reports[0];
  const gradeConfig = GRADE_CONFIG[latestReport.overallGrade] || GRADE_CONFIG.C;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-primary-600" />
          {isZh ? "设备检验报告" : "Inspection Report"}
          <Badge className={`${gradeConfig.bg} ${gradeConfig.color} ml-2`}>
            {latestReport.overallGrade} - {isZh ? gradeConfig.label : gradeConfig.labelEn}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score summary */}
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className={`text-3xl font-bold ${gradeConfig.color}`}>{latestReport.overallScore}</div>
            <div className="text-xs text-gray-500">{isZh ? "综合评分" : "Overall Score"}</div>
          </div>
          <div className="flex-1 space-y-1 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>{isZh ? "检验员" : "Inspector"}</span>
              <span className="font-medium">{latestReport.inspectorName}</span>
            </div>
            {latestReport.inspectionOrg && (
              <div className="flex justify-between text-gray-600">
                <span>{isZh ? "检验机构" : "Organization"}</span>
                <span className="font-medium">{latestReport.inspectionOrg}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-600">
              <span>{isZh ? "检验日期" : "Date"}</span>
              <span className="font-medium">
                {new Date(latestReport.inspectionDate).toLocaleDateString(isZh ? "zh-CN" : "en-US")}
              </span>
            </div>
            {latestReport.validUntil && (
              <div className="flex justify-between text-gray-600">
                <span>{isZh ? "有效期至" : "Valid Until"}</span>
                <span className="font-medium">
                  {new Date(latestReport.validUntil).toLocaleDateString(isZh ? "zh-CN" : "en-US")}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Summary */}
        {latestReport.summary && (
          <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
            {latestReport.summary}
          </div>
        )}

        {/* Toggle detailed items */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-sm font-medium text-primary-600 hover:text-primary-700"
        >
          {expanded
            ? isZh ? "收起检测详情 ▲" : "Hide details ▲"
            : isZh ? "查看检测详情 ▼" : "View details ▼"}
        </button>

        {/* Detailed inspection items */}
        {expanded && (
          <div className="space-y-4">
            {latestReport.inspectionItems.map((cat, idx) => (
              <div key={idx} className="rounded-lg border border-gray-200 p-3">
                <h4 className="mb-2 text-sm font-semibold text-gray-800">
                  {isZh ? cat.categoryLabel : cat.category}
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {cat.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">{item.name}</span>
                      <div className="flex items-center gap-1">
                        <span className={`font-medium ${item.score >= 80 ? "text-green-600" : item.score >= 60 ? "text-amber-600" : "text-red-600"}`}>
                          {item.result}
                        </span>
                        <span className="text-gray-400">({item.score})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Recommendations */}
            {latestReport.recommendations && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div className="text-sm text-amber-800">
                  <span className="font-medium">{isZh ? "维修建议：" : "Recommendations: "}</span>
                  {latestReport.recommendations}
                </div>
              </div>
            )}

            {/* Multiple reports */}
            {reports.length > 1 && (
              <div className="border-t pt-3">
                <p className="mb-2 text-xs font-medium text-gray-500">
                  {isZh ? `共 ${reports.length} 份检验报告` : `${reports.length} reports total`}
                </p>
                {reports.slice(1).map((r, i) => (
                  <div key={r.id} className="flex items-center justify-between py-1 text-xs text-gray-600">
                    <span>{new Date(r.inspectionDate).toLocaleDateString(isZh ? "zh-CN" : "en-US")}</span>
                    <Badge className={`${GRADE_CONFIG[r.overallGrade]?.bg || "bg-gray-100"} ${GRADE_CONFIG[r.overallGrade]?.color || "text-gray-700"}`}>
                      {r.overallGrade} ({r.overallScore})
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
