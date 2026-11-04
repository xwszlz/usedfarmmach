/**
 * 多品牌国际基准价 — 采集/聚合引擎（单一真相源）
 *
 * 设计（2026-08-12 改造，方案 A：Vercel Cron 调度）：
 *  - 原 scripts/fetch-benchmark.js + scripts/benchmark-config.js 的逻辑合并到此模块。
 *  - 本文件是 CommonJS，可被两类消费者复用：
 *      1) Next.js 路由 src/app/api/cron/benchmark/route.ts（Vercel 定时跑，境外出网自由）
 *      2) 本地/海外 VPS 的 CLI 脚本 scripts/fetch-benchmark.js（node 直接跑）
 *  - 自带 PrismaClient（不依赖 @/lib/db 别名，保证 node CLI 也能用）。
 *  - runRefresh 支持并发 + 单目标超时，规避 Vercel 函数 60s/300s 上限：
 *      2026-11-04 起：18 品牌 / 51 机型 × 6 个按型号靶标的源（mascus 走 bulk 通道）
 *      = 306 个靶标，线上并发 20、单目标 20s，靠「源级熔断 + 总预算 260s 兜底」控时。
 *      靶标数上限 500（见 MODELS 注释）：再加机型前请先算 机型数 × 6。
 *
 * 决策（2026-08-12 用户拍板）：18 品牌全上 / 轻量爬虫 / 俄线(Avito/OLX)首期 / 每天1次。
 *
 * 准确性机制：
 *  - 价格取样本「中位价」而非均值，剔除 >1.5×IQR 离群挂牌
 *  - 置信度随「源数 / 样本量 / 时效」评分
 *  - 外币价按采集日 FX 折算 CNY；成交价(sold)权重高于挂牌价(listing)
 *  - 降级：网络不可达时不写脏数据，仅刷新 FX + 重算聚合 + 保留已有样本
 */

const { PrismaClient } = require('@prisma/client');
const cheerio = require('cheerio');
const { HttpsProxyAgent } = require('https-proxy-agent');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// —— SITE-aware 数据库客户端（镜像 src/lib/db.ts 的选库逻辑）——
// benchmark-engine 是 CommonJS 双用途模块：既被 Next.js 路由
// (src/app/api/cron/benchmark/route.ts) 在服务端导入，也可被
// node CLI 脚本 (scripts/fetch-benchmark.js) 直接运行。
// 由于是纯 CJS（require 语法、无 TS 路径别名），无法 import TS 单例
// @/lib/db，故在此自行按 SITE 选择 DATABASE_URL_CN / DATABASE_URL，
// 确保 .cn 环境下写入中国境内库，与 db.ts 行为一致。
//
// 数据合规说明：本模块写入的 brandBenchmark 为公开的境外农机市场
// 采集价（价格/机型/源站），不含用户 PII 与资金担保数据，不触发
// 「数据出境本地化红线」；但为避免 .cn 定时任务误写 Neon，仍按
// SITE 显式指定连接串（非默认 DATABASE_URL 直连）。
function resolveBenchmarkDatabaseUrl() {
  const site = process.env.SITE || 'com';
  if (site === 'cn') {
    const url = process.env.DATABASE_URL_CN;
    if (!url) {
      throw new Error('[benchmark-engine] SITE=cn 但未设置 DATABASE_URL_CN 环境变量。');
    }
    return url;
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('[benchmark-engine] 未设置 DATABASE_URL 环境变量。');
  }
  return url;
}

const prisma = new PrismaClient({ datasources: { db: { url: resolveBenchmarkDatabaseUrl() } } });

// —— FX 兜底常量（离线时使用）——
const FX_FALLBACK = { EUR: 7.90, USD: 7.25, RUB: 0.090, GBP: 9.20, CNY: 1 };

// —— 品类分类法（与 BrandBenchmark.category 一致）——
const CATEGORY = {
  TRACTOR: 'tractor',
  FORAGE: 'forage_harvester',
  COMBINE: 'combine',
  BALER: 'baler',
  HAY: 'mower_tedder',
  SOIL: 'soil',
};

// mascus 上「询价」占比约 39/40，用时间窗控件控制单次抓取的页面体积与噪音
const MASCUS_RECENT_DAYS = 7;
// mascus 真实品类路径段（站点改版后的 URL，旧的 /search?q= 已被服务端忽略）
const MASCUS_CATEGORY_PATH = {
  tractor: 'tractors',
  forage_harvester: 'hay-and-forage-machines',
  baler: 'hay-and-forage-machines',
  mower_tedder: 'hay-and-forage-machines',
  combine: 'agricultural-harvesters',
  // ⚠️ 2026-11 修正：原值 'soil-preparation' 已是死路径（实测 items=0 / totalResults=0，
  //    页面实为 "Wine Growing Equipment" 葡萄酒种植设备，与耕整机械无关）。
  //    真实耕整机械段是 'tillage-machines'（实测 items=40 / total=2545）。
  //    同类死路径黑名单见 src/lib/mascus-leads/parse.ts 文件头：
  //    soil-preparation（0 条）、tillage-equipment（404）、loaders（0 条）、/agriculture 根（0 条）。
  soil: 'tillage-machines',
};

// —— mascus 品类级 bulk 扫描（替代失效的「按型号搜索」）——
// 站点改版后服务端**完全忽略** `?q=` 与品牌/型号参数，所以「每个 brand×model 打一次搜索」
// 这条路在 mascus 上永远拿不到对应机型（旧的 38 次靶标请求只会在 4 个品类页上重复 9.5 倍）。
// 改为：按品类段拉列表页 → 全量合并去重 → 在本地按 (brand, model) 匹配。
//
// 段清单必须与 src/lib/mascus-leads/parse.ts 的 MASCUS_SCAN_SEGMENTS **保持一致**
// （那条链路是线索池采集，本文件是价格基准采集，两条链路共用同一组「已验证可用」的段路径）。
// 改这里时必须同步改那里，否则一条链路会静默扫到 0 条。
const MASCUS_BULK_SEGMENTS = [
  'tractors',
  'tillage-machines',
  'hay-and-forage-machines',
  'other-agricultural-machines',
  'agricultural-harvesters',
];
// 时间窗：60 天。`lastcreateddays` 决定「挂牌新鲜度」，写入的 sourceDate 取抓取当天
// （与 agroline 语义一致：URL 已把范围限定为近 60 天新挂牌）。
const MASCUS_BULK_RECENT_DAYS = 60;
// 每段翻页数：5 段 × 5 页 × 40 条/页 = 最多 1000 条（mascus 每页固定 40）
const MASCUS_BULK_MAX_PAGES = 5;
// 单组最少样本数：不足 3 条不写库（3 条才够算「中位价 + IQR 离群」的最小统计口径）
const MASCUS_MIN_SAMPLES = 3;
const MASCUS_ORIGIN = 'https://www.mascus.com';

// 18 个品牌（拖拉机 11 + 收获青贮 4 + 耕整 3）
const BRANDS = [
  { slug: 'john-deere', nameZh: '约翰迪尔', nameEn: 'John Deere', origin: 'US', primaryCategory: CATEGORY.TRACTOR },
  { slug: 'new-holland', nameZh: '纽荷兰', nameEn: 'New Holland', origin: 'IT/US', primaryCategory: CATEGORY.TRACTOR },
  { slug: 'case-ih', nameZh: '凯斯', nameEn: 'Case IH', origin: 'US', primaryCategory: CATEGORY.TRACTOR },
  { slug: 'massey-ferguson', nameZh: '麦赛福格森', nameEn: 'Massey Ferguson', origin: 'US/UK', primaryCategory: CATEGORY.TRACTOR },
  { slug: 'fendt', nameZh: '芬特', nameEn: 'Fendt', origin: 'DE', primaryCategory: CATEGORY.TRACTOR },
  { slug: 'valtra', nameZh: '维特拉', nameEn: 'Valtra', origin: 'FI', primaryCategory: CATEGORY.TRACTOR },
  { slug: 'deutz-fahr', nameZh: '道依茨法尔', nameEn: 'Deutz-Fahr', origin: 'DE', primaryCategory: CATEGORY.TRACTOR },
  { slug: 'kubota', nameZh: '久保田', nameEn: 'Kubota', origin: 'JP', primaryCategory: CATEGORY.TRACTOR },
  { slug: 'yto', nameZh: '东方红', nameEn: 'YTO', origin: 'CN', primaryCategory: CATEGORY.TRACTOR },
  { slug: 'lovol', nameZh: '雷沃', nameEn: 'Lovol', origin: 'CN', primaryCategory: CATEGORY.TRACTOR },
  { slug: 'mccormick', nameZh: '麦考密克', nameEn: 'McCormick', origin: 'IT', primaryCategory: CATEGORY.TRACTOR },
  { slug: 'claas', nameZh: '克拉斯', nameEn: 'CLAAS', origin: 'DE', primaryCategory: CATEGORY.FORAGE },
  { slug: 'krone', nameZh: '科罗尼', nameEn: 'Krone', origin: 'DE', primaryCategory: CATEGORY.FORAGE },
  { slug: 'vermeer', nameZh: '维米尔', nameEn: 'Vermeer', origin: 'US', primaryCategory: CATEGORY.BALER },
  { slug: 'mchale', nameZh: '麦克海尔', nameEn: 'McHale', origin: 'IE', primaryCategory: CATEGORY.BALER },
  { slug: 'kuhn', nameZh: '库恩', nameEn: 'Kuhn', origin: 'FR', primaryCategory: CATEGORY.SOIL },
  { slug: 'lemken', nameZh: '雷肯', nameEn: 'Lemken', origin: 'DE', primaryCategory: CATEGORY.SOIL },
  { slug: 'amazone', nameZh: '阿玛松', nameEn: 'Amazone', origin: 'DE', primaryCategory: CATEGORY.SOIL },
];

// 各品牌机型清单 = 旗舰机型 + 主流在售机型
//
// 📌 2026-11-04 扩容（老板拍板）：原清单只有「各品牌旗舰新款」38 条，实测在
//    mascus 近 60 天库存里 35/38 完全不存在 ⇒ 38 组只命中 1 组。扩容口径**不靠印象、
//    只看真实库存**，筛选规则（见 scripts 侧一次性脚本，未入库）：
//      ① 只算有价条目（mascusItemPriceEur() !== null，即 priceEURO>0 或能折成 EUR）；
//      ② 只算 brand 命中下面 BRANDS 18 个品牌的（`mascusBrandMatches`；
//         Arteer / 空 brand 一律排除 —— 空 brand 是拍卖填充件，实测 137 条）；
//      ③ 同 (brand, model) 样本数 ≥ 3（与 MASCUS_MIN_SAMPLES 同口径）；
//      ④ 按样本数降序，已存在的 (brand, model) 不重复加。
//    筛出 14 组，13 组是新增（全部 john-deere，其余 17 个品牌在 mascus 库存里
//    连一个 ≥3 样本的机型都没有 —— 不是没加，是**无可加**）。
//
// ⚠️ model 字符串必须是 mascus `model` 字段**原样**（这是匹配的输入）：
//    写 `5075E` 而不是 `John Deere 5075E`，写 `8R 370` 而不是 `8R370 / 8R-370`。
//    带品牌前缀（如历史上 `MF 7700`）或把空格拆开的写法在 mascus 侧匹配不上，
//    因为 mascus 的 model 字段不含品牌名 —— 新增时请直接用库存里的原串。
// ⚠️ category 依据 mascus `categoryName` 字段判定（`tractors` → tractor，
//    `combineharvesters` → combine），**不要凭型号名猜**。
// ⚠️ 总 target 上限 500（当前 51 机型 × 6 源 = 306，见 buildTargets）；超限时按样本数截断。
const MODELS = {
  'john-deere': [
    // —— 旗舰（原有）——
    { model: '8R 410', category: CATEGORY.TRACTOR },
    { model: '6R 250', category: CATEGORY.TRACTOR },
    // —— 主流在售（2026-11-04 按 mascus 真实库存扩容，括号内为该机型有价样本数）——
    { model: '5075E', category: CATEGORY.TRACTOR }, // 9，categoryName=tractors
    { model: '8R 370', category: CATEGORY.TRACTOR }, // 7，tractors
    { model: '6R 155', category: CATEGORY.TRACTOR }, // 6，tractors
    { model: 'S780', category: CATEGORY.COMBINE }, // 5，categoryName=combineharvesters
    { model: '8R 280', category: CATEGORY.TRACTOR }, // 4，tractors
    { model: '5055E', category: CATEGORY.TRACTOR }, // 4，tractors
    { model: '5045E', category: CATEGORY.TRACTOR }, // 4，tractors
    { model: '4066R', category: CATEGORY.TRACTOR }, // 3，tractors
    { model: '8370R', category: CATEGORY.TRACTOR }, // 3，tractors
    { model: '6155M', category: CATEGORY.TRACTOR }, // 3，tractors
    { model: '8R 310', category: CATEGORY.TRACTOR }, // 3，tractors
    { model: 'S790', category: CATEGORY.COMBINE }, // 3，combineharvesters
    { model: 'S680', category: CATEGORY.COMBINE }, // 3，combineharvesters
  ],
  'new-holland': [
    { model: 'T7.315', category: CATEGORY.TRACTOR },
    { model: 'T8.435', category: CATEGORY.TRACTOR },
    { model: 'FR920', category: CATEGORY.FORAGE },
  ],
  'case-ih': [
    { model: 'Magnum 380', category: CATEGORY.TRACTOR },
    { model: 'Axial-Flow 8240', category: CATEGORY.COMBINE },
  ],
  'massey-ferguson': [
    { model: '8S.305', category: CATEGORY.TRACTOR },
    { model: 'MF 7700', category: CATEGORY.TRACTOR },
  ],
  fendt: [
    { model: '1050 Vario', category: CATEGORY.TRACTOR },
    { model: '724 Vario', category: CATEGORY.TRACTOR },
  ],
  valtra: [
    { model: 'T254 Versu', category: CATEGORY.TRACTOR },
    { model: 'N175', category: CATEGORY.TRACTOR },
  ],
  'deutz-fahr': [
    { model: '9340 TTV', category: CATEGORY.TRACTOR },
    { model: '7250 TTV', category: CATEGORY.TRACTOR },
  ],
  kubota: [
    { model: 'M7171', category: CATEGORY.TRACTOR },
    { model: 'M135', category: CATEGORY.TRACTOR },
  ],
  yto: [
    { model: 'LX2204', category: CATEGORY.TRACTOR },
    { model: 'MF704', category: CATEGORY.TRACTOR },
  ],
  lovol: [
    { model: 'M2004-5G', category: CATEGORY.TRACTOR },
    { model: 'GE80', category: CATEGORY.COMBINE },
  ],
  mccormick: [
    { model: 'X7.210', category: CATEGORY.TRACTOR },
    { model: 'X8.680', category: CATEGORY.TRACTOR },
  ],
  claas: [
    { model: 'Jaguar 970', category: CATEGORY.FORAGE },
    { model: 'Lexion 8600', category: CATEGORY.COMBINE },
    { model: 'Xerion 5000', category: CATEGORY.TRACTOR },
  ],
  krone: [
    { model: 'BigX 1180', category: CATEGORY.FORAGE },
    { model: 'BiG Pack 1290', category: CATEGORY.BALER },
  ],
  vermeer: [
    { model: '604 Pro', category: CATEGORY.BALER },
    { model: 'WR360', category: CATEGORY.HAY },
  ],
  mchale: [
    { model: 'Fusion 3 Plus', category: CATEGORY.BALER },
    { model: 'V660', category: CATEGORY.BALER },
  ],
  kuhn: [
    { model: 'VB 3190', category: CATEGORY.BALER },
    { model: 'GA 4121', category: CATEGORY.HAY },
  ],
  lemken: [
    { model: 'Rubin 10', category: CATEGORY.SOIL },
    { model: 'Juwel 8', category: CATEGORY.SOIL },
  ],
  amazone: [
    { model: 'Cenius', category: CATEGORY.SOIL },
    { model: 'ZA-TS', category: CATEGORY.SOIL },
  ],
};

// 首期数据源（7 站，含俄线）。russian=true 的站优先（套利核心市场）。
//
// `maxConcurrency`（可选）：该源允许的**在飞请求数上限**，取 `min(它, 全局 concurrency)`。
// 只有 agroline 配了 6，原因：它是 12 个品牌的**唯一**数据源（51 机型 / 61 行），
// 全局 12 路并发全压给它时，实测连打三轮就开始 429。降到 6 路后 4 轮连跑 failed 全 0
// （见 benchmark-ratelimit.test.ts 与提交说明里的实测表）。
// 不配 = 用全局值，其它源行为完全不变。
const SOURCES = [
  {
    key: 'agroline',
    name: 'Agroline',
    region: 'EU',
    currency: 'EUR',
    russian: false,
    // ⚠️ 别调高：agroline 是单点依赖，429 一开就是 12 个品牌同时归零
    maxConcurrency: 6,
  },
  { key: 'machinerypete', name: 'MachineryPete', region: 'US', currency: 'USD', russian: false },
  {
    key: 'mascus',
    name: 'Mascus',
    region: 'GLOBAL',
    currency: 'EUR',
    russian: false,
    // mascus 品牌/型号筛选在 URL 层失效（实测 /tractors/john-deere 返回 Case IH/Challenger 等泛结果），
    // 38 个靶标只落在 4 个品类页上；且 97% 挂牌为询价（priceEURO=0）。
    // 故不再参与按型号的靶标采集，改由品类级扫描单独入库。
    skipInTargets: true,
  },
  { key: 'tractorhouse', name: 'TractorHouse', region: 'US', currency: 'USD', russian: false },
  { key: 'efarm', name: 'e-farm', region: 'GLOBAL', currency: 'EUR', russian: false },
  { key: 'avito', name: 'Avito', region: 'RU', currency: 'RUB', russian: true },
  { key: 'olx', name: 'OLX', region: 'RU/UA', currency: 'RUB', russian: true },
];

