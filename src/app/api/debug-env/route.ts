import { NextResponse } from "next/server";
import axios from "axios";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const results: Record<string, unknown> = {
    env: {
      ark_key_exists: !!process.env.ARK_API_KEY,
      ark_key_length: process.env.ARK_API_KEY?.length || 0,
      ark_key_prefix: process.env.ARK_API_KEY?.substring(0, 8) || "EMPTY",
      ark_model: process.env.ARK_MODEL_ID || "EMPTY",
      google_key_exists: !!process.env.GOOGLE_API_KEY,
      openrouter_key_exists: !!process.env.OPENROUTER_API_KEY,
    },
    tests: {} as Record<string, unknown>,
    timestamp: new Date().toISOString(),
  };

  // Test 1: Doubao (ARK) API connectivity — text only, no images
  try {
    const arkUrl = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";
    const arkStart = Date.now();
    const arkResponse = await axios.post(
      arkUrl,
      {
        model: process.env.ARK_MODEL_ID || "doubao-seed-evolving",
        messages: [{ role: "user", content: "Say OK" }],
        max_tokens: 10,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.ARK_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );
    results.tests.ark = {
      status: "OK",
      http_status: arkResponse.status,
      time_ms: Date.now() - arkStart,
      response: JSON.stringify(arkResponse.data).substring(0, 300),
    };
  } catch (error: any) {
    results.tests.ark = {
      status: "FAILED",
      error: error?.message || String(error),
      http_status: error?.response?.status || null,
      error_detail: error?.response?.data ? JSON.stringify(error.response.data).substring(0, 300) : null,
      time_ms: error?.duration || null,
    };
  }

  // Test 2: Doubao with image URL (same as recognize does)
  try {
    const arkUrl = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";
    const imgStart = Date.now();
    const imgResponse = await axios.post(
      arkUrl,
      {
        model: process.env.ARK_MODEL_ID || "doubao-seed-evolving",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "What brand is this tractor? Reply in 5 words." },
            { type: "image_url", image_url: { url: "https://sd-shendiao.oss-cn-beijing.aliyuncs.com/products/CLAAS-JAGUAR-970/01.jpg" } },
          ],
        }],
        max_tokens: 50,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.ARK_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 60000,
      }
    );
    results.tests.ark_with_image = {
      status: "OK",
      http_status: imgResponse.status,
      time_ms: Date.now() - imgStart,
      response: JSON.stringify(imgResponse.data).substring(0, 500),
    };
  } catch (error: any) {
    results.tests.ark_with_image = {
      status: "FAILED",
      error: error?.message || String(error),
      http_status: error?.response?.status || null,
      error_detail: error?.response?.data ? JSON.stringify(error.response.data).substring(0, 300) : null,
      time_ms: null,
    };
  }

  return NextResponse.json(results);
}
