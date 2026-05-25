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

async function analyzeCoverQuality() {
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔗 正在连接数据库...');
    await client.connect();
    console.log('✅ 数据库连接成功\n');

    console.log('🏆 封面图质量分析报告');
    console.log('='.repeat(80));
    
    // 查询所有有图片的产品及其封面图信息
    const query = `
      SELECT 
        p.id,
        p."modelName",
        b."nameZh" as brand,
        pi.url as cover_image,
        pi."sortOrder" as cover_order,
        pi."isPrimary",
        (SELECT COUNT(*) FROM "ProductImage" WHERE "productId" = p.id) as total_images,
        (SELECT COUNT(*) FROM "ProductImage" WHERE "productId" = p.id AND url LIKE '%wechat_%') as wechat_images_count,
        EXISTS(SELECT 1 FROM "ProductImage" WHERE "productId" = p.id AND url LIKE '%wechat_%') as has_wechat_images
      FROM "Product" p
      JOIN "Brand" b ON p."brandId" = b.id
      JOIN "ProductImage" pi ON p.id = pi."productId" AND pi."isPrimary" = true
      WHERE EXISTS (SELECT 1 FROM "ProductImage" WHERE "productId" = p.id)
      ORDER BY b."nameZh", p."modelName"
    `;

    const result = await client.query(query);
    
    console.log(`📊 分析 ${result.rows.length} 个有封面图的产品\n`);
    
    // 分类统计
    const categories = {
      wechat: [],      // 使用wechat格式封面图
      nonWechat: [],   // 使用非wechat格式封面图
      oldFormat: [],   // 使用旧格式封面图 (如 1.jpg, 2.jpg等)
      needsUpgrade: [] // 有wechat图片但未使用
    };
    
    result.rows.forEach(row => {
      const product = {
        id: row.id,
        name: `${row.brand} ${row.modelName}`,
        coverImage: row.cover_image,
        coverOrder: row.cover_order,
        totalImages: row.total_images,
        wechatImagesCount: row.wechat_images_count,
        hasWechatImages: row.has_wechat_images
      };
      
      const coverImage = row.cover_image || '';
      
      if (coverImage.includes('wechat_')) {
        categories.wechat.push(product);
      } else {
        categories.nonWechat.push(product);
        
        // 检查是否是旧格式 (如 1.jpg, 2.jpg等数字文件名)
        const isOldFormat = /^\d+\.(jpg|jpeg|png|gif|webp)$/i.test(coverImage.split('/').pop());
        if (isOldFormat) {
          categories.oldFormat.push(product);
        }
        
        // 如果有wechat图片但未使用
        if (row.has_wechat_images) {
          categories.needsUpgrade.push(product);
        }
      }
    });
    
    console.log('📈 分类统计:');
    console.log(`- 使用 wechat 格式封面图: ${categories.wechat.length} 个产品 (${(categories.wechat.length/result.rows.length*100).toFixed(1)}%)`);
    console.log(`- 使用非 wechat 格式封面图: ${categories.nonWechat.length} 个产品 (${(categories.nonWechat.length/result.rows.length*100).toFixed(1)}%)`);
    console.log(`- 其中使用旧格式封面图 (如 1.jpg): ${categories.oldFormat.length} 个产品`);
    console.log(`- 有 wechat 图片但未使用: ${categories.needsUpgrade.length} 个产品\n`);
    
    // 使用wechat格式封面图的产品示例
    if (categories.wechat.length > 0) {
      console.log('✅ 已使用 wechat 格式封面图的产品 (示例):');
      categories.wechat.slice(0, 5).forEach(p => {
        console.log(`  • ${p.name}: ${p.coverImage} (${p.wechatImagesCount}张wechat图片)`);
      });
      if (categories.wechat.length > 5) {
        console.log(`  ... 还有 ${categories.wechat.length - 5} 个产品`);
      }
      console.log('');
    }
    
    // 需要升级的产品
    if (categories.needsUpgrade.length > 0) {
      console.log('🚨 需要升级封面图的产品 (有wechat图片但未使用):');
      categories.needsUpgrade.slice(0, 10).forEach(p => {
        console.log(`  • ${p.name}: 当前封面图 "${p.coverImage}"`);
        console.log(`     有 ${p.wechatImagesCount} 张wechat图片可升级`);
      });
      if (categories.needsUpgrade.length > 10) {
        console.log(`  ... 还有 ${categories.needsUpgrade.length - 10} 个产品需要升级`);
      }
      console.log('');
    }
    
    // 旧格式封面图的产品
    if (categories.oldFormat.length > 0) {
      console.log('📸 使用旧格式封面图的产品 (首页可能显示效果不佳):');
      categories.oldFormat.slice(0, 10).forEach(p => {
        console.log(`  • ${p.name}: "${p.coverImage}"`);
      });
      if (categories.oldFormat.length > 10) {
        console.log(`  ... 还有 ${categories.oldFormat.length - 10} 个产品`);
      }
      console.log('');
    }
    
    // 首页产品显示分析
    console.log('🏠 首页产品显示质量预测:');
    console.log('-'.repeat(60));
    
    // 模拟首页显示的产品 (最新12个活跃产品)
    const homeQuery = `
      SELECT 
        p.id,
        p."modelName",
        b."nameZh" as brand,
        pi.url as cover_image,
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
        console.log('⚠️  没有找到活跃产品');
      } else {
        const wechatCount = homeResult.rows.filter(r => r.image_type === '新格式').length;
        const oldCount = homeResult.rows.filter(r => r.image_type === '旧格式').length;
        
        console.log(`首页显示产品: ${homeResult.rows.length} 个`);
        console.log(`- 新格式封面图: ${wechatCount} 个 (${(wechatCount/homeResult.rows.length*100).toFixed(1)}%)`);
        console.log(`- 旧格式封面图: ${oldCount} 个 (${(oldCount/homeResult.rows.length*100).toFixed(1)}%)\n`);
        
        // 显示首页产品情况
        if (oldCount > 0) {
          console.log('📱 首页可能显示旧格式封面图的产品:');
          homeResult.rows.filter(r => r.image_type === '旧格式').forEach(row => {
            console.log(`  • ${row.brand} ${row.modelName}: "${row.cover_image}"`);
          });
        }
      }
    } catch (error) {
      console.log(`⚠️  查询首页产品时出错: ${error.message}`);
    }
    
    // 优化建议
    console.log('\n💡 优化建议:');
    console.log('-'.repeat(60));
    
    if (categories.needsUpgrade.length > 0) {
      console.log(`1. 立即升级 ${categories.needsUpgrade.length} 个产品的封面图:`);
      console.log(`   这些产品已经有wechat格式图片，只需将封面图切换到wechat图片`);
      
      // 生成优化推荐
      console.log(`\n2. 为旧格式封面图产品寻找更佳图片:`);
      console.log(`   检查 ${categories.oldFormat.length} 个使用1.jpg等旧格式的产品`);
      console.log(`   考虑重新上传整机图片或从现有图片中选择更合适的`);
    }
    
    if (categories.oldFormat.length > 0) {
      console.log(`\n3. 用户反馈问题聚焦:`);
      console.log(`   用户提到"现在首页的产品卡片显示的封面图优先采用整机的，漂亮的图片"`);
      console.log(`   主要问题是首页显示的 ${categories.oldFormat.length} 个产品使用了旧格式封面图`);
      console.log(`   这些旧图片可能不是整机图或质量不高`);
    }
    
    // 生成优化脚本建议
    console.log(`\n🛠️ 技术解决方案:`);
    console.log(`   1. 检查封面图选择算法 - 确保优先选择wechat格式图片`);
    console.log(`   2. 如果产品有wechat图片，强制使用wechat图片作为封面图`);
    console.log(`   3. 对于没有wechat图片的产品，检查是否有更好的图片可供选择`);
    
    // 检查封面图选择算法的潜在问题
    console.log(`\n🔍 封面图选择算法检查:`);
    
    // 随机选择一些有wechat图片但未使用的产品进行分析
    if (categories.needsUpgrade.length > 0) {
      console.log(`发现 ${categories.needsUpgrade.length} 个产品有wechat图片但未使用`);
      console.log(`这可能是封面图选择算法的bug，或者wechat图片不是最佳选择`);
      
      // 详细分析一个示例产品
      const exampleProduct = categories.needsUpgrade[0];
      console.log(`\n示例分析: ${exampleProduct.name}`);
      
      const detailQuery = `
        SELECT url, "sortOrder", "isPrimary"
        FROM "ProductImage"
        WHERE "productId" = $1
        ORDER BY "sortOrder"
        LIMIT 10
      `;
      
      const detailResult = await client.query(detailQuery, [exampleProduct.id]);
      
      console.log(`产品图片详情 (前${Math.min(10, detailResult.rows.length)}张):`);
      detailResult.rows.forEach(img => {
        const primaryMark = img.isPrimary ? '[封面]' : '      ';
        const wechatMark = img.url.includes('wechat_') ? '[wechat]' : '        ';
        console.log(`  ${primaryMark} ${wechatMark} 排序${img.sortOrder}: ${img.url}`);
      });
      
      // 检查wechat图片的排序位置
      const wechatImages = detailResult.rows.filter(img => img.url.includes('wechat_'));
      if (wechatImages.length > 0) {
        console.log(`\n💡 发现 ${wechatImages.length} 张wechat图片，排序位置: ${wechatImages.map(w => w.sortOrder).join(', ')}`);
        console.log(`   当前封面图排序: ${exampleProduct.coverOrder}`);
        console.log(`   建议: 将封面图切换到第一张wechat图片 (排序: ${wechatImages[0].sortOrder})`);
      }
    }
    
    console.log('\n🎯 下一步行动:');
    console.log('='.repeat(60));
    console.log('1. 运行封面图强制升级脚本，确保所有有wechat图片的产品都使用wechat格式封面图');
    console.log('2. 验证网站首页显示效果');
    console.log('3. 对于没有wechat图片的产品，考虑上传更多高质量的整机图片');
    console.log('4. 特别关注用户在截图中提到的三个产品，确保它们显示效果良好');

  } catch (error) {
    console.error('❌ 分析过程中出错:', error.message);
  } finally {
    await client.end();
    console.log('\n🔌 数据库连接已关闭');
  }
}

analyzeCoverQuality().catch(console.error);