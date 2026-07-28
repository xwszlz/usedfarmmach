import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

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

async function readDB(): Promise<any[]> {
  try {
    const res = await fetch(`${OSS_HOST}/${DB_KEY}`);
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

export async function POST(req: NextRequest) {
  try {
    const { videoData, brandName, machineType, folder } = await req.json();
    if (!videoData || !brandName) {
      return NextResponse.json({ success: false, error: "Missing videoData or brandName" }, { status: 400 });
    }

    const matches = videoData.match(/^data:(.+?);base64,(.+)$/);
    if (!matches) {
      return NextResponse.json({ success: false, error: "Invalid video data format" }, { status: 400 });
    }
    const mimeType = matches[1];
    const buffer = Buffer.from(matches[2], "base64");

    if (buffer.length > 100 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: "Video exceeds 100MB" }, { status: 400 });
    }

    const ext = mimeType === "video/mp4" ? "mp4" : mimeType === "video/quicktime" ? "mov" : "mp4";
    const safeFolder = folder?.replace(/[^a-z0-9-]/g, "") || "field-expo-videos";
    const key = `uploads/${safeFolder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

    // OSS upload
    const creds = getOSSCredentials();
    const expiration = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const policyObj = {
      expiration,
      conditions: [
        { bucket: OSS_BUCKET },
        ["eq", "$key", key],
        ["content-length-range", 0, 100 * 1024 * 1024],
      ],
    };
    const policyBase64 = Buffer.from(JSON.stringify(policyObj)).toString("base64");
    const signature = crypto.createHmac("sha1", creds.accessKeySecret).update(policyBase64).digest("base64");

    const formData = new FormData();
    formData.append("OSSAccessKeyId", creds.accessKeyId);
    formData.append("policy", policyBase64);
    formData.append("signature", signature);
    formData.append("key", key);
    formData.append("success_action_status", "200");
    const blob = new Blob([buffer], { type: mimeType });
    formData.append("file", blob, `video.${ext}`);

    const uploadRes = await fetch(OSS_HOST, { method: "POST", body: formData });
    if (!uploadRes.ok) {
      return NextResponse.json({ success: false, error: "OSS upload failed" }, { status: 500 });
    }

    const url = `${OSS_HOST}/${key}`;

    // Store metadata in OSS-based DB (serverless-safe)
    const db = await readDB();
    db.push({
      id: crypto.randomUUID(),
      url,
      brandName,
      machineType: machineType || "现场作业",
      uploadedAt: new Date().toISOString(),
    });
    await writeDB(db);

    return NextResponse.json({ success: true, data: { url } });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}