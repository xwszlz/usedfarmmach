/**
 * 多品牌国际基准价矩阵配置（首期 18 品牌全量）
 *
 * 决策（2026-08-12 用户拍板）：
 *  - 首期范围：18 个品牌全上
 *  - 数据源策略：投入轻量爬虫（fetch-benchmark.js 多源适配器）
 *  - 俄线优先级：Avito / OLX 俄本土站提至首期（原 Tier3 → Tier1）
 *  - 刷新频率：每天 1 次
 *
 * 本文件只定义"跟踪什么"（品牌×机型×源站），不含采集逻辑。
 * 采集与聚合见 scripts/fetch-benchmark.js。
 *
 * brand slug 对齐 Brand.nameEn（小写、连字符），用于与 BrandBenchmark.brand 关联。
 */

// 品类分类法（与 BrandBenchmark.category 一致）
const CATEGORY = {
  TRACTOR: 'tractor',
  FORAGE: 'forage_harvester', // 自走式青贮/饲料收获机
  COMBINE: 'combine', // 谷物联合收割
  BALER: 'baler', // 打捆机
  HAY: 'mower_tedder', // 割草/搂草
  SOIL: 'soil', // 耕整/播种
};

// 18 个品牌（拖拉机 11 + 收获青贮 4 + 耕整 3）
const BRANDS = [
  // —— 拖拉机 11 ——
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
  // —— 收获 / 青贮 4 ——
  { slug: 'claas', nameZh: '克拉斯', nameEn: 'CLAAS', origin: 'DE', primaryCategory: CATEGORY.FORAGE },
  { slug: 'krone', nameZh: '科罗尼', nameEn: 'Krone', origin: 'DE', primaryCategory: CATEGORY.FORAGE },
  { slug: 'vermeer', nameZh: '维米尔', nameEn: 'Vermeer', origin: 'US', primaryCategory: CATEGORY.BALER },
  { slug: 'mchale', nameZh: '麦克海尔', nameEn: 'McHale', origin: 'IE', primaryCategory: CATEGORY.BALER },
  // —— 耕整 3 ——
  { slug: 'kuhn', nameZh: '库恩', nameEn: 'Kuhn', origin: 'FR', primaryCategory: CATEGORY.SOIL },
  { slug: 'lemken', nameZh: '雷肯', nameEn: 'Lemken', origin: 'DE', primaryCategory: CATEGORY.SOIL },
  { slug: 'amazone', nameZh: '阿玛松', nameEn: 'Amazone', origin: 'DE', primaryCategory: CATEGORY.SOIL },
];

// 各品牌旗舰机型（1–3 个）。model 字符串用于检索与去重。
const MODELS = {
  'john-deere': [
    { model: '8R 410', category: CATEGORY.TRACTOR },
    { model: '6R 250', category: CATEGORY.TRACTOR },
  ],
  'new-holland': [
    { model: 'T7.315', category: CATEGORY.TRACTOR },
    { model: 'T8.435', category: CATEGORY.TRACTOR },
    { model: 'FR920', category: CATEGORY.FORAGE }, // 青贮收获
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
    { model: 'MF704', category: CATEGORY.TRACTOR }, // 东方红 MF704 轮拖
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

// 首期数据源（Tier1，7 站，含俄线）。russian=true 的站优先（套利核心市场）。
// currency 为该站默认挂牌币种；FX 在 fetch-benchmark.js 中按日折算 CNY。
const SOURCES = [
  { key: 'agroline', name: 'Agroline', region: 'EU', currency: 'EUR', russian: false, note: '欧洲二手机，CLAAS/Krone/JD 青贮强' },
  { key: 'machinerypete', name: 'MachineryPete', region: 'US', currency: 'USD', russian: false, note: '美国，含价格历史' },
  { key: 'mascus', name: 'Mascus', region: 'GLOBAL', currency: 'EUR', russian: false, note: '全球最大二手机之一，结构化好' },
  { key: 'tractorhouse', name: 'TractorHouse', region: 'US', currency: 'USD', russian: false, note: '美国拖拉机/联合收割体量大' },
  { key: 'efarm', name: 'e-farm', region: 'GLOBAL', currency: 'EUR', russian: false, note: '带估值（valuation）的二手机' },
  { key: 'avito', name: 'Avito', region: 'RU', currency: 'RUB', russian: true, note: '俄罗斯本土最大分类站，俄线定价直参' },
  { key: 'olx', name: 'OLX', region: 'RU/UA', currency: 'RUB', russian: true, note: '俄/乌本土站，贴近真实套利空间' },
];

// 生成"品牌×机型×源站"目标清单（供爬虫逐条采集）
function buildTargets() {
  const targets = [];
  for (const b of BRANDS) {
    const models = MODELS[b.slug] || [];
    for (const m of models) {
      for (const s of SOURCES) {
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

module.exports = {
  CATEGORY,
  BRANDS,
  MODELS,
  SOURCES,
  buildTargets,
  // 便捷：18 品牌全部机型（去重）
  allModels: () => BRANDS.flatMap((b) => (MODELS[b.slug] || []).map((m) => ({ brand: b.slug, brandNameZh: b.nameZh, nameEn: b.nameEn, ...m }))),
};
