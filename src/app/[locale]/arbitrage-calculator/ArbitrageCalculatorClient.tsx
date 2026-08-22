"use client";
import { useState, useEffect } from "react";
import { ProductWithDetails } from "@/types";
import ArbitrageCalculator from "@/components/arbitrage/calculator/ArbitrageCalculator";
import ProductSelector from "./ProductSelector";
import { Loader2 } from "lucide-react";
import { useTr } from "@/lib/i18n-tr";
// 从API获取产品列表的函数
async function fetchProducts() {
    try {
        const response = await fetch("/api/products?page=1&pageSize=20");
        if (!response.ok) {
            throw new Error("\u83B7\u53D6\u4EA7\u54C1\u5217\u8868\u5931\u8D25");
        }
        const result = await response.json();
        if (result.success && result.data) {
            return result.data.data;
        }
        return [];
    }
    catch (error) {
        console.error("\u83B7\u53D6\u4EA7\u54C1\u5217\u8868\u9519\u8BEF:", error);
        return [];
    }
}
export default function ArbitrageCalculatorClient() {
    const tr = useTr();
    const [products, setProducts] = useState<ProductWithDetails[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedProduct, setSelectedProduct] = useState<ProductWithDetails | null>(null);
    const [error, setError] = useState<string | null>(null);
    // 获取产品列表
    useEffect(() => {
        async function loadProducts() {
            setLoading(true);
            setError(null);
            try {
                const productData = await fetchProducts();
                setProducts(productData);
                // 如果有产品，默认选择第一个
                if (productData.length > 0) {
                    setSelectedProduct(productData[0]);
                }
            }
            catch (err) {
                console.error("\u52A0\u8F7D\u4EA7\u54C1\u9519\u8BEF:", err);
                setError("\u65E0\u6CD5\u52A0\u8F7D\u4EA7\u54C1\u5217\u8868\uFF0C\u8BF7\u5237\u65B0\u9875\u9762\u91CD\u8BD5");
            }
            finally {
                setLoading(false);
            }
        }
        loadProducts();
    }, []);
    // 获取选定产品的国内价格和国外价格
    const getProductPriceInfo = (product: ProductWithDetails) => {
        const domesticPrice = product.priceCny;
        // 获取最新的国际价格
        let foreignPrice = undefined;
        let foreignCurrency = undefined;
        if (product.internationalPrices && product.internationalPrices.length > 0) {
            const latestIntlPrice = product.internationalPrices[0];
            foreignPrice = latestIntlPrice.priceForeignRaw;
            foreignCurrency = latestIntlPrice.currency;
        }
        return {
            domesticPrice,
            foreignPrice,
            foreignCurrency,
        };
    };
    // 处理产品选择
    const handleProductSelect = (product: ProductWithDetails) => {
        setSelectedProduct(product);
    };
    if (loading) {
        return (<div className="border rounded-lg p-8 bg-white shadow-sm text-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4"/>
        <p className="text-gray-600">{tr("加载产品列表中...")}</p>
      </div>);
    }
    if (error) {
        return (<div className="border rounded-lg p-6 bg-white shadow-sm">
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-700">{error}</p>
          <button onClick={() => window.location.reload()} className="mt-3 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors">{tr("重新加载")}</button>
        </div>
      </div>);
    }
    if (products.length === 0) {
        return (<div className="border rounded-lg p-6 bg-white shadow-sm">
        <div className="text-center py-8">
          <p className="text-gray-600 mb-4">{tr("暂无产品数据")}</p>
          <p className="text-sm text-gray-500">{tr("请先添加产品到数据库中")}</p>
        </div>
      </div>);
    }
    return (<div className="space-y-8">
      {/* 产品选择器 */}
      <div className="border rounded-lg p-6 bg-white shadow-sm">
        <h3 className="text-lg font-medium text-gray-700 mb-4">{tr("选择产品")}</h3>
        <ProductSelector products={products} selectedProduct={selectedProduct} onSelect={handleProductSelect}/>
        
        {/* 产品详情预览 */}
        {selectedProduct && (<div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-800 mb-2">{tr("产品信息")}</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600">{tr("品牌")}</p>
                <p className="font-medium">{selectedProduct.brand?.nameZh || "\u672A\u77E5"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">{tr("型号")}</p>
                <p className="font-medium">{selectedProduct.modelName || "\u672A\u77E5"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">{tr("年份")}</p>
                <p className="font-medium">{selectedProduct.year || "\u672A\u77E5"}</p>
              </div>
            </div>
          </div>)}
      </div>

      {/* 套利计算器 */}
      {selectedProduct && (<div className="border rounded-lg p-6 bg-white shadow-sm">
          <h3 className="text-lg font-medium text-gray-700 mb-6">{tr("套利计算")}</h3>
          <ArbitrageCalculator productId={selectedProduct.id} initialDomesticPrice={selectedProduct.priceCny || undefined} initialForeignPrice={selectedProduct.internationalPrices && selectedProduct.internationalPrices.length > 0
                ? selectedProduct.internationalPrices[0].priceForeignRaw || undefined
                : undefined}/>
        </div>)}
    </div>);
}
