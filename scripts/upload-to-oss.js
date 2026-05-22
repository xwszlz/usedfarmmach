/**
 * 批量上传产品图片到阿里云 OSS
 * 
 * 用法: node scripts/upload-to-oss.js
 * 
 * 需要环境变量:
 * - OSS_ACCESS_KEY_ID
 * - OSS_ACCESS_KEY_SECRET
 * - OSS_BUCKET
 * - OSS_REGION (默认 cn-beijing)
 */

const OSS = require("ali-oss");
const fs = require("fs");
const path = require("path");

const ACCESS_KEY_ID = process.env.OSS_ACCESS_KEY_ID || "OSS_ACCESS_KEY_ID_PLACEHOLDER";
const ACCESS_KEY_SECRET = process.env.OSS_ACCESS_KEY_SECRET || "OSS_ACCESS_KEY_SECRET_PLACEHOLDER";
const BUCKET = process.env.OSS_BUCKET || "usedfarmmach-oss";
const REGION = process.env.OSS_REGION || "oss-cn-beijing";

const LOCAL_DIR = path.join(__dirname, "..", "public", "uploads", "products");
const OSS_PREFIX = "uploads/products"; // OSS 上的路径前缀

async function main() {
  const client = new OSS({
    region: REGION,
    accessKeyId: ACCESS_KEY_ID,
    accessKeySecret: ACCESS_KEY_SECRET,
    bucket: BUCKET,
    secure: true,
  });

  console.log(`OSS 配置: bucket=${BUCKET}, region=${REGION}`);
  console.log(`本地目录: ${LOCAL_DIR}`);
  console.log(`OSS 路径前缀: ${OSS_PREFIX}\n`);

  // 获取所有产品目录
  const productDirs = fs.readdirSync(LOCAL_DIR).filter((name) => {
    return fs.statSync(path.join(LOCAL_DIR, name)).isDirectory();
  });

  console.log(`找到 ${productDirs.length} 个产品目录\n`);

  let totalFiles = 0;
  let totalSize = 0;
  let uploadedFiles = 0;
  let failedFiles = 0;
  let skippedFiles = 0;

  // 先统计文件数和大小
  for (const dir of productDirs) {
    const dirPath = path.join(LOCAL_DIR, dir);
    const files = fs.readdirSync(dirPath).filter((f) => {
      const stat = fs.statSync(path.join(dirPath, f));
      return stat.isFile();
    });
    for (const file of files) {
      const stat = fs.statSync(path.join(dirPath, file));
      totalFiles++;
      totalSize += stat.size;
    }
  }

  console.log(`共 ${totalFiles} 个文件，总大小 ${(totalSize / 1024 / 1024).toFixed(1)}MB\n`);

  // 逐目录上传
  for (let i = 0; i < productDirs.length; i++) {
    const dir = productDirs[i];
    const dirPath = path.join(LOCAL_DIR, dir);
    const files = fs.readdirSync(dirPath).filter((f) => {
      return fs.statSync(path.join(dirPath, f)).isFile();
    });

    console.log(`[${i + 1}/${productDirs.length}] 产品 ${dir}: ${files.length} 个文件`);

    for (const file of files) {
      const localPath = path.join(dirPath, file);
      const ossKey = `${OSS_PREFIX}/${dir}/${file}`;

      try {
        // 检查文件是否已存在（通过 head 请求）
        try {
          await client.head(ossKey);
          skippedFiles++;
          continue; // 已存在，跳过
        } catch (e) {
          // 文件不存在，继续上传
        }

        const result = await client.put(ossKey, localPath);
        uploadedFiles++;
        const sizeMB = (fs.statSync(localPath).size / 1024 / 1024).toFixed(2);
        console.log(`  ✅ ${file} (${sizeMB}MB) → ${result.url}`);
      } catch (err) {
        failedFiles++;
        console.error(`  ❌ ${file} 上传失败: ${err.message}`);
      }
    }
  }

  console.log("\n========== 上传完成 ==========");
  console.log(`上传: ${uploadedFiles} 个`);
  console.log(`跳过: ${skippedFiles} 个（已存在）`);
  console.log(`失败: ${failedFiles} 个`);
  console.log(`\nOSS 基础 URL: https://${BUCKET}.${REGION}.aliyuncs.com`);
}

main().catch(console.error);
