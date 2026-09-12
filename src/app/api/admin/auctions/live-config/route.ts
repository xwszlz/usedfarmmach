/**
 * 真实拍卖（LIVE）落槌主体配置 API（合规红线 #1：落槌权归合作持牌拍卖机构）
 *
 * GET  /api/admin/auctions/live-config            — 扫描所有 LIVE 场次 + 就绪度判定（?scan=1，默认）
 * GET  /api/admin/auctions/live-config?auctionId= — 单场详情 + 可选拍卖师/机构（供 UI 渲染选择器）
 * POST /api/admin/auctions/live-config            — 配置/回填落槌主体（单场 或 批量 derive），默认 dry-run
 *
 * 站点：仅 .cn（路径C 合规硬开关）。鉴权：admin / super_admin（复用共享守卫）。
 *
 * 为什么存在：Auction.auctionMode 默认 "BLIND"，且发布路由（/api/auctions）从不写入
 *   auctionMode / auctioneerId / licensedAgencyId —— LIVE 模块此前只能靠原始 SQL 驱动。
 *   本端点把「Auction → 拍卖师 → 合作持牌机构」这最后一环补齐，并给出可操作的阻塞原因，
 *   使运营能在不落槌的前提下把历史 LIVE 场次的主体配置修好。
 *
 * ⚠️ 就绪度（canPublish / canHammer / canPass / blockers）只是**预检提示**：
 *   真正的合规裁决以 @/lib/auction-live-guards 的 assertHammerPrivilege / assertPassPrerequisite
 *   为准（它们在落槌 / 流拍时再次校验）。本端点不得被视为放宽那些不变量的入口 ——
 *   写入时强制 licensedAgencyId === auctioneer.licensedAgencyId，使「跨机构主持」分支永不触发。
 *
 * 语义注意：本表登记的是「合作机构」的《拍卖经营批准证书》，不是平台自有资质；
 *   平台自身不持证，全部真实拍卖由合作持牌机构作为拍卖人依法开展。
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertCnOnly, assertAuctionAdmin } from "@/lib/auction-live-guards";

export const dynamic = "force-dynamic";

/** 可发布（开启竞价）的前置状态 —— 与 live/publish/route.ts 的 PRE_OPEN 一致 */
const PRE_OPEN = ["active", "LIVE_DRAFT", "LIVE_OPEN"];
/** 可落槌的前置状态 —— 与 live/hammer/route.ts 的 status 校验（需 LIVE_BIDDING）一致 */
const HAMMER_STATUSES = ["LIVE_BIDDING"];
/** 一旦落槌/结案/流拍，落槌主体即被记录，不可再改（合规留痕不可篡改） */
const LOCKED_STATUSES = ["LIVE_HAMMERED", "LIVE_SETTLED", "LIVE_PASSED"];

interface RelationAgency {
  id: string;
  name: string;
  status: string;
}

interface RowInput {
  id: string;
  bargainNo: string;
  title: string;
  status: string;
  auctionMode: string;
  reservePrice: number | null;
  auctioneerId: string | null;
  licensedAgencyId: string | null;
  hammeredAt: Date | null;
  auctioneer: { id: string; realName: string; licensedAgencyId: string | null } | null;
  auctioneerAgency: RelationAgency | null;
  licensedAgency: RelationAgency | null;
}

interface ReadinessRow {
  id: string;
  bargainNo: string;
  title: string;
  status: string;
  auctionMode: string;
  reservePrice: number | null;
  auctioneerId: string | null;
  auctioneerName: string | null;
  auctioneerAgencyId: string | null;
  auctioneerAgencyName: string | null;
  auctioneerAgencyStatus: string | null;
  licensedAgencyId: string | null;
  licensedAgencyName: string | null;
  canPublish: boolean;
  canHammer: boolean;
  canPass: boolean;
  blockers: string[];
  warnings: string[];
}

