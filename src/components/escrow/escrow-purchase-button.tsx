"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

interface EscrowPurchaseButtonProps {
  productId: string;
  productName: string;
  price: number;
  sellerId: string;
}

export function EscrowPurchaseButton({
  productId,
  productName,
  price,
}: EscrowPurchaseButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("wechat");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [error, setError] = useState("");

  async function handleCreateOrder() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/escrow/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, paymentMethod, deliveryAddress }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error);
        return;
      }

      // 发起支付
      const payRes = await fetch(`/api/escrow/pay/${paymentMethod}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: data.data.orderId,
          returnUrl: `${window.location.origin}/escrow/${data.data.orderId}`,
        }),
      });
      const payData = await payRes.json();

      if (!payData.success) {
        setError(payData.error);
        return;
      }

      if (paymentMethod === "alipay" && payData.data.pay_url) {
        window.location.href = payData.data.pay_url;
      } else if (paymentMethod === "wechat" && payData.data.code_url) {
        router.push(`/escrow/${data.data.orderId}?code_url=${encodeURIComponent(payData.data.code_url)}`);
      }
    } catch (err: any) {
      setError(err.message || "创建订单失败");
    } finally {
      setLoading(false);
    }
  }

  const fee = Math.max(price * 0.015, 50);

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="w-full bg-green-600 hover:bg-green-700 text-white"
        size="lg"
      >
        <Shield className="h-5 w-5 mr-2" />
        担保交易购买
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} title="担保交易购买" className="max-w-md">
        <div className="space-y-4">
          <p className="text-sm text-gray-500 flex items-center gap-1">
            <Shield className="h-4 w-4 text-green-600" />
            资金由平台托管，确认收货后才会放款给卖家
          </p>

          {/* 产品信息 */}
          <div className="rounded-lg bg-gray-50 p-3 text-sm">
            <div className="font-medium">{productName}</div>
            <div className="text-gray-500 mt-1">交易金额：¥{price.toLocaleString()}</div>
            <div className="text-xs text-gray-400 mt-1">
              含平台手续费 ¥{fee.toFixed(2)}（1.5%，最低50元）
            </div>
          </div>

          {/* 支付方式 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">选择支付方式</label>
            <div className="grid grid-cols-2 gap-3">
              <label className={`flex items-center gap-2 border rounded-lg p-3 cursor-pointer hover:bg-gray-50 ${paymentMethod === "wechat" ? "border-green-500 bg-green-50" : ""}`}>
                <input
                  type="radio"
                  name="payment"
                  value="wechat"
                  checked={paymentMethod === "wechat"}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="accent-green-600"
                />
                <span className="text-sm">微信支付</span>
              </label>
              <label className={`flex items-center gap-2 border rounded-lg p-3 cursor-pointer hover:bg-gray-50 ${paymentMethod === "alipay" ? "border-blue-500 bg-blue-50" : ""}`}>
                <input
                  type="radio"
                  name="payment"
                  value="alipay"
                  checked={paymentMethod === "alipay"}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="accent-blue-600"
                />
                <span className="text-sm">支付宝</span>
              </label>
            </div>
          </div>

          {/* 收货地址 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">收货地址（可选）</label>
            <textarea
              className="w-full border rounded-lg p-2 text-sm"
              placeholder="请填写收货地址..."
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              rows={2}
            />
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</div>
          )}

          {/* 按钮 */}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">
              取消
            </Button>
            <Button
              onClick={handleCreateOrder}
              disabled={loading}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  创建中...
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  确认担保购买
                </>
              )}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
