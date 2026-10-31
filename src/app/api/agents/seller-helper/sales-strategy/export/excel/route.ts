/**
 * POST /api/agents/seller-helper/sales-strategy/export/excel
 * AI 销售策略 · 导出经销商联系表（T3，含 PII 门禁）
 *
 * 流程：登录校验 → retrieveDealers(partition) 取脱敏经销商 →
 *       角色放行（super_admin / admin ⇒ 全量明文）否则按 PiiAuditLog(unlock:dealer_*) 构建 unlockedSet →
 *       buildExcel（unlockedSet 内 / 全量放行时写明文，否则 maskPhone/maskEmail）→ 返回 xlsx。
 *
 * ── 明文放行判据（2026-11 修复「超管导出里全是掩码」）────────────────────────────
 *   ① `canViewFullPii(user.role)` 为真（super_admin / admin）⇒ 传 `unlockAll: true`，
 *      整表明文；并写一条 `PiiAuditLog(action:"export", field:"export:dealer_batch")` 留痕。
 *      修复前只按「是否点过解锁按钮」判定，超管没逐个解锁过 ⇒ unlockedSet 为空 ⇒ 全打码。
 *   ② 其他角色（buyer / seller / …）⇒ 仍按逐条解锁的 unlockedSet 判定，**行为逐字不变**。
 *   ⚠️ 留痕 field 前缀必须是 `export:`，**绝不能**是 `unlock:`：`unlock:` 会被
 *      `buildUnlockedDealerSet()` 识别为「该经销商已解锁」⇒ 等于永久解锁，是权限泄漏不是日志。
 *
 * 计费（2026-10-28 起）：**免费**。导出是纯渲染，零 LLM 调用、零模型成本；统一到成本加成口径后
 *   其成本本就为 0，故不再收取名义积分（此前按固定名义 token 计费属重复收费）。
 *   渲染失败直接 500 —— 本来就不扣费，因此「钱扣了却拿不到文件」的风险彻底消失。
 * 合规（#1 数据不出境 / PII 最小化）：
 *   - 明文联系方式仅在「用户曾付费解锁该经销商」**或**「当前用户为 super_admin / admin」时写出；
 *     后者属于职务必需，故必须留痕（见上；一次导出写一条汇总记录）；
 *   - 未解锁行一律脱敏（微信无公网标准 → 统一占位）；
 *   - 本路由只读「当前站点 prisma」，不触达 .com / ARK。
 */
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canViewFullPii } from "@/lib/pii";
import { retrieveDealers } from "@/lib/sales-strategy/dealers";
import { buildExcel, type ExcelDealerInput } from "@/lib/sales-strategy/export";
import type { BuildExcelOptions } from "@/lib/sales-strategy/export-excel";
import {
  DEALER_UNLOCK_FIELD_PREFIX,
  buildUnlockedDealerSet,
  recordAdminFullPiiExport,
} from "@/lib/sales-strategy/pii-export";
import { splitCountryCity } from "@/lib/sales-strategy/derive";
import type { StrategyLlmResult } from "@/lib/sales-strategy/prompt";
import type { DealerPartitionQuery } from "@/lib/sales-strategy/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function getLocaleFromRequest(request: NextRequest): "zh" | "en" {
  const referer = request.headers.get("referer") || "";
  const m = referer.match(/\/([a-z]{2})\b/) || referer.match(/\/([a-z]{2})$/);
  if (m && ["zh", "en", "ru", "es", "pt", "fr", "hi", "ar"].includes(m[1])) return m[1] as "zh" | "en";
  return "zh";
}

const PARTITIONS = new Set<DealerPartitionQuery>(["all", "cn", "intl"]);

