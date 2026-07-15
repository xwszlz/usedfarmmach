// ───────────────────────────────────────────────
// 小程序「智能客服」公开接口（方案 B：关键词 FAQ 静态匹配）
//   ⚠️ 不调用任何生成式 AI / 大模型，纯规则匹配，零 AI 资质要求、零合规风险
//   POST /api/chat  { message, sessionId?, productId? }
//     → 命中 FAQ 关键词返回预设答案；未命中返回转人工提示
//   → WECOM_GROUP_WEBHOOK_URL 未配则静默跳过推群
// ───────────────────────────────────────────────
import { pushToGroup } from "@/lib/wecom/group-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FaqItem = {
  keywords: string[];
  answer: string;
  intent?: string;
};

// 农机交易常见问题知识库（关键词命中即返回）
const FAQ: FaqItem[] = [
  {
    keywords: ["发布", "卖", "出售", "上传", "挂牌", "出手", "卖机器", "怎么卖"],
    intent: "publish",
    answer:
      "发布二手农机很简单：进入小程序底部「发布」页，按步骤填写即可。\n" +
      "· 图片：最多 9 张（清晰展示整机、铭牌、磨损部位）\n" +
      "· 视频：最多 1 个（展示机器启动运行状态）\n" +
      "· 分类/品牌：直接输入文字，可自由填写\n" +
      "· 提交后即时上线，无需审核等待\n" +
      "发布后可在浏览器打开 usedfarmmach.com 查看你的产品。",
  },
  {
    keywords: ["运费", "物流", "运输", " shipping", "发货", "配送", "海运", "陆运"],
    intent: "logistics",
    answer:
      "平台主营跨境二手农机交易，运输方式按目的地协商：\n" +
      "· 国内：专车/零担物流，费用按里程与机型另议\n" +
      "· 出口：支持海运整柜/拼箱，主要面向中亚、俄罗斯、南美、中东、非洲\n" +
      "具体运费请在发布或询价时备注目的地，我们帮你核算。",
  },
  {
    keywords: ["付款", "支付", "钱", "价格", "多少钱", "费用", "分期", "定金", "尾款", "怎么买"],
    intent: "payment",
    answer:
      "当前平台标价均为人民币（¥）。\n" +
      "交易流程：线上询价 → 确认机器与价格 → 线下签约付款 → 安排发运。\n" +
      "支持对公转账，大额可协商分期或定金+尾款。\n" +
      "具体支付方式请在联系人工客服时确认。",
  },
  {
    keywords: ["质保", "质量", "保修", "验机", "好坏", "可靠", "翻新", "事故", "工况"],
    intent: "quality",
    answer:
      "所有二手农机均为实机拍照/视频展示，建议购买前：\n" +
      "· 查看详情页多图与视频，关注铭牌、小时数、磨损\n" +
      "· 可要求视频验机或实地看货\n" +
      "· 出口机型可提供第三方检验（SGS 等，费用另计）\n" +
      "平台对机器来源与权属做基本核验，但不提供额外质保，请以实物为准。",
  },
  {
    keywords: ["估价", "估值", "值钱", "报价", "多少钱收", "行情", "残值"],
    intent: "valuation",
    answer:
      "我们提供农机 AI 估值参考（基于站内成交与国际行情）。\n" +
      "你可以：\n" +
      "· 在发布时参考同类机型标价\n" +
      "· 联系人工客服，提供品牌/型号/年份/小时数，获取估价区间\n" +
      "估值仅供参考，最终成交价以买卖双方协商为准。",
  },
  {
    keywords: ["联系", "电话", "微信", "人工", "客服", "找人", "沟通", "洽谈"],
    intent: "hand_over",
    answer:
      "需要人工服务，请复制下方邮箱联系我们：\n" +
      "· 邮箱：jiusei0319@gmail.com\n" +
      "· QQ邮箱：932133255@qq.com\n" +
      "也可在小程序「我的 → 关于」页点击「联系人工客服」发起会话。\n" +
      "我们会尽快回复。",
  },
  {
    keywords: ["青储", "青贮", "打捆", "捡拾", "收割", "拖拉机", "割台", "搂草", "翻晒", "方捆", "圆捆", "机型", "推荐", "哪个好", "怎么选"],
    intent: "model_advice",
    answer:
      "常见机型参考：\n" +
      "· 青储/黄储：克拉斯（CLAAS）、纽荷兰、约翰迪尔、国产冠军割台等\n" +
      "· 打捆：方捆（比如冠军 360/390/4500 割台配套）、圆捆机\n" +
      "· 拖拉机：按马力需求选（100–400 马力区间）\n" +
      "告诉我们你的作业类型、地块规模、预算，可帮你匹配具体机型与在售货源。",
  },
  {
    keywords: ["语言", "国家", "海外", "出口", "俄语", "英文", "国际化", "跨境", "哈萨克斯坦", "俄罗斯", "南美", "中东", "非洲"],
    intent: "global",
    answer:
      "平台 usedfarmmach.com 支持 8 种语言，面向全球二手农机买家。\n" +
      "重点市场：哈萨克斯坦、俄罗斯等中亚地区，以及南美、中东、非洲。\n" +
      "海外买家可直接用母语浏览、询价；国内卖家发布后自动多语展示。",
  },
  {
    keywords: ["发票", "开票", "增值税", "收据"],
    intent: "invoice",
    answer:
      "平台可协商提供交易凭证/发票，具体开票类型与税点请在联系人工客服时确认，需提供抬头与税号。",
  },
  {
    keywords: ["下单", "购买", "买", "交易流程", "怎么交易", "成交"],
    intent: "trade",
    answer:
      "交易流程：\n" +
      "1. 浏览/搜索心仪机器，点「询价」或「联系客服」\n" +
      "2. 确认机器状态、价格、运输方式\n" +
      "3. 线下签约付款\n" +
      "4. 安排发运、验收\n" +
      "目前为信息发布+撮合模式，支付与物流在线下完成，安全可控。",
  },
  {
    keywords: ["注册", "登录", "账号", "微信登录", "手机号"],
    intent: "account",
    answer:
      "小程序支持微信一键登录，无需单独注册。\n" +
      "发布、询价、收藏等功能登录后即可使用。\n" +
      "如登录异常，请在小程序「我的」页重新授权。",
  },
  {
    keywords: ["平台", "是什么", "介绍", "公司", "神雕", "干嘛的", "关于"],
    intent: "about",
    answer:
      "神雕农机（石家庄神雕农机科技有限公司）运营跨境二手农机交易平台 usedfarmmach.com，\n" +
      "面向全球买卖二手农机（青储机、打捆机、拖拉机、收割机等），\n" +
      "支持 8 种语言、覆盖中亚/南美/中东/非洲等市场。\n" +
      "小程序提供产品浏览、发布、询价、智能客服等功能。",
  },
];

