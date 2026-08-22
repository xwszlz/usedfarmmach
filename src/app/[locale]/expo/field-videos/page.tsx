"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { ArrowUpFromLine, Play, X, Loader2, Camera, Smartphone } from "lucide-react";
import { trackView } from "@/lib/stats";
import { VideoPlayBadge } from "@/components/stats/VideoPlayBadge";
import { useTr } from "@/lib/i18n-tr";
interface VideoEntry {
    id: string;
    url: string;
    brandName: string;
    machineType: string;
    uploadedAt: string;
    playCount?: number;
    source?: string;
}
// ── 模拟已存在的视频（现场上传后补充）──
const PLACEHOLDER_VIDEOS: VideoEntry[] = [];
export default function FieldVideosPage() {
    const tr = useTr();
    const { locale } = useParams<{
        locale: string;
    }>();
    const isZh = locale === "zh";
    const [videos, setVideos] = useState<VideoEntry[]>(PLACEHOLDER_VIDEOS);
    const [brandName, setBrandName] = useState("");
    const [machineType, setMachineType] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState<{
        type: "success" | "error";
        text: string;
    } | null>(null);
    const [playingVideo, setPlayingVideo] = useState<string | null>(null);
    const [playCounts, setPlayCounts] = useState<Record<string, number>>({});
    // 拉取列表后用服务端返回的 playCount 初始化本地播放量
    const applyPlayCounts = (list: VideoEntry[]) => {
        const init: Record<string, number> = {};
        list.forEach((v) => {
            if (v.id)
                init[v.id] = v.playCount ?? 0;
        });
        setPlayCounts(init);
    };
    const handlePlay = async (v: VideoEntry) => {
        const latest = await trackView("fieldVideo", v.id);
        setPlayCounts((prev) => ({
            ...prev,
            [v.id]: latest !== null ? latest : (prev[v.id] ?? v.playCount ?? 0) + 1,
        }));
    };
    // Auto-refresh gallery
    const fetchVideos = async () => {
        try {
            const res = await fetch("/api/field-videos/list");
            if (res.ok) {
                const data = await res.json();
                if (data.videos) {
                    setVideos(data.videos);
                    applyPlayCounts(data.videos);
                }
            }
        }
        catch { }
    };
    useEffect(() => { fetchVideos(); const iv = setInterval(fetchVideos, 15000); return () => clearInterval(iv); }, []);
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f)
            return;
        if (f.size > 100 * 1024 * 1024) {
            setMessage({ type: "error", text: tr("视频超过100MB限制") });
            return;
        }
        setFile(f);
        setPreview(URL.createObjectURL(f));
        setMessage(null);
    };
    const handleUpload = async () => {
        if (!file || !brandName.trim()) {
            setMessage({ type: "error", text: tr("请填写品牌名并选择视频") });
            return;
        }
        setUploading(true);
        setMessage(null);
        try {
            const mimeType = file.type || "video/mp4";
            // 1) Get signed upload URL
            const signRes = await fetch(`/api/field-videos/upload?filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(mimeType)}`, { method: "GET" });
            const sign = await signRes.json();
            if (!sign.success)
                throw new Error(sign.error || "Failed to get upload URL");
            // 2) Upload directly to OSS (bypasses Vercel body limit)
            const ossForm = new FormData();
            ossForm.append("OSSAccessKeyId", sign.data.accessKeyId);
            ossForm.append("policy", sign.data.policy);
            ossForm.append("signature", sign.data.signature);
            ossForm.append("key", sign.data.key);
            ossForm.append("Content-Type", mimeType);
            ossForm.append("success_action_status", "200");
            ossForm.append("file", file, file.name);
            const ossRes = await fetch(sign.data.url, { method: "POST", body: ossForm });
            if (!ossRes.ok)
                throw new Error(`OSS upload failed (${ossRes.status})`);
            // 3) Confirm metadata
            const confRes = await fetch("/api/field-videos/upload", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    finalUrl: sign.data.finalUrl,
                    brandName: brandName.trim(),
                    machineType: machineType.trim() || (tr("现场作业")),
                }),
            });
            const result = await confRes.json();
            if (result.success) {
                setMessage({ type: "success", text: tr("上传成功！视频已发布到大屏") });
                setBrandName("");
                setMachineType("");
                setFile(null);
                setPreview(null);
                fetchVideos();
            }
            else {
                setMessage({ type: "error", text: result.error || (tr("上传失败")) });
            }
        }
        catch (e: any) {
            setMessage({ type: "error", text: e.message || (tr("上传出错")) });
        }
        setUploading(false);
    };
    const t = (zh: string, en: string) => (isZh ? zh : en);
    return (<div className="min-h-screen bg-gray-950">
      {/* Hero */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-b from-green-900/80 to-gray-950"/>
        <div className="relative mx-auto max-w-6xl px-4 py-16 text-center">
          <h1 className="text-4xl font-bold text-white sm:text-5xl">
            {tr("地头展·作业视频大赏")}
          </h1>
          <p className="mt-3 text-lg text-green-200">
            {tr("7月29日 河北元氏·第28届河北农机地头展")}
          </p>
          <p className="mt-1 text-sm text-gray-400">
            {tr("扫码上传您的现场作业视频，即刻在大屏和线上同步展示")}
          </p>
        </div>
      </div>

      {/* Upload Section */}
      <div className="mx-auto max-w-4xl px-4 pb-12">
        <div className="rounded-2xl border border-green-800/40 bg-gray-900/80 p-6 backdrop-blur">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-white">
            <Camera className="h-5 w-5 text-green-400"/>
            {tr("上传您的作业视频")}
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Left: form */}
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">{tr("品牌名称 *")}</label>
                <input type="text" value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder={tr("如：河北英虎机械")} className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-green-500 focus:outline-none"/>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">{tr("机器类型")}</label>
                <input type="text" value={machineType} onChange={(e) => setMachineType(e.target.value)} placeholder={tr("如：玉米收获机")} className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-green-500 focus:outline-none"/>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">
                  {tr("视频文件（≤100MB）")}
                </label>
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-600 bg-gray-800/50 p-4 transition hover:border-green-500">
                  <Smartphone className="mb-1 h-6 w-6 text-gray-400"/>
                  <span className="text-sm text-gray-400">{tr("点击选择视频")}</span>
                  <input type="file" accept="video/*" className="hidden" onChange={handleFileSelect}/>
                </label>
              </div>
              <button onClick={handleUpload} disabled={uploading || !file || !brandName.trim()} className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin"/> : <ArrowUpFromLine className="h-4 w-4"/>}
                {uploading ? tr("上传中...") : tr("上传到集锦")}
              </button>
              {message && (<div className={`rounded-lg p-3 text-sm ${message.type === "success"
                ? "bg-green-900/40 text-green-300"
                : "bg-red-900/40 text-red-300"}`}>
                  {message.text}
                </div>)}
            </div>

            {/* Right: preview */}
            <div className="flex items-center justify-center rounded-lg bg-gray-800/50">
              {preview ? (<video src={preview} controls className="max-h-48 rounded-lg"/>) : (<div className="flex flex-col items-center gap-2 p-8 text-center text-gray-500">
                  <Play className="h-10 w-10"/>
                  <span className="text-sm">{tr("选择视频后预览")}</span>
                </div>)}
            </div>
          </div>
        </div>

        {/* Gallery */}
        <div className="mt-8">
          <h2 className="mb-4 text-xl font-bold text-white">
            {tr("作业视频大赏")}
            <span className="ml-2 text-sm font-normal text-gray-400">
              {tr("（共")}
              {videos.length}
              {tr("个视频）")}
            </span>
          </h2>

          {videos.length === 0 ? (<div className="rounded-2xl border border-dashed border-gray-700 p-12 text-center">
              <Play className="mx-auto mb-3 h-12 w-12 text-gray-600"/>
              <p className="text-lg text-gray-500">{tr("还没有视频上传")}</p>
              <p className="mt-1 text-sm text-gray-600">
                {tr("现场扫码上传，您的视频将出现在这里和大屏上")}
              </p>
            </div>) : (<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {videos.map((v) => (<div key={v.id} className="group relative overflow-hidden rounded-xl border border-gray-800 bg-gray-900 transition hover:border-green-700">
                  <div className="relative aspect-video bg-gray-800">
                    <video src={v.url} controls className="h-full w-full object-cover" poster={v.url + "?x-oss-process=video/snapshot,t_1000,f_jpg,w_800"} onPlay={() => handlePlay(v)}/>
                  </div>
                  <div className="flex items-center justify-between p-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-white">{v.brandName}</h3>
                      <p className="text-xs text-gray-400">{v.machineType}</p>
                      <p className="mt-1 text-xs text-gray-600">
                        {new Date(v.uploadedAt).toLocaleString(isZh ? "zh-CN" : "en-US")}
                      </p>
                    </div>
                    <VideoPlayBadge playCount={playCounts[v.id] ?? v.playCount ?? 0} locale={locale} badgeLabel={tr("地头展现场")}/>
                  </div>
                </div>))}
            </div>)}
        </div>

        {/* QR code hint */}
        <div className="mt-8 rounded-xl border border-green-900/30 bg-green-950/30 p-6 text-center">
          <p className="text-lg font-semibold text-green-300">
            📱 {tr("现场扫码上传 · 即刻上大屏")}
          </p>
          <p className="mt-1 text-sm text-green-400/70">
            {tr("打开手机 → 扫码 → 选视频 → 上传完成")}
          </p>
        </div>
      </div>
    </div>);
}