// 生成"品牌×机型×源站"目标清单（供爬虫逐条采集）
function buildTargets() {
  const targets = [];
  for (const b of BRANDS) {
    const models = MODELS[b.slug] || [];
    for (const m of models) {
      for (const s of SOURCES) {
        if (s.skipInTargets) continue; // 见 SOURCES 里 mascus 的注释
        targets.push({
          brand: b.slug,
          brandNameZh: b.nameZh,
          nameEn: b.nameEn,
          model: m.model,
          category: m.category,
          sourceSite: s.key,
          region: s.region,
          currency: s.currency,
          russian: s.russian,
        });
      }
    }
  }
  return targets;
}

// —— 简单 GET（带 UA + 超时 + 可选住宅代理），失败时抛错由调用方降级 ——
// proxy: 住宅代理 URL（如 https://user:pass@host:port）；俄线源经此破反爬
function httpGet(url, { timeout = 12000, headers = {}, proxy = null, _redirects = 0 } = {}) {
  const opts = {
    timeout,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      ...headers,
    },
  };
  if (proxy) opts.agent = new HttpsProxyAgent(proxy);
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, opts, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // ⚠️ Location 可以是**相对路径**（实测 mascus 的
        // `/agriculture/other-agricultural-machines` 会 308 跳到
        // `/agriculture/agriculture---others?lastcreateddays=..&page=1`）。
        // 旧实现把原始 Location 直接当 URL 再请求，node 抛 `TypeError: Invalid URL`
        // （ERR_INVALID_URL），表现为「该品类段 5 页全部失败」且看不出是重定向问题。
        // 必须先按当前 URL 解析成绝对地址；解析失败/超过 5 跳直接判定失败，避免死循环。
        res.resume(); // 丢弃重定向响应体，避免 socket 悬挂
        if (_redirects >= 5) return reject(new Error('too-many-redirects'));
        let next;
        try {
          next = new URL(res.headers.location, url).href;
        } catch (e) {
          return reject(new Error(`bad-redirect: ${res.headers.location}`));
        }
        return httpGet(next, { timeout, headers, proxy, _redirects: _redirects + 1 }).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        // ⚠️ 错误对象必须带上**状态码与 Retry-After**，否则上层只能靠 message 字符串
        //    里那几个字符来判断「是限流还是真挂了」—— 429 要退避、5xx 要熔断，
        //    两者处置完全相反，靠 `msg.includes('429')` 判是会出人命的。
        const err = new Error(`HTTP ${res.statusCode}`);
        err.statusCode = res.statusCode;
        err.retryAfterMs = parseRetryAfterMs(res.headers['retry-after']);
        return reject(err);
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(data));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

// —— 429 限流加固：Retry-After 解析 / 指数退避 / 源级信号量 ——
//
// 为什么单独做这一层（2026-11 实测）：
//   agroline 是 12 个品牌的**唯一**数据源，扛着 51 机型 / 61 行。全局 12 路并发全压给它时，
//   10 分钟内连打三轮就把 failed 从 2 抬到 10 —— 全是 429。一轮周更没事，但只要改成日更、
//   或临时手动补数据，立刻翻车，而这 12 个品牌的价格会**同时归零**。
//
// 三条纪律：
//   ① **429 不进熔断**：429 的语义是「服务端让我慢点」，不是「服务端坏了」。
//      熔断是给「这个源彻底不可用」用的；把限流喂进熔断，等于限流一次就把整源封死，
//      剩下几十个目标直接 `circuit-open` —— 处罚远重于过错。
//      （这与 ARK 那次事故同源：把「调用方/配置错误」当成「服务端故障」连坐整条链路。）
//   ② **退避有硬上限**：最多重试 2 次（1s → 2s，±30% 抖动），Retry-After 也封顶 10s。
//      不封顶的话，一个 `Retry-After: 3600` 就能把 260s 总预算直接吃穿。
//   ③ **抖动**：12 个并发同时睡 1s 会在同一毫秒醒来再撞一次，抖动把醒来的时刻打散。
const HTTP_429_MAX_RETRIES = 2;
const HTTP_429_BASE_DELAY_MS = 1000;
const HTTP_429_MAX_RETRY_AFTER_MS = 10000;
const HTTP_429_JITTER_RATIO = 0.3;
/** 源级并发下限：再降也不低于 2，否则单源退化成串行，260s 预算不够用 */
const SOURCE_MIN_CONCURRENCY = 2;

/**
 * 解析 `Retry-After` 头。支持两种合法格式：
 *   - 秒数：`120`（也容忍 `120.5` / 前后空格）
 *   - HTTP-date：`Wed, 21 Oct 2015 07:28:00 GMT`（RFC 7231）
 * 缺失/非法/负数一律返回 `null`（交给调用方用指数退避兜底）。
 *
 * @param {string|string[]|undefined|null} value 原始头值
 * @param {number} [now] 当前时间戳（注入便于单测）
 * @returns {number|null} 需要等待的毫秒数
 */
function parseRetryAfterMs(value, now = Date.now()) {
  if (value == null) return null;
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') return null;
  const txt = raw.trim();
  if (!txt) return null;
  if (/^\d+(\.\d+)?$/.test(txt)) {
    const ms = Math.round(Number(txt) * 1000);
    return ms >= 0 ? ms : null;
  }
  // 只有「看起来像日期」的才交给 Date.parse。否则 `-5` / `1e9` 这类也被 Date.parse
  // 当成某个年份解析出一个数，把「非法头」误判成「等到某个时刻」。
  if (!/[A-Za-z]/.test(txt)) return null;
  const ts = Date.parse(txt);
  if (!Number.isFinite(ts)) return null;
  return Math.max(0, ts - now);
}

/**
 * 算第 `attempt` 次重试要等多久（attempt 从 1 开始）。
 *
 * 优先用服务端给的 `Retry-After`（封顶 `HTTP_429_MAX_RETRY_AFTER_MS`），
 * 没有就指数退避 `1s → 2s`。两者都套 ±`jitterRatio` 抖动。
 *
 * @param {number} attempt 1-based 重试序号
 * @param {number|null} [retryAfterMs]
 * @param {{jitterRatio?: number, rand?: () => number}} [opts]
 * @returns {number} 毫秒（非负整数）
 */
function computeRetryDelay(attempt, retryAfterMs, opts = {}) {
  const base =
    Number.isFinite(retryAfterMs) && retryAfterMs >= 0
      ? Math.min(retryAfterMs, HTTP_429_MAX_RETRY_AFTER_MS)
      : HTTP_429_BASE_DELAY_MS * Math.pow(2, Math.max(0, attempt - 1));
  const ratio = Number.isFinite(opts.jitterRatio) ? opts.jitterRatio : HTTP_429_JITTER_RATIO;
  const rand = typeof opts.rand === 'function' ? opts.rand : Math.random;
  // rand() ∈ [0,1) → 系数 ∈ [1-ratio, 1+ratio)
  const factor = 1 + (rand() * 2 - 1) * ratio;
  return Math.max(0, Math.round(base * factor));
}

/** 默认 sleep（可注入替换，单测里用假 sleep 避免真的等） */
function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 带 429 退避重试的 GET。
 *
 * 只对 **429** 重试；其它错误（5xx / 超时 / 解析）一律原样抛出，
 * 因为它们的正确处置是熔断/跳过，而不是再等一轮。
 *
 * @param {string} url
 * @param {{
 *   request?: object,        // 透传给 httpGet 的 {timeout, headers, proxy}
 *   getImpl?: Function,      // 注入假 GET（单测）
 *   sleep?: Function,        // 注入假 sleep（单测）
 *   maxRetries?: number,     // 默认 HTTP_429_MAX_RETRIES=2
 *   jitterRatio?: number,
 *   rand?: () => number,
 *   deadlineTs?: number,     // 本轮预算的绝对截止时间戳；退避会越过它就放弃重试
 *   onRateLimited?: (info: {attempt: number, delayMs: number, retryAfterMs: number|null, willRetry: boolean}) => void,
 * }} [opts]
 * @returns {Promise<string>} 响应体
 */
async function httpGetWithRetry(url, opts = {}) {
  const getImpl = typeof opts.getImpl === 'function' ? opts.getImpl : httpGet;
  const sleep = typeof opts.sleep === 'function' ? opts.sleep : defaultSleep;
  const maxRetries = Number.isInteger(opts.maxRetries) && opts.maxRetries >= 0
    ? opts.maxRetries
    : HTTP_429_MAX_RETRIES;
  const request = opts.request || {};
  const onRateLimited = typeof opts.onRateLimited === 'function' ? opts.onRateLimited : null;

  let attempt = 0;
  for (;;) {
    try {
      return await getImpl(url, request);
    } catch (e) {
      const is429 = !!e && e.statusCode === 429;
      if (!is429) throw e; // 5xx / 网络 / 超时：不重试，交上层熔断
      const retryAfterMs = Number.isFinite(e.retryAfterMs) ? e.retryAfterMs : null;
      if (attempt >= maxRetries) {
        // 重试用尽：仍要**上报一次**（willRetry=false），否则「限流次数」会漏掉最后一次，
        // 运维看到的 rateLimited 会小于真实 429 命中数。
        if (onRateLimited) {
          onRateLimited({ attempt: attempt + 1, delayMs: 0, retryAfterMs, willRetry: false });
        }
        throw e;
      }
      attempt += 1;
      const delayMs = computeRetryDelay(attempt, retryAfterMs, {
        jitterRatio: opts.jitterRatio,
        rand: opts.rand,
      });
      // 预算闸：这一觉睡下去会越过本轮 deadline ⇒ 不重试了，直接按失败上抛。
      // 没有这道闸，306 个目标 × 2 次退避 × 最多 10s 能凭空造出 100 分钟等待，
      // 「最多重试 2 次」并不能保证不吃穿 budgetMs（260s）。
      if (Number.isFinite(opts.deadlineTs) && Date.now() + delayMs > opts.deadlineTs) {
        if (onRateLimited) {
          onRateLimited({ attempt, delayMs, retryAfterMs, willRetry: false });
        }
        throw e;
      }
      if (onRateLimited) onRateLimited({ attempt, delayMs, retryAfterMs, willRetry: true });
      await sleep(delayMs, { attempt, url });
    }
  }
}

/**
 * 源级并发限制器（per-source semaphore）。
 *
 * 语义：某源的**在飞请求数**不超过 `min(全局 concurrency, 该源 maxConcurrency)`。
 * 全局 12 仍然生效，只是 agroline 这种单点依赖源自己再收一道。
 *
 * 额外能力 `reduce(site)`：观测到 429 时把该源上限**减半**（下限 `SOURCE_MIN_CONCURRENCY`），
 * 本轮不再回升。为什么只降不升：一轮刷新只有 260s，先保命；下轮重新按配置起步。
 *
 * @param {number} globalLimit 全局并发
 * @param {Array<{key: string, maxConcurrency?: number}>} [sources] 源配置（读 maxConcurrency）
 * @returns {{acquire: (site: string) => Promise<void>, release: (site: string) => void, reduce: (site: string) => number, limitOf: (site: string) => number, snapshot: () => Record<string, {limit: number, inflight: number, waiting: number}>}}
 */
function makeSourceLimiter(globalLimit, sources = []) {
  const cfg = new Map();
  for (const s of sources || []) {
    if (!s || !s.key) continue;
    const cap = Number(s.maxConcurrency);
    if (Number.isFinite(cap) && cap > 0) cfg.set(s.key, Math.trunc(cap));
  }
  const g = Math.max(1, Math.trunc(Number(globalLimit) || 1));
  const state = new Map(); // site -> {limit, inflight, waiters: []}

  const read = (site) => {
    let s = state.get(site);
    if (!s) {
      const cap = cfg.get(site);
      const limit = cap ? Math.max(1, Math.min(g, cap)) : g;
      s = { limit, inflight: 0, waiters: [] };
      state.set(site, s);
    }
    return s;
  };

  return {
    limitOf(site) {
      return read(site).limit;
    },
    acquire(site) {
      const s = read(site);
      if (s.inflight < s.limit) {
        s.inflight += 1;
        return Promise.resolve();
      }
      // 排队等一个槽位（release 时唤醒队首）
      return new Promise((resolve) => s.waiters.push(resolve));
    },
    release(site) {
      const s = read(site);
      // 上限被 reduce() 降过时，在飞数可能仍高于新上限 ⇒ 先把额度还回去，
      // 不再放行新请求，直到 inflight 回落到 limit 以内。
      if (s.inflight > s.limit) {
        s.inflight -= 1;
        return;
      }
      const next = s.waiters.shift();
      if (next) {
        // 槽位直接转交给等待者（inflight 不变）
        next();
        return;
      }
      s.inflight = Math.max(0, s.inflight - 1);
    },
    reduce(site) {
      const s = read(site);
      const next = Math.max(SOURCE_MIN_CONCURRENCY, Math.floor(s.limit / 2));
      s.limit = next;
      return next;
    },
    snapshot() {
      const out = {};
      for (const [site, s] of state.entries()) {
        out[site] = { limit: s.limit, inflight: s.inflight, waiting: s.waiters.length };
      }
      return out;
    },
  };
}

// —— 取 FX（foreign→CNY）。优先 open.er-api，失败用兜底 ——
async function getFxRates() {
  try {
    const json = await httpGet('https://open.er-api.com/v6/latest/EUR', { timeout: 10000 });
    const rates = JSON.parse(json).rates; // base EUR
    const eurToCny = rates.CNY;
    return {
      EUR: eurToCny,
      USD: rates.USD ? eurToCny / rates.USD : FX_FALLBACK.USD,
      RUB: rates.RUB ? eurToCny / rates.RUB : FX_FALLBACK.RUB,
      GBP: rates.GBP ? eurToCny / rates.GBP : FX_FALLBACK.GBP,
      CNY: 1,
    };
  } catch (e) {
    console.warn('  ⚠️ FX 实时获取失败，使用兜底常量：', e.message);
    return FX_FALLBACK;
  }
}

// —— 源站搜索 URL 构造 ——
function buildSearchUrl(source, target) {
  const q = encodeURIComponent(`${target.nameEn} ${target.model}`);
  switch (source.key) {
    case 'agroline':
      return `https://www.agroline.com/search_text.php?query=${encodeURIComponent(`${target.nameEn} ${target.model}`)}`;
    case 'machinerypete':
      return `https://www.machinerypete.com/search?q=${q}`;
    case 'mascus': {
      const seg = MASCUS_CATEGORY_PATH[target.category] || 'hay-and-forage-machines';
      return `https://www.mascus.com/agriculture/${seg}?lastcreateddays=${MASCUS_RECENT_DAYS}`;
    }
    case 'tractorhouse':
      return `https://www.tractorhouse.com/search?q=${q}`;
    case 'efarm':
      // ⛔ 2026-11 实测结论：efarm **暂不可采**，此处 URL 保持原样（不要改成 apex 分类页，见下）。
      //
      // 两次独立失败原因（都已用真实请求验证）：
      //   ① `www.e-farm.com` 的任何 HTML 页（含旧 `/en/machines?search=` 与新的
      //      `/en/used-farm-machinery/tractors/`）在本机直连一律 **HTTP 403 +
      //      Cloudflare 的 "Just a moment..." JS 挑战**（响应头 `server: cloudflare`、
      //      `cf-ray: ...-NRT`）。也就是说这个源**是有反爬的**，不是「URL 失效」。
      //   ② 换到 apex `https://e-farm.com/en/used-farm-machinery/<seg>/` 确实 **200 /
      //      252–258KB**（tractors / balers / combine-harvesters 三段都通），但页面里
      //      **`"price"` 出现 0 次、`application/ld+json` 0 个**：列表是客户端渲染的，
      //      `__NEXT_DATA__` 的 `props.pageProps` 只有 `data.blocks[type=search-results]`
      //      的**筛选器配置**（`preFetchedBlockProps['search-results-1']` 只有 `filters`
      //      与 `popularLinks`），没有任何商品条目。商品由前端调用内部 SDK
      //      `searchMachines({ search: { machineType, brands, models, limit, offset,
      //      filters, tags }, countryCode, constraints: 'serp' })` 拉取，地址藏在
      //      cdn2.e-farm.com 的 chunk 里、无公开 API 文档。
      //      分类页里连详情页链接都是 0 个（`href` 只有 10 个品类/品牌导航）。
      //
      // 结论：想拿 efarm 的价格只有两条路，都要额外成本，**故意没做**：
      //   A. 抓详情页（详情页确有 JSON-LD `Product`+`Offer`）：但分类页拿不到详情 URL，
      //      只能靠 sitemapindex 逐 locale 展开 + 每台机一次 457KB 请求 ⇒ 请求量爆炸；
      //   B. 逆向前端 `searchMachines` 私有接口：需要弄清 endpoint、所需头部/鉴权与
      //      `constraints:'serp'` 语义，属于「另做一个采集器」，不是改一行 URL 的事。
      //
      // 为什么不改成 apex 分类页 URL：改完之后该源会从「3 次失败后被熔断开路」
      // （见 makeSourceCircuit，每轮只白打约 3 个请求）变成「38 次 200 但 0 条」，
      // 每轮白拉 38 × 250KB ≈ 9.5MB 且永不熔断，纯亏。留原样反而更省。
      return `https://www.e-farm.com/en/machines?search=${q}`;
    case 'avito':
      return `https://www.avito.ru/rossiya?q=${encodeURIComponent(`${target.nameEn} ${target.model}`)}`;
    case 'olx':
      return `https://www.olx.ua/list/q-${encodeURIComponent(`${target.nameEn} ${target.model}`)}`;
    default:
      return `https://www.bing.com/search?q=${encodeURIComponent(`${target.nameEn} ${target.model} ${source.name}`)}`;
  }
}