const FALLBACK =
  "这个问题我暂时没有标准答案，已为你转人工。\n" +
  "请复制邮箱联系：jiusei0319@gmail.com 或 932133255@qq.com\n" +
  "也可在「我的 → 关于」页点击「联系人工客服」。\n" +
  "（你也可换种说法，比如「怎么发布」「运费多少」「怎么估价」）";

function matchFAQ(message: string): { item: FaqItem | null; score: number } {
  const text = message.toLowerCase();
  let best: FaqItem | null = null;
  let bestScore = 0;
  for (const item of FAQ) {
    let score = 0;
    for (const kw of item.keywords) {
      if (text.includes(kw.toLowerCase())) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return { item: best, score: bestScore };
}

export async function GET() {
  return Response.json({
    ok: true,
    service: "buyer-chat-faq",
    note: "POST /api/chat with { message, sessionId?, productId? }",
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message: string | undefined = body?.message;

    if (!message || typeof message !== "string" || !message.trim()) {
      return Response.json({ success: false, error: "message is required" }, { status: 400 });
    }

    const { item, score } = matchFAQ(message.trim());
    const reply = score > 0 && item ? item.answer : FALLBACK;
    const intent = score > 0 && item?.intent ? item.intent : "hand_over";

    // 推监控群（未配 webhook 静默跳过，不影响主流程）
    try {
      await pushToGroup({
        title: "💬 小程序智能客服对话",
        lines: [
          `**问**: ${message.trim()}`,
          `**答**: ${reply.slice(0, 800)}`,
          reply.length > 800 ? "_（回复较长，已截断）_" : "",
        ].filter(Boolean),
        level: intent === "hand_over" ? "warn" : "info",
      });
    } catch {
      /* 推群失败不影响回复 */
    }

    return Response.json({
      success: true,
      reply,
      intent,
      suggestedProducts: [],
    });
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    console.error("[chat] error:", err);
    return Response.json({ success: false, error: err }, { status: 500 });
  }
}
