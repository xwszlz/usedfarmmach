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

// 特别关注的产品（用户截图中的三个核心产品）
const specialProducts = [
  { id: 'cmpdknkog00b311kwql4ortgt', name: 'Orkel DENS-X (#8截图)' },
  { id: 'cmpfohy2g001dkrh55093csbq', name: '库恩 890大方捆 (#10截图)' },
  { id: 'cmpfohxx30001krh5pv5bx5yc', name: '克罗尼 1270XC (#11截图)' }
];

async function verifyCovers() {
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔗 正在连接数据库验证封面图...');
    await client.connect();
    console.log('✅ 数据库连接成功\n');

    console.log('🔍 验证特别关注产品封面图:');
    console.log('='.repeat(60));

    for (const product of specialProducts) {
      const query = `
        SELECT 
          p."modelName",
          b."nameZh" as brand,
          pi.url as coverImage,
          pi."sortOrder",
          pi."isPrimary"
        FROM "Product" p
        JOIN "Brand" b ON p."brandId" = b.id
        LEFT JOIN "ProductImage" pi ON p.id = pi."productId" AND pi."isPrimary" = true
        WHERE p.id = $1
      `;

      const result = await client.query(query, [product.id]);

      if (result.rows.length === 0) {
        console.log(`❌ ${product.name}: 未找到产品信息`);
      } else {
        const row = result.rows[0];
        if (row.coverImage) {
          console.log(`✅ ${product.name}: ${row.brand} ${row.modelName}`);
          console.log(`   封面图: ${row.coverImage}`);
          console.log(`   排序: ${row.sortOrder}, 是否是封面图: ${row.isPrimary}`);
          
          // 检查是否是我们期望的wechat格式图片
          if (row.coverImage.includes('wechat_')) {
            console.log(`   👍 使用新上传的 wechat 格式图片`);
          } else {
            console.log(`   ⚠️ 未使用 wechat 格式图片，可能需要优化`);
          }
        } else {
          console.log(`❌ ${product.name}: ${row.brand} ${row.modelName} 没有封面图`);
        }
      }
      console.log('');
    }

    // 检查整体封面图覆盖率
    const coverageQuery = `
      SELECT 
        COUNT(DISTINCT p.id) as total_products,
        COUNT(DISTINCT CASE WHEN pi."isPrimary" = true THEN p.id END) as products_with_primary
      FROM "Product" p
      LEFT JOIN "ProductImage" pi ON p.id = pi."productId" AND pi."isPrimary" = true
      WHERE EXISTS (SELECT 1 FROM "ProductImage" WHERE "productId" = p.id)
    `;

    const coverageResult = await client.query(coverageQuery);
    const total = coverageResult.rows[0].total_products;
    const withPrimary = coverageResult.rows[0].products_with_primary;
    
    console.log('📊 整体封面图覆盖率:');
    console.log(`- 有图片的产品总数: ${total}`);
    console.log(`- 有封面图的产品数: ${withPrimary}`);
    console.log(`- 封面图覆盖率: ${withPrimary}/${total} (${((withPrimary / total) * 100).toFixed(1)}%)`);

    if (withPrimary === total) {
      console.log('🎉 所有有图片的产品都已设置封面图！');
    } else {
      console.log(`⚠️  还有 ${total - withPrimary} 个产品没有封面图`);
    }

    // 检查一些随机产品的封面图
    console.log('\n🔍 随机产品封面图示例:');
    console.log('='.repeat(60));
    
    const sampleQuery = `
      SELECT 
        p."modelName",
        b."nameZh" as brand,
        pi.url as coverImage,
        pi."sortOrder"
      FROM "Product" p
      JOIN "Brand" b ON p."brandId" = b.id
      JOIN "ProductImage" pi ON p.id = pi."productId" AND pi."isPrimary" = true
      WHERE EXISTS (SELECT 1 FROM "ProductImage" WHERE "productId" = p.id)
        AND pi.url LIKE '%wechat_%'
      ORDER BY RANDOM()
      LIMIT 5
    `;

    const sampleResult = await client.query(sampleQuery);
    
    if (sampleResult.rows.length > 0) {
      console.log('📸 使用 wechat 格式封面图的产品示例:');
      sampleResult.rows.forEach(row => {
        console.log(`  • ${row.brand} ${row.modelName}: ${row.coverImage}`);
      });
    } else {
      console.log('⚠️ 未找到使用 wechat 格式封面图的产品');
    }

    // 检查首页产品卡片可能显示的产品
    console.log('\n🏠 首页产品卡片封面图验证:');
    console.log('='.repeat(60));
    
    const homePageQuery = `
      SELECT 
        p."modelName",
        b."nameZh" as brand,
        pi.url as coverImage,
        pi."sortOrder",
        CASE 
          WHEN pi.url LIKE '%wechat_%' THEN '✅ 新格式'
          ELSE '⚠️ 旧格式'
        END as image_type
      FROM "Product" p
      JOIN "Brand" b ON p."brandId" = b.id
      JOIN "ProductImage" pi ON p.id = pi."productId" AND pi."isPrimary" = true
      WHERE p.status = 'ACTIVE'
      ORDER BY p."createdAt" DESC
      LIMIT 12
    `;

    const homePageResult = await client.query(homePageQuery);
    
    console.log('📱 首页显示的产品封面图情况 (取最新12个活跃产品):');
    let wechatCount = 0;
    let oldCount = 0;
    
    homePageResult.rows.forEach(row => {
      console.log(`  • ${row.brand} ${row.modelName}`);
      console.log(`    封面图: ${row.coverImage} (${row.image_type})`);
      console.log(`    排序: ${row.sortOrder}`);
      
      if (row.image_type === '✅ 新格式') {
        wechatCount++;
      } else {
        oldCount++;
      }
    });
    
    console.log(`\n📊 首页产品封面图统计:`);
    console.log(`- 新格式 (wechat_) 图片: ${wechatCount}`);
    console.log(`- 旧格式图片: ${oldCount}`);
    console.log(`- 新格式比例: ${((wechatCount / (wechatCount + oldCount)) * 100).toFixed(1)}%`);

    console.log('\n💡 建议:');
    if (wechatCount === 12) {
      console.log('✅ 首页所有产品都使用了新的 wechat 格式封面图，非常棒！');
    } else if (wechatCount >= 6) {
      console.log('✅ 首页产品基本使用了新的 wechat 格式封面图，效果良好');
    } else {
      console.log('⚠️  首页产品中旧格式封面图较多，可能需要进一步优化');
      console.log('   可以考虑手动调整封面图选择，或者上传更多高质量的整机图片');
    }

  } catch (error) {
    console.error('❌ 验证过程中出错:', error.message);
  } finally {
    await client.end();
    console.log('\n🔌 数据库连接已关闭');
  }
}

verifyCovers().catch(console.error);