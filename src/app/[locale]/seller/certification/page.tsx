"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, User as UserIcon, Car, ShieldCheck, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";

type CertType = "institution" | "personnel" | "vehicle";

const CERT_TYPES: { type: CertType; labelZh: string; labelEn: string; icon: any; descZh: string; descEn: string }[] = [
  {
    type: "institution",
    labelZh: "机构认证",
    labelEn: "Institution Certification",
    icon: Building2,
    descZh: "营业执照认证，证明企业合法经营资质",
    descEn: "Business license verification for enterprise legitimacy",
  },
  {
    type: "personnel",
    labelZh: "人员认证",
    labelEn: "Personnel Certification",
    icon: UserIcon,
    descZh: "评估师职业资格证书认证",
    descEn: "Appraiser professional qualification certificate",
  },
  {
    type: "vehicle",
    labelZh: "车辆认证",
    labelEn: "Vehicle Certification",
    icon: Car,
    descZh: "设备检测报告认证，A/B/C/D四级评定",
    descEn: "Equipment inspection report, A/B/C/D grading",
  },
];

export default function CertificationPage() {
  const [selectedType, setSelectedType] = useState<CertType | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  // 表单字段
  const [form, setForm] = useState({
    applicantName: "",
    contactPhone: "",
    contactEmail: "",
    // 机构
    businessLicenseNo: "",
    legalPerson: "",
    registeredCapital: "",
    businessScope: "",
    // 人员
    personnelName: "",
    personnelCertNo: "",
    personnelLevel: "中级",
    // 车辆
    productId: "",
    inspectionReportNo: "",
    inspectionGrade: "B",
    inspectionOrg: "",
  });

  const isZh = true;

  function handleInputChange(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit() {
    if (!selectedType) return;
    if (!form.applicantName || !form.contactPhone) {
      setError(isZh ? "请填写申请人名称和联系电话" : "Please fill in applicant name and phone");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/certification/apply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          certType: selectedType,
          ...form,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
      } else {
        setError(data.error || "提交失败");
      }
    } catch (e) {
      setError("网络错误，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  // 已提交成功
  if (submitted) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
            <h2 className="mt-4 text-xl font-bold text-gray-900">认证申请提交成功</h2>
            <p className="mt-2 text-sm text-gray-500">
              审核周期约3-5个工作日，审核结果将通过短信和邮件通知您。
            </p>
            <Button className="mt-6" onClick={() => { setSubmitted(false); setSelectedType(null); }}>
              返回
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">三重认证申请</h1>
        <p className="mt-1 text-sm text-gray-500">
          机构认证 · 人员认证 · 车辆认证 — 通过认证后获得专属标识，提升交易信任度
        </p>
      </div>

      {/* 认证类型选择 */}
      {!selectedType && (
        <div className="grid gap-4 sm:grid-cols-3">
          {CERT_TYPES.map((cert) => {
            const Icon = cert.icon;
            return (
              <Card
                key={cert.type}
                className="cursor-pointer transition-all hover:shadow-lg hover:border-primary-300"
                onClick={() => setSelectedType(cert.type)}
              >
                <CardContent className="flex flex-col items-center p-6 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-50">
                    <Icon className="h-7 w-7 text-primary-600" />
                  </div>
                  <h3 className="mt-3 font-semibold text-gray-900">{cert.labelZh}</h3>
                  <p className="mt-1 text-xs text-gray-500">{cert.descZh}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* 认证申请表单 */}
      {selectedType && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {(() => {
                const cert = CERT_TYPES.find((c) => c.type === selectedType)!;
                const Icon = cert.icon;
                return <Icon className="h-5 w-5" />;
              })()}
              {CERT_TYPES.find((c) => c.type === selectedType)?.labelZh}申请
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 通用字段 */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  申请人/机构名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  value={form.applicantName}
                  onChange={(e) => handleInputChange("applicantName", e.target.value)}
                  placeholder="请输入名称"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  联系电话 <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  value={form.contactPhone}
                  onChange={(e) => handleInputChange("contactPhone", e.target.value)}
                  placeholder="请输入手机号"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">联系邮箱</label>
                <input
                  type="email"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  value={form.contactEmail}
                  onChange={(e) => handleInputChange("contactEmail", e.target.value)}
                  placeholder="选填"
                />
              </div>
            </div>

            {/* 机构认证字段 */}
            {selectedType === "institution" && (
              <div className="space-y-3 rounded-lg bg-blue-50 p-4">
                <h4 className="text-sm font-semibold text-blue-800">机构认证信息</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input className="rounded border px-3 py-2 text-sm" placeholder="营业执照号" value={form.businessLicenseNo} onChange={(e) => handleInputChange("businessLicenseNo", e.target.value)} />
                  <input className="rounded border px-3 py-2 text-sm" placeholder="法人代表" value={form.legalPerson} onChange={(e) => handleInputChange("legalPerson", e.target.value)} />
                  <input className="rounded border px-3 py-2 text-sm" placeholder="注册资本" value={form.registeredCapital} onChange={(e) => handleInputChange("registeredCapital", e.target.value)} />
                  <input className="rounded border px-3 py-2 text-sm" placeholder="经营范围" value={form.businessScope} onChange={(e) => handleInputChange("businessScope", e.target.value)} />
                </div>
                <p className="text-xs text-blue-500">需上传营业执照照片（审核时提交）</p>
              </div>
            )}

            {/* 人员认证字段 */}
            {selectedType === "personnel" && (
              <div className="space-y-3 rounded-lg bg-purple-50 p-4">
                <h4 className="text-sm font-semibold text-purple-800">人员认证信息</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input className="rounded border px-3 py-2 text-sm" placeholder="评估师姓名" value={form.personnelName} onChange={(e) => handleInputChange("personnelName", e.target.value)} />
                  <input className="rounded border px-3 py-2 text-sm" placeholder="证书编号" value={form.personnelCertNo} onChange={(e) => handleInputChange("personnelCertNo", e.target.value)} />
                  <select className="rounded border px-3 py-2 text-sm" value={form.personnelLevel} onChange={(e) => handleInputChange("personnelLevel", e.target.value)}>
                    <option value="初级">初级评估师</option>
                    <option value="中级">中级评估师</option>
                    <option value="高级">高级评估师</option>
                  </select>
                </div>
                <p className="text-xs text-purple-500">需上传评估师证书照片（审核时提交）</p>
              </div>
            )}

            {/* 车辆认证字段 */}
            {selectedType === "vehicle" && (
              <div className="space-y-3 rounded-lg bg-green-50 p-4">
                <h4 className="text-sm font-semibold text-green-800">车辆认证信息</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input className="rounded border px-3 py-2 text-sm" placeholder="产品ID（从产品详情页获取）" value={form.productId} onChange={(e) => handleInputChange("productId", e.target.value)} />
                  <input className="rounded border px-3 py-2 text-sm" placeholder="检测报告编号" value={form.inspectionReportNo} onChange={(e) => handleInputChange("inspectionReportNo", e.target.value)} />
                  <select className="rounded border px-3 py-2 text-sm" value={form.inspectionGrade} onChange={(e) => handleInputChange("inspectionGrade", e.target.value)}>
                    <option value="A">A级（优秀）</option>
                    <option value="B">B级（良好）</option>
                    <option value="C">C级（一般）</option>
                    <option value="D">D级（较差）</option>
                  </select>
                  <input className="rounded border px-3 py-2 text-sm" placeholder="检测机构" value={form.inspectionOrg} onChange={(e) => handleInputChange("inspectionOrg", e.target.value)} />
                </div>
                <p className="text-xs text-green-500">需上传检测报告照片（审核时提交）</p>
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setSelectedType(null)}>
                返回选择
              </Button>
              <Button onClick={handleSubmit} disabled={submitting} className="flex-1">
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    提交中...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    提交认证申请
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 认证说明 */}
      <div className="mt-6 rounded-lg bg-gray-50 p-4 text-xs text-gray-500">
        <h4 className="mb-2 font-semibold text-gray-700">认证流程</h4>
        <div className="flex items-center gap-2">
          <Badge variant="outline">1. 选择认证类型</Badge>
          <span>→</span>
          <Badge variant="outline">2. 填写信息</Badge>
          <span>→</span>
          <Badge variant="outline">3. 平台审核</Badge>
          <span>→</span>
          <Badge variant="outline">4. 获得认证标识</Badge>
        </div>
        <p className="mt-2">审核周期约3-5个工作日。认证通过后，您的卖家页面将显示对应认证标识。</p>
      </div>
    </div>
  );
}
