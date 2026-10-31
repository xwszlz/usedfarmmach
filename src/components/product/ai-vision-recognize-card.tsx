"use client";

/**
 * 产品详情页「AI 设备中心」第 1 个能力模块：AI 视觉识别（AI Vision Recognition）。
 *
 * 业务动机（老板原话）：卖家发布产品时不专业，型号/功率/尺寸经常填错或空着；
 * 用专业的 AI 视觉识别把参数「规范化」，是后续深度分析 / 智能估值 / 销售策略
 * 三个模块准确的前置基础，所以本模块排在四个入口的第一位。
 *
 * 交互范式（与兄弟卡片保持一致）：
 *   idle（说明 + 开始按钮）→ running（转圈）→ done（结果表 + 逐字段回填勾选）
 *                                      ↘ error（登录 / 降级 / 超时 / 通用错误）
 *
 * 计费：调用豆包（火山方舟 ARK）多模态模型，按真实 token 扣积分，所以**不自动跑**，
 *       必须由用户点按钮触发，且说明里明确写出「按量消耗积分」。
 *
 * 视频能力（2026-11 更新）：后端 `buildDoubaoContent` 走 `@/lib/ai/multimodal` 共享实现，
 * 把 `videoUrls` 作为真实 `{ type: "video_url" }` 内容块送入豆包（该模型原生支持视频画面识别），
 * 模型**能看到视频画面**，不再是把 URL 当一段文本。
 *   1. UI 文案因此改为「视频会一并作为画面参考送入模型」，不得再写「AI 暂不解析视频画面」；
 *   2. `videoUrls` 由本卡片原样透传（见请求体），前端无需额外处理；
 *   3. 视频**不能替代图片**：`imageCount === 0` 时后端直接 400（NO_IMAGES），按钮保持禁用。
 *
 * 安全边界：本文件是 `"use client"`，**绝不能** import 任何链到 `node:*` 内置模块的
 *          代码（否则 next build 会把 Node 模块打进客户端 bundle，Vercel 构建失败）。
 *          仅依赖 react / next-navigation / lucide-react / 纯函数模块。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ScanEye,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  LogIn,
  RefreshCw,
  Sparkles,
  Wand2,
} from "lucide-react";
import {
  buildApplyPayload,
  buildFieldDiff,
  formatFieldValue,
  type ApplyableFieldKey,
  type CurrentProduct,
  type FieldDiff,
  type RecognizedData,
} from "@/lib/product/recognize-apply";

interface AiVisionRecognizeCardProps {
  productId: string;
  productName?: string;
  imageUrls?: string[];
  videoUrls?: string[];
  locale?: string;
  isChineseBrand?: boolean;
}

/** 卡片阶段机。 */
type Phase = "idle" | "running" | "done" | "error";

/** 错误分类，决定 UI 用哪套文案与是否给登录/重试按钮。 */
type ErrorKind = "login" | "fallback" | "timeout" | "no_images" | "generic";

interface ErrorState {
  kind: ErrorKind;
  message: string;
  /** 503 MANUAL_FALLBACK 的 debug 摘要（已截断），无则不显示 */
  debug: string | null;
  retryable: boolean;
}

/**
 * 客户端侧总超时：后端 `maxDuration = 90`（Vercel），.cn 侧 nginx proxy_read_timeout 已放宽到
 * 330s。取 180s 作为一个「明显异常」的兜底，避免请求永远挂着转圈。
 */
const CLIENT_TIMEOUT_MS = 180_000;

/** debug 数组摘要截断长度（避免把后端堆栈整段糊在页面上）。 */
const DEBUG_PREVIEW_MAX = 200;

/** 把 data URI 与 http(s) URL 分流（后端分别吃 imageDataUris / imageUrls）。 */
function splitImages(images: string[]): { imageUrls: string[]; imageDataUris: string[] } {
  const imageUrls: string[] = [];
  const imageDataUris: string[] = [];
  for (const raw of images) {
    if (typeof raw !== "string") continue;
    const url = raw.trim();
    if (url === "") continue;
    if (url.startsWith("data:")) {
      imageDataUris.push(url);
    } else {
      imageUrls.push(url);
    }
  }
  return { imageUrls, imageDataUris };
}

