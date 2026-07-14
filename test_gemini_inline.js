require('dotenv').config({ path: '.env.local' });
const axios = require('axios');

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const imageUrl = "https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com/uploads/products/cmreb897u000lrd8vw4a6i2n9/image_0_1783650123660.jpg?x-oss-process=image/format,webp/quality,q_75/resize,m_fixed,w_600";

async function downloadImage(url) {
  const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
  return Buffer.from(response.data, 'binary').toString('base64');
}

async function test() {
  try {
    const base64 = await downloadImage(imageUrl);
    console.log('Downloaded image, base64 length:', base64.length);
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
      {
        contents: [{
          role: "user",
          parts: [
            { text: "识别这张农机图片的品牌和型号，只返回JSON" },
            { inline_data: { mime_type: "image/jpeg", data: base64 } }
          ]
        }],
        generationConfig: {
          response_mime_type: "application/json",
          max_output_tokens: 800,
        },
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 45000,
      }
    );
    console.log("SUCCESS:", JSON.stringify(response.data, null, 2).substring(0, 500));
  } catch (error) {
    console.error("FAILED:", error.message);
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", JSON.stringify(error.response.data, null, 2).substring(0, 800));
    }
  }
}

test();
