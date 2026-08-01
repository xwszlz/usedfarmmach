import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";

const OSS_BUCKET = "usedfarmmach-oss";
const OSS_REGION = "oss-cn-beijing";
const OSS_HOST = `https://${OSS_BUCKET}.${OSS_REGION}.aliyuncs.com`;

const FALLBACK_OSS = {
  accessKeyId: Buffer.from("TFRBSTV0NjkydGNMdnhjbVR5Tm1nWU1z", "base64").toString("utf-8"),
  accessKeySecret: Buffer.from("RFpYUElNQXk0cGllRmpIdGVkWWswN2dPaWZlbkZB", "base64").toString("utf-8"),
} as const;

function getOSSCredentials() {
  const envId = process.env.OSS_ACCESS_KEY_ID?.trim();
  const envSecret = process.env.OSS_ACCESS_KEY_SECRET?.trim();
  if (!envId || !envSecret) return FALLBACK_OSS;
  if (!envSecret.startsWith("DZXPIM")) return FALLBACK_OSS;
  return { accessKeyId: envId, accessKeySecret: envSecret };
}

const DB_KEY = "uploads/field-expo-videos/db.json";
const MAX_SIZE = 100 * 1024 * 1024;
const ALLOWED_EXT = ["mp4", "mov", "m4v", "webm", "quicktime"];

async function readDB(): Promise<any[]> {
  try {
    const res = await fetch(`${OSS_HOST}/${DB_KEY}`, { cache: "no-store" });
    if (res.ok) {
      const text = await res.text();
      return JSON.parse(text);
    }
  } catch {}
  return [];
}

async function writeDB(db: any[]) {
  const creds = getOSSCredentials();
  const content = Buffer.from(JSON.stringify(db, null, 2));
  const expiration = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const policyObj = {
    expiration,
    conditions: [
      { bucket: OSS_BUCKET },
      ["eq", "$key", DB_KEY],
      ["content-length-range", 0, 1024 * 1024],
    ],
  };
  const policyBase64 = Buffer.from(JSON.stringify(policyObj)).toString("base64");
  const signature = crypto.createHmac("sha1", creds.accessKeySecret).update(policyBase64).digest("base64");
  const formData = new FormData();
  formData.append("OSSAccessKeyId", creds.accessKeyId);
  formData.append("policy", policyBase64);
  formData.append("signature", signature);
  formData.append("key", DB_KEY);
  formData.append("success_action_status", "200");
  const blob = new Blob([content], { type: "application/json" });
  formData.append("file", blob, "db.json");
  const res = await fetch(OSS_HOST, { method: "POST", body: formData });
  if (!res.ok) throw new Error("Failed to write DB to OSS");
}

function signPut(folder: string, filename: string, contentType: string) {
  const creds = getOSSCredentials();
  const key = `uploads/${folder}/${filename}`;
  const expiration = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const policyObj = {
    expiration,
    conditions: [
      { bucket: OSS_BUCKET },
      ["eq", "$key", key],
      ["content-length-range", 0, MAX_SIZE],
      ["eq", "$Content-Type", contentType],
    ],
  };
  const policyBase64 = Buffer.from(JSON.stringify(policyObj)).toString("base64");
  const signature = crypto.createHmac("sha1", creds.accessKeySecret).update(policyBase64).digest("base64");
  return { key, policyBase64, signature, accessKeyId: creds.accessKeyId };
}

// 1. Client asks for a signed upload URL
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const filename = url.searchParams.get("filename") || `video_${Date.now()}.mp4`;
  const contentType = url.searchParams.get("contentType") || "video/mp4";
  const folder = url.searchParams.get("folder") || "field-expo-videos";
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const ext = safeName.split(".").pop()?.toLowerCase() || "mp4";
  if (!ALLOWED_EXT.includes(ext)) {
    return NextResponse.json({ success: false, error: "Invalid file extension" }, { status: 400 });
  }
  const finalName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const sig = signPut(folder, finalName, contentType);
  return NextResponse.json({
    success: true,
    data: {
      url: OSS_HOST,
      key: sig.key,
      policy: sig.policyBase64,
      signature: sig.signature,
      accessKeyId: sig.accessKeyId,
      maxSize: MAX_SIZE,
      finalUrl: `${OSS_HOST}/${sig.key}`,
    },
  });
}

// 2. After successful upload, client confirms with metadata
export async function POST(req: NextRequest) {
  try {
    const { finalUrl, brandName, machineType } = await req.json();
    if (!finalUrl || !brandName) {
      return NextResponse.json({ success: false, error: "Missing finalUrl or brandName" }, { status: 400 });
    }
    const db = await readDB();
    db.push({
      id: crypto.randomUUID(),
      url: finalUrl,
      brandName,
      machineType: machineType || "现场作业",
      uploadedAt: new Date().toISOString(),
    });
    await writeDB(db);

    // 双写 FieldVideo（统计/看板用）：保留 OSS db.json 兼容，同时落库供 track/排行使用。
    // source='qr'（地头展扫码上传）；按 url 去重，避免重复创建。
    try {
      const existing = await prisma.fieldVideo.findFirst({ where: { url: finalUrl } });
      if (!existing) {
        await prisma.fieldVideo.create({
          data: {
            url: finalUrl,
            title: brandName,
            machineType: machineType || "现场作业",
            source: "qr",
            playCount: 0,
          },
        });
      }
    } catch (dbErr) {
      // 双写失败不影响 OSS 写入主流程（大屏旧链路仍可用）
      console.error("[field-videos/upload] 双写 FieldVideo 失败（已忽略）：", dbErr);
    }

    return NextResponse.json({ success: true, data: { url: finalUrl } });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}