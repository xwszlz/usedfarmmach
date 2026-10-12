"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface RechargeFormProps {
  locale: string;
  /** true = .com 国际站：只走 Paddle，不显示微信/支付宝通道 */
  isCom: boolean;
}

/**
 * 积分充值表单（取消会员后启用）。
 * 口径：
 *   - .com：1 美元 = 1 积分，只走 Paddle（无微信/支付宝通道），金额随意充；
 *   - .cn ：1 元   = 1 积分，走微信 Native / 支付宝 扫码付。
 * 下单成功：.com 跳转 Paddle 结账页；.cn 显示二维码扫码支付。
 *
 * 文案全部走 credits 命名空间（8 语），组件内不残留硬编码中文。
 */
export function RechargeForm({ locale, isCom }: RechargeFormProps) {
  const t = useTranslations("credits");
  const [amount, setAmount] = useState("100");
  const [channel, setChannel] = useState<"wechat" | "alipay">("wechat");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);

  async function submit() {
    const val = Number(amount);
    if (!Number.isFinite(val) || val <= 0) {
      setMsg(t("invalidAmount"));
      return;
    }
    setLoading(true);
    setMsg(null);
    setQr(null);
    try {
      // .com 只传 amount（不传 channel）：Paddle 是唯一通道，避免把国内通道参数带出去
      const body = isCom ? { amount: val } : { amount: val, channel };
      const res = await fetch("/api/credits/recharge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        setMsg(data?.error || t("orderFailed"));
        return;
      }
      if (data.data?.type === "paddle" && data.data.url) {
        window.location.href = data.data.url;
        return;
      }
      if (data.data?.codeUrl) {
        setQr(data.data.codeUrl);
        setMsg(t("scanToPay", { credits: data.data.credits }));
      }
    } catch {
      setMsg(t("networkError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="space-y-4 p-6">
      <h2 className="text-lg font-semibold">{t("recharge")}</h2>
      <p className="text-sm text-gray-500">
        {isCom ? t("rechargeComRate") : t("rechargeCnRate")}
      </p>

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

      {/* .com 国际站不渲染任何支付通道 tab：Paddle 是唯一合法路径 */}
      {!isCom && (
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
            {t("payWechat")}
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
            {t("payAlipay")}
          </button>
        </div>
      )}

      <Button className="w-full" disabled={loading} onClick={submit}>
        {loading ? t("processing") : t("recharge")}
      </Button>

      {msg && <div className="text-sm text-gray-700">{msg}</div>}
      {qr && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qr} alt={t("paymentQrAlt")} className="mx-auto h-48 w-48" />
      )}
    </Card>
  );
}
