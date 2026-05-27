"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, Smartphone, ChevronDown, ChevronUp, QrCode } from "lucide-react";

const LABELS: Record<string, {
  title: string;
  desc: string;
  wechat: string;
  alipay: string;
  scan: string;
  contactVia: string;
  largeAmount: string;
  largeDetail: string;
}> = {
  zh: {
    title: "快速联系卖家",
    desc: "扫码或长按识别，直接添加卖家微信/支付宝",
    wechat: "微信",
    alipay: "支付宝",
    scan: "扫码添加",
    contactVia: "或通过以下方式联系卖家",
    largeAmount: "大额交易建议使用 PingPong 跨境支付",
    largeDetail: "我们将尽快接入 PingPong 跨境支付，支持俄罗斯卢布、美元等多币种收款。",
  },
  en: {
    title: "Quick Contact",
    desc: "Scan QR code to contact seller via WeChat or Alipay",
    wechat: "WeChat",
    alipay: "Alipay",
    scan: "Scan to Add",
    contactVia: "Or contact via",
    largeAmount: "Large transactions: PingPong recommended",
    largeDetail: "We will soon integrate PingPong cross-border payment, supporting RUB, USD and more.",
  },
  ru: {
    title: "Быстрый контакт",
    desc: "Отсканируйте QR-код для связи с продавцом",
    wechat: "WeChat",
    alipay: "Alipay",
    scan: "Сканировать",
    contactVia: "Или связаться через",
    largeAmount: "Крупные сделки: рекомендуем PingPong",
    largeDetail: "Скоро подключим PingPong для трансграничных платежей.",
  },
};

interface QuickContactProps {
  locale: string;
}

export function QuickContact({ locale }: QuickContactProps) {
  const [showTip, setShowTip] = useState(false);
  const l = LABELS[locale] || LABELS.zh;

  return (
    <Card className="border-green-200 bg-green-50/50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageCircle className="h-5 w-5 text-green-600" />
          {l.title}
        </CardTitle>
        <p className="text-sm text-gray-500">{l.desc}</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {/* 微信 */}
          <div className="rounded-lg border border-green-200 bg-white p-3 text-center">
            <div className="mb-1.5 flex items-center justify-center gap-1.5">
              <div className="flex h-5 w-5 items-center justify-center rounded bg-green-500 text-[10px] font-bold text-white">W</div>
              <span className="text-sm font-semibold text-green-700">{l.wechat}</span>
            </div>
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-lg border-2 border-dashed border-green-300 bg-green-50/50">
              <div className="text-center text-green-500">
                <QrCode className="mx-auto h-8 w-8" />
                <span className="text-[10px]">{l.scan}</span>
              </div>
            </div>
          </div>

          {/* 支付宝 */}
          <div className="rounded-lg border border-blue-200 bg-white p-3 text-center">
            <div className="mb-1.5 flex items-center justify-center gap-1.5">
              <div className="flex h-5 w-5 items-center justify-center rounded bg-blue-500 text-[10px] font-bold text-white">支</div>
              <span className="text-sm font-semibold text-blue-700">{l.alipay}</span>
            </div>
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-lg border-2 border-dashed border-blue-300 bg-blue-50/50">
              <div className="text-center text-blue-500">
                <QrCode className="mx-auto h-8 w-8" />
                <span className="text-[10px]">{l.scan}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-center gap-2 text-xs text-gray-500">
          <Smartphone className="h-3.5 w-3.5" />
          {l.contactVia}
        </div>

        {/* 大额提示 */}
        <button
          onClick={() => setShowTip(!showTip)}
          className="mt-2 flex w-full items-center justify-center gap-1 text-xs text-accent-600 hover:text-accent-700"
        >
          {showTip ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {l.largeAmount}
        </button>
        {showTip && (
          <div className="mt-2 rounded bg-white p-2 text-xs text-accent-700">
            {l.largeDetail}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
