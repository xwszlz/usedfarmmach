"use client";

/**
 * 开放直连 P0：卖家自有联系方式卡片
 * - 未登录 → 显示登录引导（不泄露卖家 PII，也带来注册转化）
 * - 已登录 → 调 GET /api/products/[id]/contact 读取卖家自留的联系方式
 * 设计要点：联系方式不在 SSR HTML 中渲染，只有登录后经接口获取，防止爬虫抓取。
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Mail, MessageCircle, Phone, Lock, Loader2, User } from "lucide-react";

const LABELS: Record<string, {
  title: string;
  loginGate: string;
  loginBtn: string;
  none: string;
  name: string;
  phone: string;
  wechat: string;
  email: string;
}> = {
  zh: {
    title: "加载卖家联系方式",
    loginGate: "登录后即可直接联系卖家，双方直接洽谈",
    loginBtn: "登录 / 注册后查看",
    none: "卖家暂未留下联系方式，可通过上方询价联系",
    name: "联系人",
    phone: "电话",
    wechat: "微信",
    email: "邮箱",
  },
  en: {
    title: "Loading seller contact",
    loginGate: "Log in to contact the seller directly",
    loginBtn: "Log in to view",
    none: "Seller has not provided contact info yet — use the inquiry form above",
    name: "Contact",
    phone: "Phone",
    wechat: "WeChat",
    email: "Email",
  },
  ru: {
    title: "Загрузка контактов",
    loginGate: "Войдите, чтобы связаться с продавцом напрямую",
    loginBtn: "Войти и посмотреть",
    none: "Продавец не указал контакты — задайте вопрос в форме выше",
    name: "Контакт",
    phone: "Тел.",
    wechat: "WeChat",
    email: "Email",
  },
};

interface SellerContact {
  contactName?: string | null;
  contactPhone?: string | null;
  contactWechat?: string | null;
  contactEmail?: string | null;
}

export function SellerContactCard({ productId, locale }: { productId: string; locale: string }) {
  const [contact, setContact] = useState<SellerContact | null>(null);
  // null = 校验登录中；false = 未登录；true = 已登录
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setAuthed(false);
      return;
    }
    let cancelled = false;
    fetch(`/api/products/${productId}/contact`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        if (cancelled) return;
        if (r.status === 401) {
          setAuthed(false);
          return;
        }
        const d = await r.json();
        if (cancelled) return;
        if (d.success) {
          setAuthed(true);
          setContact(d.data);
        } else {
          setAuthed(false);
        }
      })
      .catch(() => {
        if (!cancelled) setAuthed(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  const t = LABELS[locale] || LABELS.zh;

  // 登录态校验中
  if (authed === null) {
    return (
      <div className="flex items-center gap-2 py-2 text-sm text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>{t.title}…</span>
      </div>
    );
  }

  // 未登录 → 引导注册/登录（同时是平台留资入口）
  if (!authed) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
          <Lock className="h-4 w-4" />
          {t.loginGate}
        </div>
        <Link
          href={`/${locale}/auth/login?redirect=/${locale}/products/${productId}`}
          className="mt-2 inline-flex items-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          {t.loginBtn}
        </Link>
      </div>
    );
  }

  const hasAny =
    contact && (contact.contactName || contact.contactPhone || contact.contactWechat || contact.contactEmail);
  if (!hasAny) {
    return <p className="text-sm text-gray-500">{t.none}</p>;
  }

  return (
    <div className="space-y-2 text-sm text-gray-700">
      {contact!.contactName && (
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-gray-400" />
          <span className="text-gray-500">{t.name}: </span>
          <span className="font-medium">{contact!.contactName}</span>
        </div>
      )}
      {contact!.contactPhone && (
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-gray-400" />
          <span className="text-gray-500">{t.phone}: </span>
          <a
            href={`tel:${contact!.contactPhone}`}
            className="font-medium text-primary-600 hover:text-primary-700"
          >
            {contact!.contactPhone}
          </a>
        </div>
      )}
      {contact!.contactWechat && (
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-green-600" />
          <span className="text-gray-500">{t.wechat}: </span>
          <span className="font-medium">{contact!.contactWechat}</span>
        </div>
      )}
      {contact!.contactEmail && (
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-gray-400" />
          <span className="text-gray-500">{t.email}: </span>
          <a
            href={`mailto:${contact!.contactEmail}`}
            className="font-medium text-primary-600 hover:text-primary-700"
          >
            {contact!.contactEmail}
          </a>
        </div>
      )}
    </div>
  );
}