// —— 通用价格抽取（多币种）——
const PRICE_RE = [
  /(?:€|EUR|Eur)\s?([\d][\d .\d]{2,}(?:,\d{2})?)/gi,
  /(?:US?\$|USD)\s?([\d][\d .,\d]{2,})/gi,
  /([\d][\d .\d]{3,}(?:,\d{2})?)\s?(?:₽|руб|RUB)/gi,
  /(?:£|GBP)\s?([\d][\d .,\d]{2,})/gi,
];

function extractPrices(text, currency) {
  const found = [];
  for (const re of PRICE_RE) {
    let m;
    while ((m = re.exec(text)) !== null) {
      const raw = m[1].replace(/[^\d.,]/g, '');
      let num;
      if (raw.includes(',') && raw.includes('.')) {
        num = parseFloat(raw.replace(/[,.]/g, (c) => (c === ',' ? '.' : '')));
      } else if (raw.includes(',')) {
        const parts = raw.split(',');
        num = parts.length === 2 && parts[1].length === 3 ? parseFloat(raw.replace(/,/g, '')) : parseFloat(raw.replace(',', '.'));
      } else {
        num = parseFloat(raw);
      }
      if (num && num > 500 && num < 10000000) found.push(num);
    }
  }
  return found;
}

// —— 结构化解析（Agroline / Mascus 等规整列表页）——
function norm(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
// 卡片标题是否与目标品牌+机型相关（避免抓到无关/填充件）
function isRelevant(title, target) {
  const t = norm(title);
  if (!t.includes(norm(target.nameEn))) return false;
  const tokens = norm(target.model).match(/[a-z0-9]+/g) || [];
  return tokens.length ? tokens.every((tok) => t.includes(tok)) : false;
}
// 数字解析（兼容欧式 1.234,56 / 美式 1,234.56 / 纯数字）
function parseNum(raw) {
  const s = String(raw).replace(/[^\d.,]/g, '');
  if (s.includes(',') && s.includes('.')) {
    if (/,\d{2}$/.test(s)) return parseFloat(s.replace(/\./g, '').replace(',', '.'));
    return parseFloat(s.replace(/,/g, ''));
  }
  if (s.includes(',')) {
    const parts = s.split(',');
    if (parts.length === 2 && parts[1].length === 3 && !parts[0].includes('.')) return parseFloat(s.replace(/,/g, ''));
    return parseFloat(s.replace(',', '.'));
  }
  return parseFloat(s);
}
// 从价格文本抽取指定币种的金额（找不到返回 null → 用于跳过"价格面议"）
function extractCurrencyAmount(text, preferredCur) {
  const patterns = [
    { cur: 'EUR', re: /€\s*([\d][\d .,\s]{2,})/ },
    { cur: 'USD', re: /(?:US\$|\$)\s*([\d][\d .,\s]{2,})/ },
    { cur: 'RUB', re: /([\d][\d .,\s]{3,})\s*(?:₽|руб)/ },
    { cur: 'GBP', re: /£\s*([\d][\d .,\s]{2,})/ },
  ];
  let fallback = null;
  for (const p of patterns) {
    const m = text.match(p.re);
    if (m) {
      const n = parseNum(m[1]);
      if (n && n > 500 && n < 1e8) {
        if (p.cur === preferredCur) return { amount: n, currency: p.cur };
        if (!fallback) fallback = { amount: n, currency: p.cur };
      }
    }
  }
  return fallback;
}

// 按源站选择解析策略；非结构化源回退正则
function parseListings(source, html, target) {
  if (source.key === 'agroline') return parseAgroline(html, target, source);
  if (source.key === 'mascus') return parseMascusNextData(html, target, source);
  const prices = extractPrices(html, source.currency);
  return prices.map((p) => ({ priceForeign: p, currency: source.currency }));
}

// Agroline：服务端渲染，卡片 = .sales-list-item，标题在 a[href*="/-/"]，价格 .price-value
function parseAgroline(html, target, source) {
  const $ = cheerio.load(html);
  const out = [];
  $('.sales-list-item').each((_, el) => {
    const card = $(el);
    const link = card.find('a[href*="/-/"]').first();
    const title = link.text().trim() || card.find('a').first().text().trim();
    if (!isRelevant(title, target)) return;
    const priceText = card.find('[class*="price-value"]').first().text();
    const amt = extractCurrencyAmount(priceText, 'EUR');
    if (!amt) return; // 跳过 Price on request / 无价
    out.push({ priceForeign: amt.amount, currency: amt.currency, title: title.trim(), url: link.attr('href') });
  });
  return out;
}

// Mascus 已整站改版为 Next.js：商品数据在 <script id="__NEXT_DATA__"> 的
// props.pageProps.searchRes.searchData.items 里（40 条/页，结构化 JSON）。
// 旧版 CSS class 抓取（parseMascus）在改版后匹配不到任何卡片，仅作回退保留。
function parseMascusNextData(html, target, source) {
  const m = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/.exec(html);
  if (!m) return [];
  let root;
  try {
    root = JSON.parse(m[1]);
  } catch {
    return [];
  }
  const searchData = root?.props?.pageProps?.searchRes?.searchData || {};
  const items = Array.isArray(searchData.items) ? searchData.items : [];
  const out = [];
  for (const it of items) {
    const title = `${it.brand || ''} ${it.model || ''}`.trim();
    if (!title) continue;
    // priceEURO 为 0 表示「询价」（实测占 39/40），无价不能参与价格中位
    const eur = Number(it.priceEURO) || 0;
    if (eur <= 0) continue;
    if (!isRelevant(title, target)) continue;
    out.push({
      priceForeign: eur,
      currency: 'EUR',
      title,
      url: it.assetUrl ? `https://www.mascus.com${it.assetUrl}` : undefined,
      // 以下字段不参与价格聚合，供线索入库/溯源使用
      sourceDate: it.createDate || undefined,
      listingId: it.productId || undefined,
      sellerPhone: it.sellerPhone || undefined,
      companyName: it.companyName || undefined,
      country: it.locationCountryCode || undefined,
      city: it.locationCity || undefined,
      yearOfManufacture: it.yearOfManufacture || undefined,
      meterReadout: it.meterReadout ?? undefined,
      categoryName: it.categoryName || undefined,
    });
  }
  return out;
}

// 运维排查用：解析 __NEXT_DATA__ 的元信息（总量/标题/品类/条数/有价条数），不参与价格聚合
function parseMascusDiagnostics(html) {
  const m = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/.exec(html);
  if (!m) return { ok: false, reason: 'no-next-data' };
  let root;
  try {
    root = JSON.parse(m[1]);
  } catch {
    return { ok: false, reason: 'bad-json' };
  }
  const sd = root?.props?.pageProps?.searchRes?.searchData || {};
  const items = Array.isArray(sd.items) ? sd.items : [];
  return {
    ok: true,
    totalResults: sd.totalResults ?? null,
    searchTitle: sd.searchTitle || null,
    resolvedCategory: sd.resolvedCategory || null,
    errorMessage: sd.errorMessage || null,
    itemCount: items.length,
    withPrice: items.filter((i) => (Number(i.priceEURO) || 0) > 0).length,
  };
}

// —— mascus bulk 采集的三个纯函数（解析 / 匹配 / 折价）——
// 之所以拆成纯函数：`fetchMascusBulk` 里要跑 25 次网络请求，
// 匹配规则若埋在请求循环里就没法用缓存 HTML 离线回归（本次改版就是吃了这个亏：
// 解析器静默返回 0 条，因为没人能在不发网络请求的前提下验证匹配规则）。

/**
 * 从 mascus 列表页 HTML 抽取 `__NEXT_DATA__` 里的**原始** items 数组。
 *
 * 与上面的 `parseMascusNextData(html, target, source)` 的区别：
 *   - 那个是「按单个 target 过滤 + 只保留有价」的旧口径，签名已被 route/单测占用；
 *   - 本函数只负责「把页面数据挖出来」，**不做任何过滤**（品牌/型号/价格都交给调用方），
 *     因为 bulk 模式下是「先全量合并去重，再在内存里按 18 个品牌逐一匹配」。
 *
 * 任何异常（无 script / JSON 坏 / 结构变更）一律返回 `{ ok:false, items:[] }`，
 * **绝不抛错** —— 25 页里坏一页不能炸掉整轮采集。
 *
 * @param {string} html 列表页完整 HTML
 * @returns {{ ok: boolean, reason?: string, items: Array<Record<string, any>>, totalResults: number }}
 */
function parseMascusNextDataItems(html) {
  if (typeof html !== 'string' || html.length === 0) {
    return { ok: false, reason: 'empty-html', items: [], totalResults: 0 };
  }
  // 属性顺序无关、容忍单/双引号（与 mascus-leads/parse.ts 的正则保持一致）
  const m = /<script\b[^>]*\bid\s*=\s*["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i.exec(html);
  if (!m || !m[1]) return { ok: false, reason: 'no-next-data', items: [], totalResults: 0 };
  let root;
  try {
    root = JSON.parse(m[1]);
  } catch (e) {
    return { ok: false, reason: 'bad-json', items: [], totalResults: 0 };
  }
  const searchRes = root && root.props && root.props.pageProps ? root.props.pageProps.searchRes : null;
  const searchData = searchRes && typeof searchRes === 'object' ? searchRes.searchData : null;
  const rawItems = searchData && typeof searchData === 'object' ? searchData.items : null;
  if (!Array.isArray(rawItems)) {
    return { ok: false, reason: 'no-items', items: [], totalResults: 0 };
  }
  // totalResults 与 items 同层；个别页面版本把它上提到 searchRes 层，两处都兼容
  const totalRaw =
    (searchData && searchData.totalResults != null ? searchData.totalResults : null) ??
    (searchRes && searchRes.totalResults != null ? searchRes.totalResults : null);
  const totalNum = Number(totalRaw);
  return {
    ok: true,
    items: rawItems,
    totalResults: Number.isFinite(totalNum) ? Math.max(0, Math.trunc(totalNum)) : 0,
  };
}

/**
 * 品牌匹配：归一化后「相等 或 互相包含」。
 *
 * 为什么允许双向包含：mascus 的 `brand` 字段写法不统一（实测同站内既有
 * `Case IH` 也有 `Case`、既有 `New Holland` 也有 `NewHolland`）。归一化（`norm`）后
 * 双向包含能覆盖这些变体。**必须有非空 + 长度下限**：`norm('')` 是空串，而
 * `'johndeere'.includes('')` 恒为 true —— 少了这道闸，137 条 brand 为空的拍卖填充件
 * 会同时命中全部 18 个品牌（本次实测这个 bug 让每个品牌的「命中数」都虚高 137）。
 *
 * @param {unknown} itemBrand mascus item.brand 原值
 * @param {string} nameEn 目标品牌英文名（如 'John Deere'）
 * @returns {boolean}
 */
function mascusBrandMatches(itemBrand, nameEn) {
  const ib = norm(itemBrand);
  const tb = norm(nameEn);
  if (!ib || !tb) return false;
  if (ib.length < 2 || tb.length < 2) return false;
  return ib === tb || ib.includes(tb) || tb.includes(ib);
}

/**
 * 型号 token 化：`'8R 410' → ['8r','410']`、`'T7.315' → ['t7','315']`。
 *
 * ⚠️ 必须在**原始字符串**上 `/[a-z0-9]+/g` 切分，**不能**先过 `norm()`：
 * `norm()` 会把空格/点号一起剥掉，`'8R 410'` 归一化成 `'8r410'` 后只剩一个 token，
 * 词块匹配直接失效（这个坑本次实测踩过一次：`8R 410` 反而匹配不到 `8R 410`）。
 *
 * @param {string} model 目标机型（MODELS 里配置的写法）
 * @returns {string[]}
 */
function mascusModelTokens(model) {
  return (String(model == null ? '' : model).toLowerCase().match(/[a-z0-9]+/g) || []).filter(
    (t) => t.length > 0
  );
}

/**
 * 型号匹配：**每个** model token 都必须作为独立词块出现在条目自身的 `model` 字段里。
 *
 * 语义要点（容易写错的地方）：
 *   - mascus 的 `model` 字段本身就只含型号（如 `5075E` / `8R 410`），
 *     **不要**再要求品牌名出现在 model 里 —— 那会让 100% 的条目匹配失败；
 *   - 匹配前把两侧都按「非字母数字」切成词块再比对（而不是裸 `includes`）：
 *     裸 `includes('410')` 会让目标 `8R 410` 误中 `8R 4100`、目标 `724 Vario`
 *     误中 `7240 Vario`，把不相干的机型价混进中位价。词块口径下
 *     `8R 410` 能匹配 `8R 410` / `8R 410 Premium` / `8R410`（切成 `8r410` 后
 *     token 会退化，见下面的二次尝试），但匹配不到 `8R 4100`。
 *
 * @param {unknown} itemModel mascus item.model 原值
 * @param {string[]} tokens 目标机型的 token 列表
 * @returns {boolean}
 */
function mascusModelMatches(itemModel, tokens) {
  if (!tokens.length) return false;
  const text = String(itemModel == null ? '' : itemModel).toLowerCase();
  // 词块序列：'8R-410 Premium' → ['8r','410','premium']；两侧加空格便于整词匹配
  const words = text.split(/[^a-z0-9]+/).filter((w) => w.length > 0);
  if (!words.length) return false;

  // ① 首选：每个 token 都是独立词块（最严格，无假阳性）
  const padded = ` ${words.join(' ')} `;
  if (tokens.every((tok) => padded.includes(` ${tok} `))) return true;

  // ② 回退：mascus 把型号连写成一格（'8R410' / 'T7.315' 归一化后 't7315'）。
  //    此时要求「整个 token 串」作为单个词块出现，仍然不接受前缀式假阳性
  //    （'8r410' ≠ '8r4100'，因为是整词比较而非 includes）。
  const joined = tokens.join('');
  return words.some((w) => w === joined);
}

/**
 * 单条 mascus 挂牌 → EUR 金额（**绝不编造价格**）。
 *
 * 折算规则（`fx` 是「外币 → CNY」的汇率表，方向不要算反）：
 *   1. `priceEURO > 0` → 直接用（mascus 已按当日汇率折好）；
 *   2. 否则若 `priceOriginal > 0` → 按 `priceOriginalUnit`（回落 `userCurrency`）
 *      折成 EUR：`amountEur = priceOriginal * fx[unit] / fx.EUR`
 *      （先乘成 CNY，再除以「1 EUR 值多少 CNY」）；
 *   3. 两者都 ≤ 0 → 返回 null（询价条目，一律不入库）。
 *
 * @param {Record<string, any>} item mascus item
 * @param {Record<string, number>} fx 外币→CNY 汇率表
 * @returns {{ amount: number, currency: string } | null}
 */
function mascusItemPriceEur(item, fx) {
  const eur = Number(item && item.priceEURO) || 0;
  if (Number.isFinite(eur) && eur > 0) return { amount: eur, currency: 'EUR' };

  const original = Number(item && item.priceOriginal) || 0;
  if (!Number.isFinite(original) || original <= 0) return null;

  const unit = String((item && (item.priceOriginalUnit || item.userCurrency)) || '')
    .trim()
    .toUpperCase();
  if (!unit || unit === 'EUR') return { amount: original, currency: 'EUR' };

  const rates = fx || {};
  const unitToCny = Number(rates[unit]) || Number(FX_FALLBACK[unit]) || 0;
  const eurToCny = Number(rates.EUR) || Number(FX_FALLBACK.EUR) || 0;
  if (!(unitToCny > 0) || !(eurToCny > 0)) return null; // 汇率缺失 → 宁可跳过，也不猜
  const amountEur = Math.round((original * unitToCny) / eurToCny);
  return amountEur > 0 ? { amount: amountEur, currency: 'EUR' } : null;
}

// ⚠️ 已失效：Mascus 整站改版为 Next.js 后，旧版 CSS class（SearchResultItem_brandmodel）
// 匹配不到任何卡片，正常路径改走 parseMascusNextData；此函数仅作极端回退保留。

// Mascus：React 客户端渲染，原始 HTML 多为拍卖填充件；仅接受含真实数字价格的卡片
function parseMascus(html, target, source) {
  const $ = cheerio.load(html);
  const out = [];
  $('[class*="SearchResultItem_brandmodel"]').each((_, el) => {
    const card = $(el).closest('[class*="SearchResultItem"]');
    if (!card.length) return;
    const title = $(el).text().trim();
    if (!isRelevant(title, target)) return;
    const priceText = card.find('[class*="priceWrapper"]').first().text();
    const amt = extractCurrencyAmount(priceText, source ? source.currency : null);
    if (!amt) return;
    out.push({ priceForeign: amt.amount, currency: amt.currency, title, url: card.find('a').first().attr('href') });
  });
  return out;
}

// —— 聚合（多币种 → 统一折算 CNY，IQR 离群过滤 + 置信度）——
function aggregateListings(listings, fx, opts = {}) {
  if (!listings.length) return null;
  const cnyList = [];
  const foreignByCur = {};
  for (const l of listings) {
    const rate = fx[l.currency] || FX_FALLBACK[l.currency] || 1;
    cnyList.push(Math.round(l.priceForeign * rate));
    (foreignByCur[l.currency] = foreignByCur[l.currency] || []).push(l.priceForeign);
  }
  const sorted = cnyList.slice().sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;
  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;
  const clean = sorted.filter((n) => n >= lo && n <= hi);
  const finalCny = clean.length >= 3 ? clean : sorted;
  const medianCny = medianOf(finalCny);
  let domCur = null, max = 0;
  for (const [c, arr] of Object.entries(foreignByCur)) {
    if (arr.length > max) { max = arr.length; domCur = c; }
  }
  const medianForeign = medianOf(foreignByCur[domCur].slice().sort((a, b) => a - b));
  const rate = fx[domCur] || FX_FALLBACK[domCur] || 1;
  const sampleSize = finalCny.length;
  return {
    priceForeign: round2(medianForeign),
    medianPrice: round2(medianForeign),
    currency: domCur,
    priceCny: round2(medianCny),
    exchangeRate: round4(rate),
    sampleSize,
    listingCount: listings.length,
    confidenceScore: round2(confidenceScore({ sources: 1, sampleSize, ageDays: 0 })),
    priceType: opts.priceType || 'listing',
  };
}

// —— 聚合（旧版：单价币种，兼容回退）——
function aggregate(listings, source, fx, opts = {}) {
  if (!listings.length) return null;
  const nums = listings.map((l) => l.priceForeign).sort((a, b) => a - b);
  const median = medianOf(nums);
  const q1 = quantile(nums, 0.25);
  const q3 = quantile(nums, 0.75);
  const iqr = q3 - q1;
  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;
  const clean = nums.filter((n) => n >= lo && n <= hi);
  const finalNums = clean.length >= 3 ? clean : nums;
  const priceForeign = medianOf(finalNums);
  const rate = fx[source.currency] || FX_FALLBACK[source.currency] || 1;
  const sampleSize = finalNums.length;
  const confidence = confidenceScore({ sources: 1, sampleSize, ageDays: 0 });
  return {
    priceForeign: round2(priceForeign),
    medianPrice: round2(median),
    currency: source.currency,
    priceCny: round2(priceForeign * rate),
    exchangeRate: round4(rate),
    sampleSize,
    listingCount: listings.length,
    confidenceScore: round2(confidence),
    priceType: opts.priceType || 'listing',
  };
}

function medianOf(arr) {
  if (!arr.length) return 0;
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
}
function quantile(arr, q) {
  if (!arr.length) return 0;
  const pos = (arr.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return arr[base] !== undefined ? arr[base] + rest * ((arr[base + 1] || arr[base]) - arr[base]) : arr[0];
}
function confidenceScore({ sources, sampleSize, ageDays }) {
  let s = 0.3;
  if (sources >= 2) s = 0.6;
  if (sources >= 3) s = 0.85;
  if (sampleSize >= 3) s += 0.05;
  if (sampleSize >= 8) s += 0.05;
  if (ageDays > 30) s -= 0.2;
  if (ageDays > 60) s -= 0.2;
  return Math.max(0.1, Math.min(0.95, s));
}
const round2 = (n) => Math.round(n * 100) / 100;
const round4 = (n) => Math.round(n * 10000) / 10000;

// —— 日期解析（sourceDate 实测有 Date / 'YYYY-MM-DD' / 'YYYYMMDD' / ISO 三种形态）——
// 返回 epoch ms；无法解析返回 null —— 调用方一律「解析失败就放行」，
// 宁可放过一次正常写入，也不能因为格式不认识就把真实数据误杀。
function parseSourceDate(v) {
  if (v == null) return null;
  if (v instanceof Date) {
    const t = v.getTime();
    return Number.isFinite(t) ? t : null;
  }
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s) return null;

  const ymd = (y, m, d) => {
    const year = Number(y);
    const month = Number(m);
    const day = Number(d);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const t = Date.UTC(year, month - 1, day);
    return Number.isFinite(t) ? t : null;
  };

  // 'YYYYMMDD'
  let m = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
  if (m) return ymd(m[1], m[2], m[3]);
  // 'YYYY-MM-DD' / 'YYYY-MM-DDTHH:mm:ssZ'
  m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return ymd(m[1], m[2], m[3]);

  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

// 仅用于日志：epoch ms → 'YYYY-MM-DD'
function formatSourceDate(ts) {
  return ts == null ? '' : new Date(ts).toISOString().slice(0, 10);
}

// —— 写库（按 brand+model+sourceSite upsert）——
/**
 * @param {object} row  待写入行
 * @param {object} [opts]
 * @param {boolean} [opts.insertOnly] true = 已存在即跳过，**一个字段都不写**
 *   （连 `lastVerified` 也不写：正是要让"没更新"这件事不被新时间戳掩盖）
 */
async function upsertBenchmark(row, opts = {}) {
  const existing = await prisma.brandBenchmark.findFirst({
    where: { brand: row.brand, model: row.model, sourceSite: row.sourceSite },
  });

  // ① 真幂等（insertOnly）：已存在就跳过，不写任何字段。
  //    禁止连 lastVerified 一起刷新 —— 否则会制造「任务天天在跑、时间戳天天是新的、
  //    数据其实几个月没变」的假活假象（实测 92 行中 64 行 sourceDate 停在 8 月，
  //    而 71 行 lastVerified 昨晚被刷成最新）。
  if (existing && opts.insertOnly === true) {
    return { skipped: true, id: existing.id };
  }

  // ② sourceDate 回滚护栏：禁止用更旧的数据时间覆盖较新的行（防其他调用方重放旧种子）。
  //    任一方解析失败就放行 —— 宁可放过，不能误杀正常写入。
  if (existing) {
    const incomingTs = parseSourceDate(row.sourceDate);
    const existingTs = parseSourceDate(existing.sourceDate);
    if (incomingTs != null && existingTs != null && incomingTs < existingTs) {
      console.warn(
        `⚠️ 跳过回滚写入 ${row.brand} ${row.model} @${row.sourceSite}: ` +
          `sourceDate ${formatSourceDate(incomingTs)} 早于库里 ${formatSourceDate(existingTs)}`
      );
      return { skipped: true, id: existing.id, reason: 'stale-source-date' };
    }
  }

  const data = {
    brand: row.brand,
    brandNameZh: row.brandNameZh,
    model: row.model,
    category: row.category,
    sourceSite: row.sourceSite,
    priceForeign: row.priceForeign,
    currency: row.currency,
    priceCny: row.priceCny,
    exchangeRate: row.exchangeRate,
    sourceUrl: row.sourceUrl || null,
    sourceDate: row.sourceDate || null,
    confidenceScore: row.confidenceScore,
    sampleSize: row.sampleSize,
    medianPrice: row.medianPrice,
    listingCount: row.listingCount,
    priceType: row.priceType || 'listing',
    region: row.region || null,
    lastVerified: new Date(),
    isActive: true,
  };
  if (existing) {
    return prisma.brandBenchmark.update({ where: { id: existing.id }, data });
  }
  return prisma.brandBenchmark.create({ data });
}

// —— 单目标采集（网络不可达/无样本则降级，不写脏数据）——
/**
 * @param {object} target 靶标
 * @param {Record<string, number>} fx
 * @param {number} timeoutMs 单次请求超时
 * @param {{getImpl?: Function, sleep?: Function, maxRetries?: number, rand?: () => number,
 *          jitterRatio?: number, onRateLimited?: Function}} [opts]
 *   `getImpl`/`sleep` 是给单测注入的（离线跑 429 退避，不打真网络）。
 *   `onRateLimited` 由 runRefresh 传进来，用来「记一次限流 + 把该源并发减半」。
 */
async function fetchOneTarget(target, fx, timeoutMs, opts = {}) {
  const source = SOURCES.find((s) => s.key === target.sourceSite);
  if (!source) return { status: 'skip', reason: 'no-source' };
  const url = buildSearchUrl(source, target);
  // 俄线源：若配置了住宅代理则强制走代理破反爬（Avito/OLX 从数据中心 IP 必被 403/429）
  const proxy = target.russian && process.env.RESIDENTIAL_PROXY ? process.env.RESIDENTIAL_PROXY : null;
  try {
    // 429（服务端让我慢点）在这里退避重试；5xx/网络错误不重试，直接抛给熔断
    const html = await httpGetWithRetry(url, {
      request: {
        timeout: timeoutMs,
        proxy,
        headers: target.russian ? { 'Accept-Language': 'ru-RU,ru;q=0.9' } : {},
      },
      getImpl: opts.getImpl,
      sleep: opts.sleep,
      maxRetries: opts.maxRetries,
      jitterRatio: opts.jitterRatio,
      rand: opts.rand,
      deadlineTs: opts.deadlineTs,
      onRateLimited: opts.onRateLimited,
    });
    const listings = parseListings(source, html, target);
    if (!listings.length) return { status: 'skip', reason: 'no-listing' };
    const agg = aggregateListings(listings, fx, { priceType: 'listing' });
    if (!agg) return { status: 'skip', reason: 'no-agg' };
    await upsertBenchmark({
      ...target,
      ...agg,
      sourceUrl: url,
      sourceDate: new Date().toISOString().slice(0, 10),
      region: source.region,
    });
    return { status: 'ok', count: listings.length };
  } catch (e) {
    // 429 重试仍失败：单独打标，让上层「记 failed 但不喂熔断」+ failReasons 可区分
    if (e && e.statusCode === 429) {
      return { status: 'failed', reason: 'http-429', rateLimited: true };
    }
    return { status: 'failed', reason: e.message };
  }
}

// —— mascus 品类级 bulk 采集（唯一能拿到 mascus 价格的通道）——
/**
 * 抓 mascus 品类段列表页 → 全量合并去重 → 按 (brand, model) 本地匹配 → 聚合 → 写库。
 *
 * 为什么必须走 bulk 而不能再走 `fetchOneTarget`：
 *   mascus 改版后服务端**完全忽略** `?q=` 与品牌/型号参数（实测 `/tractors/john-deere`
 *   返回 Case IH / Challenger 等泛结果）。也就是说「每个 brand×model 打一次搜索」在
 *   mascus 上原理性地拿不到对应机型 —— 38 个靶标只会命中 4 个品类页（去重 9.5 倍），
 *   每次都是同一批全站结果。故改为「按品类段批量拉，再在内存里匹配」。
 *
 * 流程与口径：
 *   1. 段清单 = `MASCUS_BULK_SEGMENTS`（与 mascus-leads/parse.ts 的 MASCUS_SCAN_SEGMENTS 同步）；
 *      每段 P=1..maxPages，URL 带 `lastcreateddays=60&page=P` 限定「近 60 天新挂牌」；
 *   2. 全量 items 按 `productId` 去重（同一台机常同时出现在多个品类段）；
 *   3. 对 `BRANDS`/`MODELS` 的每个 (brand, model) 在合并集里匹配
 *      （品牌：归一化双向包含；型号：token 全命中），**只保留有价条目**；
 *   4. 折价统一到 EUR（见 `mascusItemPriceEur`），复用 `aggregateListings` 做
 *      IQR 离群过滤 + 中位价 + 置信度；
 *   5. 每组样本数 `< minSamples`（默认 3）记 skip（reason `too-few-samples`）不写库；
 *   6. `sourceDate` 取**抓取当天**（与 agroline 语义一致：URL 已把范围限定为近 60 天）；
 *   7. 写库走 `upsertBenchmark`，幂等键 brand+model+sourceSite ⇒ 同一批跑两次只更新不新增。
 *
 * 网络失败策略：单页失败不抛错、计入 `failedPages` 后继续；整段 0 条会进 `emptySegments`
 * （那是「路径失效」的唯一信号，必须能被告警看到）。
 *
 * @param {object} [opts]
 * @param {Record<string, number>} [opts.fx] 外币→CNY 汇率表（缺省自行拉取）
 * @param {number} [opts.maxPages=5] 每个品类段翻页数
 * @param {number} [opts.timeoutMs=25000] 单页超时（mascus 页 650KB / 实测 1–4s，8s 会误杀）
 * @param {number} [opts.recentDays=60] `lastcreateddays`
 * @param {number} [opts.minSamples=3] 单组最少样本数
 * @param {number} [opts.concurrency=4] 并发页数（对 mascus 不宜过高，避免被限流）
 * @param {number} [opts.budgetMs=90000] bulk 自身预算上限（超预算停止翻页，已抓到的照常聚合）
 * @param {boolean} [opts.dryRun=false] true = 只统计不写库
 * @returns {Promise<{
 *   ok: boolean,
 *   dryRun: boolean,
 *   totalPages: number, fetchedPages: number, failedPages: number,
 *   items: number, uniqueItems: number, pricedItems: number,
 *   groups: number, written: number, skipped: number, failed: number,
 *   rows: Array<Record<string, any>>,
 *   byReason: Record<string, number>,
 *   bySegment: Record<string, { items: number, priced: number, totalResults: number, pages: number, failedPages: number, ok: boolean }>,
 *   emptySegments: string[],
 *   durationMs: number
 * }>}
 */
async function fetchMascusBulk(opts = {}) {
  const startTs = Date.now();
  const fx = opts.fx || (await getFxRates());
  const rawMaxPages = Number(opts.maxPages);
  const maxPages =
    Number.isFinite(rawMaxPages) && rawMaxPages > 0
      ? Math.min(50, Math.trunc(rawMaxPages))
      : MASCUS_BULK_MAX_PAGES;
  const rawRecent = Number(opts.recentDays);
  const recentDays =
    Number.isFinite(rawRecent) && rawRecent > 0 ? Math.trunc(rawRecent) : MASCUS_BULK_RECENT_DAYS;
  const rawTimeout = Number(opts.timeoutMs);
  const timeoutMs = Number.isFinite(rawTimeout) && rawTimeout > 0 ? Math.trunc(rawTimeout) : 25000;
  const rawMin = Number(opts.minSamples);
  const minSamples =
    Number.isFinite(rawMin) && rawMin >= 1 ? Math.trunc(rawMin) : MASCUS_MIN_SAMPLES;
  const rawConc = Number(opts.concurrency);
  const concurrency = Number.isFinite(rawConc) && rawConc > 0 ? Math.min(8, Math.trunc(rawConc)) : 4;
  const rawBudget = Number(opts.budgetMs);
  const budgetMs = Number.isFinite(rawBudget) && rawBudget > 0 ? Math.trunc(rawBudget) : 90000;
  const dryRun = opts.dryRun === true;
  const today = new Date().toISOString().slice(0, 10);

  // ① 待抓页面清单（段 × 页），顺序固定便于复现
  const jobs = [];
  for (const seg of MASCUS_BULK_SEGMENTS) {
    for (let page = 1; page <= maxPages; page += 1) {
      jobs.push({
        segment: seg,
        page,
        url: `${MASCUS_ORIGIN}/agriculture/${seg}?lastcreateddays=${recentDays}&page=${page}`,
      });
    }
  }

  const bySegment = {};
  for (const seg of MASCUS_BULK_SEGMENTS) {
    bySegment[seg] = { items: 0, priced: 0, totalResults: 0, pages: 0, failedPages: 0, ok: false };
  }

  const collected = []; // { item, url }（去重前）
  let fetchedPages = 0;
  let failedPages = 0;
  let budgetExhausted = false;

  const runJob = async (job) => {
    try {
      const html = await httpGet(job.url, { timeout: timeoutMs });
      const parsed = parseMascusNextDataItems(html);
      if (!parsed.ok) {
        failedPages += 1;
        bySegment[job.segment].failedPages += 1;
        return;
      }
      fetchedPages += 1;
      const st = bySegment[job.segment];
      st.pages += 1;
      st.ok = true;
      st.items += parsed.items.length;
      if (parsed.totalResults > st.totalResults) st.totalResults = parsed.totalResults;
      for (const item of parsed.items) collected.push({ item, url: job.url, segment: job.segment });
    } catch (e) {
      failedPages += 1;
      bySegment[job.segment].failedPages += 1;
    }
  };

  const queue = jobs.slice();
  const worker = async () => {
    while (queue.length) {
      if (Date.now() - startTs > budgetMs) {
        budgetExhausted = true;
        queue.length = 0;
        break;
      }
      const job = queue.shift();
      await runJob(job);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, () => worker()));

  // ② 按 productId 去重（保留首次出现；同一台机常跨段重复）
  const seen = new Set();
  const unique = [];
  for (const entry of collected) {
    const pid = entry.item && entry.item.productId;
    if (!pid) continue; // productId 缺失 = 脏数据，丢弃（无法追溯）
    if (seen.has(pid)) continue;
    seen.add(pid);
    unique.push(entry);
  }

  // ③ 折价：统一折成 EUR，并顺手统计「有价条数」
  //    `pricedByProductId` 是后续匹配的核心索引：**只有在这里出现过的 productId 才允许入库**，
  //    两条路径都不可能有价格的一律 map miss ⇒ 天然不会编造价格。
  const pricedByProductId = new Map();
  for (const entry of unique) {
    const price = mascusItemPriceEur(entry.item, fx);
    if (!price) continue;
    pricedByProductId.set(entry.item.productId, price);
  }

  // ④ 分段「有价条数」（按去重后条目首次出现的段归集；用于发现「该段整体无价」这类结构变化）
  for (const seg of MASCUS_BULK_SEGMENTS) bySegment[seg].priced = 0;
  for (const entry of unique) {
    if (!pricedByProductId.has(entry.item.productId)) continue;
    if (bySegment[entry.segment]) bySegment[entry.segment].priced += 1;
  }

  // ⑤ 按 (brand, model) 匹配 + 聚合 + 写库
  const groups = [];
  const byReason = {};
  const bump = (reason) => {
    const k = reason || 'unknown';
    byReason[k] = (byReason[k] || 0) + 1;
  };

  for (const brand of BRANDS) {
    const models = MODELS[brand.slug] || [];
    for (const modelDef of models) {
      const tokens = mascusModelTokens(modelDef.model);
      const listings = [];
      let firstUrl = null;
      for (const entry of unique) {
        const item = entry.item;
        if (!mascusBrandMatches(item.brand, brand.nameEn)) continue;
        if (!mascusModelMatches(item.model, tokens)) continue;
        const price = pricedByProductId.get(item.productId);
        if (!price) continue; // 询价条目：绝不编造价格
        listings.push({
          priceForeign: price.amount,
          currency: price.currency,
          title: `${item.brand || ''} ${item.model || ''}`.trim(),
          productId: item.productId,
        });
        if (!firstUrl) firstUrl = entry.url;
      }

      const group = {
        brand: brand.slug,
        brandNameZh: brand.nameZh,
        model: modelDef.model,
        category: modelDef.category,
        samples: listings.length,
        status: 'skip',
        reason: null,
      };

      if (listings.length === 0) {
        group.reason = 'no-listing';
        bump('no-listing');
        groups.push(group);
        continue;
      }
      if (listings.length < minSamples) {
        group.reason = 'too-few-samples';
        bump('too-few-samples');
        groups.push(group);
        continue;
      }

      const agg = aggregateListings(listings, fx, { priceType: 'listing' });
      if (!agg) {
        group.reason = 'no-agg';
        bump('no-agg');
        groups.push(group);
        continue;
      }

      Object.assign(group, {
        medianForeign: agg.priceForeign,
        currency: agg.currency,
        medianCny: agg.priceCny,
        exchangeRate: agg.exchangeRate,
        listingCount: agg.listingCount,
        sampleSize: agg.sampleSize,
        confidenceScore: agg.confidenceScore,
        sourceDate: today,
      });

      if (dryRun) {
        group.status = 'ok';
        group.reason = 'dry-run';
        groups.push(group);
        continue;
      }

      try {
        const res = await upsertBenchmark({
          brand: brand.slug,
          brandNameZh: brand.nameZh,
          model: modelDef.model,
          category: modelDef.category,
          sourceSite: 'mascus',
          priceForeign: agg.priceForeign,
          medianPrice: agg.medianPrice,
          currency: agg.currency,
          priceCny: agg.priceCny,
          exchangeRate: agg.exchangeRate,
          sourceUrl: firstUrl,
          sourceDate: today,
          confidenceScore: agg.confidenceScore,
          sampleSize: agg.sampleSize,
          listingCount: agg.listingCount,
          priceType: 'listing',
          region: 'GLOBAL',
        });
        if (res && res.skipped) {
          group.status = 'skip';
          group.reason = res.reason || 'upsert-skipped';
          bump(group.reason);
        } else {
          group.status = 'ok';
          group.id = res && res.id;
        }
      } catch (e) {
        group.status = 'failed';
        group.reason = `write-failed: ${e.message}`;
        bump('write-failed');
      }
      groups.push(group);
    }
  }

  // ⑥ 汇总
  const written = groups.filter((g) => g.status === 'ok').length;
  const skipped = groups.filter((g) => g.status === 'skip').length;
  const failed = groups.filter((g) => g.status === 'failed').length;
  const emptySegments = MASCUS_BULK_SEGMENTS.filter((seg) => {
    const st = bySegment[seg];
    return st.items === 0 && st.totalResults === 0;
  });

  return {
    ok: fetchedPages > 0,
    dryRun,
    budgetExhausted,
    recentDays,
    maxPages,
    totalPages: jobs.length,
    fetchedPages,
    failedPages,
    items: collected.length,
    uniqueItems: unique.length,
    pricedItems: pricedByProductId.size,
    groups: groups.length,
    written,
    skipped,
    failed,
    rows: groups.filter((g) => g.status === 'ok'),
    groupDetail: groups,
    byReason,
    bySegment,
    emptySegments,
    durationMs: Date.now() - startTs,
  };
}

// —— Ark web_search 兜底通道（默认关闭，见 runRefresh 的双重门控）——
//
// 存在理由：machinerypete(470 自建 WAF) / tractorhouse(403 Cloudflare) / agriaffaires(403 DataDome)
// 这类「硬拦」源，提超时、换 UA、加并发都无效 —— 它们不是在慢，是在拒绝我们。
// 2026-11 方舟 web_search 打通后，实测可以绕过这类 WAF 拿到真实挂牌价
// （machinerypete 的 CLAAS Jaguar 870 连跑 3 次中位 $99,900/$99,900/$99,950，偏差 0.05%）。
//
// ⚠️ 三条纪律，改这里之前先读：
//   1. **默认全关**：`opts.arkSearchFallback === true` 且 `BENCHMARK_ARK_FALLBACK=1`
//      两个条件同时满足才生效（双重门控，缺一不可）。关着的时候本模块零网络、零写库，
//      与加它之前逐字节等价。
//   2. **只兜「直连失败」**：永不用于直连健康的源（agroline 在 ARK_SEARCH_BLOCKED_SOURCES 里
//      硬排除）。检索来的价格置信度只有 0.3，混进健康源就是污染。
//   3. **绝不编造**：抽不到 ≥ MASCUS_MIN_SAMPLES 条带币种符号的价格就 skip。
//      不许用「估算 / AI 推断 / 历史均价」补 —— 宁可空缺。
const ARK_SEARCH_TIMEOUT_MS = 45000;
// 检索价格的置信度**固定** 0.3（直连实测约 0.7）。
// 为什么不复用 confidenceScore()：那个函数按「源数/样本量/时效」算，1 源 + 3 样本会算出 0.35，
// 但检索结果是二手转述、可能跨地区跨年份、也可能引到别的站点 —— 不确定性远高于同分直连数据。
// 固定 0.3 是一个显式的「低置信度标记」，别让它随样本数漂上去。
const ARK_SEARCH_CONFIDENCE = 0.3;
// 价格合理区间（USD/EUR 口径）：<$1000 多半是配件/运费，>$5,000,000 基本是写错位数
const ARK_SEARCH_PRICE_MIN = 1000;
const ARK_SEARCH_PRICE_MAX = 5000000;

// `site:` 限定用的站点域名。**取值来自库里 sourceUrl 的实测值**，不要凭印象写：
// agriaffaires 实测有 .us / .co.uk / .it 多个 TLD（库里 11 行分别来自这三个域名），
// 检索统一用 .co.uk（英国站，英文页）。
const SOURCE_SEARCH_DOMAIN = {
  agroline: 'agroline.com',
  machinerypete: 'machinerypete.com',
  mascus: 'mascus.com',
  tractorhouse: 'tractorhouse.com',
  efarm: 'e-farm.com',
  avito: 'avito.ru',
  olx: 'olx.ua',
  // 不在 SOURCES 里（只有历史种子），但探针要用，故一并登记
  agriaffaires: 'agriaffaires.co.uk',
};

// 兜底通道的**永久排除**名单：这些源直连健康，任何兜底都是污染。
// agroline 现在是唯一稳定活的源（61 行、ok 37/skip 12/failed 2），绝不能让它被检索价覆盖。
const ARK_SEARCH_BLOCKED_SOURCES = new Set(['agroline']);

// 「像 TLD 的后缀」白名单：只用来判断两个域名是否同品牌不同国别站
// （`tractorhouse.com` ↔ `tractorhouse.com.au` ↔ `tractorhouse.co.uk`）。
// 白名单而非黑名单，是为了挡住 `agriaffaires.evil.com` 这种「首段同名」的伪站。
const ARK_TLD_TAIL =
  /^(com|net|org|co|de|uk|fr|it|nl|pl|es|ru|ua|cn|au|us|ca|jp|in|br|be|dk|se|no|fi|cz|hu|ro|at|ch|ie|nz|za)(\.[a-z]{2})?$/;

/** 环境闸：只有显式置 `BENCHMARK_ARK_FALLBACK=1` 才算开启（默认关，防误开烧 token） */
function arkSearchGloballyEnabled() {
  return process.env.BENCHMARK_ARK_FALLBACK === '1';
}

/**
 * 纯判据：某次直连结果是否该走 Ark 兜底？
 *
 * ⚠️ 只认 `failed`。**`skip` 绝不触发**：`skip` 的语义是「站点通了、但没抽到样本」
 * （`no-listing` / `too-few-samples`），此时站点是可直连的，拿低置信度检索价去补
 * 等于用二手转述覆盖一手数据。真正该兜底的只有 `failed`（403/470/超时/解析炸）。
 *
 * @param {string} status 直连结果状态
 * @param {string} sourceSite 源 key
 * @returns {boolean}
 */
function shouldArkFallback(status, sourceSite) {
  if (status !== 'failed') return false;
  if (ARK_SEARCH_BLOCKED_SOURCES.has(String(sourceSite || ''))) return false;
  return true;
}

/** Ark Responses 端点（`ARK_BASE_URL` 可覆盖，默认公网北京域） */
function arkResponsesEndpoint() {
  const base = (process.env.ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3').replace(
    /\/+$/,
    ''
  );
  return `${base}/responses`;
}

/**
 * 最小 POST-JSON 客户端（引擎是 CJS 且不依赖任何 TS 模块，故不复用 src/lib/ai/ark-client.ts）。
 *
 * @param {string} url
 * @param {object} payload 请求体
 * @param {{timeout?: number, headers?: Record<string,string>}} [opts]
 * @returns {Promise<object>} 解析后的 JSON
 */
function httpPostJson(url, payload, opts = {}) {
  const timeout = Number(opts.timeout) > 0 ? Math.trunc(opts.timeout) : ARK_SEARCH_TIMEOUT_MS;
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  const bodyText = JSON.stringify(payload || {});
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (e) {
      return reject(new Error(`bad-url: ${url}`));
    }
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        method: 'POST',
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: `${parsed.pathname}${parsed.search}`,
        headers: { ...headers, 'Content-Length': Buffer.byteLength(bodyText) },
        timeout,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            // 带上响应体前 300 字：403 AccessDenied / 404 ToolNotOpen 这类错误只看状态码
            // 会一路把人带去控制台查「插件有没有开通」，实际往往是枚举值写错（见 ark-client.ts 的坑记录）
            return reject(
              new Error(`HTTP ${res.statusCode}: ${text.slice(0, 300).replace(/\s+/g, ' ')}`)
            );
          }
          try {
            resolve(JSON.parse(text));
          } catch (e) {
            reject(new Error(`bad-json: ${text.slice(0, 200).replace(/\s+/g, ' ')}`));
          }
        });
      }
    );
    req.on('timeout', () => {
      req.destroy(new Error(`timeout ${timeout}ms`));
    });
    req.on('error', reject);
    req.write(bodyText);
    req.end();
  });
}

