const { PrismaClient } = require('@prisma/client');

async function testAuthDatabase() {
  console.log('Testing authentication database connection and setup...');
  const prisma = new PrismaClient();

  try {
    // Test database connection
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Database connection successful:', result);

    // Check if User table exists and has any users
    const userCount = await prisma.user.count();
    console.log(`📊 Total users in database: ${userCount}`);

    // List all users if any
    if (userCount > 0) {
      const users = await prisma.user.findMany({
        select: { id: true, email: true, role: true, companyName: true, createdAt: true }
      });
      console.log('👥 User list:', JSON.stringify(users, null, 2));
    } else {
      console.log('⚠️ No users found in database. Registration should work.');
    }

    // Check JWT_SECRET environment variable
    if (!process.env.JWT_SECRET) {
      console.error('❌ JWT_SECRET environment variable is missing!');
    } else {
      console.log('✅ JWT_SECRET environment variable is set (length:', process.env.JWT_SECRET.length, ')');
    }

    // Check other required environment variables
    const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET', 'NEXT_PUBLIC_OSS_BASE_URL'];
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        console.error(`❌ ${envVar} environment variable is missing!`);
      } else {
        console.log(`✅ ${envVar} is set`);
      }
    }

  } catch (error) {
    console.error('❌ Database connection or query failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Check environment variables before starting
console.log('Environment check:');
console.log('- DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('- JWT_SECRET exists:', !!process.env.JWT_SECRET);
console.log('- NODE_ENV:', process.env.NODE_ENV || 'not set');

testAuthDatabase();