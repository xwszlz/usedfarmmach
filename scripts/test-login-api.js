const http = require('http');
const https = require('https');

// 测试登录API
async function testLoginAPI() {
  const serverUrl = 'http://localhost:3000';
  const loginUrl = `${serverUrl}/api/auth/login`;
  
  console.log('Testing login API at:', loginUrl);
  
  // 测试正确的凭证 (admin@agritrade.com / admin123)
  const testData = {
    correct: { email: 'admin@agritrade.com', password: 'admin123' },
    wrongEmail: { email: 'wrong@example.com', password: 'admin123' },
    wrongPassword: { email: 'admin@agritrade.com', password: 'wrongpassword' }
  };

  for (const [testName, data] of Object.entries(testData)) {
    console.log(`\n🔍 Test: ${testName}`, data);
    
    try {
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      const responseText = await response.text();
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = { raw: responseText };
      }
      
      console.log(`   Status: ${response.status} ${response.statusText}`);
      console.log(`   Response: ${JSON.stringify(responseData, null, 2)}`);
      
    } catch (error) {
      console.error(`   ❌ Request failed: ${error.message}`);
    }
  }
}

// 测试注册API
async function testRegisterAPI() {
  const serverUrl = 'http://localhost:3000';
  const registerUrl = `${serverUrl}/api/auth/register`;
  
  console.log('\n\nTesting register API at:', registerUrl);
  
  // 生成唯一邮箱以避免重复
  const uniqueEmail = `test${Date.now()}@example.com`;
  
  const testData = {
    success: {
      email: uniqueEmail,
      password: 'TestPassword123!',
      phone: '13800138000',
      companyName: '测试公司',
      country: 'CN',
      role: 'buyer'
    },
    duplicate: {
      email: 'admin@agritrade.com',
      password: 'TestPassword123!',
      phone: '13800138000',
      companyName: '测试公司',
      country: 'CN',
      role: 'buyer'
    },
    invalidEmail: {
      email: 'invalid-email',
      password: 'TestPassword123!',
      phone: '13800138000',
      companyName: '测试公司',
      country: 'CN',
      role: 'buyer'
    }
  };

  for (const [testName, data] of Object.entries(testData)) {
    console.log(`\n🔍 Test: ${testName}`, { ...data, password: '***' });
    
    try {
      const response = await fetch(registerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      const responseText = await response.text();
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = { raw: responseText };
      }
      
      console.log(`   Status: ${response.status} ${response.statusText}`);
      console.log(`   Response: ${JSON.stringify(responseData, null, 2)}`);
      
    } catch (error) {
      console.error(`   ❌ Request failed: ${error.message}`);
    }
  }
}

// 检查服务器是否运行
async function checkServerStatus() {
  try {
    const response = await fetch('http://localhost:3000', { method: 'HEAD' });
    console.log(`✅ Server is running at localhost:3000 (status: ${response.status})`);
    return true;
  } catch (error) {
    console.log(`❌ Server is not running at localhost:3000: ${error.message}`);
    console.log('Please start the development server first: npm run dev');
    return false;
  }
}

// 主函数
async function main() {
  console.log('🚀 Starting API tests...');
  
  const serverRunning = await checkServerStatus();
  if (!serverRunning) {
    console.log('\n📝 Starting development server in the background...');
    // 这里可以尝试启动服务器，但先不实现
    return;
  }
  
  await testLoginAPI();
  await testRegisterAPI();
  
  console.log('\n✅ All tests completed!');
}

// Mock fetch for Node.js < 18
if (!globalThis.fetch) {
  const nodeFetch = require('node-fetch');
  globalThis.fetch = nodeFetch;
}

main().catch(console.error);