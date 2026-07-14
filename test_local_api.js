// 模拟 Next.js API 路由，使用本地 env 变量测试豆包调用
require('dotenv').config({ path: '.env.local' });
const axios = require('axios');

const ARK_API_KEY = process.env.ARK_API_KEY;
const ARK_BASE_URL = process.env.ARK_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3";
const ARK_MODEL_ID = process.env.ARK_MODEL_ID || "doubao-seed-evolving";

console.log('ARK_API_KEY:', ARK_API_KEY ? '存在' : '缺失');
console.log('ARK_MODEL_ID:', ARK_MODEL_ID);
console.log('GOOGLE_API_KEY:', process.env.GOOGLE_API_KEY ? '存在' : '缺失');
console.log('OPENROUTER_API_KEY:', process.env.OPENROUTER_API_KEY ? '存在' : '缺失');

async function testDoubaoWithImage() {
  const imageUrl = "https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com/products%2Fimages%2Ftest%2Fplaceholder.jpg";
  try {
    const response = await axios.post(
      `${ARK_BASE_URL}/chat/completions`,
      {
        model: ARK_MODEL_ID,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "识别这张农机图片的品牌和型号，只返回JSON" },
            { type: "image_url", image_url: { url: imageUrl } }
          ]
        }],
        max_tokens: 500,
      },
      {
        headers: {
          Authorization: `Bearer ${ARK_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 60000,
      }
    );
    console.log("豆包图片调用 SUCCESS:", JSON.stringify(response.data, null, 2).substring(0, 300));
  } catch (error) {
    console.error("豆包图片调用 FAILED:", error.message);
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", JSON.stringify(error.response.data, null, 2).substring(0, 500));
    }
  }
}

testDoubaoWithImage();
