"use client";

/**
 * 产品详情页「AI 设备中心」第四个 AI 能力模块：AI 销售策略卡片。
 *
 * 与现有「AI 深度分析」「AI 智能估值」胶囊保持同一交互范式（按钮触发 → 加载态 →
 * 结果区 → 错误/余额提示），视觉色系取 emerald 以区分（深度分析=紫，估值=靛，策略=翠）。
 *
 * 输入：复用产品页已上传的图片/视频（与发布页「三件套」：封面图 + 介绍视频 + 实机作业视频
 *       同源媒体），并支持一段补充说明文本；策略核心依据来自产品已识别属性 + 检索层。
 * 输出（6 字段 + 摘要）：targetMarkets / priceRange / channels(脱敏) / compliance /
 *       actionChecklist / responsibility；channels 中联系方式默认脱敏，解锁后给明文（2026-10-28 起免费）。
 * 计费：生成按豆包实际 token 消耗走「成本加成」口径（computeAiCost），扣后展示成本+余额；
 *       解锁联系方式免费，不计费。
 */
import { useState } from "react";
import { Sparkles, Loader2, AlertCircle, Target, Unlock, Phone, Mail, Lock, CheckCircle2 } from "lucide-react";
import SalesStrategyExportButtons from "@/components/seller/sales-strategy-export-buttons";
import type { StrategyDecisionFields } from "@/lib/sales-strategy/strategy-schema";
import type { StrategyExportWebStatus } from "@/lib/sales-strategy/export";

interface AiSalesStrategyCardProps {
  productId?: string;
  productName?: string;
  category?: string;
  imageUrls?: string[];
  videoUrls?: string[];
  locale?: string;
  isChineseBrand?: boolean;
  brandName?: string;
  modelName?: string;
  year?: number;
  enginePower?: string;
  region?: string;
  sellerPrice?: number | null;
}

interface StrategyChannel {
  candidateId: string;
  type: "lead" | "dealer";
  name: string;
  brand: string | null;
  model: string | null;
  region: string | null;
  rationale: string;
  phoneMasked: string;
  wechatMasked: string;
  emailMasked: string;
}

/**
 * 生成接口响应体（`setResult(data.data)` 原样保存）。
 *
 * N02 追加的 12 个决策字段通过 `Partial<StrategyDecisionFields>` 并进来：
 * 服务端早已返回这些字段，只是过去本类型没有声明、导出时又被字面量白名单裁掉。
 * 声明在此处的作用是让「整对象透传 `strategy={result}`」在类型上成立，
 * 任何人再想改回白名单重建，都会立刻在 tsc 阶段丢掉 12 个字段。
 */
interface StrategyResult extends Partial<StrategyDecisionFields> {
  summary: string;
  targetMarkets: Array<{ market: string; priority: string; rationale: string; priceBand?: string; channels?: string }>;
  priceRange: { suggestedMinCny?: number; suggestedMaxCny?: number; currencyNote?: string; basis?: string } | null;
  channels: StrategyChannel[];
  compliance: { dataExport?: string; crossBorder?: string; notes?: string } | null;
  actionChecklist: Array<{ step: number; action: string; owner?: string; eta?: string }>;
  responsibility: { seller?: string; platform?: string; disclaimer?: string } | null;
  /** T2 导出：销售话术（场景 + 话术），可选 */
  scripts?: Array<{ scenario: string; line: string }>;
  /** T2 导出：上架清单（步骤 + 事项），可选 */
  listingChecklist?: Array<{ step: number; item: string }>;
  model: string;
  estimatedCost: number;
  cost: number;
  balance: number;
  realtimeExternal: boolean;
  dataDate: string | null;
  /**
   * 本次策略的外部检索状态（T08 生成接口下发，契约：`ok | partial | timeout | disabled`）。
   *
   * 缺省视同 `ok`：PDF 顶部黄条与 Excel Sheet2「备注」降级标注只在非 `ok` 时出现。
   */
  searchStatus?: StrategyExportWebStatus;
  /** 检索状态补充说明；**`ok` 时为空串**（空串与非 ok 一样不下传，避免出现空行提示） */
  searchNote?: string;
}

