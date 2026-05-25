#!/usr/bin/env node

/*
 * 执行 SQL 脚本的工具脚本
 * 用于更新数据库中的产品图片和视频记录
 */

const fs = require('fs');
const path = require('path');

// 从 .env 文件读取数据库连接信息
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const databaseUrlMatch = envContent.match(/DATABASE_URL="([^"]+)"/);

if (!databaseUrlMatch) {
  console.error('❌ 无法从 .env 文件中找到 DATABASE_URL');
  process.exit(1);
}

const databaseUrl = databaseUrlMatch[1];
console.log('📡 数据库连接:', databaseUrl.replace(/:[^:@]*@/, ':********@')); // 隐藏密码

// 读取 SQL 文件
const sqlPath = path.join(__dirname, 'update-product-images.sql');
if (!fs.existsSync(sqlPath)) {
  console.error(`❌ 找不到 SQL 文件: ${sqlPath}`);
  process.exit(1);
}

const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
console.log(`📄 读取 SQL 文件: ${sqlPath}`);
console.log(`📊 SQL 文件大小: ${sqlContent.length} 字符`);

// 简单的 SQL 语句分割（按分号分割，忽略注释和空行）
const sqlStatements = sqlContent
  .split(';')
  .map(stmt => stmt.trim())
  .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
  .map(stmt => stmt + ';');

console.log(`📋 发现 ${sqlStatements.length} 条 SQL 语句`);

// 动态安装 pg 库
console.log('📦 正在检查并安装 pg 库...');
try {
  require('pg');
  console.log('✅ pg 库已安装');
} catch (e) {
  console.log('📥 正在安装 pg 库...');
  const { execSync } = require('child_process');
  try {
    execSync('npm install pg', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    console.log('✅ pg 库安装成功');
  } catch (installError) {
    console.error('❌ 安装 pg 库失败:', installError.message);
    console.log('\n💡 请手动安装 pg 库: npm install pg');
    process.exit(1);
  }
}

// 导入 pg 库
const { Client } = require('pg');

// 执行 SQL 语句
async function executeSQL() {
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false } // Neon PostgreSQL 需要 SSL
  });

  try {
    console.log('\n🔗 正在连接数据库...');
    await client.connect();
    console.log('✅ 数据库连接成功');

    console.log('\n🚀 开始执行 SQL 语句...');
    console.log('='.repeat(50));
    
    let successCount = 0;
    let skipCount = 0;
    
    for (let i = 0; i < sqlStatements.length; i++) {
      const sql = sqlStatements[i];
      
      // 跳过事务控制语句，后面会统一处理
      if (sql.includes('BEGIN') || sql.includes('COMMIT')) {
        console.log(`⏭️  [${i + 1}/${sqlStatements.length}] 跳过事务控制语句`);
        skipCount++;
        continue;
      }
      
      try {
        console.log(`📝 [${i + 1}/${sqlStatements.length}] 执行 SQL...`);
        const result = await client.query(sql);
        
        if (result.command === 'INSERT' && result.rowCount === 1) {
          console.log(`   ✅ 插入成功 (影响行数: ${result.rowCount})`);
          successCount++;
        } else if (result.command === 'INSERT' && result.rowCount === 0) {
          console.log(`   ⚠️  跳过重复记录 (ON CONFLICT DO NOTHING)`);
          skipCount++;
        } else {
          console.log(`   ✅ 执行成功 (命令: ${result.command}, 影响行数: ${result.rowCount})`);
          successCount++;
        }
      } catch (stmtError) {
        console.error(`❌ [${i + 1}/${sqlStatements.length}] SQL 语句执行失败:`);
        console.error(`   错误: ${stmtError.message}`);
        console.error(`   SQL: ${sql.substring(0, 150)}...`);
        console.log(`   ⏭️  跳过此语句，继续执行下一个...`);
        skipCount++;
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('🎉 SQL 执行完成！');
    console.log(`✅ 成功执行的语句: ${successCount} 条`);
    console.log(`⏭️  跳过的语句: ${skipCount} 条`);
    console.log(`📊 总计语句: ${sqlStatements.length} 条`);
    
    if (successCount > 0) {
      console.log('\n✅ 产品图片和视频记录已成功更新到数据库');
      console.log('🌐 请访问网站查看更新后的产品图片');
    } else {
      console.log('\n⚠️  没有新记录插入，可能所有记录都已存在');
    }
    
  } catch (error) {
    console.error('❌ 数据库操作失败:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 数据库连接已关闭');
  }
}

// 执行主函数
executeSQL().catch(console.error);