"use client";

/**
 * 2026 黑龙江国际农业机械展览会 —— 参展 & 观展完全宝典
 *
 * 定位：公开获客资产，不是内部物料。
 *  - 正文 90% 为通用攻略（同行也愿意转发），神雕内容集中在「现场找神雕」与「案例」两节。
 *  - 观展篇放第一位：观众约 3 万人次 vs 展商 300 家，搜「交通/住宿/代金券」的量是搜「展位」的百倍。
 *  - 勾选状态存 localStorage，关掉再开还在，当作展前自检表用。
 *
 * 合规：署名「神雕农机整理」，不得让用户误以为是组委会官方发布；
 *       价格与日程以组委会最终公布为准。
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  MapPin, CalendarDays, Ruler, Users, Building2, Train, Bus, Car,
  Ticket, Gift, AlertTriangle, CheckSquare, ChevronDown,
  ArrowRight, Clock, Package, Ban, Volume2, Flame, Trash2, Lock,
  UserPlus,
} from "lucide-react";

/* ─────────────── 展会核心事实（来源：官方参展手册 + 主办方公开资料） ─────────────── */

/* ─────────────── 可勾选清单 ─────────────── */

type CheckItem = { t: string; why?: string };

function CheckList({
  id,
  title,
  items,
}: {
  id: string;
  title: string;
  items: CheckItem[];
}) {
  const [done, setDone] = useState<boolean[]>(() => items.map(() => false));

  // localStorage 放在 effect 里读，避免 SSR / 客户端首帧不一致导致 hydration 报错
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`expoGuide_${id}`);
      if (raw) {
        const arr = JSON.parse(raw) as boolean[];
        if (Array.isArray(arr) && arr.length === items.length) setDone(arr);
      }
    } catch {
      /* 隐私模式下 localStorage 不可用，忽略即可 */
    }
  }, [id, items.length]);

  function toggle(i: number) {
    const next = done.map((v, idx) => (idx === i ? !v : v));
    setDone(next);
    try {
      localStorage.setItem(`expoGuide_${id}`, JSON.stringify(next));
    } catch {
      /* 忽略 */
    }
  }

  return (
    <details className="group rounded-xl border border-gray-200 bg-white" open>
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 font-semibold text-gray-900">
        <ChevronDown className="h-4 w-4 shrink-0 text-red-600 transition-transform group-open:rotate-90" />
        {title}
        <span className="ml-auto text-xs font-normal text-gray-400">
          {done.filter(Boolean).length}/{items.length}
        </span>
      </summary>
      <ul className="space-y-2 border-t border-gray-100 px-4 py-3">
        {items.map((it, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => toggle(i)}
              className={`flex w-full items-start gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                done[i]
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-gray-200 bg-gray-50 hover:bg-gray-100"
              }`}
            >
              <span
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                  done[i]
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-gray-300 bg-white"
                }`}
              >
                {done[i] ? "✓" : ""}
              </span>
              <span className={done[i] ? "text-gray-500 line-through" : "text-gray-800"}>
                {it.t}
                {it.why && (
                  <span className="mt-0.5 block text-xs text-gray-400">{it.why}</span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}

/* ─────────────── 小组件 ─────────────── */

function H2({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <h2
      id={n}
      className="mb-3 flex items-center text-xl font-extrabold text-gray-900 scroll-mt-20"
    >
      <span className="mr-2 rounded-md bg-red-600 px-2 py-0.5 text-xs text-white">
        {n}
      </span>
      {children}
    </h2>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="mb-5 rounded-2xl border border-gray-200 bg-white p-5">
      {children}
    </section>
  );
}

function Note({ tone, children }: { tone: "blue" | "red" | "amber"; children: React.ReactNode }) {
  const cls =
    tone === "red"
      ? "border-red-500 bg-red-50"
      : tone === "amber"
      ? "border-amber-500 bg-amber-50"
      : "border-blue-500 bg-blue-50";
  return <div className={`my-3 rounded-r-lg border-l-4 ${cls} px-3.5 py-2.5 text-sm`}>{children}</div>;
}

function Tbl({
  head,
  rows,
}: {
  head: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div className="-mx-1 my-3 overflow-x-auto">
      <table className="w-full min-w-[420px] border-collapse text-sm">
        <thead>
          <tr className="bg-gray-100">
            {head.map((h, i) => (
              <th key={i} className="border border-gray-200 px-2.5 py-2 text-left font-bold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className="border border-gray-200 px-2.5 py-2 align-top">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Faq({ q, a, open }: { q: string; a: React.ReactNode; open?: boolean }) {
  return (
    <details className="group rounded-xl border border-gray-200 bg-white" open={open}>
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 font-semibold text-gray-900">
        <ChevronDown className="h-4 w-4 shrink-0 text-red-600 transition-transform group-open:rotate-90" />
        {q}
      </summary>
      <div className="border-t border-gray-100 px-4 py-3 text-sm text-gray-700">{a}</div>
    </details>
  );
}

/* ─────────────── 主组件 ─────────────── */

export function HljExpoGuide({ locale }: { locale: string }) {
  const t = useTranslations("expoGuide");
  const site = "https://usedfarmmach.cn";
  const isZh = locale === "zh";
  const contactHref = isZh ? `${site}/zh/contact` : `${site}/${locale}/contact`;

  /* 展会核心事实（i18n：k / v / sub 全部走 expoGuide.facts） */
  const FACTS: Array<{ k: string; v: React.ReactNode; icon: React.ElementType }> = [
    { icon: CalendarDays, k: t("facts.time.k"), v: <>{t("facts.time.v")}<br /><span className="text-gray-500">{t("facts.time.sub")}</span></> },
    { icon: MapPin, k: t("facts.venue.k"), v: <>{t("facts.venue.v")}<br /><span className="text-gray-500">{t("facts.venue.sub")}</span></> },
    { icon: Building2, k: t("facts.host.k"), v: <>{t("facts.host.v")}<br />{t("facts.host.sub")}</> },
    { icon: Ruler, k: t("facts.scale.k"), v: <>{t("facts.scale.v")}<br /><span className="text-gray-500">{t("facts.scale.sub")}</span></> },
    { icon: Users, k: t("facts.traffic.k"), v: t("facts.traffic.v") },
  ];

  /* 神雕现场主推：收购 + 寄售机型清单（brand / kind 走 i18n，型号代号保留原文） */
  const TRADE_MODELS = [
    { brand: t("models.nhForage.brand"), kind: t("models.nhForage.kind"), models: ["FX38", "FX48", "FX375", "FX58", "FX50"] },
    { brand: t("models.nhBaler.brand"), kind: t("models.nhBaler.kind"), models: ["1290", "9080", "1270", "5070"] },
    { brand: t("models.clForage.brand"), kind: t("models.clForage.kind"), models: ["695", "850", "870"] },
    { brand: t("models.clBaler.brand"), kind: t("models.clBaler.kind"), models: ["65", "2200", "3300", "5300"] },
  ];

  const tocItems = [
    t("toc.items.0"), t("toc.items.1"), t("toc.items.2"), t("toc.items.3"),
    t("toc.items.4"), t("toc.items.5"), t("toc.items.6"), t("toc.items.7"),
    t("toc.items.8"), t("toc.items.9"), t("toc.items.10"),
  ];

  const bannerBadges = [
    t("banner.badges.date"), t("banner.badges.venue"),
    t("banner.badges.scale"), t("banner.badges.traffic"),
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-6">
      {/* ===== HERO ===== */}
      <div className="mb-4 rounded-2xl bg-gradient-to-br from-red-700 to-red-900 p-6 text-white">
        <div className="mb-1.5 text-[11px] tracking-[0.18em] opacity-80">
          2026 · HEILONGJIANG EXPO PLAYBOOK
        </div>
        <h1 className="mb-2 text-2xl font-extrabold leading-tight sm:text-3xl">
          {t("banner.title")}<br />{t("banner.subtitle")}
        </h1>
        <p className="text-sm opacity-90">{t("banner.tagline")}</p>
        <div className="mt-4 flex flex-wrap gap-1.5 text-xs">
          {bannerBadges.map((b) => (
            <span
              key={b}
              className="rounded-full border border-white/25 bg-white/15 px-2.5 py-1"
            >
              {b}
            </span>
          ))}
        </div>
      </div>

      <Note tone="red">
        <b>{t("countdown.deadline", { days: 7 })}</b>{" "}
        {t("countdown.detail1")} {t("countdown.detail2")} {t("countdown.detail3")} {t("countdown.detail4")}
      </Note>

      {/* ===== 神雕业务钩子（前置，突出收售机型） ===== */}
      <Card>
        <div className="mb-3 flex items-center gap-2">
          <Flame className="h-5 w-5 text-red-600" />
          <h2 className="text-lg font-extrabold text-gray-900">{t("models.sectionTitle")}</h2>
        </div>
        <p className="text-sm text-gray-700">{t("models.sectionDesc")}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {TRADE_MODELS.map((g, i) => (
            <div key={i} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <div className="text-xs font-bold text-red-700">{g.brand}</div>
              <div className="mb-1.5 text-xs text-gray-500">{g.kind}</div>
              <div className="flex flex-wrap gap-1">
                {g.models.map((m) => (
                  <span
                    key={m}
                    className="rounded-md border border-gray-300 bg-white px-2 py-0.5 text-sm font-semibold text-gray-800"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <a
            href={`/${locale}/auth/register?redirect=/seller/products/new`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700"
          >
            <UserPlus className="h-4 w-4" />
            {t("models.publishFree")}
          </a>
        </div>
        <p className="mt-2 text-xs text-gray-400">{t("models.contactInfo")}</p>
      </Card>

      {/* ===== 目录 ===== */}
      <Card>
        <h2 className="mb-2 text-lg font-extrabold text-gray-900">{t("toc.title")}</h2>
        <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {tocItems.map((label, i) => (
            <li key={i}>
              <a href={`#sec-${i}`} className="text-gray-800 no-underline hover:text-red-600">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </Card>

      {/* ===== 速览 ===== */}
      <Card>
        {/* 标题整句走 i18n（字典为「速览：30 秒看完核心信息」整段），故不再套 H2 的红色序号徽章 */}
        <h2 id="速览" className="mb-3 text-xl font-extrabold text-gray-900 scroll-mt-20">
          {t("facts.title")}
        </h2>
        <dl className="divide-y divide-gray-100">
          {FACTS.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.k} className="flex gap-3 py-2.5">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                <div className="min-w-0 flex-1">
                  <dt className="text-xs font-semibold text-gray-500">{f.k}</dt>
                  <dd className="text-sm text-gray-900">{f.v}</dd>
                </div>
              </div>
            );
          })}
          <div className="flex gap-3 py-2.5">
            <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            <div className="min-w-0 flex-1">
              <dt className="text-xs font-semibold text-gray-500">承办 / 支持</dt>
              <dd className="text-sm text-gray-900">
                承办：黑龙江汇锦展览有限公司<br />
                支持：北大荒农垦集团、黑龙江省农业投资集团
              </dd>
            </div>
          </div>
        </dl>
        <Note tone="amber">
          <b>历届积淀：</b>黑龙江农机展办展 24 年，累计参展面积超 60 万㎡，入驻厂商 6887 家，
          观展人次 75.8 万，意向成交额突破百亿元。
        </Note>
      </Card>

      {/* ===== 一、观展篇 ===== */}
      <Card>
        <H2 n="一">观展篇 · 观众看这里</H2>

        <h3 className="mt-4 font-bold text-gray-900">1. 怎么报名？要门票吗？</h3>
        <p className="text-sm text-gray-700">
          官方渠道是微信公众号，全程免费，5 步完成：
        </p>
        <Tbl
          head={["步骤", "操作"]}
          rows={[
            ["①", "微信搜索并关注公众号【黑龙江农机展】"],
            ["②", "点底部菜单 展会服务 → 观众报名"],
            ["③", "点「去注册」，填信息完成注册并登录"],
            ["④", "选择 2026 黑龙江国际农业机械展览会，如实填写姓名、手机号，提交"],
            ["⑤", "点击已选展会 → 生成专属入场二维码 → 截图保存到相册"],
          ]}
        />
        <Note tone="red">
          <b>三个必须注意：</b>
          <br />· 现场出示二维码直接核验入场 —— <b>务必提前截图</b>（展馆信号可能不好）
          <br />· 填报信息必须真实准确，信息有误将<b>无法核验入场</b>
          <br />· 二维码<b>仅限本人使用</b>，不要转发他人
        </Note>

        <h3 className="mt-5 font-bold text-gray-900">2. 怎么去？</h3>
        <Tbl
          head={["方式", "路线"]}
          rows={[
            [
              <span key="a" className="inline-flex items-center gap-1 font-bold">
                <Train className="h-3.5 w-3.5" /> 地铁（推荐）
              </span>,
              "2 号线至「冰雪大世界站」，3 号口出站，步行即达",
            ],
            [
              <span key="b" className="inline-flex items-center gap-1">
                <Bus className="h-3.5 w-3.5" /> 公交
              </span>,
              "29 路 / 42 路 / 47 路区间，至「冰雪大世界站」下车",
            ],
            [
              <span key="c" className="inline-flex items-center gap-1">
                <Car className="h-3.5 w-3.5" /> 自驾
              </span>,
              "导航「哈尔滨冰雪大世界」，园区周边设展会专用停车区",
            ],
          ]}
        />

        <h3 className="mt-5 font-bold text-gray-900">3. 住哪里？</h3>
        <p className="text-sm text-gray-700">
          展馆在松北区，建议住松北，通勤 10–15 分钟。<b>9 月是哈尔滨展会+旅游旺季，务必早订。</b>
        </p>
        <Tbl
          head={["酒店", "联系人", "电话", "地址"]}
          rows={[
            ["太阳岛花园酒店", "刘经理", "13766859665", "松北区冰花路 869 号"],
            ["臻图酒店", "侯经理", "13936592678", "松北区文泰路 1298 号"],
            ["哈尔滨尚合国际酒店", "刘经理", "13796651313", "松北区剧院一路 456 号"],
          ]}
        />

        <h3 className="mt-5 flex items-center gap-1.5 font-bold text-gray-900">
          <Gift className="h-4 w-4 text-amber-600" />
          4. 代金券怎么玩？（能省真金白银）
        </h3>
        <p className="text-sm text-gray-700">组委会推出 20 倍购机代金券，现场扫码抽奖：</p>
        <Tbl
          head={["抽中", "可抵扣", "倍数"]}
          rows={[
            ["10 元", <b key="1">抵 200 元</b>, "20×"],
            ["20 元", <b key="2">抵 400 元</b>, "20×"],
            ["30 元", <b key="3">抵 600 元</b>, "20×"],
            ["50 元", <b key="4">抵 1000 元</b>, "20×"],
          ]}
        />
        <Note tone="amber">
          <b>四条关键规则：</b>
          <br />· <b>任意展位无门槛使用</b>，全场通用
          <br />· <b>可叠加使用</b>，多张一起抵
          <br />· 用于抵扣<b>农机购机货款</b>
          <br />· 农民持本人身份证还可现场免费领抽奖券，有机会赢取拖拉机大奖
        </Note>
        <p className="text-sm text-gray-700">
          <b>玩法建议：</b>先扫码抽奖拿券，再逛展。看中机器后谈好价格，最后掏券抵扣 ——
          券是"减"不是"换"，不影响你谈价，等于在成交价上再砍一刀。
        </p>
      </Card>

      {/* ===== 二、参展篇 ===== */}
      <Card>
        <H2 n="二">参展篇 · 展商看这里</H2>

        <h3 className="mt-4 font-bold text-gray-900">1. 报名五步走</h3>
        <Tbl
          head={["步骤", "做什么", "注意"]}
          rows={[
            ["① 申报", "向组委会申报展位类别、面积、广告需求", "按申报时间、类别、面积、产品属性分配"],
            ["② 确认", "收到展位确认通知", "—"],
            [
              "③ 回传",
              "《参展回执》盖章签字 + 营业执照扫描件或复印件盖章，回传组委会",
              "缺一不可",
            ],
            [
              "④ 付款",
              "收到确认后 7 个工作日内汇款，并上传汇款底单",
              <b key="p" className="text-red-700">展位以款到日期为准</b>,
            ],
            ["⑤ 领证", "现场领取《展商证》、参展指南", "联系人：杨立鹏 15331943713"],
          ]}
        />
        <Note tone="red">
          <b>组委会原文：</b>"参展单位收到《参展回执》确认微信或电话通知后，请于 7 个工作日内将展位费汇入
          黑龙江汇锦展览有限公司账户并上传汇款底单，<b>展位（广告）的最终确认以款到日期为准</b>。"
        </Note>

        <details className="group mt-3 rounded-xl border border-gray-200">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 font-semibold">
            <ChevronDown className="h-4 w-4 shrink-0 text-red-600 transition-transform group-open:rotate-90" />
            付款信息 + 参展回执要填什么
          </summary>
          <div className="border-t border-gray-100 px-4 py-3 text-sm">
            <h4 className="font-bold text-gray-900">官方收款账户</h4>
            <Tbl
              head={["项", "内容"]}
              rows={[
                ["收款单位", "黑龙江汇锦展览有限公司"],
                ["账号", "4519 0870 0010 000"],
                ["开户行", "招商银行股份有限公司哈尔滨南岗支行"],
                ["联行号", "308261032048"],
              ]}
            />
            <h4 className="mt-3 font-bold text-gray-900">参展回执必备字段</h4>
            <ul className="list-disc space-y-1 pl-5 text-gray-700">
              <li>单位名称（<b>盖章</b>）、地址、邮编</li>
              <li>法定代表人 + 手机 + 微信</li>
              <li>联系人 + 手机 + 微信（建议填现场负责人的）</li>
              <li>参展产品（写具体品类）</li>
              <li>
                开票信息：发票类型、统一社会信用代码、开户行及账号（专票必填）、地址及电话（专票必填）
              </li>
              <li>预定展位：室内/室外、面积、费用</li>
              <li>广告需求：彩虹门 / 落地广告牌 / 条幅 / 刀旗 / 会刊插页</li>
            </ul>
          </div>
        </details>

        <h3 className="mt-5 flex items-center gap-1.5 font-bold text-gray-900">
          <Clock className="h-4 w-4 text-red-600" />
          2. 关键日期（比报名截止更早的坑）
        </h3>
        <Tbl
          head={["日期", "事项", "错过后果"]}
          rows={[
            [<b key="a" className="text-red-600">9月10日</b>, "无搭建展商申报用电", <b key="b">之后加收 100%</b>],
            [<b key="c" className="text-red-600">9月15日</b>, "报名截止", "报不上"],
            [<b key="d" className="text-red-600">9月15日</b>, "相连展位拆隔板需求通知", "现场改动须缴拆改费"],
            [<b key="e" className="text-red-600">9月15日</b>, "大功率用电需求通知", "现场无法布线"],
            ["9月16–17日", "大型特装展位布展（8:00–17:00）", "—"],
            ["9月17–18日", "标准展位及其它布展（8:00–17:00）", "—"],
            ["9月19日 10:00", "开幕式", "—"],
            ["9月19–21日", "展期（8:30–16:30）", "须提前 30 分钟签到"],
            ["9月22日", "撤展（8:30–16:30）", "提前撤展须经批准"],
          ]}
        />

        <h3 className="mt-5 font-bold text-gray-900">3. 标准展位自带什么？</h3>
        <p className="text-sm text-gray-700">
          楣板 1 条（<b>角位双开口 2 条</b>）、洽谈桌 1 张、洽谈椅 2 把、射灯 2 个、电源插座 1 个。
        </p>
        <Note tone="blue">
          <b>楣板文字务必逐字核对</b> —— 公司名错一个字，现场改要收费。
        </Note>
      </Card>

      {/* ===== 三、展位怎么选 ===== */}
      <Card>
        <H2 n="三">展位怎么选</H2>

        <h3 className="mt-4 font-bold text-gray-900">价格参考</h3>
        <Tbl
          head={["类别", "规格", "价格"]}
          rows={[
            ["室内标准展位", "3m × 3m", <b key="a">4800 元/个</b>],
            ["（角位）", "3m × 3m", "5800 元/个"],
            ["室内标准展位", "3m × 2m", "3800 元/个（角位 4800 元）"],
            ["室内标准展位", "3m × 1.5m", "3000 元/个（角位 3800 元）"],
            ["室外净地", "80㎡ 起", "300 元/㎡（须特装搭建）"],
            ["一桌一椅", "—", "1500 元/个"],
            ["会刊插页", "210mm × 140mm", "5000 元/页"],
            ["彩虹门", "10m/16m 跨度", "3000–5000 元/个"],
            ["落地广告牌", "8m × 4m 桁架喷绘", "20000 元/块"],
            ["刀旗", "5m 高", "500 元/个"],
          ]}
        />
        <Note tone="blue">
          以上为黑龙江省农机展公开报价（春季第 25 届），<b>秋季冰雪大世界展场地成本更高，
          实际价格以组委会报价为准</b>，建议按上浮 20% 做预算。
        </Note>

        <h3 className="mt-5 font-bold text-gray-900">其他必缴费用</h3>
        <Tbl
          head={["项目", "标准"]}
          rows={[
            ["施工管理费", "10 元/㎡（按实际展位面积）"],
            ["施工保证金", "50 元/㎡"],
            ["临时用电 220V/16A", "300 元/处 + 电箱租金 100 + 押金 100"],
            ["布撤展车证", "押金 200 元/张，限时 2 小时，超时 100 元/小时"],
            ["施工证", "10 元/张"],
            ["加班费", "5 元/小时/㎡；17:00 后加收 100%"],
          ]}
        />

        <h3 className="mt-5 font-bold text-gray-900">选择决策树</h3>
        <Tbl
          head={["如果你的目标是…", "选什么", "理由"]}
          rows={[
            [
              <b key="a">留资 / 获客</b>,
              "1 个 3×3m 室内标准展位，优先角位",
              "角位双开口，人流翻倍，加价约 1000 元，全展最划算的一笔钱",
            ],
            [
              <b key="b">现场成交</b>,
              "3×3m 主展位 + 1 个 3×2m 作洽谈区",
              "站着谈不成大单，独立洽谈区显著提高线索质量",
            ],
            ["展示大型机械", "室外净地 80㎡ 起 + 特装", "室内放不下；需预留搭建费 3–5 万"],
            ["品牌曝光", "会刊插页 + 刀旗", "会刊会被采购团带走，长决策周期品类会后翻看概率高"],
            ["预算有限", "1 个 3×2m", "3800 元先验证效果，明年再加码"],
          ]}
        />
        <Note tone="amber">
          <b>位置怎么挑：</b>向组委会索取展位平面图，按优先级圈 3 个备选：
          ① 主通道交汇处 ② 靠近入口 ③ 靠近北大荒采购团动线。拿到图再定，别让组委会随便指派。
        </Note>
      </Card>

      {/* ===== 四、物料清单 ===== */}
      <Card>
        <H2 n="四">物料清单（点一下就打勾，自动保存）</H2>
        <p className="text-xs text-gray-500">
          勾选状态保存在你手机本地，关掉再打开还在，可做展前自检表。
        </p>

        <div className="mt-3 space-y-2.5">
          <CheckList
            id="visual"
            title="A. 展位视觉"
            items={[
              { t: "背景板 / 主视觉", why: "公司名 + 一句话定位 + 二维码，3 米内一眼看懂" },
              { t: "易拉宝 ×2–3", why: "① 主打产品 ② 案例/背书 ③ 价格或活动" },
              { t: "楣板文字逐字确认", why: "现场改要收费，务必提前核对" },
              { t: "桌牌 / 台卡", why: "写行动指令，如「扫码免费估值，30 秒出结果」" },
            ]}
          />
          <CheckList
            id="lead"
            title="B. 演示与留资（核心）"
            items={[
              { t: "平板或便携显示器 + 循环视频", why: "动态画面比静态展板多吸引 3–5 倍目光" },
              { t: "二维码立牌 ×2（带渠道参数）", why: "如 ?ref=hljexpo2026，能统计展会带来多少注册" },
              { t: "纸质登记表（兜底）", why: "展馆信号差时的保命手段：姓名/电话/需求/地区" },
              { t: "名片 ≥300 张" },
              { t: "宣传册 / 折页 500 份" },
            ]}
          />
          <CheckList
            id="coupon"
            title="C. 代金券主推（组委会福利，别浪费）"
            items={[
              { t: "代金券提示牌（醒目位置）", why: "「现场扫码抽代金券，最高抵 1000 元，可叠加」" },
              { t: "培训现场人员主动开口推介", why: "组委会明确建议展商主动引导客户领券" },
              { t: "代金券收纳盒 + 登记本", why: "收好券，会后凭券到服务处统一结算" },
            ]}
          />
          <CheckList
            id="misc"
            title="D. 杂物（最容易忘）"
            items={[
              { t: "插线板", why: "展位只给 1 个插座，多个设备必带" },
              { t: "胶带 / 剪刀 / 扎带 / 马克笔" },
              { t: "名片盒、资料架、收纳箱" },
              { t: "小礼品（引流用）", why: "实用型最好：手机支架、折叠袋、工具套装" },
              { t: "充电宝、急救包" },
              { t: "锁柜", why: "参展手册明确建议展位内使用锁柜" },
            ]}
          />
          <CheckList
            id="compliance"
            title="E. 合规自检（印之前必看）"
            items={[
              { t: "协会/机构称谓用全称，不简写", why: "简称可能被认定违规" },
              { t: "不出现「资金托管」「担保交易」「代收代付」", why: "无相应资质即违规" },
              { t: "收费项目表述准确", why: "信息服务费 ≠ 交易佣金，两者性质不同" },
              { t: "展品不侵犯他人商标权、专利权" },
              { t: "不现场销售非农机产品", why: "明令禁止，可能被取消参展资格且不退费" },
            ]}
          />
        </div>
      </Card>

      {/* ===== 五、倒排表 ===== */}
      <Card>
        <H2 n="五">展前倒排表</H2>
        <ol className="relative ml-2 border-l-2 border-gray-200 pl-5">
          {[
            ["展前 11 天（9/8）", "致电组委会确认展位余位 + 价格 + 索取展位平面图；订酒店和往返交通", true],
            ["展前 10 天（9/9）", "选定展位；填《参展回执》+ 营业执照盖章件回传", true],
            ["展前 9 天（9/10）", "🔴 用电申报截止（逾期加收 100%）", true],
            ["展前 8–9 天（9/10–11）", "付款 + 上传汇款底单（款到才算确认）", false],
            ["展前 7 天（9/11）", "确认楣板文字、是否拆隔板、是否大功率用电", false],
            ["展前 5–6 天（9/12–13）", "物料设计定稿 → 下单制作（留足 3 天工期）", false],
            ["展前 4 天（9/14）", "物料验收；确认《展商证》领取方式", false],
            ["展前 3 天（9/15）", "🔴 报名截止 + 拆隔板/大功率用电最终确认", true],
            ["展前 3 天（9/15）", "参展人员培训：话术 + 代金券推介 + 合规红线", true],
            ["展前 2–0 天（9/16–18）", "布展（标准展位 9/17–18 进场即可）", false],
            ["展前 1 天（9/18）", "人员抵达、展位彩排、设备联调", false],
            ["展期（9/19–21）", "每日 8:00 进场，16:30 闭馆，闭馆前不得提前离开", false],
            ["展后（9/22）", "撤展 8:30–16:30", false],
            ["展后 7 天（9/23–30）", "线索闭环跟进", false],
          ].map(([d, t, hot], i) => (
            <li key={i} className="mb-3.5">
              <span
                className={`absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full border-2 ${
                  hot ? "border-red-600 bg-red-600" : "border-red-600 bg-white"
                }`}
              />
              <div className={`text-sm font-extrabold ${hot ? "text-red-600" : "text-red-500"}`}>
                {d as string}
              </div>
              <div className="text-sm text-gray-700">{t as string}</div>
            </li>
          ))}
        </ol>
      </Card>

      {/* ===== 六、现场 SOP ===== */}
      <Card>
        <H2 n="六">现场转化 SOP</H2>
        <h3 className="mt-4 font-bold text-gray-900">三句话钩子（按转化率排序）</h3>
        <Tbl
          head={["#", "话术", "为什么有效"]}
          rows={[
            ["1", <b key="a">"扫码免费给你的农机估个价，30 秒出结果"</b>, "零门槛、即时满足，人人都想知道自己的机器值多少"],
            ["2", <b key="b">"现场扫码抽代金券，最高抵 1000 块，买机器直接抵"</b>, "组委会统一宣传，认知成本低，现成的成交钩子"],
            ["3", <b key="c">"我们这有 XX 台现货，扫一下码看看"</b>, "具体到数字才有说服力"],
          ]}
        />
        <h3 className="mt-5 font-bold text-gray-900">留资四要素（缺一不可）</h3>
        <p className="text-sm text-gray-700">
          <b>姓名 / 手机号 / 意向机型 / 地区。</b>手机号是命根子，其余可后补。
          纸质表兜底，防展馆信号差。
        </p>
        <h3 className="mt-5 font-bold text-gray-900">人员配置建议（2–3 人）</h3>
        <Tbl
          head={["角色", "干什么"]}
          rows={[
            ["主讲 1 人", "负责演示、讲平台/产品、控场"],
            ["留资 1 人", "引导扫码、登记表、发资料"],
            ["机动 1 人", "走出展位主动引流、补位、拍照"],
          ]}
        />
        <h3 className="mt-5 font-bold text-gray-900">每日闭馆后 30 分钟</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
          <li>汇总当日线索，录入表格，标注来源</li>
          <li>群内通报：留资数 / 高质量线索数 / 现场问题</li>
          <li>
            <b>次日上午优先回电前一日高质量线索</b>（趁热度，展会热度只有 48 小时）
          </li>
        </ul>
      </Card>

      {/* ===== 七、展后 ===== */}
      <Card>
        <H2 n="七">展后 7 天闭环</H2>
        <p className="text-sm text-gray-700">
          展会真正的分水岭在展后 —— <b>80% 的参展商输在这一步</b>：收了一堆名片，回去就躺抽屉里。
        </p>
        <Tbl
          head={["时间", "动作"]}
          rows={[
            [<b key="a">D+1</b>, "全部线索首次触达（电话 + 微信），越早越好"],
            [<b key="b">D+2</b>, "分级：A 类（1 周内可能成交）/ B 类（1 月内）/ C 类（长期培育）"],
            [<b key="c">D+3</b>, "A 类推送对应机型清单 + 报价"],
            [<b key="d">D+7</b>, "未响应线索二次触达（发平台新上架机型、行业报告等有价值内容）"],
          ]}
        />
        <Note tone="amber">
          <b>关键动作：</b>首次触达时<b>必须提到展会现场的具体细节</b>
          （"您那天在我们展位看了那台 CLAAS…"），否则对方根本想不起来你是谁。
          带上下文的回复率是群发话术的 3–5 倍。
        </Note>
      </Card>

      {/* ===== 八、避坑 ===== */}
      <Card>
        <H2 n="八">避坑清单（来自参展手册原文）</H2>
        <Tbl
          head={["坑", "规则原文要点"]}
          rows={[
            [
              <span key="a" className="inline-flex items-center gap-1"><Ban className="h-3.5 w-3.5" />展位转让转租</span>,
              "严禁以任何形式转让、转租（含联营）、倒卖展位",
            ],
            ["提前撤展", "严禁提前撤展，逾期按规定缴纳滞纳金"],
            ["现场卖非农机产品", "取消参展资格、没收产品、清出场，不退展位费"],
            [
              <span key="b" className="inline-flex items-center gap-1"><Package className="h-3.5 w-3.5" />展位内广告超高</span>,
              "标准展位内广告高度不得超过 2.5 米，不得超出展位长宽",
            ],
            [
              <span key="c" className="inline-flex items-center gap-1"><Volume2 className="h-3.5 w-3.5" />音量超标</span>,
              "室外展位音响在公共通道边缘不得超过 60 分贝；室内不得设置广播扩音设备",
            ],
            ["消防", "全馆严禁吸烟及明火，严禁私接电线；压缩气罐及易燃易爆品须提前申报"],
            ["提前离开", "闭馆前不要过早离开展位，须等保安清场"],
            [
              <span key="d" className="inline-flex items-center gap-1"><Trash2 className="h-3.5 w-3.5" />垃圾</span>,
              "特装展位撤展垃圾须自行带离，否则扣除施工管理押金",
            ],
          ]}
        />
      </Card>

      {/* ===== 九、FAQ ===== */}
      <Card>
        <H2 n="九">常见问题 FAQ</H2>
        <div className="mt-3 space-y-2.5">
          <Faq
            open
            q="2026 黑龙江农机展什么时候举办？在哪里？"
            a="2026 年 9 月 19 日至 21 日，每日 8:30–16:30，在哈尔滨冰雪大世界（哈尔滨市松北区太阳大道 1458 号）举办。开幕式 9 月 19 日 10:00。"
          />
          <Faq
            open
            q="参展报名什么时候截止？"
            a={
              <>
                报名时间为 2026 年 6 月 22 日至 <b>9 月 15 日</b>。
                <br />
                <br />
                需特别注意三个更早的节点：<b>9 月 10 日</b>前无搭建展商须申报用电（逾期加收 100%）；
                <b>9 月 15 日</b>前须通知拆隔板与大功率用电需求。
                <br />
                <br />
                更重要的是：<b>展位以「款到日期」确认，不是报名日期</b>。未按时付款，组委会有权取消且不另行通知。
              </>
            }
          />
          <Faq
            open
            q="展位多少钱？"
            a={
              <>
                参考黑龙江省农机展公开报价：室内标准展位 3m×3m 约 <b>4800 元/个</b>（角位 5800 元），
                3m×2m 约 3800 元，3m×1.5m 约 3000 元；室外净地 80㎡ 起、约 300 元/㎡（须特装搭建）。
                <br />
                <br />
                秋季冰雪大世界展场地成本较高，<b>实际价格以组委会报价为准</b>，建议按上浮 20% 做预算。
              </>
            }
          />
          <Faq
            open
            q="观众怎么报名？要门票吗？"
            a="免费。通过官方微信公众号【黑龙江农机展】报名：展会服务 → 观众报名 → 注册登录 → 选择「2026 黑龙江国际农业机械展览会」→ 填写姓名手机号 → 提交后生成专属入场二维码，截图保存，现场出示核验即可入场。"
          />
          <Faq
            open
            q="怎么坐地铁去？"
            a="乘坐哈尔滨地铁 2 号线至「冰雪大世界站」，从 3 号口出站步行即达。公交可乘 29 路、42 路、47 路区间至「冰雪大世界站」。自驾导航「哈尔滨冰雪大世界」，园区周边设展会专用停车区。"
          />
          <Faq
            open
            q="购机代金券怎么玩？"
            a={
              <>
                组委会推出 <b>20 倍购机代金券</b>：观众现场扫码抽奖，抽 10 元抵 200 元、20 元抵 400 元、
                30 元抵 600 元、50 元抵 1000 元。
                <br />
                <br />
                代金券<b>可在任意参展展位无门槛使用且可叠加</b>，用于抵扣农机购机货款。
                <b>抵扣金额无需展商垫付</b>——展商正常定价销售、收好代金券，会后凭券到大会服务处统一兑换结算。
              </>
            }
          />
          <Faq
            q="展会规模多大？有哪些展品？"
            a="设 300 个国际标准展位，展场总面积 3 万平方米，预计专业客商 3 万人次，设 A/B/C/D/E 五个室内展区及室外露天展区。主要展出各类农业机械、动力机械、植保机械、畜牧机械、农副产品加工机械、智能农机装备与农业物联网监测平台等。主办方组织北大荒农垦集团旗下分公司及 100 余家国有农场、东北地区大型合作社与俄罗斯远东种植大户到会采购。"
          />
          <Faq
            q="主办方和承办方是谁？"
            a="主办：黑龙江省农业机械流通协会、黑龙江省农业机械工业协会。承办：黑龙江汇锦展览有限公司。支持：北大荒农垦集团有限公司、黑龙江省农业投资集团。指导：黑龙江省工业和信息化厅、黑龙江省农业农村厅。首席赞助：月星集团。"
          />
        </div>
      </Card>

      {/* ===== 十、案例 ===== */}
      <Card>
        <H2 n="十">案例：神雕农机怎么做</H2>
        <p className="text-xs text-gray-500">
          这一节是真实案例，供同类企业参考。做法可复制，不构成建议。
        </p>

        <h3 className="mt-4 font-bold text-gray-900">我们这次现场主推：收购 + 寄售</h3>
        <p className="text-sm text-gray-700">
          神雕农机本届展会的核心业务是<b>收购与寄售国际品牌大小方捆、圆捆及青贮机</b>，
          现场带机照片或铭牌即可免费估价。主收机型：
        </p>
        <div className="mt-2 space-y-1.5 text-sm">
          {TRADE_MODELS.map((g, i) => (
            <div key={i} className="flex flex-wrap items-baseline gap-2">
              <span className="font-bold text-red-700">{g.brand}</span>
              <span className="text-xs text-gray-500">{g.kind}</span>
              <span className="font-semibold text-gray-900">{g.models.join(" / ")}</span>
            </div>
          ))}
        </div>

        <h3 className="mt-5 font-bold text-gray-900">公司定位决定了打法</h3>
        <p className="text-sm text-gray-700">
          石家庄神雕农机科技有限公司主营进口二手方捆机、圆捆机、青贮机（New Holland、CLAAS 系列），
          并运营二手农机跨境交易平台 <b>usedfarmmach</b>。我们的性质是<b>平台 + 信息服务</b>，
          核心目标是<b>留资</b>，不是现场成交。
        </p>

        <h3 className="mt-5 font-bold text-gray-900">因此我们的选择</h3>
        <Tbl
          head={["决策项", "选择", "理由"]}
          rows={[
            ["展位", "1 个 3×3m 室内标准展位，争角位", "角位双开口人流翻倍，加价约 1000 元，全展最划算的投入"],
            ["是否摆真机", "不摆", "从石家庄运机器到哈尔滨，运费+吊装+特装 5 万起；我们是留资导向，投产比不对"],
            ["核心钩子", "AI 智能估值", "零门槛、即时满足，人人都想知道自己的机器值多少"],
            ["第二钩子", "组委会代金券", "现成的成交钩子，不用自己造，且展商不垫付"],
            ["留资方式", "二维码带渠道参数", "?ref=hljexpo2026，展后能精确算出带来多少注册"],
          ]}
        />

        <h3 className="mt-5 font-bold text-gray-900">我们的预算（供参考）</h3>
        <Tbl
          head={["项目", "估算"]}
          rows={[
            ["展位费（3×3m 角位）", "约 6,000 元（含上浮预留）"],
            ["施工管理费 + 用电 + 车证押金", "约 800 元"],
            ["物料（背景板/易拉宝/折页/名片/礼品）", "2,000 – 3,000 元"],
            ["差旅（2–3 人 × 4 天）", "8,000 – 12,000 元"],
            [<b key="a">合计</b>, <b key="b">约 1.7 – 2.2 万元</b>],
          ]}
        />
        <Note tone="amber">
          <b>给同类企业的建议：</b>如果你是平台/服务型公司，把钱花在<b>留资物料和会说话的人</b>上，
          而不是花在"看起来气派"的特装上。一个能 30 秒讲清价值的现场人员，效果胜过 5 万块的特装。
        </Note>
      </Card>

      {/* ===== CTA ===== */}
      <div className="mt-6 rounded-2xl bg-gradient-to-br from-emerald-700 to-emerald-900 p-6 text-center text-white">
        <h3 className="mb-1.5 text-lg font-extrabold">{t("cta.title")}</h3>
        <p className="text-sm opacity-90">{t("cta.subtitle1")}</p>
        <p className="text-sm opacity-90">{t("cta.subtitle2")}</p>
        <a
          href={`/${locale}/services/valuation`}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-6 py-2.5 font-extrabold text-emerald-800"
        >
          {t("cta.button")} <ArrowRight className="h-4 w-4" />
        </a>
        <div className="mt-3 text-xs opacity-70">{t("cta.association")}</div>
      </div>

      {/* ===== 页脚 ===== */}
      <footer className="mt-8 border-t border-gray-200 pt-5 text-center text-xs leading-relaxed text-gray-400">
        <p>
          {t("footer.intro", { company: t("footer.company") })}
          <br />
          {t("footer.source", { disclaimer: t("footer.disclaimer") })}
          <br />
          {t("footer.lastUpdated")}
        </p>
        <p className="mt-2">{t("footer.contact")}</p>
        <p className="mt-2 flex items-center justify-center gap-1">
          <Lock className="h-3 w-3" />
          本页面非组委会官方发布
        </p>
      </footer>
    </div>
  );
}