/** Prisma 查询结果（含嵌套 include）→ RowInput。 */
function toRowInput(a: {
  id: string;
  bargainNo: string;
  title: string;
  status: string;
  auctionMode: string;
  reservePrice: number | null;
  auctioneerId: string | null;
  licensedAgencyId: string | null;
  hammeredAt: Date | null;
  auctioneer: {
    id: string;
    realName: string;
    licensedAgencyId: string | null;
    licensedAgency: RelationAgency | null;
  } | null;
  licensedAgency: RelationAgency | null;
}): RowInput {
  return {
    id: a.id,
    bargainNo: a.bargainNo,
    title: a.title,
    status: a.status,
    auctionMode: a.auctionMode,
    reservePrice: a.reservePrice,
    auctioneerId: a.auctioneerId,
    licensedAgencyId: a.licensedAgencyId,
    hammeredAt: a.hammeredAt,
    auctioneer: a.auctioneer
      ? { id: a.auctioneer.id, realName: a.auctioneer.realName, licensedAgencyId: a.auctioneer.licensedAgencyId }
      : null,
    auctioneerAgency: a.auctioneer?.licensedAgency
      ? { id: a.auctioneer.licensedAgency.id, name: a.auctioneer.licensedAgency.name, status: a.auctioneer.licensedAgency.status }
      : null,
    licensedAgency: a.licensedAgency
      ? { id: a.licensedAgency.id, name: a.licensedAgency.name, status: a.licensedAgency.status }
      : null,
  };
}

/**
 * 由（可能已叠加变更的）场次 + 关联实体计算就绪度。
 *
 * ⚠️ canPublish / canHammer / canPass 只表示**配置就绪度**，不是「点击必成功」的保证：
 *   - canHammer 仅说明「主体配置 + 状态 LIVE_BIDDING」就绪；实际落槌还要求存在 isWinning 且
 *     amount >= reservePrice 的最高出价（hammer/route.ts L53–55）—— 本函数看不到出价，不作保证。
 *   - canPass 亦要求状态 ∈ HAMMER_STATUSES：hammer/route.ts L46–51 在进入流拍分支前就对
 *     非 LIVE_BIDDING 返回 409，故对 LIVE_DRAFT/active/LIVE_OPEN 报 canPass=true 会是假阳性。
 *   - blockers 只列「落槌主体配置类」硬阻塞；生命周期状态门槛由 canPublish / canHammer 分别表达。
 *   - warnings 列出不阻塞「据实登记主体」、但影响后续动作的提示（如归属机构非 ACTIVE）。
 */
function computeRow(a: RowInput): ReadinessRow {
  const auctioneer = a.auctioneer;
  const auctioneerAgency = a.auctioneerAgency;
  const licensedAgency = a.licensedAgency;
  const isLocked = a.hammeredAt != null || LOCKED_STATUSES.includes(a.status);

  const blockers: string[] = [];
  if (a.auctionMode !== "LIVE") blockers.push(`该拍卖非 LIVE 模式（auctionMode=${a.auctionMode}）`);
  if (!a.auctioneerId) blockers.push("未指派主持拍卖师（auctioneerId）");
  else if (!auctioneer) blockers.push("主持拍卖师档案不存在");
  else if (!auctioneer.licensedAgencyId) blockers.push(`主持拍卖师「${auctioneer.realName}」未登记执业注册所属持牌拍卖机构`);
  else if (!auctioneerAgency) blockers.push("主持拍卖师归属的持牌拍卖机构档案不存在");
  if (!a.licensedAgencyId) blockers.push("未指定落槌主体（licensedAgencyId）");
  else if (auctioneer?.licensedAgencyId && auctioneerAgency && a.licensedAgencyId !== auctioneerAgency.id) {
    blockers.push("主持拍卖师所属机构与该场落槌机构不一致（不得跨机构主持）");
  }

  // F2：机构非 ACTIVE 不再是「配置阻塞」—— 落槌主体是**历史事实**（谁主持了这场），
  //   机构状态是另一道闸（assertHammerPrivilege 在落槌时以 403 拦截）。据实登记不授权落槌；
  //   若在此阻塞，本次要救的「机构已停牌的滞留场次」将永远无法配置/收口，故降级为 warning。
  const warnings: string[] = [];
  if (auctioneerAgency && auctioneerAgency.status !== "ACTIVE") {
    warnings.push(
      `合作持牌拍卖机构「${auctioneerAgency.name}」当前状态为 ${auctioneerAgency.status}：主体已据实登记，但该场次不得落槌（流拍收口仍可进行）`
    );
  }

  const subjectReady =
    auctioneer != null &&
    auctioneer.licensedAgencyId != null &&
    auctioneerAgency != null &&
    auctioneerAgency.status === "ACTIVE" &&
    a.licensedAgencyId != null &&
    a.licensedAgencyId === auctioneerAgency.id;

  const canPublish =
    a.auctionMode === "LIVE" && subjectReady && a.reservePrice != null && PRE_OPEN.includes(a.status);
  const canHammer = subjectReady && HAMMER_STATUSES.includes(a.status) && !isLocked;
  const canPass =
    a.auctioneerId != null && a.licensedAgencyId != null && HAMMER_STATUSES.includes(a.status) && !isLocked;

  return {
    id: a.id,
    bargainNo: a.bargainNo,
    title: a.title,
    status: a.status,
    auctionMode: a.auctionMode,
    reservePrice: a.reservePrice,
    auctioneerId: a.auctioneerId,
    auctioneerName: auctioneer?.realName ?? null,
    auctioneerAgencyId: auctioneer?.licensedAgencyId ?? null,
    auctioneerAgencyName: auctioneerAgency?.name ?? null,
    auctioneerAgencyStatus: auctioneerAgency?.status ?? null,
    licensedAgencyId: a.licensedAgencyId,
    licensedAgencyName: licensedAgency?.name ?? null,
    canPublish,
    canHammer,
    canPass,
    blockers,
    warnings,
  };
}

