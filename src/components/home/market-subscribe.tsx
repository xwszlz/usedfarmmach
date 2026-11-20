"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, MailPlus } from "lucide-react";

/**
 * `.com` 首页订阅入口（老板 2026-11-20 拍板）。
 *
 * 设计约束（都是硬约束，改动前先读）：
 *
 * 1. **文案自持，不进 i18n 字典。**
 *    `src/lib/i18n-dictionary.ts` 的 sha256 被 `scripts/verify-mail-baseline.mjs`
 *    的断言 4 锁死（字典零改动是邮件改造的验收前提），且 `messages/*.json` 严禁
 *    重序列化（8 语往返必 DIFF）。所以本组件把 8 语文案内联在自己身上 ——
 *    只有 7 条字符串，比动那两个文件安全得多。
 *
 * 2. **只在 `.com` 渲染。**
 *    门控在 `src/app/[locale]/page.tsx`（`isComSite()`），本组件不做站点判断，
 *    避免"组件内静默 return null"这种看不见的分支。`.cn` 的订阅入口按老板要求
 *    留到下一轮单独处理。
 *
 * 3. **接口是既有的 `/api/subscribe`**（POST，body `{ email, source?, locale? }`），
 *    该接口此前是全仓孤儿 —— 注释之外零调用方。这里补上第一个真实调用点。
 *
 * 4. **诚实反馈。** 接口返回 `emailSent` 区分「订阅已入库」与「确认信也发出去了」。
 *    不能对用户说"确认邮件已发送"而实际没发 —— 那正是 2026-11-20 那次
 *    「发了 3 轮探针一封没到」事故的翻版。
 */

interface MarketSubscribeProps {
  locale: string;
}

interface Copy {
  eyebrow: string;
  title: string;
  subtitle: string;
  placeholder: string;
  button: string;
  pending: string;
  success: string;
  successNoMail: string;
  invalid: string;
  error: string;
  privacy: string;
}

const COPY: Record<string, Copy> = {
  zh: {
    eyebrow: "市场情报",
    title: "订阅二手农机行情周报",
    subtitle: "全球货源上新、成交价格与政策变动，每周一封，随时可退订。",
    placeholder: "your@email.com",
    button: "免费订阅",
    pending: "提交中…",
    success: "订阅成功，确认邮件已发送至 {email}。",
    successNoMail: "订阅成功。我们会把最新行情发到 {email}。",
    invalid: "请输入有效的邮箱地址。",
    error: "订阅失败，请稍后重试。",
    privacy: "我们不会向任何第三方分享你的邮箱。",
  },
  en: {
    eyebrow: "Market intelligence",
    title: "Get the used machinery weekly",
    subtitle:
      "New listings, closing prices and policy changes from the global used-machinery market. One email a week, unsubscribe anytime.",
    placeholder: "your@email.com",
    button: "Subscribe free",
    pending: "Submitting…",
    success: "You're subscribed. A confirmation email is on its way to {email}.",
    successNoMail: "You're subscribed. We'll send the latest market data to {email}.",
    invalid: "Please enter a valid email address.",
    error: "Subscription failed. Please try again later.",
    privacy: "We never share your email with third parties.",
  },
  ru: {
    eyebrow: "Аналитика рынка",
    title: "Недельный обзор рынка техники",
    subtitle:
      "Новые предложения, цены сделок и изменения в законодательстве на мировом рынке б/у техники. Одно письмо в неделю, отписка в любой момент.",
    placeholder: "your@email.com",
    button: "Подписаться бесплатно",
    pending: "Отправка…",
    success: "Вы подписаны. Письмо с подтверждением отправлено на {email}.",
    successNoMail: "Вы подписаны. Мы будем присылать данные рынка на {email}.",
    invalid: "Введите корректный адрес электронной почты.",
    error: "Не удалось оформить подписку. Попробуйте позже.",
    privacy: "Мы не передаём ваш адрес третьим лицам.",
  },
  es: {
    eyebrow: "Inteligencia de mercado",
    title: "Reciba el informe semanal de maquinaria usada",
    subtitle:
      "Nuevos anuncios, precios de cierre y cambios normativos del mercado mundial de maquinaria usada. Un correo a la semana, cancelación en cualquier momento.",
    placeholder: "your@email.com",
    button: "Suscribirse gratis",
    pending: "Enviando…",
    success: "Suscripción confirmada. Hemos enviado un correo de confirmación a {email}.",
    successNoMail: "Suscripción confirmada. Enviaremos los datos del mercado a {email}.",
    invalid: "Introduzca una dirección de correo válida.",
    error: "No se pudo completar la suscripción. Inténtelo más tarde.",
    privacy: "No compartimos su correo con terceros.",
  },
  pt: {
    eyebrow: "Inteligência de mercado",
    title: "Receba o boletim semanal de máquinas usadas",
    subtitle:
      "Novos anúncios, preços de fecho e alterações regulatórias do mercado mundial de máquinas usadas. Um e-mail por semana, cancele quando quiser.",
    placeholder: "your@email.com",
    button: "Subscrever grátis",
    pending: "A enviar…",
    success: "Subscrição concluída. Enviámos um e-mail de confirmação para {email}.",
    successNoMail: "Subscrição concluída. Enviaremos os dados de mercado para {email}.",
    invalid: "Introduza um endereço de e-mail válido.",
    error: "Não foi possível concluir a subscrição. Tente novamente mais tarde.",
    privacy: "Nunca partilhamos o seu e-mail com terceiros.",
  },
  ar: {
    eyebrow: "معلومات السوق",
    title: "اشترك في النشرة الأسبوعية للمعدات المستعملة",
    subtitle:
      "أحدث العروض وأسعار الإغلاق والتغييرات التنظيمية في سوق المعدات المستعملة العالمي. رسالة واحدة أسبوعيًا وإمكانية الإلغاء في أي وقت.",
    placeholder: "your@email.com",
    button: "اشترك مجانًا",
    pending: "جارٍ الإرسال…",
    success: "تم الاشتراك. أرسلنا رسالة تأكيد إلى {email}.",
    successNoMail: "تم الاشتراك. سنرسل بيانات السوق إلى {email}.",
    invalid: "يرجى إدخال بريد إلكتروني صالح.",
    error: "تعذّر إتمام الاشتراك. يرجى المحاولة لاحقًا.",
    privacy: "لا نشارك بريدك الإلكتروني مع أي طرف ثالث.",
  },
  fr: {
    eyebrow: "Veille marché",
    title: "Recevez le point hebdomadaire du matériel d'occasion",
    subtitle:
      "Nouvelles annonces, prix de clôture et évolutions réglementaires du marché mondial du matériel d'occasion. Un e-mail par semaine, désinscription à tout moment.",
    placeholder: "your@email.com",
    button: "S'abonner gratuitement",
    pending: "Envoi…",
    success: "Abonnement confirmé. Un e-mail de confirmation a été envoyé à {email}.",
    successNoMail: "Abonnement confirmé. Nous enverrons les données de marché à {email}.",
    invalid: "Veuillez saisir une adresse e-mail valide.",
    error: "L'abonnement a échoué. Veuillez réessayer plus tard.",
    privacy: "Nous ne partageons jamais votre e-mail avec des tiers.",
  },
  hi: {
    eyebrow: "बाज़ार जानकारी",
    title: "पुरानी मशीनरी की साप्ताहिक रिपोर्ट पाएं",
    subtitle:
      "वैश्विक पुरानी मशीनरी बाज़ार की नई लिस्टिंग, बिक्री कीमतें और नीतिगत बदलाव। हफ़्ते में एक ईमेल, कभी भी अनसब्सक्राइब करें।",
    placeholder: "your@email.com",
    button: "मुफ़्त सब्सक्राइब करें",
    pending: "भेजा जा रहा है…",
    success: "सब्सक्रिप्शन हो गया। पुष्टि ईमेल {email} पर भेजा गया है।",
    successNoMail: "सब्सक्रिप्शन हो गया। हम {email} पर बाज़ार डेटा भेजेंगे।",
    invalid: "कृपया मान्य ईमेल पता दर्ज करें।",
    error: "सब्सक्रिप्शन विफल रहा। कृपया बाद में पुनः प्रयास करें।",
    privacy: "हम आपका ईमेल किसी तीसरे पक्ष के साथ साझा नहीं करते।",
  },
};

