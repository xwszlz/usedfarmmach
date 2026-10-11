"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface RechargeFormProps {
  locale: string;
}

/**
 * 积分充值表单（取消会员后启用）。
 * 口径：.cn 1 元 = 1 积分（微信/支付宝）；.com $1 = 10 积分（Stripe）。
 * 下单成功：.com 跳转 Stripe 收银台；.cn 显示二维码扫码支付。
 */
export function RechargeForm({ locale }: RechargeFormProps) {
  const t = useTranslations("credits");
  const [amount, setAmount] = useState("100");
  const [channel, setChannel] = useState<"wechat" | "alipay">("wechat");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);

  async function submit() {
    const val = Number(amount);
    if (!Number.isFinite(val) || val <= 0) {
      setMsg("请输入有效金额");
      return;
    }
    setLoading(true);
    setMsg(null);
    setQr(null);
    try {
      const res = await fetch("/api/credits/recharge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: val, channel }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        setMsg(data?.error || "充值下单失败，请稍后重试");
        return;
      }
      if (data.data?.type === "stripe" && data.data.url) {
        window.location.href = data.data.url;
        return;
      }
      if (data.data?.codeUrl) {
        setQr(data.data.codeUrl);
        setMsg(`请扫码支付，到账后自动获得 ${data.data.credits} 积分`);
      }
    } catch {
      setMsg("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="space-y-4 p-6">
      <h2 className="text-lg font-semibold">{t("recharge")}</h2>
      <p className="text-sm text-gray-500">1 元 = 1 积分（国际站 $1 = 10 积分），金额随意充。</p>

      <input
        id="recharge-amount"
        name="amount"
        type="number"
        min={1}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder={t("amountPlaceholder")}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-red-500"
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setChannel("wechat")}
          className={`flex-1 rounded-md border px-3 py-2 text-sm ${
            channel === "wechat"
              ? "border-red-500 bg-red-50 text-red-700"
              : "border-gray-300 text-gray-600"
          }`}
        >
          微信支付
        </button>
        <button
          type="button"
          onClick={() => setChannel("alipay")}
          className={`flex-1 rounded-md border px-3 py-2 text-sm ${
            channel === "alipay"
              ? "border-red-500 bg-red-50 text-red-700"
              : "border-gray-300 text-gray-600"
          }`}
        >
          支付宝
        </button>
      </div>

      <Button className="w-full" disabled={loading} onClick={submit}>
        {loading ? "处理中…" : t("recharge")}
      </Button>

      {msg && <div className="text-sm text-gray-700">{msg}</div>}
      {qr && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qr} alt="支付二维码" className="mx-auto h-48 w-48" />
      )}
    </Card>
  );
}
