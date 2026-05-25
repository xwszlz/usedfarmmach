/**
 * 上传单张图片到阿里云 OSS
 * 
 * 用法: node scripts/upload-single-image.js <本地图片路径> <OSS目标路径>
 * 示例: node scripts/upload-single-image.js ./new-pic.jpg uploads/products/cmpdknl8s00e511kwiy4tzjax/1.jpg
 */

const OSS = require("ali-oss");
const fs = require("fs");
const path = require("path");

const ACCESS_KEY_ID = process.env.OSS_ACCESS_KEY_ID || "OSS_ACCESS_KEY_ID_PLACEHOLDER";
const ACCESS_KEY_SECRET = process.env.OSS_ACCESS_KEY_SECRET || "OSS_ACCESS_KEY_SECRET_PLACEHOLDER";
const BUCKET = process.env.OSS_BUCKET || "usedfarmmach-oss";
const REGION = process.env.OSS_REGION || "oss-cn-beijing";

async function uploadFile(localFilePath, ossPath) {
  const client = new OSS({
    region: REGION,
    accessKeyId: ACCESS_KEY_ID,
    accessKeySecret: ACCESS_KEY_SECRET,
    bucket: BUCKET,
    secure: true,
  });

  console.log(`上传文件到 OSS:`);
  console.log(`  本地: ${localFilePath}`);
  console.log(`  OSS: ${ossPath}`);

  try {
    // 检查文件是否存在
    if (!fs.existsSync(localFilePath)) {
      throw new Error(`本地文件不存在: ${localFilePath}`);
    }

    // 上传文件（覆盖模式）
    const result = await client.put(ossPath, fs.createReadStream(localFilePath));
    console.log(`✓ 上传成功: ${result.url}`);
    console.log(`  文件大小: ${result.size} bytes`);
    
    return result;
  } catch (error) {
    console.error(`✗ 上传失败: ${error.message}`);
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error("用法: node upload-single-image.js <本地图片路径> <OSS目标路径>");
    console.error("示例: node upload-single-image.js ./new-pic.jpg uploads/products/cmpdknl8s00e511kwiy4tzjax/1.jpg");
    process.exit(1);
  }

  const [localFilePath, ossPath] = args;
  
  try {
    await uploadFile(localFilePath, ossPath);
    console.log("\n✓ 上传完成!");
  } catch (error) {
    console.error("\n✗ 上传过程中发生错误");
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { uploadFile };