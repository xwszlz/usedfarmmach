"use client";
/**
 * GuaranteeTradeButton — 产品详情页「担保交易」入口（.cn 专属）
 *
 * 走合规的微信收付通（电商担保交易）路径：
 *   POST /api/trade/intent  → 微信收付通下单 → 返回小程序跳转二维码数据
 * 资金由微信托管，确认收货后自动分账给卖家，平台侧不碰资金（守住二清红线）。
 *
 * 未配置商户时接口返回 503（PAYMENT_NOT_CONFIGURED），按钮会友好提示「配置中」，
 * 不会报错崩溃。一旦填入微信收付通环境变量即自动点亮。
 */
import { useState } from "react";
import { Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useTr } from "@/lib/i18n-tr";
interface GuaranteeTradeButtonProps {
    productId: string;
    productName: string;
    priceCny: number;
}
export function GuaranteeTradeButton({ productId, productName, priceCny, }: GuaranteeTradeButtonProps) {
    const tr = useTr();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [qr, setQr] = useState<string | null>(null);
    const [intentId, setIntentId] = useState("");
    async function handleStart() {
        setLoading(true);
        setError("");
        setQr(null);
        try {
            const res = await fetch("/api/trade/intent", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ productId, priceCny }),
            });
            const data = await res.json();
            if (!data.success) {
                if (data.code === "PAYMENT_NOT_CONFIGURED") {
                    setError("\u62C5\u4FDD\u4EA4\u6613\u5373\u5C06\u5F00\u901A\uFF0C\u5FAE\u4FE1\u6536\u4ED8\u901A\u5546\u6237\u914D\u7F6E\u4E2D");
                }
                else if (res.status === 401) {
                    setError("\u8BF7\u5148\u767B\u5F55\u540E\u518D\u53D1\u8D77\u62C5\u4FDD\u4EA4\u6613");
                }
                else if (data.code === "SITE_NOT_SUPPORTED") {
                    setError("\u5F53\u524D\u7AD9\u70B9\u4E0D\u652F\u6301\u62C5\u4FDD\u4EA4\u6613");
                }
                else {
                    setError(data.error || "\u53D1\u8D77\u62C5\u4FDD\u4EA4\u6613\u5931\u8D25");
                }
                return;
            }
            setIntentId(data.data.intentId);
            setQr(data.data.qrCodeDataUrl || null);
        }
        catch (err: any) {
            setError(err?.message || "\u7F51\u7EDC\u9519\u8BEF\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5");
        }
        finally {
            setLoading(false);
        }
    }
    const fee = Math.max(priceCny * 0.015, 50);
    return (<>
      <Button onClick={() => {
            const first = !qr && !intentId;
            setOpen(true);
            if (first)
                handleStart();
        }} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" size="lg">
        <Shield className="h-5 w-5 mr-2"/>{tr("担保交易 · 微信小程序支付")}</Button>

      <Dialog open={open} onClose={() => setOpen(false)} title={tr("担保交易（微信收付通）")} className="max-w-md">
        <div className="space-y-4">
          <p className="text-sm text-gray-500 flex items-center gap-1">
            <Shield className="h-4 w-4 text-emerald-600 flex-shrink-0"/>{tr("资金由微信收付通托管，确认收货后自动分账给卖家，平台不碰资金")}</p>

          {/* 产品信息 */}
          <div className="rounded-lg bg-gray-50 p-3 text-sm">
            <div className="font-medium">{productName}</div>
            <div className="text-gray-500 mt-1">{tr("交易金额：¥")}{priceCny.toLocaleString()}</div>
            <div className="text-xs text-gray-400 mt-1">{tr("含平台服务费 ¥")}{fee.toFixed(2)}{tr("（1.5%，最低 50 元）")}</div>
          </div>

          {/* 错误提示 */}
          {error && (<div className="rounded-lg bg-amber-50 p-2 text-sm text-amber-700">{error}</div>)}

          {/* 加载中 */}
          {loading && (<div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-500"/>
            </div>)}

          {/* 小程序码 */}
          {!loading && qr && (<div className="flex flex-col items-center">
              <div className="bg-white rounded-lg border border-gray-200 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt={tr("微信小程序码")} className="w-48 h-48"/>
              </div>
              <p className="mt-2 text-xs text-gray-500 text-center">{tr("微信扫一扫 · 进入小程序完成担保支付")}</p>
              {intentId && (<p className="text-[11px] text-gray-400 mt-1 text-center">{tr("担保订单号：")}{intentId}
                </p>)}
            </div>)}

          {/* 生成中 / 兜底文案 */}
          {!loading && !qr && !error && (<div className="flex items-center justify-center py-6 text-sm text-gray-400">{tr("正在生成小程序码…")}</div>)}

          {/* 操作按钮 */}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">{tr("关闭")}</Button>
            {!qr && !loading && (<Button onClick={handleStart} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">{tr("重新生成")}</Button>)}
          </div>
        </div>
      </Dialog>
    </>);
}
