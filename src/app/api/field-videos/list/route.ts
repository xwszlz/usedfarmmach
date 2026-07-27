import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const dbPath = path.join(process.cwd(), "field-videos-db.json");
    let videos: any[] = [];
    try {
      videos = JSON.parse(fs.readFileSync(dbPath, "utf8"));
    } catch {}
    return NextResponse.json({ success: true, videos });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
