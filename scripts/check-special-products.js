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

async function checkSpecialProducts() {
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔗 正在连接数据库...');
    await client.connect();
    console.log('✅ 数据库连接成功\n');

    console.log('🔍 检查特别关注产品封面图:');
    console.log('='.repeat(80));

    for (const product of specialProducts) {
      console.log(`\n📦 ${product.name} (ID: ${product.id})`);
      console.log('-'.repeat(60));
      
      // 查询产品基本信息和所有图片
      const query = `
        SELECT 
          p."modelName",
          b."nameZh" as brand,
          pi.id as image_id,
          pi.url,
          pi."sortOrder",
          pi."isPrimary",
          pi."productId"
        FROM "Product" p
        JOIN "Brand" b ON p."brandId" = b.id
        LEFT JOIN "ProductImage" pi ON p.id = pi."productId"
        WHERE p.id = $1
        ORDER BY pi."sortOrder"
      `;

      const result = await client.query(query, [product.id]);
      
      if (result.rows.length === 0) {
        console.log('❌ 未找到产品或图片');
        continue;
      }
      
      const productInfo = result.rows[0];
      console.log(`产品: ${productInfo.brand} ${productInfo.modelName}`);
      
      // 统计图片情况
      const totalImages = result.rows.filter(row => row.image_id).length;
      console.log(`图片总数: ${totalImages}`);
      
      // 检查封面图
      const primaryImages = result.rows.filter(row => row.isPrimary);
      console.log(`封面图数量: ${primaryImages.length}`);
      
      if (primaryImages.length === 1) {
        const primary = primaryImages[0];
        console.log(`✅ 封面图: ${primary.url}`);
        console.log(`   排序: ${primary.sortOrder}, 图片ID: ${primary.image_id}`);
        
        // 检查是否是wechat格式
        if (primary.url && primary.url.includes('wechat_')) {
          console.log(`   👌 使用新上传的 wechat 格式图片`);
        } else {
          console.log(`   ⚠️ 未使用 wechat 格式图片`);
        }
      } else if (primaryImages.length > 1) {
        console.log(`⚠️  有 ${primaryImages.length} 个封面图 (应该只有1个):`);
        primaryImages.forEach(img => {
          console.log(`   • ${img.url} (排序: ${img.sortOrder})`);
        });
      } else {
        console.log(`❌ 没有封面图 (isPrimary = true)`);
        
        // 如果没有封面图，显示可用的图片
        if (totalImages > 0) {
          console.log(`📋 可用的图片 (前5张):`);
          result.rows.slice(0, 5).forEach(row => {
            console.log(`   • 排序${row.sortOrder}: ${row.url}`);
          });
        }
      }
      
      // 显示wechat格式图片
      const wechatImages = result.rows.filter(row => row.url && row.url.includes('wechat_'));
      console.log(`\n📸 wechat格式图片: ${wechatImages.length} 张`);
      if (wechatImages.length > 0) {
        wechatImages.slice(0, 3).forEach(img => {
          const primaryMark = img.isPrimary ? '[封面]' : '      ';
          console.log(`   ${primaryMark} 排序${img.sortOrder}: ${img.url}`);
        });
        
        if (wechatImages.length > 3) {
          console.log(`   ... 还有 ${wechatImages.length - 3} 张 wechat 图片`);
        }
      }
    }

    // 检查整体封面图情况
    console.log('\n📊 整体封面图统计:');
    console.log('-'.repeat(60));
    
    const statsQuery = `
      SELECT 
        COUNT(DISTINCT p.id) as total_products_with_images,
        COUNT(DISTINCT CASE WHEN pi."isPrimary" = true THEN p.id END) as products_with_primary
      FROM "Product" p
      JOIN "ProductImage" pi ON p.id = pi."productId"
    `;
    
    const statsResult = await client.query(statsQuery);
    const total = statsResult.rows[0].total_products_with_images;
    const withPrimary = statsResult.rows[0].products_with_primary;
    
    console.log(`产品总数 (有图片的): ${total}`);
    console.log(`有封面图的产品数: ${withPrimary}`);
    console.log(`封面图覆盖率: ${withPrimary}/${total} (${((withPrimary / total) * 100).toFixed(1)}%)`);
    
    if (withPrimary === total) {
      console.log('🎉 所有有图片的产品都已设置封面图！');
    } else {
      console.log(`⚠️  还有 ${total - withPrimary} 个产品没有封面图`);
    }
    
    // 检查wechat格式封面图覆盖率
    const wechatQuery = `
      SELECT COUNT(DISTINCT p.id) as products_with_wechat_primary
      FROM "Product" p
      JOIN "ProductImage" pi ON p.id = pi."productId" AND pi."isPrimary" = true
      WHERE pi.url LIKE '%wechat_%'
    `;
    
    const wechatResult = await client.query(wechatQuery);
    const wechatPrimary = wechatResult.rows[0].products_with_wechat_primary;
    
    console.log(`\n📸 wechat格式封面图: ${wechatPrimary} 个产品`);
    console.log(`wechat格式封面图比例: ${((wechatPrimary / total) * 100).toFixed(1)}%`);
    
    if (wechatPrimary < total) {
      console.log(`💡 建议: ${total - wechatPrimary} 个产品可以使用wechat格式图片作为封面图`);
    }
    
    // 检查首页可能显示的产品
    console.log('\n🏠 检查首页可能显示的产品:');
    console.log('-'.repeat(60));
    
    const homeQuery = `
      SELECT 
        p."modelName",
        b."nameZh" as brand,
        pi.url as cover_image,
        pi."sortOrder",
        CASE 
          WHEN pi.url LIKE '%wechat_%' THEN '新格式'
          ELSE '旧格式'
        END as image_type
      FROM "Product" p
      JOIN "Brand" b ON p."brandId" = b.id
      JOIN "ProductImage" pi ON p.id = pi."productId" AND pi."isPrimary" = true
      WHERE p.status = 'active'
      ORDER BY p."createdAt" DESC
      LIMIT 12
    `;
    
    try {
      const homeResult = await client.query(homeQuery);
      
      if (homeResult.rows.length === 0) {
        console.log('⚠️  没有找到活跃产品，或者createdAt字段有问题');
      } else {
        console.log(`📱 首页可能显示的产品 (取最新12个活跃产品):`);
        
        let wechatCount = 0;
        let oldCount = 0;
        
        homeResult.rows.forEach((row, index) => {
          const num = (index + 1).toString().padStart(2, '0');
          const typeIcon = row.image_type === '新格式' ? '✅' : '⚠️ ';
          console.log(`${num}. ${typeIcon} ${row.brand} ${row.modelName}`);
          console.log(`     封面图: ${row.cover_image}`);
          
          if (row.image_type === '新格式') {
            wechatCount++;
          } else {
            oldCount++;
          }
        });
        
        console.log(`\n📊 首页封面图质量统计:`);
        console.log(`- 新格式 (wechat): ${wechatCount} 个`);
        console.log(`- 旧格式: ${oldCount} 个`);
        console.log(`- 新格式比例: ${((wechatCount / (wechatCount + oldCount)) * 100).toFixed(1)}%`);
      }
    } catch (error) {
      console.log(`⚠️  查询首页产品时出错: ${error.message}`);
      console.log(`   可能是createdAt字段名称问题，尝试修改查询`);
    }

  } catch (error) {
    console.error('❌ 检查过程中出错:', error.message);
  } finally {
    await client.end();
    console.log('\n🔌 数据库连接已关闭');
  }
}

checkSpecialProducts().catch(console.error);