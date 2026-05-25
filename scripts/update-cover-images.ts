#!/usr/bin/env tsx

/**
 * 更新产品封面图脚本
 * 根据用户选择的图片编号，更新数据库中的sortOrder和isPrimary字段
 * 
 * 使用方法:
 * 1. 创建 cover-selections.json 文件，格式如下:
 *    [
 *      {
 *        "productId": "cmpdknl8s00e511kwiy4tzjax",
 *        "bestImageNumber": 5,
 *        "reason": "整机展示清晰，品牌标识可见"
 *      }
 *    ]
 * 
 * 2. 运行: npx tsx scripts/update-cover-images.ts
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

// 定义选择项接口
interface CoverSelection {
  productId: string;
  bestImageNumber: number; // 1-10
  reason?: string;
}

// 定义更新结果接口
interface UpdateResult {
  productId: string;
  bestImageNumber: number;
  success: boolean;
  message: string;
  oldSortOrder?: number;
  newSortOrder?: number;
}

async function main() {
  console.log('🚀 开始更新产品封面图...\n');
  
  // 加载选择文件
  const selectionsFile = path.join(process.cwd(), 'cover-selections.json');
  if (!fs.existsSync(selectionsFile)) {
    console.error(`❌ 找不到选择文件: ${selectionsFile}`);
    console.log('请创建 cover-selections.json 文件，格式参考脚本注释。');
    process.exit(1);
  }
  
  let selections: CoverSelection[] = [];
  try {
    const content = fs.readFileSync(selectionsFile, 'utf-8');
    selections = JSON.parse(content);
    console.log(`📋 加载了 ${selections.length} 个产品的选择数据\n`);
  } catch (error) {
    console.error('❌ 解析选择文件失败:', error);
    process.exit(1);
  }
  
  // 验证数据
  const validSelections = selections.filter(selection => {
    if (!selection.productId || !selection.bestImageNumber) {
      console.warn(`⚠️ 跳过无效项: productId=${selection.productId}, bestImageNumber=${selection.bestImageNumber}`);
      return false;
    }
    if (selection.bestImageNumber < 1 || selection.bestImageNumber > 10) {
      console.warn(`⚠️ 图片编号必须在1-10之间: productId=${selection.productId}, bestImageNumber=${selection.bestImageNumber}`);
      return false;
    }
    return true;
  });
  
  if (validSelections.length === 0) {
    console.error('❌ 没有有效的选择数据');
    process.exit(1);
  }
  
  // 初始化Prisma客户端
  const prisma = new PrismaClient();
  
  const results: UpdateResult[] = [];
  
  try {
    // 遍历每个选择
    for (const selection of validSelections) {
      const { productId, bestImageNumber, reason } = selection;
      console.log(`\n🔄 处理产品: ${productId} (选择图片 ${bestImageNumber}.jpg)`);
      if (reason) {
        console.log(`   📝 理由: ${reason}`);
      }
      
      // 构建图片URL
      const bestImageUrl = `/uploads/products/${productId}/${bestImageNumber}.jpg`;
      
      // 查找该产品的所有图片
      const productImages = await prisma.productImage.findMany({
        where: { productId },
        orderBy: { sortOrder: 'asc' }
      });
      
      if (productImages.length === 0) {
        console.log(`   ⚠️ 产品 ${productId} 没有图片记录，跳过`);
        results.push({
          productId,
          bestImageNumber,
          success: false,
          message: '没有图片记录'
        });
        continue;
      }
      
      // 查找最佳图片记录
      const bestImageRecord = productImages.find(img => 
        img.url === bestImageUrl || 
        img.url.endsWith(`/${bestImageNumber}.jpg`)
      );
      
      if (!bestImageRecord) {
        console.log(`   ⚠️ 找不到图片记录: ${bestImageUrl}`);
        console.log('   现有图片URL:');
        productImages.forEach(img => console.log(`     - ${img.url}`));
        
        results.push({
          productId,
          bestImageNumber,
          success: false,
          message: '找不到对应的图片记录'
        });
        continue;
      }
      
      // 记录旧的sortOrder
      const oldSortOrder = bestImageRecord.sortOrder;
      
      // 如果最佳图片已经是sortOrder最小，无需更新
      if (oldSortOrder === 0) {
        console.log('   ℹ️ 最佳图片已是sortOrder=0，无需更新');
        
        results.push({
          productId,
          bestImageNumber,
          success: true,
          message: '最佳图片已是sortOrder=0，无需更新',
          oldSortOrder,
          newSortOrder: oldSortOrder
        });
        continue;
      }
      
      // 开始事务：更新所有图片的sortOrder
      console.log(`   📊 当前sortOrder: ${bestImageRecord.sortOrder}, 将更新为 0`);
      
      // 方案1: 将最佳图片设为sortOrder=0，其他图片依次递增
      // 但这样可能会打乱原有顺序。我们采用更简单的方案：
      // 将最佳图片设为sortOrder=0，其他图片保持原顺序但确保大于0
      
      // 首先，将最佳图片设为sortOrder=0
      await prisma.productImage.update({
        where: { id: bestImageRecord.id },
        data: { 
          sortOrder: 0,
          isPrimary: true 
        }
      });
      
      // 更新其他图片的sortOrder，确保它们大于0
      // 我们可以将所有其他图片的sortOrder加1，但需要保持相对顺序
      // 简单方案：将所有其他图片的sortOrder设置为原来的值+10（避免冲突），然后再重新排序
      // 但为了简单，我们直接设置为1-9（按原sortOrder排序）
      
      const otherImages = productImages.filter(img => img.id !== bestImageRecord.id);
      if (otherImages.length > 0) {
        // 按原sortOrder排序
        otherImages.sort((a, b) => a.sortOrder - b.sortOrder);
        
        // 更新其他图片的sortOrder为1开始
        for (let i = 0; i < otherImages.length; i++) {
          await prisma.productImage.update({
            where: { id: otherImages[i].id },
            data: { 
              sortOrder: i + 1,
              isPrimary: false 
            }
          });
        }
        
        console.log(`   📊 更新了 ${otherImages.length} 张其他图片的sortOrder`);
      }
      
      results.push({
        productId,
        bestImageNumber,
        success: true,
        message: '成功更新封面图',
        oldSortOrder,
        newSortOrder: 0
      });
      
      console.log(`   ✅ 产品 ${productId} 封面图已更新为图片 ${bestImageNumber}.jpg`);
    }
    
    // 打印汇总
    console.log('\n' + '='.repeat(50));
    console.log('📊 更新汇总:');
    console.log('='.repeat(50));
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`✅ 成功: ${successful} 个产品`);
    console.log(`❌ 失败: ${failed} 个产品\n`);
    
    if (failed > 0) {
      console.log('失败详情:');
      results.filter(r => !r.success).forEach(result => {
        console.log(`  - ${result.productId}: ${result.message}`);
      });
    }
    
    // 保存结果到文件
    const resultsFile = path.join(process.cwd(), 'cover-update-results.json');
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    console.log(`\n📄 详细结果已保存到: ${resultsFile}`);
    
  } catch (error) {
    console.error('\n❌ 更新过程中出现错误:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
  
  console.log('\n🎉 封面图更新完成！');
  console.log('\n📋 下一步:');
  console.log('1. 重新启动网站或等待缓存更新');
  console.log('2. 检查网站上的封面图是否已更新');
  console.log('3. 如需撤销，可以运行恢复脚本（尚未实现）');
}

// 执行主函数
main().catch(error => {
  console.error('❌ 脚本执行失败:', error);
  process.exit(1);
});