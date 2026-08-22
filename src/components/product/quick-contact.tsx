"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, Smartphone, ChevronDown, ChevronUp, QrCode } from "lucide-react";
import { useTr } from "@/lib/i18n-tr";
function getLABELS(tr: (s: string) => string): Record<string, {
    title: string;
    desc: string;
    wechat: string;
    alipay: string;
    scan: string;
    contactVia: string;
    largeAmount: string;
    largeDetail: string;
}> {
  return {
    zh: {
        title: tr("快速联系卖家"),
        desc: "\u626B\u7801\u6216\u957F\u6309\u8BC6\u522B\uFF0C\u76F4\u63A5\u6DFB\u52A0\u5356\u5BB6\u5FAE\u4FE1/\u652F\u4ED8\u5B9D",
        wechat: "\u5FAE\u4FE1",
        alipay: "\u652F\u4ED8\u5B9D",
        scan: "\u626B\u7801\u6DFB\u52A0",
        contactVia: "\u6216\u901A\u8FC7\u4EE5\u4E0B\u65B9\u5F0F\u8054\u7CFB\u5356\u5BB6",
        largeAmount: "\u5927\u989D\u4EA4\u6613\u5EFA\u8BAE\u4F7F\u7528 PingPong \u8DE8\u5883\u652F\u4ED8",
        largeDetail: "\u6211\u4EEC\u5C06\u5C3D\u5FEB\u63A5\u5165 PingPong \u8DE8\u5883\u652F\u4ED8\uFF0C\u652F\u6301\u4FC4\u7F57\u65AF\u5362\u5E03\u3001\u7F8E\u5143\u7B49\u591A\u5E01\u79CD\u6536\u6B3E\u3002",
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
        title: "\u0411\u044B\u0441\u0442\u0440\u044B\u0439 \u043A\u043E\u043D\u0442\u0430\u043A\u0442",
        desc: "\u041E\u0442\u0441\u043A\u0430\u043D\u0438\u0440\u0443\u0439\u0442\u0435 QR-\u043A\u043E\u0434 \u0434\u043B\u044F \u0441\u0432\u044F\u0437\u0438 \u0441 \u043F\u0440\u043E\u0434\u0430\u0432\u0446\u043E\u043C",
        wechat: "WeChat",
        alipay: "Alipay",
        scan: "\u0421\u043A\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u0442\u044C",
        contactVia: "\u0418\u043B\u0438 \u0441\u0432\u044F\u0437\u0430\u0442\u044C\u0441\u044F \u0447\u0435\u0440\u0435\u0437",
        largeAmount: "\u041A\u0440\u0443\u043F\u043D\u044B\u0435 \u0441\u0434\u0435\u043B\u043A\u0438: \u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0443\u0435\u043C PingPong",
        largeDetail: "\u0421\u043A\u043E\u0440\u043E \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u043C PingPong \u0434\u043B\u044F \u0442\u0440\u0430\u043D\u0441\u0433\u0440\u0430\u043D\u0438\u0447\u043D\u044B\u0445 \u043F\u043B\u0430\u0442\u0435\u0436\u0435\u0439.",
    },
};
}
interface QuickContactProps {
    locale: string;
}
export function QuickContact({ locale }: QuickContactProps) {
  const tr = useTr();
        const [showTip, setShowTip] = useState(false);
    const l = getLABELS(tr)[locale] || getLABELS(tr).zh;
    return (<Card className="border-green-200 bg-green-50/50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageCircle className="h-5 w-5 text-green-600"/>
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
            <div className="mx-auto h-24 w-24 overflow-hidden rounded-lg border border-green-200">
              <img src="https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com/images/wechat-qr-v2.png" alt="WeChat QR Code" className="h-full w-full object-cover"/>
            </div>
          </div>

          {/* 支付宝 */}
          <div className="rounded-lg border border-blue-200 bg-white p-3 text-center">
            <div className="mb-1.5 flex items-center justify-center gap-1.5">
              <div className="flex h-5 w-5 items-center justify-center rounded bg-blue-500 text-[10px] font-bold text-white">{tr("支")}</div>
              <span className="text-sm font-semibold text-blue-700">{l.alipay}</span>
            </div>
            <div className="mx-auto h-24 w-24 overflow-hidden rounded-lg border border-blue-200">
              <img src="https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com/images/alipay-qr-v2.jpg" alt="Alipay QR Code" className="h-full w-full object-cover"/>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-center gap-2 text-xs text-gray-500">
          <Smartphone className="h-3.5 w-3.5"/>
          {l.contactVia}
        </div>

        {/* 大额提示 */}
        <button onClick={() => setShowTip(!showTip)} className="mt-2 flex w-full items-center justify-center gap-1 text-xs text-accent-600 hover:text-accent-700">
          {showTip ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>}
          {l.largeAmount}
        </button>
        {showTip && (<div className="mt-2 rounded bg-white p-2 text-xs text-accent-700">
            {l.largeDetail}
          </div>)}
      </CardContent>
    </Card>);
}
