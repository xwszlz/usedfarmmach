#!/usr/bin/env node
/**
 * batch-match-and-upload.js
 * ==========================
 * Phase 1: 智能匹配本地文件夹与数据库中无图片的产品
 * Phase 2: 批量上传图片/视频到阿里云OSS并写入数据库
 *
 * Usage:
 *   node scripts/batch-match-and-upload.js --phase=match            # 仅执行匹配
 *   node scripts/batch-match-and-upload.js --phase=match --loose    # 宽松匹配模式
 *   node scripts/batch-match-and-upload.js --phase=upload           # 仅执行上传
 *   node scripts/batch-match-and-upload.js --phase=upload --dry-run # 只读预览
 *   node scripts/batch-match-and-upload.js                          # 先匹配后上传
 */

const fs = require('fs');
const path = require('path');
const OSS = require('ali-oss');
const { PrismaClient } = require('@prisma/client');

// 加载 .env.local 文件（手动解析，不依赖 dotenv 包）
try {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const key = trimmed.substring(0, eqIdx).trim();
          let val = trimmed.substring(eqIdx + 1).trim();
          // Remove surrounding quotes
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    });
    console.log('✅ 已加载 .env.local 环境变量');
  }
} catch (e) {
  console.warn('⚠️  加载 .env.local 失败:', e.message);
}

// ==================== 配置 ====================

const SOURCE_DIRS = [
  'D:/神雕农机/出口农机',
  'D:/神雕农机/神雕农机网站图片0606',
];

const MATCH_RESULT_PATH = path.join(__dirname, 'batch-match-result.json');

const OSS_CONFIG = {
  region: process.env.OSS_REGION || 'oss-cn-beijing',
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  bucket: process.env.OSS_BUCKET || 'usedfarmmach-oss',
  secure: true,
  timeout: 120000,
};

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']);
const VIDEO_EXTS = new Set(['.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.webm']);

// 品牌别名映射：别名 → 规范品牌中文名
// 用于从文件夹名中提取品牌，以及反向匹配数据库品牌
const BRAND_ALIASES_TO_DB = {
  '克拉斯': '克拉斯',
  'claas': '克拉斯',
  'class': '克拉斯',
  '克罗尼': '克罗尼',
  'krone': '克罗尼',
  '纽荷兰': '纽荷兰',
  'new holland': '纽荷兰',
  'newholland': '纽荷兰',
  'nh': '纽荷兰',
  '约翰迪尔': '约翰迪尔',
  'john deere': '约翰迪尔',
  'johndeere': '约翰迪尔',
  '迪尔': '约翰迪尔',
  'deere': '约翰迪尔',
  '库恩': '库恩',
  'kuhn': '库恩',
  '曼尼通': '曼尼通',
  'manitou': '曼尼通',
  '美迪': '美迪',
  '迪马': '迪马',
  '中联重科': '中联重科',
  'zoomlion': '中联重科',
  '常发': '常发',
  '废铁': '废铁',
  '金轮': '金轮',
  '法兰信': '法兰信',
  '中农机': '中农机',
  '奥库': '奥库',
  'otma': '奥库',
  'orkel': '奥库',
  '格里莫': '格立莫',
  '格立莫': '格立莫',
  'grimme': '格立莫',
  'arcusin': 'Arcusin',
  'arcusln': 'Arcusin',
  '奥贝斯': '奥贝斯',
  '凯斯': '凯斯',
  'case': '凯斯',
  'case ih': '凯斯',
  '麦赛弗格森': '麦赛弗格森',
  'massey ferguson': '麦赛弗格森',
  'massey': '麦赛弗格森',
  'mf': '麦赛弗格森',
  '罗斯特': '罗斯特',
  'rsm': '罗斯特',
  '华夏': '华夏',
  '牧农': '牧农',
  '都麦': '都麦',
  'dorma': '都麦',
  'dormoy': '都麦',
  '芬特': '芬特',
  'fendt': '芬特',
  '久保田': '久保田',
  'kubota': '久保田',
  '雷沃': '雷沃',
  'lovol': '雷沃',
  '沃得': '沃得',
  'world': '沃得',
  '牧神': '牧神',
  'mushen': '牧神',
  '谷王': '谷王',
  'guwang': '谷王',
  '盈嘉': '盈嘉',
  'yingjia': '盈嘉',
  '明宇': '明宇',
  '康斯凯尔': '康斯凯尔',
  'kongskilde': '康斯凯尔',
  '德国': '德国',
  '德翔': '德翔',
  'dexiang': '德翔',
  '冠军': '冠军',
  '艾美特': '艾美特',
  'amty': '艾美特',
  'idass': 'IDASS',
  '东方红': '东方红',
  'dongfanghong': '东方红',
  '东风': '东风',
  'dongfeng': '东风',
  '东洋': '东洋',
  'toyonoki': '东洋',
  'toyo': '东洋',
  '格兰': '格兰',
  'grain': '格兰',
  '迈科农机': '迈科农机',
  'maike': '迈科农机',
  '进口': '进口',
};

