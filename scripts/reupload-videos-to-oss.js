/**
 * 重新上传转码后的视频到 OSS（覆盖旧文件）
 */

const OSS = require("ali-oss");
const fs = require("fs");
const path = require("path");

const ACCESS_KEY_ID = process.env.OSS_ACCESS_KEY_ID || "OSS_ACCESS_KEY_ID_PLACEHOLDER";
const ACCESS_KEY_SECRET = process.env.OSS_ACCESS_KEY_SECRET || "OSS_ACCESS_KEY_SECRET_PLACEHOLDER";
const BUCKET = process.env.OSS_BUCKET || "usedfarmmach-oss";
const REGION = process.env.OSS_REGION || "oss-cn-beijing";

const UPLOADS_DIR = path.join(__dirname, "../public/uploads/products");

async function main() {
  const client = new OSS({
    region: REGION,
    accessKeyId: ACCESS_KEY_ID,
    accessKeySecret: ACCESS_KEY_SECRET,
    bucket: BUCKET,
    secure: true,
  });

  const productDirs = fs.readdirSync(UPLOADS_DIR).filter((d) => {
    return fs.statSync(path.join(UPLOADS_DIR, d)).isDirectory();
  });

  let uploadedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const dir of productDirs) {
    const videoPath = path.join(UPLOADS_DIR, dir, "video_1.mp4");
    if (!fs.existsSync(videoPath)) {
      skippedCount++;
      continue;
    }

    const ossKey = `uploads/products/${dir}/video_1.mp4`;
    const fileSizeMB = (fs.statSync(videoPath).size / 1024 / 1024).toFixed(1);

    try {
      console.log(`[${uploadedCount + 1}/${productDirs.length}] 上传: ${dir} (${fileSizeMB}MB)`);
      await client.put(ossKey, videoPath);
      uploadedCount++;
    } catch (err) {
      console.error(`   ❌ 上传失败: ${dir} - ${err.message}`);
      failedCount++;
    }
  }

  console.log(`\n========== 视频重新上传完成 ==========`);
  console.log(`上传成功: ${uploadedCount}`);
  console.log(`跳过(无视频): ${skippedCount}`);
  console.log(`失败: ${failedCount}`);
}

main().catch(console.error);
