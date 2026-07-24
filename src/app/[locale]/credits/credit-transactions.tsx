"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  balance: number;
  reason: string | null;
  createdAt: string;
}

interface CreditTransactionListProps {
  locale: string;
}

export function CreditTransactionList({ locale }: CreditTransactionListProps) {
  const t = useTranslations("credits");
  // 动态 key 翻译需宽松类型
  const tAny = t as unknown as (key: string) => string;
  const [list, setList] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(true);

  useEffect(() => {
    // 走 cookie 会话鉴权：浏览器对同源请求自动附带 httpOnly cookie
    fetch("/api/credits/transactions", { method: "GET" })
      .then((res) => {
        if (res.status === 401) {
          setAuthed(false);
          return null;
        }
        return res.json();
      })
      .then((result) => {
        if (result && result.success) setList(result.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const typeLabel = (type: string): string => {
    const key = `transactionTypes.${type}`;
    const label = tAny(key);
    // next-intl 未命中时返回 key 本身，作为兜底
    return label && label !== key ? label : type;
  };

  if (loading) {
    return (
      <Card className="space-y-4 p-6">
        <h2 className="text-lg font-semibold">{t("transactions")}</h2>
        <p className="py-8 text-center text-sm text-gray-400">{t("refresh")}…</p>
      </Card>
    );
  }

  if (!authed) {
    return (
      <Card className="space-y-4 p-6">
        <h2 className="text-lg font-semibold">{t("transactions")}</h2>
        <p className="py-8 text-center text-sm text-gray-400">{t("pleaseLogin")}</p>
      </Card>
    );
  }

  return (
    <Card className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("transactions")}</h2>
        <Button variant="ghost" size="sm" onClick={() => window.location.reload()}>
          {t("refresh")}
        </Button>
      </div>

      {list.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">{t("noRecords")}</p>
      ) : (
        <div className="divide-y">
          {list.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{typeLabel(tx.type)}</p>
                {tx.reason && <p className="text-xs text-gray-400">{tx.reason}</p>}
                <p className="text-xs text-gray-400">
                  {new Date(tx.createdAt).toLocaleDateString(
                    locale === "zh" ? "zh-CN" : locale
                  )}
                </p>
              </div>
              <span
                className={`text-sm font-semibold ${
                  tx.amount > 0 ? "text-green-600" : "text-red-500"
                }`}
              >
                {tx.amount > 0 ? `+${tx.amount}` : tx.amount} 分
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
