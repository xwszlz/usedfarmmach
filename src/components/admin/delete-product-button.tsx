"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface DeleteButtonProps {
  productId: string;
  productName: string;
}

export function DeleteProductButton({ productId, productName }: DeleteButtonProps) {
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    const confirmed = window.confirm(`⚠️ 确定要删除产品「${productName}」吗？\n\n此操作不可撤销，关联的图片和视频记录也将被删除。`);
    if (!confirmed) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/products/${productId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        alert(data.message || "删除成功");
        router.refresh(); // 刷新服务端组件数据
      } else {
        alert(`❌ 删除失败: ${data.error || "未知错误"}`);
      }
    } catch {
      alert("❌ 网络错误，请重试");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className={`ml-2 rounded px-3 py-1 text-xs font-medium transition-colors ${
        deleting
          ? "cursor-not-allowed bg-gray-200 text-gray-400"
          : "bg-red-600 text-white hover:bg-red-700"
      }`}
    >
      {deleting ? "删除中..." : "删除"}
    </button>
  );
}
