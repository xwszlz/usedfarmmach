"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { MessageCircle, X, Send, Bot, User, ChevronRight, Loader2, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { ProductCardList, type ProductCardData } from "./product-card";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  intent?: string;
  suggestedProducts?: ProductCardData[];
  createdAt?: string;
  // 打字机效果
  isTyping?: boolean;
  displayedContent?: string;
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

const LABELS: Record<string, { title: string; placeholder: string; send: string; loading: string; error: string; voiceInput: string; voiceOutput: string }> = {
  zh: { title: "AI 客服", placeholder: "询问价格、物流、技术参数...", send: "发送", loading: "思考中...", error: "服务暂时不可用", voiceInput: "语音输入", voiceOutput: "语音播报" },
  en: { title: "AI Assistant", placeholder: "Ask about price, shipping, specs...", send: "Send", loading: "Thinking...", error: "Service unavailable", voiceInput: "Voice input", voiceOutput: "Voice output" },
  ru: { title: "AI Помощник", placeholder: "Спросите о цене, доставке, характеристиках...", send: "Отправить", loading: "Думаю...", error: "Сервис недоступен", voiceInput: "Голосовой ввод", voiceOutput: "Голосовой вывод" },
  es: { title: "Asistente AI", placeholder: "Pregunte sobre precio, envío, especificaciones...", send: "Enviar", loading: "Pensando...", error: "Servicio no disponible", voiceInput: "Entrada de voz", voiceOutput: "Salida de voz" },
  pt: { title: "Assistente AI", placeholder: "Pergunte sobre preço, envio, especificações...", send: "Enviar", loading: "Pensando...", error: "Serviço indisponível", voiceInput: "Entrada de voz", voiceOutput: "Saída de voz" },
  ar: { title: "مساعد الذكاء الاصطناعي", placeholder: "اسأل عن السعر والشحن والمواصفات...", send: "إرسال", loading: "أفكر...", error: "الخدمة غير متوفرة", voiceInput: "المدخل الصوتي", voiceOutput: "المخرج الصوتي" },
  fr: { title: "Assistant IA", placeholder: "Demandez le prix, l'expédition, les spécifications...", send: "Envoyer", loading: "Réflexion...", error: "Service indisponible", voiceInput: "Entrée vocale", voiceOutput: "Sortie vocale" },
  hi: { title: "AI सहायक", placeholder: "मूल्य, शिपिंग, विनिर्देशों के बारे में पूछें...", send: "भेजें", loading: "सोच रहा हूँ...", error: "सेवा उपलब्ध नहीं", voiceInput: "वॉयस इनपुट", voiceOutput: "वॉयस आउटपुट" },
};

