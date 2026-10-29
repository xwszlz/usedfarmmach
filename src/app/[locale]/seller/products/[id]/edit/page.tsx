"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Save, Sparkles } from "lucide-react";
import SellerAiAssistant from "@/components/seller/ai-assistant";
import { getDetailImageUrl, getVideoUrl } from "@/lib/image-url";

interface ProductImageItem {
  id: string;
  url: string;
  isPrimary: boolean;
}

interface ProductVideoItem {
  id: string;
  url: string;
  sortOrder: number;
}

interface ProductDetail {
  id: string;
  modelName: string;
  year: number;
  workingHours: number | null;
  condition: string;
  priceCny: number;
  location: string;
  country: string | null;
  province: string | null;
  city: string | null;
  status: string;
  descriptionZh: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactWechat: string | null;
  contactEmail: string | null;
  engineType: string | null;
  enginePower: number | null;
  driveSystem: string | null;
  mainConfig: string | null;
  overallLength: number | null;
  overallWidth: number | null;
  overallHeight: number | null;
  netWeight: number | null;
  brand: { id: string; nameZh: string; nameEn: string; isChineseBrand: boolean };
  category: { id: string; nameZh: string; nameEn: string };
  images: ProductImageItem[];
  videos: ProductVideoItem[];
}

const STATUS_OPTIONS = [
  { value: "active", label: "在售" },
  { value: "sold", label: "已售" },
  { value: "draft", label: "草稿" },
  { value: "archived", label: "归档（不在站上显示）" },
];

