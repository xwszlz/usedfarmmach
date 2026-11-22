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
import { EmailLink, normalizeEmail } from "@/components/ui/email-link";

const LABELS: Record<string, {
  title: string;
  loginGate: string;
  loginBtn: string;
  none: string;
  name: string;
  phone: string;
  wechat: string;
  email: string;
  /** 免责提示：只在该行真的渲染出来时显示（不得写成整块常驻文案） */
  emailDisclaimer: string;
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
    emailDisclaimer: "该邮箱由卖家自行提供，平台不担保其真实性与有效性，交易前请自行核实。",
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
    emailDisclaimer:
      "This email is provided by the seller. The platform does not guarantee its authenticity, and you should verify it independently before trading.",
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
    emailDisclaimer:
      "Этот адрес указан продавцом. Платформа не гарантирует его достоверность — проверьте его самостоятельно перед сделкой.",
  },
  es: {
    title: "Cargando contacto del vendedor",
    loginGate: "Inicie sesión para contactar directamente con el vendedor",
    loginBtn: "Iniciar sesión para ver",
    none: "El vendedor aún no ha facilitado datos de contacto — use el formulario de consulta de arriba",
    name: "Contacto",
    phone: "Teléfono",
    wechat: "WeChat",
    email: "Correo",
    emailDisclaimer:
      "El vendedor proporciona este correo. La plataforma no garantiza su autenticidad; verifíquelo por su cuenta antes de operar.",
  },
  pt: {
    title: "Carregando contacto do vendedor",
    loginGate: "Inicie sessão para contactar o vendedor diretamente",
    loginBtn: "Entrar para ver",
    none: "O vendedor ainda não indicou contactos — use o formulário de consulta acima",
    name: "Contacto",
    phone: "Telefone",
    wechat: "WeChat",
    email: "E-mail",
    emailDisclaimer:
      "Este e-mail é fornecido pelo vendedor. A plataforma não garante a sua autenticidade; verifique por conta própria antes de negociar.",
  },
  ar: {
    title: "جارٍ تحميل بيانات البائع",
    loginGate: "سجّل الدخول للتواصل مع البائع مباشرة",
    loginBtn: "تسجيل الدخول للعرض",
    none: "لم يضف البائع بيانات تواصل بعد — استخدم نموذج الاستفسار أعلاه",
    name: "جهة الاتصال",
    phone: "الهاتف",
    wechat: "WeChat",
    email: "البريد الإلكتروني",
    emailDisclaimer:
      "هذا البريد مقدَّم من البائع. لا تضمن المنصة صحته أو صلاحيته، لذا يرجى التحقق منه بنفسك قبل التعامل.",
  },
  fr: {
    title: "Chargement du contact du vendeur",
    loginGate: "Connectez-vous pour contacter directement le vendeur",
    loginBtn: "Se connecter pour voir",
    none: "Le vendeur n'a pas encore fourni de coordonnées — utilisez le formulaire de demande ci-dessus",
    name: "Contact",
    phone: "Téléphone",
    wechat: "WeChat",
    email: "E-mail",
    emailDisclaimer:
      "Le vendeur fournit cet e-mail. La plateforme ne garantit ni son authenticité ni sa validité ; vérifiez-le vous-même avant toute transaction.",
  },
  hi: {
    title: "विक्रेता संपर्क लोड हो रहा है",
    loginGate: "विक्रेता से सीधे संपर्क करने के लिए लॉग इन करें",
    loginBtn: "देखने के लिए लॉग इन करें",
    none: "विक्रेता ने अभी तक संपर्क जानकारी नहीं दी है — ऊपर दिए पूछताछ फ़ॉर्म का उपयोग करें",
    name: "संपर्क",
    phone: "फ़ोन",
    wechat: "WeChat",
    email: "ईमेल",
    emailDisclaimer:
      "यह ईमेल विक्रेता द्वारा दिया गया है। प्लेटफ़ॉर्म इसकी प्रामाणिकता की गारंटी नहीं देता; लेन-देन से पहले स्वयं सत्यापित करें।",
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

  // 未收录语种回落英语而非中文 —— `.com` 是国际站，中文外泄比英文兜底糟得多。
  const t = LABELS[locale] || LABELS.en;

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

  // contactEmail 是卖家自填的，可能为空 / 带空格 / 压根不是邮箱。
  // 用 normalizeEmail 一起判定「有没有内容」，否则会出现卡片认为有联系方式
  // 但邮箱那行渲染不出东西的空壳。
  const hasAny =
    contact &&
    (contact.contactName ||
      contact.contactPhone ||
      contact.contactWechat ||
      normalizeEmail(contact.contactEmail));
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
      {normalizeEmail(contact!.contactEmail) && (
        <div>
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-gray-400" />
            <span className="text-gray-500">{t.email}: </span>
            <EmailLink
              email={contact!.contactEmail}
              locale={locale}
              className="font-medium text-primary-600 hover:text-primary-700"
            />
          </div>
          {/* 免责提示跟随邮箱行一起出现：邮箱行不渲染时绝不出现，
              否则只留电话/微信的卖家也会被免责，观感变差（红线 §10.8）。 */}
          <p className="mt-1 pl-6 text-xs leading-relaxed text-gray-400">
            {t.emailDisclaimer}
          </p>
        </div>
      )}
    </div>
  );
}