export async function POST(request: NextRequest) {
  const locale = getLocaleFromRequest(request);
  const zh = locale === "zh";
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: zh ? "请先登录后再导出" : "Please sign in to export.",
          code: "LOGIN_REQUIRED",
          loginUrl: `/${locale}/auth/login`,
        },
        { status: 401 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      partition?: string;
      locale?: string;
      /**
       * 版式开关（T11）：`"v2"` / `2` / `"2"` ⇒ 三 Sheet（渠道联系总表 14 列 /
       * 机型价格速查 7 列 / 必办清单 5 列）；其余任何值（含缺省）⇒ legacy 11 列单 Sheet。
       *
       * 前端线上发的是**字符串** `"v2"`（`sales-strategy-export-buttons.tsx` 的
       * `EXCEL_LAYOUT_V2 = "v2"`），但手搓 body 的调用方可能传数字 ⇒ 三种写法一律容忍，
       * 避免「传数字就静默降级」这种最难排查的故障。
       */
      layout?: string | number;
      /** 策略对象（Sheet2/Sheet3 的唯一数据源）；缺省则两 Sheet 走降级文案 */
      strategy?: StrategyLlmResult | null;
      /** 外部检索状态；非 `ok` 时 Sheet2「备注」标注「外部检索未接入」 */
      webStatus?: string;
    };
    const partition: DealerPartitionQuery =
      typeof body.partition === "string" && PARTITIONS.has(body.partition as DealerPartitionQuery)
        ? (body.partition as DealerPartitionQuery)
        : "all";

    /** 版式归一：`"v2"` / `2` / `"2"` → `2`；其余（含缺省、`"1"`、垃圾值）→ `1` */
    const layoutOpt: 1 | 2 =
      body.layout === "v2" || body.layout === 2 || body.layout === "2" ? 2 : 1;
    const strategy =
      body.strategy && typeof body.strategy === "object" ? (body.strategy as StrategyLlmResult) : null;
    const webStatus = typeof body.webStatus === "string" ? body.webStatus : undefined;

    // ── 取脱敏经销商（遵循 T4 分区契约，只读当前站点 prisma）──
    const { domestic, international } = await retrieveDealers(partition);
    const allDealers = [...domestic, ...international];

    // ── 安全读取明文联系方式（仅用于「已解锁」门禁判定后的按需展示）──
    const ids = allDealers.map((d) => d.id);
    const plainRows =
      ids.length > 0
        ? await prisma.dealer.findMany({
            where: { id: { in: ids } },
            select: {
              id: true,
              phone: true,
              wechat: true,
              email: true,
              // ── T11：14 列版式所需的 additive 列（T06 已建列；老库 null ⇒ 渲染层统一 —）──
              location: true,
              country: true,
              city: true,
              contactPerson: true,
              role: true,
              priority: true,
              suggestedPrice: true,
              followStatus: true,
              sourcePage: true,
            },
          })
        : [];
    const plainMap = new Map(plainRows.map((r) => [r.id, r]));

    // ── 角色放行判定：super_admin / admin 导出即全量明文（不需要逐个点过「解锁」）──
    // `user.role ?? ""` 兜底：老 token / 测试桩可能没有 role ⇒ 按「无权限」处理（安全默认）。
    const fullPii = canViewFullPii(user.role ?? "");

    // ── PII 审计：本用户已解锁的经销商集合（管理员走 unlockAll，无需这次查询）──
    let unlockedSet = new Set<string>();
    if (!fullPii) {
      const auditLogs = await prisma.piiAuditLog.findMany({
        where: { actorId: user.id, field: { startsWith: DEALER_UNLOCK_FIELD_PREFIX } },
        select: { field: true },
      });
      unlockedSet = buildUnlockedDealerSet(auditLogs);
    }

    // ── 组装 Excel 输入（带明文，由 buildExcel 按门禁脱敏）──
    const inputs: ExcelDealerInput[] = allDealers.map((d) => {
      const plain = plainMap.get(d.id);
      const part = d.partition === "cn" ? "cn" : "intl";
      // 国家/城市：`Dealer.country/city` → 回落 `location` 解析 → 渲染层统一 `—`（PRD §4.1 第 4/5 列）
      const fromLocation = splitCountryCity(plain?.location ?? null, part);
      return {
        id: d.id,
        partition: d.partition,
        grade: d.grade,
        brands: d.brands,
        models: d.models,
        regions: d.regions,
        nature: d.nature,
        name: d.name,
        phone: plain?.phone ?? null,
        wechat: plain?.wechat ?? null,
        email: plain?.email ?? null,
        sourceUrl: d.sourceUrl,
        // ── 14 列版式新增字段（additive；缺失一律 null，渲染层统一 —）──
        country: plain?.country ?? fromLocation.country,
        city: plain?.city ?? fromLocation.city,
        contactPerson: plain?.contactPerson ?? null,
        role: plain?.role ?? null,
        priority: plain?.priority ?? null,
        suggestedPrice: plain?.suggestedPrice ?? null,
        followStatus: plain?.followStatus ?? null,
        sourcePage: plain?.sourcePage ?? null,
      };
    });

    // ── 先 build 成功再返回（build 失败 → 500；导出不扣费，见文件头「计费」说明）──
    // 版式 1 且非管理员时**一个可选参数都不传**（`undefined`）：与改造前的三参调用逐字等价，
    // 保证 legacy 路径连「多传一个参数」这种差异都不引入。
    const buildOpts: BuildExcelOptions = {};
    if (layoutOpt === 2) {
      buildOpts.layout = 2;
      buildOpts.strategy = strategy;
      buildOpts.webStatus = webStatus;
    }
    if (fullPii) buildOpts.unlockAll = true;
    const buf = await buildExcel(
      inputs,
      unlockedSet,
      locale,
      Object.keys(buildOpts).length > 0 ? buildOpts : undefined
    );

    // ── 留痕：管理员导出全量明文 PII（一次导出写一条汇总记录）──
    // 时机：放在 build 成功之后 —— 文件确实生成出来了才记账，避免「记了导出却 500 没文件」的假阳性。
    // 刻意不吞异常：留痕失败 ⇒ 抛给外层 catch ⇒ 500 且不发文件（导出免费、重试即可；
    // 而「明文已外发却查不到谁导的」是不可补救的合规缺口，宁可失败在明处）。
    // field 形如 `export:dealer_batch`，**不带** `unlock:` 前缀，见 pii-export.ts 文件头红线。
    if (fullPii && inputs.length > 0) {
      await recordAdminFullPiiExport({
        actorId: user.id,
        role: user.role ?? "",
        channel: "excel",
        scope: partition,
        rows: inputs.length,
        auditScope: "dealer",
      });
    }

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="dealers-${partition}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("[ExportExcel] 未处理异常:", error?.message);
    return NextResponse.json(
      {
        success: false,
        error: zh ? "导出失败，请稍后重试" : "Export failed, please retry.",
        code: "SERVER_ERROR",
      },
      { status: 500 }
    );
  }
}
