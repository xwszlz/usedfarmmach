/**
 * POST /api/mp/agent   — 小程序智能体接入网关（统一入口）
 *
 * 鉴权：必须携带 x-mp-key（或 Authorization: Bearer）且等于 MP_API_KEY。
 * 该端点是小程序调用平台智能体能力的唯一入口，避免小程序直接依赖内部路由。
 *
 * Body: { action: "buyer-chat" | "daily-report" | "status" | "recognize", payload: {...} }
 *
 *  action 说明：
 *   - buyer-chat:   多语 AI 客服（payload = { visitorId, content, locale?, productId?, sessionId? }）
 *   - daily-report: 返回最新跨境套利日报文本（payload = { date?: "YYYY-MM-DD" }）
 *   - status:       返回智能体群调度总览（payload 可带 { historyLimit? }）
 *   - recognize:    拍照识别能力描述符（小程序据此直连 /api/agents/seller-helper/recognize）
 */
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { isMiniProgramRequest } from "@/lib/mp-auth";
import { buyerChatAgent } from "@/lib/agents/buyer-chat/agent";
import { getAgentStatus } from "@/lib/agents/orchestrator/agent";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const REPORTS_DIR = path.join(process.cwd(), "public", "daily-reports");

function findLatestReport(date?: string): { date: string; content: string } | null {
  if (date) {
    const p = path.join(REPORTS_DIR, `${date}_跨境套利日报.md`);
    if (fs.existsSync(p)) return { date, content: fs.readFileSync(p, "utf-8") };
    return null;
  }
  if (!fs.existsSync(REPORTS_DIR)) return null;
  const files = fs.readdirSync(REPORTS_DIR).filter((f) => f.includes("跨境套利日报") && f.endsWith(".md"));
  if (files.length === 0) return null;
  files.sort();
  const latest = files[files.length - 1];
  const d = latest.replace("_跨境套利日报.md", "");
  return { date: d, content: fs.readFileSync(path.join(REPORTS_DIR, latest), "utf-8") };
}

export async function POST(request: NextRequest) {
  if (!isMiniProgramRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized (missing x-mp-key)" }, { status: 401 });
  }

  let body: { action?: string; payload?: any } = {};
  try {
    const text = await request.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { action, payload = {} } = body;

  try {
    switch (action) {
      case "buyer-chat": {
        if (!payload.visitorId || !payload.content) {
          return NextResponse.json({ ok: false, error: "visitorId 和 content 必填" }, { status: 400 });
        }
        const result = await buyerChatAgent.run({
          visitorId: payload.visitorId,
          content: String(payload.content),
          locale: payload.locale || "zh",
          productId: payload.productId,
          sessionId: payload.sessionId,
        });
        return NextResponse.json({ ok: result.success, ...result });
      }

      case "daily-report": {
        const report = findLatestReport(payload.date);
        if (!report) {
          return NextResponse.json({ ok: false, error: "暂无日报" }, { status: 404 });
        }
        return NextResponse.json({ ok: true, date: report.date, content: report.content });
      }

      case "status": {
        const result = await getAgentStatus({ includeHistory: true, historyLimit: payload.historyLimit || 5 });
        return NextResponse.json(result);
      }

      case "recognize": {
        // 拍照识别走专用图像接口：小程序直接 POST /api/agents/seller-helper/recognize
        // 并带 x-mp-key 头，body 为 { imageDataUris: [...], isChineseBrand?: boolean }
        return NextResponse.json({
          ok: true,
          action: "recognize",
          endpoint: "/api/agents/seller-helper/recognize",
          method: "POST",
          headers: { "x-mp-key": "<<MP_API_KEY>>" },
          body: { imageDataUris: ["<base64 data uri>"], isChineseBrand: false },
          note: "小程序直连该端点上传图片，无需经网关转发大文件",
        });
      }

      default:
        return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
