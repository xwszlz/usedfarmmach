"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

interface RechargeFormProps {
  locale: string;
}

export function RechargeForm({ locale }: RechargeFormProps) {
  const t = useTranslations("credits");

  return (
    <Card className="space-y-4 p-6">
      <h2 className="text-lg font-semibold">{t("recharge")}</h2>

      {/* 真实支付接入前，充值入口置灰为"即将上线"（P0 I-5 / I-6） */}
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
        {t("rechargeComingSoon")}
      </div>

      <Input
        id="recharge-amount"
        name="amount"
        type="number"
        label="自定义金额"
        placeholder="输入积分数量"
        disabled
      />

      <Button className="w-full" disabled>
        {t("recharge")}
      </Button>
    </Card>
  );
}
