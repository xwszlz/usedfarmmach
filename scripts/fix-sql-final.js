const fs = require('fs');
const path = require('path');

const sqlFile = path.join(__dirname, 'update-product-images.sql');
let content = fs.readFileSync(sqlFile, 'utf8');

console.log(`正在修复 SQL 文件: ${sqlFile}`);
console.log(`原始文件大小: ${content.length} 字符`);

// 修复1: 移除 ON CONFLICT (url) DO NOTHING
console.log('修复1: 移除 ON CONFLICT (url) DO NOTHING');
content = content.replace(/ ON CONFLICT \(url\) DO NOTHING;/g, ';');

// 修复2: 修复视频INSERT语句中title值后面的多余逗号
// 匹配模式: title值后可能的逗号和空格/换行符，然后是 "  ) ON CONFLICT (url) DO NOTHING;"
// 但我们已经移除了ON CONFLICT，所以现在要匹配的是 "  );"
console.log('修复2: 修复视频INSERT语句中title值后面的多余逗号');
const lines = content.split('\n');
let inVideoInsert = false;
let fixedLines = [];

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  
  // 检测是否是ProductVideo INSERT语句
  if (line.includes('INSERT INTO "ProductVideo"')) {
    inVideoInsert = true;
  }
  
  if (inVideoInsert) {
    // 在视频INSERT语句中，查找title值后面的行，如果以逗号结尾，则去掉逗号
    // 匹配模式：title值行（包含哈希字符串）后面跟着 "    )" 或 "  )" 的行
    if (line.includes("'") && line.includes(",") && i + 1 < lines.length) {
      const nextLine = lines[i + 1];
      // 如果下一行是 "  )" 或 "    )"，并且当前行以逗号结尾，则移除逗号
      if (nextLine.trim() === ')' || nextLine.trim().startsWith(')')) {
        if (line.trim().endsWith(',')) {
          line = line.trim();
          line = line.substring(0, line.length - 1); // 移除最后一个逗号
          console.log(`第 ${i+1} 行: 移除title值后的多余逗号`);
        }
      }
    }
    
    // 如果遇到分号，结束当前视频INSERT语句
    if (line.trim().endsWith(';')) {
      inVideoInsert = false;
    }
  }
  
  fixedLines.push(line);
}

content = fixedLines.join('\n');

// 修复3: 直接使用正则表达式修复剩余的问题
// 匹配: title值后跟着逗号+换行符+空行+")"的情况
console.log('修复3: 使用正则表达式修复剩余问题');
const regex = /(,)\s*\n\s*\n\s*\)/g;
content = content.replace(regex, '\n\n  )');

// 修复4: 确保所有INSERT语句正确闭合
// 检查是否有缺少分号的语句（但应该都有了）

// 修复5: 移除重复的换行符
content = content.replace(/\n\s*\n\s*\n/g, '\n\n');

const backupFile = sqlFile + '.backup_' + new Date().toISOString().replace(/[:.]/g, '-');
fs.writeFileSync(backupFile, fs.readFileSync(sqlFile, 'utf8'));
console.log(`已创建备份文件: ${backupFile}`);

fs.writeFileSync(sqlFile, content);
console.log(`已修复文件: ${sqlFile}`);
console.log(`新文件大小: ${content.length} 字符`);
console.log('\n修复完成！');

// 验证修复（简单检查）
const videoInserts = (content.match(/INSERT INTO "ProductVideo"/g) || []).length;
const imageInserts = (content.match(/INSERT INTO "ProductImage"/g) || []).length;
const hasOnConflict = content.includes('ON CONFLICT');
const hasCommaBeforeParen = content.includes(',\n  )');

console.log('\n验证结果:');
console.log(`- ProductImage INSERT 语句: ${imageInserts}`);
console.log(`- ProductVideo INSERT 语句: ${videoInserts}`);
console.log(`- 是否包含 ON CONFLICT: ${hasOnConflict ? '是 ❌' : '否 ✅'}`);
console.log(`- 是否有逗号在括号前: ${hasCommaBeforeParen ? '是 ❌' : '否 ✅'}`);

if (hasOnConflict || hasCommaBeforeParen) {
  console.log('警告: 仍然检测到潜在问题！');
} else {
  console.log('✅ 所有修复已应用，SQL文件应该可以执行了。');
}