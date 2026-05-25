require('dotenv').config({ path: '.env' });
const { PrismaClient } = require('@prisma/client');

console.log('Testing database connection...');
console.log('DATABASE_URL:', process.env.DATABASE_URL);

const prisma = new PrismaClient();

async function test() {
  try {
    const count = await prisma.product.count();
    console.log(`✅ Database connected! Products count: ${count}`);
    
    // 测试查询特定产品
    const product = await prisma.product.findUnique({
      where: { id: 'cmpdknkog00b311kwql4ortgt' }
    });
    console.log(`✅ Product found: ${product?.modelName || 'Not found'}`);
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

test();