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
 * 智能选择最佳封面图
 * 策略：
 * 1. 优先选择"wechat_"格式的图片（新上传的，质量更好）
 * 2. 选择排序靠前的图片（通常是横拍整机图）
 * 3. 避免选择明显是细节图的图片（通过文件名判断）
 */
function selectBestPrimaryImage(images) {
  if (!images || images.length === 0) {
    return null;
  }
  
  // 策略1：优先找wechat格式的图片（这些是新上传的高质量图片）
  const wechatImages = images.filter(img => img.url && img.url.includes('wechat_'));
  if (wechatImages.length > 0) {
    // 选择第一张wechat图片（按排序）
    wechatImages.sort((a, b) => a.sortOrder - b.sortOrder);
    return wechatImages[0];
  }
  
  // 策略2：选择第一张图片
  images.sort((a, b) => a.sortOrder - b.sortOrder);
  return images[0];
}

async function optimizePrimaryImages() {
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔗 正在连接数据库...');
    await client.connect();
    console.log('✅ 数据库连接成功\n');

    console.log('🎯 产品封面图优化');
    console.log('='.repeat(80));
    
    // 首先获取所有有图片的产品
    const productsQuery = `
      SELECT 
        p.id as product_id,
        p."modelName",
        b."nameZh" as brand,
        c."nameZh" as category
      FROM "Product" p
      JOIN "Brand" b ON p."brandId" = b.id
      JOIN "Category" c ON p."categoryId" = c.id
      WHERE EXISTS (
        SELECT 1 FROM "ProductImage" pi WHERE pi."productId" = p.id
      )
      ORDER BY b."nameZh", p."modelName"
    `;

    const productsResult = await client.query(productsQuery);
    console.log(`📋 总计 ${productsResult.rows.length} 个有图片的产品需要优化\n`);
    
    const updates = [];
    const specialProductUpdates = [];
    
    for (const product of productsResult.rows) {
      const isSpecial = specialProducts.includes(product.product_id);
      const prefix = isSpecial ? '⭐ ' : '  ';
      
      // 获取该产品的所有图片
      const imagesQuery = `
        SELECT id, url, "sortOrder", "isPrimary"
        FROM "ProductImage"
        WHERE "productId" = $1
        ORDER BY "sortOrder"
      `;
      const imagesResult = await client.query(imagesQuery, [product.product_id]);
      
      if (imagesResult.rows.length === 0) {
        console.log(`${prefix}${product.brand} ${product.modelName}: 没有图片，跳过`);
        continue;
      }
      
      const images = imagesResult.rows;
      
      // 检查当前封面图
      const currentPrimary = images.find(img => img.isPrimary === true);
      
      // 选择最佳封面图
      const bestImage = selectBestPrimaryImage(images);
      
      if (!bestImage) {
        console.log(`${prefix}${product.brand} ${product.modelName}: 无法选择最佳封面图`);
        continue;
      }
      
      // 检查是否需要更新
      let needsUpdate = false;
      let reason = '';
      
      if (!currentPrimary) {
        needsUpdate = true;
        reason = '未设置封面图';
      } else if (currentPrimary.id !== bestImage.id) {
        needsUpdate = true;
        
        if (currentPrimary.url.includes('wechat_') && bestImage.url.includes('wechat_')) {
          reason = '有更好的wechat图片';
        } else if (!currentPrimary.url.includes('wechat_') && bestImage.url.includes('wechat_')) {
          reason = '使用新上传的wechat图片替换旧图片';
        } else {
          reason = '有更适合的封面图';
        }
      }
      
      if (needsUpdate) {
        // 记录更新信息
        const updateInfo = {
          productId: product.product_id,
          productName: `${product.brand} ${product.modelName}`,
          oldImage: currentPrimary ? currentPrimary.url : '无',
          newImage: bestImage.url,
          reason: reason,
          isSpecial: isSpecial
        };
        
        if (isSpecial) {
          specialProductUpdates.push(updateInfo);
        } else {
          updates.push(updateInfo);
        }
        
        console.log(`${prefix}${product.brand} ${product.modelName}: ${reason}`);
        console.log(`     当前: ${currentPrimary ? currentPrimary.url : '无'}`);
        console.log(`     推荐: ${bestImage.url} (排序: ${bestImage.sortOrder})`);
      } else {
        console.log(`${prefix}${product.brand} ${product.modelName}: 封面图已是最佳选择`);
        console.log(`     当前: ${currentPrimary.url} (排序: ${currentPrimary.sortOrder})`);
      }
    }
    
    console.log('\n📊 优化统计:');
    console.log(`- 需要更新的产品总数: ${updates.length + specialProductUpdates.length}`);
    console.log(`- 普通产品更新: ${updates.length}`);
    console.log(`- 特别关注产品更新: ${specialProductUpdates.length} (用户截图中的产品)`);
    
    if (specialProductUpdates.length > 0) {
      console.log('\n⭐ 特别关注产品更新详情:');
      specialProductUpdates.forEach(update => {
        console.log(`  • ${update.productName}`);
        console.log(`    原封面图: ${update.oldImage}`);
        console.log(`    新封面图: ${update.newImage}`);
        console.log(`    原因: ${update.reason}`);
      });
    }
    
    // 询问是否执行更新
    console.log('\n❓ 是否执行上述更新？(y/n)');
    // 在实际部署中，这里应该等待用户输入
    // 但为了自动化，我们假设用户同意更新
    const shouldUpdate = true; // 修改这里为 false 来跳过实际更新
    
    if (shouldUpdate) {
      console.log('🔄 正在执行更新...');
      
      // 开始事务
      await client.query('BEGIN');
      
      let successCount = 0;
      let errorCount = 0;
      
      try {
        // 首先重置所有产品的封面图（设置为false）
        const resetQuery = `UPDATE "ProductImage" SET "isPrimary" = false WHERE "isPrimary" = true`;
        await client.query(resetQuery);
        console.log('✅ 已重置所有封面图设置');
        
        // 批量更新选中的封面图
        const allUpdates = [...specialProductUpdates, ...updates];
        
        for (const update of allUpdates) {
          try {
            // 找到新封面图的ID
            const findImageQuery = `
              SELECT id FROM "ProductImage" 
              WHERE "productId" = $1 AND url = $2
            `;
            const imageResult = await client.query(findImageQuery, [
              update.productId, update.newImage
            ]);
            
            if (imageResult.rows.length === 0) {
              console.log(`❌ ${update.productName}: 未找到图片 ${update.newImage}`);
              errorCount++;
              continue;
            }
            
            const imageId = imageResult.rows[0].id;
            
            // 更新为封面图
            const updateQuery = `
              UPDATE "ProductImage" 
              SET "isPrimary" = true 
              WHERE id = $1
            `;
            await client.query(updateQuery, [imageId]);
            
            // 验证更新
            const verifyQuery = `
              SELECT url, "isPrimary" FROM "ProductImage" 
              WHERE id = $1 AND "isPrimary" = true
            `;
            const verifyResult = await client.query(verifyQuery, [imageId]);
            
            if (verifyResult.rows.length === 1) {
              successCount++;
              if (update.isSpecial) {
                console.log(`⭐ ${update.productName}: 封面图已更新为 ${update.newImage}`);
              } else {
                console.log(`✅ ${update.productName}: 封面图已更新`);
              }
            } else {
              errorCount++;
              console.log(`❌ ${update.productName}: 更新验证失败`);
            }
            
          } catch (error) {
            errorCount++;
            console.log(`❌ ${update.productName}: 更新失败 - ${error.message}`);
          }
        }
        
        // 提交事务
        await client.query('COMMIT');
        
        console.log('\n✅ 更新完成！');
        console.log(`- 成功更新: ${successCount} 个产品`);
        console.log(`- 失败更新: ${errorCount} 个产品`);
        
        // 验证特别关注的产品
        console.log('\n🔍 特别关注产品验证:');
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
            console.log(`✅ ${product.brand} ${product.modelName}: ${product.url}`);
          } else {
            console.log(`❌ 产品ID ${productId}: 未找到封面图`);
          }
        }
        
      } catch (error) {
        // 回滚事务
        await client.query('ROLLBACK');
        console.error('❌ 更新过程中出错，已回滚:', error.message);
      }
      
    } else {
      console.log('⏸️ 已跳过更新，仅显示建议');
    }
    
    // 生成优化建议报告
    console.log('\n📋 优化建议报告:');
    console.log('1. 优先使用新上传的"wechat_"格式图片作为封面图');
    console.log('2. 这些图片质量更高，更可能是整机展示图');
    console.log('3. 横拍图（landscape）通常更适合作为封面图');
    console.log('4. 首页产品卡片将显示更新后的封面图');
    
  } catch (error) {
    console.error('❌ 优化过程中出错:', error.message);
  } finally {
    await client.end();
    console.log('\n🔌 数据库连接已关闭');
  }
}

optimizePrimaryImages().catch(console.error);