// ───────────────────────────────────────────────
// 企业微信「群机器人」webhook 推送
//  env: WECOM_GROUP_WEBHOOK_URL（未配置则 no-op）
// ───────────────────────────────────────────────
import axios from "axios";

const WEBHOOK_URL = process.env.WECOM_GROUP_WEBHOOK_URL || "";

export interface GroupPushPayload {
  title: string;
  lines: string[];
  level?: "info" | "warn";
}

// 推送一条 markdown 消息到监控群；未配 webhook 时静默跳过
export async function pushToGroup(payload: GroupPushPayload): Promise<void> {
  if (!WEBHOOK_URL) {
    console.log("[group-webhook] WECOM_GROUP_WEBHOOK_URL 未配置，跳过推送");
    return;
  }
  const color = payload.level === "warn" ? "warning" : "info";
  const body = [`# ${payload.title}`, ...payload.lines].join("\n");
  try {
    await axios.post(
      WEBHOOK_URL,
      { msgtype: "markdown", markdown: { content: body } },
      { timeout: 8000 }
    );
    console.log(`[group-webhook] pushed (${color})`);
  } catch (e) {
    console.error("[group-webhook] push failed:", e);
  }
}
