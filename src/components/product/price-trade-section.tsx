import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tag, Ship, Info } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { translate } from "@/lib/i18n-runtime";
import { getLocale } from "next-intl/server";
interface PriceTradeSectionProps {
    priceCny: number;
    priceUsd: number | null;
    priceMode: string;
    tradeTerm: string;
    tradePort: string | null;
    locale: string;
}
function getLABELS(locale: string): Record<string, {
    title: string;
    unitPrice: string;
    tradeTerm: string;
    fob: string;
    cif: string;
    exw: string;
    por: string;
    porDesc: string;
    priceNote: string;
}> {
  return {
    zh: {
        title: translate("价格与交易条款", locale),
        unitPrice: "\u5355\u4EF7",
        tradeTerm: "\u8D38\u6613\u6761\u6B3E",
        fob: "FOB \u79BB\u5CB8\u4EF7",
        cif: "CIF \u5230\u5CB8\u4EF7",
        exw: "EXW \u5DE5\u5382\u4EA4\u8D27\u4EF7",
        por: "\u5F85\u8BE2\u4EF7 (POR)",
        porDesc: "\u8BF7\u8054\u7CFB\u6211\u4EEC\u83B7\u53D6\u6700\u65B0\u62A5\u4EF7",
        priceNote: "\u4EE5\u4E0A\u4EF7\u683C\u4E3A\u53C2\u8003\u4EF7\uFF0C\u5B9E\u9645\u4EF7\u683C\u4EE5\u5408\u540C\u4E3A\u51C6",
    },
    en: {
        title: "Price & Trade Terms",
        unitPrice: "Unit Price",
        tradeTerm: "Trade Term",
        fob: "FOB",
        cif: "CIF",
        exw: "EXW",
        por: "Contact for Price (POR)",
        porDesc: "Contact us for the latest quotation",
        priceNote: "Prices are for reference only, final price subject to contract",
    },
    ru: {
        title: "\u0426\u0435\u043D\u0430 \u0438 \u0443\u0441\u043B\u043E\u0432\u0438\u044F \u0441\u0434\u0435\u043B\u043A\u0438",
        unitPrice: "\u0426\u0435\u043D\u0430",
        tradeTerm: "\u0423\u0441\u043B\u043E\u0432\u0438\u044F",
        fob: "FOB",
        cif: "CIF",
        exw: "EXW",
        por: "\u0426\u0435\u043D\u0430 \u043F\u043E \u0437\u0430\u043F\u0440\u043E\u0441\u0443 (POR)",
        porDesc: "\u0421\u0432\u044F\u0436\u0438\u0442\u0435\u0441\u044C \u0441 \u043D\u0430\u043C\u0438 \u0434\u043B\u044F \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u0438\u044F \u0430\u043A\u0442\u0443\u0430\u043B\u044C\u043D\u043E\u0439 \u0446\u0435\u043D\u044B",
        priceNote: "\u0426\u0435\u043D\u044B \u0443\u043A\u0430\u0437\u0430\u043D\u044B \u0434\u043B\u044F \u0441\u043F\u0440\u0430\u0432\u043A\u0438, \u043E\u043A\u043E\u043D\u0447\u0430\u0442\u0435\u043B\u044C\u043D\u0430\u044F \u0446\u0435\u043D\u0430 \u043F\u043E \u043A\u043E\u043D\u0442\u0440\u0430\u043A\u0442\u0443",
    },
};
}
export function PriceTradeSection({ priceCny, priceUsd, priceMode, tradeTerm, tradePort, locale, }: PriceTradeSectionProps) {
    const l = getLABELS(locale)[locale] || getLABELS(locale).en;
    const termLabelMap: Record<string, string> = {
        FOB: l.fob,
        CIF: l.cif,
        EXW: l.exw,
    };
    const termLabel = termLabelMap[tradeTerm] || tradeTerm || l.fob;
    return (<Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Tag className="h-5 w-5 text-primary-600"/>
          {l.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {priceMode === "por" ? (
        /* POR mode */
        <div className="rounded-lg bg-amber-50 p-6 text-center">
            <p className="text-2xl font-bold text-amber-700">{l.por}</p>
            <p className="mt-2 text-sm text-amber-600">{l.porDesc}</p>
          </div>) : (
        /* Fixed price mode */
        <div className="space-y-4">
            {/* Unit Price */}
            <div className="rounded-lg bg-primary-50 p-4">
              <div className="text-xs text-gray-500 mb-1">{l.unitPrice}</div>
              <div className="text-2xl font-bold text-primary-700">
                {formatPrice(priceCny, "cny")}
              </div>
              {priceUsd && (<div className="mt-1 text-lg font-semibold text-primary-600">
                  USD {priceUsd.toLocaleString("en-US")}
                </div>)}
            </div>

            {/* Trade Term */}
            <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <Ship className="mt-0.5 h-5 w-5 text-blue-600 flex-shrink-0"/>
              <div>
                <div className="text-xs text-blue-500 mb-0.5">{l.tradeTerm}</div>
                <div className="text-lg font-bold text-blue-700">
                  {termLabel}
                  {tradePort && (<span className="text-blue-600"> {tradePort}</span>)}
                </div>
                {tradeTerm === "FOB" && !tradePort && (<div className="text-sm text-blue-600 mt-0.5">
                    {locale === "zh" ? "\u4E2D\u56FD\u4E3B\u8981\u6E2F\u53E3" : "China Port"}
                  </div>)}
              </div>
            </div>
          </div>)}

        {/* Price note */}
        <div className="flex items-start gap-2 text-xs text-gray-400">
          <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0"/>
          <span>{l.priceNote}</span>
        </div>
      </CardContent>
    </Card>);
}