/** 未知 locale 一律回落英文（`.com` 的默认语言），不回落中文。 */
const FALLBACK_LOCALE = "en";

type Status = "idle" | "submitting" | "success" | "error";

/** 与 `/api/subscribe` 的 EMAIL_RE 保持同一口径的前置校验，省一次无效请求。 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function MarketSubscribe({ locale }: MarketSubscribeProps) {
  const copy = COPY[locale] ?? COPY[FALLBACK_LOCALE];
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  const submitting = status === "submitting";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setStatus("error");
      setMessage(copy.invalid);
      return;
    }

    setStatus("submitting");
    setMessage("");

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // source 必传：接口默认值是 "miniprogram"，不传会把网站访客错记成小程序用户。
        body: JSON.stringify({ email: value, source: "com-home", locale }),
        cache: "no-store",
      });

      // 接口异常时可能返回非 JSON（如 500 的 HTML 错误页），这里必须容错。
      let payload: { success?: boolean; error?: string; emailSent?: boolean } | null = null;
      try {
        payload = await res.json();
      } catch {
        payload = null;
      }

      if (!res.ok || !payload?.success) {
        setStatus("error");
        setMessage(payload?.error || copy.error);
        return;
      }

      setStatus("success");
      setMessage(
        (payload.emailSent ? copy.success : copy.successNoMail).replace("{email}", value)
      );
      setEmail("");
    } catch {
      setStatus("error");
      setMessage(copy.error);
    }
  }

  return (
    <section className="bg-gray-50 py-12">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="grid gap-8 p-6 sm:p-8 md:grid-cols-[1.1fr_1fr] md:items-center">
            {/* 左：文案 */}
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-accent-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent-700">
                <MailPlus aria-hidden="true" className="h-3.5 w-3.5" />
                {copy.eyebrow}
              </div>
              <h2 className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">
                {copy.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">{copy.subtitle}</p>
            </div>

            {/* 右：表单 */}
            <div dir={locale === "ar" ? "rtl" : undefined}>
              <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
                <label htmlFor="market-subscribe-email" className="sr-only">
                  {copy.placeholder}
                </label>
                <input
                  id="market-subscribe-email"
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  placeholder={copy.placeholder}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (status === "error" || status === "success") {
                      setStatus("idle");
                      setMessage("");
                    }
                  }}
                  disabled={submitting}
                  className="w-full min-w-0 flex-1 rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 disabled:bg-gray-50"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-accent-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submitting && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
                  {submitting ? copy.pending : copy.button}
                </button>
              </form>

              {/* aria-live：状态变化对读屏用户可感知 */}
              <div aria-live="polite" className="mt-2 min-h-[1.25rem]">
                {status === "success" && (
                  <p className="flex items-start gap-1.5 text-xs text-green-700">
                    <CheckCircle2 aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0" />
                    <span>{message}</span>
                  </p>
                )}
                {status === "error" && <p className="text-xs text-red-600">{message}</p>}
              </div>

              <p className="mt-1 text-[11px] text-gray-400">{copy.privacy}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
