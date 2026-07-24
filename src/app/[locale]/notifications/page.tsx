"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Bell, CheckCheck, Loader2 } from "lucide-react";

interface Notif {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const locale = useLocale();
  const t = useTranslations("common");
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { credentials: "include" });
      const json = await res.json();
      if (json.success) setItems(json.data);
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markAll = async () => {
    await fetch("/api/notifications", { method: "POST", credentials: "include" });
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
  };

  const markOne = async (id: string) => {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id }),
    });
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, read: true } : i)));
  };

  const unread = items.filter((i) => !i.read).length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {locale === "zh" ? "我的通知" : "My Notifications"}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {locale === "zh" ? `共 ${items.length} 条，未读 ${unread} 条` : `${items.length} total, ${unread} unread`}
          </p>
        </div>
        {unread > 0 && (
          <button
            onClick={markAll}
            className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200"
          >
            <CheckCheck className="h-4 w-4" />
            {locale === "zh" ? "全部已读" : "Mark all read"}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-12 text-center dark:border-gray-700">
          <Bell className="mx-auto mb-3 h-12 w-12 text-gray-300" />
          <p className="text-gray-400">{locale === "zh" ? "暂无通知" : "No notifications yet"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((n) => (
            <div
              key={n.id}
              className={`rounded-xl border p-4 transition-colors ${
                n.read
                  ? "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
                  : "border-blue-200 bg-blue-50/60 dark:border-blue-800 dark:bg-blue-950/30"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {!n.read && <span className="h-2 w-2 rounded-full bg-blue-500" />}
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{n.title}</h3>
                  </div>
                  {n.body && <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{n.body}</p>}
                  <p className="mt-2 text-xs text-gray-400">
                    {new Date(n.createdAt).toLocaleString(locale === "zh" ? "zh-CN" : "en-US")}
                  </p>
                </div>
                {!n.read && (
                  <button
                    onClick={() => markOne(n.id)}
                    className="shrink-0 text-xs text-primary-600 hover:text-primary-700"
                  >
                    {locale === "zh" ? "标为已读" : "Mark read"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
