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

// 需要检查的产品ID列表
const productIds = [
  'cmpdknkog00b311kwql4ortgt', // 奥库DENS-X
  'cmpdknj9v004b11kwqvki68wr', // 迪尔7250
  'cmpfohy2g001dkrh55093csbq', // 库恩1290
  'cmpfohxx30001krh5pv5bx5yc', // 纽荷兰1270
  'cmpdknkb2009911kwv7u98vpe', // 纽荷兰1290
  'cmpdknjh6004x11kwkz5gvrbo', // 纽荷兰5070小方捆
  'cmpdknle000fd11kwwfbic4p8', // 美迪3300
];

async function verifyUploads() {
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔗 正在连接数据库...');
    await client.connect();
    console.log('✅ 数据库连接成功\n');

    console.log('📊 验证产品图片和视频上传结果');
    console.log('='.repeat(50));

    for (const productId of productIds) {
      // 查询产品基本信息
      const productQuery = `
        SELECT p."modelName", b."nameZh" as brand, c."nameZh" as category
        FROM "Product" p
        JOIN "Brand" b ON p."brandId" = b.id
        JOIN "Category" c ON p."categoryId" = c.id
        WHERE p.id = $1
      `;
      const productResult = await client.query(productQuery, [productId]);
      
      if (productResult.rows.length === 0) {
        console.log(`❌ 产品ID ${productId} 不存在`);
        continue;
      }

      const product = productResult.rows[0];
      
      // 查询图片数量
      const imageQuery = `
        SELECT COUNT(*) as image_count
        FROM "ProductImage"
        WHERE "productId" = $1
      `;
      const imageResult = await client.query(imageQuery, [productId]);
      
      // 查询视频数量
      const videoQuery = `
        SELECT COUNT(*) as video_count
        FROM "ProductVideo"
        WHERE "productId" = $1
      `;
      const videoResult = await client.query(videoQuery, [productId]);

      console.log(`📦 产品: ${product.brand} ${product.modelName} (${product.category})`);
      console.log(`   📷 图片数量: ${imageResult.rows[0].image_count}`);
      console.log(`   🎬 视频数量: ${videoResult.rows[0].video_count}`);
      
      // 显示示例图片URL（前3张）
      const sampleImagesQuery = `
        SELECT url, "sortOrder", "isPrimary"
        FROM "ProductImage"
        WHERE "productId" = $1
        ORDER BY "sortOrder"
        LIMIT 3
      `;
      const sampleImagesResult = await client.query(sampleImagesQuery, [productId]);
      
      if (sampleImagesResult.rows.length > 0) {
        console.log('   📸 示例图片:');
        sampleImagesResult.rows.forEach(img => {
          console.log(`      - ${img.url} ${img.isPrimary ? '(主图)' : ''}`);
        });
      }
      
      console.log('');
    }

    // 统计总数
    const totalImagesQuery = `SELECT COUNT(*) as total FROM "ProductImage"`;
    const totalImagesResult = await client.query(totalImagesQuery);
    
    const totalVideosQuery = `SELECT COUNT(*) as total FROM "ProductVideo"`;
    const totalVideosResult = await client.query(totalVideosQuery);
    
    console.log('='.repeat(50));
    console.log('📈 数据库统计摘要:');
    console.log(`- 总图片记录: ${totalImagesResult.rows[0].total}`);
    console.log(`- 总视频记录: ${totalVideosResult.rows[0].total}`);
    
  } catch (error) {
    console.error('❌ 验证过程中出错:', error.message);
  } finally {
    await client.end();
    console.log('\n🔌 数据库连接已关闭');
  }
}

verifyUploads().catch(console.error);