// 干扰词（提取型号时移除）
const NOISE_WORDS = ['进口', '国产', '年', '的', '自走式', '多功能', '牧草', '叉车', '割草机',
  '青储机', '打捆机', '收割机', '夹包机', '伸缩臂', '无伸缩臂', '圆捆打包缠膜机',
  '圆捆', '打包', '缠膜', '精播机', '柠条收获机', '茎穗双收', '单收', '拖拉机',
  '裹包机', '胡萝卜机', '码垛机', '捡拾', '牧草', '自走式', '多功能'];

// ==================== 工具函数 ====================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

/**
 * 判断数据库型号是否为空/无效
 */
function isEmptyModel(modelName) {
  if (!modelName) return true;
  const m = modelName.trim();
  return m === '' || m === '无' || m === 'none' || m === 'null';
}

/**
 * 从文件夹名称解析年份、品牌、型号
 */
function parseFolderName(folderName) {
  const raw = folderName;
  const lowerRaw = raw.toLowerCase();

  // 1. 提取年份：优先 4 位年份
  let year = null;
  const year4Match = raw.match(/\b(19|20)(\d{2})\b/);
  if (year4Match) {
    year = parseInt(year4Match[0], 10);
  } else {
    const year2Match = raw.match(/\b(\d{2})年/);
    if (year2Match) {
      const yy = parseInt(year2Match[1], 10);
      year = yy >= 50 ? 1900 + yy : 2000 + yy;
    }
  }

  // 2. 提取品牌
  let brand = null;
  let matchedAlias = null;
  for (const [alias, dbBrand] of Object.entries(BRAND_ALIASES_TO_DB)) {
    if (lowerRaw.includes(alias.toLowerCase())) {
      // 优先选择更长的别名（更精确）
      if (!matchedAlias || alias.length > matchedAlias.length) {
        brand = dbBrand;
        matchedAlias = alias;
      }
    }
  }

  // 3. 提取型号
  let cleaned = raw;
  // 移除年份
  cleaned = cleaned.replace(/\b(19|20)\d{2}\b/, '');
  // 移除匹配到的品牌别名
  if (matchedAlias) {
    cleaned = cleaned.replace(new RegExp(matchedAlias, 'gi'), '');
  }
  // 移除干扰词
  for (const word of NOISE_WORDS) {
    cleaned = cleaned.replace(new RegExp(word, 'g'), '');
  }
  cleaned = cleaned.replace(/[（）()\[\]【】]/g, ' ').replace(/\s+/g, ' ').trim();

  let model = null;
  const modelPatterns = [
    /\b([a-zA-Z]+\d+[a-zA-Z0-9\-]*)\b/,  // FR450, MLT-X735
    /\b(\d+[a-zA-Z]+\d*)\b/,             // 9QS-3300A
    /\b([a-zA-Z]*\d{3,}[a-zA-Z]*)\b/,    // 850, 9080, 1290
  ];
  for (const pattern of modelPatterns) {
    const match = cleaned.match(pattern);
    if (match && match[1].length >= 2) {
      model = match[1];
      break;
    }
  }
  if (!model) {
    const numMatch = cleaned.match(/\b(\d{2,})\b/);
    if (numMatch) model = numMatch[1];
  }

  return { year, brand, model, raw };
}

