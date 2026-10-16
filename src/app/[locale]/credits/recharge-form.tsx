"use client";

import { useEffect, useState } from "react";
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
 *   - .com：1 美元 = 100 积分，只走 Paddle（无微信/支付宝通道），金额随意充；
 *   - .cn ：1 元   = 100 积分，走微信 Native / 支付宝 扫码付。
 * 下单成功：.com 用 Paddle.js 弹出结账浮层；.cn 显示二维码扫码支付。
 *
 * 🔴 .com 收银台必须用 Paddle.Checkout.open({ transactionId }) 打开：
 *    Paddle 的 checkout.url 只是「本站已审批域名 + _ptxn=<id>」的支付链接，
 *    不是托管收银台；直接 window.location.href 跳过去只会回到本站，付不了款。
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

  // Paddle.js 动态加载 + 初始化（仅 .com）。
  // 用 effect 注入而非 next/script，是为了不改动下面 Card 的 JSX 结构（最小 diff）。
  // 🔴 environment 必须与后端 PADDLE_ENV 一致（sandbox / production），
  //    否则 sandbox 交易无法被 production 前端打开，结账浮层弹不出来。
  useEffect(() => {
    if (!isCom) return;
    const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || "";
    if (!token) return; // 未配 client token：不注入，由后端 503/前端提示兜底
    const environment =
      process.env.NEXT_PUBLIC_PADDLE_ENV === "sandbox" ? "sandbox" : "production";
    const init = () => window.Paddle?.Initialize({ token, environment });
    if (document.getElementById("paddle-js")) {
      init(); // 已注入过（StrictMode 双调用 / 重复挂载），只补初始化
      return;
    }
    const el = document.createElement("script");
    el.id = "paddle-js";
    el.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
    el.async = true;
    el.onload = init;
    document.head.appendChild(el);
  }, [isCom]);

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
      if (data.data?.type === "paddle" && data.data.transactionId) {
        // 只用后端返回的 transactionId 打开浮层；积分数由后端写进 Paddle
        // custom_data，前端不传，防止篡改自定义数据白送积分。
        const Paddle = window.Paddle;
        if (!Paddle) {
          console.error("[RechargeForm] Paddle.js 未加载，无法打开收银台");
          setMsg(t("networkError"));
          return;
        }
        Paddle.Checkout.open({ transactionId: data.data.transactionId });
        return;
      }
      if (data.data?.codeUrl) {
        // codeUrl 是 weixin://…（微信 Native）或 https://qr.alipay.com/…（支付宝）这类支付链接，
        // 不是图片地址；必须先用 qrcode 生成二维码图片再展示，否则 <img src="weixin://…"> 会渲染成破图。
        const QRCode = (await import("qrcode")).default;
        const qrDataUrl = await QRCode.toDataURL(data.data.codeUrl, {
          width: 240,
          margin: 2,
          color: { dark: "#000000", light: "#ffffff" },
        });
        setQr(qrDataUrl);
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
