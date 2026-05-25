const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// 解压的文件夹名称
const FOLDER_NAMES = [
  '奥库DENS-X',
  '库恩1290', 
  '曼尼通叉车',
  '纽荷兰1270',
  '纽荷兰1290',
  '纽荷兰5070小方捆',
  '纽荷兰870',
  '美迪3300',
  '迪尔7250',
  '迪尔拖拉机',
  '金轮夹包机'
];

async function main() {
  try {
    // 获取所有产品
    const products = await prisma.product.findMany({
      include: {
        brand: true,
        category: true
      }
    });

    console.log('文件夹与产品匹配分析:');
    console.log('='.repeat(80));
    
    for (const folderName of FOLDER_NAMES) {
      console.log(`\n📁 文件夹: ${folderName}`);
      console.log('-'.repeat(40));
      
      // 尝试通过品牌名称匹配
      const brandMatches = [];
      
      // 提取可能的品牌关键词
      const brandKeywords = extractBrandKeywords(folderName);
      
      for (const keyword of brandKeywords) {
        const matchingProducts = products.filter(p => 
          p.brand.nameZh.includes(keyword) || 
          p.brand.nameEn.toLowerCase().includes(keyword.toLowerCase()) ||
          p.modelName.includes(keyword)
        );
        
        if (matchingProducts.length > 0) {
          brandMatches.push(...matchingProducts.map(p => ({
            product: p,
            matchType: `品牌/型号包含 "${keyword}"`
          })));
        }
      }
      
      // 去重
      const uniqueMatches = [];
      const seenIds = new Set();
      for (const match of brandMatches) {
        if (!seenIds.has(match.product.id)) {
          seenIds.add(match.product.id);
          uniqueMatches.push(match);
        }
      }
      
      if (uniqueMatches.length > 0) {
        console.log(`✅ 找到 ${uniqueMatches.length} 个可能匹配的产品:`);
        uniqueMatches.forEach((match, index) => {
          const p = match.product;
          console.log(`  ${index + 1}. ${p.modelName} (ID: ${p.id})`);
          console.log(`     品牌: ${p.brand.nameZh}, 分类: ${p.category.nameZh}`);
          console.log(`     匹配原因: ${match.matchType}`);
        });
      } else {
        console.log('❌ 没有找到匹配的产品');
        
        // 显示所有品牌供参考
        const allBrands = [...new Set(products.map(p => p.brand.nameZh))];
        console.log('  现有品牌列表:', allBrands.join(', '));
      }
    }
    
    // 显示所有可能相关的产品摘要
    console.log('\n' + '='.repeat(80));
    console.log('可能相关的产品摘要:');
    
    // 按品牌分组
    const productsByBrand = {};
    products.forEach(p => {
      const brand = p.brand.nameZh;
      if (!productsByBrand[brand]) {
        productsByBrand[brand] = [];
      }
      productsByBrand[brand].push(p);
    });
    
    // 输出与文件夹相关的品牌
    const relevantBrands = ['奥库', '库恩', '纽荷兰', '迪尔', '约翰迪尔', '美迪', '曼尼通', '金轮'];
    for (const brand of relevantBrands) {
      for (const [brandName, brandProducts] of Object.entries(productsByBrand)) {
        if (brandName.includes(brand) || brand.includes(brandName)) {
          console.log(`\n🏷️  品牌: ${brandName}`);
          console.log(`   型号: ${brandProducts.map(p => p.modelName).join(', ')}`);
        }
      }
    }
    
  } catch (error) {
    console.error('错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

function extractBrandKeywords(folderName) {
  const keywords = [];
  
  // 中文品牌名称提取
  if (folderName.includes('奥库')) keywords.push('奥库', 'Orkel');
  if (folderName.includes('库恩')) keywords.push('库恩', 'Kuhn');
  if (folderName.includes('纽荷兰')) keywords.push('纽荷兰', 'New Holland');
  if (folderName.includes('迪尔')) keywords.push('迪尔', '约翰迪尔', 'John Deere');
  if (folderName.includes('美迪')) keywords.push('美迪');
  if (folderName.includes('曼尼通')) keywords.push('曼尼通');
  if (folderName.includes('金轮')) keywords.push('金轮');
  
  // 提取型号数字
  const modelMatch = folderName.match(/\d+/g);
  if (modelMatch) {
    keywords.push(...modelMatch);
  }
  
  return keywords;
}

main();