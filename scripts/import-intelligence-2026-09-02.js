// 神雕农机每日市场情报导入脚本 - 2026-09-02
// 数据来源：2026-09-02_跨境套利日报.md（基于 Neon 真实抓取数据）
// 执行：
//   DATABASE_URL="<Neon连接串>" node scripts/import-intelligence-2026-09-02.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function toJsonField(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') {
    const t = v.trim();
    if (t === '') return null;
    try { JSON.parse(t); return t; }
    catch { return JSON.stringify(t); }
  }
  return JSON.stringify(v);
}

const REPORT_DATE = '2026-09-02';

const intels = [
  // 1. EUR/CNY 7.84
  {
    icon: '💱',
    region: '全球',
    regionEn: 'Global',
    regionRu: 'Глобально',
    tags: ['EUR/CNY', '汇率', '7.84', '欧元企稳'],
    tagsEn: ['EUR/CNY', 'exchange rate', '7.84', 'euro stable'],
    tagsRu: ['EUR/CNY', 'валютный курс', '7.84', 'евро стабилен'],
    text: 'EUR/CNY 维持 7.84 关口（日内+0.26%），欧元计价采购成本可控，买卖双侧窗口延续',
    textEn: 'EUR/CNY holds at 7.84 (intraday +0.26%); euro-denominated purchase cost stays controllable, both buy and sell windows remain open',
    textRu: 'EUR/CNY держится на 7.84 (внутридневное +0.26%); стоимость закупки в евро остаётся контролируемой, окна покупки и продажи открыты',
    detailedContent: `## EUR/CNY 维持 7.84 关口\n\n**关键节点**：9月2日牌价 7.84，与 8/26 持平，日内波动 +0.26%。\n\n### 双侧影响\n| 维度 | 数值 | 操作建议 |\n|------|------|----------|\n| 国际采购成本(EUR计) | 持平 | 继续推进欧洲平台询价采购 |\n| 出口收入(CNY计) | 维持高位 | 对俄线/中亚客户加速出货 |\n| 套利空间 | 不变 | 980/850 等高套利机型继续主打 |\n\n**结论**：汇率端无不利变化，我方人民币成本优势未被侵蚀，可按既定节奏推进采购与出货。`,
    detailedContentEn: `## EUR/CNY Holds at 7.84\n\n**Key level**: 9/2 rate 7.84, unchanged vs 8/26, intraday +0.26%.\n\n### Dual-Side Impact\n| Dimension | Value | Action |\n|---|---|---|\n| EU purchase cost (EUR) | Flat | Continue EU platform RFQ |\n| Export revenue (CNY) | High | Accelerate Russia/Central Asia shipments |\n| Arbitrage space | Unchanged | Keep pushing 980/850 high-spread models |\n\n**Conclusion**: No adverse FX movement; RMB cost advantage intact, proceed with planned procurement and shipping.`,
    detailedContentRu: `## EUR/CNY держится на 7.84\n\n**Ключевой уровень**: Курс 02.09 — 7.84, без изменений к 26.08, внутридневное +0.26%.\n\n**Заключение**: Неблагоприятных валютных изменений нет, преимущество по стоимости в юанях сохранено.`,
    actionTips: JSON.stringify([
      '维持欧洲采购询价节奏（EUR计成本可控）',
      '加大俄罗斯/中亚渠道出货推广',
      '大额欧元出口建议远期锁汇或人民币结算'
    ]),
    dataSummary: 'EUR/CNY 7.84 | 较8/26持平 | 日内+0.26%',
    sortOrder: 1
  },
  // 2. EUR/RUB 87.34
  {
    icon: '🔥',
    region: '俄罗斯',
    regionEn: 'Russia',
    regionRu: 'Россия',
    tags: ['EUR/RUB', '卢布', '87.34', '俄线利润'],
    tagsEn: ['EUR/RUB', 'ruble', '87.34', 'Russia margin'],
    tagsRu: ['EUR/RUB', 'рубль', '87.34', 'маржа в РФ'],
    text: 'EUR/RUB 升至 87.34（较 8/26 的 86.88 再贬 0.53%），卢布持续承压，俄线人民币回款更厚',
    textEn: 'EUR/RUB rises to 87.34 (+0.53% vs 8/26 86.88); ruble keeps weakening, RMB repatriation from Russia line gets thicker',
    textRu: 'EUR/RUB вырос до 87.34 (+0.53% к 26.08 — 86.88); рубль продолжает слабеть, возврат в юанях по российскому направлению растёт',
    detailedContent: `## EUR/RUB 升至 87.34 俄线利润维持高位\n\n**变化**：8/26 86.88 → 9/2 87.34（+0.53%），卢布连续走弱。\n\n### 双向解读\n| 维度 | 影响 |\n|------|------|\n| 俄方买家采购力 | ⚠️ 以卢布计价成本上升，议价更敏感 |\n| 我方人民币回款 | ✅ 同等欧元售价折人民币更厚 |\n| 竞争态势 | ✅ 欧美品牌因制裁缺位，中国货源议价权提升 |\n\n**结论**：应抢在卢布进一步贬值前锁定订单，同时以人民币或友好币种报价规避汇损。`,
    detailedContentEn: `## EUR/RUB at 87.34 — Russia Line Margin Stays High\n\n**Change**: 8/26 86.88 → 9/2 87.34 (+0.53%), ruble keeps sliding.\n\n### Two-Way Reading\n| Dimension | Impact |\n|---|---|\n| Russian buyer power | ⚠️ Ruble-denominated cost up, more price-sensitive |\n| Our RMB repatriation | ✅ Same EUR price converts to more CNY |\n| Competition | ✅ Western brands absent under sanctions |\n\n**Conclusion**: Lock orders before further ruble weakness; quote in RMB or friendly currencies to avoid FX loss.`,
    detailedContentRu: `## EUR/RUB 87.34 — маржа по российскому направлению остаётся высокой\n\n**Изменение**: 26.08 86.88 → 02.09 87.34 (+0.53%), рубль продолжает снижаться.\n\n**Заключение**: Фиксировать заказы до дальнейшего ослабления рубля; котировать в юанях.`,
    actionTips: JSON.stringify([
      '抢在卢布进一步贬值前锁定俄线订单',
      '优先以人民币报价，规避卢布汇损',
      '对俄老客户主动推送本周高套利机型清单'
    ]),
    dataSummary: 'EUR/RUB 87.34 | 较8/26 +0.53% | 卢布持续承压',
    sortOrder: 2
  },
  // 3. Agroline 150
  {
    icon: '📉',
    region: '欧洲',
    regionEn: 'Europe',
    regionRu: 'Европа',
    tags: ['Agroline', 'CLAAS', '150条', '供给收缩'],
    tagsEn: ['Agroline', 'CLAAS', '150 listings', 'supply contraction'],
    tagsRu: ['Agroline', 'CLAAS', '150 объявлений', 'сокращение предложения'],
    text: 'Agroline 在售 CLAAS 降至 150 条（较 8/26 减少 8 条，-5.1%），欧洲供给连续两期去库',
    textEn: 'Agroline CLAAS listings fall to 150 (-8 vs 8/26, -5.1%); European supply destocking for a second consecutive period',
    textRu: 'Объявления CLAAS на Agroline снизились до 150 (-8 к 26.08, -5.1%); сокращение предложения в Европе второй период подряд',
    detailedContent: `## Agroline 供给收缩至 150 条 我方议价权提升\n\n**对比**：8/26 158条 → 9/2 150条（**-8条，-5.1%**）。\n\n### 关键观察\n- **连续两期去库**：欧洲二手青贮机存量进入下行通道\n- **稀缺性累积**：我方在库 CLAAS 系列的稀缺溢价正在形成\n- **议价策略**：可对欧/俄买家强调供给收紧，坚持报价不让步\n\n### 供给趋势\n| 日期 | Agroline 在售 | 变化 |\n|------|--------------|------|\n| 8/19 | 152 条 | 基准 |\n| 8/26 | 158 条 | +6 |\n| 9/02 | **150 条** | **-8** |\n\n**结论**：供给拐点出现，建议将"欧洲库存收紧"纳入客户沟通话术，争取 3-5 个百分点的议价空间。`,
    detailedContentEn: `## Agroline Supply Contracts to 150 — Our Pricing Power Rises\n\n**Compare**: 8/26 158 → 9/2 150 (**-8, -5.1%**).\n\n### Key Observations\n- **Two consecutive destocking periods**: EU used forage harvester stock entering downward channel\n- **Scarcity building**: premium forming on our in-stock CLAAS units\n- **Pricing**: emphasize tightening supply to EU/RU buyers, hold quotes\n\n**Conclusion**: A supply inflection point has appeared. Build "EU inventory tightening" into customer messaging to win 3-5 pts of pricing room.`,
    detailedContentRu: `## Предложение Agroline сократилось до 150 — наша переговорная сила растёт\n\n**Сравнение**: 26.08 158 → 02.09 150 (**-8, -5.1%**).\n\n**Заключение**: Точка перелома предложения; использовать аргумент «сокращение складов в ЕС» в переговорах.`,
    actionTips: JSON.stringify([
      '将"欧洲供给收紧"纳入对欧/俄客户沟通话术',
      '对 CLAAS 在库机型坚持报价，不主动让价',
      '持续监控 Agroline，跌破 140 条触发提价预警'
    ]),
    dataSummary: 'Agroline 150条 | 较8/26 -8条(-5.1%) | 供给收缩',
    sortOrder: 3
  },
  // 4. MachineryPete
  {
    icon: '📉',
    region: '北美',
    regionEn: 'North America',
    regionRu: 'Северная Америка',
    tags: ['MachineryPete', '536条', '北美去库'],
    tagsEn: ['MachineryPete', '536 listings', 'NA destocking'],
    tagsRu: ['MachineryPete', '536 объявлений', 'сокращение в США'],
    text: 'MachineryPete 在售 CLAAS 降至 536 条（-12条，-2.2%），北美与欧洲同步去库',
    textEn: 'MachineryPete CLAAS listings drop to 536 (-12, -2.2%); North America destocks in sync with Europe',
    textRu: 'Объявления CLAAS на MachineryPete снизились до 536 (-12, -2.2%); сокращение в США синхронно с Европой',
    detailedContent: `## 北美同步去库 双平台供给共振收缩\n\n**对比**：8/26 548条 → 9/2 536条（**-12条，-2.2%**）。\n\n### 共振信号\n| 平台 | 8/26 | 9/02 | 变化 |\n|------|------|------|------|\n| Agroline（欧洲） | 158 | **150** | -5.1% |\n| MachineryPete（北美） | 548 | **536** | -2.2% |\n\n**结论**：两大主力市场同步去库，全球二手青贮机供给进入收缩周期，利好我方在库设备估值与出货节奏。`,
    detailedContentEn: `## NA Destocks in Sync — Dual-Platform Supply Resonance\n\n**Compare**: 8/26 548 → 9/2 536 (**-12, -2.2%**).\n\n| Platform | 8/26 | 9/02 | Change |\n|---|---|---|---|\n| Agroline (EU) | 158 | **150** | -5.1% |\n| MachineryPete (NA) | 548 | **536** | -2.2% |\n\n**Conclusion**: Both key markets destocking together; global used forage harvester supply enters a contraction cycle, favorable to our in-stock valuation and shipping pace.`,
    detailedContentRu: `## Синхронное сокращение складов в США\n\n**Сравнение**: 26.08 548 → 02.09 536 (**-12, -2.2%**).\n\n**Заключение**: Оба ключевых рынка сокращаются同步; мировое предложение входит в фазу сжатия.`,
    actionTips: JSON.stringify([
      '将双平台去库数据纳入对外报价支撑材料',
      '关注北美 990/970 型号价格是否随供给收缩上行',
      '维持每周平台在售量监控'
    ]),
    dataSummary: 'MachineryPete 536条 | -12条(-2.2%) | 双平台同步去库',
    sortOrder: 4
  },
  // 5. Jaguar 980 155.2%
  {
    icon: '🏆',
    region: '全球',
    regionEn: 'Global',
    regionRu: 'Глобально',
    tags: ['Jaguar 980', '155.2%', '套利冠军', 'Agroline'],
    tagsEn: ['Jaguar 980', '155.2%', 'top arbitrage', 'Agroline'],
    tagsRu: ['Jaguar 980', '155.2%', 'лучший арбитраж', 'Agroline'],
    text: 'CLAAS Jaguar 980（2016/3679h）套利率 155.2%，国内143万对国际挂牌365万，全仓第一',
    textEn: 'CLAAS Jaguar 980 (2016/3679h) leads with 155.2% spread: CNY 1.43M domestic cost vs CNY 3.65M international listing',
    textRu: 'CLAAS Jaguar 980 (2016/3679h) лидирует со спредом 155.2%: 1.43 млн юаней себестоимость против 3.65 млн котировки',
    detailedContent: `## Jaguar 980 套利率 155.2% 全仓第一\n\n### 套利拆解\n| 项目 | 数值 |\n|------|------|\n| 国内库存成本 | **143.0 万元** |\n| 国际挂牌（Agroline, DE） | **€461,438 ≈ 365.0 万元** |\n| 单台价差 | **+222.0 万元** |\n| 套利率 | **155.2%** |\n| 机况/工时 | 良 / 3,679h |\n\n### 敏感性\n即便按国际挂牌 **8折成交（292万）**，扣物流与关税约 17 万后仍有 **约 132 万毛利**。\n\n**结论**：优先排产整备，拍摄作业视频并上线国际站，作为本季旗舰主推。`,
    detailedContentEn: `## Jaguar 980 — 155.2% Spread, Portfolio #1\n\n### Breakdown\n| Item | Value |\n|---|---|\n| Domestic cost | **CNY 1.43M** |\n| Intl listing (Agroline, DE) | **EUR 461,438 ≈ CNY 3.65M** |\n| Unit spread | **+CNY 2.22M** |\n| Spread rate | **155.2%** |\n| Condition/hours | Good / 3,679h |\n\n### Sensitivity\nEven at a **20% discount (CNY 2.92M)**, after ~CNY 170k logistics and duty, gross profit remains **~CNY 1.32M**.\n\n**Conclusion**: Prioritize refurbishment, shoot working video, list on international site as this season's flagship.`,
    detailedContentRu: `## Jaguar 980 — спред 155.2%, №1 в портфеле\n\n| Показатель | Значение |\n|---|---|\n| Себестоимость | **1.43 млн юаней** |\n| Котировка (Agroline, DE) | **461 438 EUR ≈ 3.65 млн юаней** |\n| Спред | **+2.22 млн юаней** |\n| Ставка | **155.2%** |\n\n**Заключение**: Приоритетная подготовка, съёмка видео работы, размещение как флагман сезона.`,
    actionTips: JSON.stringify([
      '优先排产整备 Jaguar 980（2016），3日内完成',
      '拍摄作业视频并上线国际站与小程序',
      '向俄线/中亚客户重点推送该机型'
    ]),
    dataSummary: 'Jaguar 980(2016) | 143万→365万 | 套利率155.2% | 价差222万',
    sortOrder: 5
  },
  // 6. Jaguar 850
  {
    icon: '💎',
    region: '全球',
    regionEn: 'Global',
    regionRu: 'Глобально',
    tags: ['Jaguar 850', '147.2%', '资金周转', '引流款'],
    tagsEn: ['Jaguar 850', '147.2%', 'capital turnover', 'entry model'],
    tagsRu: ['Jaguar 850', '147.2%', 'оборот капитала', 'входная модель'],
    text: 'CLAAS Jaguar 850（2018）套利率 147.2%，成本仅80万，资金占用为冠军机型的56%，周转率最优',
    textEn: 'CLAAS Jaguar 850 (2018) at 147.2% spread with only CNY 800k cost — 56% of the top model\'s capital tie-up, best turnover',
    textRu: 'CLAAS Jaguar 850 (2018): спред 147.2% при себестоимости всего 800 тыс. юаней — 56% от капитала флагмана, лучший оборот',
    detailedContent: `## Jaguar 850 套利率 147.2% 资金周转最优\n\n### 套利拆解\n| 项目 | 数值 |\n|------|------|\n| 国内库存成本 | **80.0 万元** |\n| 国际挂牌（Agroline, DE） | **€250,000 ≈ 197.8 万元** |\n| 单台价差 | **+117.8 万元** |\n| 套利率 | **147.2%** |\n\n### 资金效率对比\n| 机型 | 成本 | 价差 | 资金回报倍数 |\n|------|------|------|-------------|\n| Jaguar 980(2016) | 143万 | 222万 | 1.55× |\n| **Jaguar 850(2018)** | **80万** | **117.8万** | **1.47×** |\n\n**结论**：850 资金占用低、周转快，是**新客户引流首单**的最佳选择。`,
    detailedContentEn: `## Jaguar 850 — 147.2% Spread, Best Capital Turnover\n\n### Breakdown\n| Item | Value |\n|---|---|\n| Domestic cost | **CNY 800k** |\n| Intl listing (Agroline, DE) | **EUR 250,000 ≈ CNY 1.978M** |\n| Unit spread | **+CNY 1.178M** |\n| Spread rate | **147.2%** |\n\n**Conclusion**: Low capital tie-up and fast turnover make the 850 the best **first deal for new customers**.`,
    detailedContentRu: `## Jaguar 850 — спред 147.2%, лучший оборот капитала\n\n| Показатель | Значение |\n|---|---|\n| Себестоимость | **800 тыс. юаней** |\n| Котировка | **250 000 EUR ≈ 1.978 млн юаней** |\n| Спред | **+1.178 млн юаней** |\n\n**Заключение**: Лучший выбор для **первой сделки с новым клиентом**.`,
    actionTips: JSON.stringify([
      '将 Jaguar 850（2018）作为新客户引流主推款',
      '对首次询盘客户优先报该机型，降低决策门槛',
      '测算批量出货的资金周转收益并向管理层报备'
    ]),
    dataSummary: 'Jaguar 850(2018) | 80万→197.8万 | 套利率147.2% | 资金占用低',
    sortOrder: 6
  },
  // 7. FR450 物流陷阱
  {
    icon: '⚠️',
    region: '全球',
    regionEn: 'Global',
    regionRu: 'Глобально',
    tags: ['FR450', '97.7%', '物流陷阱', '拼柜'],
    tagsEn: ['FR450', '97.7%', 'logistics trap', 'consolidation'],
    tagsRu: ['FR450', '97.7%', 'логистическая ловушка', 'сборный груз'],
    text: 'FR450 套利率97.7%看似可观，但价差绝对值仅10.8万，物流占比过高，必须拼柜才有利可图',
    textEn: 'FR450 shows a 97.7% spread but only CNY 108k absolute margin; logistics eats too much — consolidated shipping is mandatory to profit',
    textRu: 'FR450 показывает спред 97.7%, но абсолютная маржа лишь 108 тыс. юаней; логистика слишком дорога — нужен сборный груз',
    detailedContent: `## 警惕"高套利率低利润"陷阱：FR450 案例\n\n### 表面 vs 实际\n| 项目 | 数值 |\n|------|------|\n| 国内成本 | 11.0 万元 |\n| 国际挂牌 | 21.8 万元 |\n| 表观套利率 | **97.7%** |\n| 价差绝对值 | **仅 10.8 万元** |\n| 整柜物流+关税 | 约 7-9 万元 |\n| **整柜实际毛利** | **仅约 2-4 万元** |\n\n### 破解方式\n| 方案 | 物流成本 | 实际毛利 |\n|------|---------|---------|\n| 整柜单独发运 | 7-9万 | 2-4万 ⚠️ |\n| **拼柜/铁路拼车** | **3-4万** | **约 6-8万** ✅ |\n\n**结论**：小机型出口必须拼柜，否则"高套利率"只是账面幻觉。**这是全品类通用原则，不止 FR450。**`,
    detailedContentEn: `## Beware the "High Spread, Low Profit" Trap: FR450 Case\n\n### Surface vs Reality\n| Item | Value |\n|---|---|\n| Domestic cost | CNY 110k |\n| Intl listing | CNY 218k |\n| Apparent spread | **97.7%** |\n| Absolute margin | **only CNY 108k** |\n| FCL logistics + duty | ~CNY 70-90k |\n| **FCL real gross** | **only ~CNY 20-40k** |\n\n### Fix\n| Option | Logistics | Real gross |\n|---|---|---|\n| Full container | 70-90k | 20-40k ⚠️ |\n| **Consolidated/rail** | **30-40k** | **~60-80k** ✅ |\n\n**Conclusion**: Small machines must ship consolidated, otherwise a high spread is only a paper illusion. **A universal rule, not just FR450.**`,
    detailedContentRu: `## Осторожно: ловушка «высокий спред, низкая прибыль» — пример FR450\n\n| Показатель | Значение |\n|---|---|\n| Себестоимость | 110 тыс. юаней |\n| Котировка | 218 тыс. юаней |\n| Спред | **97.7%** |\n| Абсолютная маржа | **всего 108 тыс.** |\n| Логистика (полный контейнер) | ~70-90 тыс. |\n| **Реальная прибыль** | **20-40 тыс.** ⚠️ |\n\n**Заключение**: Мелкую технику отправлять только сборным грузом.`,
    actionTips: JSON.stringify([
      'FR450 出口必须走拼柜或铁路拼车，运费压到3-4万',
      '所有小机型报价前先做物流占比测算，避免账面套利幻觉',
      '建立"最低价差绝对值"门槛（建议≥15万）再做出口报价'
    ]),
    dataSummary: 'FR450 | 套利率97.7%但价差仅10.8万 | 须拼柜降本',
    sortOrder: 7
  },
  // 8. 970 双机
  {
    icon: '📦',
    region: '全球',
    regionEn: 'Global',
    regionRu: 'Глобально',
    tags: ['Jaguar 970', '55.3%', '双机同价', '2017/2021'],
    tagsEn: ['Jaguar 970', '55.3%', 'twin units', '2017/2021'],
    tagsRu: ['Jaguar 970', '55.3%', 'две единицы', '2017/2021'],
    text: '两台 Jaguar 970（2017与2021）同价入库163万，国际挂牌253.1万，套利率均55.3%，2021款车龄更优',
    textEn: 'Two Jaguar 970 units (2017 & 2021) both carried at CNY 1.63M vs CNY 2.531M listing, 55.3% spread each; the 2021 unit has the better age',
    textRu: 'Два Jaguar 970 (2017 и 2021) учтены по 1.63 млн юаней против котировки 2.531 млн, спред 55.3%; модель 2021 года моложе',
    detailedContent: `## Jaguar 970 双机同价 优先推 2021 款\n\n### 双机对照\n| 机型 | 年份 | 工时 | 国内成本 | 国际挂牌 | 套利率 |\n|------|------|------|---------|---------|--------|\n| Jaguar 970 | 2017 | 未录入 | 163.0万 | €320,000 ≈ 253.1万 | 55.3% |\n| **Jaguar 970** | **2021** | **2,965h** | **163.0万** | **€320,000 ≈ 253.1万** | **55.3%** |\n\n### 关键判断\n- 两机**入库成本相同**，但 2021 款车龄新 4 年、工时明确，**国际买家接受度与议价能力明显更强**\n- 建议**优先推 2021 款**，2017 款作为备选或搭配配件包出售\n\n**待办**：2017 款工时数据缺失，需补齐后重新定价。`,
    detailedContentEn: `## Twin Jaguar 970 — Push the 2021 Unit First\n\n### Comparison\n| Model | Year | Hours | Cost | Listing | Spread |\n|---|---|---|---|---|---|\n| Jaguar 970 | 2017 | N/A | 1.63M | EUR 320,000 ≈ 2.531M | 55.3% |\n| **Jaguar 970** | **2021** | **2,965h** | **1.63M** | **EUR 320,000 ≈ 2.531M** | **55.3%** |\n\n**Conclusion**: Same cost, but the 2021 unit is 4 years newer with clear hours — far better acceptance and pricing power. Push 2021 first; keep 2017 as backup or bundle with a parts package.\n\n**To-do**: 2017 unit lacks hour data — fill in, then re-price.`,
    detailedContentRu: `## Два Jaguar 970 — в первую очередь продвигать 2021 года\n\n| Модель | Год | Моточасы | Себестоимость | Котировка | Спред |\n|---|---|---|---|---|---|\n| Jaguar 970 | 2017 | нет данных | 1.63 млн | 320 000 EUR ≈ 2.531 млн | 55.3% |\n| **Jaguar 970** | **2021** | **2 965 ч** | **1.63 млн** | **320 000 EUR ≈ 2.531 млн** | **55.3%** |\n\n**Заключение**: При равной себестоимости модель 2021 года заметно привлекательнее.`,
    actionTips: JSON.stringify([
      '优先对外主推 2021 款（2,965h），2017 款作备选',
      '补齐 2017 款工时数据后重新定价',
      '可考虑 2017 款+配件包捆绑出售以提升性价比'
    ]),
    dataSummary: 'Jaguar 970 ×2 | 163万→253.1万 | 套利率55.3% | 优先2021款',
    sortOrder: 8
  },
  // 9. 倒挂机型
  {
    icon: '⛔',
    region: '中国',
    regionEn: 'China',
    regionRu: 'Китай',
    tags: ['倒挂', '5300RC', 'FR500', '转内销'],
    tagsEn: ['inverted spread', '5300RC', 'FR500', 'domestic pivot'],
    tagsRu: ['отрицательный спред', '5300RC', 'FR500', 'внутренний рынок'],
    text: '5300RC(-8.7%)、FR500(-14.1%) 国际挂牌低于国内成本，倒挂最深，应立即转国内渠道并停止出口报价',
    textEn: '5300RC (-8.7%) and FR500 (-14.1%) list below domestic cost — deepest inversion; pivot to domestic channels and stop export quotes',
    textRu: '5300RC (-8.7%) и FR500 (-14.1%) котируются ниже себестоимости — максимальная инверсия; перевести на внутренний рынок',
    detailedContent: `## 倒挂机型止损：转国内渠道\n\n### 倒挂清单\n| 机型 | 年份 | 国内成本 | 国际挂牌 | 套利率 |\n|------|------|---------|---------|--------|\n| New Holland 9080 | 2009 | 69.0万 | 68.9万 | -0.2% |\n| John Deere 8400 | 2016 | 68.0万 | 65.3万 | -4.0% |\n| **CLAAS 5300RC** | **2022** | **65.0万** | **59.3万** | **-8.7%** |\n| **New Holland FR500** | **2014** | **38.0万** | **32.6万** | **-14.1%** |\n\n### 判读\n- **5300RC（2022）为近新款方捆机**，国内溢价已高于欧洲，说明该型号国内市场热度和出价能力更强\n- **FR500（2014）倒挂 14.1%**，为全仓最深，出口必亏\n\n**结论**：立即停止这 4 款的对外出口报价，转入国内渠道主推；FR500 建议下调国内挂牌或捆绑配件包加速周转。`,
    detailedContentEn: `## Stop the Bleeding: Pivot Inverted Models to Domestic\n\n### Inversion List\n| Model | Year | Cost | Listing | Spread |\n|---|---|---|---|---|\n| New Holland 9080 | 2009 | 690k | 689k | -0.2% |\n| John Deere 8400 | 2016 | 680k | 653k | -4.0% |\n| **CLAAS 5300RC** | **2022** | **650k** | **593k** | **-8.7%** |\n| **New Holland FR500** | **2014** | **380k** | **326k** | **-14.1%** |\n\n**Conclusion**: Halt export quotes on these four; move to domestic channels. For FR500, cut the domestic asking price or bundle a parts package to speed turnover.`,
    detailedContentRu: `## Остановить убытки: перевести инверсные модели на внутренний рынок\n\n| Модель | Год | Себестоимость | Котировка | Спред |\n|---|---|---|---|---|\n| New Holland 9080 | 2009 | 690 тыс. | 689 тыс. | -0.2% |\n| John Deere 8400 | 2016 | 680 тыс. | 653 тыс. | -4.0% |\n| **CLAAS 5300RC** | **2022** | **650 тыс.** | **593 тыс.** | **-8.7%** |\n| **New Holland FR500** | **2014** | **380 тыс.** | **326 тыс.** | **-14.1%** |\n\n**Заключение**: Прекратить экспортные котировки по этим четырём позициям.`,
    actionTips: JSON.stringify([
      '立即停止 5300RC/FR500/9080/8400 的对外出口报价',
      '转入国内渠道主推，重新制定内销挂牌价',
      'FR500 建议捆绑配件包或小幅降价以加速周转'
    ]),
    dataSummary: '倒挂4款 | FR500 -14.1%最深 | 5300RC -8.7% | 转内销',
    sortOrder: 9
  },
  // 10. 数据覆盖率
  {
    icon: '🔍',
    region: '全球',
    regionEn: 'Global',
    regionRu: 'Глобально',
    tags: ['数据质量', '配对覆盖率', '10.2%', '抓取修复'],
    tagsEn: ['data quality', 'matching coverage', '10.2%', 'scraper fix'],
    tagsRu: ['качество данных', 'покрытие', '10.2%', 'исправление парсера'],
    text: '98台在库仅10台（10.2%）有国际比价基准；TractorHouse抓取停留4/30产生兜底重复值，需修复',
    textEn: 'Only 10 of 98 in-stock units (10.2%) have an international price benchmark; TractorHouse scraping stalled at 4/30 producing duplicate fallback values — needs fixing',
    textRu: 'Только 10 из 98 единиц (10.2%) имеют международный ценовой ориентир; парсер TractorHouse остановился на 30.04, выдавая дубли — требуется исправление',
    detailedContent: `## 数据覆盖与抓取质量告警\n\n### 现状\n| 指标 | 数值 |\n|------|------|\n| 在库设备总数 | 98 台 |\n| 有国际挂牌配对 | **10 台（10.2%）** |\n| 缺乏比价基准 | **88 台（89.8%）** |\n\n### 已知缺陷\n1. **TractorHouse 兜底值污染**：多条记录价格重复为 \\$35,862（≈26万），抓取日期停留在 2026-04-30，系反爬失败后的兜底值，本期套利计算已排除。\n2. **配对覆盖率过低**：88 台设备无国际比价基准，潜在套利机会无法识别。\n\n### 改进目标\n| 阶段 | 目标覆盖率 | 措施 |\n|------|-----------|------|\n| 短期（2周） | 30% | 修复 TractorHouse 抓取（住宅代理） |\n| 中期（1月） | 50% | 扩充 e-farm / Mascus 源与型号映射 |\n\n**结论**：数据覆盖是当前套利发现能力的最大瓶颈，优先级应提到与业务拓展同级。`,
    detailedContentEn: `## Data Coverage & Scraping Quality Alert\n\n### Status\n| Metric | Value |\n|---|---|\n| In-stock units | 98 |\n| With intl benchmark | **10 (10.2%)** |\n| Without benchmark | **88 (89.8%)** |\n\n### Known Defects\n1. **TractorHouse fallback pollution**: multiple records repeat \\$35,862 (~CNY 260k) with scrape date stuck at 2026-04-30 — fallback values after anti-bot failure; excluded from this period's arbitrage calc.\n2. **Low matching coverage**: 88 units lack any benchmark; potential arbitrage invisible.\n\n### Targets\n| Phase | Target | Action |\n|---|---|---|\n| Short (2 wks) | 30% | Fix TractorHouse scraping (residential proxy) |\n| Mid (1 mo) | 50% | Add e-farm/Mascus sources & model mapping |\n\n**Conclusion**: Data coverage is the biggest bottleneck to arbitrage discovery.`,
    detailedContentRu: `## Предупреждение о качестве данных и покрытии\n\n| Показатель | Значение |\n|---|---|\n| Всего единиц | 98 |\n| С ориентиром | **10 (10.2%)** |\n| Без ориентира | **88 (89.8%)** |\n\n**Заключение**: Покрытие данными — главное узкое место в поиске арбитража.`,
    actionTips: JSON.stringify([
      '修复 TractorHouse 抓取（配置住宅代理）或暂时下线该源',
      '扩充 Agroline/e-farm/Mascus 抓取与型号映射，目标覆盖50%+',
      '建立抓取失效告警，避免兜底值静默污染数据'
    ]),
    dataSummary: '配对覆盖10/98(10.2%) | TractorHouse兜底值污染 | 目标50%+',
    sortOrder: 10
  },
  // (ICP 备案长期有效、无到期日；原 "11. ICP 到期" 条目已于 2026-09-02 删除)

];

async function importIntelligence() {
  console.log(`[import-intelligence-${REPORT_DATE}] 开始执行...`);
  console.log(`情报数量：${intels.length}条`);

  try {
    const beforeCount = await prisma.marketIntel.count();
    console.log(`导入前情报总数：${beforeCount}条`);

    const startOfDay = new Date(REPORT_DATE + 'T00:00:00.000Z');
    const endOfDay = new Date(REPORT_DATE + 'T23:59:59.999Z');
    const deletedToday = await prisma.marketIntel.deleteMany({
      where: { date: { gte: startOfDay, lte: endOfDay } }
    });
    console.log(`清理同日情报：${deletedToday.count}条`);

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
