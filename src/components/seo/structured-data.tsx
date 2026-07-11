/**
 * JSON-LD Structured Data Components
 * Renders <script type="application/ld+json"> tags for Schema.org markup.
 */

import {
  generateOrganizationJsonLd,
  generateWebSiteJsonLd,
  generateBreadcrumbJsonLd,
  generateProductJsonLd,
  generateItemListJsonLd,
  generateArticleJsonLd,
  generateFaqJsonLd,
  generateLocalBusinessJsonLd,
  generateHowToJsonLd,
  generateCourseJsonLd,
} from "@/lib/jsonld";

// ─────── Generic JSON-LD Script ───────

function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

// ─────── Organization+WebSite (global, root layout) ───────

export function OrganizationStructuredData({ locale }: { locale: string }) {
  return (
    <>
      <JsonLd data={generateOrganizationJsonLd(locale)} />
      <JsonLd data={generateWebSiteJsonLd(locale)} />
    </>
  );
}

// ─────── Breadcrumb ───────

interface BreadcrumbItem {
  name: string;
  url: string;
}

export function BreadcrumbStructuredData({ locale, items }: { locale: string; items: BreadcrumbItem[] }) {
  return <JsonLd data={generateBreadcrumbJsonLd(locale, items)} />;
}

// ─────── Product ───────

interface ProductStructuredDataProps {
  id: string;
  name: string;
  brand: string;
  category: string;
  year: number;
  description: string;
  priceCny: number;
  condition: string;
  location: string;
  workingHours?: number;
  imageUrl: string;
  locale: string;
}

export function ProductStructuredData(props: ProductStructuredDataProps) {
  return <JsonLd data={generateProductJsonLd(props)} />;
}

// ─────── ItemList ───────

interface ListItemData {
  id: string;
  name: string;
  url: string;
  imageUrl?: string;
  priceCny?: number;
  brand?: string;
}

export function ItemListStructuredData({
  locale,
  items,
  listName,
}: {
  locale: string;
  items: ListItemData[];
  listName?: string;
}) {
  if (items.length === 0) return null;
  return <JsonLd data={generateItemListJsonLd(locale, items, listName)} />;
}

// ─────── Article ───────

interface ArticleData {
  title: string;
  description: string;
  url: string;
  datePublished: string;
  dateModified?: string;
  imageUrl?: string;
  author?: string;
  keywords?: string[];
}

export function ArticleStructuredData(props: ArticleData) {
  return <JsonLd data={generateArticleJsonLd(props)} />;
}

// ─────── FAQ ───────

interface FaqData {
  question: string;
  answer: string;
}

export function FaqStructuredData({ faqs }: { faqs: FaqData[] }) {
  return <JsonLd data={generateFaqJsonLd(faqs)} />;
}

// ─────── LocalBusiness ───────

export function LocalBusinessStructuredData({ locale }: { locale: string }) {
  return <JsonLd data={generateLocalBusinessJsonLd(locale)} />;
}

// ─────── HowTo ───────

interface HowToStepData {
  name: string;
  text: string;
  image?: string;
}

export function HowToStructuredData({
  name,
  description,
  steps,
}: {
  name: string;
  description: string;
  steps: HowToStepData[];
}) {
  return <JsonLd data={generateHowToJsonLd(name, description, steps)} />;
}

// ─────── Course (engineer certification) ───────

interface CourseModuleData {
  name: string;
  description: string;
}

export function CourseStructuredData({
  locale,
  courseName,
  courseDescription,
  modules,
}: {
  locale: string;
  courseName: string;
  courseDescription: string;
  modules: CourseModuleData[];
}) {
  return <JsonLd data={generateCourseJsonLd(locale, courseName, courseDescription, modules)} />;
}