const AUCTION_INCLUDE = {
  auctioneer: { include: { licensedAgency: true } },
  licensedAgency: true,
} as const;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const cn = assertCnOnly();
  if (!cn.ok) return cn.error;
  const admin = assertAuctionAdmin(req);
  if (!admin.ok) return admin.error;

  const sp = new URL(req.url).searchParams;
  const auctionId = sp.get("auctionId")?.trim() || "";

  try {
    if (auctionId) {
      const auction = await prisma.auction.findUnique({ where: { id: auctionId }, include: AUCTION_INCLUDE });
      if (!auction) {
        return NextResponse.json({ success: false, error: "拍卖不存在" }, { status: 404 });
      }
      const [auctioneers, agencies] = await Promise.all([
        prisma.auctioneer.findMany({
          orderBy: { realName: "asc" },
          select: { id: true, realName: true, licenseNo: true, licensedAgencyId: true },
        }),
        prisma.licensedAuctionAgency.findMany({
          where: { status: "ACTIVE" },
          orderBy: { name: "asc" },
          select: { id: true, name: true, licenseNo: true, status: true },
        }),
      ]);
      return NextResponse.json({
        success: true,
        data: computeRow(toRowInput(auction)),
        candidates: { auctioneers, agencies },
      });
    }

    // 默认 scan：列出所有 LIVE 场次（按状态、创建时间排序），逐行给出就绪度
    const auctions = await prisma.auction.findMany({
      where: { auctionMode: "LIVE" },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      include: AUCTION_INCLUDE,
    });
    return NextResponse.json({ success: true, data: auctions.map((a) => computeRow(toRowInput(a))) });
  } catch (err) {
    console.error("live-config GET error:", err);
    return NextResponse.json({ success: false, error: "加载 LIVE 配置列表失败" }, { status: 500 });
  }
}

