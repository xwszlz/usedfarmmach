const OSS = require("ali-oss");

const ACCESS_KEY_ID = process.env.OSS_ACCESS_KEY_ID || "OSS_ACCESS_KEY_ID_PLACEHOLDER";
const ACCESS_KEY_SECRET = process.env.OSS_ACCESS_KEY_SECRET || "OSS_ACCESS_KEY_SECRET_PLACEHOLDER";
const BUCKET = process.env.OSS_BUCKET || "usedfarmmach-oss";
const REGION = process.env.OSS_REGION || "oss-cn-beijing";

async function testOSS() {
  console.log("Testing OSS connection...");
  console.log(`Config: bucket=${BUCKET}, region=${REGION}`);
  
  const client = new OSS({
    region: REGION,
    accessKeyId: ACCESS_KEY_ID,
    accessKeySecret: ACCESS_KEY_SECRET,
    bucket: BUCKET,
    secure: true,
  });
  
  try {
    // 尝试列出bucket（有限制）
    const result = await client.list({ 'max-keys': 5 });
    console.log("✅ OSS connection successful!");
    console.log(`Found ${result.objects ? result.objects.length : 0} objects in bucket`);
    
    // 尝试检查一个已知的路径
    const testKey = "uploads/products/cmpdknkog00b311kwql4ortgt/";
    try {
      await client.head(testKey);
      console.log(`✅ Path exists: ${testKey}`);
    } catch (e) {
      console.log(`ℹ️  Path does not exist or not accessible: ${testKey}`);
    }
    
  } catch (error) {
    console.error("❌ OSS connection failed:", error.message);
    console.error("Full error:", error);
  }
}

testOSS().catch(console.error);