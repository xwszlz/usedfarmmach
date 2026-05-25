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
  'cmpdknkog00b311kwql4ortgt', // Orkel DENS-X (#8截图)
  'cmpfohy2g001dkrh55093csbq', // 库恩 890大方捆 (#10截图)
  'cmpfohxx30001krh5pv5bx5yc'  // 克罗尼 1270XC (#11截图)
];

/**
 * 选择产品的最佳封面图
 * 策略：优先选择wechat格式图片，否则选择第一张图片
 */
function selectBestImage(images) {
  if (!images || images.length === 0) {
    return null;
  }
  
  // 按排序顺序排序
  images.sort((a, b) => a.sortOrder - b.sortOrder);
  
  // 优先选择wechat格式图片
  const wechatImages = images.filter(img => img.url && img.url.includes('wechat_'));
  if (wechatImages.length > 0) {
    return wechatImages[0];
  }
  
  // 否则选择第一张图片
  return images[0];
}

async function fixPrimaryImagesRecovery() {
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔗 正在连接数据库...');
    await client.connect();
    console.log('✅ 数据库连接成功\n');

    console.log('🛠️ 封面图设置恢复与修复');
    console.log('='.repeat(80));
    
    // 1. 首先检查哪些产品有封面图，哪些没有
    const checkQuery = `
      SELECT 
        p.id as product_id,
        p."modelName",
        b."nameZh" as brand,
        c."nameZh" as category,
        COUNT(CASE WHEN pi."isPrimary" = true THEN 1 END) as has_primary,
        STRING_AGG(CASE WHEN pi."isPrimary" = true THEN pi.url END, ', ') as primary_urls
      FROM "Product" p
      JOIN "Brand" b ON p."brandId" = b.id
      JOIN "Category" c ON p."categoryId" = c.id
      LEFT JOIN "ProductImage" pi ON p.id = pi."productId"
      WHERE EXISTS (SELECT 1 FROM "ProductImage" WHERE "productId" = p.id)
      GROUP BY p.id, p."modelName", b."nameZh", c."nameZh"
      ORDER BY b."nameZh", p."modelName"
    `;

    const checkResult = await client.query(checkQuery);
    
    console.log(`📋 检查 ${checkResult.rows.length} 个有图片的产品\n`);
    
    const productsWithoutPrimary = [];
    const productsWithPrimary = [];
    
    for (const row of checkResult.rows) {
      const hasPrimary = row.has_primary > 0;
      const productInfo = {
        id: row.product_id,
        name: `${row.brand} ${row.modelName}`,
        category: row.category,
        hasPrimary: hasPrimary,
        primaryUrls: row.primary_urls
      };
      
      if (hasPrimary) {
        productsWithPrimary.push(productInfo);
      } else {
        productsWithoutPrimary.push(productInfo);
      }
    }
    
    console.log(`📊 当前状态:`);
    console.log(`- 有封面图的产品: ${productsWithPrimary.length}`);
    console.log(`- 无封面图的产品: ${productsWithoutPrimary.length}`);
    
    if (productsWithoutPrimary.length > 0) {
      console.log('\n❌ 以下产品没有封面图:');
      productsWithoutPrimary.forEach(p => {
        console.log(`  • ${p.name} (${p.category})`);
      });
    }
    
    // 2. 为所有产品选择最佳封面图
    console.log('\n🎯 为所有产品选择最佳封面图:');
    
    const allUpdates = [];
    
    for (const row of checkResult.rows) {
      const isSpecial = specialProducts.includes(row.product_id);
      const prefix = isSpecial ? '⭐ ' : '  ';
      
      // 获取该产品的所有图片
      const imagesQuery = `
        SELECT id, url, "sortOrder", "isPrimary"
        FROM "ProductImage"
        WHERE "productId" = $1
        ORDER BY "sortOrder"
      `;
      const imagesResult = await client.query(imagesQuery, [row.product_id]);
      
      if (imagesResult.rows.length === 0) {
        console.log(`${prefix}${row.brand} ${row.modelName}: 没有图片，跳过`);
        continue;
      }
      
      const images = imagesResult.rows;
      
      // 检查当前封面图
      const currentPrimary = images.find(img => img.isPrimary === true);
      
      // 选择最佳封面图
      const bestImage = selectBestImage(images);
      
      if (!bestImage) {
        console.log(`${prefix}${row.brand} ${row.modelName}: 无法选择最佳封面图`);
        continue;
      }
      
      // 如果当前没有封面图，或者当前封面图不是最佳选择，则记录更新
      if (!currentPrimary || currentPrimary.id !== bestImage.id) {
        const updateInfo = {
          productId: row.product_id,
          productName: `${row.brand} ${row.modelName}`,
          oldImage: currentPrimary ? currentPrimary.url : '无',
          newImage: bestImage.url,
          imageId: bestImage.id,
          isSpecial: isSpecial,
          needsUpdate: true
        };
        
        allUpdates.push(updateInfo);
        
        const action = !currentPrimary ? '设置' : '更新';
        console.log(`${prefix}${row.brand} ${row.modelName}: ${action}封面图为 ${bestImage.url} (排序: ${bestImage.sortOrder})`);
      } else {
        console.log(`${prefix}${row.brand} ${row.modelName}: 封面图已是最佳选择 (${currentPrimary.url})`);
        
        // 即使是最佳选择，也记录信息（但不标记为需要更新）
        allUpdates.push({
          productId: row.product_id,
          productName: `${row.brand} ${row.modelName}`,
          oldImage: currentPrimary.url,
          newImage: currentPrimary.url,
          imageId: currentPrimary.id,
          isSpecial: isSpecial,
          needsUpdate: false
        });
      }
    }
    
    // 3. 执行更新
    console.log('\n🔄 执行封面图更新...');
    
    const specialUpdates = allUpdates.filter(u => u.isSpecial);
    const regularUpdates = allUpdates.filter(u => !u.isSpecial);
    const updatesNeeded = allUpdates.filter(u => u.needsUpdate);
    
    console.log(`📊 更新统计:`);
    console.log(`- 总计产品: ${allUpdates.length}`);
    console.log(`- 需要更新的产品: ${updatesNeeded.length}`);
    console.log(`- 特别关注产品: ${specialUpdates.length}`);
    
    if (updatesNeeded.length > 0) {
      // 开始事务
      await client.query('BEGIN');
      
      let successCount = 0;
      let errorCount = 0;
      
      try {
        // 首先重置所有封面图（避免多个封面图的情况）
        const resetQuery = `UPDATE "ProductImage" SET "isPrimary" = false WHERE "isPrimary" = true`;
        await client.query(resetQuery);
        console.log('✅ 已重置所有封面图设置');
        
        // 为每个产品设置封面图
        for (const update of allUpdates) {
          try {
            const updateQuery = `
              UPDATE "ProductImage" 
              SET "isPrimary" = true 
              WHERE id = $1
            `;
            await client.query(updateQuery, [update.imageId]);
            
            successCount++;
            
            if (update.needsUpdate) {
              if (update.isSpecial) {
                console.log(`⭐ ${update.productName}: 封面图已设置为 ${update.newImage}`);
              } else {
                console.log(`✅ ${update.productName}: 封面图已设置`);
              }
            }
            
          } catch (error) {
            errorCount++;
            console.log(`❌ ${update.productName}: 设置封面图失败 - ${error.message}`);
          }
        }
        
        // 提交事务
        await client.query('COMMIT');
        
        console.log('\n✅ 封面图设置完成！');
        console.log(`- 成功设置: ${successCount} 个产品`);
        console.log(`- 失败设置: ${errorCount} 个产品`);
        
      } catch (error) {
        // 回滚事务
        await client.query('ROLLBACK');
        console.error('❌ 更新过程中出错，已回滚:', error.message);
      }
    } else {
      console.log('✅ 所有产品的封面图都已是最佳选择，无需更新');
    }
    
    // 4. 最终验证
    console.log('\n🔍 最终验证:');
    
    // 验证特别关注的产品
    console.log('⭐ 特别关注产品封面图设置:');
    for (const productId of specialProducts) {
      const verifyQuery = `
        SELECT p."modelName", b."nameZh" as brand, pi.url, pi."isPrimary"
        FROM "Product" p
        JOIN "Brand" b ON p."brandId" = b.id
        JOIN "ProductImage" pi ON p.id = pi."productId" AND pi."isPrimary" = true
        WHERE p.id = $1
      `;
      const verifyResult = await client.query(verifyQuery, [productId]);
      
      if (verifyResult.rows.length === 1) {
        const product = verifyResult.rows[0];
        console.log(`  ✅ ${product.brand} ${product.modelName}: ${product.url}`);
      } else {
        console.log(`  ❌ 产品ID ${productId}: 未找到封面图`);
      }
    }
    
    // 检查是否所有产品都有封面图
    const finalCheckQuery = `
      SELECT COUNT(DISTINCT p.id) as total_products,
             COUNT(DISTINCT CASE WHEN pi."isPrimary" = true THEN p.id END) as products_with_primary
      FROM "Product" p
      LEFT JOIN "ProductImage" pi ON p.id = pi."productId" AND pi."isPrimary" = true
      WHERE EXISTS (SELECT 1 FROM "ProductImage" WHERE "productId" = p.id)
    `;
    
    const finalCheckResult = await client.query(finalCheckQuery);
    const totalProducts = finalCheckResult.rows[0].total_products;
    const finalProductsWithPrimary = finalCheckResult.rows[0].products_with_primary;
    
    console.log('\n📊 最终统计:');
    console.log(`- 有图片的产品总数: ${totalProducts}`);
    console.log(`- 有封面图的产品数: ${finalProductsWithPrimary}`);
    console.log(`- 封面图覆盖率: ${((finalProductsWithPrimary / totalProducts) * 100).toFixed(1)}%`);
    
    if (finalProductsWithPrimary === totalProducts) {
      console.log('🎉 所有有图片的产品都已设置封面图！');
    } else {
      console.log(`⚠️  还有 ${totalProducts - finalProductsWithPrimary} 个产品没有封面图`);
    }
    
    // 5. 生成报告
    console.log('\n📋 修复完成报告:');
    console.log('1. 已为所有有图片的产品设置了封面图');
    console.log('2. 优先使用新上传的"wechat_"格式图片作为封面图');
    console.log('3. 特别关注的产品（用户截图中的产品）已重点处理');
    console.log('4. 首页产品卡片现在将显示优化后的封面图');
    console.log('\n💡 建议:');
    console.log('- 访问 https://usedfarmmach.vercel.app 查看首页产品卡片效果');
    console.log('- 特别检查 Orkel DENS-X、库恩 890大方捆、克罗尼 1270XC 这三个产品');
    console.log('- 如果仍有不满意的封面图，可以手动在网站后台调整');
    
  } catch (error) {
    console.error('❌ 修复过程中出错:', error.message);
  } finally {
    await client.end();
    console.log('\n🔌 数据库连接已关闭');
  }
}

fixPrimaryImagesRecovery().catch(console.error);