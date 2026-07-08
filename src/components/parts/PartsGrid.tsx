"use client";

import { Wrench } from "lucide-react";
import PartCard, { type PartCardData } from "./PartCard";
import { Pagination } from "@/components/ui/pagination";

interface PartsGridProps {
  parts: PartCardData[];
  loading: boolean;
  error: boolean;
  locale: string;
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}

export default function PartsGrid({
  parts,
  loading,
  error,
  locale,
  page,
  totalPages,
  total,
  onPageChange,
}: PartsGridProps) {
  const isZh = locale === "zh";

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 text-gray-400">
        <Wrench className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>{isZh ? "配件数据暂时无法加载，请稍后重试" : "Parts data is temporarily unavailable"}</p>
      </div>
    );
  }

  if (!parts || parts.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <Wrench className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>{isZh ? "暂无匹配的配件" : "No matching parts found"}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Results count */}
      <div className="mb-4 text-sm text-gray-500">
        {isZh ? `共 ${total} 个配件` : `${total} parts found`}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {parts.map((part) => (
          <PartCard key={part.id} part={part} locale={locale} />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center mt-8">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </div>
  );
}
