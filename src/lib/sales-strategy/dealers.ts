/**
 * AI 销售策略 · 经销商分区查询服务（T4）
 * ─────────────────────────────────────────────────────────
 * 职责：根据当前站点（SITE）从「当前 prisma 实例」读取经销商，并按
 *       partition 拆成「境内 domestic」与「跨境候选 international」两分区。
 *
 * 合规红线（#1 数据不出境）：
 *   - 全程只使用「当前站点」的 prisma 实例（src/lib/db 按 SITE 切换）；
 *   - 绝不持有 .com / ARK_PROXY_URL 的任何连接；
 *   - .cn 库的 intl 为「境内快照（inbound）」——只读本库，无任何出站请求；
 *   - .com 库不持境内 PII，故 domestic 恒为 []。
 *
 * 联系方式默认脱敏（唯一出口：src/lib/pii.ts）。
 */
import { prisma } from "@/lib/db";
import { maskPhone, maskEmail } from "@/lib/pii";
import { isCnSite } from "@/config/site";
import type { DealerPartition, DealerPartitions, DealerPublic, DealerPartitionQuery } from "./types";

/** 数据库行 → 脱敏公开结构 */
function toPublic(row: {
  id: string;
  name: string | null;
  brands: string[] | null;
  models: string[] | null;
  regions: string[] | null;
  nature: string | null;
  grade: string | null;
  sourceUrl: string | null;
  partition: string;
  phone: string | null;
  wechat: string | null;
  email: string | null;
}): DealerPublic {
  return {
    id: row.id,
    name: row.name,
    brands: row.brands ?? [],
    models: row.models ?? [],
    regions: row.regions ?? [],
    nature: row.nature,
    grade: row.grade,
    sourceUrl: row.sourceUrl,
    partition: (row.partition === "cn" ? "cn" : "intl") as DealerPartition,
    phoneMasked: row.phone ? maskPhone(row.phone) : "",
    // 微信无公网脱敏标准 → 统一占位（与现有 route.ts 一致）
    wechatMasked: row.wechat ? "微信:********" : "",
    emailMasked: row.email ? maskEmail(row.email) : "",
  };
}

/** 按 partition 查询当前库经销商（脱敏后返回） */
async function listByPartition(partition: "cn" | "intl"): Promise<DealerPublic[]> {
  const rows = await prisma.dealer.findMany({
    where: { partition },
    select: {
      id: true,
      name: true,
      brands: true,
      models: true,
      regions: true,
      nature: true,
      grade: true,
      sourceUrl: true,
      partition: true,
      phone: true,
      wechat: true,
      email: true,
    },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toPublic);
}

/**
 * 获取双站分区经销商列表。
 *
 * @param partition 查询口径：
 *   - "all"：返回本站应展示的两分区（.cn → 境内+跨境候选；.com → 仅跨境候选）
 *   - "cn"：仅境内（.com 站返回 domestic=[]）
 *   - "intl"：仅跨境候选
 * @returns { site, domestic, international }
 */
export async function retrieveDealers(
  partition: DealerPartitionQuery = "all"
): Promise<DealerPartitions> {
  const site = isCnSite() ? "cn" : "com";

  // ── .cn 站：本库自包含 cn(58)+intl 快照(36)，只读自己库，无出境请求 ──
  if (site === "cn") {
    if (partition === "intl") {
      return { site, domestic: [], international: await listByPartition("intl") };
    }
    if (partition === "cn") {
      return { site, domestic: await listByPartition("cn"), international: [] };
    }
    return {
      site,
      domestic: await listByPartition("cn"),
      international: await listByPartition("intl"),
    };
  }

  // ── .com 站：库内仅有 intl（不持境内 PII），domestic 恒为 [] ──
  return {
    site,
    domestic: [],
    international: await listByPartition("intl"),
  };
}