/**
 * 读取目录下的媒体文件
 */
function readMediaFiles(folderPath) {
  const entries = fs.readdirSync(folderPath);
  const images = [];
  const videos = [];

  for (const entry of entries) {
    if (entry.startsWith('thumb') || entry.startsWith('.')) continue;
    const fullPath = path.join(folderPath, entry);
    if (!fs.statSync(fullPath).isFile()) continue;

    const ext = path.extname(entry).toLowerCase();
    if (IMAGE_EXTS.has(ext)) images.push(entry);
    else if (VIDEO_EXTS.has(ext)) videos.push(entry);
  }

  const coverImage = images.find(f => /fm/i.test(f)) || null;

  images.sort((a, b) => {
    const aCover = /fm/i.test(a);
    const bCover = /fm/i.test(b);
    if (aCover && !bCover) return -1;
    if (!aCover && bCover) return 1;
    return a.localeCompare(b);
  });

  return { images, videos, coverImage };
}

/**
 * 获取与规范品牌相关的所有别名
 */
function getAliasesForBrand(canonicalBrand) {
  const aliases = [];
  for (const [alias, dbBrand] of Object.entries(BRAND_ALIASES_TO_DB)) {
    if (dbBrand === canonicalBrand) {
      aliases.push(alias.toLowerCase());
    }
  }
  return aliases;
}

/**
 * 计算品牌匹配分数
 */
function calculateBrandScore(folderBrand, productBrandZh, productBrandEn) {
  if (!folderBrand) return 0;

  // 1. 直接包含关系
  if (productBrandZh) {
    const p = productBrandZh.toLowerCase();
    const f = folderBrand.toLowerCase();
    if (p === f || p.includes(f) || f.includes(p)) return 80;
  }

  // 2. 反向别名匹配：DB品牌名是否包含folderBrand的任何相关别名
  const relatedAliases = getAliasesForBrand(folderBrand);
  if (productBrandZh) {
    const p = productBrandZh.toLowerCase();
    if (relatedAliases.some(alias => p.includes(alias))) return 80;
  }

  // 3. 英文品牌名匹配
  if (productBrandEn) {
    const p = productBrandEn.toLowerCase();
    if (relatedAliases.some(alias => p.includes(alias))) return 80;
    if (p === folderBrand.toLowerCase()) return 80;
  }

  return 0;
}

/**
 * 计算文件夹与产品的匹配分数
 */
function calculateMatchScore(folderParsed, product) {
  let score = 0;
  const f = folderParsed;
  const pYear = product.year;
  const pModel = (product.modelName || '').toLowerCase();
  const pModelEmpty = isEmptyModel(product.modelName);

  // 年份匹配（更宽松）
  if (f.year && pYear) {
    const diff = Math.abs(f.year - pYear);
    if (diff === 0) score += 100;
    else if (diff <= 1) score += 60;
    else if (diff <= 2) score += 30;
    else if (diff <= 5) score += 10;
  }

  // 品牌匹配（使用改进的函数）
  score += calculateBrandScore(f.brand, product.brand?.nameZh, product.brand?.nameEn);

  // 型号匹配
  if (f.model && !pModelEmpty) {
    const fModelClean = f.model.toLowerCase().replace(/[-_\s]/g, '');
    const pModelClean = pModel.replace(/[-_\s]/g, '');

    if (pModelClean.includes(fModelClean) || fModelClean.includes(pModelClean)) {
      score += 60;
    } else {
      const fNums = fModelClean.match(/\d+/g) || [];
      const pNums = pModelClean.match(/\d+/g) || [];
      const common = fNums.filter(n => pNums.includes(n));
      if (common.length > 0) {
        score += Math.min(common.length * 25, 50);
      }
    }
  }

  // 如果数据库型号为空，且品牌已匹配，给予型号补偿分
  if (pModelEmpty && f.model) {
    const brandScore = calculateBrandScore(f.brand, product.brand?.nameZh, product.brand?.nameEn);
    if (brandScore >= 80 && score >= 100) {
      score += 30; // 补偿型号分，使总分足够过阈值
    }
  }

  return score;
}