const priorityColors: Record<string, string> = {
  高: "bg-red-100 text-red-700",
  中: "bg-amber-100 text-amber-700",
  低: "bg-green-100 text-green-700",
};

export default function AiSalesStrategyCard({
  productId,
  productName,
  category,
  imageUrls = [],
  videoUrls = [],
  locale = "zh",
  isChineseBrand,
  brandName,
  modelName,
  year,
  region,
  sellerPrice,
}: AiSalesStrategyCardProps) {
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<StrategyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [text, setText] = useState("");
  // 已解锁联系方式：candidateId -> { phone, wechat, email }
  const [unlocked, setUnlocked] = useState<Record<string, { phone: string; wechat: string; email: string }>>({});
  const [unlockingId, setUnlockingId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState<string | null>(null);

  const zh = locale === "zh";
  const selectedImages = imageUrls.slice(0, 3);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setNote(null);
    setResult(null);
    try {
      const res = await fetch("/api/agents/seller-helper/sales-strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: productId || undefined,
          brandName: brandName || undefined,
          modelName: modelName || undefined,
          categoryName: category || undefined,
          year: year || undefined,
          location: region || undefined,
          isChineseBrand,
          text: text || undefined,
          imageUrls: selectedImages.length ? selectedImages : undefined,
          videoUrls: videoUrls.length ? videoUrls : undefined,
        }),
      });
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        if (data.code === "INSUFFICIENT_CREDITS") {
          setError(
            zh
              ? `积分不足（需 ${data.required ?? "?"}，当前 ${data.balance ?? 0}）。请先充值后再生成。`
              : `Insufficient credits (need ${data.required ?? "?"}, have ${data.balance ?? 0}).`
          );
        } else if (data.code === "GUARDRAIL") {
          setError(zh ? "本次请求成本超出单次上限，已熔断（未扣费）。请简化输入或联系平台。" : "Cost exceeded cap; circuit-broken (no charge).");
        } else if (data.code === "LOGIN_REQUIRED") {
          setError(zh ? "请先登录后再使用 AI 销售策略" : "Please sign in first.");
        } else {
          setError(data.error || (zh ? "生成失败，请稍后重试" : "Generation failed, please retry"));
        }
        return;
      }
      setResult(data.data as StrategyResult);
    } catch {
      setError(zh ? "网络错误，无法生成销售策略" : "Network error, cannot generate strategy");
    } finally {
      setGenerating(false);
    }
  };

  const handleUnlock = async (candidateId: string) => {
    if (confirmOpen !== candidateId) {
      setConfirmOpen(candidateId);
      return;
    }
    setUnlockingId(candidateId);
    setConfirmOpen(null);
    try {
      const res = await fetch("/api/agents/seller-helper/sales-strategy/unlock-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId, responsibilityConfirmed: true }),
      });
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        if (data.code === "RESPONSIBILITY_REQUIRED") {
          setError(zh ? "请先确认责任声明再解锁" : "Confirm responsibility first");
        } else if (data.code === "NOT_FOUND") {
          setError(zh ? "该线索不存在或已失效" : "Lead not found");
        } else if (data.code === "LOGIN_REQUIRED") {
          setError(zh ? "请先登录后再解锁联系方式" : "Please sign in to unlock contacts");
        } else {
          setError(data.error || (zh ? "解锁失败" : "Unlock failed"));
        }
        return;
      }
      setUnlocked((prev) => ({
        ...prev,
        [candidateId]: { phone: data.data.phone || "", wechat: data.data.wechat || "", email: data.data.email || "" },
      }));
      // 解锁免费（2026-10-28 口径）：只提示成功，不再展示消耗积分
      setNote(zh ? "已解锁联系方式（免费）" : "Contact unlocked (free)");
    } catch {
      setError(zh ? "网络错误，解锁失败" : "Network error, unlock failed");
    } finally {
      setUnlockingId(null);
    }
  };

  const title = zh ? "AI 销售策略" : "AI Sales Strategy";
  const desc = zh
    ? `基于本品属性、同品类行情、全球基准价与神雕日报，生成可落地的目标市场 / 定价 / 渠道 / 合规策略。`
    : `Actionable target-market / pricing / channel / compliance strategy from live data + daily report.`;
  const btnText = generating
    ? zh
      ? "生成中（约15-30秒）..."
      : "Generating..."
    : zh
      ? "开始生成 AI 销售策略"
      : "Generate AI Sales Strategy";
  const placeholder = zh ? "补充说明（选填）：如期望出口市场、最低接受价、重点客户类型…" : "Optional notes: target market, floor price, buyer type…";

  return (
    <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <Target className="h-5 w-5 text-emerald-600" />
        <h3 className="text-base font-bold text-gray-900">{title}</h3>
        {result && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
            {result.model}
          </span>
        )}
      </div>

      <p className="mb-3 text-sm text-gray-500">{desc}</p>

      {/* 媒体提示（与发布页三件套同源：封面图 + 介绍视频 + 实机作业视频） */}
      <div className="mb-3 flex flex-wrap gap-2 text-xs text-gray-400">
        <span className="rounded bg-gray-100 px-2 py-0.5">
          {zh ? `图片 ${selectedImages.length}` : `Images ${selectedImages.length}`}
        </span>
        <span className="rounded bg-gray-100 px-2 py-0.5">
          {zh ? `视频 ${videoUrls.length}` : `Videos ${videoUrls.length}`}
        </span>
        {sellerPrice != null && (
          <span className="rounded bg-gray-100 px-2 py-0.5">
            {zh ? `挂牌 ¥${sellerPrice}` : `Listed ¥${sellerPrice}`}
          </span>
        )}
      </div>

      {/* 补充说明输入 */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        rows={2}
        disabled={generating}
        className="mb-3 w-full resize-none rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-emerald-400"
      />

      {/* 预估成本提示（决策 B：扣前展示门槛） */}
      <p className="-mt-1 mb-2 text-xs text-gray-400">
        {zh
          ? "按豆包大模型实际 token 消耗计费（系数由平台配置）；单次约 2000–4000 tokens。"
          : "Pay-per-use by actual Doubao tokens (coeff configured by platform)."}
      </p>

      {/* 生成按钮 */}
      <button
        onClick={handleGenerate}
        disabled={generating}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {generating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {btnText}
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            {btnText}
          </>
        )}
      </button>

      {/* 错误 */}
      {error && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}
      {/* 解锁成功提示 */}
      {note && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          {note}
        </div>
      )}

      {/* 结果区 */}
      {result && (
        <div className="mt-4 space-y-4">
          {/*
           * 外部检索降级黄条（PRD §6.5）：仅非 ok 时渲染。
           * 服务端契约：`searchStatus` 四档（ok/partial/timeout/disabled），`searchNote` 在 ok 时为空串
           * ⇒ 这里双条件兜住「status 缺失（老响应）」与「note 为空」两种情况，正常态不制造噪音。
           * 语气原则（PRD §6.5）：只陈述事实给下一步动作，不道歉、不放进错误弹窗 —— 策略本身是成功的。
           */}
          {result.searchStatus && result.searchStatus !== "ok" && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
              <div className="flex items-start gap-1.5">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  {result.searchNote ||
                    (zh
                      ? "本次策略未接入外部检索（检索超时/未启用）。下列价格与准入结论仅基于站内数据；标注「推算」的数字请务必电话核实。"
                      : "External search was unavailable for this strategy. Prices and access conclusions are based on in-site data only; verify any estimated figure by phone.")}
                </span>
              </div>
            </div>
          )}

          {/* 摘要 */}
          {result.summary && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-sm text-gray-700">
              {result.summary}
            </div>
          )}

          {/* 目标市场 */}
          {result.targetMarkets.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white/80 p-3">
              <div className="mb-2 flex items-center gap-1.5">
                <Target className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-semibold text-gray-700">{zh ? "推荐目标市场" : "Target Markets"}</span>
              </div>
              <div className="space-y-1.5">
                {result.targetMarkets.map((m, i) => (
                  <div key={i} className="text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${priorityColors[m.priority] || "bg-gray-100 text-gray-600"}`}>
                        {m.priority}
                      </span>
                      <span className="font-medium text-gray-900">{m.market}</span>
                      {m.priceBand && <span className="text-xs text-gray-500">· {m.priceBand}</span>}
                    </div>
                    <p className="text-xs text-gray-500">{m.rationale}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 定价区间 */}
          {result.priceRange && (result.priceRange.suggestedMinCny != null || result.priceRange.suggestedMaxCny != null) && (
            <div className="rounded-lg border border-emerald-300 bg-emerald-50/50 p-3">
              <div className="mb-1 flex items-center gap-1.5">
                <span className="text-sm font-semibold text-gray-700">{zh ? "建议定价区间" : "Suggested Price Range"}</span>
              </div>
              <p className="text-sm text-gray-700">
                ¥{result.priceRange.suggestedMinCny ?? "?"} – ¥{result.priceRange.suggestedMaxCny ?? "?"}
                {result.priceRange.currencyNote ? ` · ${result.priceRange.currencyNote}` : ""}
              </p>
              {result.priceRange.basis && <p className="mt-1 text-xs text-gray-400">{result.priceRange.basis}</p>}
            </div>
          )}

          {/* 渠道线索（脱敏 + 解锁） */}
          {result.channels.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white/80 p-3">
              <div className="mb-2 flex items-center gap-1.5">
                <Unlock className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-semibold text-gray-700">{zh ? "可对接线索/经销商" : "Leads / Dealers"}</span>
              </div>
              <div className="space-y-2">
                {result.channels.map((c) => {
                  const full = unlocked[c.candidateId];
                  return (
                    <div key={c.candidateId} className="rounded-lg border border-gray-100 bg-gray-50/60 p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900">
                          {c.name}
                          <span className="ml-1 rounded bg-emerald-100 px-1 text-[10px] text-emerald-700">
                            {c.type === "dealer" ? (zh ? "经销商" : "Dealer") : zh ? "线索" : "Lead"}
                          </span>
                        </span>
                        {c.region && <span className="text-xs text-gray-400">{c.region}</span>}
                      </div>
                      {c.rationale && <p className="mt-0.5 text-xs text-gray-500">{c.rationale}</p>}
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {full ? full.phone || zh ? "无" : "—" : c.phoneMasked || zh ? "无电话" : "—"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {full ? full.email || zh ? "无" : "—" : c.emailMasked || zh ? "无邮箱" : "—"}
                        </span>
                        {c.wechatMasked && <span>{full?.wechat || c.wechatMasked}</span>}
                      </div>
                      {/* 解锁按钮 / 二次确认 */}
                      <div className="mt-2">
                        {full ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                            <CheckCircle2 className="h-3 w-3" />
                            {zh ? "已解锁" : "Unlocked"}
                          </span>
                        ) : confirmOpen === c.candidateId ? (
                          <button
                            onClick={() => handleUnlock(c.candidateId)}
                            disabled={unlockingId === c.candidateId}
                            className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {unlockingId === c.candidateId ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>{zh ? "确认：跨境/数据合规自担，解锁明文" : "Confirm & unlock"}</>
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUnlock(c.candidateId)}
                            disabled={unlockingId === c.candidateId}
                            className="inline-flex items-center gap-1 rounded-md border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                          >
                            <Lock className="h-3 w-3" />
                            {zh ? "解锁联系方式（免费）" : "Unlock contact (free)"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 合规 */}
          {result.compliance && (result.compliance.crossBorder || result.compliance.dataExport || result.compliance.notes) && (
            <div className="rounded-lg border border-gray-200 bg-white/80 p-3">
              <div className="mb-1 text-sm font-semibold text-gray-700">{zh ? "合规提示" : "Compliance"}</div>
              {result.compliance.crossBorder && <p className="text-xs text-gray-500">· {result.compliance.crossBorder}</p>}
              {result.compliance.dataExport && <p className="text-xs text-gray-500">· {result.compliance.dataExport}</p>}
              {result.compliance.notes && <p className="text-xs text-gray-500">· {result.compliance.notes}</p>}
            </div>
          )}

          {/* 行动清单 */}
          {result.actionChecklist.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white/80 p-3">
              <div className="mb-2 text-sm font-semibold text-gray-700">{zh ? "行动清单" : "Action Checklist"}</div>
              <ol className="space-y-1.5">
                {result.actionChecklist.map((a, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="flex-shrink-0 rounded bg-emerald-100 px-1.5 text-xs font-medium text-emerald-700">
                      {a.step || i + 1}
                    </span>
                    <span className="text-gray-700">
                      {a.action}
                      {a.owner && <span className="ml-1 text-xs text-gray-400">（{a.owner}）</span>}
                      {a.eta && <span className="ml-1 text-xs text-gray-400">· {a.eta}</span>}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* 责任边界 */}
          {result.responsibility && (result.responsibility.seller || result.responsibility.platform || result.responsibility.disclaimer) && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-xs text-gray-500">
              {result.responsibility.seller && <p>· {zh ? "卖家" : "Seller"}：{result.responsibility.seller}</p>}
              {result.responsibility.platform && <p>· {zh ? "平台" : "Platform"}：{result.responsibility.platform}</p>}
              {result.responsibility.disclaimer && <p>· {result.responsibility.disclaimer}</p>}
            </div>
          )}

          {/* 导出（T2 PDF 作战手册 / T3 Excel 联系表） */}
          {/*
           * N03 补丁（关键，勿改回白名单）：**整对象透传** `strategy={result}`。
           * 旧代码在此用字面量白名单重建（只挑 summary / targetMarkets / priceRange /
           * compliance / actionChecklist / responsibility / scripts / listingChecklist），
           * 导致 N02 的 12 个决策字段（tldr / keyInsight / equipmentProfiles / marketAnchors /
           * readout / bestDestinations / marketRanking / accessTrafficLight / todayCalls /
           * complianceTasks / openQuestions / dataSources）在浏览器端就被丢光 ——
           * 生成接口再全、PDF 8 章渲染器再强，也拿不到数据。
           * `result` 即服务端响应体（`setResult(data.data)` 原样保存），12 字段本就在其中。
           * 空值保护在 `SalesStrategyExportButtons.toExportableStrategy()` 内完成
           * （null / 非对象 ⇒ `{}`，Excel 不发 layout 回落 legacy），此处无需再包一层。
           */}
          <SalesStrategyExportButtons
            strategy={result}
            channels={result.channels}
            /* N03 最后一跳：检索状态一起下传，PDF 顶部黄条 / Excel Sheet2 降级标注才有数据源 */
            webStatus={result.searchStatus}
            webNote={result.searchNote}
            product={{
              brandName,
              modelName,
              year,
              categoryName: category,
              priceCny: sellerPrice ?? null,
              location: region,
              isChineseBrand,
            }}
            partition="all"
            locale={locale}
          />

          {/* 成本/余额 + 数据来源 */}
          <div className="flex items-center justify-between rounded-lg bg-emerald-50/60 px-3 py-2 text-xs text-gray-500">
            <span>
              {zh ? `本次消耗 ${result.cost} 积分 · 剩余 ${result.balance}` : `Cost ${result.cost} · balance ${result.balance}`}
            </span>
            <span>
              {zh ? `数据源：${result.realtimeExternal ? "神雕日报" : "站内实时"}${result.dataDate ? ` · ${result.dataDate}` : ""}` : `Source: ${result.realtimeExternal ? "daily report" : "live"}${result.dataDate ? ` · ${result.dataDate}` : ""}`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
