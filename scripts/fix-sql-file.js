#!/usr/bin/env node

/*
 * 修复 SQL 文件，移除 ProductImage 表中的 createdAt 和 updatedAt 列
 */

const fs = require('fs');
const path = require('path');

const sqlPath = path.join(__dirname, 'update-product-images.sql');
const backupPath = sqlPath + '.backup-fixed';

// 备份原文件
fs.copyFileSync(sqlPath, backupPath);
console.log(`📁 已备份原文件到: ${backupPath}`);

let sqlContent = fs.readFileSync(sqlPath, 'utf-8');
let fixedCount = 0;

// 修复 ProductImage 表的 INSERT 语句
fixedContent = sqlContent.replace(
  /INSERT INTO "ProductImage" \(id, "productId", url, "sortOrder", "isPrimary", "createdAt", "updatedAt"\) VALUES \(([^)]+), '([^']+)', '([^']+)'\);/g,
  (match, valuesPart, createdAt, updatedAt) => {
    fixedCount++;
    // 只需要移除列名中的 createdAt, updatedAt
    return `INSERT INTO "ProductImage" (id, "productId", url, "sortOrder", "isPrimary") VALUES (${valuesPart});`;
  }
);

// 修复 ProductVideo 表的 INSERT 语句（如果有 createdAt/updatedAt）
fixedContent = fixedContent.replace(
  /INSERT INTO "ProductVideo" \(id, "productId", url, "sortOrder", title, "createdAt", "updatedAt"\) VALUES \(([^)]+), '([^']+)', '([^']+)'\);/g,
  (match, valuesPart, createdAt, updatedAt) => {
    fixedCount++;
    return `INSERT INTO "ProductVideo" (id, "productId", url, "sortOrder", title) VALUES (${valuesPart});`;
  }
);

if (fixedCount > 0) {
  fs.writeFileSync(sqlPath, fixedContent, 'utf-8');
  console.log(`✅ 成功修复 ${fixedCount} 条 INSERT 语句`);
  console.log(`📄 修复后的文件: ${sqlPath}`);
  
  // 验证修复结果
  const createdAtCount = (fixedContent.match(/createdAt/g) || []).length;
  const updatedAtCount = (fixedContent.match(/updatedAt/g) || []).length;
  
  console.log(`🔍 验证: createdAt 出现 ${createdAtCount} 次, updatedAt 出现 ${updatedAtCount} 次`);
  
  if (createdAtCount === 0 && updatedAtCount === 0) {
    console.log('✅ 修复成功！createdAt 和 updatedAt 列已完全移除');
  } else {
    console.log('⚠️  可能还有未修复的列，请手动检查');
  }
} else {
  console.log('⚠️  没有找到需要修复的 INSERT 语句');
  // 恢复备份
  fs.copyFileSync(backupPath, sqlPath);
  console.log('📁 已恢复原文件');
}

console.log('\n📊 修复完成！');