/** 截断 debug 摘要。 */
function summarizeDebug(debug: unknown): string | null {
  if (!Array.isArray(debug) || debug.length === 0) return null;
  const text = debug
    .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
    .filter((item) => item && item.trim() !== "")
    .join(" | ");
  if (text === "") return null;
  return text.length > DEBUG_PREVIEW_MAX ? `${text.slice(0, DEBUG_PREVIEW_MAX)}…` : text;
}

/** 安全读 json（后端 5xx 时可能返回 HTML 错误页，不能直接 res.json() 崩掉）。 */
async function readJsonSafe(response: Response): Promise<Record<string, any>> {
  try {
    const parsed = await response.json();
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * AI 视觉识别卡片。
 *
 * 行为要点：
 *   1. 默认不跑（计费接口，用户点按钮才触发）；
 *   2. 成功后才去 `GET /api/seller/products/[id]` 判归属 → 200 才出现回填勾选 UI；
 *   3. 回填走 `PUT /api/seller/products/[id]`，本次只传勾选的字段，空值不传。
 */
export default function AiVisionRecognizeCard({
  productId,
  productName,
  imageUrls = [],
  videoUrls = [],
  locale = "zh",
  isChineseBrand,
}: AiVisionRecognizeCardProps) {
  const zh = locale === "zh";
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<ErrorState | null>(null);
  const [loginUrl, setLoginUrl] = useState<string | null>(null);
  const [recognized, setRecognized] = useState<RecognizedData | null>(null);

  /** 归属判定结果：null = 尚未判定（不显示回填 UI），true = 可回填，false = 只展示。 */
  const [canApply, setCanApply] = useState<boolean | null>(null);
  /** 只展示时给用户的一句解释（403 = 他人产品；401 = 未登录）。 */
  const [applyNote, setApplyNote] = useState<string | null>(null);
  const [diffs, setDiffs] = useState<FieldDiff[]>([]);
  const [permissionLoading, setPermissionLoading] = useState(false);

  const [selectedKeys, setSelectedKeys] = useState<ApplyableFieldKey[]>([]);
  const [applying, setApplying] = useState(false);
  const [applyMessage, setApplyMessage] = useState<string | null>(null);
  const [applyFailed, setApplyFailed] = useState(false);

  /** 卸载后不再 setState，避免 React 警告与内存泄漏。 */
  const mountedRef = useRef(true);
  /** 防重复点击（按钮 disabled 之外的第二道闸）。 */
  const runningRef = useRef(false);
  /** 防止上一次的异步归属判定回写覆盖新一次识别的结果。 */
  const runIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const imageCount = Array.isArray(imageUrls) ? imageUrls.filter(Boolean).length : 0;
  const videoCount = Array.isArray(videoUrls) ? videoUrls.filter(Boolean).length : 0;

  /** 有变化的字段（只有这些能被勾选）。 */
  const changedDiffs = useMemo(() => diffs.filter((diff) => diff.changed), [diffs]);

  /**
   * 拉取当前产品并计算逐字段差异。仅在识别成功后调用（避免无谓请求）。
   * 200 → 本人或管理员，可回填；401 / 403 → 不显示任何回填 UI。
   */
  const loadPermissionAndDiff = useCallback(
    async (data: RecognizedData, runId: number) => {
      setPermissionLoading(true);
      try {
        const response = await fetch(`/api/seller/products/${encodeURIComponent(productId)}`, {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
        });

        if (!mountedRef.current || runId !== runIdRef.current) return;

        if (response.status === 200) {
          const json = await readJsonSafe(response);
          if (!mountedRef.current || runId !== runIdRef.current) return;
          const current = (json?.data ?? null) as CurrentProduct | null;
          const nextDiffs = buildFieldDiff(current, data);
          setCanApply(true);
          setApplyNote(null);
          setDiffs(nextDiffs);
          // 有变化的默认勾选，未变的置灰不可勾
          setSelectedKeys(nextDiffs.filter((diff) => diff.changed).map((diff) => diff.key));
          return;
        }

        setCanApply(false);
        setDiffs([]);
        setSelectedKeys([]);
        setApplyNote(
          response.status === 401
            ? zh
              ? "登录后可将识别结果回填到本人发布的产品"
              : "Log in to apply the result to your own listing."
            : zh
              ? "这是他人发布的产品，仅展示识别结果"
              : "This listing belongs to another seller — results are read-only."
        );
      } catch {
        if (!mountedRef.current || runId !== runIdRef.current) return;
        // 归属判定失败不该遮住识别结果，按「只展示」处理最安全（不误写他人产品）
        setCanApply(false);
        setDiffs([]);
        setSelectedKeys([]);
        setApplyNote(
          zh
            ? "无法确认产品归属，本次仅展示识别结果"
            : "Could not verify ownership — results are read-only."
        );
      } finally {
        if (mountedRef.current && runId === runIdRef.current) setPermissionLoading(false);
      }
    },
    [productId, zh]
  );

  /** 点击「开始 AI 视觉识别」。 */
  const startRecognize = useCallback(async () => {
    if (runningRef.current) return;

    const { imageUrls: httpImages, imageDataUris } = splitImages(
      Array.isArray(imageUrls) ? imageUrls : []
    );

    if (httpImages.length + imageDataUris.length === 0) {
      setPhase("error");
      setError({
        kind: "no_images",
        message: zh
          ? "这个产品还没有上传图片，无法做视觉识别。请先在编辑页补充实机照片。"
          : "This listing has no photos yet — add real machine photos in the edit page first.",
        debug: null,
        retryable: false,
      });
      return;
    }

    runningRef.current = true;
    runIdRef.current += 1;
    const runId = runIdRef.current;

    setPhase("running");
    setError(null);
    setLoginUrl(null);
    setRecognized(null);
    setCanApply(null);
    setApplyNote(null);
    setDiffs([]);
    setSelectedKeys([]);
    setApplyMessage(null);
    setApplyFailed(false);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

    try {
      const response = await fetch("/api/agents/seller-helper/recognize", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          imageUrls: httpImages,
          imageDataUris,
          videoUrls: (Array.isArray(videoUrls) ? videoUrls : []).filter(Boolean),
          isChineseBrand: isChineseBrand === true,
        }),
      });

      const json = await readJsonSafe(response);
      if (!mountedRef.current || runId !== runIdRef.current) return;

      // ── 未登录：后端返回 401 + code=LOGIN_REQUIRED + loginUrl ──
      if (response.status === 401 || json?.code === "LOGIN_REQUIRED") {
        setPhase("error");
        setError({
          kind: "login",
          message: zh ? "请先登录后再使用 AI 视觉识别" : "Please log in to use AI Vision Recognition.",
          debug: null,
          retryable: false,
        });
        setLoginUrl(
          typeof json?.loginUrl === "string" && json.loginUrl !== ""
            ? json.loginUrl
            : `/${locale}/auth/login`
        );
        return;
      }

      // ── 识别全失败：503 + code=MANUAL_FALLBACK + debug[] ──
      if (json?.code === "MANUAL_FALLBACK") {
        setPhase("error");
        setError({
          kind: "fallback",
          message:
            typeof json?.error === "string" && json.error !== ""
              ? json.error
              : zh
                ? "AI 识别服务暂时不可用，可直接手工填写产品参数。"
                : "AI recognition is temporarily unavailable. You can fill in the specs manually.",
          debug: summarizeDebug(json?.debug),
          retryable: json?.retryable !== false,
        });
        return;
      }

      // ── 请求体被拒（如无图片）：400 NO_IMAGES ──
      if (response.status === 400) {
        setPhase("error");
        setError({
          kind: "no_images",
          message:
            typeof json?.error === "string" && json.error !== ""
              ? json.error
              : zh
                ? "需要至少一张图片才能识别。"
                : "At least one photo is required.",
          debug: null,
          retryable: false,
        });
        return;
      }

      // ── 网关超时 / 后端 5xx（.com Vercel 90s、.cn nginx 330s）──
      if (response.status === 504 || response.status === 502 || response.status === 408) {
        setPhase("error");
        setError({
          kind: "timeout",
          message: zh
            ? "识别超时。内容较多时可稍后重试。"
            : "Recognition timed out. Please retry later with fewer photos.",
          debug: null,
          retryable: true,
        });
        return;
      }

      if (!response.ok || json?.success !== true || !json?.data) {
        setPhase("error");
        setError({
          kind: "generic",
          message:
            typeof json?.error === "string" && json.error !== ""
              ? json.error
              : zh
                ? `识别失败（HTTP ${response.status}），请稍后重试。`
                : `Recognition failed (HTTP ${response.status}). Please retry.`,
          debug: summarizeDebug(json?.debug),
          retryable: true,
        });
        return;
      }

      // ── 成功 ──
      const data = json.data as RecognizedData;
      setRecognized(data);
      setPhase("done");
      // 成功后才去判归属 + 算差异
      await loadPermissionAndDiff(data, runId);
    } catch (err: any) {
      if (!mountedRef.current || runId !== runIdRef.current) return;
      const aborted = err?.name === "AbortError";
      setPhase("error");
      setError({
        kind: "timeout",
        message: aborted
          ? zh
            ? "识别超时。内容较多时可稍后重试。"
            : "Recognition timed out. Please retry later with fewer photos."
          : zh
            ? "网络异常，未能完成识别。请检查网络后重试。"
            : "Network error — recognition did not complete. Please check your connection and retry.",
        debug: null,
        retryable: true,
      });
    } finally {
      clearTimeout(timer);
      runningRef.current = false;
      if (mountedRef.current && runId === runIdRef.current) {
        setPhase((prev) => (prev === "running" ? "idle" : prev));
      }
    }
  }, [imageUrls, videoUrls, isChineseBrand, locale, zh, loadPermissionAndDiff]);

  /** 勾选/取消勾选一个字段（未变化的字段永远不可勾）。 */
  const toggleField = useCallback((key: ApplyableFieldKey) => {
    setApplyMessage(null);
    setApplyFailed(false);
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );
  }, []);

  /** 点击「应用到产品参数」。 */
  const applyToProduct = useCallback(async () => {
    if (applying) return;
    if (!recognized) return;

    const payload = buildApplyPayload(recognized, selectedKeys);
    const fieldCount = Object.keys(payload).length;
    if (fieldCount === 0) {
      setApplyFailed(false);
      setApplyMessage(zh ? "请至少勾选一项需要写入的参数。" : "Select at least one field to apply.");
      return;
    }

    setApplying(true);
    setApplyMessage(null);
    setApplyFailed(false);

    try {
      const response = await fetch(`/api/seller/products/${encodeURIComponent(productId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await readJsonSafe(response);
      if (!mountedRef.current) return;

      if (response.ok && json?.success !== false) {
        setApplyFailed(false);
        setApplyMessage(
          zh
            ? `已更新 ${fieldCount} 项，页面数据已刷新。`
            : `Updated ${fieldCount} field(s). Page data refreshed.`
        );
        setSelectedKeys([]);
        // 让服务端组件重新取数，页面上的参数立即变成新值
        router.refresh();

        // 重新拉一次现值，把刚写入的字段重算成「未变化」（勾选列表自动清空/置灰）
        if (runIdRef.current > 0) {
          const refreshed = await fetch(
            `/api/seller/products/${encodeURIComponent(productId)}`,
            { method: "GET", headers: { Accept: "application/json" }, cache: "no-store" }
          );
          if (refreshed.status === 200) {
            const refreshedJson = await readJsonSafe(refreshed);
            if (!mountedRef.current) return;
            const current = (refreshedJson?.data ?? null) as CurrentProduct | null;
            const nextDiffs = buildFieldDiff(current, recognized);
            setDiffs(nextDiffs);
            setSelectedKeys(nextDiffs.filter((diff) => diff.changed).map((diff) => diff.key));
          }
        }
        return;
      }

      // 后端错误：原文展示，不改写成自己的话
      setApplyFailed(true);
      if (response.status === 401) {
        setApplyMessage(
          typeof json?.error === "string" && json.error !== ""
            ? json.error
            : zh
              ? "请先登录"
              : "Please log in first."
        );
      } else if (response.status === 403 || response.status === 404) {
        setApplyMessage(
          typeof json?.error === "string" && json.error !== ""
            ? json.error
            : zh
              ? "无权修改该产品"
              : "You are not allowed to edit this listing."
        );
        // 归属已变（例如切换账号），收起回填 UI
        setCanApply(false);
        setDiffs([]);
        setSelectedKeys([]);
        setApplyNote(zh ? "这是他人发布的产品，仅展示识别结果" : "Read-only: another seller's listing.");
      } else {
        setApplyMessage(
          typeof json?.error === "string" && json.error !== ""
            ? json.error
            : zh
              ? `保存失败（HTTP ${response.status}）`
              : `Save failed (HTTP ${response.status}).`
        );
      }
    } catch {
      if (!mountedRef.current) return;
      setApplyFailed(true);
      setApplyMessage(
        zh ? "网络异常，参数未保存。请重试。" : "Network error — nothing was saved. Please retry."
      );
    } finally {
      if (mountedRef.current) setApplying(false);
    }
  }, [applying, recognized, selectedKeys, productId, zh, router]);

  // ── 结果表的行定义：只展示，不参与回填 ──
  const resultRows: Array<{
    labelZh: string;
    labelEn: string;
    value: string;
    /** 参考价的免责说明标记（AI 估算，仅供参考） */
    isEstimate?: boolean;
  }> = useMemo(() => {
    if (!recognized) return [];
    const dash = "—";
    const text = (value: unknown): string => {
      if (value === null || value === undefined) return dash;
      const str = String(value).trim();
      return str === "" ? dash : str;
    };
    const dimension = (() => {
      const parts = [recognized.overallLength, recognized.overallWidth, recognized.overallHeight];
      if (parts.every((part) => part === null || part === undefined || String(part).trim() === "")) {
        return dash;
      }
      return parts.map((part) => text(part)).join(" × ");
    })();
    const conditionLabel =
      recognized.condition === null || recognized.condition === undefined
        ? dash
        : formatFieldValue("condition", String(recognized.condition), locale);
    const referencePrice =
      recognized.referencePrice === null || recognized.referencePrice === undefined
        ? dash
        : (() => {
            const num = Number(recognized.referencePrice);
            return Number.isFinite(num) ? `¥ ${num.toLocaleString("en-US")}` : text(recognized.referencePrice);
          })();
    const confidence =
      typeof recognized.confidence === "number" && Number.isFinite(recognized.confidence)
        ? `${Math.round(recognized.confidence * 100)}%`
        : dash;

    return [
      { labelZh: "品牌", labelEn: "Brand", value: text(recognized.brand) },
      { labelZh: "型号", labelEn: "Model", value: text(recognized.modelName) },
      { labelZh: "年份", labelEn: "Year", value: text(recognized.year) },
      { labelZh: "发动机功率", labelEn: "Engine Power", value: text(recognized.enginePower) },
      { labelZh: "发动机类型", labelEn: "Engine Type", value: text(recognized.engineType) },
      { labelZh: "驱动方式", labelEn: "Drive System", value: text(recognized.driveSystem) },
      { labelZh: "工作时长", labelEn: "Working Hours", value: text(recognized.workingHours) },
      { labelZh: "成色", labelEn: "Condition", value: conditionLabel },
      { labelZh: "外形尺寸(长×宽×高)", labelEn: "Dimensions (L×W×H)", value: dimension },
      { labelZh: "整机重量", labelEn: "Net Weight", value: text(recognized.netWeight) },
      { labelZh: "主要配置", labelEn: "Main Config", value: text(recognized.mainConfig) },
      { labelZh: "品类", labelEn: "Category", value: text(recognized.category) },
      { labelZh: "产地", labelEn: "Location", value: text(recognized.location) },
      { labelZh: "交易港口", labelEn: "Trade Port", value: text(recognized.tradePort) },
      { labelZh: "参考价", labelEn: "Reference Price", value: referencePrice, isEstimate: true },
      { labelZh: "置信度", labelEn: "Confidence", value: confidence },
    ];
  }, [recognized, locale]);

  const running = phase === "running";

  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-4">
      {/* 卡片头部 */}
      <div className="flex items-center gap-2">
        <ScanEye className="h-4 w-4 shrink-0 text-sky-600" />
        <h4 className="text-sm font-bold text-gray-900">
          {zh ? "AI 视觉识别" : "AI Vision Recognition"}
        </h4>
        <span className="ml-auto rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-700">
          {zh ? "按量消耗积分" : "Pay-per-use credits"}
        </span>
      </div>

      {/* idle：说明 + 开始按钮（不自动跑） */}
      {phase === "idle" && (
        <div className="mt-3 space-y-3">
          <ul className="space-y-1 text-xs leading-relaxed text-gray-600">
            <li>
              {zh
                ? "• 本功能调用大模型（豆包多模态），按实际用量消耗积分。"
                : "• Powered by a large multimodal model (Doubao); credits are consumed per call."}
            </li>
            <li>
              {zh
                ? `• 将逐张识别本产品 ${imageCount} 张图片中的品牌、型号、年份、功率、尺寸等参数。`
                : `• Analyzes brand, model, year, power and dimensions from your ${imageCount} product photo(s).`}
            </li>
            {/* 视频会作为真实 video_url 内容块送入模型（后端共享 buildDoubaoContent）——
                这里如实写明，同时说明视频是"补充参考"而非"替代图片"。 */}
            {videoCount > 0 && (
              <li className="text-gray-500">
                {zh
                  ? `• 视频（${videoCount} 个）会一并作为画面参考送入模型；若视频格式不受支持或过大，该视频将被忽略，图片识别不受影响。`
                  : `• Video(s) (${videoCount}) are sent to the model as additional visual context; an unsupported or oversized video is ignored without affecting photo analysis.`}
              </li>
            )}
            <li>
              {zh
                ? "• 单次约需 30–80 秒，期间请勿关闭页面。"
                : "• Takes about 30–80 seconds — please keep this page open."}
            </li>
          </ul>
          <button
            type="button"
            onClick={startRecognize}
            disabled={imageCount === 0}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
          >
            <ScanEye className="h-4 w-4" />
            {zh ? "开始 AI 视觉识别" : "Start AI Vision Recognition"}
          </button>
          {imageCount === 0 && (
            <p className="text-xs text-amber-600">
              {zh
                ? "该产品还没有可识别的图片，补传图片后再来识别（视频不能替代图片）。"
                : "No photos to analyze yet — upload some first (videos cannot replace photos)."}
            </p>
          )}
        </div>
      )}

      {/* running */}
      {running && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-sky-200 bg-white px-3 py-3 text-sm text-sky-700">
          <Loader2 className="h-4 w-4 animate-spin" />
          {zh ? "正在逐张识别产品图片…" : "Analyzing product photos…"}
        </div>
      )}

      {/* error */}
      {phase === "error" && error && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-amber-800">{error.message}</p>
              {error.debug && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-amber-700">
                    {zh ? "查看技术细节" : "Technical details"}
                  </summary>
                  <p className="mt-1 break-all rounded bg-white/60 p-2 text-[11px] leading-relaxed text-gray-600">
                    {error.debug}
                  </p>
                </details>
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {error.kind === "login" && loginUrl && (
              <a
                href={loginUrl}
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700"
              >
                <LogIn className="h-3.5 w-3.5" />
                {zh ? "去登录" : "Log in"}
              </a>
            )}
            {error.retryable && (
              <button
                type="button"
                onClick={startRecognize}
                className="inline-flex items-center gap-1.5 rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {zh ? "重试" : "Retry"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* done：结果表 + 回填 */}
      {phase === "done" && recognized && (
        <div className="mt-3 space-y-3">
          {/* 结果表（可折叠，避免长表把页面撑长） */}
          <details open className="rounded-lg border border-sky-200 bg-white">
            <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs font-semibold text-sky-700">
              <Sparkles className="h-3.5 w-3.5" />
              {zh ? "识别结果" : "Recognition result"}
              <ChevronDown className="ml-auto h-3.5 w-3.5" />
            </summary>
            <div className="border-t border-sky-100">
              <table className="w-full text-xs">
                <tbody>
                  {resultRows.map((row) => (
                    <tr key={row.labelEn} className="border-b border-gray-100 last:border-0">
                      <th className="w-2/5 px-3 py-1.5 text-left font-medium text-gray-500">
                        {zh ? row.labelZh : row.labelEn}
                      </th>
                      <td className="px-3 py-1.5 text-gray-900">
                        {row.value}
                        {row.isEstimate && row.value !== "—" && (
                          <span className="ml-1 text-[10px] text-gray-400">
                            {zh ? "（AI 估算，仅供参考）" : "(AI estimate, for reference only)"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          {/* 归属判定中 */}
          {permissionLoading && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {zh ? "正在核对产品归属…" : "Checking listing ownership…"}
            </div>
          )}

          {/* 只展示（401 / 403 / 判定失败）：不出现任何回填 UI */}
          {!permissionLoading && canApply === false && applyNote && (
            <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
              {applyNote}
            </p>
          )}

          {/* 可回填：逐字段勾选 */}
          {!permissionLoading && canApply === true && (
            <div className="rounded-lg border border-sky-200 bg-white p-3">
              <div className="flex items-center gap-2">
                <Wand2 className="h-3.5 w-3.5 text-sky-600" />
                <p className="text-xs font-semibold text-gray-800">
                  {zh ? "应用到产品参数（逐字段确认）" : "Apply to product specs (field by field)"}
                </p>
              </div>

              {changedDiffs.length === 0 ? (
                <p className="mt-2 text-xs text-emerald-600">
                  {zh
                    ? "参数与 AI 识别结果一致，无需回填。"
                    : "Specs already match the AI result — nothing to apply."}
                </p>
              ) : (
                <>
                  <ul className="mt-2 divide-y divide-gray-100">
                    {diffs.map((diff) => {
                      const checked = selectedKeys.includes(diff.key);
                      const currentLabel = formatFieldValue(diff.key, diff.current, locale);
                      const recognizedLabel = formatFieldValue(diff.key, diff.recognized, locale);
                      return (
                        <li
                          key={diff.key}
                          className={`flex items-start gap-2 py-1.5 ${
                            diff.changed ? "" : "opacity-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            id={`ai-vision-apply-${diff.key}`}
                            checked={diff.changed && checked}
                            disabled={!diff.changed || applying}
                            onChange={() => toggleField(diff.key)}
                            className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-sky-600 disabled:cursor-not-allowed"
                          />
                          <label
                            htmlFor={`ai-vision-apply-${diff.key}`}
                            className={`min-w-0 flex-1 text-xs leading-relaxed ${
                              diff.changed ? "cursor-pointer text-gray-700" : "cursor-not-allowed text-gray-400"
                            }`}
                          >
                            <span className="font-medium">{zh ? diff.labelZh : diff.labelEn}</span>
                            {zh ? "：" : ": "}
                            <span className="text-gray-500">{currentLabel}</span>
                            <span className="mx-1 text-gray-400">→</span>
                            <span className={diff.changed ? "font-semibold text-sky-700" : ""}>
                              {recognizedLabel}
                            </span>
                            {!diff.changed && (
                              <span className="ml-1 text-[10px] text-gray-400">
                                {zh ? "（一致）" : "(same)"}
                              </span>
                            )}
                          </label>
                        </li>
                      );
                    })}
                  </ul>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={applyToProduct}
                      disabled={applying || selectedKeys.length === 0}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
                    >
                      {applying ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                      {applying
                        ? zh
                          ? "正在写入…"
                          : "Applying…"
                        : zh
                          ? `应用到产品参数（${selectedKeys.length}）`
                          : `Apply to product (${selectedKeys.length})`}
                    </button>
                    {selectedKeys.length > 0 && !applying && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedKeys([]);
                          setApplyMessage(null);
                          setApplyFailed(false);
                        }}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                      >
                        {zh ? "全不选" : "Clear"}
                      </button>
                    )}
                  </div>
                </>
              )}

              {applyMessage && (
                <p
                  className={`mt-2 flex items-start gap-1.5 text-xs ${
                    applyFailed ? "text-red-600" : "text-emerald-600"
                  }`}
                >
                  {applyFailed ? (
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className="break-all">{applyMessage}</span>
                </p>
              )}
            </div>
          )}

          {/* 再识别一次（用户补图后可重跑） */}
          <button
            type="button"
            onClick={startRecognize}
            className="inline-flex items-center gap-1.5 rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {zh ? "重新识别" : "Re-run recognition"}
          </button>
        </div>
      )}

      {productName && (
        <p className="mt-3 truncate text-[11px] text-gray-400">
          {zh ? "识别对象" : "Target"}: {productName}
        </p>
      )}
    </div>
  );
}