const has = (o: Record<string, unknown>, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);
const asTrimmed = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** 单场配置（默认 dry-run）。 */
async function handleSingle(body: Record<string, unknown>, dryRun: boolean): Promise<NextResponse> {
  const auctionId = asTrimmed(body.auctionId);
  if (!auctionId) {
    return NextResponse.json({ success: false, error: "缺少 auctionId" }, { status: 400 });
  }

  const auction = await prisma.auction.findUnique({ where: { id: auctionId }, include: AUCTION_INCLUDE });
  if (!auction) {
    return NextResponse.json({ success: false, error: "拍卖不存在" }, { status: 404 });
  }

  // 锁定：一旦落槌/结案/流拍，落槌主体即为法定记录，不可再改（防篡改合规留痕）
  if (auction.hammeredAt != null || LOCKED_STATUSES.includes(auction.status)) {
    return NextResponse.json(
      {
        success: false,
        error: `该场拍卖已落槌/结案（status=${auction.status}），落槌主体已记入法定记录，不可再变更`,
      },
      { status: 409 }
    );
  }

  // —— 叠加变更，得到最终态 ——
  let nextMode = auction.auctionMode;
  if (has(body, "auctionMode")) {
    const m = asTrimmed(body.auctionMode);
    if (m !== "BLIND" && m !== "LIVE") {
      return NextResponse.json({ success: false, error: "auctionMode 须为 BLIND | LIVE" }, { status: 400 });
    }
    nextMode = m;
  }

  // F7 失败安全：本接口只支持 BLIND / LIVE。若存量行的 auctionMode 为其它值（历史脏数据 / 未来新增模式），
  // 既不能按 LIVE 校验落槌主体不变量，也不应擅自清空 —— 必须直接拒绝，
  // 堵死「既非 BLIND 也非 LIVE 时两个分支都不跑、不校验就写入 licensedAgencyId」的旁路。
  // 注：不要为此加 DB CHECK 约束 —— 本项目用 `prisma db push` 发 schema，它不管理 CHECK 约束，
  //     且可能在下一次 push 时静默丢弃未知约束，会造成虚假安全感。
  if (nextMode !== "LIVE" && nextMode !== "BLIND") {
    return NextResponse.json(
      {
        success: false,
        error: `该拍卖的 auctionMode 为 ${nextMode}，不在受支持范围（BLIND | LIVE），拒绝配置落槌主体；如需修正请在同一请求中显式指定 auctionMode`,
      },
      { status: 409 }
    );
  }

  let nextAuctioneerId = auction.auctioneerId;
  if (has(body, "auctioneerId")) nextAuctioneerId = asTrimmed(body.auctioneerId);

  const licensedProvided = has(body, "licensedAgencyId");
  let nextLicensedAgencyId = auction.licensedAgencyId;
  if (licensedProvided) nextLicensedAgencyId = asTrimmed(body.licensedAgencyId);

  let nextReserve = auction.reservePrice;
  if (has(body, "reservePrice")) {
    const rp = body.reservePrice;
    if (rp === null) nextReserve = null;
    else if (typeof rp === "number" && Number.isFinite(rp) && rp >= 0) nextReserve = rp;
    else return NextResponse.json({ success: false, error: "reservePrice 须为非负数字（或 null）" }, { status: 400 });
  }

  // BLIND 与落槌主体互斥：BLIND 强制清空，且同请求不得显式给出 licensedAgencyId
  if (nextMode === "BLIND") {
    if (licensedProvided && nextLicensedAgencyId) {
      return NextResponse.json(
        { success: false, error: "auctionMode=BLIND 时不得指定落槌主体（licensedAgencyId），二者互相矛盾" },
        { status: 400 }
      );
    }
    nextLicensedAgencyId = null;
  }

  // 主持拍卖师（最终值）—— 供自动派生与 LIVE 校验共用
  const host = nextAuctioneerId
    ? await prisma.auctioneer.findUnique({
        where: { id: nextAuctioneerId },
        select: { id: true, realName: true, licensedAgencyId: true },
      })
    : null;

  // 自动派生（backfill 的核心）：LIVE 且已指派拍卖师、未显式给出 licensedAgencyId → 取拍卖师归属机构
  let derivedLicensedAgencyId: string | null = null;
  if (nextMode === "LIVE" && nextAuctioneerId && !licensedProvided && host?.licensedAgencyId) {
    nextLicensedAgencyId = host.licensedAgencyId;
    derivedLicensedAgencyId = host.licensedAgencyId;
  }

  // F2：机构非 ACTIVE 不阻止「据实登记落槌主体」，仅降级为 warning（见下）。
  let agencyNotActive = false;
  let agencyWarning: string | null = null;

  if (nextMode === "LIVE") {
    if (!nextAuctioneerId) {
      return NextResponse.json({ success: false, error: "LIVE 模式必须指派主持拍卖师（auctioneerId）" }, { status: 409 });
    }
    if (!host) {
      return NextResponse.json({ success: false, error: "主持拍卖师档案不存在" }, { status: 409 });
    }
    if (!host.licensedAgencyId) {
      return NextResponse.json(
        { success: false, error: `主持拍卖师「${host.realName}」未登记执业注册所属持牌拍卖机构，不得配置为 LIVE 落槌主体` },
        { status: 409 }
      );
    }
    const agency = await prisma.licensedAuctionAgency.findUnique({
      where: { id: host.licensedAgencyId },
      select: { id: true, name: true, status: true },
    });
    if (!agency) {
      return NextResponse.json({ success: false, error: "主持拍卖师归属的持牌拍卖机构档案不存在" }, { status: 409 });
    }
    // F2：机构非 ACTIVE 不再 409 —— 主体是历史事实，机构状态由 assertHammerPrivilege 在落槌时单独把关；
    //   若在此拒绝，机构已停牌/吊销的滞留场次将永远无法配置与收口（流拍同样要求主体已登记）。
    if (agency.status !== "ACTIVE") {
      agencyNotActive = true;
      agencyWarning = `合作持牌拍卖机构「${agency.name}」当前状态为 ${agency.status}：主体已据实登记，但该场次不得落槌（流拍收口仍可进行）`;
    }
    if (!nextLicensedAgencyId) {
      return NextResponse.json({ success: false, error: "未指定落槌主体（licensedAgencyId）" }, { status: 409 });
    }
    if (nextLicensedAgencyId !== host.licensedAgencyId) {
      return NextResponse.json(
        { success: false, error: "主持拍卖师所属机构与该场落槌机构不一致，不得跨机构主持" },
        { status: 409 }
      );
    }
  }

  const beforeRow = computeRow(toRowInput(auction));

  const wouldChange: Record<string, unknown> = {};
  if (nextMode !== auction.auctionMode) wouldChange.auctionMode = nextMode;
  if (nextAuctioneerId !== auction.auctioneerId) wouldChange.auctioneerId = nextAuctioneerId;
  if (nextLicensedAgencyId !== auction.licensedAgencyId) wouldChange.licensedAgencyId = nextLicensedAgencyId;
  if (nextReserve !== auction.reservePrice) wouldChange.reservePrice = nextReserve;
  if (Object.keys(wouldChange).length === 0) wouldChange.__noop = true;

  const finalAuction = {
    id: auction.id,
    bargainNo: auction.bargainNo,
    title: auction.title,
    status: auction.status,
    auctionMode: nextMode,
    reservePrice: nextReserve,
    auctioneerId: nextAuctioneerId,
    licensedAgencyId: nextLicensedAgencyId,
    hammeredAt: auction.hammeredAt,
    auctioneer: null,
    licensedAgency: null,
  };

  // 最终态用的关联（供 dry-run 的就绪度）
  const finalHost = host
    ? { id: host.id, realName: host.realName, licensedAgencyId: host.licensedAgencyId }
    : null;
  const finalHostAgency =
    nextMode === "LIVE" && host?.licensedAgencyId
      ? await prisma.licensedAuctionAgency.findUnique({
          where: { id: host.licensedAgencyId },
          select: { id: true, name: true, status: true },
        })
      : null;
  const finalLicensedAgency = nextLicensedAgencyId
    ? await prisma.licensedAuctionAgency.findUnique({
        where: { id: nextLicensedAgencyId },
        select: { id: true, name: true, status: true },
      })
    : null;

  const afterRow = computeRow({
    ...finalAuction,
    auctioneer: finalHost,
    auctioneerAgency: finalHostAgency
      ? { id: finalHostAgency.id, name: finalHostAgency.name, status: finalHostAgency.status }
      : null,
    licensedAgency: finalLicensedAgency
      ? { id: finalLicensedAgency.id, name: finalLicensedAgency.name, status: finalLicensedAgency.status }
      : null,
  });

  if (dryRun) {
    return NextResponse.json({
      success: true,
      dryRun: true,
      auction: afterRow,
      before: beforeRow,
      wouldChange,
      derivedLicensedAgencyId,
      agencyNotActive,
      warning: agencyWarning,
    });
  }

  try {
    // F8 乐观并发：以「读取到的原值」为条件的单条 UPDATE，消除单场写入的 TOCTOU 窗口。
    //   以字段原值（而非 updatedAt）比对，避免时间戳精度往返误差。
    //   注：Prisma 的 where: { licensedAgencyId: null } 编译为 IS NULL，故当前落槌主体为空时也能正确命中。
    const res = await prisma.auction.updateMany({
      where: {
        id: auctionId,
        auctionMode: auction.auctionMode,
        auctioneerId: auction.auctioneerId,
        licensedAgencyId: auction.licensedAgencyId,
        reservePrice: auction.reservePrice,
      },
      data: {
        auctionMode: nextMode,
        auctioneerId: nextAuctioneerId,
        licensedAgencyId: nextLicensedAgencyId,
        reservePrice: nextReserve,
        // TODO(路径C): 落槌主体变更应留痕（当前 Auction 无审计字段）
      },
    });
    if (res.count === 0) {
      return NextResponse.json(
        { success: false, error: "该场拍卖已被并发修改，请刷新后重试（未写入）" },
        { status: 409 }
      );
    }
  } catch (err) {
    console.error("live-config write error:", err);
    return NextResponse.json({ success: false, error: "落槌主体配置写入失败" }, { status: 500 });
  }

  const persisted = await prisma.auction.findUnique({ where: { id: auctionId }, include: AUCTION_INCLUDE });
  return NextResponse.json({
    success: true,
    dryRun: false,
    auction: persisted ? computeRow(toRowInput(persisted)) : afterRow,
    before: beforeRow,
    wouldChange,
    derivedLicensedAgencyId,
    agencyNotActive,
    warning: agencyWarning,
  });
}

