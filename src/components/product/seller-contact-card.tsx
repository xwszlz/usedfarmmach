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
  inquireCta: string;
  sellerSupplement: string;
  name: string;
  phone: string;
  wechat: string;
  email: string;
}> = {
  zh: {
    title: "加载卖家联系方式",
    loginGate: "登录后即可直接联系卖家，双方直接洽谈",
    loginBtn: "登录 / 注册后查看",
    none: "该设备暂未提供卖家联系方式。留下您的联系方式，我们会第一时间帮您对接卖家。",
    inquireCta: "立即询价",
    sellerSupplement: "我是卖家？补充联系方式 →",
    name: "联系人",
    phone: "电话",
    wechat: "微信",
    email: "邮箱",
  },
  en: {
    title: "Loading seller contact",
    loginGate: "Log in to contact the seller directly",
    loginBtn: "Log in to view",
    none: "This listing has no seller contact info yet. Leave your contact and we will connect you with the seller shortly.",
    inquireCta: "Inquire now",
    sellerSupplement: "Are you the seller? Add contact info →",
    name: "Contact",
    phone: "Phone",
    wechat: "WeChat",
    email: "Email",
  },
  ru: {
    title: "Загрузка контактов",
    loginGate: "Войдите, чтобы связаться с продавцом напрямую",
    loginBtn: "Войти и посмотреть",
    none: "В объявлении пока нет контактов продавца. Оставьте свой контакт — мы свяжем вас с продавцом.",
    inquireCta: "Запросить цену",
    sellerSupplement: "Вы продавец? Добавить контакты →",
    name: "Контакт",
    phone: "Тел.",
    wechat: "WeChat",
    email: "Email",
  },
  es: {
    title: "Cargando contacto del vendedor",
    loginGate: "Inicie sesión para contactar directamente con el vendedor",
    loginBtn: "Iniciar sesión para ver",
    none: "Este anuncio aún no tiene datos de contacto del vendedor. Deje su contacto y le pondremos en contacto con el vendedor.",
    inquireCta: "Consultar ahora",
    sellerSupplement: "¿Es usted el vendedor? Añadir datos de contacto →",
    name: "Contacto",
    phone: "Teléfono",
    wechat: "WeChat",
    email: "Correo",
  },
  pt: {
    title: "Carregando contacto do vendedor",
    loginGate: "Inicie sessão para contactar o vendedor diretamente",
    loginBtn: "Entrar para ver",
    none: "Este anúncio ainda não tem contactos do vendedor. Deixe o seu contacto e iremos ligá-lo ao vendedor.",
    inquireCta: "Consultar agora",
    sellerSupplement: "É o vendedor? Adicionar contactos →",
    name: "Contacto",
    phone: "Telefone",
    wechat: "WeChat",
    email: "E-mail",
  },
  ar: {
    title: "جارٍ تحميل بيانات البائع",
    loginGate: "سجّل الدخول للتواصل مع البائع مباشرة",
    loginBtn: "تسجيل الدخول للعرض",
    none: "لا يتضمن هذا الإعلان بيانات تواصل للبائع بعد. اترك بياناتك وسنوصلك بالبائع في أقرب وقت.",
    inquireCta: "استفسر الآن",
    sellerSupplement: "هل أنت البائع؟ أضف بيانات التواصل ←",
    name: "جهة الاتصال",
    phone: "الهاتف",
    wechat: "WeChat",
    email: "البريد الإلكتروني",
  },
  fr: {
    title: "Chargement du contact du vendeur",
    loginGate: "Connectez-vous pour contacter directement le vendeur",
    loginBtn: "Se connecter pour voir",
    none: "Cette annonce n'a pas encore de coordonnées de vendeur. Laissez votre contact, nous vous mettrons en relation avec le vendeur.",
    inquireCta: "Demander un prix",
    sellerSupplement: "Vous êtes le vendeur ? Ajouter des coordonnées →",
    name: "Contact",
    phone: "Téléphone",
    wechat: "WeChat",
    email: "E-mail",
  },
  hi: {
    title: "विक्रेता संपर्क लोड हो रहा है",
    loginGate: "विक्रेता से सीधे संपर्क करने के लिए लॉग इन करें",
    loginBtn: "देखने के लिए लॉग इन करें",
    none: "इस लिस्टिंग में विक्रेता की संपर्क जानकारी अभी नहीं है। अपना संपर्क छोड़ें, हम आपको विक्रेता से जोड़ेंगे।",
    inquireCta: "अभी पूछताछ करें",
    sellerSupplement: "आप विक्रेता हैं? संपर्क जोड़ें →",
    name: "संपर्क",
    phone: "फ़ोन",
    wechat: "WeChat",
    email: "ईमेल",
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
    let cancelled = false;
    fetch(`/api/products/${productId}/contact`, {
      credentials: "include",
    })
      .then(async (r) => {
        if (cancelled) return;
        if (!r.ok) {
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

  // P0-2：卖家未留联系方式时的兜底 —— 改为引导询价（滚动到下方统一询价区），
  // 而不是向买家陈述「卖家没留联系方式」；同时保留卖家自助补录入口。
  const scrollToInquiry = () => {
    const el = document.getElementById("bargain");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.location.href = `/${locale}/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`;
    }
  };

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
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm text-gray-600">{t.none}</p>
        <button
          type="button"
          onClick={scrollToInquiry}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
        >
          <MessageCircle className="h-4 w-4" />
          {t.inquireCta}
        </button>
        <Link
          href={`/${locale}/seller/products/${productId}/edit`}
          className="mt-2 block text-xs text-gray-400 hover:text-primary-600 hover:underline"
        >
          {t.sellerSupplement}
        </Link>
      </div>
    );
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
