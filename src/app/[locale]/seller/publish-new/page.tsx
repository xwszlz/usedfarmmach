"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import Link from "next/link";
import {
  Save, CheckCircle, Loader2, Tractor, Tag, Film, FileText, Globe, Star, ArrowLeft, Image as ImageIcon, Trash2
} from "lucide-react";

interface Opt { id: string; nameZh: string; nameEn?: string; }

const INITIAL = {
  deviceType: "",
  brand: "",
  model: "",
  series: "",
  launchYear: "",
  origin: "",
  isChineseMade: false,
  msrpCny: "",
  msrpUsd: "",
  priceRange: "",
  machineTier: "standard",
  isNewLaunch: true,
  isFeatured: false,
  brochureUrl: "",
  arModelUrl: "",
  images: [] as string[],
  videos: [] as string[],
  descriptionZh: "",
  descriptionEn: "",
  descriptionRu: "",
  descriptionEs: "",
  descriptionFr: "",
  descriptionPt: "",
  descriptionHi: "",
  descriptionAr: "",
};

export default function PublishNewPage() {
  const router = useRouter();
  const locale = useLocale();
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const [cats, setCats] = useState<Opt[]>([]);
  const [brands, setBrands] = useState<Opt[]>([]);
  const [form, setForm] = useState({ ...INITIAL });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) { router.push(`/${locale}/auth/login`); return; }
    const list = (json: any): Opt[] => Array.isArray(json) ? json : (json?.data && Array.isArray(json.data) ? json.data : []);
    fetch("/api/brands-categories").then(r => r.json()).then(d => setCats(list(d).map((c: any) => ({ id: c.id, nameZh: c.nameZh })))).catch(() => {});
    fetch("/api/brands").then(r => r.json()).then(d => setBrands(list(d).map((b: any) => ({ id: b.id, nameZh: b.nameZh, nameEn: b.nameEn })))).catch(() => {});
  }, [token, router]);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const uploadFile = async (file: File): Promise<string> => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      const data = await res.json();
      if (data.success) return data.url;
      throw new Error(data.error || "上传失败");
    } finally { setUploading(false); }
  };

  const onImages = async (files: FileList | null) => {
    if (!files) return;
    const urls: string[] = [];
    for (const f of Array.from(files)) {
      try { urls.push(await uploadFile(f)); } catch (e: any) { setError(e.message); }
    }
    if (urls.length) setForm((f) => ({ ...f, images: [...f.images, ...urls] }));
  };

  const onBrochure = async (file: File | null) => {
    if (!file) return;
    try { const u = await uploadFile(file); set("brochureUrl", u); } catch (e: any) { setError(e.message); }
  };

  const removeImage = (idx: number) => set("images", form.images.filter((_, i) => i !== idx));

  const submit = async () => {
    setError(null);
    if (!form.deviceType || !form.brand || !form.model) { setError("请填写设备类型、品牌、型号（必填）"); return; }
    if (!form.descriptionZh) { setError("请填写中文描述（必填）"); return; }
    setSaving(true);
    try {
      const matched = brands.find(b => b.nameZh === form.brand || b.nameEn === form.brand);
      const body: Record<string, any> = {
        deviceType: form.deviceType,
        brand: form.brand,
        brandId: matched ? matched.id : null,
        model: form.model,
        series: form.series || null,
        launchYear: form.launchYear ? parseInt(form.launchYear) : null,
        year: form.launchYear ? parseInt(form.launchYear) : null,
        origin: form.origin || null,
        isChineseMade: form.isChineseMade,
        condition: "new",
        msrpCny: form.msrpCny ? parseFloat(form.msrpCny) : null,
        msrpUsd: form.msrpUsd ? parseFloat(form.msrpUsd) : null,
        priceRange: form.priceRange || null,
        machineTier: form.machineTier || null,
        isNewLaunch: form.isNewLaunch,
        isFeatured: form.isFeatured,
        brochureUrl: form.brochureUrl || null,
        arModelUrl: form.arModelUrl || null,
        images: form.images,
        videos: form.videos.map(v => v.trim()).filter(Boolean),
        descriptionZh: form.descriptionZh,
        descriptionEn: form.descriptionEn || null,
        descriptionRu: form.descriptionRu || null,
        descriptionEs: form.descriptionEs || null,
        descriptionFr: form.descriptionFr || null,
        descriptionPt: form.descriptionPt || null,
        descriptionHi: form.descriptionHi || null,
        descriptionAr: form.descriptionAr || null,
        itemType: "new",
      };
      const res = await fetch("/api/seller/booth/items", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) setDone(true);
      else setError(data.error || "发布失败");
    } catch (e: any) { setError(e.message || "网络错误"); }
    finally { setSaving(false); }
  };

  if (!token) return <div className="py-20 text-center text-gray-500">请先登录</div>;

  if (done) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <CheckCircle className="mx-auto mb-4 h-16 w-16 text-green-500" />
        <h1 className="text-2xl font-bold text-gray-900">发布成功，已上线！</h1>
        <p className="mt-2 text-gray-500">您的展品已发布到农机展数字展厅，全球买家现在就能看到它。</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href={`/${locale}/expo/showroom`} className="rounded-lg bg-red-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-red-700">查看我的展品</Link>
          <button
            onClick={() => { setDone(false); setForm({ ...INITIAL }); }}
            className="rounded-lg border px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">再发一台</button>
        </div>
      </div>
    );
  }

  const Field = ({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) => (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">{label}{hint && <span className="ml-2 text-xs font-normal text-gray-400">{hint}</span>}</label>
      {children}
    </div>
  );

  const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-red-500";
  const sectionCls = "mb-6 rounded-xl border bg-white p-5 shadow-sm";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Link href={`/${locale}/expo`} className="text-gray-400 hover:text-gray-700"><ArrowLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Tractor className="h-6 w-6 text-red-600" />自主发布农机 · 新机首发
          </h1>
          <p className="mt-1 text-sm text-gray-500">免费发布，提交即上线全球农机展数字展厅（/expo/showroom）。</p>
        </div>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {/* ① 设备档案 */}
      <section className={sectionCls}>
        <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-gray-900"><Tag className="h-4 w-4 text-red-600" />① 设备档案</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="设备类型" hint="必填">
            <input className={inputCls} list="cat-list" value={form.deviceType} onChange={e => set("deviceType", e.target.value)} placeholder="如：拖拉机 / 打捆机" />
            <datalist id="cat-list">{cats.map(c => <option key={c.id} value={c.nameZh} />)}</datalist>
          </Field>
          <Field label="品牌" hint="必填，可下拉或自填">
            <input className={inputCls} list="brand-list" value={form.brand} onChange={e => set("brand", e.target.value)} placeholder="如：CLAAS / 雷沃" />
            <datalist id="brand-list">{brands.map(b => <option key={b.id} value={b.nameZh} />)}</datalist>
          </Field>
          <Field label="型号" hint="必填"><input className={inputCls} value={form.model} onChange={e => set("model", e.target.value)} placeholder="如：JAGUAR 870" /></Field>
          <Field label="系列"><input className={inputCls} value={form.series} onChange={e => set("series", e.target.value)} placeholder="如：SC系列" /></Field>
          <Field label="上市年份"><input className={inputCls} type="number" value={form.launchYear} onChange={e => set("launchYear", e.target.value)} placeholder="如：2025" /></Field>
          <Field label="产地"><input className={inputCls} value={form.origin} onChange={e => set("origin", e.target.value)} placeholder="如：德国 / 中国山东" /></Field>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={form.isChineseMade} onChange={e => set("isChineseMade", e.target.checked)} /> 国产农机（中国制造）
        </label>
      </section>

      {/* ② 价格与定位 */}
      <section className={sectionCls}>
        <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-gray-900"><Star className="h-4 w-4 text-red-600" />② 价格与定位</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="人民币指导价 (¥)"><input className={inputCls} type="number" value={form.msrpCny} onChange={e => set("msrpCny", e.target.value)} placeholder="如：1280000" /></Field>
          <Field label="美元指导价 ($)"><input className={inputCls} type="number" value={form.msrpUsd} onChange={e => set("msrpUsd", e.target.value)} placeholder="如：180000" /></Field>
          <Field label="价格区间档"><input className={inputCls} value={form.priceRange} onChange={e => set("priceRange", e.target.value)} placeholder="如：100-150万" /></Field>
          <Field label="机型档位">
            <select className={inputCls} value={form.machineTier} onChange={e => set("machineTier", e.target.value)}>
              <option value="standard">标准款</option>
              <option value="premium">高端款</option>
              <option value="flagship">旗舰款</option>
            </select>
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={form.isNewLaunch} onChange={e => set("isNewLaunch", e.target.checked)} /> 本次展会首发</label>
          <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={form.isFeatured} onChange={e => set("isFeatured", e.target.checked)} /> 申请精选（首页推荐）</label>
        </div>
      </section>

      {/* ③ 多媒体资产 */}
      <section className={sectionCls}>
        <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-gray-900"><Film className="h-4 w-4 text-red-600" />③ 多媒体资产</h2>
        <Field label="产品图片" hint={`已上传 ${form.images.length} 张`}>
          <div className="flex flex-wrap gap-3">
            {form.images.map((u, i) => (
              <div key={i} className="relative h-20 w-28 overflow-hidden rounded-lg border bg-gray-100">
                <img src={u} alt="" className="h-full w-full object-cover" />
                <button type="button" onClick={() => removeImage(i)} className="absolute right-1 top-1 rounded bg-black/50 p-1 text-white"><Trash2 className="h-3 w-3" /></button>
              </div>
            ))}
            <label className="flex h-20 w-28 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-gray-400 hover:border-red-400">
              <ImageIcon className="h-5 w-5" />{uploading ? "上传中" : "添加"}
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => onImages(e.target.files)} />
            </label>
          </div>
        </Field>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="作业视频链接" hint="多个用逗号分隔"><input className={inputCls} value={form.videos.join(", ")} onChange={e => set("videos", e.target.value.split(","))} placeholder="https://..." /></Field>
          <Field label="AR / 3D 模型链接"><input className={inputCls} value={form.arModelUrl} onChange={e => set("arModelUrl", e.target.value)} placeholder="https://..." /></Field>
        </div>
        <Field label="宣传册 PDF">
          <div className="flex items-center gap-3">
            <input className={inputCls} value={form.brochureUrl} onChange={e => set("brochureUrl", e.target.value)} placeholder="粘贴链接，或上传文件" />
            <label className="flex-shrink-0 cursor-pointer rounded-lg border px-3 py-2 text-xs text-gray-700 hover:bg-gray-50">
              <FileText className="mr-1 inline h-3.5 w-3.5" />上传
              <input type="file" accept="application/pdf" className="hidden" onChange={e => onBrochure(e.target.files?.[0] || null)} />
            </label>
          </div>
        </Field>
      </section>

      {/* ④ 多语描述 */}
      <section className={sectionCls}>
        <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-gray-900"><Globe className="h-4 w-4 text-red-600" />④ 多语描述</h2>
        <div className="space-y-4">
          <Field label="中文描述" hint="必填"><textarea className={inputCls} rows={3} value={form.descriptionZh} onChange={e => set("descriptionZh", e.target.value)} placeholder="机器亮点、配置、工况…" /></Field>
          <Field label="英文描述" hint="国际站必填"><textarea className={inputCls} rows={3} value={form.descriptionEn} onChange={e => set("descriptionEn", e.target.value)} placeholder="Highlights, specs, condition…" /></Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="俄文"><textarea className={inputCls} rows={2} value={form.descriptionRu} onChange={e => set("descriptionRu", e.target.value)} /></Field>
            <Field label="西班牙文"><textarea className={inputCls} rows={2} value={form.descriptionEs} onChange={e => set("descriptionEs", e.target.value)} /></Field>
            <Field label="法文"><textarea className={inputCls} rows={2} value={form.descriptionFr} onChange={e => set("descriptionFr", e.target.value)} /></Field>
            <Field label="葡萄牙文"><textarea className={inputCls} rows={2} value={form.descriptionPt} onChange={e => set("descriptionPt", e.target.value)} /></Field>
            <Field label="印地文"><textarea className={inputCls} rows={2} value={form.descriptionHi} onChange={e => set("descriptionHi", e.target.value)} /></Field>
            <Field label="阿拉伯文"><textarea className={inputCls} rows={2} value={form.descriptionAr} onChange={e => set("descriptionAr", e.target.value)} /></Field>
          </div>
        </div>
      </section>

      <button
        onClick={submit}
        disabled={saving || uploading}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-6 py-3 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
        {saving ? <><Loader2 className="h-4 w-4 animate-spin" />发布中…</> : <><Save className="h-4 w-4" />提交并上线</>}
      </button>
      <p className="mt-3 text-center text-xs text-gray-400">提交后立即可在 <Link href={`/${locale}/expo/showroom`} className="text-red-600 underline">农机展数字展厅</Link> 看到，并自动归入对应品牌馆。</p>
    </div>
  );
}
