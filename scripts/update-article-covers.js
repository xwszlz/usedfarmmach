/**
 * 更新文章 coverImage 字段（从 cover-upload-results.json 读取OSS URL）
 * 用法: node scripts/update-article-covers.js
 */
const fs   = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function parseEnvLocal(fp) {
  const env = {};
  const content = fs.readFileSync(fp, 'utf8');
  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const idx = line.indexOf('=');
    const k = line.slice(0, idx).trim();
    let v = line.slice(idx + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[k] = v;
  }
  return env;
}

async function main() {
  // 加载 DATABASE_URL（Prisma 会自动读 .env，但这里手动确保）
  const envPath = path.join(__dirname, '../.env.local');
  console.log('Env path:', envPath);
  const env = parseEnvLocal(envPath);
  if (env.DATABASE_URL) {
    process.env.DATABASE_URL = env.DATABASE_URL;
  }

  const resultPath = path.join(__dirname, '../../神雕日报/cover-upload-results.json');
  if (!fs.existsSync(resultPath)) {
    console.error('❌ cover-upload-results.json not found:', resultPath);
    process.exit(1);
  }

  const results = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
  console.log(`📂 找到 ${results.length} 张封面图`);

  let updated = 0, skipped = 0, notFound = 0;
  for (const { file, url } of results) {
    // 文件名格式: 2026-06-09_{slug}.png
    const base = file.replace(/\.png$/i, '');
    const idx  = base.indexOf('_');
    const slug = idx >= 0 ? base.slice(idx + 1) : base;

    const article = await prisma.article.findUnique({ where: { slug } });
    if (!article) {
      console.log(`  SKIP (文章不存在): slug="${slug}"  file="${file}"`);
      notFound++;
      continue;
    }

    if (article.coverImage) {
      console.log(`  SKIP (已有封面): ${slug}  current="${article.coverImage.slice(0,60)}..."`);
      skipped++;
      continue;
    }

    await prisma.article.update({
      where: { slug },
      data: { coverImage: url },
    });
    console.log(`  ✅ UPDATED: ${slug}`);
    updated++;
  }

  console.log(`\n📊 完成: ${updated} 更新, ${skipped} 跳过(已有), ${notFound} 未找到文章`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