/**
 * 从 Responses 响应里抽正文。
 *
 * 主口径（派工单要求）：`output` 里 `type === 'message'` 的 `content[].text`。
 * 兜底：`output_text`（部分版本直接给拼接好的正文）、以及任意 `output[].content[].text`
 * （流式/非流式字段差异）。全部缺失则返回空串 —— 调用方按「抽不到价」降级，不抛错。
 *
 * @param {any} payload
 * @returns {string}
 */
function extractArkSearchText(payload) {
  if (!payload || typeof payload !== 'object') return '';
  const root = payload.response && typeof payload.response === 'object' ? payload.response : payload;
  let text = '';
  if (Array.isArray(root.output)) {
    for (const item of root.output) {
      if (!item || typeof item !== 'object') continue;
      const isMessage = item.type === 'message' || item.type == null;
      if (!isMessage) continue;
      if (!Array.isArray(item.content)) continue;
      for (const c of item.content) {
        if (c && typeof c.text === 'string') text += `${c.text}\n`;
      }
    }
    if (!text) {
      for (const item of root.output) {
        if (!item || !Array.isArray(item.content)) continue;
        for (const c of item.content) {
          if (c && typeof c.text === 'string') text += `${c.text}\n`;
        }
      }
    }
  }
  if (!text && typeof root.output_text === 'string') text = root.output_text;
  return text;
}

