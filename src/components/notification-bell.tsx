"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";

interface Notif {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export function NotificationBell({ locale }: { locale: string }) {
  const router = useRouter();
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { credentials: "include" });
      const json = await res.json();
      if (json.success) {
        setItems(json.data);
        setUnread(json.unreadCount);
      }
    } catch {
      /* noop */
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const markAllRead = async () => {
    await fetch("/api/notifications", { method: "POST", credentials: "include" });
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    setUnread(0);
  };

  const openItem = async (n: Notif) => {
    setOpen(false);
    if (!n.read) {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: n.id }),
      });
      setUnread((u) => Math.max(0, u - 1));
    }
    if (n.link) router.push(`/${locale}${n.link}`);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
        aria-label="通知"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
              <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                {locale === "zh" ? "通知" : "Notifications"}
              </span>
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  {locale === "zh" ? "全部已读" : "Mark all read"}
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {!loaded ? (
                <div className="px-4 py-8 text-center text-sm text-gray-400">…</div>
              ) : items.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-400">
                  {locale === "zh" ? "暂无通知" : "No notifications"}
                </div>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => openItem(n)}
                    className={`flex w-full flex-col gap-0.5 border-b border-gray-50 px-4 py-3 text-left hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800 ${
                      n.read ? "" : "bg-blue-50/60 dark:bg-blue-950/30"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />}
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{n.title}</span>
                    </div>
                    {n.body && <p className="truncate text-xs text-gray-500">{n.body}</p>}
                    <span className="text-[11px] text-gray-400">
                      {new Date(n.createdAt).toLocaleString(locale === "zh" ? "zh-CN" : "en-US")}
                    </span>
                  </button>
                ))
              )}
            </div>
            <div className="border-t border-gray-100 px-4 py-2 dark:border-gray-800">
              <button
                onClick={() => {
                  setOpen(false);
                  router.push(`/${locale}/notifications`);
                }}
                className="w-full text-center text-xs text-primary-600 hover:text-primary-700"
              >
                {locale === "zh" ? "查看全部" : "View all"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
