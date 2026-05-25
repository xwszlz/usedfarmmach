#!/usr/bin/env node

/*
 * 简单修复SQL文件 - 移除createdAt和updatedAt列
 */

const fs = require('fs');
const path = require('path');

const sqlPath = path.join(__dirname, 'update-product-images.sql');
const backupPath = sqlPath + '.backup-original';
const fixedPath = sqlPath + '.fixed';

// 备份原文件
fs.copyFileSync(sqlPath, backupPath);
console.log(`📁 已备份原文件到: ${backupPath}`);

const lines = fs.readFileSync(sqlPath, 'utf-8').split('\n');
const fixedLines = [];
let inInsert = false;
let insertLines = [];
let lineCount = 0;

console.log(`📄 正在处理 ${lines.length} 行...`);

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // 检测INSERT语句开始
  if (line.includes('INSERT INTO "ProductImage"') || line.includes('INSERT INTO "ProductVideo"')) {
    inInsert = true;
    insertLines = [line];
    lineCount++;
  } else if (inInsert) {
    insertLines.push(line);
    
    // 检测INSERT语句结束 (分号)
    if (line.trim().endsWith(';')) {
      // 处理这个完整的INSERT语句
      const fixedInsert = fixInsertStatement(insertLines.join('\n'));
      fixedLines.push(fixedInsert);
      
      inInsert = false;
      insertLines = [];
    }
  } else {
    fixedLines.push(line);
  }
}

// 写入修复后的文件
fs.writeFileSync(fixedPath, fixedLines.join('\n'), 'utf-8');
console.log(`✅ 修复完成！修复后的文件: ${fixedPath}`);
console.log(`📊 处理了 ${lineCount} 条INSERT语句`);

// 验证修复结果
const fixedContent = fs.readFileSync(fixedPath, 'utf-8');
const createdAtCount = (fixedContent.match(/createdAt/g) || []).length;
const updatedAtCount = (fixedContent.match(/updatedAt/g) || []).length;

console.log(`🔍 验证: createdAt 出现 ${createdAtCount} 次, updatedAt 出现 ${updatedAtCount} 次`);

if (createdAtCount === 0 && updatedAtCount === 0) {
  console.log('🎉 修复成功！createdAt和updatedAt列已完全移除');
  
  // 替换原文件
  fs.copyFileSync(fixedPath, sqlPath);
  console.log(`📄 已更新原文件: ${sqlPath}`);
} else {
  console.log('⚠️  还有未修复的列，请手动检查');
  console.log('📁 原文件保持不变，修复版本保存在: ' + fixedPath);
}

function fixInsertStatement(insertSQL) {
  // 移除createdAt和updatedAt列名
  let fixed = insertSQL.replace(
    /INSERT INTO "ProductImage" \(id, "productId", url, "sortOrder", "isPrimary", "createdAt", "updatedAt"\)/,
    'INSERT INTO "ProductImage" (id, "productId", url, "sortOrder", "isPrimary")'
  );
  
  fixed = fixed.replace(
    /INSERT INTO "ProductVideo" \(id, "productId", url, "sortOrder", title, "createdAt", "updatedAt"\)/,
    'INSERT INTO "ProductVideo" (id, "productId", url, "sortOrder", title)'
  );
  
  // 现在需要移除VALUES部分中的最后两个参数（时间戳）
  // 查找 VALUES ( ... ) 部分
  const valuesMatch = fixed.match(/VALUES\s*\(([\s\S]*?)\)\s*ON CONFLICT/);
  if (valuesMatch) {
    const valuesContent = valuesMatch[1];
    // 将VALUES内容按行分割
    const valueLines = valuesContent.split('\n');
    // 移除最后两个非空行（时间戳值）
    let nonEmptyLines = valueLines.filter(line => line.trim().length > 0);
    
    if (nonEmptyLines.length >= 2) {
      // 检查最后两行是否是时间戳格式（包含 'T' 和 'Z'）
      const lastTwo = nonEmptyLines.slice(-2);
      if (lastTwo[0].includes("'") && lastTwo[0].includes('T') && lastTwo[0].includes('Z') &&
          lastTwo[1].includes("'") && lastTwo[1].includes('T') && lastTwo[1].includes('Z')) {
        // 移除最后两行
        nonEmptyLines = nonEmptyLines.slice(0, -2);
        
        // 重新构建VALUES部分
        const newValuesContent = valueLines.map(line => {
          if (line.trim().length === 0) return line;
          
          const lineTrim = line.trim();
          // 如果是时间戳行，跳过
          if (lineTrim.includes("'") && lineTrim.includes('T') && lineTrim.includes('Z')) {
            return null;
          }
          return line;
        }).filter(line => line !== null).join('\n');
        
        // 替换VALUES部分
        fixed = fixed.replace(
          /VALUES\s*\(([\s\S]*?)\)\s*ON CONFLICT/,
          `VALUES (\n${newValuesContent}\n  ) ON CONFLICT`
        );
      }
    }
  }
  
  return fixed;
}