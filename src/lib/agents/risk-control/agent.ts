import { prisma } from "@/lib/db";
import type { RiskControlInput, RiskControlResult, RiskControlStatus, RiskFinding } from "./types";

export const AGENT_NAME = "risk-control";
export const AGENT_VERSION = "0.1.0";

// Suspicious patterns in product descriptions
const SUSPICIOUS_KEYWORDS = [
  "全新", "brand new", "0小时", "0 hours", "未使用", "never used",
  "最低价", "lowest price", "最便宜", "cheapest",
  "仿冒", "fake", "山寨", "copy",
];

const REQUIRED_FIELDS = ["brandId", "categoryId", "modelName", "year", "priceCny", "location"] as const;

export class RiskControlAgent {
  private logs: string[] = [];
  private log(msg: string) { this.logs.push(`[${new Date().toISOString()}] ${msg}`); console.log(this.logs[this.logs.length-1]); }

  async run(input: RiskControlInput): Promise<RiskControlResult> {
    const startedAt = new Date();
    this.logs = [];
    this.log(`Agent #9 risk-control@${AGENT_VERSION} started (check=${input.checkType})`);

    let findings: RiskFinding[] = [];

    switch (input.checkType) {
      case "listing_scan":
        findings = await this.scanListings(input);
        break;
      case "user_behavior":
        findings = await this.scanUserBehavior(input);
        break;
      case "pii_audit":
        findings = await this.auditPII(input);
        break;
      case "compliance_checklist":
        findings = this.complianceChecklist();
        break;
    }

    const summary = {
      critical: findings.filter((f) => f.severity === "critical").length,
      warning: findings.filter((f) => f.severity === "warning").length,
      info: findings.filter((f) => f.severity === "info").length,
    };

    this.log(`Total findings: ${findings.length} (critical=${summary.critical} warning=${summary.warning} info=${summary.info})`);

    const finishedAt = new Date();
    return {
      ok: true, startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      checkType: input.checkType, totalFindings: findings.length, findings, summary, log: this.logs,
    };
  }

  private async scanListings(input: RiskControlInput): Promise<RiskFinding[]> {
    const findings: RiskFinding[] = [];
    const where = input.targetProductId ? { id: input.targetProductId } : { status: "active" };
    const products = await prisma.product.findMany({
      where,
      include: { brand: true },
      take: input.limit,
    });
    this.log(`Scanning ${products.length} product listings`);

    for (const p of products) {
      // Check missing required fields
      for (const field of REQUIRED_FIELDS) {
        const val = p[field as keyof typeof p];
        if (val === null || val === undefined || val === "") {
          findings.push({
            severity: "warning",
            category: "missing_data",
            target: `${p.brand?.nameZh || "unknown"} ${p.modelName} (${p.id})`,
            description: `缺少必填字段: ${field}`,
            recommendation: `补充${field}信息，提高产品可信度`,
          });
        }
      }

      // Check suspicious keywords
      const descText = [p.descriptionZh, p.descriptionEn].filter(Boolean).join(" ").toLowerCase();
      for (const kw of SUSPICIOUS_KEYWORDS) {
        if (descText.includes(kw.toLowerCase())) {
          findings.push({
            severity: "warning",
            category: "suspicious_content",
            target: `${p.brand?.nameZh || "unknown"} ${p.modelName} (${p.id})`,
            description: `描述中包含可疑关键词: "${kw}"`,
            recommendation: "核实产品实际状况，避免虚假宣传",
          });
          break;
        }
      }

      // Check price anomalies
      if (p.priceCny > 0 && p.priceCny < 1000) {
        findings.push({
          severity: "warning",
          category: "price_anomaly",
          target: `${p.brand?.nameZh || "unknown"} ${p.modelName} (${p.id})`,
          description: `价格异常低: ¥${p.priceCny}（低于1000元）`,
          recommendation: "核实价格是否正确，防止欺诈",
        });
      }
      if (p.priceCny > 5000000) {
        findings.push({
          severity: "info",
          category: "price_anomaly",
          target: `${p.brand?.nameZh || "unknown"} ${p.modelName} (${p.id})`,
          description: `高价商品: ¥${p.priceCny}（超500万）`,
          recommendation: "大额交易建议线下看货+担保支付",
        });
      }

      // Check year validity
      if (p.year < 1950 || p.year > new Date().getFullYear() + 1) {
        findings.push({
          severity: "critical",
          category: "invalid_data",
          target: `${p.brand?.nameZh || "unknown"} ${p.modelName} (${p.id})`,
          description: `年份异常: ${p.year}`,
          recommendation: "修正年份信息",
        });
      }
    }
    return findings;
  }

