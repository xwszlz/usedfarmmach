import type { Metadata } from "next";
import {
  getMarketingEmail,
  getSalesEmail,
  getSupportEmail,
} from "@/config/support-email";
import { ContactClient } from "./ContactClient";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://usedfarmmach.com";

const META: Record<string, { title: string; description: string }> = {
  zh: {
    title: "联系我们 - 神雕农机",
    description:
      "购机询价、配件询价、验机预约、售后支持、商务合作。在线留言无需安装邮件客户端，1 个工作日内回复。",
  },
  en: {
    title: "Contact us - UsedFarmMach",
    description:
      "Sales enquiries, parts, inspection booking, support and partnerships. Message us online — no mail app needed. Reply within 1 business day.",
  },
  ru: {
    title: "Связаться с нами - UsedFarmMach",
    description:
      "Запросы по технике и запчастям, запись на осмотр, поддержка и сотрудничество. Форма не требует почтовой программы.",
  },
  es: {
    title: "Contáctenos - UsedFarmMach",
    description:
      "Consultas de máquinas y repuestos, cita de inspección, soporte y alianzas. Escríbanos sin instalar correo.",
  },
  pt: {
    title: "Fale conosco - UsedFarmMach",
    description:
      "Consultas de máquinas e peças, agendamento de vistoria, suporte e parcerias. Fale conosco sem instalar e-mail.",
  },
  fr: {
    title: "Nous contacter - UsedFarmMach",
    description:
      "Demandes machines et pièces, rendez-vous d'inspection, assistance et partenariats. Écrivez-nous sans logiciel de messagerie.",
  },
  ar: {
    title: "اتصل بنا - UsedFarmMach",
    description:
      "استفسارات الآلات وقطع الغيار وحجز الفحص والدعم والشراكات. راسلنا دون الحاجة إلى برنامج بريد.",
  },
  hi: {
    title: "संपर्क करें - UsedFarmMach",
    description:
      "मशीन और पुर्ज़ों की पूछताछ, निरीक्षण बुकिंग, सहायता और साझेदारी। बिना ईमेल ऐप के संपर्क करें।",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const meta = META[locale] || META.en;

  const languages: Record<string, string> = {};
  for (const l of Object.keys(META)) {
    languages[l] = `${BASE_URL}/${l}/contact`;
  }

  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: `${BASE_URL}/${locale}/contact`,
      languages,
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: `${BASE_URL}/${locale}/contact`,
      type: "website",
    },
  };
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // 三个地址在服务端解析好再下发：.cn 侧 sales/marketing 未开通，
  // getter 会自动回退成 support@shendiaotech.cn，客户端不用再猜。
  return (
    <ContactClient
      locale={locale}
      salesEmail={getSalesEmail()}
      supportEmail={getSupportEmail()}
      marketingEmail={getMarketingEmail()}
    />
  );
}
