"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Package, Clock, MapPin, DollarSign, Eye, BookOpen } from "lucide-react";

interface SellerProduct {
  id: string;
  modelName: string;
  year: number;
  priceCny: number;
  location: string;
  status: string;
  createdAt: string;
  brand: { nameZh: string };
  category: { nameZh: string };
  images: { url: string }[];
  _count: { inquiries: number };
}

export default function SellerProductsPage() {
  const [products, setProducts] = useState<SellerProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch("/api/seller/products", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => { if (d.success) setProducts(d.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20 text-gray-400">加载中...</div>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">我的产品</h1>
          <p className="mt-1 text-sm text-gray-500">共 {products.length} 个产品</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/zh/seller/guide"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            <BookOpen className="h-4 w-4" /> 发布指引
          </Link>
          <Link
            href="/zh/seller/products/new"
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" /> 发布新产品
          </Link>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-20 text-center">
          <Package className="mx-auto mb-4 h-12 w-12 text-gray-300" />
          <p className="text-gray-500">还没有发布产品</p>
          <Link href="/zh/seller/products/new" className="mt-4 inline-block text-sm font-medium text-primary-600 hover:text-primary-700">
            立即发布第一台产品
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {products.map((p) => (
            <div key={p.id} className="flex items-center gap-4 rounded-xl border bg-white p-4 shadow-sm">
              <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
                {p.images[0] ? (
                  <img src={p.images[0].url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-gray-300"><Package className="h-8 w-8" /></div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-gray-900">{p.brand.nameZh} {p.modelName}</h3>
                <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{p.year}年</span>
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{p.location}</span>
                  <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />¥{p.priceCny.toLocaleString()}</span>
                  <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{p._count.inquiries} 次询盘</span>
                </div>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                p.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
              }`}>
                {p.status === "active" ? "在售" : p.status}
              </span>
              <Link
                href={`/zh/seller/products/${p.id}/edit`}
                className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100"
              >
                编辑
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
