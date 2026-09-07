"use client";

/**
 * 开放直连分销 P0：我的推广码（分享入口页）
 * - 展示个人推广码 + 各付费页带 ?ref= 的推广链接，一键复制
 * - P0 只做入口与链接生成；佣金归因/结算在 P1（AffiliateConversion）
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Copy, Check, Share2, Loader2, Gift } from "lucide-react";

const LABELS: Record<string, {
  title: string;
  subtitle: string;
  myCode: string;
  links: string;
  home: string;
  products: string;
  valuation: string;
  credits: string;
  expo: string;
  copy: string;
  copied: string;
  loginGate: string;
  loginBtn: string;
  tip: string;
}> = {
  zh: {
    title: "我的推广码",
    subtitle: "把带推广码的链接发给朋友/群聊，对方通过链接注册并付费，你就能拿推广奖励",
    myCode: "推广码",
    links: "一键复制推广链接",
    home: "首页",
    products: "设备市场",
    valuation: "AI 估值",
    credits: "会员中心",
    expo: "农机展会",
    copy: "复制链接",
    copied: "已复制",
    loginGate: "登录后即可获取你的专属推广码",
    loginBtn: "去登录",
    tip: "推广奖励规则：一级推广 50%（积分形式先行，现金开放另行通知）。分享越多，奖励越多。",
  },
  en: {
    title: "My Promo Code",
    subtitle: "Share your links with ?ref= code. When someone signs up and pays through your link, you earn referral rewards",
    myCode: "Code",
    links: "Copy your referral links",
    home: "Home",
    products: "Marketplace",
    valuation: "AI Valuation",
    credits: "Membership",
    expo: "Expo",
    copy: "Copy link",
    copied: "Copied",
    loginGate: "Log in to get your personal promo code",
    loginBtn: "Log in",
    tip: "Referral reward: 50% first-level commission (credits first; cash option coming soon).",
  },
  ru: {
    title: "Мой промокод",
    subtitle: "Делитесь ссылками с ?ref= кодом — за регистрацию и оплату по вашей ссылке вы получаете вознаграждение",
    myCode: "Код",
    links: "Скопировать реферальные ссылки",
    home: "Главная",
    products: "Каталог",
    valuation: "ИИ-оценка",
    credits: "Премиум",
    expo: "Выставка",
    copy: "Копировать",
    copied: "Скопировано",
    loginGate: "Войдите, чтобы получить персональный промокод",
    loginBtn: "Войти",
    tip: "Вознаграждение: 50% с первой линии (сначала баллами; денежные выплаты скоро).",
  },
};

const PATHS: { key: "home" | "products" | "valuation" | "credits" | "expo"; path: string }[] = [
  { key: "home", path: "" },
  { key: "products", path: "/products" },
  { key: "valuation", path: "/services/valuation" },
  { key: "credits", path: "/credits" },
  { key: "expo", path: "/expo" },
];

export function PromoClient({ locale }: { locale: string }) {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }
    fetch("/api/user/promo-code", { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => {
        if (r.status === 401) {
          setLoading(false);
          return;
        }
        const d = await r.json();
        if (d.success) setCode(d.data.inviteCode);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const t = LABELS[locale] || LABELS.zh;
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  function buildUrl(path: string): string {
    const ref = code ? `?ref=${encodeURIComponent(code)}` : "";
    return `${origin}/${locale}${path}${ref}`;
  }

  async function copyText(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // 降级：老浏览器
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(""), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!code) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <Gift className="mx-auto mb-4 h-12 w-12 text-primary-500 opacity-50" />
        <h1 className="mb-2 text-2xl font-bold text-gray-900">{t.title}</h1>
        <p className="mb-6 text-sm text-gray-500">{t.loginGate}</p>
        <Link
          href={`/${locale}/auth/login?redirect=/${locale}/user/promo`}
          className="inline-flex items-center rounded-lg bg-primary-600 px-6 py-3 text-sm font-medium text-white hover:bg-primary-700"
        >
          {t.loginBtn}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold text-gray-900">{t.title}</h1>
      <p className="mb-6 text-sm text-gray-500">{t.subtitle}</p>

      {/* 推广码 */}
      <div className="mb-8 rounded-xl border-2 border-dashed border-primary-300 bg-primary-50 p-6 text-center">
        <p className="mb-1 text-xs uppercase tracking-widest text-primary-500">{t.myCode}</p>
        <div className="flex items-center justify-center gap-3">
          <span className="font-mono text-3xl font-bold tracking-widest text-primary-700">{code}</span>
          <button
            onClick={() => copyText("code", code)}
            className="rounded-lg p-2 text-gray-400 hover:bg-white hover:text-primary-600"
            title={t.copy}
          >
            {copiedKey === "code" ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* 推广链接 */}
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-700">
        <Share2 className="h-4 w-4" />
        {t.links}
      </h2>
      <div className="space-y-2">
        {PATHS.map(({ key, path }) => {
          const url = buildUrl(path);
          return (
            <div
              key={key}
              className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-gray-500">{t[key]}</p>
                <p className="truncate font-mono text-xs text-gray-600">{url}</p>
              </div>
              <button
                onClick={() => copyText(key, url)}
                className="flex shrink-0 items-center gap-1 rounded-lg bg-primary-600 px-3 py-2 text-xs font-medium text-white hover:bg-primary-700"
              >
                {copiedKey === key ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedKey === key ? t.copied : t.copy}
              </button>
            </div>
          );
        })}
      </div>

      <p className="mt-6 rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-700">{t.tip}</p>
    </div>
  );
}
