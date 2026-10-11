/**
 * 境内线索手动录入 —— 批量写入服务（P0）
 *
 * 将前端经列映射后的结构化行写入 `RawListing`，逐行写 PII 审计。
 * 设计要点：
 *  - source 默认 "manual_cn_lead"、status 默认 "imported"、scrapedAt=now()。
 *  - contentHash 采用 **R2 锁定公式**（纳入 sellerPhone/sellerName，与采集公式不同），
 *    保证每家独立成行、同机型不同卖家不互吞。
 *  - 幂等三层：批内按 contentHash 去重 → 逐行 create → 唯一冲突 catch 跳过。
 *  - 每行新建成功 → writePiiAuditLog({ actorId, targetListingId: row.id, field:"contact", action:"import" })。
 *
 * ⚠️ 本文件零 schema 变更，只写 RawListing / PiiAuditLog 两表。
 */
import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { writePiiAuditLog } from "@/lib/audit";

/** 单条录入行（已在前端完成列映射，键为 RawListing 规范字段） */
export interface ImportLeadRow {
  brandName: string;
  modelName: string;
  year?: number | null;
  workingHours?: number | null;
  condition?: string | null;
  priceRaw?: number | null;
  currency?: string | null;
  priceCny?: number | null;
  location?: string | null;
  sellerName?: string | null;
  sellerPhone?: string | null;
  sellerWechat?: string | null;
  sellerWhatsapp?: string | null;
  sellerEmail?: string | null;
  sourceUrl?: string | null;
  notes?: string | null;
}

/** 批量导入结果汇总 */
export interface ImportLeadResult {
  /** 成功新建行数 */
  imported: number;
  /** 因唯一冲突（已存在同 contentHash）跳过的行数（含批内重复与跨批重导） */
  skipped: number;
  /** 行级校验失败（缺必填字段 / 字段类型错误）行数 */
  errors: number;
  /** 前若干条校验/写入错误样本，供前端展示 */
  sampleErrors: string[];
}

/** 默认写入源标识（与采集源 agroline/mascus/domestic_* 区分，便于筛选/排查） */
export const MANUAL_LEAD_SOURCE = "manual_cn_lead";
/** 默认写入状态（进线索池 listLeads，不进审核流 listRawListings 默认 needs_review） */
export const MANUAL_LEAD_STATUS = "imported";

/**
 * R2 锁定 contentHash：纳入 sellerPhone / sellerName（与采集公式不同）。
 * 注：本仓库 schema 无 priceEur 字段（仅有 priceCny / priceRaw），
 * 故价格部分以 `priceCny ?? priceRaw ?? ""` 等价替换，避免引用不存在的字段。
 */
export function generateContentHash(row: ImportLeadRow): string {
  const brandName = (row.brandName ?? "").toString();
  const modelName = (row.modelName ?? "").toString();
  const year = row.year == null ? "" : String(row.year);
  const location = (row.location ?? "").toString();
  const pricePart = row.priceCny != null
    ? String(row.priceCny)
    : row.priceRaw != null
      ? String(row.priceRaw)
      : "";
  const sellerPhone = (row.sellerPhone ?? "").toString();
  const sellerName = (row.sellerName ?? "").toString();
  const raw = `${brandName}|${modelName}|${year}|${location}|${pricePart}|${sellerPhone}|${sellerName}`;
  return createHash("md5").update(raw, "utf8").digest("hex");
}

/** 行级校验：返回错误信息数组（空数组表示通过） */
function validateRow(row: ImportLeadRow, lineNo: number): string[] {
  const errs: string[] = [];
  const brandName = (row.brandName ?? "").toString().trim();
  const modelName = (row.modelName ?? "").toString().trim();
  if (!brandName) errs.push(`第 ${lineNo} 行：缺少必填字段 brandName（品牌）`);
  if (!modelName) errs.push(`第 ${lineNo} 行：缺少必填字段 modelName（机型/型号）`);
  // 数值字段类型校验（null/undefined 放行，交由 DB 默认值/可空约束处理）
  const numFields: (keyof ImportLeadRow)[] = ["year", "workingHours", "priceRaw", "priceCny"];
  for (const f of numFields) {
    const v = row[f];
    if (v != null && typeof v !== "number" && Number.isNaN(Number(v))) {
      errs.push(`第 ${lineNo} 行：字段 ${String(f)} 不是合法数字（值为 ${String(v)}）`);
    }
  }
  return errs;
}

