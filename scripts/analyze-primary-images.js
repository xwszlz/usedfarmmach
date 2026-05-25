const { Client } = require('pg');
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

async function analyzePrimaryImages() {
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔗 正在连接数据库...');
    await client.connect();
    console.log('✅ 数据库连接成功\n');

    console.log('📊 分析产品封面图设置');
    console.log('='.repeat(80));

    // 查询所有产品及其封面图信息
    const query = `
      SELECT 
        p.id as product_id,
        p."modelName",
        b."nameZh" as brand,
        c."nameZh" as category,
        pi.url as primary_image_url,
        pi."isPrimary",
        pi."sortOrder" as primary_sort_order,
        total_images.total_count,
        total_images.primary_count
      FROM "Product" p
      JOIN "Brand" b ON p."brandId" = b.id
      JOIN "Category" c ON p."categoryId" = c.id
      LEFT JOIN "ProductImage" pi ON p.id = pi."productId" AND pi."isPrimary" = true
      LEFT JOIN (
        SELECT "productId", 
          COUNT(*) as total_count,
          SUM(CASE WHEN "isPrimary" = true THEN 1 ELSE 0 END) as primary_count
        FROM "ProductImage"
        GROUP BY "productId"
      ) total_images ON p.id = total_images."productId"
      WHERE total_images.total_count > 0
      ORDER BY b."nameZh", p."modelName"
    `;

    const result = await client.query(query);
    
    console.log(`📋 总计 ${result.rows.length} 个有图片的产品\n`);

    let productsWithoutPrimary = 0;
    let productsWithPrimary = 0;
    
    // 按产品显示信息
    for (const row of result.rows) {
      const hasPrimary = row.primary_image_url !== null;
      const status = hasPrimary ? '✅' : '❌';
      
      console.log(`${status} ${row.brand} ${row.modelName} (${row.category})`);
      console.log(`   产品ID: ${row.product_id}`);
      console.log(`   图片总数: ${row.total_count}`);
      console.log(`   封面图数量: ${row.primary_count || 0}`);
      
      if (hasPrimary) {
        console.log(`   当前封面图: ${row.primary_image_url}`);
        console.log(`   排序位置: ${row.primary_sort_order}`);
        productsWithPrimary++;
      } else {
        console.log(`   当前封面图: 未设置`);
        productsWithoutPrimary++;
      }
      
      // 获取该产品的所有图片，用于分析
      const imagesQuery = `
        SELECT url, "sortOrder", "isPrimary"
        FROM "ProductImage"
        WHERE "productId" = $1
        ORDER BY "sortOrder"
        LIMIT 5
      `;
      const imagesResult = await client.query(imagesQuery, [row.product_id]);
      
      if (imagesResult.rows.length > 0) {
        console.log(`   前 ${imagesResult.rows.length} 张图片:`);
        imagesResult.rows.forEach(img => {
          const prefix = img.isPrimary ? '★ ' : '  ';
          console.log(`     ${prefix}${img.url} (排序: ${img.sortOrder})`);
        });
      }
      
      console.log('');
    }

    console.log('='.repeat(80));
    console.log('📈 统计分析:');
    console.log(`- 有图片的产品总数: ${result.rows.length}`);
    console.log(`- 已设置封面图的产品: ${productsWithPrimary}`);
    console.log(`- 未设置封面图的产品: ${productsWithoutPrimary}`);
    console.log(`- 封面图覆盖率: ${(productsWithPrimary / result.rows.length * 100).toFixed(1)}%`);
    
    // 分析封面图可能存在的问题
    console.log('\n🔍 潜在问题分析:');
    
    // 1. 检查封面图文件名是否合理（是否为横拍图、整机图）
    const problemProducts = [];
    for (const row of result.rows) {
      if (row.primary_image_url) {
        const filename = path.basename(row.primary_image_url);
        // 简单的启发式规则：检查文件名
        // 假设"整机的、漂亮的"图片通常是横拍图，文件名可能包含特定模式
        // 这里只是示例，实际需要更复杂的规则
        const isWechatFormat = filename.startsWith('wechat_');
        const isJpg = filename.toLowerCase().endsWith('.jpg') || filename.toLowerCase().endsWith('.jpeg');
        const hasNumber = /\d/.test(filename);
        
        if (!isWechatFormat || !isJpg || !hasNumber) {
          problemProducts.push({
            product: `${row.brand} ${row.modelName}`,
            url: row.primary_image_url,
            reason: '文件名不符合预期格式'
          });
        }
      }
    }
    
    if (problemProducts.length > 0) {
      console.log(`- 发现 ${problemProducts.length} 个产品可能需要优化封面图:`);
      problemProducts.forEach(p => {
        console.log(`  • ${p.product}: ${p.url} (${p.reason})`);
      });
    } else {
      console.log('- 所有封面图文件名格式看起来正常');
    }
    
    // 2. 检查是否有多个封面图的产品
    const multiplePrimaryQuery = `
      SELECT p.id, p."modelName", b."nameZh" as brand, 
             COUNT(pi.id) as primary_count
      FROM "Product" p
      JOIN "Brand" b ON p."brandId" = b.id
      JOIN "ProductImage" pi ON p.id = pi."productId" AND pi."isPrimary" = true
      GROUP BY p.id, p."modelName", b."nameZh"
      HAVING COUNT(pi.id) > 1
    `;
    
    const multiplePrimaryResult = await client.query(multiplePrimaryQuery);
    if (multiplePrimaryResult.rows.length > 0) {
      console.log(`- 发现 ${multiplePrimaryResult.rows.length} 个产品有多个封面图:`);
      multiplePrimaryResult.rows.forEach(p => {
        console.log(`  • ${p.brand} ${p.modelName}: ${p.primary_count} 个封面图`);
      });
    }
    
  } catch (error) {
    console.error('❌ 分析过程中出错:', error.message);
  } finally {
    await client.end();
    console.log('\n🔌 数据库连接已关闭');
  }
}

analyzePrimaryImages().catch(console.error);