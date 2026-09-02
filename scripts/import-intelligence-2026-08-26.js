// 神雕农机每日市场情报导入脚本 - 2026-08-26
// 数据来源：2026-08-26_跨境套利日报.md
// 执行：先设置环境变量 DATABASE_URL（.com 的 Neon 连接串，从 Vercel/Neon 控制台获取，勿硬编码到仓库），再：
//   env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy DATABASE_URL="$DATABASE_URL" node scripts/import-intelligence-2026-08-26.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 归一化 JSON 字段：保证写入 DB 的一定是合法 JSON 字符串
function toJsonField(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') {
    const t = v.trim();
    if (t === '') return null;
    try { JSON.parse(t); return t; }   // 已是合法 JSON 字符串 → 原样保留（不二次编码）
    catch { return JSON.stringify(t); } // 纯文本 → 包成 JSON 字符串
  }
  return JSON.stringify(v);             // 数组/对象 → stringify
}

const REPORT_DATE = '2026-08-26';

// 10条核心情报（icon/region/tags/text/detailedContent/actionTips）
const intels = [
  // 1. EUR/CNY 7.84企稳
  {
    icon: '💱',
    region: '汇率',
    regionEn: 'Exchange Rate',
    regionRu: 'Валютный курс',
    tags: ['EUR/CNY', '汇率', '7.84', '欧元企稳'],
    tagsEn: ['EUR/CNY', 'exchange rate', '7.84', 'euro stable'],
    tagsRu: ['EUR/CNY', 'валютный курс', '7.84', 'евро стабилен'],
    text: 'EUR/CNY企稳7.84关口，买方窗口延续，对俄线与中亚出货持续利好',
    textEn: 'EUR/CNY stable at 7.84, buyer window continues, favorable for Russia & Central Asia exports',
    textRu: 'EUR/CNY стабилен на отметке 7.84, окно покупателя продолжается, благоприятно для экспорта в Россию и Центральную Азию',
    detailedContent: `## EUR/CNY 7.84企稳 买方窗口延续\n\n**关键节点**：8月26日牌价7.84，较8/19的7.82微升0.3%，欧元企稳7.8区间。\n\n### 双侧影响分析\n| 影响维度 | 数值 | 操作建议 |\n|---------|------|---------|\n| 国际采购成本(EUR计) | 持平 | 可继续推进欧洲平台采购 |\n| 出口收入(CNY计) | 维持高位 | 对俄线/中亚客户加速出货 |\n| 套利空间 | 不变 | 1290XC 870.3%等爆款继续主打 |\n\n**结论**：欧元企稳让国际采购和国内出货双侧窗口同时打开，建议对俄线和中亚客户继续加大推广力度。`,
    detailedContentEn: `## EUR/CNY 7.84 Stable - Buyer Window Continues\n\n**Key Level**: 8/26 rate 7.84, vs 8/19 7.82 (+0.3%), euro stable in 7.8 range.\n\n### Dual-Side Impact\n| Dimension | Value | Recommendation |\n|---|---|---|\n| EU purchase cost (EUR) | Stable | Continue EU procurement |\n| Export revenue (CNY) | High | Push Russia/Central Asia sales |\n| Arbitrage space | Unchanged | Continue pushing 1290XC 870.3% etc. |\n\n**Conclusion**: Euro stability opens both purchase and sales windows. Recommend accelerating promotion to Russia/Central Asia buyers.`,
    detailedContentRu: `## EUR/CNY 7.84 стабилен - окно покупателя продолжается\n\n**Ключевой уровень**: Курс 26.08 - 7.84, против 19.08 - 7.82 (+0.3%), евро стабилен в диапазоне 7.8.\n\n### Двусторонний анализ влияния\n| Измерение | Значение | Рекомендация |\n|---|---|---|\n| Стоимость закупки в ЕС (EUR) | Стабильна | Продолжить закупки в ЕС |\n| Экспортная выручка (CNY) | Высокая | Ускорить продажи в РФ/Центральную Азию |\n| Арбитраж | Без изменений | Продвигать 1290XC 870.3% и др. |\n\n**Заключение**: Стабильность евро открывает оба окна. Рекомендуется ускорить продвижение среди покупателей в РФ и Центральной Азии.`,
    actionTips: JSON.stringify([
      '立即推进欧洲采购询价（EUR计成本可控）',
      '加大俄罗斯/中亚渠道出货推广',
      '大额欧元出口建议远期锁汇或CIPS人民币结算'
    ]),
    dataSummary: 'EUR/CNY 7.84企稳 | 较8/19 +0.3% | 买方窗口延续',
    sortOrder: 1
  },
  // 2. Agroline 158条 CLAAS
  {
    icon: '📊',
    region: '欧洲市场',
    regionEn: 'European Market',
    regionRu: 'Европейский рынок',
    tags: ['Agroline', 'CLAAS', '158条', '供给稳定'],
    tagsEn: ['Agroline', 'CLAAS', '158 listings', 'supply stable'],
    tagsRu: ['Agroline', 'CLAAS', '158 объявлений', 'предложение стабильно'],
    text: 'Agroline在售CLAAS达158条，较8/19增加6条，欧洲供给维持稳定',
    textEn: 'Agroline CLAAS listings reach 158, +6 vs 8/19, European supply remains stable',
    textRu: 'На Agroline 158 объявлений CLAAS, +6 к 19.08, предложение в Европе стабильно',
    detailedContent: `## Agroline CLAAS供给+6至158条 欧洲竞争格局稳定\n\n**对比基准**：8/19 152条 → 8/26 158条（+6条，+3.9%）。\n\n### 关键观察\n- **欧洲供给波动小**：单周+6条属正常季节性波动\n- **竞争格局未变**：5300RC 2020款 €99,900仍为套利锚点\n- **采购窗口持续开放**：国际库存充足，仍可继续询价采购\n\n### 重点在售型号\n| 型号 | 在售数 | 价格锚点(EUR) |\n|------|--------|---------------|\n| 5300系列 | 158条主力 | €99,900(2020款) |\n| 1290 XC | 3条 | €170,800(2020款) |\n\n**结论**：欧洲供给维持稳定，采购节奏无需调整。`,
    detailedContentEn: `## Agroline CLAAS Supply +6 to 158 - EU Competition Stable\n\n**Benchmark**: 8/19 152 → 8/26 158 (+6, +3.9%).\n\n### Key Observations\n- **EU supply fluctuation small**: weekly +6 is normal seasonal\n- **Competition unchanged**: 5300RC 2020 €99,900 remains arbitrage anchor\n- **Purchase window open**: ample inventory, continue RFQ\n\n**Conclusion**: EU supply stable, no procurement rhythm adjustment needed.`,
    detailedContentRu: `## Предложение Agroline CLAAS +6 до 158 - конкуренция в ЕС стабильна\n\n**База**: 19.08 152 → 26.08 158 (+6, +3.9%).\n\n**Заключение**: Предложение в ЕС стабильно, корректировка ритма закупок не требуется.`,
    actionTips: JSON.stringify([
      '维持欧洲询价采购节奏',
      '关注5300RC 2020款 €99,900锚点',
      '继续监控Agroline供给变化'
    ]),
    dataSummary: 'Agroline 158条(+6) | 欧洲供给稳定 | 5300RC锚点€99,900',
    sortOrder: 2
  },
  // 3. 1290XC 870.3%全品类第一
  {
    icon: '🏆',
    region: '套利机会',
    regionEn: 'Arbitrage',
    regionRu: 'Арбитраж',
    tags: ['1290XC', '870.3%', '全品类第一', 'Krone'],
    tagsEn: ['1290XC', '870.3%', 'top of all', 'Krone'],
    tagsRu: ['1290XC', '870.3%', 'лидер категории', 'Krone'],
    text: 'Krone 1290XC(2014)套利价差率870.3%再创全品类第一，俄线首选爆款',
    textEn: 'Krone 1290XC (2014) arbitrage margin 870.3% hits #1, top Russia-line product',
    textRu: 'Krone 1290XC (2014) арбитраж 870.3% - лидер, главный товар для РФ',
    detailedContent: `## Krone 1290XC(2014) 870.3% 再创全品类第一\n\n**核心数据**：\n- 国内售价：13.8万元（库存1台）\n- 国际参考：€170,800（2020款，Krone官方Agriaffaires）\n- 价差：120.1万元\n- 价差率：**870.3%**（vs 8/19 868%，+2.3pp）\n\n### 推荐路径\n| 目标市场 | 客户类型 | 物流方式 |\n|---------|---------|---------|\n| 俄罗斯 | 干草/秸秆压捆专业户 | 满洲里铁路 |\n| 哈萨克斯坦 | 农业合作社 | 阿拉木图公路 |\n| 中亚其他 | 大型农场 | 阿拉山口铁路 |\n\n### 重点动作\n- **立即推进询价**：库存1台，先到先得\n- **匹配俄线买家**：重点对接压捆作业服务商\n- **同期推Kuhn 890(345%)**：补充中亚小客户`,
    detailedContentEn: `## Krone 1290XC (2014) 870.3% Hits #1\n\n**Core data**: CN¥138K domestic vs EUR170.8K intl (2020 model), margin 870.3%.\n\n### Recommended Paths\n| Market | Customer | Logistics |\n|---|---|---|\n| Russia | Hay/straw baling service providers | Manzhouli rail |\n| Kazakhstan | Agricultural cooperatives | Almaty road |\n| Central Asia | Large farms | Alashankou rail |\n\n**Action**: Push RFQ immediately, match Russia baling service buyers.`,
    detailedContentRu: `## Krone 1290XC (2014) 870.3% - лидер категории\n\n**Данные**: 138 тыс. юаней внутренний vs 170,8 тыс. евро международный (2020), маржа 870.3%.\n\n**Действие**: Немедленно направить запросы, связаться с российскими покупателями.`,
    actionTips: JSON.stringify([
      '立即询价，库存1台先到先得',
      '对接俄线压捆作业服务商',
      '配套推Kuhn 890(345%)覆盖小客户'
    ]),
    dataSummary: '1290XC 870.3% | 国内13.8万 vs 国际€170.8K | 全品类第一',
    sortOrder: 3
  },
  // 4. 5300RC 2020款 335.1%
  {
    icon: '📦',
    region: '套利机会',
    regionEn: 'Arbitrage',
    regionRu: 'Арбитраж',
    tags: ['5300RC', '2020款', '335.1%', 'CLAAS'],
    tagsEn: ['5300RC', '2020 model', '335.1%', 'CLAAS'],
    tagsRu: ['5300RC', 'модель 2020', '335.1%', 'CLAAS'],
    text: 'CLAAS 5300RC(2020款)套利价差率335.1%续创峰值，俄线/中亚王牌',
    textEn: 'CLAAS 5300RC (2020) arbitrage 335.1% peaks again, Russia/Central Asia ace',
    textRu: 'CLAAS 5300RC (2020) арбитраж 335.1% новый пик, козырь для РФ/Центральной Азии',
    detailedContent: `## CLAAS 5300RC(2020) 335.1% 续创峰值\n\n**核心数据**：\n- 国内售价：18万元\n- 国际参考：€99,900（2020款）= 78.3万元\n- 价差：60.3万元\n- 价差率：**335.1%**（vs 8/19 334%，+1.1pp）\n\n### 推荐路径\n| 目标市场 | 推荐理由 |\n|---------|---------|\n| 俄罗斯 | 打捆作业服务商首选机型 |\n| 哈萨克斯坦 | 大型干草种植农场刚需 |\n| 巴西 | 待评估(关税14%下利润空间) |\n\n**结论**：价差率维持峰值，对俄线和中亚客户重点推进。`,
    detailedContentEn: `## CLAAS 5300RC (2020) 335.1% Peak\n\n**Core**: CN¥180K vs EUR99.9K (=CN¥783K), margin 335.1%.\n\n**Conclusion**: Maintain peak, push Russia/Central Asia.`,
    detailedContentRu: `## CLAAS 5300RC (2020) 335.1% пик\n\n**Заключение**: Поддерживать пик, продвигать в РФ/Центральную Азию.`,
    actionTips: JSON.stringify([
      '对接俄罗斯打捆作业服务商',
      '重点推哈萨克斯坦大型干草农场',
      '持续跟踪价差率峰值'
    ]),
    dataSummary: '5300RC(2020) 335.1% | 国内18万 vs 国际78.3万 | 峰值维持',
    sortOrder: 4
  },
  // 5. FR450 300% 10台走量
  {
    icon: '🔥',
    region: '俄罗斯',
    regionEn: 'Russia',
    regionRu: 'Россия',
    tags: ['FR450', '300%', '10台', '走量爆款'],
    tagsEn: ['FR450', '300%', '10 units', 'volume hit'],
    tagsRu: ['FR450', '300%', '10 шт', 'бестселлер'],
    text: 'New Holland FR450 300%价差走量爆款，库存10台加速推俄罗斯',
    textEn: 'NH FR450 300% spread volume hit, 10-unit stock accelerate Russia push',
    textRu: 'NH FR450 300% маржа бестселлер, остаток 10 шт ускорить в РФ',
    detailedContent: `## FR450 300% × 10台走量爆款\n\n**核心数据**：\n- 库存：**10台**（New Holland FR450 2013款）\n- 国内售价：11万元/台\n- 国际参考：约44万元（俄市场估€56.3K）\n- 单台价差：33万元\n- 价差率：**300%**\n\n### 推进策略\n| 客户类型 | 数量 | 单价 | 备注 |\n|---------|------|------|------|\n| 俄罗斯中型农场 | 5台 | 44万 | 银行转账+CIPS |\n| 哈萨克斯坦合作社 | 3台 | 40万 | 公路运输 |\n| 远东农户 | 2台 | 38万 | 满洲里铁路 |\n\n**汇率影响最小**：俄线EUR/RUB 86.88高位维持，利润不变。\n\n**本周目标**：完成3-5台订单签约。`,
    detailedContentEn: `## FR450 300% × 10-unit Volume Hit\n\n**Core**: 10-unit stock (NH FR450 2013), CN¥110K each, intl ~CN¥440K, margin 300%.\n\n**Target**: Sign 3-5 unit orders this week.`,
    detailedContentRu: `## FR450 300% × 10 шт бестселлер\n\n**Цель**: Подписать 3-5 контрактов на этой неделе.`,
    actionTips: JSON.stringify([
      '本周签约3-5台订单',
      '对接俄罗斯中型农场',
      '同步推哈萨克斯坦合作社'
    ]),
    dataSummary: 'FR450 300% | 库存10台 | 单台33万利润 | 俄线走量',
    sortOrder: 5
  },
  // 6. ICP备案已通过
  {
    icon: '🛡️',
    region: '合规',
    regionEn: 'Compliance',
    regionRu: 'Соответствие',
    tags: ['ICP备案', '冀ICP备2024053719号-4', '合规运营'],
    tagsEn: ['ICP filing', 'Ji-ICP 2024053719-4', 'compliance'],
    tagsRu: ['ICP регистрация', 'Ji-ICP 2024053719-4', 'соответствие'],
    text: '工信部ICP备案已通过(冀ICP备2024053719号-4)，公安备案审核中，.cn站合法运营',
    textEn: 'MIIT ICP filing approved (Ji-ICP 2024053719-4), PSB filing under review, .cn site legal',
    textRu: 'ICP MIIT одобрено (Ji-ICP 2024053719-4), PSB на рассмотрении, .cn сайт легален',
    detailedContent: `## ICP备案已通过 .cn站合规运营\n\n**关键合规里程碑**：\n- ✅ 工信部ICP备案：**冀ICP备2024053719号-4**\n- ⏳ 公安联网数据码审核中：1915d880b1d0a11c78e85af485dcd575f\n\n### 合规要点\n- ✅ 在线询价(非拍卖模式)：盲报/卖方决定/无加价/1人即可/诚意金\n- ✅ 全站"议价"→"询价"统一\n- ✅ 数据不出境(.cn)：中国用户个人数据不离开境内\n- ✅ 外国公开行情数据：可入 Neon(新加坡)，可复制进 cn-postgres\n\n**结论**：.cn站合法合规运营中，无合规风险。`,
    detailedContentEn: `## ICP Filing Approved - .cn Site Compliant\n\n**Milestones**:\n- ✅ MIIT ICP: Ji-ICP 2024053719-4\n- ⏳ PSB network code under review\n\n**Conclusion**: .cn site legally compliant.`,
    detailedContentRu: `## ICP одобрено - .cn сайт соответствует\n\n**Заключение**: Сайт .cn работает легально и в соответствии с требованиями.`,
    actionTips: JSON.stringify([
      '持续跟进公安备案进度',
      '保持询价模式合规',
      '数据不出境严格执行'
    ]),
    dataSummary: 'ICP备案已通过 | 公安备案审核中 | .cn合法运营',
    sortOrder: 6
  },
  // 7. Kuhn 890 345% 中亚/俄罗斯
  {
    icon: '🌾',
    region: '中亚',
    regionEn: 'Central Asia',
    regionRu: 'Центральная Азия',
    tags: ['Kuhn 890', '345%', '大方捆', '中亚'],
    tagsEn: ['Kuhn 890', '345%', 'big square', 'Central Asia'],
    tagsRu: ['Kuhn 890', '345%', 'большой тюк', 'Центральная Азия'],
    text: 'Kuhn 890大方捆(2014)套利价差率345%，中亚与俄罗斯小客户首选',
    textEn: 'Kuhn 890 big square (2014) arbitrage 345%, Central Asia/Russia small-buyer top choice',
    textRu: 'Kuhn 890 большой тюк (2014) арбитраж 345%, выбор для малых покупателей ЦА/РФ',
    detailedContent: `## Kuhn 890大方捆 345% 中亚/俄罗斯小客户首选\n\n**核心数据**：\n- 库存：8万元/台（Kuhn 890 2014款）\n- 国际参考：约35.6万元（估€45.5K）\n- 价差：27.6万元\n- 价差率：**345%**\n\n### 推荐路径\n| 目标客户 | 数量 | 单价区间 | 备注 |\n|---------|------|---------|------|\n| 中亚小农场主 | 3-5台 | 30-35万 | 公路+铁路联运 |\n| 俄罗斯小型合作社 | 2-3台 | 38-42万 | 满洲里铁路 |\n| 哈萨克斯坦家庭农场 | 5台 | 32-38万 | 阿拉木图 |\n\n**结论**：与1290XC打包推广，覆盖不同预算层级客户。`,
    detailedContentEn: `## Kuhn 890 Big Square 345% - Central Asia/Russia Small-Buyer Top Choice\n\n**Core**: CN¥80K vs ~CN¥356K intl, margin 345%.\n\n**Conclusion**: Bundle with 1290XC to cover all buyer budget tiers.`,
    detailedContentRu: `## Kuhn 890 большой тюк 345% - выбор для малых покупателей ЦА/РФ\n\n**Заключение**: Объединить с 1290XC для охвата всех бюджетов.`,
    actionTips: JSON.stringify([
      '与1290XC打包推广',
      '对接中亚小农场主',
      '推哈萨克斯坦家庭农场'
    ]),
    dataSummary: 'Kuhn 890 345% | 国内8万 vs 国际35.6万 | 中亚小客户首选',
    sortOrder: 7
  },
  // 8. JD 7250 149.5% 新晋爆款
  {
    icon: '🆕',
    region: '俄罗斯',
    regionEn: 'Russia',
    regionRu: 'Россия',
    tags: ['JD 7250', '149.5%', '新晋爆款', '2020款'],
    tagsEn: ['JD 7250', '149.5%', 'new hit', '2020 model'],
    tagsRu: ['JD 7250', '149.5%', 'новинка', 'модель 2020'],
    text: 'John Deere 7250(2020款)套利149.5%新晋爆款，俄罗斯/中亚大马力需求',
    textEn: 'John Deere 7250 (2020) 149.5% arbitrage new hit, Russia/Central Asia high-HP demand',
    textRu: 'John Deere 7250 (2020) арбитраж 149.5% новинка, спрос на мощные в РФ/ЦА',
    detailedContent: `## John Deere 7250(2020) 149.5% 新晋爆款\n\n**核心数据**：\n- 库存：20万元/台（JD 7250 2020款）\n- 国际参考：约49.9万元（估€63.8K）\n- 价差：29.9万元\n- 价差率：**149.5%**\n\n### 客户定位\n| 客户类型 | 推荐理由 |\n|---------|---------|\n| 俄罗斯大型农场 | JD品牌偏好强，欧美机型刚需 |\n| 中亚合作社 | 200马力+需求稳定 |\n| 哈萨克斯坦粮食种植户 | 春耕秋收主力机型 |\n\n**优势**：JD品牌溢价高，俄线买家认可度强。\n\n**结论**：作为JD系列爆款，本周重点推广。`,
    detailedContentEn: `## John Deere 7250 (2020) 149.5% New Hit\n\n**Core**: CN¥200K vs ~CN¥499K, margin 149.5%.\n\n**Conclusion**: Push as JD series hit this week.`,
    detailedContentRu: `## John Deere 7250 (2020) 149.5% новинка\n\n**Заключение**: Продвигать как хит серии JD на этой неделе.`,
    actionTips: JSON.stringify([
      '本周重点推广JD 7250',
      '对接俄罗斯大型农场',
      '推中亚合作社'
    ]),
    dataSummary: 'JD 7250 149.5% | 国内20万 vs 国际49.9万 | 新晋爆款',
    sortOrder: 8
  },
  // 9. 巴西线5300RC 75.1%关税挑战
  {
    icon: '🌎',
    region: '巴西',
    regionEn: 'Brazil',
    regionRu: 'Бразилия',
    tags: ['巴西', '5300RC 2022款', '14%关税', '75.1%'],
    tagsEn: ['Brazil', '5300RC 2022', '14% tariff', '75.1%'],
    tagsRu: ['Бразилия', '5300RC 2022', '14% пошлина', '75.1%'],
    text: 'CLAAS 5300RC(2022款)巴西线75.1%价差，14%关税需提前备齐文件',
    textEn: 'CLAAS 5300RC (2022) Brazil line 75.1% spread, 14% tariff needs full docs',
    textRu: 'CLAAS 5300RC (2022) Бразилия 75.1%, 14% пошлина требует документы',
    detailedContent: `## 5300RC(2022款)巴西线 75.1% 关税挑战\n\n**核心数据**：\n- 库存：65万元/台（CLAAS 5300RC 2022款）\n- 国际参考：约113.8万元（EU€145.2K）\n- 价差：48.8万元\n- 价差率：**75.1%**（扣除14%关税+州税后仍有60%+净利）\n\n### 巴西通关要点\n| 项目 | 要求 | 操作 |\n|------|------|------|\n| 进口关税 | 14% | 提前预算 |\n| 州税(ICMS) | 12-18% | 视目的地州 |\n| 文件审批 | INMETRO认证 | 提前90天 |\n| 物流 | 海运12-18万元 | 圣保罗/桑托斯港 |\n| 语言 | 葡语资料 | 准备葡语版 |\n\n**结论**：75.1%价差扣除综合成本后净利仍达50%+，值得推进但需提前合规准备。`,
    detailedContentEn: `## 5300RC (2022) Brazil Line 75.1% - Tariff Challenge\n\n**Core**: CN¥650K vs ~CN¥1,138K, margin 75.1%.\n\n**Conclusion**: After 14% tariff + state tax, net 50%+. Worth pursuing but needs advance compliance prep.`,
    detailedContentRu: `## 5300RC (2022) Бразилия 75.1% - тарифный вызов\n\n**Заключение**: После 14% пошлины и налогов штата чистая маржа 50%+. Стоит продолжать.`,
    actionTips: JSON.stringify([
      '提前90天申请INMETRO认证',
      '准备葡语资料版本',
      '预算14%关税+12-18%州税'
    ]),
    dataSummary: '5300RC(2022) 巴西75.1% | 关税14%+州税12-18% | 净利50%+',
    sortOrder: 9
  },
  // 10. 苏伊士航线绕行物流成本
  {
    icon: '⚓',
    region: '全球物流',
    regionEn: 'Global Logistics',
    regionRu: 'Глобальная логистика',
    tags: ['苏伊士航线', '绕行好望角', '海运+7-10天', '+20%成本'],
    tagsEn: ['Suez Canal', 'Cape detour', 'sea +7-10d', '+20% cost'],
    tagsRu: ['Суэцкий канал', 'обход мыса', 'море +7-10д', '+20% расходы'],
    text: '苏伊士运河仍绕行好望角，海运周期+7-10天，报价预留20%物流弹性',
    textEn: 'Suez Canal still diverting via Cape, sea +7-10 days, reserve 20% logistics margin',
    textRu: 'Суэцкий канал все еще с обходом, море +7-10 дней, заложить 20% на логистику',
    detailedContent: `## 苏伊士航线绕行 物流成本管理\n\n**现状**：红海局势紧张，苏伊士运河持续绕行好望角。\n\n### 影响测算\n| 航线 | 正常周期 | 当前周期 | 成本变化 |\n|------|---------|---------|---------|\n| 中国-圣保罗 | 35天 | 45天 | +20% |\n| 中国-鹿特丹 | 28天 | 38天 | +15% |\n| 中国-迪拜 | 18天 | 25天 | +25% |\n\n### 操作要点\n- **报价预留20%物流弹性**\n- **优先考虑铁路替代方案**（中欧班列、中俄班列）\n- **提前锁定舱位**，规避旺季溢价\n- **保险覆盖绕行延误风险**\n\n**结论**：报价阶段预留物流弹性，规避绕行成本侵蚀利润。`,
    detailedContentEn: `## Suez Detour - Logistics Cost Management\n\n**Status**: Red Sea tensions, Suez still diverting via Cape.\n\n**Impact**: China-Santos 35d → 45d (+20% cost). Reserve 20% logistics buffer in quotes.`,
    detailedContentRu: `## Обход Суэцкого канала - управление логистикой\n\n**Статус**: Красное море напряженно, обход через мыс.\n\n**Влияние**: Китай-Сантус 35д → 45д (+20%). Заложить 20% буфер в расценки.`,
    actionTips: JSON.stringify([
      '报价预留20%物流弹性',
      '优先考虑中欧/中俄班列替代',
      '提前锁定舱位'
    ]),
    dataSummary: '苏伊士绕行 | 海运+7-10天 | 成本+20% | 预留弹性',
    sortOrder: 10
  }
];

