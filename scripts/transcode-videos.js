/**
 * 批量转码 HEVC 视频为 H.264 (MP4)
 * 浏览器只支持 H.264，不支持 HEVC/H.265
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const UPLOADS_DIR = path.join(__dirname, "../public/uploads/products");
const TEMP_DIR = path.join(__dirname, "../temp-videos");

// 确保临时目录存在
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

function getVideoCodec(filePath) {
  try {
    const output = execSync(
      `ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
      { encoding: "utf-8", timeout: 10000 }
    ).trim();
    return output;
  } catch {
    return null;
  }
}

function transcodeVideo(inputPath, outputPath) {
  try {
    execSync(
      `ffmpeg -y -i "${inputPath}" -c:v libx264 -preset fast -crf 23 -c:a copy -movflags +faststart "${outputPath}"`,
      { stdio: "inherit", timeout: 300000 }
    );
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const productDirs = fs.readdirSync(UPLOADS_DIR).filter(d => {
    return fs.statSync(path.join(UPLOADS_DIR, d)).isDirectory();
  });

  let hevcCount = 0;
  let h264Count = 0;
  let transcodedCount = 0;
  let failedCount = 0;

  for (const dir of productDirs) {
    const videoPath = path.join(UPLOADS_DIR, dir, "video_1.mp4");
    if (!fs.existsSync(videoPath)) continue;

    const codec = getVideoCodec(videoPath);
    if (!codec) {
      console.log(`❌ 无法检测编码: ${dir}`);
      failedCount++;
      continue;
    }

    if (codec === "h264") {
      console.log(`✅ 已是 H.264，跳过: ${dir}`);
      h264Count++;
      continue;
    }

    if (codec === "hevc") {
      hevcCount++;
      const tempPath = path.join(TEMP_DIR, `${dir}_video_1.mp4`);
      console.log(`\n🎬 转码 HEVC → H.264: ${dir}`);
      console.log(`   输入: ${videoPath}`);
      console.log(`   输出: ${tempPath}`);

      const success = transcodeVideo(videoPath, tempPath);
      if (success && fs.existsSync(tempPath)) {
        // 备份原文件
        const backupPath = videoPath + ".hevc.bak";
        fs.renameSync(videoPath, backupPath);
        // 移动转码后的文件
        fs.renameSync(tempPath, videoPath);
        console.log(`   ✅ 转码成功，原文件备份为 .hevc.bak`);
        transcodedCount++;
      } else {
        console.log(`   ❌ 转码失败`);
        failedCount++;
      }
    } else {
      console.log(`⚠️ 未知编码 ${codec}: ${dir}`);
    }
  }

  console.log(`\n========== 转码完成 ==========`);
  console.log(`H.264 (无需转码): ${h264Count}`);
  console.log(`HEVC (已转码): ${transcodedCount}`);
  console.log(`失败: ${failedCount}`);
  console.log(`\n转码后的视频需要重新上传到 OSS！`);
}

main().catch(console.error);
