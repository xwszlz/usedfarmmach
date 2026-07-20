"use client";

import { useState, useEffect } from "react";
import { X, Check, Upload, AlertCircle, Loader2 } from "lucide-react";

interface InspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  auctionId: string;
  locale: string;
  bargain: {
    bargainNo: string;
    title: string;
    askingPrice: number;
    announcementNo?: string | null;
    startPrice?: number | null;
    priceIncrement?: number | null;
    deposit?: number | null;
    minParticipants?: number | null;
    evaluationPrice?: number | null;
    knownFlaws?: string | null;
    startTime?: string | null;
    contractTemplateNo?: string | null;
  };
}

export default function InspectionBookingModal({
  isOpen,
  onClose,
  auctionId,
  locale,
  bargain,
}: InspectionModalProps) {
  const isZh = locale === "zh";
  const [step, setStep] = useState<"form" | "deposit" | "done">("form");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [bookingId, setBookingId] = useState("");

  // 表单字段
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [flawConfirmed, setFlawConfirmed] = useState(false);
  const [riskConfirmed, setRiskConfirmed] = useState(false);
  const [proofUrl, setProofUrl] = useState("");

  // 检查登录状态
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  useEffect(() => {
    const userStr = typeof window !== "undefined" ? localStorage.getItem("user") : null;
    setIsLoggedIn(!!userStr);
  }, [isOpen]);

  // 重置表单
  useEffect(() => {
    if (isOpen) {
      setStep("form");
      setError("");
      setBookingId("");
      setProofUrl("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!name.trim() || !phone.trim()) {
      setError(isZh ? "请填写姓名和手机号" : "Please fill in name and phone");
      return;
    }
    if (!flawConfirmed || !riskConfirmed) {
      setError(isZh ? "请确认已知瑕疵和风险自担" : "Please confirm flaws and risks");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const u = JSON.parse(userStr);
        if (u.token) headers["Authorization"] = `Bearer ${u.token}`;
      }

      const res = await fetch(`/api/auctions/${auctionId}/inspection-booking`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          preferredDate: preferredDate || null,
          flawConfirmed: true,
          riskConfirmed: true,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setBookingId(json.data.id);
        setStep("deposit");
      } else {
        setError(json.error || (isZh ? "提交失败" : "Failed"));
      }
    } catch {
      setError(isZh ? "网络错误，请重试" : "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);

      const userStr = localStorage.getItem("user");
      const headers: Record<string, string> = {};
      if (userStr) {
        const u = JSON.parse(userStr);
        if (u.token) headers["Authorization"] = `Bearer ${u.token}`;
      }

      const res = await fetch("/api/upload", {
        method: "POST",
        headers,
        credentials: "include",
        body: formData,
      });
      const json = await res.json();
      if (json.success || json.url) {
        const url = json.url || json.data?.url;
        setProofUrl(url);
        // 提交凭证
        const depositRes = await fetch(`/api/auctions/${auctionId}/deposit`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          credentials: "include",
          body: JSON.stringify({ bookingId, proofUrl: url }),
        });
        const depositJson = await depositRes.json();
        if (depositJson.success) {
          setStep("done");
        } else {
          setError(depositJson.error || (isZh ? "凭证上传失败" : "Upload failed"));
        }
      } else {
        setError(json.error || (isZh ? "文件上传失败" : "Upload failed"));
      }
    } catch {
      setError(isZh ? "上传失败，请重试" : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h3 className="text-lg font-bold text-gray-900">
            {step === "form" && (isZh ? "询价报名 · 验车预约" : "Inquiry Registration")}
            {step === "deposit" && (isZh ? "诚意金（如需）" : "Earnest Money (if applicable)")}
            {step === "done" && (isZh ? "报名完成" : "Registration Complete")}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* 步骤1：表单 */}
          {step === "form" && (
            <>
              {/* 公告信息预填 */}
              <div className="bg-blue-50 rounded-lg p-4 space-y-2">
                <h4 className="text-sm font-bold text-blue-900">
                  {isZh ? "公告信息" : "Announcement Info"}
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {bargain.announcementNo && (
                    <div>
                      <span className="text-gray-500">{isZh ? "公告编号" : "Announcement"}：</span>
                      <span className="font-mono font-semibold text-gray-900">{bargain.announcementNo}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-500">{isZh ? "标的物" : "Item"}：</span>
                    <span className="font-semibold text-gray-900">{bargain.title}</span>
                  </div>
                  {bargain.evaluationPrice != null && (
                    <div>
                      <span className="text-gray-500">{isZh ? "参考评估价" : "Evaluation"}：</span>
                      <span className="font-semibold text-blue-700">¥{Number(bargain.evaluationPrice).toLocaleString()}</span>
                    </div>
                  )}
                  {bargain.startPrice != null && bargain.startPrice > 0 && (
                    <div>
                      <span className="text-gray-500">{isZh ? "起始议价" : "Start Price"}：</span>
                      <span className="font-semibold text-gray-900">¥{bargain.startPrice.toLocaleString()}</span>
                    </div>
                  )}
                  {bargain.priceIncrement != null && bargain.priceIncrement > 0 && (
                    <div>
                      <span className="text-gray-500">{isZh ? "参考加价" : "Reference Increment"}：</span>
                      <span className="font-semibold text-gray-900">¥{bargain.priceIncrement.toLocaleString()}{isZh ? "（仅参考）" : " (ref only)"}</span>
                    </div>
                  )}
                  {bargain.deposit != null && bargain.deposit > 0 && (
                    <div>
                      <span className="text-gray-500">{isZh ? "建议诚意金" : "Suggested Earnest"}：</span>
                      <span className="font-semibold text-red-600">¥{bargain.deposit.toLocaleString()}</span>
                    </div>
                  )}
                  {bargain.startTime && (
                    <div>
                      <span className="text-gray-500">{isZh ? "议价时间" : "Start Time"}：</span>
                      <span className="font-semibold text-gray-900">
                        {new Date(bargain.startTime).toLocaleString(isZh ? "zh-CN" : "en-US")}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* 已知瑕疵告知 */}
              {bargain.knownFlaws && (
                <div className="bg-amber-50 rounded-lg p-4 space-y-2">
                  <h4 className="text-sm font-bold text-amber-800">
                    ⚠ {isZh ? "已知瑕疵告知" : "Known Flaws"}
                  </h4>
                  <p className="text-sm text-amber-700">{bargain.knownFlaws}</p>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={flawConfirmed}
                      onChange={(e) => setFlawConfirmed(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-amber-300"
                    />
                    <span className="text-sm text-amber-800">
                      {isZh ? "我已知晓上述瑕疵，愿意按现状参与议价" : "I acknowledge the above flaws"}
                    </span>
                  </label>
                </div>
              )}

              {/* 表单字段 */}
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    {isZh ? "姓名" : "Name"} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                    placeholder={isZh ? "请输入姓名" : "Enter your name"}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    {isZh ? "手机号" : "Phone"} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                    placeholder={isZh ? "请输入手机号" : "Enter your phone"}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    {isZh ? "期望验车日期" : "Preferred Inspection Date"}
                  </label>
                  <input
                    type="date"
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                    className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* 风险确认 */}
              <label className="flex items-start gap-2 cursor-pointer bg-gray-50 rounded-lg p-3">
                <input
                  type="checkbox"
                  checked={riskConfirmed}
                  onChange={(e) => setRiskConfirmed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">
                  {isZh
                    ? "我已阅读公告，知悉标的物以现状交付，风险自担。"
                    : "I have read the announcement and accept the item as-is."}
                </span>
              </label>

              {error && (
                <p className="text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" /> {error}
                </p>
              )}

              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-300 transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> {isZh ? "提交中..." : "Submitting..."}
                  </>
                ) : (
                  isZh ? "提交报名" : "Submit Registration"
                )}
              </button>
            </>
          )}

          {/* 步骤2：保证金缴纳 */}
          {step === "deposit" && (
            <>
              <div className="bg-green-50 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-600" />
                  <p className="text-sm font-bold text-green-800">
                    {isZh ? "报名提交成功！" : "Registration submitted!"}
                  </p>
                </div>
                <p className="text-sm text-green-700">
                  {isZh ? "请缴纳保证金后上传转账凭证" : "Please pay deposit and upload proof"}
                </p>
              </div>

              {/* 保证金缴纳指引 */}
              <div className="bg-blue-50 rounded-lg p-4 space-y-3">
                <h4 className="text-sm font-bold text-blue-900">
                  {isZh ? "诚意金说明（双方自行约定）" : "Earnest Money (Optional, by Agreement)"}
                </h4>
                {bargain.deposit != null && bargain.deposit > 0 && (
                  <p className="text-sm text-blue-700">
                    {isZh ? "建议金额" : "Suggested Amount"}：
                    <span className="font-bold text-lg">¥{bargain.deposit.toLocaleString()}</span>
                    <span className="text-xs ml-1">{isZh ? "（可协商）" : "(negotiable)"}</span>
                  </p>
                )}
                <div className="text-sm text-blue-700 space-y-1">
                  <p>1. {isZh ? "诚意金由买卖双方自行约定，平台不代收、不验证、不托管" : "Earnest money agreed between buyer and seller; platform does not handle funds"}</p>
                  <p>2. {isZh ? "如约定诚意金，请线下银行转账至卖方指定账户" : "If agreed, bank transfer to seller's account"}</p>
                  <p>3. {isZh ? "转账完成后截图保存" : "Take screenshot after transfer"}</p>
                  <p>4. {isZh ? "点击下方按钮上传转账凭证（仅通知卖家）" : "Click button below to upload proof (notifies seller)"}</p>
                </div>
                <div className="text-xs text-blue-500 bg-blue-100 rounded p-2">
                  {isZh
                    ? "重要提示：诚意金非保证金。是否需要诚意金由买卖双方自行约定。平台不介入资金往来。"
                    : "Important: This is not a mandatory deposit. Platform does not handle funds."}
                </div>
              </div>

              {/* 凭证上传 */}
              {isLoggedIn ? (
                <div className="space-y-3">
                  {proofUrl ? (
                    <div className="bg-green-50 rounded-lg p-3 flex items-center gap-2">
                      <Check className="h-5 w-5 text-green-600" />
                      <span className="text-sm text-green-700">{isZh ? "凭证已上传" : "Proof uploaded"}</span>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors">
                      {uploading ? (
                        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                      ) : (
                        <>
                          <Upload className="h-8 w-8 text-gray-400" />
                      <span className="text-sm text-gray-500 mt-2">
                        {isZh ? "点击上传诚意金转账截图（如适用）" : "Click to upload transfer screenshot (if applicable)"}
                      </span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file);
                        }}
                      />
                    </label>
                  )}
                </div>
              ) : (
                <div className="bg-amber-50 rounded-lg p-3 text-sm text-amber-700">
                  {isZh
                    ? "请先登录后再上传诚意金凭证。您也可以联系卖家线下确认。"
                    : "Please login first to upload earnest money proof."}
                </div>
              )}

              {error && (
                <p className="text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" /> {error}
                </p>
              )}

              <button
                onClick={() => setStep("done")}
                className="w-full py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                {isZh ? "稍后上传，先完成报名" : "Upload later, finish registration"}
              </button>
            </>
          )}

          {/* 步骤3：完成 */}
          {step === "done" && (
            <div className="text-center space-y-4 py-8">
              <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-gray-900">
                  {isZh ? "报名完成！" : "Registration Complete!"}
                </h4>
                <p className="text-sm text-gray-500 mt-2">
                  {isZh
                    ? proofUrl
                      ? "诚意金凭证已上传，卖家将查看。您现在可以提交报价了。"
                      : "报名信息已提交。您现在可以提交报价了。"
                    : "Registration submitted. You can now submit your offer."}
                </p>
              </div>
              <button
                onClick={onClose}
                className="px-8 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                {isZh ? "关闭" : "Close"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