/**
 * 价格 token → { amount, currency }。**只认带币种符号/前缀的数字**。
 *
 * 为什么不认裸数字：正文里满是年份（2024）、工时（1525 h）、库存号、页码、销量，
 * 裸数字抽进来就是编造价格。宁可漏抽，不可错抽。
 *
 * 金额归一化要处理两种千分位习惯：
 *   `99,900` / `1,234,567.89`（英美）→ 逗号是千分位
 *   `99.900`（欧陆，1–3 位 + 恰好 3 位一组）→ 点是千分位
 *
 * @param {string} text
 * @param {{currency?: string}} [opts] 给 `currency` 时只保留该币种的金额
 * @returns {Array<{amount: number, currency: string, raw: string}>}
 */
function extractArkSearchPrices(text, opts = {}) {
  if (typeof text !== 'string' || text.length === 0) return [];
  const only =
    opts && typeof opts.currency === 'string' && opts.currency ? opts.currency.toUpperCase() : null;
  // explicitOnly：只认**带显式币种标注**的金额（`USD $61,500` / `$103,000 USD` / `EUR 99.900`）。
  // 为什么检索通道必须开它：tractorhouse 的镜像页会同时印两种币种 ——
  // `AUD $88,227 Price entered as : USD $61,500`。裸 `$` 取哪个都会被另一种坑到，
  // 所以「没有显式标注的裸符号金额」在检索通道一律不认。
  const explicitOnly = opts && opts.explicitOnly === true;

  // 币种 token → ISO。US$ 必须在 $ 之前匹配（正则交替顺序即优先级）
  const CUR_MAP = {
    'US$': 'USD',
    USD: 'USD',
    EUR: 'EUR',
    GBP: 'GBP',
    RUB: 'RUB',
    CNY: 'CNY',
    $: 'USD',
    '€': 'EUR',
    '£': 'GBP',
    '₽': 'RUB',
    '¥': 'CNY',
  };
  const ISO = { USD: 'USD', EUR: 'EUR', GBP: 'GBP', RUB: 'RUB', CNY: 'CNY' };
  // 已知**外币**代码：出现在符号前时（`AUD $88,227`）说明这个金额不是我们要的币种。
  // 只列真实的币种代码，避免把 `Washington $x` 这种词尾误判成币种。
  const FOREIGN = new Set([
    'AUD',
    'CAD',
    'NZD',
    'SGD',
    'HKD',
    'ZAR',
    'BRL',
    'MXN',
    'JPY',
    'CHF',
    'SEK',
    'NOK',
    'DKK',
    'PLN',
    'UAH',
    'KZT',
    'INR',
  ]);
  // 金额后面紧跟计量单位 ⇒ 这是工时/里程/功率，不是价格（`USD 4851 hours`）。
  // ⚠️ 只对**没有千分位/小数点**的裸整数生效：「$103,000 USD 5451 hours」里的 5451 要丢，
  //    但「$55,000 Hours 1」里的 55,000 是价格（Hours 是紧随其后的字段名，不是单位）。
  const UNIT_AFTER = /^\s*(hours?|hrs?|h|km|kms|mi|miles|hp|kw|kg|tons?|t|ac|acres|%)\b/i;

  /** 候选金额（按出现位置排序后再做闸门判断，保证输出顺序 = 原文顺序） */
  const cands = [];
  let m;

  // ① 符号在前：`$99,900` / `US$74,600` / `$103,000 USD` / `USD $61,500` / `AUD $88,227`
  const reSym = /(US\$|[$€£₽¥])\s?([0-9][0-9,.]*)/gi;
  while ((m = reSym.exec(text)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    const token = m[1];
    let currency = CUR_MAP[token.toUpperCase()] || CUR_MAP[token] || null;
    let explicit = token.toUpperCase() === 'US$';
    // 后缀币种：`$103,000 USD`
    const suf = /^\s?(USD|EUR|GBP|RUB|CNY)\b/i.exec(text.slice(end, end + 8));
    if (suf) {
      currency = ISO[suf[1].toUpperCase()];
      explicit = true;
    }
    // 前置币种：`USD $61,500`（认）/ `AUD $88,227`（丢）
    const pre = /([A-Za-z]{3})\s?$/.exec(text.slice(Math.max(0, start - 6), start));
    if (pre) {
      const code = pre[1].toUpperCase();
      if (ISO[code]) {
        currency = ISO[code];
        explicit = true;
      } else if (FOREIGN.has(code)) {
        continue; // 明确是别的币种的金额，直接不要
      }
    }
    cands.push({ start, end, digitsRaw: m[2], token, currency, explicit });
  }

  // ② 代码在前、无符号：`USD 1,234,567.89` / `EUR 99.900`
  const reCode = /\b(USD|EUR|GBP|RUB|CNY)\b\s?([0-9][0-9,.]*)/gi;
  while ((m = reCode.exec(text)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    // 与 ① 已处理的范围重叠就跳过（避免同一条金额被算两次）
    if (cands.some((c) => start < c.end && c.start < end)) continue;
    cands.push({
      start,
      end,
      digitsRaw: m[2],
      token: m[1],
      currency: ISO[m[1].toUpperCase()],
      explicit: true,
    });
  }

  cands.sort((a, b) => a.start - b.start);

  const out = [];
  for (const c of cands) {
    if (!c.currency) continue;
    if (explicitOnly && !c.explicit) continue;
    if (only && c.currency !== only) continue;
    const rawDigits = String(c.digitsRaw || '');
    if (!/[.,]/.test(rawDigits) && UNIT_AFTER.test(text.slice(c.end, c.end + 10))) continue;
    const digitsRaw = String(c.digitsRaw || '').replace(/[.,]+$/, ''); // 去掉句末标点
    if (!digitsRaw) continue;
    let normalized = digitsRaw;
    if (/^\d{1,3}(\.\d{3})+$/.test(normalized)) {
      normalized = normalized.replace(/\./g, ''); // 99.900 → 99900
    } else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(normalized)) {
      normalized = normalized.replace(/,/g, ''); // 1,234.56 → 1234.56
    } else {
      normalized = normalized.replace(/[,\s]/g, '');
    }
    const amount = Number(normalized);
    if (!Number.isFinite(amount)) continue;
    if (amount < ARK_SEARCH_PRICE_MIN || amount > ARK_SEARCH_PRICE_MAX) continue;
    out.push({ amount, currency: c.currency, raw: `${c.token}${c.digitsRaw}` });
  }
  return out;
}

/**
 * 判断一条引用 URL 的主机名是否属于**源站自己的站点**。
 *
 * 为什么不能简单 `endsWith`：
 *   - `tractorhouse.com` 的英国/澳洲镜像站是 `tractorhouse.com.au` / `tractorhouse.co.uk`，
 *     语义上仍是「同一家的挂牌」，实测 `site:tractorhouse.com` 返回的 citations 全在
 *     `.com.au` 上（价格同时给 AUD 与 "Price entered as USD"，币种闸会滤掉 AUD 那份）。
 *     严格要求 `endsWith('.tractorhouse.com')` 会把整条探针判死。
 *   - 但也不能只看品牌词：`tractorhouse.com` 与 `tractorhouse.de` 是不同市场，
 *     后缀既不相等也不互为前缀，故必须同时校验「首段相等 + 后缀互为前缀」。
 *
 * @param {string} host 引用 URL 的主机名
 * @param {string} domain 源站域名（SOURCE_SEARCH_DOMAIN 的值）
 * @returns {boolean}
 */
function arkHostMatchesSite(host, domain) {
  const h = String(host || '').toLowerCase().replace(/^www\./, '');
  const d = String(domain || '').toLowerCase().replace(/^www\./, '');
  if (!h || !d) return false;
  if (h === d) return true;
  if (h.endsWith(`.${d}`)) return true; // 子域：www.machinerypete.com
  const hl = h.split('.');
  const dl = d.split('.');
  if (hl.length < 2 || dl.length < 2) return false;
  if (hl[0] !== dl[0]) return false; // 品牌首段必须相同（tractorhouse ≠ agriaffaires）
  // 两侧的「后缀部分」都必须是像 TLD 的东西，避免 `agriaffaires.evil.com` 这类伪站蒙过
  const hs = hl.slice(1).join('.');
  const ds = dl.slice(1).join('.');
  return ARK_TLD_TAIL.test(hs) && ARK_TLD_TAIL.test(ds);
}

/**
 * 从 Responses 响应里抽**引用来源**（`content[].annotations[]` 里 `type==='url_citation'`）。
 *
 * 这是本通道唯一可信的溯源依据：每条 citation 带 `url` + 该页的 `summary`（搜索结果摘要原文），
 * 于是「价格属于哪个站点」变成可判定的事实，而不是从模型正文里猜。
 *
 * 为什么必须靠它：实测 `site:agriaffaires.co.uk ...` 的正文里写满了 €62,500 / €80,000 这类数字，
 * 但 12 条 citations **一条 agriaffaires 都没有**（全在 tractorhouse.com.au / nongjitong /
 * claasharvestcentre 上）。正文抽价 = 把别家的价记在 agriaffaires 头上。
 *
 * @param {any} payload
 * @returns {Array<{url: string, host: string, title: string, siteName: string, summary: string}>}
 */
function extractArkCitations(payload) {
  if (!payload || typeof payload !== 'object') return [];
  const root = payload.response && typeof payload.response === 'object' ? payload.response : payload;
  const out = [];
  const seen = new Set();
  const push = (a) => {
    if (!a || typeof a !== 'object') return;
    const url = typeof a.url === 'string' ? a.url : '';
    if (!url || seen.has(url)) return;
    let host = '';
    try {
      host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    } catch (e) {
      return; // 非绝对 URL 无法判定归属，直接丢
    }
    seen.add(url);
    out.push({
      url,
      host,
      title: typeof a.title === 'string' ? a.title : '',
      siteName: typeof a.site_name === 'string' ? a.site_name : '',
      summary: typeof a.summary === 'string' ? a.summary : '',
    });
  };
  const collect = (items) => {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (!item || !Array.isArray(item.content)) continue;
      for (const c of item.content) {
        if (!c || !Array.isArray(c.annotations)) continue;
        for (const a of c.annotations) {
          // 只认 url_citation；其他类型（如 file_citation）没有源站语义
          if (a && a.type === 'url_citation') push(a);
        }
      }
    }
  };
  collect(root.output);
  if (!out.length && Array.isArray(root.output)) {
    // 少数版本把 annotations 挂在 output_text 之外的字段，兜底再扫一遍
    for (const item of root.output) {
      if (item && Array.isArray(item.annotations)) {
        for (const a of item.annotations) if (a && a.type === 'url_citation') push(a);
      }
    }
  }
  return out;
}

