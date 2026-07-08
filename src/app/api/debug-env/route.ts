import { NextResponse } from "next/server";
import axios from "axios";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET() {
  const tests: Record<string, unknown> = {};

  const arkUrl = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";
  const arkKey = process.env.ARK_API_KEY || "";
  const arkModel = process.env.ARK_MODEL_ID || "doubao-seed-evolving";
  const realImageUrl = "https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com/uploads/products/cmraa26890001fdqqdkkq9e97/image_0_1783406294486.jpg";

  // Test 1: Text only
  try {
    const start = Date.now();
    const res = await axios.post(arkUrl, {
      model: arkModel,
      messages: [{ role: "user", content: "Say OK" }],
      max_tokens: 10,
    }, {
      headers: { Authorization: `Bearer ${arkKey}`, "Content-Type": "application/json" },
      timeout: 30000,
    });
    tests.text_only = {
      status: "OK", http_status: res.status, time_ms: Date.now() - start,
      response: JSON.stringify(res.data).substring(0, 200),
    };
  } catch (error: unknown) {
    const e = error as { message?: string; response?: { status?: number; data?: unknown } };
    tests.text_only = {
      status: "FAILED", error: e?.message, http_status: e?.response?.status,
      detail: e?.response?.data ? JSON.stringify(e.response.data).substring(0, 300) : null,
    };
  }

  // Test 2: With real image URL (90s timeout)
  try {
    const start = Date.now();
    const res = await axios.post(arkUrl, {
      model: arkModel,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: "What brand? Reply in 3 words." },
          { type: "image_url", image_url: { url: realImageUrl } },
        ],
      }],
      max_tokens: 50,
    }, {
      headers: { Authorization: `Bearer ${arkKey}`, "Content-Type": "application/json" },
      timeout: 90000,
    });
    tests.with_image = {
      status: "OK", http_status: res.status, time_ms: Date.now() - start,
      response: JSON.stringify(res.data).substring(0, 500),
    };
  } catch (error: unknown) {
    const e = error as { message?: string; response?: { status?: number; data?: unknown } };
    tests.with_image = {
      status: "FAILED", error: e?.message, http_status: e?.response?.status,
      detail: e?.response?.data ? JSON.stringify(e.response.data).substring(0, 500) : null,
    };
  }

  return NextResponse.json({
    env: {
      ark_key_prefix: arkKey.substring(0, 8),
      ark_model: arkModel,
    },
    image_url_tested: realImageUrl,
    tests,
    timestamp: new Date().toISOString(),
  });
}
