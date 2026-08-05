import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import type { ProductCondition } from "@/types";

const conditionStyles = cva("text-xs font-medium", {
  variants: {
    condition: {
      excellent: "text-green-700",
      good: "text-blue-700",
      fair: "text-yellow-700",
      poor: "text-red-700",
    },
  },
});

interface ConditionBadgeProps {
  condition: ProductCondition;
  label: string;
  className?: string;
}

export function ConditionBadge({ condition, label, className }: ConditionBadgeProps) {
  return (
    <span
      className={cn(
        conditionStyles({ condition }),
        "inline-flex items-center rounded-full px-2 py-0.5",
        condition === "excellent" && "bg-green-100",
        condition === "good" && "bg-blue-100",
        condition === "fair" && "bg-yellow-100",
        condition === "poor" && "bg-red-100",
        className
      )}
    >
      {label}
    </span>
  );
}
