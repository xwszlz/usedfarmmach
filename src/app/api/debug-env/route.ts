import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ark_key_exists: !!process.env.ARK_API_KEY,
    ark_key_length: process.env.ARK_API_KEY?.length || 0,
    ark_key_prefix: process.env.ARK_API_KEY?.substring(0, 8) || "EMPTY",
    ark_model: process.env.ARK_MODEL_ID || "EMPTY",
    google_key_exists: !!process.env.GOOGLE_API_KEY,
    google_key_length: process.env.GOOGLE_API_KEY?.length || 0,
    openrouter_key_exists: !!process.env.OPENROUTER_API_KEY,
    openrouter_key_length: process.env.OPENROUTER_API_KEY?.length || 0,
    timestamp: new Date().toISOString(),
  });
}
