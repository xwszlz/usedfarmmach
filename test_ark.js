const axios = require('axios');

const ARK_API_KEY = "9e702c89-90f5-4f26-a52b-aa9447c76b95";
const ARK_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";
const ARK_MODEL_ID = "doubao-seed-evolving";

async function test() {
  try {
    const response = await axios.post(
      `${ARK_BASE_URL}/chat/completions`,
      {
        model: ARK_MODEL_ID,
        messages: [{ role: "user", content: [{ type: "text", text: "Hello, are you working?" }] }],
        max_tokens: 50,
      },
      {
        headers: {
          Authorization: `Bearer ${ARK_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );
    console.log("SUCCESS:", JSON.stringify(response.data, null, 2).substring(0, 300));
  } catch (error) {
    console.error("FAILED:", error.message);
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", JSON.stringify(error.response.data, null, 2).substring(0, 500));
    }
  }
}

test();
