import { NextResponse } from "next/server";

const OSS_BUCKET = "usedfarmmach-oss";
const OSS_REGION = "oss-cn-beijing";
const OSS_HOST = `https://${OSS_BUCKET}.${OSS_REGION}.aliyuncs.com`;
const DB_KEY = "uploads/field-expo-videos/db.json";

export async function GET() {
  try {
    const res = await fetch(`${OSS_HOST}/${DB_KEY}`, { cache: "no-store" });
    if (res.ok) {
      const text = await res.text();
      const videos = JSON.parse(text);
      return NextResponse.json({ success: true, videos });
    }
    return NextResponse.json({ success: true, videos: [] });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}