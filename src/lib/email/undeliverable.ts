/**
 * 不可投递收件域清单 —— 发信链路最后一道拦截（2026-11-27）
 *
 * ── 为什么需要这个东西 ──
 * 现有邮箱校验（`z.string().email()` / `EMAIL_RE`）只判**语法**，不判**域名能不能收信**。
 * 一个「格式合法但域名没有 MX 记录」的地址可以顺利通过注册、写进 `User.email`，
 * 然后每封发往它的邮件都被对方 MTA 立刻退回 ——
 * 用户以为注册好了，我们只在 support 邮箱的 PostMaster 里看到一堆退信，
 * 中间没有任何一处代码知道「这封信根本没出去」。
 *
 * ── 实测证据（2026-11-27，阿里云 DoH dns.alidns.com/resolve） ──
 * | 域名 | MX | 结论 |
 * |---|---|---|
 * | usedfarmmach.com | receive-apne1.forge.rmta.net（Resend 收信） | ✅ 可收 |
 * | shendiaotech.cn | mxbiz1.qq.com / mxbiz2.qq.com（腾讯企业邮） | ✅ 可收 |
 * | **usedfarmmach.cn** | **无（Host not found）** | ❌ 死信箱 |
 *
 * 腾讯企业邮退信原文：
 *   `收件人 (support@usedfarmmach.cn) 所属域名不存在，邮件无法送达。
 *    Name service error for name=usedfarmmach.cn type=MX: Host not found`
 *
 * ── 为什么不是「赶紧给 usedfarmmach.cn 配个 MX」 ──
 * 腾讯企业邮**免费版只允许绑定 1 个自有域名**，名额已被 shendiaotech.cn 占用
 * （这也是 2026-11-21 把 .cn 客服邮箱从 support@usedfarmmach.cn 改成
 * support@shendiaotech.cn 的原因）。要不要为它升级付费版是商业决策，
 * 在决策落地之前，代码必须先把这条漏水的管子堵上。
 *
 * ── 为什么「拒绝注册」而不是「允许注册但提示可能收不到」 ──
 * 邮箱是账号找回密码、接收询盘通知的唯一通道。允许一个注定收不到信的地址注册，
 * 等于批量制造「永远无法自助找回密码」的僵尸账号 —— 后续只能靠人工改库来救，
 * 成本远高于注册时拦住。
 *
 * ⚠️ 将来若真给 usedfarmmach.cn 配上 MX（升级腾讯企业邮付费版 / 换服务商 /
 *    用阿里云邮箱免费版），**必须同步删掉下面这一条**，否则合法地址会被误拦，
 *    且表现为「注册页报错说邮箱不可用」这种极难联想的故障。
 *    判断方法：`curl 'https://dns.alidns.com/resolve?name=usedfarmmach.cn&type=MX'`
 *    返回 Answer 非空即可解禁。
 */

/** 已知无法接收邮件的收件域（子域一并拦截：`a.b@x.usedfarmmach.cn` 同样退信） */
export const UNDELIVERABLE_DOMAINS: readonly string[] = ["usedfarmmach.cn"];

/** 面向用户的拒绝提示（会被 zod refine 直接显示在注册/资料页上） */
export const UNDELIVERABLE_EMAIL_MESSAGE =
  "该邮箱域名无法接收邮件，请更换其他邮箱地址";

/** `"A <a@B.com>"` / `"a@B.com"` → `b.com`（小写）；非法返回 null */
export function emailDomainOf(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const angled = raw.match(/<([^>]+)>/);
  const value = (angled ? angled[1] : raw).trim().toLowerCase();
  const at = value.lastIndexOf("@");
  if (at < 0 || at === value.length - 1) return null;
  const domain = value.slice(at + 1);
  // 至少要有一个点，排除 `a@localhost` 这类
  return domain.includes(".") ? domain : null;
}

/**
 * 该邮箱是否落在已知不可投递域上。
 * 无邮箱 / 非法邮箱返回 false —— 格式问题交给 z.email() / EMAIL_RE 去报，
 * 这里只回答「域名能不能收信」，两件事不要混。
 */
export function isUndeliverableEmail(raw: string | null | undefined): boolean {
  const domain = emailDomainOf(raw);
  if (!domain) return false;
  return UNDELIVERABLE_DOMAINS.some(
    (bad) => domain === bad || domain.endsWith(`.${bad}`)
  );
}

/**
 * 发信层兜底判定：命中即**不投递**，直接返回失败并记日志。
 *
 * 为什么发信层还要再拦一次 —— 数据里已经存在的死地址（本次事故就是库里有一个
 * `email = support@usedfarmmach.cn` 的账号）不会因为注册层加了校验就消失。
 * 只靠注册层，老账号每触发一次找回密码/重发验证就退一封信，
 * 白白消耗发信配额、拉低发件域信誉（退信率是 ISP 判垃圾邮件的主要指标之一）。
 */
export function shouldBlockDelivery(to: string | null | undefined): boolean {
  return isUndeliverableEmail(to);
}
