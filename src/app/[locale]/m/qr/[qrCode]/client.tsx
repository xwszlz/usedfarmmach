"use client";
import { useState, useRef } from "react";
import Image from "next/image";
import { BadgeCheck, ShieldCheck, Clock, MapPin, Calendar, Factory, Camera, Video, Upload, X, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, History, ScanLine, Eye, } from "lucide-react";
import { useTr } from "@/lib/i18n-tr";
import { translate } from "@/lib/i18n-runtime";
import { getLocale } from "next-intl/server";
/* ========== Types ========== */
interface EventItem {
    id: string;
    eventType: string;
    title: string;
    description: string | null;
    operator: string | null;
    location: string | null;
    eventDate: string;
    evidence: {
        photos?: string[];
        videos?: string[];
    } | null;
}
interface ProductInfo {
    id: string;
    modelName: string;
    year: number | null;
    workingHours: number | null;
    condition: string | null;
    priceCny: number | null;
    location: string | null;
    status: string;
    brandName: string;
    categoryName: string;
    imageUrl: string | null;
    images: string[];
    sellerName: string;
}
interface ProfileInfo {
    qrCode: string;
    isVerified: boolean;
    verifyHash: string | null;
    serialNo: string | null;
    manufactureDate: string | null;
    factoryName: string | null;
    factoryLocation: string | null;
    createdAt: string;
}
/* ========== Constants ========== */
function getEVENT_TYPE_CONFIG(tr: (s: string) => string): Record<string, {
    label: string;
    labelEn: string;
    color: string;
    icon: string;
}> {
  return {
    manufactured: { label: tr("出厂"), labelEn: "Mfg", color: "bg-blue-50 border-blue-200 text-blue-700", icon: "\uD83C\uDFED" },
    listed: { label: tr("上架"), labelEn: "Listed", color: "bg-green-50 border-green-200 text-green-700", icon: "\uD83D\uDCCB" },
    inspected: { label: tr("检测"), labelEn: "Inspected", color: "bg-amber-50 border-amber-200 text-amber-700", icon: "\uD83D\uDD0D" },
    traded: { label: tr("交易"), labelEn: "Traded", color: "bg-purple-50 border-purple-200 text-purple-700", icon: "\uD83E\uDD1D" },
    exported: { label: tr("出口"), labelEn: "Exported", color: "bg-indigo-50 border-indigo-200 text-indigo-700", icon: "\uD83D\uDEA2" },
    maintained: { label: tr("维保"), labelEn: "Maintained", color: "bg-orange-50 border-orange-200 text-orange-700", icon: "\uD83D\uDD27" },
    transferred: { label: tr("过户"), labelEn: "Transferred", color: "bg-gray-50 border-gray-200 text-gray-700", icon: "\uD83D\uDCDD" },
};
}
const CONDITION_LABELS: Record<string, {
    zh: string;
    en: string;
}> = {
    new: { zh: "\u5168\u65B0", en: "New" },
    like_new: { zh: "\u51C6\u65B0", en: "Like New" },
    excellent: { zh: "\u4F18\u79C0", en: "Excellent" },
    good: { zh: "\u826F\u597D", en: "Good" },
    fair: { zh: "\u4E00\u822C", en: "Fair" },
    poor: { zh: "\u8F83\u5DEE", en: "Poor" },
};
/* ========== Main Component ========== */
export default function QRCodePageClient({ locale, profile, product, events, allInspectionPhotos, }: {
    locale: string;
    profile: ProfileInfo;
    product: ProductInfo | null;
    events: EventItem[];
    allInspectionPhotos: string[];
}) {
    const tr = useTr();
    const isZh = locale === "zh";
    /* Local state */
    const [showInspectForm, setShowInspectForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitOk, setSubmitOk] = useState(false);
    const [submitError, setSubmitError] = useState("");
    const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
    const [lightboxImg, setLightboxImg] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);
    const inspectionEvents = events.filter((e) => e.eventType === "inspected");
    const otherEvents = events.filter((e) => e.eventType !== "inspected");
    /* ========== File handling ========== */
    function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
        const files = Array.from(e.target.files || []);
        const newPreviews = files.map((f) => URL.createObjectURL(f));
        setSelectedFiles((prev) => [...prev, ...files]);
        setPreviewUrls((prev) => [...prev, ...newPreviews]);
    }
    function removeFile(index: number) {
        URL.revokeObjectURL(previewUrls[index]);
        setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
        setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
    }
    /* ========== Submit inspection ========== */
    async function submitInspection(e: React.FormEvent) {
        e.preventDefault();
        setSubmitError("");
        const form = e.target as HTMLFormElement;
        const formData = new FormData();
        formData.append("qrCode", profile.qrCode);
        formData.append("title", (form.elements.namedItem("title") as HTMLInputElement)?.value || "\u9A8C\u673A\u8BB0\u5F55");
        formData.append("operator", (form.elements.namedItem("operator") as HTMLInputElement)?.value || "");
        formData.append("location", (form.elements.namedItem("location") as HTMLInputElement)?.value || "");
        formData.append("description", (form.elements.namedItem("description") as HTMLTextAreaElement)?.value || "");
        selectedFiles.forEach((f) => formData.append("files", f));
        setSubmitting(true);
        try {
            const res = await fetch("/api/machinery/inspect", {
                method: "POST",
                body: formData,
            });
            const data = await res.json();
            if (data.success) {
                setSubmitOk(true);
                setTimeout(() => {
                    setShowInspectForm(false);
                    setSubmitOk(false);
                    setSelectedFiles([]);
                    previewUrls.forEach((u) => URL.revokeObjectURL(u));
                    setPreviewUrls([]);
                    // Refresh page
                    window.location.reload();
                }, 1200);
            }
            else {
                setSubmitError(data.error || tr("提交失败"));
            }
        }
        catch {
            setSubmitError(tr("网络错误"));
        }
        finally {
            setSubmitting(false);
        }
    }
    /* ========== Render ========== */
    if (!product) {
        return (<div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-gray-300"/>
          <p className="mt-3 text-gray-500">{tr("农机档案数据异常")}</p>
        </div>
      </div>);
    }
    return (<div className="min-h-screen bg-gray-50 pb-20">
      {/* ===== Header Bar ===== */}
      <div className="bg-white shadow-sm">
        <div className="flex items-center gap-2 px-4 py-3">
          <ScanLine className="h-5 w-5 text-green-600"/>
          <span className="text-sm font-medium text-gray-600">
            {tr("神雕农机 · 一机一码溯源")}
          </span>
        </div>
      </div>

      {/* ===== Machine Card ===== */}
      <div className="mx-3 mt-3 overflow-hidden rounded-xl bg-white shadow-sm">
        {/* Image */}
        {product.imageUrl && (<div className="relative aspect-video w-full bg-gray-100">
            <Image src={product.imageUrl} alt={product.modelName} fill className="object-cover" unoptimized/>
            {/* Status badge */}
            <div className="absolute left-3 top-3">
              {profile.isVerified ? (<span className="inline-flex items-center gap-1 rounded-full bg-green-600 px-3 py-1 text-xs font-medium text-white">
                  <CheckCircle2 className="h-3 w-3"/>
                  {tr("已验证")}
                </span>) : (<span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-3 py-1 text-xs font-medium text-white">
                  <Clock className="h-3 w-3"/>
                  {tr("待验证")}
                </span>)}
            </div>
          </div>)}

        {/* Info */}
        <div className="p-4">
          <h1 className="text-lg font-bold text-gray-900">
            {product.brandName} {product.modelName}
          </h1>
          <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-600">
            {product.year && <span>{tr("年份")}: {product.year}</span>}
            {product.workingHours != null && <span>{tr("工时")}: {product.workingHours}h</span>}
            {product.condition && (<span>{tr("成色")}: {translate(CONDITION_LABELS[product.condition]?.zh ?? product.condition, locale)}</span>)}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-500">
            {product.location && (<span className="flex items-center gap-1">
                <MapPin className="h-3 w-3"/> {product.location}
              </span>)}
            {product.priceCny != null && (<span className="font-semibold text-red-600">
                ¥{product.priceCny.toLocaleString()}
              </span>)}
          </div>

          {/* QR Code */}
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
            <span className="font-mono text-xs font-bold text-gray-500">{profile.qrCode}</span>
            {profile.verifyHash && (<span className="font-mono text-[10px] text-gray-400">
                {tr("哈希")}: {profile.verifyHash}
              </span>)}
          </div>
        </div>
      </div>

      {/* ===== Inspection Photos Gallery ===== */}
      {allInspectionPhotos.length > 0 && (<div className="mx-3 mt-3 rounded-xl bg-white p-4 shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Camera className="h-4 w-4 text-amber-500"/>
            {tr("验机实拍")}
            <span className="text-xs text-gray-400">({allInspectionPhotos.length})</span>
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {allInspectionPhotos.map((url, i) => (<button key={i} onClick={() => setLightboxImg(url)} className="relative aspect-square overflow-hidden rounded-lg bg-gray-100">
                <Image src={url} alt={`Inspection ${i + 1}`} fill className="object-cover" unoptimized/>
              </button>))}
          </div>
        </div>)}

      {/* ===== Lifecycle Timeline ===== */}
      <div className="mx-3 mt-3 rounded-xl bg-white p-4 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-700">
          <History className="h-4 w-4 text-blue-500"/>
          {tr("全生命周期档案")}
          <span className="text-xs text-gray-400">({events.length})</span>
        </h3>

        {events.length === 0 ? (<p className="py-4 text-center text-sm text-gray-400">
            {tr("暂无记录")}
          </p>) : (<div className="space-y-0">
            {events.map((event, idx) => {
  const tr = useTr();
                const cfg = getEVENT_TYPE_CONFIG(tr)[event.eventType] || {
                    label: event.eventType,
                    labelEn: event.eventType,
                    color: "bg-gray-50 border-gray-200 text-gray-700",
                    icon: "\uD83D\uDCCC",
                };
                const isExpanded = expandedEvent === event.id;
                const hasMedia = event.eventType === "inspected" &&
                    event.evidence &&
                    (event.evidence.photos?.length || event.evidence.videos?.length);
                return (<div key={event.id} className="relative">
                  {/* Connecting line */}
                  {idx < events.length - 1 && (<div className="absolute left-[19px] top-10 h-full w-0.5 bg-gray-200"/>)}

                  <div className={`flex gap-3 py-2 ${event.eventType === "inspected" ? "bg-amber-50/50 -mx-4 px-4 rounded-lg" : ""}`}>
                    {/* Dot */}
                    <div className="mt-0.5 flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full border text-xs" style={{ backgroundColor: event.eventType === "inspected" ? "#fef3c7" : "#f9fafb", borderColor: event.eventType === "inspected" ? "#f59e0b" : "#d1d5db" }}>
                      {cfg.icon}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${cfg.color}`}>
                          {isZh ? cfg.label : cfg.labelEn}
                        </span>
                        <span className="text-sm font-medium text-gray-800">{event.title}</span>
                        {hasMedia && (<button onClick={() => setExpandedEvent(isExpanded ? null : event.id)} className="ml-auto flex-shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100">
                            {isExpanded ? <ChevronUp className="h-4 w-4"/> : <ChevronDown className="h-4 w-4"/>}
                          </button>)}
                      </div>

                      {event.description && <p className="mt-1 text-xs text-gray-500">{event.description}</p>}

                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
                        <span>{new Date(event.eventDate).toLocaleString(isZh ? "zh-CN" : "en-US")}</span>
                        {event.operator && <span>· {event.operator}</span>}
                        {event.location && (<span className="flex items-center gap-0.5">
                            <MapPin className="h-3 w-3"/> {event.location}
                          </span>)}
                      </div>

                      {/* Expanded media for inspection events */}
                      {isExpanded && hasMedia && (<div className="mt-3 space-y-2">
                          {event.evidence!.photos && event.evidence!.photos.length > 0 && (<div>
                              <p className="mb-2 text-xs font-medium text-gray-500">
                                {tr("检测照片")} ({event.evidence!.photos.length})
                              </p>
                              <div className="grid grid-cols-3 gap-2">
                                {event.evidence!.photos.map((url: string, pi: number) => (<button key={pi} onClick={() => setLightboxImg(url)} className="relative aspect-square overflow-hidden rounded-lg bg-gray-100">
                                    <Image src={url} alt="" fill className="object-cover" unoptimized/>
                                  </button>))}
                              </div>
                            </div>)}
                          {event.evidence!.videos && event.evidence!.videos.length > 0 && (<div>
                              <p className="mb-2 text-xs font-medium text-gray-500">
                                {tr("检测视频")} ({event.evidence!.videos.length})
                              </p>
                              {event.evidence!.videos.map((url: string, vi: number) => (<a key={vi} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-xs text-blue-600">
                                  <Video className="h-4 w-4"/>
                                  {tr("查看视频")} {vi + 1}
                                </a>))}
                            </div>)}
                        </div>)}
                    </div>
                  </div>
                </div>);
            })}
          </div>)}
      </div>

      {/* ===== Add Inspection Button (floating) ===== */}
      <div className="fixed bottom-6 left-0 right-0 mx-auto w-fit">
        <button onClick={() => setShowInspectForm(true)} className="flex items-center gap-2 rounded-full bg-green-600 px-6 py-3 text-sm font-bold text-white shadow-lg transition-all hover:bg-green-700 active:scale-95">
          <Camera className="h-5 w-5"/>
          {tr("添加验机记录")}
        </button>
      </div>

      {/* ===== Inspection Form Modal ===== */}
      {showInspectForm && (<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setShowInspectForm(false)}>
          <div className="w-full max-w-lg rounded-t-2xl bg-white px-4 pb-8 pt-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            {/* Handle */}
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-300"/>

            <h2 className="mb-4 text-center text-base font-bold text-gray-800">
              {tr("验机记录")}
            </h2>

            {submitOk ? (<div className="flex flex-col items-center py-8">
                <CheckCircle2 className="h-12 w-12 text-green-500"/>
                <p className="mt-2 text-sm text-gray-600">{tr("提交成功，页面刷新中...")}</p>
              </div>) : (<form onSubmit={submitInspection} className="space-y-4">
                {/* Title */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    {tr("检测标题")} *
                  </label>
                  <input name="title" required placeholder={tr("如：发动机运行检测")} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"/>
                </div>

                {/* Operator */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    {tr("检测人员")}
                  </label>
                  <input name="operator" placeholder={tr("验机员姓名")} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"/>
                </div>

                {/* Location */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    {tr("检测地点")}
                  </label>
                  <input name="location" placeholder={tr("如：石家庄元氏县马村镇")} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"/>
                </div>

                {/* Description */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    {tr("检测说明")}
                  </label>
                  <textarea name="description" rows={3} placeholder={tr("描述检测项目、结果、发现的问题等")} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"/>
                </div>

                {/* File Upload */}
                <div>
                  <label className="mb-2 block text-xs font-medium text-gray-600">
                    {tr("照片/视频")}
                  </label>

                  {/* Preview */}
                  {previewUrls.length > 0 && (<div className="mb-2 grid grid-cols-4 gap-2">
                      {previewUrls.map((url, i) => (<div key={i} className="relative aspect-square overflow-hidden rounded-lg bg-gray-100">
                          <Image src={url} alt="" fill className="object-cover" unoptimized/>
                          <button type="button" onClick={() => removeFile(i)} className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white">
                            <X className="h-3 w-3"/>
                          </button>
                        </div>))}
                    </div>)}

                  <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple onChange={handleFileSelect} className="hidden"/>
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 py-4 text-sm text-gray-500 hover:border-green-400 hover:text-green-600">
                    <Upload className="h-4 w-4"/>
                    {tr("点击上传照片或视频（可多选）")}
                  </button>
                </div>

                {/* Error */}
                {submitError && (<div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                    <AlertCircle className="h-4 w-4"/>
                    {submitError}
                  </div>)}

                {/* Submit */}
                <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 py-3 text-sm font-bold text-white transition-all hover:bg-green-700 disabled:opacity-50">
                  {submitting ? (<>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"/>
                      {tr("提交中...")}
                    </>) : (<>
                      <Camera className="h-4 w-4"/>
                      {tr("提交验机记录")}
                    </>)}
                </button>

                {/* Cancel */}
                <button type="button" onClick={() => {
                    setShowInspectForm(false);
                    previewUrls.forEach((u) => URL.revokeObjectURL(u));
                    setPreviewUrls([]);
                    setSelectedFiles([]);
                }} className="w-full py-2 text-center text-sm text-gray-400">
                  {tr("取消")}
                </button>
              </form>)}
          </div>
        </div>)}

      {/* ===== Lightbox ===== */}
      {lightboxImg && (<div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4" onClick={() => setLightboxImg(null)}>
          <button onClick={() => setLightboxImg(null)} className="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white">
            <X className="h-6 w-6"/>
          </button>
          <div className="relative h-[80vh] w-full max-w-3xl">
            <Image src={lightboxImg} alt="" fill className="object-contain" unoptimized/>
          </div>
        </div>)}
    </div>);
}
