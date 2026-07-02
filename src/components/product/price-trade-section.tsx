import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tag, Ship, Info } from "lucide-react";
import { formatPrice } from "@/lib/utils";

interface PriceTradeSectionProps {
  priceCny: number;
  priceUsd: number | null;
  priceMode: string;
  tradeTerm: string;
  tradePort: string | null;
  locale: string;
}

const LABELS: Record<string, {
  title: string;
  unitPrice: string;
  tradeTerm: string;
  fob: string;
  cif: string;
  exw: string;
  por: string;
  porDesc: string;
  priceNote: string;
}> = {
  zh: {
    title: "价格与交易条款",
    unitPrice: "单价",
    tradeTerm: "贸易条款",
    fob: "FOB 离岸价",
    cif: "CIF 到岸价",
    exw: "EXW 工厂交货价",
    por: "Price on Request (POR)",
    porDesc: "价格面议，请联系我们获取最新报价",
    priceNote: "以上价格为参考价，实际价格以合同为准",
  },
  en: {
    title: "Price & Trade Terms",
    unitPrice: "Unit Price",
    tradeTerm: "Trade Term",
    fob: "FOB",
    cif: "CIF",
    exw: "EXW",
    por: "Price on Request (POR)",
    porDesc: "Contact us for the latest quotation",
    priceNote: "Prices are for reference only, final price subject to contract",
  },
  ru: {
    title: "Цена и условия сделки",
    unitPrice: "Цена",
    tradeTerm: "Условия",
    fob: "FOB",
    cif: "CIF",
    exw: "EXW",
    por: "Цена по запросу (POR)",
    porDesc: "Свяжитесь с нами для получения актуальной цены",
    priceNote: "Цены указаны для справки, окончательная цена по контракту",
  },
};

export function PriceTradeSection({
  priceCny,
  priceUsd,
  priceMode,
  tradeTerm,
  tradePort,
  locale,
}: PriceTradeSectionProps) {
  const l = LABELS[locale] || LABELS.en;

  const termLabelMap: Record<string, string> = {
    FOB: l.fob,
    CIF: l.cif,
    EXW: l.exw,
  };

  const termLabel = termLabelMap[tradeTerm] || tradeTerm || l.fob;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Tag className="h-5 w-5 text-primary-600" />
          {l.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {priceMode === "por" ? (
          /* POR mode */
          <div className="rounded-lg bg-amber-50 p-6 text-center">
            <p className="text-2xl font-bold text-amber-700">{l.por}</p>
            <p className="mt-2 text-sm text-amber-600">{l.porDesc}</p>
          </div>
        ) : (
          /* Fixed price mode */
          <div className="space-y-4">
            {/* Unit Price */}
            <div className="rounded-lg bg-primary-50 p-4">
              <div className="text-xs text-gray-500 mb-1">{l.unitPrice}</div>
              <div className="text-2xl font-bold text-primary-700">
                {formatPrice(priceCny, "cny")}
              </div>
              {priceUsd && (
                <div className="mt-1 text-lg font-semibold text-primary-600">
                  USD {priceUsd.toLocaleString("en-US")}
                </div>
              )}
            </div>

            {/* Trade Term */}
            <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <Ship className="mt-0.5 h-5 w-5 text-blue-600 flex-shrink-0" />
              <div>
                <div className="text-xs text-blue-500 mb-0.5">{l.tradeTerm}</div>
                <div className="text-lg font-bold text-blue-700">
                  {termLabel}
                  {tradePort && (
                    <span className="text-blue-600"> {tradePort}</span>
                  )}
                </div>
                {tradeTerm === "FOB" && !tradePort && (
                  <div className="text-sm text-blue-600 mt-0.5">
                    {locale === "zh" ? "中国主要港口" : "China Port"}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Price note */}
        <div className="flex items-start gap-2 text-xs text-gray-400">
          <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <span>{l.priceNote}</span>
        </div>
      </CardContent>
    </Card>
  );
}
