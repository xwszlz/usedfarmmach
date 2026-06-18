import React, { useState, useEffect, useRef, useCallback } from "react";
import { MessageCircle, X, Send, Bot, User, ChevronRight, Loader2 } from "lucide-react";
import { ProductCardList, type ProductCardData } from "./product-card";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  intent?: string;
  suggestedProducts?: ProductCardData[];
  createdAt?: string;
}

interface ChatAction {
  type: string;
  productId?: string;
  productIds?: string[];
  phone?: string;
  email?: string;
  reason?: string;
  link?: string;
}

interface FloatingChatProps {
  locale?: "zh" | "en" | "ru" | "es" | "pt" | "ar" | "fr" | "hi";
  productId?: string;
  visitorId?: string;
}

const LABELS: Record<string, { title: string; placeholder: string; send: string; loading: string; error: string }> = {
  zh: { title: "AI 客服", placeholder: "询问价格、物流、技术参数...", send: "发送", loading: "思考中...", error: "服务暂时不可用" },
  en: { title: "AI Assistant", placeholder: "Ask about price, shipping, specs...", send: "Send", loading: "Thinking...", error: "Service unavailable" },
  ru: { title: "AI Помощник", placeholder: "Спросите о цене, доставке, характеристиках...", send: "Отправить", loading: "Думаю...", error: "Сервис недоступен" },
  es: { title: "Asistente AI", placeholder: "Pregunte sobre precio, envío, especificaciones...", send: "Enviar", loading: "Pensando...", error: "Servicio no disponible" },
  pt: { title: "Assistente AI", placeholder: "Pergunte sobre preço, envio, especificações...", send: "Enviar", loading: "Pensando...", error: "Serviço indisponível" },
  ar: { title: "مساعد الذكاء الاصطناعي", placeholder: "اسأل عن السعر والشحن والمواصفات...", send: "إرسال", loading: "أفكر...", error: "الخدمة غير متوفرة" },
  fr: { title: "Assistant IA", placeholder: "Demandez le prix, l'expédition, les spécifications...", send: "Envoyer", loading: "Réflexion...", error: "Service indisponible" },
  hi: { title: "AI सहायक", placeholder: "मूल्य, शipping, विनिर्देशों के बारे में पूछें...", send: "भेजें", loading: "सोच रहा हूँ...", error: "सेवा उपलब्ध नहीं" },
};

export function FloatingChat({ locale = "en", productId, visitorId }: FloatingChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        locale === "zh"
          ? "你好！我是神雕农机的 AI 助手。我可以帮你查价格、比产品、问物流，也可以随时转人工。"
          : locale === "ru"
            ? "Здравствуйте! Я AI-ассистент UsedFarmMach. Помогу с ценами, сравнением, логистикой — или соединю с менеджером."
            : "Hello! I'm the AI assistant from UsedFarmMach. I can help with prices, product comparison, shipping — or connect you to a human agent.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [vid, setVid] = useState<string>(visitorId || "");
  const bottomRef = useRef<HTMLDivElement>(null);
  const t = LABELS[locale] || LABELS.en;

  // 生成访客ID
  useEffect(() => {
    if (!vid) {
      const stored = typeof window !== "undefined" ? localStorage.getItem("ufm_visitor_id") : null;
      if (stored) {
        setVid(stored);
      } else {
        const newId = "v-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
        setVid(newId);
        if (typeof window !== "undefined") localStorage.setItem("ufm_visitor_id", newId);
      }
    }
  }, [vid]);

  // 加载已有会话历史
  useEffect(() => {
    if (!isOpen || !vid) return;
    (async () => {
      try {
        const res = await fetch(`/api/agents/buyer-chat?visitorId=${vid}`);
        const data = await res.json();
        if (data.success && data.sessions && data.sessions.length > 0) {
          const latest = data.sessions[0];
          setSessionId(latest.id);
          const hist = await fetch(`/api/agents/buyer-chat?sessionId=${latest.id}`).then((r) => r.json());
          if (hist.success && hist.history) {
            setMessages(hist.history.map((m: any) => ({ id: m.id, role: m.role, content: m.content, intent: m.intent })));
          }
        }
      } catch (e) {
        console.error("[FloatingChat] load history failed", e);
      }
    })();
  }, [isOpen, vid]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || loading || !vid) return;
    const userMsg: ChatMessage = { id: "u-" + Date.now(), role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/agents/buyer-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          visitorId: vid,
          productId,
          locale,
          content: userMsg.content,
        }),
      });
      const data = await res.json();
      if (data.success && data.message) {
        const m = data.message;
        setSessionId(m.sessionId);
        setMessages((prev) => [
          ...prev,
          {
            id: "a-" + Date.now(),
            role: "assistant",
            content: m.content,
            intent: m.intent,
            suggestedProducts: m.suggestedProducts || undefined,
          },
        ]);
      } else {
        throw new Error(data.error || "Unknown error");
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { id: "err-" + Date.now(), role: "assistant", content: t.error },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, vid, sessionId, productId, locale, t.error]);

  // 回车发送
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // 自动滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  
  // 点击产品卡片 → 新窗口打开详情页
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end">
      {/* 聊天窗口 */}
      {isOpen && (
        <div className="mb-3 flex h-[520px] w-[360px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between bg-primary-600 px-4 py-3">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-white" />
              <span className="font-semibold text-white">{t.title}</span>
              <span className="ml-2 rounded-full bg-green-400 px-2 py-0.5 text-[10px] font-medium text-white">
                online
              </span>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`mb-3 flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-primary-600 text-white"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  <div className="mb-1 flex items-center gap-1">
                    {msg.role === "assistant" ? (
                      <Bot className="h-3.5 w-3.5 text-gray-500" />
                    ) : (
                      <User className="h-3.5 w-3.5 text-white/80" />
                    )}
                    <span className="text-[10px] opacity-60">
                      {msg.role === "assistant" ? "AI" : "You"}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {/* 产品卡片渲染 */}
                  {msg.role === "assistant" && msg.suggestedProducts && msg.suggestedProducts.length > 0 && (
                    <ProductCardList
                      products={msg.suggestedProducts}
                      locale={locale}
                      onProductClick={(productId) => {
                        // 点击卡片 → 跳转到产品详情页
                        const url = `/${locale}/products/${productId}`;
                        if (typeof window !== "undefined") window.open(url, "_blank");
                      }}
                    />
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="mb-3 flex justify-start">
                <div className="max-w-[85%] rounded-2xl bg-gray-100 px-3 py-2 text-sm text-gray-500">
                  <Loader2 className="inline h-4 w-4 animate-spin" />
                  <span className="ml-1">{t.loading}</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-100 px-3 py-2">
            <div className="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t.placeholder}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
                disabled={loading}
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="rounded-full bg-primary-600 p-1.5 text-white hover:bg-primary-700 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-center text-[10px] text-gray-400">
              {locale === "zh" ? "AI 生成内容，关键决策请转人工确认" : "AI-generated. Verify key decisions with a human agent."}
            </p>
          </div>
        </div>
      )}

      {/* 浮动按钮 */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg hover:bg-primary-700 transition-transform hover:scale-105"
        >
          <MessageCircle className="h-7 w-7" />
        </button>
      )}
    </div>
  );
}