/**
 * 用 Ark web_search 抓单个 (源, 品牌, 机型) 的挂牌价，聚合并（可选）入库。
 *
 * 两次检索：
 *   ① `site:<域名> used <品牌> <机型> price <币种>` —— **锁站点**，唯一可用于入库的样本源
 *   ② `used <品牌> <机型> price <币种> listing <当年>` —— 不锁站点，**只做交叉诊断**
 *
 * 🔴 为什么 ② 的价格绝不能进中位数（2026-11-04 反向探针实测钉死）：
 *    agriaffaires 是 DataDome 站点，web_search 拿不到它本体页。最初把两次 query 的价格
 *    「取并集」，结果 agriaffaires 报出 `ok` + 16 条价 + 中位 €206,500 —— 而其中
 *    **15 条来自锁站点那次之外的别的站**（landwirt / nongjitong 之类）。也就是说
 *    我们会把别家的价格挂在 `sourceSite: 'agriaffaires'` 名下入库，这是**misattribution**，
 *    本质与编造价格同级。
 *    收紧成「只认 ①」，第二次反向探针仍然报 `ok`（11 条价、中位 €100,000）——
 *    因为 `site:` 只是检索**提示**，模型写答案时照样把 tractorhouse 的价抄进正文。
 *    原始返回实测：`site:agriaffaires.co.uk ...` 的 12 条 url_citation 里
 *    **一条 agriaffaires 都没有**（全在 tractorhouse.com.au / nongjitong / claasharvestcentre）。
 *
 * ✅ 最终口径：**按 citation 溯源，不从正文抽价**
 *    1. 只读 `content[].annotations[]` 里 `type==='url_citation'` 的条目，
 *       每条带 `url` 与该页的 `summary` 原文；
 *    2. 只保留主机名属于源站自己的 citation（`arkHostMatchesSite`，容许 .com/.com.au 这类同品牌国别站）；
 *    3. 只在这些 citation 的 `summary` 里抽价，且金额币种必须等于源的币种
 *       （否则 `AUD $88,227 / Price entered as USD $61,500` 这种镜像站双币种会把 AUD 值当 USD）；
 *    4. 摘要必须真的在讲这台机型（`mascusModelMatches`），否则
 *       machinerypete 的 windrowers 页里「Jaguar 8700 $169,000」会被算进 Jaguar 870；
 *    5. 正文（`extractArkSearchText`）抽到的价只进 `prosePrices` 做诊断，**永不聚合**。
 *    于是「agriaffaires 一条自家 citation 都拿不到」自然落成 `skip: 'no-site-citation'`。
 *
 * @param {{key: string, currency?: string, region?: string}} source 源定义（可来自 SOURCES，也可最小对象）
 * @param {{brand?: string, brandNameZh?: string, nameEn?: string, model: string, category?: string}} target
 * @param {Record<string, number>} fx 外币→CNY 汇率表
 * @param {{dryRun?: boolean, timeoutMs?: number, fetchImpl?: Function}} [opts]
 * @returns {Promise<{status: 'ok'|'skip'|'failed', reason?: string, prices: Array<{amount:number,currency:string,raw:string,sourceUrl?:string}>, crossSitePrices: Array<{amount:number,currency:string,raw:string}>, prosePrices: Array<{amount:number,currency:string,raw:string}>, corroborated: number, siteCitations: number, citedDomains: string[], queries: string[], medianForeign?: number, medianCny?: number, currency?: string, sampleSize?: number, row?: object, id?: any, usage?: any, errors?: string[]}>}
 */
