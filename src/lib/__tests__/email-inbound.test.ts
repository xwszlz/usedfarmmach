/**
 * 收信转发纯逻辑单测（无网络、无 DB）
 *
 * 覆盖最容易出错的三块：
 *   1. 地址解析/自有域名判定（回路保险的最后一道闸）
 *   2. 按 to 分流（catch-all 会收到各种垃圾地址，误转发会烧光每日额度）
 *   3. Svix 签名验签（验签写错等于把 webhook 裸奔，任何人都能让服务器发信）
 */
import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";
import {
  buildForwardBanner,
  buildForwardSubject,
  buildPlainFallback,
  buildRoutingMap,
  buildWecomNotice,
  escapeHtml,
  extractAddress,
  isOwnAddress,
  resolveGroupTarget,
  verifySvixSignature,
} from "@/lib/email/inbound";

const SECRET = "whsec_" + Buffer.from("shen-diao-test-signing-key-32byte").toString("base64");

/** 独立实现一遍签名，用来验证路由侧的解析与比对逻辑 */
function sign(payload: string, id: string, ts: string, secret = SECRET): string {
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const digest = createHmac("sha256", key)
    .update(`${id}.${ts}.${payload}`)
    .digest("base64");
  return `v1,${digest}`;
}

describe("extractAddress", () => {
  it("解析带显示名的地址", () => {
    expect(extractAddress("Ada Lovelace <Ada@Example.COM>")).toBe("ada@example.com");
  });
  it("解析裸地址并小写化", () => {
    expect(extractAddress("  SALES@usedfarmmach.com ")).toBe("sales@usedfarmmach.com");
  });
  it("非法输入返回 null", () => {
    expect(extractAddress("not-an-email")).toBeNull();
    expect(extractAddress(null)).toBeNull();
    expect(extractAddress("")).toBeNull();
  });
});

describe("isOwnAddress（回路保险）", () => {
  it("自有域名命中", () => {
    expect(isOwnAddress("dane@shendiaotech.cn")).toBe(true);
    expect(isOwnAddress("support@usedfarmmach.com")).toBe(true);
    expect(isOwnAddress("x@usedfarmmach.cn")).toBe(true);
  });
  it("自有域名的子域也命中", () => {
    expect(isOwnAddress("bot@mail.usedfarmmach.com")).toBe(true);
  });
  it("外部域名不命中", () => {
    expect(isOwnAddress("buyer@163.com")).toBe(false);
    expect(isOwnAddress("buyer@notusedfarmmach.com")).toBe(false);
  });
  it("空值安全", () => {
    expect(isOwnAddress(null)).toBe(false);
    expect(isOwnAddress("garbage")).toBe(false);
  });
});

describe("buildRoutingMap / resolveGroupTarget", () => {
  const map = buildRoutingMap({});

  it("默认三个收件地址各自对应同名企业邮群组", () => {
    expect(map["support@usedfarmmach.com"]).toBe("support@shendiaotech.cn");
    expect(map["sales@usedfarmmach.com"]).toBe("sales@shendiaotech.cn");
    expect(map["marketing@usedfarmmach.com"]).toBe("marketing@shendiaotech.cn");
  });

  it("env 可覆盖群组地址（群组账号在腾讯企业邮设定后不可改，必须留后门）", () => {
    const custom = buildRoutingMap({ INBOUND_GROUP_SALES: "Sales-Group@shendiaotech.cn" });
    expect(custom["sales@usedfarmmach.com"]).toBe("sales-group@shendiaotech.cn");
  });

  it("命中 sales 时返回正确的 inbox/group 对", () => {
    expect(resolveGroupTarget(["Sales@usedfarmmach.com"], map)).toEqual({
      inboxAddress: "sales@usedfarmmach.com",
      groupAddress: "sales@shendiaotech.cn",
    });
  });

  it("多收件人时取第一个命中的", () => {
    expect(
      resolveGroupTarget(["random@usedfarmmach.com", "marketing@usedfarmmach.com"], map)
    ).toEqual({
      inboxAddress: "marketing@usedfarmmach.com",
      groupAddress: "marketing@shendiaotech.cn",
    });
  });

  it("catch-all 收到的陌生地址一律不转发", () => {
    expect(resolveGroupTarget(["whatever@usedfarmmach.com"], map)).toBeNull();
    expect(resolveGroupTarget([], map)).toBeNull();
    expect(resolveGroupTarget(undefined, map)).toBeNull();
  });
});

