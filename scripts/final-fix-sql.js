#!/usr/bin/env node

/*
 * 最终修复SQL文件：修正VALUES部分的逗号问题
 */

const fs = require('fs');
const path = require('path');

const sqlPath = path.join(__dirname, 'update-product-images.sql');
const fixedPath = sqlPath + '.final-fixed';

console.log(`📄 读取SQL文件: ${sqlPath}`);
let content = fs.readFileSync(sqlPath, 'utf-8');

console.log('🔧 正在修复SQL语法...');

// 修复ProductImage的INSERT语句
let fixedCount = 0;

// 方法1：直接修复已知模式
// 查找模式： false,\n\n  ) ON CONFLICT，将其改为 false\n  ) ON CONFLICT
content = content.replace(
  /false,\s*\n\s*\n\s*\) ON CONFLICT/g,
  'false\n  ) ON CONFLICT'
);

// 查找模式： false,\s*\n\s*\) ON CONFLICT（可能只有一个空行）
content = content.replace(
  /false,\s*\n\s*\) ON CONFLICT/g,
  'false\n  ) ON CONFLICT'
);

// 检查是否还有问题
const falseCommaCount = (content.match(/false,\s*\n/g) || []).length;
console.log(`📊 找到 ${falseCommaCount} 处 'false,' 后跟换行`);

// 如果还有问题，使用更精确的方法
if (falseCommaCount > 0) {
  console.log('🔧 使用精确修复方法...');
  
  // 按行处理
  const lines = content.split('\n');
  const newLines = [];
  let inValues = false;
  let valueCount = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 检测VALUES开始
    if (line.includes('VALUES (')) {
      inValues = true;
      valueCount = 0;
      newLines.push(line);
      continue;
    }
    
    // 检测VALUES结束
    if (inValues && line.trim() === ') ON CONFLICT (url) DO NOTHING;') {
      inValues = false;
      
      // 检查上一行是否是 'false,'，如果是则修复
      if (newLines[newLines.length - 1].trim() === 'false,') {
        newLines[newLines.length - 1] = '      false';
        fixedCount++;
      }
      newLines.push(line);
      continue;
    }
    
    // 在VALUES内部，检查 'false,' 行
    if (inValues && line.trim() === 'false,') {
      // 检查下一行是否是空行或结束括号
      const nextLine = i + 1 < lines.length ? lines[i + 1] : '';
      const nextLineTrim = nextLine.trim();
      
      if (nextLineTrim === '' || nextLineTrim === ')' || nextLineTrim === ') ON CONFLICT (url) DO NOTHING;') {
        // 这是最后一个值，去掉逗号
        newLines.push('      false');
        fixedCount++;
        continue;
      }
    }
    
    newLines.push(line);
  }
  
  content = newLines.join('\n');
}

// 修复ProductVideo的类似问题（如果有）
const titlePatternCount = (content.match(/'视频 \d+',\s*\n\s*\) ON CONFLICT/g) || []).length;
if (titlePatternCount > 0) {
  console.log(`📊 找到 ${titlePatternCount} 处视频标题逗号问题`);
  content = content.replace(
    /('视频 \d+'),\s*\n\s*\) ON CONFLICT/g,
    '$1\n  ) ON CONFLICT'
  );
}

// 写入修复后的文件
fs.writeFileSync(fixedPath, content, 'utf-8');
console.log(`✅ 修复完成！修复后的文件: ${fixedPath}`);
console.log(`📊 修复了 ${fixedCount} 个语句的语法问题`);

// 验证修复结果
const falseCommaAfter = (content.match(/false,\s*\n/g) || []).length;
const syntaxErrorPattern = /VALUES\s*\(\s*\n\s*[\s\S]*?false,\s*\n\s*\)/g;
const syntaxErrors = (content.match(syntaxErrorPattern) || []).length;

console.log(`🔍 验证结果:`);
console.log(`   - 剩余的 'false,' 问题: ${falseCommaAfter}`);
console.log(`   - 检测到的语法错误模式: ${syntaxErrors}`);

if (falseCommaAfter === 0 && syntaxErrors === 0) {
  console.log('🎉 语法修复成功！');
  
  // 替换原文件
  fs.copyFileSync(fixedPath, sqlPath);
  console.log(`📄 已更新原文件: ${sqlPath}`);
  
  // 测试第一条语句的语法
  const firstInsertMatch = content.match(/INSERT INTO "ProductImage"[^;]+;/);
  if (firstInsertMatch) {
    console.log('\n📋 第一条语句示例:');
    console.log(firstInsertMatch[0].substring(0, 200) + '...');
  }
} else {
  console.log('⚠️  可能还有未修复的问题，请手动检查');
  console.log('📁 修复版本保存在: ' + fixedPath);
}