/**
 * 判断是否达到匹配阈值
 */
function isGoodMatch(score, folderParsed, product, looseMode = false) {
  const f = folderParsed;
  const pModelEmpty = isEmptyModel(product.modelName);

  // 必须有品牌匹配
  if (!f.brand) return false;
  
  const brandScore = calculateBrandScore(f.brand, product.brand?.nameZh, product.brand?.nameEn);
  if (brandScore < 80) return false;

  if (score < 80) return false;

  const baseThreshold = looseMode ? 80 : 100;

  if (f.year) {
    if (pModelEmpty) {
      return score >= baseThreshold;
    }
    return score >= baseThreshold + 20;
  } else {
    return score >= baseThreshold;
  }
}

// ==================== Phase 1: 智能匹配 ====================

async function phaseMatch(looseMode = false) {
  const prisma = new PrismaClient();

  try {
    console.log('\n📋 Phase 1: 智能匹配本地文件夹与数据库产品');
    if (looseMode) console.log('🏷️  宽松模式：降低匹配阈值，提高召回率');
    console.log('='.repeat(60));

    // 1. 扫描本地文件夹
    const folders = [];
    for (const dir of SOURCE_DIRS) {
      if (!fs.existsSync(dir)) {
        console.warn(`⚠️  目录不存在，跳过: ${dir}`);
        continue;
      }
      const entries = fs.readdirSync(dir);
      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        if (!fs.statSync(fullPath).isDirectory()) continue;

        const { images, videos, coverImage } = readMediaFiles(fullPath);
        if (images.length === 0 && videos.length === 0) continue;

        folders.push({
          localFolder: entry,
          fullPath,
          sourceDir: dir,
          images,
          videos,
          coverImage,
          parsed: parseFolderName(entry),
          mediaCount: images.length + videos.length,
        });
      }
    }

    console.log(`📁 扫描到 ${folders.length} 个含媒体文件的产品文件夹`);

    // 2. 查询数据库中无图片的产品
    const productsWithoutImages = await prisma.product.findMany({
      where: {
        images: { none: {} },
        status: { not: 'archived' },
      },
      include: { brand: true, category: true },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`🗄️  数据库中无图片的产品: ${productsWithoutImages.length} 台`);

    // 3. 模糊匹配（关键改进：允许多个文件夹匹配同一产品）
    const matches = [];
    const unmatchedFolders = [];

    for (const folder of folders) {
      let bestMatch = null;
      let bestScore = 0;

      for (const product of productsWithoutImages) {
        const score = calculateMatchScore(folder.parsed, product);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = product;
        }
      }

      if (bestMatch && isGoodMatch(bestScore, folder.parsed, bestMatch, looseMode)) {
        matches.push({
          productId: bestMatch.id,
          brandName: bestMatch.brand.nameZh,
          modelName: bestMatch.modelName,
          year: bestMatch.year,
          categoryName: bestMatch.category?.nameZh || '',
          localFolder: folder.localFolder,
          sourceDir: folder.sourceDir,
          folderPath: folder.fullPath,
          images: folder.images,
          videos: folder.videos,
          coverImage: folder.coverImage,
          imageCount: folder.images.length,
          videoCount: folder.videos.length,
          matchScore: bestScore,
          parsed: folder.parsed,
        });
      } else {
        unmatchedFolders.push({
          localFolder: folder.localFolder,
          sourceDir: folder.sourceDir,
          folderPath: folder.fullPath,
          parsed: folder.parsed,
          imageCount: folder.images.length,
          videoCount: folder.videos.length,
          bestScore,
          bestCandidate: bestMatch
            ? {
                productId: bestMatch.id,
                brandName: bestMatch.brand.nameZh,
                modelName: bestMatch.modelName,
                year: bestMatch.year,
                score: bestScore,
              }
            : null,
        });
      }
    }

    // 计算未匹配产品（被至少一个文件夹匹配到的产品视为已匹配）
    const matchedProductIds = new Set(matches.map(m => m.productId));
    const unmatchedProducts = productsWithoutImages.filter(p => !matchedProductIds.has(p.id));

    // 4. 输出结果
    const result = {
      timestamp: new Date().toISOString(),
      mode: looseMode ? 'loose' : 'strict',
      summary: {
        totalFolders: folders.length,
        totalProductsWithoutImages: productsWithoutImages.length,
        matchedFolderCount: matches.length,
        matchedProductCount: matchedProductIds.size,
        unmatchedFolderCount: unmatchedFolders.length,
        unmatchedProductCount: unmatchedProducts.length,
        totalImagesInMatches: matches.reduce((sum, m) => sum + m.imageCount, 0),
        totalVideosInMatches: matches.reduce((sum, m) => sum + m.videoCount, 0),
      },
      matches: matches.sort((a, b) => b.matchScore - a.matchScore),
      unmatchedFolders: unmatchedFolders.sort((a, b) => (b.bestScore || 0) - (a.bestScore || 0)),
      unmatchedProducts: unmatchedProducts.map(p => ({
        id: p.id,
        brandName: p.brand.nameZh,
        modelName: p.modelName,
        year: p.year,
        categoryName: p.category?.nameZh || '',
      })),
    };

    fs.writeFileSync(MATCH_RESULT_PATH, JSON.stringify(result, null, 2), 'utf-8');

    // 5. 控制台报告
    console.log(`\n========== 匹配结果报告 ==========`);
    console.log(`✅ 匹配成功:      ${matches.length} 个文件夹 → ${matchedProductIds.size} 个产品`);
    console.log(`❌ 未匹配文件夹:  ${unmatchedFolders.length} 个`);
    console.log(`❓ 未匹配产品:    ${unmatchedProducts.length} 个`);
    console.log(`🖼️  匹配图片总数: ${result.summary.totalImagesInMatches} 张`);
    console.log(`🎬 匹配视频总数:  ${result.summary.totalVideosInMatches} 个`);
    console.log(`\n📄 详细结果已保存: ${MATCH_RESULT_PATH}`);

    if (matches.length > 0) {
      console.log(`\n-------- 匹配详情 (${matches.length} 条) --------`);
      for (let i = 0; i < Math.min(20, matches.length); i++) {
        const m = matches[i];
        console.log(`  ${String(i + 1).padStart(2)}. [${String(m.matchScore).padStart(3)}分] ${m.localFolder.padEnd(35)} → ${m.brandName} ${m.modelName || '(无型号)'} (${m.year || '?'}) [${m.imageCount}图/${m.videoCount}视频]`);
      }
      if (matches.length > 20) console.log(`  ... 还有 ${matches.length - 20} 条`);
    }

    if (unmatchedFolders.length > 0) {
      console.log(`\n-------- 未匹配文件夹 TOP 15 --------`);
      for (let i = 0; i < Math.min(15, unmatchedFolders.length); i++) {
        const u = unmatchedFolders[i];
        let hint = '';
        if (u.bestCandidate) {
          hint = `(最接近: ${u.bestCandidate.brandName} ${u.bestCandidate.modelName || '(无)'} ${u.bestCandidate.year} ${u.bestCandidate.score}分)`;
        }
        console.log(`  ${String(i + 1).padStart(2)}. ${u.localFolder} ${hint}`);
      }
    }

    return result;
  } finally {
    await prisma.$disconnect();
  }
}