export default function EditProductPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const locale = params.locale as string;

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [showAi, setShowAi] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  // 图片 / 视频列表（本地状态，增删后即时更新，无需刷新页面）
  const [images, setImages] = useState<ProductImageItem[]>([]);
  const [videos, setVideos] = useState<ProductVideoItem[]>([]);
  const [uploading, setUploading] = useState<"image" | "video" | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  // "own" = 只能改自己发布的；"any" = editor/admin，可改全站任意产品
  const [editScope, setEditScope] = useState<"own" | "any">("own");
  // 删除产品的权限（editor / admin / super_admin），由后端判定后下发
  const [canDelete, setCanDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 加载产品数据
  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch(`/api/seller/products/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          const found: ProductDetail = d.data;
          setProduct(found);
          setEditScope(d.editScope === "any" ? "any" : "own");
          setCanDelete(d.canDelete === true);
          setForm({
            brandName: found.brand?.nameZh || "",
            modelName: found.modelName || "",
            year: found.year || 2020,
            workingHours: found.workingHours ?? "",
            engineType: found.engineType || "",
            enginePower: found.enginePower ?? "",
            driveSystem: found.driveSystem || "",
            mainConfig: found.mainConfig || "",
            overallLength: found.overallLength ?? "",
            overallWidth: found.overallWidth ?? "",
            overallHeight: found.overallHeight ?? "",
            netWeight: found.netWeight ?? "",
            condition: found.condition || "good",
            priceCny: found.priceCny || "",
            category: found.category?.nameZh || "",
            country: found.country || "",
            province: found.province || "",
            city: found.city || "",
            location: found.location || "",
            status: found.status || "active",
            descriptionZh: found.descriptionZh || "",
            contactName: found.contactName || "",
            contactPhone: found.contactPhone || "",
            contactWechat: found.contactWechat || "",
            contactEmail: found.contactEmail || "",
          });
          // 提取图片URL（用于AI重新识别）
          const list = found.images || [];
          setImages(list);
          setVideos(found.videos || []);
          setImageUrls(list.map((img) => img.url));
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  // 更新表单字段
  const updateField = (key: string, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // AI回填（只更新勾选的字段）
  const handleAiFill = (data: Record<string, any>) => {
    setForm((prev) => ({ ...prev, ...data }));
  };

  // 保存产品
  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/seller/products/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...form,
          workingHours: form.workingHours ? Number(form.workingHours) : null,
          enginePower: form.enginePower ? Number(form.enginePower) : null,
          overallLength: form.overallLength ? Number(form.overallLength) : null,
          overallWidth: form.overallWidth ? Number(form.overallWidth) : null,
          overallHeight: form.overallHeight ? Number(form.overallHeight) : null,
          netWeight: form.netWeight ? Number(form.netWeight) : null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert("保存成功！");
        router.push(`/${locale}/seller/products`);
      } else {
        alert("保存失败：" + (data.error || "未知错误"));
      }
    } catch (err: any) {
      alert("保存失败：" + err.message);
    } finally {
      setSaving(false);
    }
  };

  // 删除产品：owner 可删自己发的（发错了要能撤），editor/admin 可删全站任意产品。
  // 是否显示按钮由后端下发的 canDelete 决定，前端不自行判断角色。
  async function handleDelete() {
    const confirmed = window.confirm(
      `确定删除产品「${form.modelName || product?.modelName || ""}」吗？\n\n` +
        `删除后不可恢复，关联的图片和视频也会一并删除。\n` +
        `如果只是暂时不卖或不慎发错想撤下，建议把「上架状态」改成「归档」，不必删除。`
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/products/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message || "删除成功");
        router.push(`/${locale}/seller/products`);
      } else {
        alert(`❌ 删除失败：${data.error || "未知错误"}`);
      }
    } catch {
      alert("❌ 网络错误，请重试");
    } finally {
      setDeleting(false);
    }
  }

  // 删除单张图片
  async function handleDeleteImage(imgId: string) {
    if (!window.confirm("确定删除这张图片？删除后不可恢复。")) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/products/${id}/images/${imgId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setImages((prev) => {
          const next = prev.filter((i) => i.id !== imgId);
          setImageUrls(next.map((i) => i.url));
          return next;
        });
        setUploadStatus("✅ 图片已删除");
        setTimeout(() => setUploadStatus(null), 3000);
      } else {
        alert(`❌ ${data.error || "删除失败"}`);
      }
    } catch {
      alert("❌ 网络错误，请重试");
    }
  }

  // 删除单个视频
  async function handleDeleteVideo(vidId: string) {
    if (!window.confirm("确定删除这个视频？删除后不可恢复。")) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/products/${id}/videos/${vidId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setVideos((prev) => prev.filter((v) => v.id !== vidId));
        setUploadStatus("✅ 视频已删除");
        setTimeout(() => setUploadStatus(null), 3000);
      } else {
        alert(`❌ ${data.error || "删除失败"}`);
      }
    } catch {
      alert("❌ 网络错误，请重试");
    }
  }

  // 上传图片 / 视频
  async function handleMediaUpload(
    type: "image" | "video",
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(type);
    setUploadStatus(
      `正在上传 ${files.length} 个 ${type === "image" ? "图片" : "视频"}...`
    );

    try {
      const formData = new FormData();
      formData.append("type", type);
      Array.from(files).forEach((f) => formData.append("files", f));

      const token = localStorage.getItem("token");
      const res = await fetch(`/api/products/${id}/media`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setUploadStatus(`✅ ${data.message}`);
        e.target.value = "";
        if (type === "image" && data.data) {
          const newImgs: ProductImageItem[] = data.data.map(
            (r: { id: string; url: string }) => ({
              id: r.id,
              url: r.url,
              isPrimary: false,
            })
          );
          setImages((prev) => {
            const next = [...prev, ...newImgs];
            setImageUrls(next.map((i) => i.url));
            return next;
          });
        } else if (type === "video" && data.data) {
          const newVids: ProductVideoItem[] = data.data.map(
            (r: { id: string; url: string }) => ({
              id: r.id,
              url: r.url,
              sortOrder: 0,
            })
          );
          setVideos((prev) => [...prev, ...newVids]);
        }
        setTimeout(() => setUploadStatus(null), 2000);
      } else {
        setUploadStatus(`❌ 上传失败: ${data.error || "未知错误"}`);
      }
    } catch {
      setUploadStatus("❌ 网络错误，请重试");
    } finally {
      setUploading(null);
      e.target.value = "";
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }
  if (!product) {
    return (
      <div className="py-20 text-center text-gray-500">产品不存在或无权编辑</div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">编辑产品</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAi(!showAi)}
            className="flex items-center gap-2 rounded-lg border border-primary-300 bg-primary-50 px-4 py-2 text-sm font-medium text-primary-700 hover:bg-primary-100"
          >
            <Sparkles className="h-4 w-4" />
            {showAi ? "关闭AI识别" : "重新AI识别"}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            保存
          </button>
        </div>
      </div>

      {editScope === "any" && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          当前账号具备编辑权限，可修改站内任意产品的详情页（含图片与视频）。
        </div>
      )}

      {/* AI识别面板（URL模式） */}
      {showAi && (
        <div className="mb-6">
          <SellerAiAssistant
            imageUrls={imageUrls}
            imageFiles={[]}
            existingFormValues={form}
            onFill={handleAiFill}
            autoTrigger={false}
            editMode={true}
          />
        </div>
      )}

      {/* 产品图片 */}
      <div className="mb-6 rounded-xl border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="font-semibold text-gray-900">
            产品图片 ({images.length})
          </h2>
          <label
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-medium transition-colors ${
              uploading === "image"
                ? "cursor-not-allowed bg-gray-200 text-gray-400"
                : "bg-blue-50 text-blue-600 hover:bg-blue-100"
            }`}
          >
            {uploading === "image" ? "⏳ 上传中..." : "📷 添加图片"}
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={uploading !== null}
              onChange={(e) => handleMediaUpload("image", e)}
              className="hidden"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-3 p-6">
          {images.length > 0 ? (
            images.map((img) => (
              <div
                key={img.id}
                className="group relative h-24 w-32 overflow-hidden rounded-lg border bg-gray-50"
              >
                <img
                  src={getDetailImageUrl(img.url)}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "/images/placeholders/tractor.svg";
                  }}
                />
                {img.isPrimary && (
                  <span className="absolute bottom-1 left-1 rounded bg-primary-600 px-1.5 py-0.5 text-[10px] text-white">
                    主图
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleDeleteImage(img.id)}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white opacity-0 shadow transition-opacity hover:bg-red-600 group-hover:opacity-100"
                  title="删除图片"
                >
                  ✕
                </button>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-400">
              暂无图片，点击「添加图片」上传
            </p>
          )}
        </div>
      </div>

      {/* 产品视频 */}
      <div className="mb-6 rounded-xl border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="font-semibold text-gray-900">产品视频</h2>
          <label
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-medium transition-colors ${
              uploading === "video"
                ? "cursor-not-allowed bg-gray-200 text-gray-400"
                : "bg-orange-50 text-orange-600 hover:bg-orange-100"
            }`}
          >
            {uploading === "video" ? "⏳ 上传中..." : "🎬 添加视频"}
            <input
              type="file"
              accept="video/*"
              multiple
              disabled={uploading !== null}
              onChange={(e) => handleMediaUpload("video", e)}
              className="hidden"
            />
          </label>
        </div>
        <div className="p-6">
          <p className="mb-3 text-xs text-gray-400">
            支持 MP4、MOV、WebM 格式。视频将展示在产品详情页。
          </p>
          {videos.length > 0 ? (
            <div className="space-y-2">
              {videos.map((vid) => (
                <div
                  key={vid.id}
                  className="group flex items-center gap-3 rounded-lg border bg-gray-50 p-3"
                >
                  <span className="text-xl">🎬</span>
                  <video
                    src={getVideoUrl(vid.url)}
                    controls
                    className="max-h-24 max-w-xs rounded"
                    preload="metadata"
                  />
                  <span className="flex-1 truncate text-xs text-gray-500">
                    {vid.url.split("/").pop()}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteVideo(vid.id)}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500 text-[11px] text-white opacity-0 shadow transition-opacity hover:bg-red-600 group-hover:opacity-100"
                    title="删除视频"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">
              暂无视频，点击「添加视频」上传
            </p>
          )}
        </div>
      </div>

      {uploadStatus && (
        <div
          className={`mb-6 rounded-lg border px-4 py-3 text-sm font-medium ${
            uploadStatus.startsWith("✅")
              ? "border-green-200 bg-green-50 text-green-700"
              : uploadStatus.startsWith("❌")
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-blue-200 bg-blue-50 text-blue-700"
          }`}
        >
          {uploadStatus}
        </div>
      )}

      {/* 编辑表单 */}
      <div className="space-y-6 rounded-xl border bg-white p-6 shadow-sm">
        {/* 基本参数 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              品牌
            </label>
            <input
              value={form.brandName || ""}
              onChange={(e) => updateField("brandName", e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              型号
            </label>
            <input
              value={form.modelName || ""}
              onChange={(e) => updateField("modelName", e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              年份 *
            </label>
            <input
              type="number"
              value={form.year || ""}
              onChange={(e) => updateField("year", Number(e.target.value))}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              工作小时
            </label>
            <input
              type="number"
              value={form.workingHours || ""}
              onChange={(e) =>
                updateField("workingHours", e.target.value)
              }
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              发动机类型
            </label>
            <input
              value={form.engineType || ""}
              onChange={(e) => updateField("engineType", e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              额定功率(HP)
            </label>
            <input
              type="number"
              value={form.enginePower || ""}
              onChange={(e) =>
                updateField("enginePower", e.target.value)
              }
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              传动方式
            </label>
            <input
              value={form.driveSystem || ""}
              onChange={(e) => updateField("driveSystem", e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              设备状况
            </label>
            <select
              value={form.condition || "good"}
              onChange={(e) => updateField("condition", e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            >
              <option value="excellent">优秀/全新</option>
              <option value="good">良好/正常使用</option>
              <option value="fair">一般/有磨损</option>
              <option value="poor">较差/需维修</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              上架状态
            </label>
            <select
              value={form.status || "active"}
              onChange={(e) => updateField("status", e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              品类
            </label>
            <input
              value={form.category || ""}
              onChange={(e) => updateField("category", e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* 规格参数（方案A重点：补齐这些空字段） */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">
            规格参数
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                外形长(mm)
              </label>
              <input
                type="number"
                value={form.overallLength || ""}
                onChange={(e) =>
                  updateField("overallLength", e.target.value)
                }
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                外形宽(mm)
              </label>
              <input
                type="number"
                value={form.overallWidth || ""}
                onChange={(e) =>
                  updateField("overallWidth", e.target.value)
                }
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                外形高(mm)
              </label>
              <input
                type="number"
                value={form.overallHeight || ""}
                onChange={(e) =>
                  updateField("overallHeight", e.target.value)
                }
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                整机重量(KG)
              </label>
              <input
                type="number"
                value={form.netWeight || ""}
                onChange={(e) => updateField("netWeight", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                主要配置
              </label>
              <textarea
                value={form.mainConfig || ""}
                onChange={(e) => updateField("mainConfig", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                rows={2}
                placeholder="如：空调驾驶室、前配重、后三点悬挂、动力输出轴"
              />
            </div>
          </div>
        </div>

        {/* 价格 */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">价格</h3>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              价格（元）*
            </label>
            <input
              type="number"
              value={form.priceCny || ""}
              onChange={(e) => updateField("priceCny", Number(e.target.value))}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* 描述 */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">
            产品描述
          </h3>
          <textarea
            value={form.descriptionZh || ""}
            onChange={(e) => updateField("descriptionZh", e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            rows={5}
            placeholder="产品描述、配置详情、注意事项等..."
          />
        </div>

        {/* 联系方式：谁维护，留谁的联系方式 */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">
            联系方式（谁维护，留谁的联系方式）
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                联系人 / 公司名
              </label>
              <input
                value={form.contactName || ""}
                onChange={(e) => updateField("contactName", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                电话
              </label>
              <input
                type="tel"
                value={form.contactPhone || ""}
                onChange={(e) => updateField("contactPhone", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                微信号
              </label>
              <input
                value={form.contactWechat || ""}
                onChange={(e) => updateField("contactWechat", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                邮箱
              </label>
              <input
                type="email"
                value={form.contactEmail || ""}
                onChange={(e) => updateField("contactEmail", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
          </div>
          <p className="mt-3 rounded-lg bg-blue-50 p-3 text-xs leading-relaxed text-blue-700">
            填写后，买家在产品详情页登录即可看到这些联系方式。请填维护人本人的信息，不要把全公司号码重复贴到每台机器上。
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 border-t pt-4">
          {canDelete && (
            <button
              onClick={handleDelete}
              disabled={deleting || saving}
              className="mr-auto rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              title="删除后不可恢复；只想下架请把「上架状态」改为归档"
            >
              {deleting ? "删除中..." : "🗑 删除此产品"}
            </button>
          )}
          <button
            onClick={() => router.back()}
            className="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            保存修改
          </button>
        </div>
      </div>
    </div>
  );
}
