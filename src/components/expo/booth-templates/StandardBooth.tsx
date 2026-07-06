"use client";

import { useState } from "react";
import Image from "next/image";
import { Phone, Mail, MapPin, MessageSquare, Package, ChevronRight } from "lucide-react";
import type { BoothData } from "../types";

export default function StandardBooth({ booth, locale, onInquiry }: {
  booth: BoothData;
  locale: string;
  onInquiry: (showcaseItemId?: string) => void;
}) {
  const t = locale === "zh" ? {
    devices: "展品设备",
    company: "企业信息",
    contact: "联系方式",
    inquiry: "在线询盘",
    noDevices: "暂无展品",
    viewDetail: "查看详情",
    inquire: "询盘",
  } : locale === "ru" ? {
    devices: "Экспонаты",
    company: "О компании",
    contact: "Контакты",
    inquiry: "Запрос",
    noDevices: "Нет экспонатов",
    viewDetail: "Подробнее",
    inquire: "Запрос",
  } : {
    devices: "Exhibits",
    company: "About Company",
    contact: "Contact",
    inquiry: "Inquiry",
    noDevices: "No exhibits",
    viewDetail: "View Details",
    inquire: "Inquire",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Cover Image */}
      <div className="relative h-64 w-full overflow-hidden bg-gradient-to-br from-blue-600 to-blue-800 sm:h-80">
        {booth.coverImage ? (
          <img src={booth.coverImage} alt={booth.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center text-white">
              {booth.logoUrl ? (
                <img src={booth.logoUrl} alt="logo" className="mx-auto mb-3 h-20 w-20 rounded-full object-cover ring-4 ring-white/30" />
              ) : null}
              <h1 className="text-2xl font-bold sm:text-3xl">{booth.name}</h1>
            </div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6">
          <div className="mx-auto max-w-5xl">
            <div className="flex items-end gap-4">
              {booth.logoUrl && (
                <img src={booth.logoUrl} alt="logo" className="h-16 w-16 rounded-xl border-2 border-white object-cover shadow-lg" />
              )}
              <div className="text-white">
                <h1 className="text-xl font-bold sm:text-2xl">{booth.name}</h1>
                <p className="mt-1 text-sm text-white/80">{booth.hall}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6">
        {/* Devices Grid */}
        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
              <Package className="h-5 w-5 text-blue-600" />
              {t.devices} ({booth.showcaseItems?.length || 0})
            </h2>
            <button
              onClick={() => onInquiry()}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <MessageSquare className="h-4 w-4" />
              {t.inquiry}
            </button>
          </div>

          {booth.showcaseItems && booth.showcaseItems.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {booth.showcaseItems.map((item) => (
                <div key={item.id} className="group cursor-pointer overflow-hidden rounded-xl border bg-white shadow-sm transition hover:shadow-md"
                  onClick={() => onInquiry(item.id)}
                >
                  <div className="relative aspect-square overflow-hidden bg-gray-100">
                    {item.images && item.images[0] ? (
                      <img src={item.images[0]} alt={item.model || item.deviceType} className="h-full w-full object-cover transition group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-gray-300">
                        <Package className="h-10 w-10" />
                      </div>
                    )}
                    {item.brand && (
                      <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">{item.brand}</span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-medium text-gray-900">{item.model || item.deviceType}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-xs text-gray-500">{item.year || ""} {item.workingHours ? `${item.workingHours}h` : ""}</span>
                      {item.price && (
                        <span className="text-sm font-bold text-orange-600">¥{item.price.toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border-2 border-dashed py-12 text-center text-gray-400">
              <Package className="mx-auto mb-2 h-8 w-8" />
              {t.noDevices}
            </div>
          )}
        </section>

        {/* Company Info */}
        <section className="mb-8 rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-bold text-gray-900">{t.company}</h2>
          <p className="text-sm leading-relaxed text-gray-600">
            {booth.intro || (locale === "zh" ? "暂无企业介绍" : "No company introduction available.")}
          </p>
        </section>

        {/* Contact */}
        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-bold text-gray-900">{t.contact}</h2>
          <div className="flex flex-wrap gap-4">
            {booth.merchant?.phone && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Phone className="h-4 w-4 text-gray-400" />
                {booth.merchant.phone}
              </div>
            )}
            {booth.merchant?.email && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Mail className="h-4 w-4 text-gray-400" />
                {booth.merchant.email}
              </div>
            )}
            {booth.merchant?.location && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MapPin className="h-4 w-4 text-gray-400" />
                {booth.merchant.location}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