async function fetchViaArkSearch(source, target, fx, opts = {}) {
  const sourceKey = String((source && source.key) || (target && target.sourceSite) || '').trim();
  const base = {
    prices: [],
    crossSitePrices: [],
    prosePrices: [],
    corroborated: 0,
    siteCitations: 0,
    citedDomains: [],
    queries: [],
    errors: [],
  };
  if (!sourceKey) return { ...base, status: 'failed', reason: 'ark-no-source' };
  // 健康源硬排除：即便调用方手滑传了 agroline 也不会发请求
  if (ARK_SEARCH_BLOCKED_SOURCES.has(sourceKey)) {
    return { ...base, status: 'skip', reason: 'ark-source-blocked' };
  }
  const apiKey = process.env.ARK_API_KEY || '';
  if (!apiKey) return { ...base, status: 'failed', reason: 'ark-no-api-key' };

  const domain = SOURCE_SEARCH_DOMAIN[sourceKey] || `${sourceKey}.com`;
  const brandDef = BRANDS.find((b) => b.slug === (target && target.brand)) || null;
  const nameEn = String((target && target.nameEn) || (brandDef && brandDef.nameEn) || '').trim();
  const model = String((target && target.model) || '').trim();
  if (!nameEn || !model) return { ...base, status: 'failed', reason: 'ark-no-target' };

  const currency = String((source && source.currency) || 'USD');
  // ⚠️ 派工单模板写的是 `listing 2025`，这里用**当年**：库里数据日期是 2026，
  //    把 2025 写死会把检索引向一年前的旧挂牌，中位数随之下移。
  const year = new Date().getFullYear();
  const jobs = [
    // ① 锁站点 —— 唯一可入库来源
    { text: `site:${domain} used ${nameEn} ${model} price ${currency}`, siteLocked: true },
    // ② 不锁站点 —— 仅交叉诊断（见上面 🔴 说明）
    { text: `used ${nameEn} ${model} price ${currency} listing ${year}`, siteLocked: false },
  ].map((j) => ({ ...j, text: j.text.replace(/\s+/g, ' ').trim() }));
  const queries = jobs.map((j) => j.text);

  const fetchImpl = typeof opts.fetchImpl === 'function' ? opts.fetchImpl : httpPostJson;
  const timeoutMs = Number(opts.timeoutMs) > 0 ? Math.trunc(opts.timeoutMs) : ARK_SEARCH_TIMEOUT_MS;
  const endpoint = arkResponsesEndpoint();
  const modelId = process.env.ARK_MODEL_ID || 'doubao-seed-2-1-pro-260915';

  const sitePrices = [];
  const crossSitePrices = [];
  const prosePrices = [];
  const seenSite = new Set();
  const seenCross = new Set();
  const citedDomains = [];
  let siteCitations = 0;
  let corroborated = 0;
  let usage = null;
  const perQuery = [];
  // 机型 token：用来把「同一页里别的机型的价」挡在外面（Jaguar 8700 ≠ Jaguar 870）
  const modelTokens = mascusModelTokens(model);

  // —— 两条 query **并发**发 ——
  // 为什么必须并发：单次 web_search 实测 30–45s（模型要跑 3–14 次检索再组织答案）。
  // 串行 = 60–90s/target；实测 3 条探针串行跑掉 216s，直连失败的源只要有十来个，
  // 260s 总预算当场爆掉。并发后 elapsed ≈ 单次耗时，与 45s 单次超时口径一致，
  // 请求数/成本都不变（仍是 2 条）。
  const oneJob = (job) => {
    const payload = {
      model: modelId,
      stream: false,
      // ⚠️ `sources` 必须写 `['search_engine']`。写成 `['doubao']` 会返回 403
      // `AccessDenied ... verify the activation status`，把人一路误导去查控制台开通状态，
      // 实际只是枚举名错（详见 src/lib/ai/ark-client.ts 里 5 条真实 query 的打靶记录）。
      tools: [{ type: 'web_search', sources: ['search_engine'] }],
      input: [{ role: 'user', content: [{ type: 'input_text', text: job.text }] }],
    };
    return fetchImpl(endpoint, payload, {
      timeout: timeoutMs,
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  };
  const settled = await Promise.allSettled(jobs.map(oneJob));

  // 按 jobs 原序结算：锁站点那次必须先落进 seenSite，
  // 不锁站点那次才知道哪些价是「被本体检索印证」（corroborated）、哪些是「纯跨站」（丢弃）。
  for (let i = 0; i < jobs.length; i += 1) {
    const job = jobs[i];
    const s = settled[i];
    if (s.status === 'rejected') {
      const e = s.reason;
      const msg = e && e.message ? e.message : String(e);
      perQuery.push({
        query: job.text,
        siteLocked: job.siteLocked,
        ok: false,
        found: 0,
        added: 0,
        error: msg,
      });
      base.errors.push(msg);
      continue;
    }
    const resp = s.value;
    if (!usage && resp && resp.usage) usage = resp.usage;
    const text = extractArkSearchText(resp);
    let added = 0;
    let found = 0;

    if (job.siteLocked) {
      // —— ① 锁站点检索：**只认 citation 溯源到的价**（见函数头 ✅） ——
      const cites = extractArkCitations(resp);
      for (const c of cites) {
        if (!citedDomains.includes(c.host)) citedDomains.push(c.host);
        if (!arkHostMatchesSite(c.host, domain)) continue; // 不是源站自己的页 → 丢弃
        // 摘要必须真的在讲这台机型（否则同页里别的型号的价会混进来）
        if (modelTokens.length && !mascusModelMatches(c.summary, modelTokens)) continue;
        siteCitations += 1;
        const prices = extractArkSearchPrices(c.summary, { currency, explicitOnly: true });
        found += prices.length;
        for (const p of prices) {
          const key = `${p.currency}|${p.amount}`;
          if (seenSite.has(key)) continue; // 同一挂牌在多条 citation 里重复出现只算一条
          seenSite.add(key);
          sitePrices.push({ ...p, sourceUrl: c.url });
          added += 1;
        }
      }
      // 正文价：只做诊断。正文会把别站价混进来（agriaffaires 事故），永不聚合。
      for (const p of extractArkSearchPrices(text, { currency })) prosePrices.push(p);
    } else {
      // —— ② 不锁站点检索：纯交叉诊断，不参与聚合 ——
      const crossFound = extractArkSearchPrices(text);
      found = crossFound.length;
      for (const p of crossFound) {
        const key = `${p.currency}|${p.amount}`;
        if (seenSite.has(key)) {
          // 锁站点那边已经拿到同一个价 ⇒ 交叉印证
          if (!seenCross.has(key)) {
            seenCross.add(key);
            corroborated += 1;
          }
        } else if (!seenCross.has(key)) {
          seenCross.add(key);
          crossSitePrices.push(p);
          added += 1;
        }
      }
    }

    perQuery.push({
      query: job.text,
      siteLocked: job.siteLocked,
      ok: true,
      found,
      added,
    });
  }

  // 聚合/入库**只看**「citation 溯源到源站自己页面的价」（见函数头 ✅）
  const result = {
    ...base,
    queries,
    perQuery,
    prices: sitePrices,
    crossSitePrices,
    prosePrices,
    corroborated,
    siteCitations,
    citedDomains,
    usage,
  };
  if (sitePrices.length === 0) {
    // 两种「没价」要分开报，否则运维会以为是自己模型/参数写错了：
    //   no-site-citation = 检索压根没引用到源站任何页面（= 该源对搜索引擎也不可见，如 DataDome 站）
    //   no-price         = 引用到了源站页面，但摘要里没有可用的带币种价格
    return {
      ...result,
      status: 'skip',
      reason: siteCitations === 0 && citedDomains.length > 0 ? 'no-site-citation' : 'no-price',
      hint:
        siteCitations === 0 && citedDomains.length > 0
          ? `检索未引用到 ${domain} 的任何页面（引用的站点：${citedDomains.join(', ')}）；正文里的 ${prosePrices.length} 条价已按规则丢弃`
          : prosePrices.length > 0
            ? `正文有 ${prosePrices.length} 条价，但没有一条能溯源到 ${domain} 的页面（已按规则丢弃）`
            : undefined,
    };
  }
  // 门控：样本不足 3 条不写（与 mascus 同口径），宁可空缺也不进假数据
  if (sitePrices.length < MASCUS_MIN_SAMPLES) {
    return {
      ...result,
      status: 'skip',
      reason: 'insufficient-samples',
      hint: `可溯源到 ${domain} 的价仅 ${sitePrices.length} 条（<${MASCUS_MIN_SAMPLES}）；另有正文价 ${prosePrices.length} 条 / 跨站价 ${crossSitePrices.length} 条（均按规则丢弃）`,
    };
  }

  // 复用直连那套聚合（IQR 离群剔除 + 中位数 + 按币种取众数），不另写一份统计
  const listings = sitePrices.map((p) => ({ priceForeign: p.amount, currency: p.currency }));
  const agg = aggregateListings(listings, fx, { priceType: 'listing' });
  if (!agg) return { ...result, status: 'skip', reason: 'no-agg' };

  const today = new Date().toISOString().slice(0, 10);
  const row = {
    brand: (target && target.brand) || (brandDef && brandDef.slug) || '',
    brandNameZh: (target && target.brandNameZh) || (brandDef && brandDef.nameZh) || '',
    model,
    category:
      (target && target.category) ||
      (brandDef && brandDef.primaryCategory) ||
      CATEGORY.TRACTOR,
    sourceSite: sourceKey,
    priceForeign: agg.priceForeign,
    medianPrice: agg.medianPrice,
    currency: agg.currency,
    priceCny: agg.priceCny,
    exchangeRate: agg.exchangeRate,
    // `#ark-search` 锚点 = 事后一眼区分「这行是检索来的」还是「直连抓的」
    sourceUrl: `https://${domain}/#ark-search`,
    sourceDate: today,
    confidenceScore: ARK_SEARCH_CONFIDENCE,
    sampleSize: agg.sampleSize,
    listingCount: agg.listingCount,
    priceType: 'listing',
    region: (source && source.region) || 'GLOBAL',
  };

  const filled = {
    ...result,
    status: 'ok',
    currency: agg.currency,
    medianForeign: agg.priceForeign,
    medianCny: agg.priceCny,
    sampleSize: agg.sampleSize,
    listingCount: agg.listingCount,
    sourceDate: today,
    row,
  };
  if (opts.dryRun === true) return { ...filled, dryRun: true };

  try {
    const res = await upsertBenchmark(row);
    return { ...filled, dryRun: false, id: res && res.id, skipped: !!(res && res.skipped) };
  } catch (e) {
    return { ...filled, status: 'failed', reason: `write-failed: ${e.message}` };
  }
}

/**
 * Ark 检索**探针模式**：只跑传入的几条 (sourceSite, brand, model)，不碰靶标池、不碰 mascus bulk。
 *
 * 设计意图与 `opts.targets` 注入一致：**注入即隔离**。这样验收时可以在生产引擎上
 * 精确打 3 条探针（含 1 条反向探针），既验证抽价逻辑，又不污染任何其他行。
 *
 * @param {Array<{sourceSite: string, brand: string, model: string}>} entries
 * @param {Record<string, number>} fx
 * @param {object} opts runRefresh 的 opts（读 arkSearchDryRun / arkSearchFetch / arkSearchTimeoutMs）
 */
async function runArkSearchProbe(entries, fx, opts = {}) {
  const startTs = Date.now();
  const dryRun = opts.arkSearchDryRun === true;
  const results = [];
  const stats = {
    ok: 0,
    skip: 0,
    failed: 0,
    total: entries.length,
    bySource: {},
    skipReasons: {},
    skippedByBudget: 0,
    budgetExhausted: false,
    circuitOpen: [],
    durationMs: 0,
    mascus: null,
    arkProbe: results,
    arkDryRun: dryRun,
  };
  for (const entry of entries) {
    const sourceKey = String((entry && (entry.sourceSite || entry.source)) || '').trim();
    const source =
      SOURCES.find((s) => s.key === sourceKey) || {
        key: sourceKey,
        name: sourceKey,
        currency: (entry && entry.currency) || 'USD',
        region: (entry && entry.region) || 'GLOBAL',
      };
    const brandDef = BRANDS.find((b) => b.slug === (entry && entry.brand)) || null;
    const modelDef =
      (MODELS[(entry && entry.brand) || ''] || []).find((m) => m.model === (entry && entry.model)) ||
      null;
    const target = {
      brand: (entry && entry.brand) || '',
      brandNameZh: (brandDef && brandDef.nameZh) || '',
      nameEn: (brandDef && brandDef.nameEn) || (entry && entry.nameEn) || '',
      model: (entry && entry.model) || '',
      category: (modelDef && modelDef.category) || (entry && entry.category) || CATEGORY.TRACTOR,
    };
    const r = await fetchViaArkSearch(source, target, fx, {
      dryRun,
      fetchImpl: opts.arkSearchFetch,
      timeoutMs: opts.arkSearchTimeoutMs,
    });
    results.push({
      sourceSite: sourceKey,
      brand: target.brand,
      model: target.model,
      status: r.status,
      reason: r.reason || null,
      queries: r.queries,
      perQuery: r.perQuery,
      // ⚠️ prices 只含**锁站点**检索抽到的价（可入库口径）；crossSitePrices 仅诊断，
      //    绝不能拿来算中位价 —— 见 fetchViaArkSearch 函数头 🔴 的 agriaffaires 事故记录。
      prices: r.prices,
      priceCount: r.prices.length,
      crossSitePrices: r.crossSitePrices,
      crossSiteCount: (r.crossSitePrices || []).length,
      // 正文抽价：只做诊断。正文会把别站价混进来，见 fetchViaArkSearch 函数头 agriaffaires 事故。
      prosePrices: r.prosePrices || [],
      prosePriceCount: (r.prosePrices || []).length,
      /** 引用落在源站域名上的 citation 条数（0 = 检索没看到源站本体页） */
      siteCitations: r.siteCitations || 0,
      /** 本次检索引用到的全部站点（排障用：一眼看出价其实来自谁） */
      citedDomains: r.citedDomains || [],
      corroborated: r.corroborated || 0,
      hint: r.hint || null,
      currency: r.currency || null,
      medianForeign: r.medianForeign == null ? null : r.medianForeign,
      medianCny: r.medianCny == null ? null : r.medianCny,
      sampleSize: r.sampleSize == null ? null : r.sampleSize,
      sourceDate: r.sourceDate || null,
      confidenceScore: r.row ? r.row.confidenceScore : null,
      sourceUrl: r.row ? r.row.sourceUrl : null,
      wrote: r.status === 'ok' && !dryRun,
      errors: r.errors,
      usage: r.usage || null,
    });
    stats[r.status] = (stats[r.status] || 0) + 1;
    const bs = (stats.bySource[sourceKey] = stats.bySource[sourceKey] || {
      ok: 0,
      skip: 0,
      failed: 0,
      opened: false,
    });
    bs[r.status] = (bs[r.status] || 0) + 1;
    if (r.status === 'skip') {
      const k = r.reason || 'unknown';
      stats.skipReasons[k] = (stats.skipReasons[k] || 0) + 1;
    }
  }
  stats.durationMs = Date.now() - startTs;
  return stats;
}

// —— 源级熔断器（纯逻辑，无 I/O，便于单测）——
/**
 * 同一源连续 N 次 `failed` 即「开路」，该源剩余目标直接跳过。
 *
 * 为什么必须按**源**而不是全局：实测 tractorhouse 是 Cloudflare 硬 403(0.9s)、
 * machinerypete 是自研反爬 470(3.2s) —— 这类拦截**提超时完全无用**，只会把
 * 「快速失败」变成「慢慢失败」。266 个目标里同源有十几个，不熔断就会一个源
 * 反复吃掉几十次超时，把总预算挤爆。
 *
 * 语义要点：
 *   - `failed`：连续失败 +1，达到阈值即 open
 *   - `ok`    ：计数归零（允许恢复，不永久封死）
 *   - `skip`  ：既不增加也不重置（「没抓到样本」≠「源坏了」，不能拿它熔断）
 *
 * @param {{ failureThreshold?: number }} [opts]
 */
function makeSourceCircuit({ failureThreshold = 3 } = {}) {
  const state = new Map();
  const read = (site) => state.get(site) || { consecutiveFails: 0, open: false };

  return {
    /** 该源是否已开路（开路后调用方应直接跳过，不再浪费一次超时） */
    shouldSkip(site) {
      return !!read(site).open;
    },
    /**
     * 记录一次采集结果。
     *
     * `ratelimited`（429）是**特例**：既不 +1 也不重置。
     * 理由：429 的语义是「你太快了」，不是「我坏了」。把它计入失败，
     * `failureThreshold=3` 三个限流就能把 agroline 整源封死，剩下几十个目标直接
     * `circuit-open` —— 而 agroline 是 12 个品牌的唯一数据源，这一封就是全站归零。
     * 真正该熔断的是 5xx / 连不上 / 解析炸（那些记 'failed'）。
     *
     * @param {string} site 源站 key
     * @param {'ok'|'skip'|'failed'|'ratelimited'} status 采集状态
     */
    record(site, status) {
      const cur = read(site);
      let next;
      if (status === 'failed') {
        const consecutiveFails = cur.consecutiveFails + 1;
        next = { consecutiveFails, open: cur.open || consecutiveFails >= failureThreshold };
      } else if (status === 'ok') {
        next = { consecutiveFails: 0, open: false };
      } else {
        // 'skip' / 'ratelimited' / 未知状态：保持原样（不计数、不重置）
        next = { consecutiveFails: cur.consecutiveFails, open: cur.open };
      }
      state.set(site, next);
      return next;
    },
    /** 只读快照 `{ site: { consecutiveFails, open } }` */
    snapshot() {
      const out = {};
      for (const [site, s] of state.entries()) {
        out[site] = { consecutiveFails: s.consecutiveFails, open: s.open };
      }
      return out;
    },
  };
}

// —— dryRun 专用只读探针 ——
// 与 `fetchOneTarget` 完全同一套取数流程（httpGet→parseListings→aggregateListings），
// 唯一区别：**不调用 upsertBenchmark**，因此可以证明「只统计不写库」。
// 刻意与 fetchOneTarget 保持行为同步；若将来改了取数逻辑，两处需一起改。
async function probeOneTarget(target, fx, timeoutMs, opts = {}) {
  const source = SOURCES.find((s) => s.key === target.sourceSite);
  if (!source) return { status: 'skip', reason: 'no-source' };
  const url = buildSearchUrl(source, target);
  const proxy = target.russian && process.env.RESIDENTIAL_PROXY ? process.env.RESIDENTIAL_PROXY : null;
  try {
    // 与 fetchOneTarget 用同一套 429 退避（dryRun 的意义就是「同一管线，只是不写库」，
    // 若这里少了退避，dryRun 测出来的耗时会比真跑偏乐观）
    const html = await httpGetWithRetry(url, {
      request: {
        timeout: timeoutMs,
        proxy,
        headers: target.russian ? { 'Accept-Language': 'ru-RU,ru;q=0.9' } : {},
      },
      getImpl: opts.getImpl,
      sleep: opts.sleep,
      maxRetries: opts.maxRetries,
      jitterRatio: opts.jitterRatio,
      rand: opts.rand,
      deadlineTs: opts.deadlineTs,
      onRateLimited: opts.onRateLimited,
    });
    const listings = parseListings(source, html, target);
    if (!listings.length) return { status: 'skip', reason: 'no-listing' };
    const agg = aggregateListings(listings, fx, { priceType: 'listing' });
    if (!agg) return { status: 'skip', reason: 'no-agg' };
    return { status: 'ok', count: listings.length }; // 只返回统计，不写库
  } catch (e) {
    if (e && e.statusCode === 429) {
      return { status: 'failed', reason: 'http-429', rateLimited: true };
    }
    return { status: 'failed', reason: e.message };
  }
}

// —— 并发刷新（规避 Vercel 函数超时）——
// opts: {
//   fx, concurrency=12, timeoutMs=8000, targets?, sources?,
//   failureThreshold=3,   // 源级熔断阈值
//   budgetMs=260000,      // 总预算兜底（< maxDuration 300s，留 40s 给种子/告警/序列化）
//   dryRun=false,         // true = 只统计不写库
//   mascusMaxPages=5,     // mascus bulk 每段翻页数（见 fetchMascusBulk）
//   mascusTimeoutMs=25000,// mascus bulk 单页超时（=< timeoutMs 时以 timeoutMs 为准的下限抬升）
//   mascusMinSamples=3,   // mascus 单组最少样本数
//   // —— 429 加固（默认值即生产口径，单测注入前四个做离线验证）——
//   maxRetries=2,         // 429 最多重试次数（1s → 2s 指数退避，±30% 抖动）
//   jitterRatio=0.3,
//   rand,                 // 抖动随机源（注入便于断言）
//   retrySleep,           // 退避用的 sleep（注入假 sleep，单测里不真的等）
//   httpGetImpl,          // 注入假 GET（离线跑整条 worker 链路）
// }
async function runRefresh(opts = {}) {
  const fx = opts.fx || (await getFxRates());

  // —— Ark 检索探针模式（小范围验证用）：注入即隔离 ——
  // 传了 `arkSearchProbe` 就**只跑这几条**：不建靶标池、不跑 mascus bulk、不写其他任何行。
  // 与 `opts.targets` 注入同一设计思路（见下面 mascusEnabled 的第 ① 条），
  // 目的是能在生产引擎上精确打几条探针做验收，而不污染库里既有数据。
  if (Array.isArray(opts.arkSearchProbe) && opts.arkSearchProbe.length > 0) {
    return runArkSearchProbe(opts.arkSearchProbe.slice(), fx, opts);
  }

  let all = opts.targets || buildTargets();
  if (Array.isArray(opts.sources) && opts.sources.length) {
    const set = new Set(opts.sources);
    all = all.filter((t) => set.has(t.sourceSite));
  }
  // mascus 走独立的 bulk 通道（它的靶标已在 buildTargets 里被 skipInTargets 摘除）。
  //
  // 启用条件（三个都必须满足）：
  //   ① 调用方**没有**注入 opts.targets —— 注入 targets = 「我明确只要跑这些靶标」
  //      （单测、dryRun 探针、临时脚本），此时绝不能再自作主张去打 25 次真实网络；
  //   ② 没显式指定 sources，或 sources 里列了 mascus；
  //   ③ 没有显式 opts.mascus === false（给运维留的开关）。
  const targetInjected = Array.isArray(opts.targets);
  const mascusEnabled =
    opts.mascus !== false &&
    !targetInjected &&
    (!Array.isArray(opts.sources) || opts.sources.length === 0 || opts.sources.includes('mascus'));
  const queue = all.slice();

  // ⚠️ ok / skip / failed / total 四个字段的名字与语义保持不变（route.ts 的 message 在用）
  const stats = {
    ok: 0,
    skip: 0,
    failed: 0,
    total: all.length,
    bySource: {},
    skipReasons: {},
    skippedByBudget: 0,
    budgetExhausted: false,
    circuitOpen: [],
    durationMs: 0,
    // mascus 走 bulk 通道，计数单位是「组（brand×model）」而不是「靶标」，
    // 明细单独挂在 mascus 上，避免污染靶标口径的 ok/skip/failed 语义歧义。
    mascus: null,
    // 失败原因分布（'http-429' / 'HTTP 503' / 'timeout' …），与 skipReasons 分开，
    // 因为 failed 的目标既不是「没数据」也不是「成功」，运维要能一眼看出是不是限流。
    failReasons: {},
    // 429 事件数（一次 429 命中计一次，含被重试救回来的那些）
    rateLimited: 0,
    // 实际发生的退避等待次数与其总时长（判断「加固有没有把预算吃光」）
    retries: 0,
    retryWaitMs: 0,
  };

  const circuit = makeSourceCircuit({ failureThreshold: opts.failureThreshold ?? 3 });
  const budgetMs = opts.budgetMs ?? 260000;
  const timeoutMs = opts.timeoutMs || 8000;
  const dryRun = opts.dryRun === true;
  const startTs = Date.now();
  // 本轮预算的绝对截止时间：退避重试也要受它约束，否则「最多 2 次重试」照样能吃穿 260s
  const deadlineTs = startTs + budgetMs;
  // 源级并发限制器（读 SOURCES 的 maxConcurrency；429 时还会再减半）
  const limiter = makeSourceLimiter(Math.max(1, opts.concurrency || 12), SOURCES);

  const bumpReason = (reason) => {
    const k = reason || 'unknown';
    stats.skipReasons[k] = (stats.skipReasons[k] || 0) + 1;
  };
  const bumpSite = (site) =>
    (stats.bySource[site] = stats.bySource[site] || {
      ok: 0,
      skip: 0,
      failed: 0,
      opened: false,
    });

  // —— Ark 兜底（双重门控 + 健康源硬排除 + 预算闸）——
  // 计数**单独挂在 stats.arkFallback** 上，不并入 ok/skip/failed/total：
  //   ① 兜底是对「一个失败目标」的**额外一次尝试**，不是一个新的靶标，
  //      并入会让 `ok + skip + failed + skippedByBudget === total` 这个闭合不变量失效
  //      （benchmark-circuit.test.ts ② / ⑤b / ⑥ 就在断言它）；
  //   ② 关掉时连 stats.arkFallback 字段都不挂 ⇒ 默认关的行为与加此功能之前完全一致。
  const arkFallbackEnabled = opts.arkSearchFallback === true && arkSearchGloballyEnabled();
  const arkFallback = arkFallbackEnabled
    ? { enabled: true, total: 0, ok: 0, skip: 0, failed: 0, byReason: {}, rows: [] }
    : null;
  const runArkFallback = async (t, trigger) => {
    if (!arkFallback) return;
    if (ARK_SEARCH_BLOCKED_SOURCES.has(t.sourceSite)) {
      arkFallback.total += 1;
      arkFallback.skip += 1;
      arkFallback.byReason['ark-source-blocked'] =
        (arkFallback.byReason['ark-source-blocked'] || 0) + 1;
      return;
    }
    const source = SOURCES.find((s) => s.key === t.sourceSite) || null;
    if (!source) return;
    // 预算闸：45s 的单次检索比靶标请求贵得多，剩余预算不够就别开新查询
    const remaining = budgetMs - (Date.now() - startTs);
    if (remaining < 1000) {
      arkFallback.total += 1;
      arkFallback.skip += 1;
      arkFallback.byReason['ark-budget'] = (arkFallback.byReason['ark-budget'] || 0) + 1;
      return;
    }
    arkFallback.total += 1;
    const r = await fetchViaArkSearch(source, t, fx, {
      dryRun,
      fetchImpl: opts.arkSearchFetch,
      timeoutMs: Math.min(ARK_SEARCH_TIMEOUT_MS, remaining),
    });
    if (r.status === 'ok' || r.status === 'skip' || r.status === 'failed') arkFallback[r.status] += 1;
    if (r.status === 'skip') {
      const k = r.reason || 'unknown';
      arkFallback.byReason[k] = (arkFallback.byReason[k] || 0) + 1;
    }
    if (r.status === 'ok') {
      arkFallback.rows.push({
        brand: r.row.brand,
        model: r.row.model,
        trigger,
        samples: r.sampleSize,
        medianForeign: r.medianForeign,
        currency: r.currency,
        medianCny: r.medianCny,
        sourceDate: r.sourceDate,
      });
    }
  };

  const worker = async () => {
    while (queue.length) {
      // ① 总预算兜底：超预算立即停止派发，剩余队列一次性计入 skippedByBudget。
      //    没有这道闸，266 目标 × 20s 超时就会撞 maxDuration=300 被平台 kill，
      //    连已经采到的结果和后面的告警都一起丢掉。
      if (Date.now() - startTs > budgetMs) {
        stats.budgetExhausted = true;
        stats.skippedByBudget += queue.length;
        queue.length = 0;
        break;
      }
      const t = queue.shift();

      // ② 源级熔断：该源已开路 → 直接跳过，不再为必然失败的请求付一次超时
      if (circuit.shouldSkip(t.sourceSite)) {
        stats.skip += 1;
        bumpReason('circuit-open');
        bumpSite(t.sourceSite).skip += 1;
        // 兜底触发点之一：该源已进熔断（直连这条路对这个源整体失效了）
        await runArkFallback(t, 'circuit-open');
        continue;
      }

      // ③ 真抓（dryRun 走只读探针，构造上就不可能写库）
      //    源级信号量：agroline 这类单点依赖源自己再收一道（见 SOURCES.maxConcurrency）
      await limiter.acquire(t.sourceSite);
      let r;
      try {
        const perTargetOpts = {
          getImpl: opts.httpGetImpl,
          sleep: opts.retrySleep,
          maxRetries: opts.maxRetries,
          jitterRatio: opts.jitterRatio,
          rand: opts.rand,
          deadlineTs,
          onRateLimited: (info) => {
            stats.rateLimited += 1;
            if (info.willRetry === false) return; // 重试用尽那一次：只计数，不再降并发（已在降了）
            stats.retries += 1;
            stats.retryWaitMs += info.delayMs;
            // 命中限流 ⇒ 该源本轮降并发（减半，下限 2）。只降不升：本轮先保命。
            const nextLimit = limiter.reduce(t.sourceSite);
            console.warn(
              `⚠️ 429 限流 ${t.sourceSite}：退避 ${info.delayMs}ms（第 ${info.attempt} 次），` +
                `该源并发降至 ${nextLimit}`
            );
          },
        };
        r = dryRun
          ? await probeOneTarget(t, fx, timeoutMs, perTargetOpts)
          : await fetchOneTarget(t, fx, timeoutMs, perTargetOpts);
      } finally {
        limiter.release(t.sourceSite);
      }

      // ④ 熔断口径：429 记 'ratelimited'（不 +1 也不重置），其余按原状
      circuit.record(t.sourceSite, r.rateLimited === true ? 'ratelimited' : r.status);
      stats[r.status] = (stats[r.status] || 0) + 1;
      if (r.status === 'skip') bumpReason(r.reason);
      if (r.status === 'failed') {
        const k = r.reason || 'unknown';
        stats.failReasons[k] = (stats.failReasons[k] || 0) + 1;
      }
      const bs = bumpSite(t.sourceSite);
      bs[r.status] = (bs[r.status] || 0) + 1;
      if (r.rateLimited === true) bs.rateLimited = (bs.rateLimited || 0) + 1;

      // 兜底触发点之二：本次直连**失败**（不是 skip —— skip = 有页面但没样本，
      // 说明站点是通的，再拿检索去补就是拿低置信度数据覆盖可直连的源）
      if (shouldArkFallback(r.status, t.sourceSite)) await runArkFallback(t, 'direct-failed');
    }
  };

  // —— mascus bulk 通道：与靶标池**并行**跑 ——
  // 为什么并行：bulk 是 25 次独立请求（5 段 × 5 页），与靶标池无任何数据依赖；
  // 串行会把总时长白加一份（实测 25 页 ≈ 20–60s），直接吃掉 Vercel 300s 预算。
  // 失败一律降级为 null/空结果，**绝不**把整轮刷新炸掉（靶标池的结果已经采到了）。
  const bulkRemainingMs = Math.max(1000, budgetMs - (Date.now() - startTs));
  const emptyBulk = {
    ok: false,
    error: null,
    totalPages: 0,
    fetchedPages: 0,
    failedPages: 0,
    items: 0,
    uniqueItems: 0,
    pricedItems: 0,
    groups: 0,
    written: 0,
    skipped: 0,
    failed: 0,
    rows: [],
    groupDetail: [],
    byReason: {},
    bySegment: {},
    emptySegments: [],
    durationMs: 0,
  };
  const bulkPromise = mascusEnabled
    ? fetchMascusBulk({
        fx,
        maxPages: opts.mascusMaxPages,
        // mascus 单页 650KB / 实测 1–4s：靶标默认 8s 超时会误杀，故取两者更大值
        timeoutMs: Math.max(timeoutMs, Number(opts.mascusTimeoutMs) || 25000),
        minSamples: opts.mascusMinSamples,
        dryRun,
        budgetMs: bulkRemainingMs,
      }).catch((e) => ({ ...emptyBulk, error: e && e.message ? e.message : String(e) }))
    : Promise.resolve(null);

  const n = Math.max(1, Math.min(opts.concurrency || 12, all.length));
  const [, bulk] = await Promise.all([
    Promise.all(Array.from({ length: n }, () => worker())),
    bulkPromise,
  ]);

  if (bulk) {
    // 明细（供 route 拼 message、日志与人工复核）
    stats.mascus = {
      ok: bulk.written,
      skip: bulk.skipped,
      failed: bulk.failed,
      total: bulk.groups,
      items: bulk.items,
      uniqueItems: bulk.uniqueItems,
      pricedItems: bulk.pricedItems,
      fetchedPages: bulk.fetchedPages,
      failedPages: bulk.failedPages,
      totalPages: bulk.totalPages,
      budgetExhausted: bulk.budgetExhausted === true,
      byReason: bulk.byReason,
      bySegment: bulk.bySegment,
      emptySegments: bulk.emptySegments,
      rows: bulk.rows.map((r) => ({
        brand: r.brand,
        model: r.model,
        samples: r.samples,
        medianForeign: r.medianForeign,
        currency: r.currency,
        medianCny: r.medianCny,
        sourceDate: r.sourceDate,
      })),
      durationMs: bulk.durationMs,
      error: bulk.error || null,
    };

    // 总数口径：mascus 的计数单位是「组」，直接把组的 ok/skip/failed 汇入总数，
    // 这样 route 的「成功 X / 跳过 Y / 失败 Z / 共 N」仍然是自洽的（N 也含组数）。
    const site = bumpSite('mascus');
    stats.ok += bulk.written;
    stats.skip += bulk.skipped;
    stats.failed += bulk.failed;
    stats.total += bulk.groups;
    site.ok += bulk.written;
    site.skip += bulk.skipped;
    site.failed += bulk.failed;
    for (const [reason, cnt] of Object.entries(bulk.byReason || {})) {
      // write-failed 已经计入 failed，不再重复进 skip 原因分布
      if (reason === 'write-failed') continue;
      stats.skipReasons[reason] = (stats.skipReasons[reason] || 0) + cnt;
    }
    // 整轮一页都没抓到（全失败 / 预算耗尽 / 抛错）⇒ 记一次源级失败，让陈旧的 mascus
    // 数据能被 checkSourceStaleness + 告警看见，而不是静默「成功 0 条」。
    if (!bulk.ok) {
      stats.failed += 1;
      site.failed += 1;
      bumpReason(bulk.error ? 'mascus-bulk-error' : 'mascus-all-pages-failed');
    }
  }

  // 本轮最终的源级并发上限（429 会把命中源减半，这里把结果留档，方便回看加固是否生效）
  stats.sourceConcurrency = limiter.snapshot();
  stats.durationMs = Date.now() - startTs;

  // Ark 兜底明细：**只在开启时才挂字段**，保证默认关时 stats 形状与加此功能之前一致
  if (arkFallback) stats.arkFallback = arkFallback;

  // 收口：哪些源最终开了熔断（供 route 拼 message 与诊断）
  const snap = circuit.snapshot();
  for (const [site, s] of Object.entries(snap)) {
    if (s.open) {
      stats.circuitOpen.push(site);
      bumpSite(site).opened = true;
    }
  }

  return stats;
}

// —— 种子（研究 JSON → DB）——
async function seedFromResearch(jsonPath) {
  const abs = path.isAbsolute(jsonPath) ? jsonPath : path.join(process.cwd(), jsonPath);
  if (!fs.existsSync(abs)) throw new Error(`种子文件不存在: ${abs}`);
  const rows = JSON.parse(fs.readFileSync(abs, 'utf8'));
  console.log(`🌱 种子写入：读取 ${rows.length} 条`);
  let n = 0, err = 0;
  for (const r of rows) {
    try {
      await upsertBenchmark(r);
      n++;
    } catch (e) {
      err++;
      console.error(`  ✗ ${r.brand} ${r.model} @${r.sourceSite}: ${e.message}`);
    }
  }
  console.log(`  ✅ 写入 ${n} 条，失败 ${err} 条`);
  return { n, err };
}

// —— 欧系农机具证据种子（WebSearch 逐条挂牌，公开行情，合规可双库 Neon/cn）——
// 数据：scripts/eu-benchmark-evidence.json
//       { count, records: [{ source, brand, brandNameZh, model, category, priceForeign, currency, country, url, capturedAt }] }
// 逻辑：按 brand+model+sourceSite 分组（同组合多条挂牌 → 一行基准价，取中位），
//       字段映射后走 upsertBenchmark 幂等写入。幂等键与每日采集一致（brand+model+sourceSite）。
// category 归一化：plough / seed_drill → soil（对齐 benchmark-config 的 CATEGORY）。
// 合规：境外公开挂牌价（价格/机型/源站），不含境内卖家 PII，可入 Neon 也可复制进 cn-postgres。
const EU_SEED_FX = { EUR: 7.8, GBP: 9.2, USD: 7.2, CNY: 1 };
function euCountryToRegion(country) {
  if (!country) return 'EU';
  return String(country).toUpperCase() === 'USA' ? 'US' : 'EU';
}
function normalizeEuCategory(category) {
  const c = String(category || '').toLowerCase();
  if (c === 'plough' || c === 'seed_drill') return 'soil';
  return c || 'soil';
}
async function seedEuEvidence(jsonRelPath = 'scripts/eu-benchmark-evidence.json') {
  // 优先读内联模块（Vercel serverless 下 scripts/ JSON 不被 output-trace 打进 standalone，
  // 用 require 内联模块可被打包器追踪）；回退读文件（本地/ECS 完整源码目录）。
  let records = [];
  try {
    const inline = require('./eu-benchmark-evidence');
    records = Array.isArray(inline) ? inline : (inline.records || []);
  } catch (e) {
    /* ignore */
  }
  if (!records.length) {
    const abs = path.isAbsolute(jsonRelPath) ? jsonRelPath : path.join(process.cwd(), jsonRelPath);
    if (fs.existsSync(abs)) {
      const doc = JSON.parse(fs.readFileSync(abs, 'utf8'));
      records = Array.isArray(doc) ? doc : (doc.records || []);
    }
  }
  if (!records.length) {
    console.warn(`⚠️ 欧系证据种子数据不可用（内联与文件均无），跳过`);
    return { ok: true, skipped: 0, n: 0, err: 0, records: 0 };
  }

  // 按 brand+model+sourceSite 分组（同组合的多条挂牌聚合为一行）
  const groups = new Map();
  for (const r of records) {
    const key = `${r.brand}||${r.model}||${r.source}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }

  let n = 0, skipped = 0, err = 0;
  for (const list of groups.values()) {
    const first = list[0];
    try {
      const listings = list.map((r) => ({ priceForeign: r.priceForeign, currency: r.currency }));
      const agg = aggregateListings(listings, EU_SEED_FX, { priceType: 'listing' });
      if (!agg) continue;
      // insertOnly：历史种子只在库里没有该 brand+model+sourceSite 时才插入。
      // 已存在即跳过（不刷新 lastVerified）—— 种子是固定历史证据，无条件重放
      // 只会让「假活」永续：时间戳每天更新，数据其实一直是几个月前那份。
      const r = await upsertBenchmark(
        {
          brand: first.brand,
          brandNameZh: first.brandNameZh,
          model: first.model,
          category: normalizeEuCategory(first.category),
          sourceSite: first.source,
          ...agg,
          confidenceScore: 0.6, // WebSearch 逐条验证证据，固定置信度
          sourceUrl: first.url,
          sourceDate: first.capturedAt || first.sourceDate || null,
          region: euCountryToRegion(first.country),
        },
        { insertOnly: true }
      );
      if (r && r.skipped) skipped++;
      else n++;
    } catch (e) {
      err++;
      console.error(`  ✗ ${first.brand} ${first.model} @${first.source}: ${e.message}`);
    }
  }
  console.log(
    `🌱 欧系证据种子：${records.length} 条 → 新增 ${n} 行 / 已存在跳过 ${skipped} 行 / 失败 ${err}`
  );
  return { ok: true, n, skipped, err, records: records.length };
}

// —— 数据陈旧检查（只读，供 cron 告警）——
/**
 * 检查 BrandBenchmark 各源站的数据新鲜度，区分两类「陈旧」：
 *   - `crawl-failed`     ：该 sourceSite 在 `SOURCES` 抓取清单里（有采集通道），
 *                          但数据停在 `staleDays` 天前 ⇒ 「在抓但抓不到」。
 *   - `not-in-crawl-list`：该 sourceSite 压根不在 `SOURCES` 里，只可能来自历史种子
 *                          ⇒ 「没有抓取通道，永远不会自己更新」。
 * 这两类的处置完全不同（前者查抓取，后者要么补通道、要么把源从基准价里摘掉），
 * 所以必须分开报，不能混成一个「陈旧」。
 *
 * 只 select 两个字段：cron 有 300s 总预算，全表 select 会白白拉一堆价格字段。
 *
 * @param {{ staleDays?: number }} [opts] `staleDays` 阈值（天），默认 30
 * @returns {Promise<{
 *   checked: number, noDate: number, staleDays: number,
 *   stale: Array<{ site: string, rows: number, lastDate: string|null, ageDays: number|null, kind: string }>,
 *   missingSources: string[]
 * }>}
 */
async function checkSourceStaleness({ staleDays = 30 } = {}) {
  const rows = await prisma.brandBenchmark.findMany({
    where: { isActive: true },
    select: { sourceSite: true, sourceDate: true },
  });

  const crawlKeys = new Set(SOURCES.map((s) => s.key));
  const bySite = new Map();
  let noDate = 0;

  for (const r of rows) {
    const site = r.sourceSite || '(unknown)';
    const ts = parseSourceDate(r.sourceDate);
    if (ts == null) noDate++;
    let cur = bySite.get(site);
    if (!cur) {
      cur = { site, rows: 0, maxTs: null };
      bySite.set(site, cur);
    }
    cur.rows++;
    if (ts != null && (cur.maxTs == null || ts > cur.maxTs)) cur.maxTs = ts;
  }

  const now = Date.now();
  const stale = [];
  for (const cur of bySite.values()) {
    // 没有任何可解析日期 ⇒ 无法判断新鲜度，按「陈旧」上报（数据质量本身有问题）
    const ageDays =
      cur.maxTs == null ? null : Math.floor((now - cur.maxTs) / 86400000);
    const isStale = ageDays == null || ageDays > staleDays;
    if (!isStale) continue;
    stale.push({
      site: cur.site,
      rows: cur.rows,
      lastDate: cur.maxTs == null ? null : formatSourceDate(cur.maxTs),
      ageDays,
      kind: crawlKeys.has(cur.site) ? 'crawl-failed' : 'not-in-crawl-list',
    });
  }
  // 按陈旧天数降序；无日期的排最前（最可疑）
  stale.sort((a, b) => {
    if (a.ageDays == null && b.ageDays == null) return 0;
    if (a.ageDays == null) return -1;
    if (b.ageDays == null) return 1;
    return b.ageDays - a.ageDays;
  });

  // 在抓取清单里但库里一行都没有的源（例如 efarm / avito / olx）
  const missingSources = SOURCES.map((s) => s.key).filter((k) => !bySite.has(k));

  return { checked: rows.length, noDate, staleDays, stale, missingSources };
}

// —— 只读报告 ——
async function report() {
  const rows = await prisma.brandBenchmark.findMany({ where: { isActive: true } });
  console.log(`\n📊 BrandBenchmark 汇总（${rows.length} 行）`);
  const byBrand = {};
  for (const r of rows) {
    byBrand[r.brand] = byBrand[r.brand] || { zh: r.brandNameZh, models: {} };
    byBrand[r.brand].models[r.model] = byBrand[r.brand].models[r.model] || [];
    byBrand[r.brand].models[r.model].push({
      site: r.sourceSite,
      cny: Math.round(r.priceCny),
      conf: r.confidenceScore,
      samp: r.sampleSize,
      date: r.sourceDate,
    });
  }
  for (const [brand, info] of Object.entries(byBrand)) {
    console.log(`\n■ ${info.zh} (${brand})`);
    for (const [model, srcs] of Object.entries(info.models)) {
      const cnys = srcs.map((s) => s.cny).filter((x) => x);
      const med = cnys.length ? (medianOf(cnys.sort((a, b) => a - b)) / 10000).toFixed(1) : '-';
      console.log(`  · ${model}  中位CNY≈${med}万  源数=${srcs.length}  样本=${srcs.reduce((a, s) => a + s.samp, 0)}`);
      for (const s of srcs) console.log(`      - ${s.site}: ¥${(s.cny / 10000).toFixed(1)}万 置信${s.conf} 样本${s.samp} ${s.date || ''}`);
    }
  }
}

function disconnectBenchmark() {
  return prisma.$disconnect();
}

module.exports = {
  prisma,
  CATEGORY,
  BRANDS,
  MODELS,
  SOURCES,
  FX_FALLBACK,
  buildTargets,
  httpGet,
  httpGetWithRetry,
  parseRetryAfterMs,
  computeRetryDelay,
  makeSourceLimiter,
  HTTP_429_MAX_RETRIES,
  HTTP_429_BASE_DELAY_MS,
  HTTP_429_MAX_RETRY_AFTER_MS,
  SOURCE_MIN_CONCURRENCY,
  getFxRates,
  buildSearchUrl,
  extractPrices,
  aggregate,
  parseListings,
  parseAgroline,
  parseMascus,
  parseMascusNextData,
  parseMascusNextDataItems,
  parseMascusDiagnostics,
  mascusBrandMatches,
  mascusModelTokens,
  mascusModelMatches,
  mascusItemPriceEur,
  fetchMascusBulk,
  fetchViaArkSearch,
  extractArkSearchPrices,
  extractArkSearchText,
  extractArkCitations,
  arkHostMatchesSite,
  httpPostJson,
  arkSearchGloballyEnabled,
  shouldArkFallback,
  ARK_SEARCH_TIMEOUT_MS,
  ARK_SEARCH_CONFIDENCE,
  ARK_SEARCH_BLOCKED_SOURCES,
  SOURCE_SEARCH_DOMAIN,
  MASCUS_BULK_SEGMENTS,
  MASCUS_BULK_RECENT_DAYS,
  MASCUS_BULK_MAX_PAGES,
  MASCUS_MIN_SAMPLES,
  extractCurrencyAmount,
  isRelevant,
  aggregateListings,
  upsertBenchmark,
  fetchOneTarget,
  makeSourceCircuit,
  runRefresh,
  seedFromResearch,
  seedEuEvidence,
  checkSourceStaleness,
  report,
  disconnectBenchmark,
};
