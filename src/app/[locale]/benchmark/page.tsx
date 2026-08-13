import type { Metadata } from "next";
import { Suspense } from "react";
import BenchmarkClient from "./BenchmarkClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "全球基准价 & 跨境套利看板 · 神雕农机",
  description: "全球二手农机品牌基准价指数、跨境套利匹配与国内卖方采集挂牌，一站实时查看。",
};

export default function BenchmarkPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">全球基准价 &amp; 跨境套利看板</h1>
            <p className="text-gray-600">
              ① 全球品牌基准价指数（BrandBenchmark，与库存解耦）· ② 跨境套利匹配（InternationalPrice ↔
              国内库存）· ③ 国内卖方采集挂牌。所有数据实时读取 Neon。
            </p>
          </div>
          <Suspense
            fallback={
              <div className="border rounded-lg p-8 bg-white shadow-sm text-center text-gray-500">
                加载中…
              </div>
            }
          >
            <BenchmarkClient />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
