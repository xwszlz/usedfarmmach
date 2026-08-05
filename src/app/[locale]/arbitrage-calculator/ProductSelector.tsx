"use client";

import { ProductWithDetails } from '@/types';
import { ChevronDown } from 'lucide-react';

interface ProductSelectorProps {
  products: ProductWithDetails[];
  selectedProduct: ProductWithDetails | null;
  onSelect: (product: ProductWithDetails) => void;
}

export default function ProductSelector({ 
  products, 
  selectedProduct, 
  onSelect 
}: ProductSelectorProps) {
  
  const formatProductDisplay = (product: ProductWithDetails) => {
    const brandName = product.brand?.nameZh || '未知品牌';
    const modelName = product.modelName || '未命名';
    const year = product.year ? `(${product.year})` : '';
    const price = product.priceCny ? `¥${product.priceCny.toLocaleString()}` : '价格未知';
    
    return `${brandName} ${modelName} ${year} - ${price}`;
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <label htmlFor="product-select" className="block text-sm font-medium text-gray-700 mb-2">
          选择产品
        </label>
        <div className="relative">
          <select
            id="product-select"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition-colors appearance-none"
            value={selectedProduct?.id || ''}
            onChange={(e) => {
              const selectedId = e.target.value;
              const product = products.find(p => p.id === selectedId);
              if (product) {
                onSelect(product);
              }
            }}
          >
            <option value="">请选择产品...</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {formatProductDisplay(product)}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* 产品快速统计 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
        <div className="bg-blue-50 p-3 rounded-lg">
          <p className="text-xs text-blue-600 font-medium">总产品</p>
          <p className="text-lg font-bold text-blue-700">{products.length}</p>
        </div>
        <div className="bg-green-50 p-3 rounded-lg">
          <p className="text-xs text-green-600 font-medium">有国际价格</p>
          <p className="text-lg font-bold text-green-700">
            {products.filter(p => p.internationalPrices && p.internationalPrices.length > 0).length}
          </p>
        </div>
        <div className="bg-purple-50 p-3 rounded-lg">
          <p className="text-xs text-purple-600 font-medium">平均价格</p>
          <p className="text-lg font-bold text-purple-700">
            ¥{Math.round(products.reduce((sum, p) => sum + (p.priceCny || 0), 0) / products.length).toLocaleString()}
          </p>
        </div>
        <div className="bg-amber-50 p-3 rounded-lg">
          <p className="text-xs text-amber-600 font-medium">平均年份</p>
          <p className="text-lg font-bold text-amber-700">
            {Math.round(products.reduce((sum, p) => sum + (p.year || 0), 0) / products.length)}
          </p>
        </div>
      </div>

      {/* 搜索结果筛选提示 */}
      {products.length > 10 && (
        <div className="text-sm text-gray-500 mt-2">
          使用下拉菜单浏览全部 {products.length} 个产品，或直接在菜单中搜索品牌/型号
        </div>
      )}
    </div>
  );
}