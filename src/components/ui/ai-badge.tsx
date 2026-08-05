import { cn } from "@/lib/utils";

interface AiBadgeProps {
  className?: string;
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  label?: string;
}

/**
 * 产品/展位图片的「AI生成图」合规角标。
 * 小巧、半透明、不喧宾夺主，用于声明图片经 AI 增强/生成。
 */
export function AiBadge({
  className,
  position = "top-left",
  label = "AI生成图",
}: AiBadgeProps) {
  const posClass = {
    "top-left": "top-2 left-2",
    "top-right": "top-2 right-2",
    "bottom-left": "bottom-2 left-2",
    "bottom-right": "bottom-2 right-2",
  }[position];

  return (
    <span
      className={cn(
        "absolute z-10 inline-flex items-center rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium leading-none text-white shadow-sm backdrop-blur-sm",
        posClass,
        className
      )}
    >
      {label}
    </span>
  );
}
