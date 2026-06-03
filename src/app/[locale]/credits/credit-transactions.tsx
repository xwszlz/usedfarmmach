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
  const [list, setList] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/credits/transactions", {
      headers: getAuthHeaders(),
    })
      .then((res) => res.json())
      .then((result) => {
        if (result.success) setList(result.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const typeLabel: Record<string, string> = {
    consume: "消费",
    recharge: "充值",
    reward: "奖励",
    expire: "过期",
  };

  return (
    <Card className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">积分明细</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.location.reload()}
        >
          刷新
        </Button>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-gray-400">加载中...</p>
      ) : list.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">暂无记录</p>
      ) : (
        <div className="divide-y">
          {list.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {typeLabel[tx.type] || tx.type}
                </p>
                <p className="text-xs text-gray-400">
                  {new Date(tx.createdAt).toLocaleDateString("zh-CN")}
                </p>
              </div>
              <span
                className={`text-sm font-semibold ${
                  tx.amount > 0 ? "text-green-600" : "text-red-500"
                }`}
              >
                {tx.amount > 0 ? `+${tx.amount}` : tx.amount} 积分
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}