export function FloatingChat({ locale = "en", productId, visitorId }: FloatingChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        locale === "zh"
          ? "你好！我是神雕农机的 AI 助手。我可以帮你查价格、比产品、问物流，也可以随时转人工。支持语音对话！"
          : locale === "ru"
            ? "Здравствуйте! Я AI-ассистент UsedFarmMach. Помогу с ценами, сравнением, логистикой — или соединю с менеджером. Поддерживаю голосовой ввод!"
            : "Hello! I'm the AI assistant from UsedFarmMach. I can help with prices, product comparison, shipping — or connect you to a human agent. Voice input supported!",
      isTyping: false,
      displayedContent: "",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [vid, setVid] = useState<string>(visitorId || "");
  // 语音相关状态
  const [isListening, setIsListening] = useState(false);
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>("default");
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeouts = useRef<ReturnType<typeof setTimeout>[]>([]);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const t = LABELS[locale] || LABELS.en;

  // 初始化语音合成
  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      synthRef.current = window.speechSynthesis;
    }
  }, []);

  // 请求通知权限
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotifPermission(Notification.permission);
      if (Notification.permission === "default") {
        Notification.requestPermission().then((perm) => setNotifPermission(perm));
      }
    }
  }, []);

  // 打字机效果：逐字显示
  const startTypewriter = useCallback((msgId: string, fullContent: string) => {
    // 清除该消息的旧定时器
    typingTimeouts.current.forEach(clearTimeout);
    typingTimeouts.current = [];

    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId ? { ...m, isTyping: true, displayedContent: "" } : m
      )
    );

    const chars = fullContent.split("");
    let idx = 0;
    const interval = setInterval(() => {
      idx++;
      if (idx > chars.length) {
        clearInterval(interval);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId ? { ...m, isTyping: false, displayedContent: fullContent } : m
          )
        );
        // 打字结束后语音播报（如果启用）
        if (voiceOutputEnabled && synthRef.current) {
          const utter = new SpeechSynthesisUtterance(fullContent.replace(/[*#\[\]]/g, ""));
          utter.lang = locale === "zh" ? "zh-CN" : locale === "en" ? "en-US" : locale === "ru" ? "ru-RU" : "en-US";
          utter.rate = 1.0;
          synthRef.current.speak(utter);
        }
        return;
      }
      const currentText = fullContent.slice(0, idx);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId ? { ...m, displayedContent: currentText } : m
        )
      );
    }, 30); // 每30ms显示一个字符

    typingTimeouts.current.push(interval as any);
  }, [voiceOutputEnabled, locale]);

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

  // 加载已有会话历史（按 productId 过滤，避免跨产品上下文污染）
  useEffect(() => {
    if (!isOpen || !vid) return;
    (async () => {
      try {
        // 传入 productId，确保只加载当前产品的会话
        const url = productId
          ? `/api/agents/buyer-chat?visitorId=${vid}&productId=${productId}`
          : `/api/agents/buyer-chat?visitorId=${vid}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.success && data.sessions && data.sessions.length > 0) {
          const latest = data.sessions[0];
          setSessionId(latest.id);
          const hist = await fetch(`/api/agents/buyer-chat?sessionId=${latest.id}`).then((r) => r.json());
          if (hist.success && hist.history) {
            setMessages(
              hist.history.map((m: any) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                intent: m.intent,
                isTyping: false,
                displayedContent: m.content,
              }))
            );
          }
        }
      } catch (e) {
        console.error("[FloatingChat] load history failed", e);
      }
    })();
  }, [isOpen, vid, productId]);

  // 显示浏览器通知
  const showNotification = useCallback((title: string, body: string) => {
    if (notifPermission === "granted" && typeof window !== "undefined" && !isOpen) {
      try {
        const notif = new Notification(title, {
          body,
          icon: "/logo.jpg",
          tag: "ufm-chat",
        });
        notif.onclick = () => {
          window.focus();
          setIsOpen(true);
        };
      } catch (e) {
        // 通知失败静默忽略
      }
    }
  }, [notifPermission, isOpen]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || loading || !vid) return;
    const userMsg: ChatMessage = { id: "u-" + Date.now(), role: "user", content: input.trim(), isTyping: false, displayedContent: input.trim() };
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
        const assistantMsgId = "a-" + Date.now();
        const newMsg: ChatMessage = {
          id: assistantMsgId,
          role: "assistant",
          content: m.content,
          intent: m.intent,
          suggestedProducts: m.suggestedProducts || undefined,
          isTyping: true,
          displayedContent: "",
        };
        setMessages((prev) => [...prev, newMsg]);
        // 启动打字机效果
        setTimeout(() => startTypewriter(assistantMsgId, m.content), 100);
        // 显示通知
        showNotification(t.title, m.content.slice(0, 100) + (m.content.length > 100 ? "..." : ""));
      } else {
        throw new Error(data.error || "Unknown error");
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { id: "err-" + Date.now(), role: "assistant", content: t.error, isTyping: false, displayedContent: t.error },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, vid, sessionId, productId, locale, t, startTypewriter, showNotification]);

  // 语音输入（Web Speech API）
  const toggleVoiceInput = useCallback(() => {
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      alert(locale === "zh" ? "您的浏览器不支持语音输入，请使用 Chrome/Edge。" : "Your browser does not support voice input. Please use Chrome/Edge.");
      return;
    }
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const Recognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recog = new Recognition();
    recog.lang = locale === "zh" ? "zh-CN" : locale === "en" ? "en-US" : locale === "ru" ? "ru-RU" : "en-US";
    recog.continuous = false;
    recog.interimResults = false;
    recog.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setInput(transcript);
      setIsListening(false);
    };
    recog.onerror = () => setIsListening(false);
    recog.onend = () => setIsListening(false);
    recognitionRef.current = recog;
    recog.start();
    setIsListening(true);
  }, [isListening, locale]);

  // 语音播报切换
  const toggleVoiceOutput = useCallback(() => {
    if (voiceOutputEnabled && synthRef.current) {
      synthRef.current.cancel();
    }
    setVoiceOutputEnabled((prev) => !prev);
  }, [voiceOutputEnabled]);

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
  }, [messages]);

  // 组件卸载时清除定时器
  useEffect(() => {
    return () => {
      typingTimeouts.current.forEach(clearTimeout);
    };
  }, []);

  // 点击产品卡片 → 新窗口打开详情页
  const handleProductClick = (productId: string) => {
    const url = `/${locale}/products/${productId}`;
    if (typeof window !== "undefined") window.open(url, "_blank");
  };

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
            <div className="flex items-center gap-1">
              {/* 语音播报按钮 */}
              <button
                onClick={toggleVoiceOutput}
                title={t.voiceOutput}
                className={`rounded-full p-1 text-white/80 hover:bg-white/20 ${voiceOutputEnabled ? "bg-white/20" : ""}`}
              >
                {voiceOutputEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </button>
              <button onClick={() => setIsOpen(false)} className="rounded-full p-1 text-white/80 hover:bg-white/20">
                <X className="h-5 w-5" />
              </button>
            </div>
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
                  <p className="whitespace-pre-wrap">{msg.isTyping ? (msg.displayedContent || "") : (msg.displayedContent || msg.content)}</p>
                  {/* 打字中指示器 */}
                  {msg.isTyping && (!msg.displayedContent) && (
                    <span className="inline-block animate-pulse text-gray-400">▌</span>
                  )}
                  {/* 产品卡片渲染 */}
                  {msg.role === "assistant" && !msg.isTyping && msg.suggestedProducts && msg.suggestedProducts.length > 0 && (
                    <ProductCardList
                      products={msg.suggestedProducts}
                      locale={locale}
                      onProductClick={handleProductClick}
                    />
                  )}
                </div>
              </div>
            ))}
            {loading && !messages.some(m => m.isTyping) && (
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
              {/* 语音输入按钮 */}
              <button
                onClick={toggleVoiceInput}
                title={t.voiceInput}
                className={`rounded-full p-1.5 ${
                  isListening ? "bg-red-500 text-white animate-pulse" : "text-gray-500 hover:bg-gray-200"
                }`}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="rounded-full bg-primary-600 p-1.5 text-white hover:bg-primary-700 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-center text-[10px] text-gray-400">
              {locale === "zh" ? "AI 生成内容，关键决策请转人工确认。支持语音输入🎤" : "AI-generated. Verify key decisions with a human agent. Voice input supported 🎤"}
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
