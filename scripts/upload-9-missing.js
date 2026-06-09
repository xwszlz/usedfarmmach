const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const fs = require('fs');
const path = require('path');

// 9台待上传产品
const TARGET_IDS = [
  'cmq4priiz', // Dorma 直收割台
  'cmq4prkdj', // Falaxin 伸缩臂夹包机
  'cmq4prjbc', // Grain 条播机
  'cmq4prjvi', // John Deere 拖拉机
  'cmq4prjzt', // Massey 甜菜收获机
  'cmq4pritx', // Toyonoki 甜菜机
  'cmq4prind', // Yingjia 打捆机
  'cmq4prkux', // 常发 茎穗双收
  'cmq4prjdh', // 曼尼通 叉车
];

// 本地素材目录
const LOCAL_DIRS = [
  'D:/神雕农机/网站图片补充0608/2026.6.8',
  'D:/神雕农机/网站产品图品补充06082/2026.6.8.补',
];

// OSS配置（从.env.local读取）
const OSS_CONFIG = {
  region: 'oss-cn-beijing',
  accessKeyId: '',
  accessKeySecret: '',
  bucket: 'usedfarmmach-oss',
};

// 手动env解析
function loadEnv() {
  const envPath = 'D:/神雕农机/usedfarmmach/.env.local';
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const m = line.match(/^([A-Z_]+)\s*=\s*(.+)/);
    if (m) {
      const k = m[1], v = m[2].replace(/["']/g, '');
      if (k === 'OSS_ACCESS_KEY_ID') OSS_CONFIG.accessKeyId = v;
      if (k === 'OSS_ACCESS_KEY_SECRET') OSS_CONFIG.accessKeySecret = v;
    }
  }
}

const OSS = require('ali-oss');

async function main() {
  loadEnv();

  // 获取9台产品的详情
  const products = [];
  for (const shortId of TARGET_IDS) {
    const pr = await p.product.findFirst({
      where: { id: { startsWith: shortId } },
      include: { brand: true, category: true, images: true, videos: true }
    });
    if (pr) products.push(pr);
  }

  console.log('=== 9台产品信息 ===');
  for (const pr of products) {
    console.log(`${pr.id.substring(0,12)} | ${pr.brand?.nameEn||pr.brand?.nameZh} | ${pr.modelName} | ${pr.year} | 图:${pr.images.length}`);
  }

  // 扫描所有本地文件夹
  const allFolders = [];
  for (const dir of LOCAL_DIRS) {
    if (!fs.existsSync(dir)) continue;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory()) {
        const fullPath = path.join(dir, e.name);
        const files = fs.readdirSync(fullPath);
        allFolders.push({ name: e.name, path: fullPath, files });
      }
    }
  }

  console.log(`\n=== 本地文件夹: ${allFolders.length} 个 ===`);

  // 模糊匹配
  const client = new OSS(OSS_CONFIG);
  let totalImg = 0, totalVid = 0, matched = 0;

  for (const pr of products) {
    const brand = (pr.brand?.nameEn || pr.brand?.nameZh || '').toLowerCase();
    const brandZh = (pr.brand?.nameZh || '').toLowerCase();
    const model = (pr.modelName || '').toLowerCase();

    // 构建搜索关键词
    const keywords = [];
    if (brand) keywords.push(brand);
    if (brandZh) keywords.push(brandZh);
    // 型号分词
    const modelParts = model.split(/[\s\-_\/]+/).filter(s => s.length > 0);
    keywords.push(...modelParts);

    let bestMatch = null;
    let bestScore = 0;

    for (const folder of allFolders) {
      const fname = folder.name.toLowerCase();
      let score = 0;
      for (const kw of keywords) {
        if (kw.length < 2) continue;
        if (fname.includes(kw)) score += 3;
      }
      if (bestScore === 0 || score > bestScore) {
        bestScore = score;
        bestMatch = folder;
      }
    }

    console.log(`\n--- ${brand} | ${model} ---`);
    if (bestScore >= 3 && bestMatch) {
      console.log(`  ✅ 匹配: "${bestMatch.name}" (分数:${bestScore})`);
      console.log(`  文件: ${bestMatch.files.length} 个`);
      matched++;

      // 上传
      let imgCount = 0, vidCount = 0;
      for (const file of bestMatch.files) {
        const ext = path.extname(file).toLowerCase();
        if (!['.jpg','.jpeg','.png','.webp','.mp4','.mov'].includes(ext)) continue;
        
        const ossKey = ext === '.mp4' || ext === '.mov'
          ? `products/${pr.id}/videos/${file}`
          : `products/${pr.id}/${file}`;

        try {
          const localPath = path.join(bestMatch.path, file);
          const result = await client.put(ossKey, localPath);
          if (result.res.status === 200) {
            const url = `https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com/${ossKey}`;
            if (ext === '.mp4' || ext === '.mov') {
              await p.productVideo.create({ data: { productId: pr.id, url } });
              vidCount++;
            } else {
              await p.productImage.create({ data: { productId: pr.id, url, sortOrder: imgCount, isPrimary: imgCount === 0 } });
              imgCount++;
            }
          }
        } catch (err) {
          console.log(`  ❌ 上传失败: ${file} - ${err.message}`);
        }
      }
      console.log(`  上传: ${imgCount} 图 + ${vidCount} 视频`);
      totalImg += imgCount;
      totalVid += vidCount;
    } else {
      console.log(`  ❌ 无匹配 (最高分:${bestScore})`);
      // 列出所有关键字帮助排查
      console.log(`  关键字: ${keywords.filter(k=>k.length>=2).join(', ')}`);
    }
  }

  console.log(`\n=== 汇总 ===`);
  console.log(`匹配成功: ${matched}/${products.length}`);
  console.log(`上传图片: ${totalImg}`);
  console.log(`上传视频: ${totalVid}`);

  // 最终统计
  const remaining = await p.product.count();
  const withImg = await p.product.findMany({ include: { images: true } });
  const imgCoverage = withImg.filter(pr => pr.images.length > 0).length;
  const withVid = await p.product.findMany({ include: { videos: true } });
  const vidCoverage = withVid.filter(pr => pr.videos && pr.videos.length > 0).length;

  console.log(`\n📊 最终: ${remaining} 台 | 有图 ${imgCoverage} (${Math.round(imgCoverage/remaining*100)}%) | 有视频 ${vidCoverage} (${Math.round(vidCoverage/remaining*100)}%)`);
}

main().catch(console.error).finally(() => p.$disconnect());
