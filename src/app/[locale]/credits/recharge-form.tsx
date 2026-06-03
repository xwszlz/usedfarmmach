"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

interface RechargeFormProps {
  locale: string;
}

export function RechargeForm({ locale }: RechargeFormProps) {
  const t = useTranslations("credits");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleRecharge() {
    const num = Number(amount);
    if (!num || num <= 0) {
      setMessage("请输入有效金额");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/credits/recharge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type: "credits", amount: num }),
      });
      const result = await res.json();

      if (result.success) {
        setMessage(`充值成功！当前积分：${result.data.credits}`);
        setAmount("");
        // 刷新页面显示最新余额
        window.location.reload();
      } else {
        setMessage(result.error || "充值失败");
      }
    } catch {
      setMessage("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }

  const quickAmounts = [100, 500, 1000, 5000];

  return (
    <Card className="space-y-4 p-6">
      <h2 className="text-lg font-semibold">积分充值</h2>

      {/* 快捷金额 */}
      <div className="flex gap-2">
        {quickAmounts.map((amt) => (
          <button
            key={amt}
            onClick={() => setAmount(String(amt))}
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              amount === String(amt)
                ? "border-primary-600 bg-primary-50 text-primary-700"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {amt} 积分
          </button>
        ))}
      </div>

      {/* 自定义金额 */}
      <div className="flex gap-2">
        <Input
          id="recharge-amount"
          name="amount"
          type="number"
          label="自定义金额"
          placeholder="输入积分数量"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>

      <Button onClick={handleRecharge} disabled={loading} className="w-full">
        {loading ? "处理中..." : `充值 ${amount || 0} 积分（模拟）`}
      </Button>

      {message && (
        <p className={`text-sm ${message.includes("成功") ? "text-green-600" : "text-red-500"}`}>
          {message}
        </p>
      )}

      <p className="text-xs text-gray-400">* 当前为模拟支付，不会扣除真实费用</p>
    </Card>
  );
}