// ==================== Phase 2: 批量上传 ====================

async function phaseUpload(options = {}) {
  const dryRun = options.dryRun || false;

  if (!fs.existsSync(MATCH_RESULT_PATH)) {
    console.error(`\n❌ 匹配结果文件不存在: ${MATCH_RESULT_PATH}`);
    console.error('   请先运行: node scripts/batch-match-and-upload.js --phase=match');
    process.exit(1);
  }

  const result = JSON.parse(fs.readFileSync(MATCH_RESULT_PATH, 'utf-8'));
  const matches = result.matches || [];

  if (matches.length === 0) {
    console.log('\n❌ 没有匹配的产品可供上传');
    return;
  }

  console.log('\n📤 Phase 2: 批量上传到 OSS 并写入数据库');
  console.log('='.repeat(60));
  if (dryRun) console.log('🏷️  【只读模式】不会实际上传文件或写入数据库');
  console.log(`📦 共 ${matches.length} 个匹配文件夹待处理`);

  const ossClient = new OSS(OSS_CONFIG);
  const prisma = new PrismaClient();

  const stats = {
    uploadedImages: 0, uploadedVideos: 0,
    skippedImages: 0, skippedVideos: 0,
    failedImages: 0, failedVideos: 0,
    dbImagesCreated: 0, dbVideosCreated: 0,
    totalBytesUploaded: 0,
  };

  try {
    console.log('\n☁️  验证 OSS 连接...');
    if (!dryRun) {
      try {
        await ossClient.getBucketInfo();
        console.log(`   ✅ OSS 连接正常 (bucket: ${OSS_CONFIG.bucket})`);
      } catch (err) {
        console.error(`   ❌ OSS 连接失败: ${err.message}`);
        process.exit(1);
      }
    } else {
      console.log(`   🏷️  跳过 OSS 连接验证 (只读模式)`);
    }

    // 分批处理
    const BATCH_SIZE = 10;
    const totalBatches = Math.ceil(matches.length / BATCH_SIZE);

    for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
      const start = batchIdx * BATCH_SIZE;
      const batch = matches.slice(start, start + BATCH_SIZE);

      console.log(`\n========== 批次 ${batchIdx + 1} / ${totalBatches} (${batch.length} 个) ==========`);

      for (const match of batch) {
        await processProductUpload(match, ossClient, prisma, stats, dryRun);
      }

      if (!dryRun && batchIdx < totalBatches - 1) {
        console.log('⏳ 等待 1.5 秒后继续下一批...');
        await sleep(1500);
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('🎉 批量上传完成');
    console.log(`${'='.repeat(60)}`);
    console.log(`🖼️ 图片: 新上传 ${stats.uploadedImages} | 跳过 ${stats.skippedImages} | 失败 ${stats.failedImages}`);
    console.log(`🎬 视频: 新上传 ${stats.uploadedVideos} | 跳过 ${stats.skippedVideos} | 失败 ${stats.failedVideos}`);
    console.log(`📝 DB写入: 图片记录 ${stats.dbImagesCreated} | 视频记录 ${stats.dbVideosCreated}`);
    console.log(`📊 总上传流量: ${formatBytes(stats.totalBytesUploaded)}`);

    if (dryRun) {
      console.log(`\n🏷️  以上为只读模式预览，实际未执行上传/写入`);
      console.log(`   去掉 --dry-run 参数以正式执行`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * 处理单个产品的上传
 */
async function processProductUpload(match, ossClient, prisma, stats, dryRun) {
  const { productId, folderPath, images, videos, coverImage } = match;
  const label = `${match.brandName || '?'} ${match.modelName || '(无型号)'} (${match.year || '?'})`;

  console.log(`\n📁 ${match.localFolder}`);
  console.log(`   → ${label} [${images.length}图/${videos.length}视频] 封面:${coverImage || '无'}`);

  // 处理图片
  for (let i = 0; i < images.length; i++) {
    const filename = images[i];
    const localPath = path.join(folderPath, filename);
    const ossKey = `products/${productId}/${filename}`;
    const dbUrl = `/products/${productId}/${filename}`;
    const isPrimary = i === 0;

    try {
      const existingDb = await prisma.productImage.findFirst({
        where: { productId, url: dbUrl },
      });

      if (existingDb) {
        console.log(`   ⏭️  图片已存在DB: ${filename}`);
        stats.skippedImages++;
        continue;
      }

      let ossExists = false;
      if (!dryRun) {
        try {
          await ossClient.head(ossKey);
          ossExists = true;
        } catch (e) { /* 不存在 */ }
      }

      if (ossExists) {
        console.log(`   ⏭️  图片已存在OSS: ${filename}`);
        if (!dryRun) {
          await prisma.productImage.create({
            data: { productId, url: dbUrl, sortOrder: i, isPrimary },
          });
          stats.dbImagesCreated++;
        }
        stats.skippedImages++;
        continue;
      }

      if (!dryRun) {
        await ossClient.put(ossKey, localPath);
        stats.totalBytesUploaded += fs.statSync(localPath).size;
        await prisma.productImage.create({
          data: { productId, url: dbUrl, sortOrder: i, isPrimary },
        });
        stats.dbImagesCreated++;
      }

      console.log(`   ✅ 图片 ${isPrimary ? '[主图]' : ''} ${filename}`);
      stats.uploadedImages++;
    } catch (error) {
      console.error(`   ❌ 图片失败 ${filename}: ${error.message}`);
      stats.failedImages++;
    }
  }

  // 处理视频
  for (let i = 0; i < videos.length; i++) {
    const filename = videos[i];
    const localPath = path.join(folderPath, filename);
    const ossKey = `products/${productId}/videos/${filename}`;
    const dbUrl = `/products/${productId}/videos/${filename}`;
    const title = filename.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ').substring(0, 50);

    try {
      const existingDb = await prisma.productVideo.findFirst({
        where: { productId, url: dbUrl },
      });

      if (existingDb) {
        console.log(`   ⏭️  视频已存在DB: ${filename}`);
        stats.skippedVideos++;
        continue;
      }

      let ossExists = false;
      if (!dryRun) {
        try {
          await ossClient.head(ossKey);
          ossExists = true;
        } catch (e) { /* 不存在 */ }
      }

      if (ossExists) {
        console.log(`   ⏭️  视频已存在OSS: ${filename}`);
        if (!dryRun) {
          await prisma.productVideo.create({
            data: { productId, url: dbUrl, sortOrder: i, title },
          });
          stats.dbVideosCreated++;
        }
        stats.skippedVideos++;
        continue;
      }

      if (!dryRun) {
        await ossClient.put(ossKey, localPath);
        stats.totalBytesUploaded += fs.statSync(localPath).size;
        await prisma.productVideo.create({
          data: { productId, url: dbUrl, sortOrder: i, title },
        });
        stats.dbVideosCreated++;
      }

      console.log(`   ✅ 视频 ${filename}`);
      stats.uploadedVideos++;
    } catch (error) {
      console.error(`   ❌ 视频失败 ${filename}: ${error.message}`);
      stats.failedVideos++;
    }
  }
}

// ==================== 主入口 ====================

function printUsage() {
  console.log(`
Usage:
  node scripts/batch-match-and-upload.js [options]

Options:
  --phase=match     仅执行 Phase 1（智能匹配）
  --phase=upload    仅执行 Phase 2（批量上传）
  --loose           宽松匹配模式（降低阈值，提高召回率）
  --dry-run         只读模式（上传阶段预览但不实际执行）
  --help            显示此帮助

Examples:
  node scripts/batch-match-and-upload.js --phase=match
  node scripts/batch-match-and-upload.js --phase=match --loose
  node scripts/batch-match-and-upload.js --phase=upload --dry-run
  node scripts/batch-match-and-upload.js
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  const phaseArg = args.find(a => a.startsWith('--phase='));
  const phase = phaseArg ? phaseArg.split('=')[1] : 'all';
  const dryRun = args.includes('--dry-run');
  const loose = args.includes('--loose');

  if (!['all', 'match', 'upload'].includes(phase)) {
    console.error(`❌ 无效的 phase: ${phase}`);
    printUsage();
    process.exit(1);
  }

  console.log('🚜 神雕农机 — 批量图片匹配与上传');
  console.log('='.repeat(60));

  if (phase === 'match' || phase === 'all') {
    await phaseMatch(loose);
  }

  if (phase === 'upload' || phase === 'all') {
    await phaseUpload({ dryRun });
  }
}

main().catch(err => {
  console.error('\n💥 脚本执行失败:', err);
  process.exit(1);
});