interface BackfillEntry {
  id: string;
  bargainNo: string | null;
  title: string | null;
  action: "SET" | "SKIP" | "BLOCKED" | "FAILED";
  reason?: string;
  from: string | null;
  to: string | null;
  agencyNotActive?: boolean;
  warning?: string;
}

/** 逐行判定某场次能否回填 licensedAgencyId（不改库）。 */
async function classify(a: {
  id: string;
  bargainNo: string;
  title: string;
  status: string;
  auctionMode: string;
  auctioneerId: string | null;
  licensedAgencyId: string | null;
  hammeredAt: Date | null;
}): Promise<BackfillEntry> {
  const base: Pick<BackfillEntry, "id" | "bargainNo" | "title" | "from" | "to"> = {
    id: a.id,
    bargainNo: a.bargainNo,
    title: a.title,
    from: a.licensedAgencyId,
    to: a.licensedAgencyId,
  };
  if (a.auctionMode !== "LIVE") {
    return { ...base, action: "BLOCKED", reason: `该拍卖非 LIVE 模式（auctionMode=${a.auctionMode}）` };
  }
  if (a.licensedAgencyId != null) {
    return { ...base, action: "SKIP", reason: "已指定落槌主体" };
  }
  if (a.hammeredAt != null || LOCKED_STATUSES.includes(a.status)) {
    return { ...base, action: "BLOCKED", reason: `已落槌/结案（status=${a.status}），落槌主体不可变更` };
  }
  if (!a.auctioneerId) {
    return { ...base, action: "BLOCKED", reason: "未指派主持拍卖师（auctioneerId）" };
  }
  const host = await prisma.auctioneer.findUnique({
    where: { id: a.auctioneerId },
    select: { realName: true, licensedAgencyId: true },
  });
  if (!host) {
    return { ...base, action: "BLOCKED", reason: "主持拍卖师档案不存在" };
  }
  if (!host.licensedAgencyId) {
    return { ...base, action: "BLOCKED", reason: `主持拍卖师「${host.realName}」未登记执业注册所属持牌拍卖机构` };
  }
  const agency = await prisma.licensedAuctionAgency.findUnique({
    where: { id: host.licensedAgencyId },
    select: { id: true, name: true, status: true },
  });
  if (!agency) {
    return { ...base, action: "BLOCKED", reason: "主持拍卖师归属的持牌拍卖机构档案不存在" };
  }
  // F2：非 ACTIVE 仍应写入 —— 主体是历史事实；机构状态由落槌时的 assertHammerPrivilege 单独把关。
  if (agency.status !== "ACTIVE") {
    return {
      ...base,
      action: "SET",
      to: agency.id,
      agencyNotActive: true,
      warning: `合作持牌拍卖机构「${agency.name}」当前状态为 ${agency.status}：主体已据实登记，但该场次不得落槌（流拍收口仍可进行）`,
    };
  }
  return { ...base, action: "SET", to: agency.id };
}