describe("verifySvixSignature", () => {
  const payload = JSON.stringify({ type: "email.received", data: { email_id: "em_1" } });
  const now = 1_800_000_000;

  it("正确签名通过", () => {
    const id = "msg_1";
    const ts = String(now);
    expect(
      verifySvixSignature({
        payload,
        headers: { id, timestamp: ts, signature: sign(payload, id, ts) },
        secret: SECRET,
        nowSeconds: now,
      })
    ).toEqual({ ok: true });
  });

  it("多签名头里任一匹配即通过", () => {
    const id = "msg_2";
    const ts = String(now);
    const signature = `v1,deadbeef ${sign(payload, id, ts)}`;
    expect(
      verifySvixSignature({
        payload,
        headers: { id, timestamp: ts, signature },
        secret: SECRET,
        nowSeconds: now,
      }).ok
    ).toBe(true);
  });

  it("签名不匹配被拒", () => {
    const id = "msg_3";
    const ts = String(now);
    const res = verifySvixSignature({
      payload: payload + " ",
      headers: { id, timestamp: ts, signature: sign(payload, id, ts) },
      secret: SECRET,
      nowSeconds: now,
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("signature mismatch");
  });

  it("换密钥被拒", () => {
    const id = "msg_4";
    const ts = String(now);
    const otherKey = "whsec_" + Buffer.from("another-key-another-key-another!").toString("base64");
    const res = verifySvixSignature({
      payload,
      headers: { id, timestamp: ts, signature: sign(payload, id, ts, otherKey) },
      secret: SECRET,
      nowSeconds: now,
    });
    expect(res.ok).toBe(false);
  });

  it("时间戳超容差被拒（防重放）", () => {
    const id = "msg_5";
    const ts = String(now - 3600);
    const res = verifySvixSignature({
      payload,
      headers: { id, timestamp: ts, signature: sign(payload, id, ts) },
      secret: SECRET,
      nowSeconds: now,
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("timestamp outside tolerance");
  });

  it("缺头被拒", () => {
    expect(
      verifySvixSignature({
        payload,
        headers: { id: null, timestamp: null, signature: null },
        secret: SECRET,
        nowSeconds: now,
      }).reason
    ).toBe("missing svix headers");
  });

  it("缺密钥被拒", () => {
    const id = "msg_6";
    const ts = String(now);
    expect(
      verifySvixSignature({
        payload,
        headers: { id, timestamp: ts, signature: sign(payload, id, ts) },
        secret: "",
        nowSeconds: now,
      }).ok
    ).toBe(false);
  });
});

describe("主题与正文构造", () => {
  it("按收件地址打不同中文前缀", () => {
    expect(buildForwardSubject("Need FX38 quote", "sales@usedfarmmach.com")).toBe(
      "[销售来信] Need FX38 quote"
    );
    expect(buildForwardSubject("", "support@usedfarmmach.com")).toBe("[客户来信] (无主题)");
    expect(buildForwardSubject("Join directory", "marketing@usedfarmmach.com")).toBe(
      "[营销来信] Join directory"
    );
  });

  it("横幅里转义客户可控字段，防注入", () => {
    const html = buildForwardBanner({
      originalFrom: '<script>alert(1)</script>@x.com',
      originalTo: ["sales@usedfarmmach.com"],
      receivedAt: "2026-11-20 14:00:00 UTC",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("sales@usedfarmmach.com");
  });

  it("附件被跳过时横幅有说明", () => {
    const html = buildForwardBanner({
      originalFrom: "a@b.com",
      originalTo: ["sales@usedfarmmach.com"],
      receivedAt: "2026-11-20 14:00:00 UTC",
      attachmentNote: "0 个已随信附上，另有 1 个未能转发：图纸.pdf（超过 10MB）",
    });
    expect(html).toContain("图纸.pdf");
  });

  it("纯文本兜底保留原正文", () => {
    const text = buildPlainFallback({
      originalFrom: "a@b.com",
      originalTo: ["sales@usedfarmmach.com"],
      text: "请问 970 还在吗？",
    });
    expect(text).toContain("请问 970 还在吗？");
    expect(text).toContain("原发件人：a@b.com");
  });

  it("群通知含关键信息且标题固定", () => {
    const notice = buildWecomNotice({
      inboxAddress: "sales@usedfarmmach.com",
      groupAddress: "sales@shendiaotech.cn",
      originalFrom: "buyer@163.com",
      subject: "询价".repeat(200),
      attachmentCount: 2,
    });
    expect(notice.title).toBe("📬 新客户来信");
    expect(notice.lines.join("\n")).toContain("sales@shendiaotech.cn");
    expect(notice.lines.join("\n")).toContain("buyer@163.com");
    // 主题截断到 80 字符，避免超出群机器人 markdown 上限
    expect(notice.lines.join("\n").length).toBeLessThan(600);
    expect(notice.lines.some((l) => l.includes("附件：2 个"))).toBe(true);
  });

  it("escapeHtml 覆盖五个字符", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });
});