/**
 * 批量导入境内线索。
 * @param rows 已列映射后的行数组（前端提交）
 * @param actorId 操作人用户 id（用于 PII 审计）
 * @returns 汇总结果
 */
export async function importLeadsRows(
  rows: ImportLeadRow[],
  actorId: string,
): Promise<ImportLeadResult> {
  const result: ImportLeadResult = { imported: 0, skipped: 0, errors: 0, sampleErrors: [] };

  // 入参兜底
  if (!Array.isArray(rows)) {
    return result;
  }

  // 批内按 contentHash 去重（Map 保留首次出现；批内重复视为 skipped，避免唯一冲突）
  const seen = new Map<string, true>();
  const deduplicated: ImportLeadRow[] = [];
  rows.forEach((raw, i) => {
    const lineNo = i + 1;
    const row = { ...raw };
    const errs = validateRow(row, lineNo);
    if (errs.length > 0) {
      result.errors += 1;
      if (result.sampleErrors.length < 20) result.sampleErrors.push(...errs);
      return;
    }
    const hash = generateContentHash(row);
    if (seen.has(hash)) {
      result.skipped += 1;
      return;
    }
    seen.set(hash, true);
    deduplicated.push(row);
  });

  for (const row of deduplicated) {
    const brandName = (row.brandName ?? "").toString().trim();
    const modelName = (row.modelName ?? "").toString().trim();
    const hash = generateContentHash(row);
    try {
      const created = await prisma.rawListing.create({
        data: {
          source: MANUAL_LEAD_SOURCE,
          sourceUrl: (row.sourceUrl ?? "").toString(),
          status: MANUAL_LEAD_STATUS,
          brandName,
          modelName,
          year: row.year != null ? Number(row.year) : null,
          workingHours: row.workingHours != null ? Number(row.workingHours) : null,
          condition: row.condition ? row.condition.toString() : null,
          priceRaw: row.priceRaw != null ? Number(row.priceRaw) : null,
          currency: row.currency ? row.currency.toString() : null,
          priceCny: row.priceCny != null ? Number(row.priceCny) : null,
          location: (row.location ?? "").toString(),
          sellerName: row.sellerName ? row.sellerName.toString() : null,
          sellerPhone: row.sellerPhone ? row.sellerPhone.toString() : null,
          sellerWechat: row.sellerWechat ? row.sellerWechat.toString() : null,
          sellerWhatsapp: row.sellerWhatsapp ? row.sellerWhatsapp.toString() : null,
          sellerEmail: row.sellerEmail ? row.sellerEmail.toString() : null,
          contentHash: hash,
          scrapedAt: new Date(),
          notes: `[import] manual_cn_lead by ${actorId}`,
        },
      });
      result.imported += 1;
      // 逐行 PII 审计（与 reveal-all 同口径：field:"contact"）
      await writePiiAuditLog({
        actorId,
        targetListingId: created.id,
        field: "contact",
        action: "import",
      });
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      const msg = err?.message ?? String(e);
      // 唯一冲突（跨批重导同 contentHash）：跳过该条，计入 skipped
      if (err?.code === "P2002" || /unique|contentHash/i.test(msg)) {
        result.skipped += 1;
      } else {
        // 其他异常：计入 errors，但不中断整批
        result.errors += 1;
        if (result.sampleErrors.length < 20) {
          result.sampleErrors.push(`写入失败（第 ${result.imported + result.errors} 条）：${msg}`);
        }
      }
    }
  }

  return result;
}
