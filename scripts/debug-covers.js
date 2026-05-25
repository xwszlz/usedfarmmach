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

async function debugCovers() {
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔗 正在连接数据库...');
    await client.connect();
    console.log('✅ 数据库连接成功\n');

    console.log('🔍 详细调试三个重点关注产品:');
    console.log('='.repeat(80));

    for (const product of specialProducts) {
      console.log(`\n📦 产品: ${product.name} (ID: ${product.id})`);
      console.log('-'.repeat(80));
      
      // 1. 检查产品基本信息
      const productQuery = `
        SELECT 
          p."modelName",
          b."nameZh" as brand,
          p.status,
          p."createdAt"
        FROM "Product" p
        JOIN "Brand" b ON p."brandId" = b.id
        WHERE p.id = $1
      `;

      const productResult = await client.query(productQuery, [product.id]);
      
      if (productResult.rows.length === 0) {
        console.log(`❌ 未找到产品信息`);
        continue;
      }
      
      const productInfo = productResult.rows[0];
      console.log(`基本信息: ${productInfo.brand} ${productInfo.modelName}`);
      console.log(`状态: ${productInfo.status}, 创建时间: ${productInfo.createdAt}`);
      
      // 2. 检查产品所有图片
      const imagesQuery = `
        SELECT 
          id,
          url,
          "sortOrder",
          "isPrimary",
          "createdAt"
        FROM "ProductImage"
        WHERE "productId" = $1
        ORDER BY "sortOrder"
      `;

      const imagesResult = await client.query(imagesQuery, [product.id]);
      
      console.log(`📸 产品图片数量: ${imagesResult.rows.length}`);
      
      if (imagesResult.rows.length === 0) {
        console.log(`⚠️  该产品没有任何图片`);
        continue;
      }
      
      // 检查封面图设置
      const primaryImages = imagesResult.rows.filter(img => img.isPrimary === true);
      console.log(`🖼️  封面图数量: ${primaryImages.length}`);
      
      if (primaryImages.length === 0) {
        console.log(`❌ 没有设置封面图 (isPrimary = true)`);
      } else if (primaryImages.length === 1) {
        console.log(`✅ 有封面图: ${primaryImages[0].url}`);
        console.log(`   排序: ${primaryImages[0].sortOrder}, 图片ID: ${primaryImages[0].id}`);
        
        // 检查是否是wechat格式
        if (primaryImages[0].url && primaryImages[0].url.includes('wechat_')) {
          console.log(`   ✅ 使用新上传的 wechat 格式图片`);
        } else {
          console.log(`   ⚠️ 未使用 wechat 格式图片`);
        }
      } else {
        console.log(`⚠️  有 ${primaryImages.length} 个封面图 (应该只有1个)`);
        primaryImages.forEach((img, idx) => {
          console.log(`   ${idx+1}. ${img.url} (排序: ${img.sortOrder})`);
        });
      }
      
      // 显示所有图片（前5张）
      console.log(`\n📋 产品所有图片 (前${Math.min(5, imagesResult.rows.length)}张):`);
      imagesResult.rows.slice(0, 5).forEach(img => {
        const primaryMark = img.isPrimary ? '[封面]' : '      ';
        const wechatMark = img.url && img.url.includes('wechat_') ? '[wechat]' : '        ';
        console.log(`   ${primaryMark} ${wechatMark} 排序${img.sortOrder}: ${img.url}`);
      });
      
      if (imagesResult.rows.length > 5) {
        console.log(`   ... 还有 ${imagesResult.rows.length - 5} 张图片未显示`);
      }
      
      // 3. 检查封面图修复脚本是否成功执行
      console.log(`\n🔍 检查封面图质量问题:`);
      
      // 寻找wechat格式图片
      const wechatImages = imagesResult.rows.filter(img => img.url && img.url.includes('wechat_'));
      console.log(`   wechat格式图片数量: ${wechatImages.length}`);
      
      if (wechatImages.length > 0) {
        // 检查wechat图片是否是封面图
        const wechatPrimary = wechatImages.filter(img => img.isPrimary);
        if (wechatPrimary.length > 0) {
          console.log(`   ✅ 已有wechat格式图片作为封面图`);
        } else {
          console.log(`   ⚠️  有wechat格式图片但不是封面图`);
          console.log(`      建议将封面图设置为wechat图片，因为它们通常质量更高`);
          
          // 找到第一张wechat图片
          const firstWechat = wechatImages.sort((a, b) => a.sortOrder - b.sortOrder)[0];
          console.log(`      推荐封面图: ${firstWechat.url} (排序: ${firstWechat.sortOrder})`);
        }
      } else {
        console.log(`   ⚠️  没有wechat格式图片，封面图可能不是最新上传的`);
        
        // 检查是否有其他高质量图片（比如文件名中包含"整机"、"全景"等关键词）
        const qualityKeywords = ['整机', '全景', '正面', '展示', 'overview', 'full', 'machine'];
        const qualityImages = imagesResult.rows.filter(img => {
          if (!img.url) return false;
          const filename = img.url.toLowerCase();
          return qualityKeywords.some(keyword => filename.includes(keyword.toLowerCase()));
        });
        
        if (qualityImages.length > 0) {
          console.log(`   💡 找到 ${qualityImages.length} 张可能的高质量图片`);
          qualityImages.slice(0, 3).forEach(img => {
            console.log(`      候选: ${img.url} (排序: ${img.sortOrder})`);
          });
        }
      }
    }

    // 检查数据库中的ProductImage表结构
    console.log('\n📊 检查ProductImage表结构:');
    console.log('-'.repeat(80));
    
    const tableQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'ProductImage'
      ORDER BY ordinal_position
    `;

    const tableResult = await client.query(tableQuery);
    
    console.log('ProductImage表字段:');
    tableResult.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} (可空: ${row.is_nullable})`);
    });
    
    // 检查isPrimary字段的索引
    console.log('\n🔍 检查isPrimary字段索引:');
    const indexQuery = `
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'ProductImage'
        AND indexname LIKE '%primary%'
    `;
    
    const indexResult = await client.query(indexQuery);
    
    if (indexResult.rows.length > 0) {
      console.log('索引信息:');
      indexResult.rows.forEach(row => {
        console.log(`  ${row.indexname}: ${row.indexdef}`);
      });
    } else {
      console.log('没有找到isPrimary相关索引');
    }
    
    // 统计封面图情况
    console.log('\n📈 整体封面图统计:');
    console.log('-'.repeat(80));
    
    const statsQuery = `
      WITH product_stats AS (
        SELECT 
          p.id,
          COUNT(pi.id) as image_count,
          COUNT(CASE WHEN pi."isPrimary" = true THEN 1 END) as primary_count,
          BOOL_OR(pi.url LIKE '%wechat_%') as has_wechat,
          BOOL_OR(pi."isPrimary" = true AND pi.url LIKE '%wechat_%') as primary_is_wechat
        FROM "Product" p
        LEFT JOIN "ProductImage" pi ON p.id = pi."productId"
        GROUP BY p.id
      )
      SELECT 
        COUNT(*) as total_products,
        COUNT(CASE WHEN image_count > 0 THEN 1 END) as products_with_images,
        COUNT(CASE WHEN primary_count > 0 THEN 1 END) as products_with_primary,
        COUNT(CASE WHEN has_wechat = true THEN 1 END) as products_with_wechat,
        COUNT(CASE WHEN primary_is_wechat = true THEN 1 END) as products_with_wechat_primary
      FROM product_stats
    `;
    
    const statsResult = await client.query(statsQuery);
    const stats = statsResult.rows[0];
    
    console.log(`产品总数: ${stats.total_products}`);
    console.log(`有图片的产品: ${stats.products_with_images}`);
    console.log(`有封面图的产品: ${stats.products_with_primary}`);
    console.log(`有wechat图片的产品: ${stats.products_with_wechat}`);
    console.log(`wechat图片作为封面图的产品: ${stats.products_with_wechat_primary}`);
    
    if (stats.products_with_images > 0) {
      const primaryRate = (stats.products_with_primary / stats.products_with_images * 100).toFixed(1);
      const wechatPrimaryRate = (stats.products_with_wechat_primary / stats.products_with_images * 100).toFixed(1);
      
      console.log(`\n📊 覆盖率:`);
      console.log(`- 封面图覆盖率: ${primaryRate}%`);
      console.log(`- wechat封面图覆盖率: ${wechatPrimaryRate}%`);
      
      if (parseFloat(primaryRate) < 100) {
        console.log(`\n⚠️  封面图覆盖率不足100%，需要修复`);
      }
      
      if (parseFloat(wechatPrimaryRate) < 50) {
        console.log(`\n💡 建议: 只有 ${wechatPrimaryRate}% 的产品使用wechat格式封面图`);
        console.log(`   可以运行优化脚本，让更多产品使用高质量封面图`);
      }
    }

  } catch (error) {
    console.error('❌ 调试过程中出错:', error.message);
  } finally {
    await client.end();
    console.log('\n🔌 数据库连接已关闭');
  }
}

debugCovers().catch(console.error);