  private async scanUserBehavior(input: RiskControlInput): Promise<RiskFinding[]> {
    const findings: RiskFinding[] = [];
    const where = input.targetUserId ? { id: input.targetUserId } : {};
    const users = await prisma.user.findMany({ where, take: input.limit });
    this.log(`Scanning ${users.length} users`);

    for (const u of users) {
      // Check users with many products but no verification
      const productCount = await prisma.product.count({ where: { sellerId: u.id } });
      if (productCount > 20 && !u.emailVerified) {
        findings.push({
          severity: "warning",
          category: "bulk_listing",
          target: `User ${u.username || u.id}`,
          description: `发布了${productCount}个产品但邮箱未验证`,
          recommendation: "建议验证邮箱后再批量发布",
        });
      }

      // Check admin accounts without 2FA
      if ((u.role === "admin" || u.role === "super_admin") && !u.emailVerified) {
        findings.push({
          severity: "critical",
          category: "admin_security",
          target: `Admin ${u.username || u.id}`,
          description: "管理员账号邮箱未验证",
          recommendation: "立即验证管理员邮箱",
        });
      }
    }
    return findings;
  }

  private async auditPII(input: RiskControlInput): Promise<RiskFinding[]> {
    const findings: RiskFinding[] = [];
    this.log("Auditing PII exposure");

    // Check if user emails are stored in plaintext (they are — known issue)
    const usersWithEmail = await prisma.user.count({ where: { NOT: { email: null } } });
    findings.push({
      severity: "critical",
      category: "pii_storage",
      target: "User.email field",
      description: `${usersWithEmail}个用户邮箱明文存储（无AES-256加密）`,
      recommendation: "实施邮箱方案阶段2的字段级加密",
    });

    // Check product descriptions for embedded contact info
    const products = await prisma.product.findMany({
      where: { status: "active" },
      select: { id: true, descriptionZh: true, descriptionEn: true, modelName: true },
      take: input.limit,
    });
    const phoneRegex = /1[3-9]\d{9}/;
    const emailRegex = /[\w.-]+@[\w.-]+\.\w+/;
    for (const p of products) {
      const text = `${p.descriptionZh || ""} ${p.descriptionEn || ""}`;
      if (phoneRegex.test(text)) {
        findings.push({
          severity: "warning",
          category: "pii_leak",
          target: `Product ${p.modelName} (${p.id})`,
          description: "描述中包含手机号码",
          recommendation: "移除描述中的联系方式，引导用户使用平台内置通讯",
        });
      }
      if (emailRegex.test(text)) {
        findings.push({
          severity: "warning",
          category: "pii_leak",
          target: `Product ${p.modelName} (${p.id})`,
          description: "描述中包含邮箱地址",
          recommendation: "移除描述中的邮箱，使用平台询价系统",
        });
      }
    }
    return findings;
  }

  private complianceChecklist(): RiskFinding[] {
    return [
      { severity: "critical", category: "icp_filing", target: "主站 usedfarmmach.com", description: "主站在Vercel境外服务器，国内未ICP备案", recommendation: "尽快完成ICP备案（1-3个月周期）" },
      { severity: "critical", category: "data_export", target: "用户数据", description: "用户PII数据存储在Neon(Vercel)境外，未履行数据出境合规义务", recommendation: "更新隐私政策数据出境章节+单独同意+PIPIA评估" },
      { severity: "critical", category: "privacy_policy", target: "全站", description: "隐私政策+用户协议尚未上线", recommendation: "已完成阶段0前端补全页，需法律审查后发布" },
      { severity: "warning", category: "icp_license", target: "增值服务收费", description: "会员费/AI估值费属经营性互联网信息服务，需ICP许可证", recommendation: "ICP备案后申请ICP许可证（3-6个月）" },
      { severity: "warning", category: "edi_license", target: "多商家入驻", description: "平台多商家入驻模式需EDI许可证", recommendation: "确认河北省豁免政策后申请EDI许可证" },
      { severity: "warning", category: "auction_risk", target: "MF3404询价", description: "满3人启动已回退，存在被认定为拍卖的法律风险", recommendation: "考虑改回1人启动或咨询律师确认非拍卖属性" },
      { severity: "info", category: "algorithm_filing", target: "AI功能", description: "AI估值/识别功能可能需要算法备案", recommendation: "评估是否触发《互联网信息服务算法推荐管理规定》" },
      { severity: "info", category: "level_protection", target: "系统安全", description: "等保定级未完成", recommendation: "完成等保2.0定级备案（二级或三级）" },
    ];
  }

  async getStatus(): Promise<RiskControlStatus> {
    return {
      ok: true, agentName: AGENT_NAME, version: AGENT_VERSION,
      checkTypes: ["listing_scan", "user_behavior", "pii_audit", "compliance_checklist"],
    };
  }
}

export const riskControlAgent = new RiskControlAgent();
