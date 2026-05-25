const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');

dotenv.config();

async function testConnection() {
  console.log('Testing database connection...');
  const prisma = new PrismaClient();

  try {
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Database connection successful:', result);

    const userCount = await prisma.user.count();
    console.log(`📊 Total users in database: ${userCount}`);

    const existingUser = await prisma.user.findFirst();
    if (existingUser) {
      console.log('🔍 Sample user found:', {
        id: existingUser.id,
        email: existingUser.email,
        role: existingUser.role,
        companyName: existingUser.companyName
      });
    } else {
      console.log('⚠️ No users found in database');
    }

  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('Full error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();