/** 批量回填（默认 dry-run）。 */
async function handleBackfill(body: Record<string, unknown>, dryRun: boolean): Promise<NextResponse> {
  const rawIds = Array.isArray(body.auctionIds) ? body.auctionIds : null;
  const explicitIds = rawIds
    ? rawIds.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim())
    : null;

  const targets = explicitIds
    ? await prisma.auction.findMany({
        where: { id: { in: explicitIds } },
        orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      })
    : await prisma.auction.findMany({
        where: { auctionMode: "LIVE", licensedAgencyId: null },
        orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      });

  // F6：显式 auctionIds 中未命中任何行的（多为拼写错误）显式回报，避免静默丢弃
  const foundIds = new Set(targets.map((a) => a.id));
  const notFound = explicitIds ? explicitIds.filter((id) => !foundIds.has(id)) : [];

  const rows: BackfillEntry[] = [];
  for (const a of targets) {
    rows.push(await classify(a));
  }

  let written = 0;
  if (!dryRun) {
    for (const entry of rows) {
      if (entry.action !== "SET" || !entry.to) continue;
      try {
        // 原子并发保护：单条条件 UPDATE（无 read-then-write 窗口，消除 TOCTOU）。
        // LOCKED_STATUSES 无法写进 where；hammeredAt:null + licensedAgencyId:null 已覆盖关键并发场景，
        // 且外层 classify() 已排除锁定行。res.count===0 即视为被并发抢占/锁定。
        const res = await prisma.auction.updateMany({
          where: { id: entry.id, licensedAgencyId: null, hammeredAt: null },
          // TODO(路径C): 落槌主体变更应留痕（当前 Auction 无审计字段）
          data: { licensedAgencyId: entry.to },
        });
        if (res.count === 0) {
          entry.action = "BLOCKED";
          entry.reason = "写前复查发现已被并发修改/锁定，跳过";
          continue;
        }
        written += 1;
      } catch (err) {
        console.error("live-config backfill write error:", err);
        entry.action = "FAILED";
        entry.reason = "写入失败";
      }
    }
  }

  const totals = {
    fixable: rows.filter((r) => r.action === "SET").length,
    skipped: rows.filter((r) => r.action === "SKIP").length,
    blocked: rows.filter((r) => r.action === "BLOCKED").length,
    failed: rows.filter((r) => r.action === "FAILED").length,
  };

  return NextResponse.json({
    success: true,
    dryRun,
    mode: "backfill",
    rows,
    totals,
    notFound,
    written: dryRun ? 0 : written,
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const cn = assertCnOnly();
  if (!cn.ok) return cn.error;
  const admin = assertAuctionAdmin(req);
  if (!admin.ok) return admin.error;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "请求体解析失败" }, { status: 400 });
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return NextResponse.json({ success: false, error: "请求体解析失败" }, { status: 400 });
  }
  const body = raw as Record<string, unknown>;
  // 失败安全：仅当显式 dryRun === false 才真正写库
  const dryRun = body.dryRun !== false;

  try {
    if (body.derive === true) {
      return await handleBackfill(body, dryRun);
    }
    return await handleSingle(body, dryRun);
  } catch (err) {
    console.error("live-config POST error:", err);
    return NextResponse.json({ success: false, error: "落槌主体配置处理失败" }, { status: 500 });
  }
}