async function importIntelligence() {
  console.log(`[import-intelligence-${REPORT_DATE}] 开始执行...`);
  console.log(`情报数量：${intels.length}条`);

  try {
    // 查询现有情报数量
    const beforeCount = await prisma.marketIntel.count();
    console.log(`导入前情报总数：${beforeCount}条`);

    // 当日先清理（同日重复执行幂等）
    const startOfDay = new Date(REPORT_DATE + 'T00:00:00.000Z');
    const endOfDay = new Date(REPORT_DATE + 'T23:59:59.999Z');
    const deletedToday = await prisma.marketIntel.deleteMany({
      where: {
        date: {
          gte: startOfDay,
          lte: endOfDay
        }
      }
    });
    console.log(`清理同日情报：${deletedToday.count}条`);

    // 批量插入
    let successCount = 0;
    for (const intel of intels) {
      try {
        await prisma.marketIntel.create({
          data: {
            icon: intel.icon,
            region: intel.region,
            regionEn: intel.regionEn,
            regionRu: intel.regionRu,
            tags: toJsonField(intel.tags),
            tagsEn: toJsonField(intel.tagsEn),
            tagsRu: toJsonField(intel.tagsRu),
            text: intel.text,
            textEn: intel.textEn,
            textRu: intel.textRu,
            detailedContent: intel.detailedContent,
            detailedContentEn: intel.detailedContentEn,
            detailedContentRu: intel.detailedContentRu,
            actionTips: toJsonField(intel.actionTips),
            dataSummary: toJsonField(intel.dataSummary),
            date: new Date(REPORT_DATE + 'T06:30:00.000Z'),
            sortOrder: intel.sortOrder,
            isActive: true
          }
        });
        successCount++;
        console.log(`  [${intel.sortOrder}] ${intel.icon} ${intel.text.substring(0, 40)}... ✓`);
      } catch (e) {
        console.error(`  [${intel.sortOrder}] 插入失败:`, e.message);
      }
    }

    const afterCount = await prisma.marketIntel.count();
    console.log(`\n✅ 情报导入完成：${successCount}/${intels.length}条`);
    console.log(`导入后情报总数：${afterCount}条（增量 +${afterCount - beforeCount}条）`);
  } catch (e) {
    console.error('❌ 导入失败:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

importIntelligence();