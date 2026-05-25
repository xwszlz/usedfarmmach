const fs = require('fs');
const path = require('path');

// 源目录
const SOURCE_BASE = path.join(__dirname, '..', '..', '产品资料', '新建文件夹');

// 剩余文件夹列表
const REMAINING_FOLDERS = [
  '库恩1290',
  '曼尼通叉车',
  '纽荷兰1270',
  '纽荷兰1290',
  '纽荷兰5070小方捆',
  '纽荷兰870',
  '美迪3300',
  '迪尔拖拉机',
  '金轮夹包机'
];

// 产品匹配建议（基于之前的分析）
const PRODUCT_SUGGESTIONS = {
  '库恩1290': [
    { id: 'cmpfohy2g001dkrh55093csbq', model: '890大方捆', brand: '库恩', category: '打捆机', reason: '品牌匹配（库恩），同为打捆机' },
    { id: 'cmpdknkb2009911kwv7u98vpe', model: '1290XC', brand: '克罗尼', category: '打捆机', reason: '型号匹配（1290），但品牌不同' },
    { id: 'cmpfohxyk000dkrh5pso1gdvn', model: '法国精播机', brand: '库恩', category: '播种机', reason: '品牌匹配（库恩）' }
  ],
  '曼尼通叉车': [],
  '纽荷兰1270': [
    { id: 'cmpfohxx30001krh5pv5bx5yc', model: '1270XC', brand: '克罗尼', category: '打捆机', reason: '型号匹配（1270），但品牌不同' },
    { id: 'cmpdknjh6004x11kwkz5gvrbo', model: '9080', brand: '纽荷兰', category: '青储机', reason: '品牌匹配（纽荷兰）' },
    { id: 'cmpdknjlk005j11kwdeashk68', model: 'FR500', brand: '纽荷兰', category: '青储机', reason: '品牌匹配（纽荷兰）' }
  ],
  '纽荷兰1290': [
    { id: 'cmpdknkb2009911kwv7u98vpe', model: '1290XC', brand: '克罗尼', category: '打捆机', reason: '型号匹配（1290），但品牌不同' },
    { id: 'cmpdknjh6004x11kwkz5gvrbo', model: '9080', brand: '纽荷兰', category: '青储机', reason: '品牌匹配（纽荷兰）' },
    { id: 'cmpdknjlk005j11kwdeashk68', model: 'FR500', brand: '纽荷兰', category: '青储机', reason: '品牌匹配（纽荷兰）' }
  ],
  '纽荷兰5070小方捆': [
    { id: 'cmpdknjh6004x11kwkz5gvrbo', model: '9080', brand: '纽荷兰', category: '青储机', reason: '品牌匹配（纽荷兰）' },
    { id: 'cmpdknjlk005j11kwdeashk68', model: 'FR500', brand: '纽荷兰', category: '青储机', reason: '品牌匹配（纽荷兰）' },
    { id: 'cmpfohy0n000xkrh5d14tvnqy', model: 'FR450', brand: '纽荷兰', category: '青储机', reason: '品牌匹配（纽荷兰）' }
  ],
  '纽荷兰870': [
    { id: 'cmpdknjh6004x11kwkz5gvrbo', model: '9080', brand: '纽荷兰', category: '青储机', reason: '品牌匹配（纽荷兰）' },
    { id: 'cmpdknjlk005j11kwdeashk68', model: 'FR500', brand: '纽荷兰', category: '青储机', reason: '品牌匹配（纽荷兰）' },
    { id: 'cmpfohy0n000xkrh5d14tvnqy', model: 'FR450', brand: '纽荷兰', category: '青储机', reason: '品牌匹配（纽荷兰）' }
  ],
  '美迪3300': [
    { id: 'cmpdknle000fd11kwwfbic4p8', model: '3300RC', brand: '克拉斯', category: '打捆机', reason: '型号匹配（3300），但品牌不同' }
  ],
  '迪尔拖拉机': [
    { id: 'cmpdknj9v004b11kwqvki68wr', model: '7250', brand: '约翰迪尔', category: '青储机', reason: '品牌匹配（迪尔/约翰迪尔）' },
    { id: 'cmpfohxyy000hkrh5c66kzqc6', model: '6950', brand: '约翰迪尔', category: '青储机', reason: '品牌匹配（迪尔/约翰迪尔）' },
    { id: 'cmpfohxz7000jkrh5fsgcul2w', model: '7180', brand: '约翰迪尔', category: '青储机', reason: '品牌匹配（迪尔/约翰迪尔）' }
  ],
  '金轮夹包机': []
};

async function analyzeFolders() {
  console.log('📊 剩余文件夹分析报告');
  console.log('='.repeat(80));
  console.log(`📁 源目录: ${SOURCE_BASE}`);
  console.log(`📅 分析时间: ${new Date().toLocaleString()}`);
  console.log('='.repeat(80));
  
  for (const folderName of REMAINING_FOLDERS) {
    console.log(`\n## 📁 ${folderName}`);
    
    const folderPath = path.join(SOURCE_BASE, folderName);
    
    // 检查文件夹是否存在
    if (!fs.existsSync(folderPath)) {
      console.log('❌ 文件夹不存在');
      continue;
    }
    
    // 统计文件
    const files = fs.readdirSync(folderPath);
    const images = files.filter(f => /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(f));
    const videos = files.filter(f => /\.(mp4|avi|mov|wmv|flv|mkv)$/i.test(f));
    const otherFiles = files.filter(f => !/\.(jpg|jpeg|png|gif|bmp|webp|mp4|avi|mov|wmv|flv|mkv)$/i.test(f));
    
    console.log(`📄 文件总数: ${files.length}`);
    console.log(`🖼️  图片文件: ${images.length}`);
    console.log(`🎬 视频文件: ${videos.length}`);
    if (otherFiles.length > 0) {
      console.log(`📎 其他文件: ${otherFiles.length}`);
    }
    
    // 显示建议
    const suggestions = PRODUCT_SUGGESTIONS[folderName] || [];
    if (suggestions.length > 0) {
      console.log('\n✅ 可能的匹配产品:');
      suggestions.forEach((suggestion, index) => {
        console.log(`  ${index + 1}. ${suggestion.model} (ID: ${suggestion.id})`);
        console.log(`     品牌: ${suggestion.brand}, 分类: ${suggestion.category}`);
        console.log(`     理由: ${suggestion.reason}`);
      });
      
      // 推荐最佳匹配
      const bestMatch = suggestions[0];
      console.log(`\n💡 推荐: ${bestMatch.model} (ID: ${bestMatch.id})`);
      console.log(`   原因: ${bestMatch.reason}`);
    } else {
      console.log('\n❌ 没有找到匹配的产品');
      console.log('💡 建议: 需要在数据库中创建新产品记录');
    }
    
    console.log('\n' + '-'.repeat(40));
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('📋 总结');
  console.log('='.repeat(80));
  console.log(`• 已分析 ${REMAINING_FOLDERS.length} 个文件夹`);
  console.log('• 需要用户确认产品ID映射关系');
  console.log('• 无匹配的文件夹可能需要创建新产品记录');
  console.log('• 建议: 为每个文件夹确定产品ID后，更新 upload-and-generate-sql.js 中的 PRODUCT_MAPPINGS');
}

analyzeFolders().catch(console.error);