"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Send, CheckCircle } from "lucide-react";

interface InquiryFormProps {
  productId: string;
}

export function InquiryForm({ productId }: InquiryFormProps) {
  const t = useTranslations("inquiry");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = e.currentTarget;
    const data = {
      productId,
      name: (form.elements.namedItem("name") as HTMLInputElement).value,
      email: (form.elements.namedItem("email") as HTMLInputElement).value,
      phone: (form.elements.namedItem("phone") as HTMLInputElement).value || undefined,
      company: (form.elements.namedItem("company") as HTMLInputElement).value || undefined,
      message: (form.elements.namedItem("message") as HTMLInputElement).value || undefined,
    };

    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();

      if (result.success) {
        setSuccess(true);
      } else {
        setError(result.error || t("error"));
      }
    } catch {
      setError(t("error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="w-full"
        size="lg"
      >
        <Send className="mr-2 h-4 w-4" />
        {t("submit")}
      </Button>

      <Dialog open={open} onClose={() => { setOpen(false); setSuccess(false); setError(""); }} title={t("title")}>
        {success ? (
          <div className="py-8 text-center">
            <CheckCircle className="mx-auto mb-3 h-12 w-12 text-green-500" />
            <p className="text-lg font-medium text-gray-900">{t("success")}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-gray-500">{t("subtitle")}</p>
            <Input
              id="inquiry-name"
              name="name"
              label={t("name")}
              placeholder={t("namePlaceholder")}
              required
            />
            <Input
              id="inquiry-email"
              name="email"
              label={t("email")}
              type="email"
              placeholder={t("emailPlaceholder")}
              required
            />
            <Input
              id="inquiry-phone"
              name="phone"
              label={t("phone")}
              placeholder={t("phonePlaceholder")}
            />
            <Input
              id="inquiry-company"
              name="company"
              label={t("company")}
              placeholder={t("companyPlaceholder")}
            />
            <div className="w-full">
              <label htmlFor="inquiry-message" className="mb-1.5 block text-sm font-medium text-gray-700">
                {t("message")}
              </label>
              <textarea
                id="inquiry-message"
                name="message"
                rows={3}
                placeholder={t("messagePlaceholder")}
                className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "..." : t("submit")}
            </Button>
          </form>
        )}
      </Dialog>
    </>
  );
}
