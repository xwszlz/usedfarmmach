/**
 * 三级去重 —— K1 / K2 / K3 + 四清单产出。
 *
 * | 级别 | 键 | 强度 | 命中动作 |
 * |---|---|---|---|
 * | K1 | 归一化主电话（剔 `\D`；多号取字典序最小） | 强 | 自动合并 |
 * | K2 | 公司名标准化 + 地区 | 中 | 出人工确认清单 |
 * | K3 | 邮箱（小写 + 去 `+` 别名） | 弱 | 只提示疑似重复，不自动合并 |
 *
 * > 三级键在 **ETL 离线阶段**执行；`contentHash` 是入库时最后一道保险。
 * > **不要把 K1/K2 塞进 hash 公式。**
 *
 * 本模块只做**检出与建议**，不改写任何行（主产出 CSV 始终保持原始 78 行口径）。
 */

/** 进入去重分析的最小行投影 */
export interface DedupeRow {
  /** 源 xlsx 行号 `#` */
  seq: number;
  /** 公司/商户名原文 */
  company: string;
  /** 地区原文 */
  region: string;
  /** 归一化主电话（K1 键），空串表示无可用号码 */
  phoneKey: string;
  /** 邮箱原文 */
  email: string;
  /** 机型组原文 */
  modelGroup: string;
  /** 覆盖机型原文 */
  model: string;
}

/** 一个去重检出组 */
export interface DedupeGroup {
  /** K1 / K2 / K3 */
  level: "K1" | "K2" | "K3";
  /** 键 */
  key: string;
  /** 组内行号（升序，保证确定性） */
  seqs: number[];
  /** 组内行的公司名（按 seqs 顺序） */
  companies: string[];
  /** 组内行的机型组（按 seqs 顺序） */
  modelGroups: string[];
}

/** 公司名标准化：去空格 / 去括号内容 / 反复剥离通名后缀 */
export function normalizeCompanyName(
  raw: string,
  genericSuffixes: readonly string[],
): string {
  let text = (raw || "").trim();
  // 1) 去所有空白
  text = text.replace(/\s+/g, "");
  // 2) 去括号内容（含中英文括号）
  text = text.replace(/[（(][^（）()]*[)）]/g, "");
  // 3) 反复剥离通名后缀（剥离后可能露出新的后缀，如「…机械设备」→「…机械」→「…」）
  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of genericSuffixes) {
      if (text.length > suffix.length && text.endsWith(suffix)) {
        text = text.slice(0, text.length - suffix.length);
        changed = true;
      }
    }
  }
  return text;
}

/** K2 键：公司名标准化 + 地区 */
export function companyRegionKey(
  raw: string,
  region: string,
  genericSuffixes: readonly string[],
): string {
  return `${normalizeCompanyName(raw, genericSuffixes)}|${(region || "").trim()}`;
}

/** K3 键：邮箱小写 + 去 `+` 别名 */
export function emailKey(raw: string): string {
  const text = (raw || "").trim().toLowerCase();
  if (!text || !text.includes("@")) return "";
  const at = text.lastIndexOf("@");
  const local = text.slice(0, at).split("+")[0];
  return `${local}${text.slice(at)}`;
}

/** 一个邮箱字段可能含多个地址（源数据用 `；` 分隔），全部展开 */
export function emailKeys(raw: string): string[] {
  const out: string[] = [];
  for (const part of (raw || "").split(/[；;,]/)) {
    const key = emailKey(part);
    if (key && !out.includes(key)) out.push(key);
  }
  return out;
}

