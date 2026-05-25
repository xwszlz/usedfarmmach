const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUsers() {
  try {
    console.log('🔍 检查数据库用户数据...');
    
    // 统计用户总数
    const totalUsers = await prisma.user.count();
    console.log(`📊 用户总数: ${totalUsers}`);
    
    if (totalUsers > 0) {
      // 获取前5个用户作为示例
      const users = await prisma.user.findMany({
        take: 5,
        select: {
          id: true,
          email: true,
          role: true,
          companyName: true,
          country: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' }
      });
      
      console.log('👥 最新用户示例:');
      console.log(JSON.stringify(users, null, 2));
      
      // 按角色统计
      const roles = await prisma.user.groupBy({
        by: ['role'],
        _count: { role: true }
      });
      
      console.log('\n🏷️ 用户角色分布:');
      roles.forEach(r => {
        console.log(`  ${r.role}: ${r._count.role} 用户`);
      });
    } else {
      console.log('⚠️ 数据库中暂无用户数据');
      console.log('💡 提示: 需要创建用户才能登录');
    }
    
  } catch (error) {
    console.error('❌ 查询用户数据时出错:', error.message);
    console.error('详细信息:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();