/** 最长公共子串（确定性；长度 < minLen 返回空串） */
export function longestCommonSubstring(a: string, b: string, minLen: number): string {
  const sa = a || "";
  const sb = b || "";
  if (!sa || !sb) return "";
  let best = "";
  // dp[i][j] = 以 sa[i-1], sb[j-1] 结尾的最长公共子串长度
  const dp: number[][] = [];
  for (let i = 0; i <= sa.length; i += 1) dp.push(new Array<number>(sb.length + 1).fill(0));
  for (let i = 1; i <= sa.length; i += 1) {
    for (let j = 1; j <= sb.length; j += 1) {
      if (sa[i - 1] === sb[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
        if (dp[i][j] > best.length) best = sa.slice(i - dp[i][j], i);
      }
    }
  }
  return best.length >= minLen ? best : "";
}

/**
 * U7 动作判定：
 * - 两户标准化公司名的**最长公共子串（≥2 字）**不含地理词（不出现在任一户的 `地区` 里）
 *   → 判定为**同一主体的不同写法**，建议**合并**；
 * - 否则（共同部分只是地名/城市）→ **保持 2 户，互标关联**。
 *
 * 实测：
 *   「大庆骏洋工程」∩「黑龙江骏洋」= 骏洋（非地名）→ 合并
 *   「新疆银丰现代农业装备」∩「新疆银丰农业装备」= 新疆银丰农业（非地名子串）→ 合并
 *   「庆阳泉顺」∩「庆阳农腾农业装备」= 庆阳（**是地名**，出现在地区「甘肃庆阳」）→ 保持 2 户
 */
export function decideMergeAction(
  a: DedupeRow,
  b: DedupeRow,
  genericSuffixes: readonly string[],
): { action: "合并" | "关联"; evidence: string } {
  const na = normalizeCompanyName(a.company, genericSuffixes);
  const nb = normalizeCompanyName(b.company, genericSuffixes);
  const common = longestCommonSubstring(na, nb, 2);
  if (!common) {
    return { action: "关联", evidence: `标准化名「${na}」/「${nb}」无 ≥2 字公共子串` };
  }
  const regionA = (a.region || "").trim();
  const regionB = (b.region || "").trim();
  const isGeo = (regionA.includes(common) || regionB.includes(common)) && common.length <= 3;
  if (isGeo) {
    return {
      action: "关联",
      evidence: `公共子串「${common}」出现在地区「${regionA}」/「${regionB}」中，判为同城异号，` +
        `建议保持 2 户并互标关联`,
    };
  }
  return {
    action: "合并",
    evidence: `公共子串「${common}」为专属字号（不出现在任一地区字段），判为同一主体异名`,
  };
}

/**
 * 跑三级去重，产出四清单。
 *
 * @param rows             参与分析的行（顺序 = 源表顺序）
 * @param genericSuffixes  公司名通名后缀
 */
export function runDedupe(
  rows: readonly DedupeRow[],
  genericSuffixes: readonly string[],
): {
  groups: DedupeGroup[];
  k1MergeGroups: DedupeGroup[];
  k2ReviewGroups: DedupeGroup[];
  k3SuspectedGroups: DedupeGroup[];
  relatedGroups: DedupeGroup[];
  /** 按 U7 应用后的最终行数（合并组每组减 1） */
  finalRowCount: number;
  /** 建议合并的组数 */
  mergeCount: number;
  /** 建议关联（保持 2 户）的组数 */
  relatedCount: number;
} {
  const groups: DedupeGroup[] = [];

  // ── K1：归一化主电话（强）──
  const byPhone = new Map<string, number[]>();
  for (const row of rows) {
    if (!row.phoneKey) continue;
    const list = byPhone.get(row.phoneKey);
    if (list) list.push(row.seq);
    else byPhone.set(row.phoneKey, [row.seq]);
  }
  // 遍历顺序：按号码字典序（确定性，不依赖 Map 插入顺序以外的因素）
  const phoneKeys = [...byPhone.keys()].sort();
  for (const key of phoneKeys) {
    const seqs = [...(byPhone.get(key) as number[])].sort((x, y) => x - y);
    if (seqs.length < 2) continue;
    groups.push(makeGroup(rows, "K1", key, seqs));
  }

  // ── K2：公司名标准化 + 地区（中）──
  const byCompany = new Map<string, number[]>();
  for (const row of rows) {
    const key = companyRegionKey(row.company, row.region, genericSuffixes);
    if (!key.replace("|", "")) continue;
    const list = byCompany.get(key);
    if (list) list.push(row.seq);
    else byCompany.set(key, [row.seq]);
  }
  const companyKeys = [...byCompany.keys()].sort();
  for (const key of companyKeys) {
    const seqs = [...(byCompany.get(key) as number[])].sort((x, y) => x - y);
    if (seqs.length < 2) continue;
    // 已被 K1 覆盖的同号组不再重复进 K2 清单
    if (groups.some((g) => g.level === "K1" && sameSeqs(g.seqs, seqs))) continue;
    groups.push(makeGroup(rows, "K2", key, seqs));
  }

  // ── K3：邮箱（弱）──
  const byEmail = new Map<string, number[]>();
  for (const row of rows) {
    for (const key of emailKeys(row.email)) {
      const list = byEmail.get(key);
      if (list) {
        if (!list.includes(row.seq)) list.push(row.seq);
      } else {
        byEmail.set(key, [row.seq]);
      }
    }
  }
  const emailKeyList = [...byEmail.keys()].sort();
  for (const key of emailKeyList) {
    const seqs = [...(byEmail.get(key) as number[])].sort((x, y) => x - y);
    if (seqs.length < 2) continue;
    if (groups.some((g) => sameSeqs(g.seqs, seqs))) continue;
    groups.push(makeGroup(rows, "K3", key, seqs));
  }

  // ── 四清单 ──
  const k1MergeGroups = groups.filter((g) => g.level === "K1");
  const k2ReviewGroups = groups.filter((g) => g.level === "K2");
  const k3SuspectedGroups = groups.filter((g) => g.level === "K3");

  // U7：K1 组按「合并 / 关联」二分
  const relatedGroups: DedupeGroup[] = [];
  const mergeGroups: DedupeGroup[] = [];
  for (const group of k1MergeGroups) {
    const a = rows.find((r) => r.seq === group.seqs[0]) as DedupeRow;
    const b = rows.find((r) => r.seq === group.seqs[1]) as DedupeRow;
    const decision = decideMergeAction(a, b, genericSuffixes);
    (group as DedupeGroup & { action?: string; evidence?: string }).action = decision.action;
    (group as DedupeGroup & { action?: string; evidence?: string }).evidence = decision.evidence;
    if (decision.action === "合并") mergeGroups.push(group);
    else relatedGroups.push(group);
  }

  const finalRowCount = rows.length - mergeGroups.length;

  return {
    groups,
    k1MergeGroups,
    k2ReviewGroups,
    k3SuspectedGroups,
    relatedGroups,
    finalRowCount,
    mergeCount: mergeGroups.length,
    relatedCount: relatedGroups.length,
  };
}

function sameSeqs(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function makeGroup(
  rows: readonly DedupeRow[],
  level: "K1" | "K2" | "K3",
  key: string,
  seqs: number[],
): DedupeGroup {
  const companies: string[] = [];
  const modelGroups: string[] = [];
  for (const seq of seqs) {
    const row = rows.find((r) => r.seq === seq);
    companies.push(row ? row.company : "");
    modelGroups.push(row ? row.modelGroup : "");
  }
  return { level, key, seqs, companies, modelGroups };
}
