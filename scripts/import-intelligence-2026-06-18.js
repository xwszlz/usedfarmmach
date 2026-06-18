/**
 * 导入2026-06-18市场情报数据到数据库
 * 基于 2026-06-17_跨境套利日报.md 生成（当日日报尚未生成）
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const TODAY = new Date("2026-06-18");

const ALL_MARKET_INTEL = [
  // ===== sortOrder=0: 永久头条 — 纽荷兰5070小方捆 =====
  {
    icon: "🔥", region: "中国", regionEn: "China", regionRu: "Китай",
    tags: '["爆款","5070小方捆","12台库存"]',
    tagsEn: '["Hot Deal","5070 Baler","12 Units"]',
    tagsRu: '["Хит","5070 Пресс","12 ед."]',
    text: "纽荷兰5070小方捆·12台库存爆款！¥3.4万/台，海外$7,000+，利润58.8%，小方捆打捆机全球需求旺盛",
    textEn: "New Holland 5070 Small Square Baler·12 units! ¥34K/unit, overseas $7K+, 58.8% margin, global demand strong",
    textRu: "New Holland 5070 Малый тюковый пресс·12 ед! ¥34K/ед, зарубеж $7K+, 58.8% маржа, глобальный спрос высок",
    detailedContent: `## 🚜 纽荷兰5070小方捆 — 12台库存爆款\n\n**核心卖点：¥3.4万/台，海外$7,000+，利润58.8%**\n\n### 📊 价差分析\n| 指标 | 数值 |\n|------|------|\n| 国内售价 | ¥34,000/台 |\n| 海外参考价 | $7,000+（≈¥47,000+） |\n| 单台利润 | ¥13,000+ |\n| 利润率 | **58.8%** |\n| 库存 | **12台** |\n| 总利润空间 | ¥19万-32万 |\n\n### 🌍 目标市场推广策略\n| 区域 | 策略 | 优势 |\n|------|------|------|\n| 🌍 非洲 | 小型打捆机主力市场，性价比首选 | 价格仅为欧美新机1/5 |\n| 🌏 东南亚 | 水稻秸秆打捆需求旺盛 | 海运成本低，交货快 |\n| 🌏 中亚 | 牧场草料打捆刚需 | 铁路直达15-20天 |\n\n### 🔥 五大爆款理由\n1. **¥3.4万超低门槛** — 小型买家也能入手的爆款价格\n2. **全球小方捆需求旺盛** — 非洲/东南亚/中亚均大量需要\n3. **12台批量库存** — 可打包出口，降低单台物流成本\n4. **58.8%高利润率** — 比肩大型青储机的利润率\n5. **操作维护简单** — 不需要专业技术人员即可操作`,
    detailedContentEn: `## 🚜 New Holland 5070 Small Square Baler — 12 Units Hot Deal\n\n**Core Selling Point: ¥34K/unit, overseas $7K+, 58.8% margin**\n\n### 📊 Price Spread Analysis\n| Indicator | Value |\n|------|------|\n| Domestic Price | ¥34,000/unit |\n| Overseas Reference | $7,000+ (≈¥47,000+) |\n| Unit Profit | ¥13,000+ |\n| Profit Margin | **58.8%** |\n| Inventory | **12 units** |\n| Total Profit Potential | ¥190K-320K |\n\n### 🌍 Target Market Strategy\n| Region | Strategy | Advantage |\n|------|------|------|\n| 🌍 Africa | Primary market for small balers, best value | Only 1/5 price of new EU/US machinery |\n| 🌏 Southeast Asia | Strong rice straw baling demand | Low shipping cost, fast delivery |\n| 🌏 Central Asia | Pasture hay baling essential demand | Railway direct 15-20 days |\n\n### 🔥 Top 5 Reasons It's a Hit\n1. **¥34K ultra-low entry** — affordable for small buyers\n2. **Global small baler demand strong** — Africa/SE Asia/Central Asia all need\n3. **12 units bulk inventory** — batch export reduces per-unit logistics\n4. **58.8% high margin** — matches large forage harvester profitability\n5. **Simple operation** — no specialist training required`,
    detailedContentRu: `## 🚜 New Holland 5070 Малый тюковый пресс — 12 ед. Хит\n\n**Ключевое преимущество: ¥34K/ед, зарубеж $7K+, 58.8% маржа**\n\n### 📊 Анализ разницы цен\n| Показатель | Значение |\n|------|------|\n| Внутренняя цена | ¥34,000/ед |\n| Зарубежная справочная | $7,000+ (≈¥47,000+) |\n| Прибыль на ед. | ¥13,000+ |\n| Маржа | **58.8%** |\n| Остаток | **12 ед.** |\n| Общий потенциал прибыли | ¥190K-320K |\n\n### 🌍 Стратегия целевых рынков\n| Регион | Стратегия | Преимущество |\n|------|------|------|\n| 🌍 Африка | Основной рынок малых прессов | Всего 1/5 цены новой техники ЕС/США |\n| 🌏 Юго-Восточная Азия | Высокий спрос на прессовку рисовой соломы | Низкая стоимость доставки |\n| 🌏 Центральная Азия | Спрос на прессовку сена | Ж/д прямая доставка 15-20 дней |\n\n### 🔥 5 причин быть хитом\n1. **¥34K сверхнизкий порог** — доступно для мелких покупателей\n2. **Глобальный высокий спрос** — Африка/ЮВА/Центральная Азия\n3. **12 ед. оптом** — пакетный экспорт снижает логистику на ед.\n4. **58.8% высокая маржа** — на уровне крупных силосоуборочных\n5. **Простота эксплуатации** — не требует специального обучения`,
    actionTips: '["优先打包12台5070批量出口","制作英文/俄文/法文5070产品单页","Facebook农机群组重点推广","对接非洲/东南亚经销商批量拿货","可提供FOB天津/青岛报价"]',
    dataSummary: '[{"label":"国内售价","value":"¥3.4万/台"},{"label":"海外参考","value":"$7,000+"},{"label":"利润率","value":"58.8%"},{"label":"库存","value":"12台"},{"label":"总利润空间","value":"¥19-32万"}]',
  },

  // ===== sortOrder=1: 汇率情报 =====
  {
    icon: "💶", region: "欧洲", regionEn: "Europe", regionRu: "Европа",
    tags: '["汇率情报","7.8480"]',
    tagsEn: '["FX Update","7.8480"]',
    tagsRu: '["Валютная сводка","7.8480"]',
    text: "EUR/CNY 7.8480 (+0.18%回升)！欧元从7.8340小幅反弹，套利空间微扩，近两周7.82-7.86窄幅震荡",
    textEn: "EUR/CNY 7.8480 (+0.18% recovery)! Euro rebounds from 7.8340, arbitrage space slightly expands, narrow range 7.82-7.86 for two weeks",
    textRu: "EUR/CNY 7.8480 (+0.18% восстановление)! Евро отскочил от 7.8340, арбитражное пространство слегка расширилось, узкий диапазон 7.82-7.86 две недели",
    detailedContent: `## 💶 汇率情报：EUR/CNY 7.8480 小幅回升\n\n### 即时汇率（2026-06-17）\n| 货币对 | 牌价 | 日环比 |\n|--------|------|--------|\n| EUR/CNY | **7.8480** | **+0.18%**（vs 6月16日7.8340） |\n| USD/CNY | **6.7583** | **-0.01%**（基本持平） |\n| EUR/RUB | **84.18** | 基本持平 |\n\n### 趋势分析\n- 近两周EUR/CNY在7.82-7.86区间窄幅震荡，当前处于区间中上沿\n- **关键信号：欧元小幅回升，套利空间微扩**\n- 若突破7.90则全面利好出口定价\n\n### 套利影响\n| 机型 | 国际价(EUR) | 换算(7.8480) | vs 上期(7.8340) |\n|------|-----------|-------------|----------------|\n| 970(2019) €315,306 | 247.5万 | 247.0万 | +0.5万 |\n| 980(2016) €316,000 | 248.0万 | 247.5万 | +0.5万 |\n| 5300RC(2020) €99,900 | 78.4万 | 78.2万 | +0.2万 |\n\n> 欧元小幅回升0.18%整体利好出口定价，套利空间略扩`,
    detailedContentEn: `## 💶 FX Update: EUR/CNY 7.8480 Slight Recovery\n\n### Spot Rates (2026-06-17)\n| Pair | Rate | Daily Change |\n|--------|------|--------|\n| EUR/CNY | **7.8480** | **+0.18%** (vs Jun 16 7.8340) |\n| USD/CNY | **6.7583** | **-0.01%** (flat) |\n| EUR/RUB | **84.18** | flat |\n\n### Trend Analysis\n- Two-week range 7.82-7.86, currently at upper-middle of range\n- **Key signal: Euro slightly up, arbitrage space expands**\n- Breakout above 7.90 would fully benefit export pricing\n\n### Arbitrage Impact\n| Model | Intl Price (EUR) | Converted (7.8480) | vs Prev (7.8340) |\n|------|-----------|-------------|----------------|\n| 970(2019) €315,306 | 2.475M | 2.470M | +5K |\n| 980(2016) €316,000 | 2.480M | 2.475M | +5K |\n| 5300RC(2020) €99,900 | 784K | 782K | +2K |\n\n> Euro recovery of 0.18% overall benefits export pricing, slight arbitrage expansion`,
    detailedContentRu: `## 💶 Валютная сводка: EUR/CNY 7.8480 Небольшое восстановление\n\n### Спот-курсы (2026-06-17)\n| Пара | Курс | Изменение за день |\n|--------|------|--------|\n| EUR/CNY | **7.8480** | **+0.18%** (с 16 июня 7.8340) |\n| USD/CNY | **6.7583** | **-0.01%** (стабильно) |\n| EUR/RUB | **84.18** | стабильно |\n\n### Анализ тренда\n- Двухнедельный диапазон 7.82-7.86, сейчас в верхней середине\n- **Ключевой сигнал: евро немного вырос, арбитражное пространство расширилось**\n- Прорыв выше 7.90 полностью улучшит экспортное ценообразование\n\n### Влияние на арбитраж\n| Модель | Цена (EUR) | Конвертация (7.8480) | vs Пред (7.8340) |\n|------|-----------|-------------|----------------|\n| 970(2019) €315,306 | 2.475 млн | 2.470 млн | +5K |\n| 980(2016) €316,000 | 2.480 млн | 2.475 млн | +5K |\n| 5300RC(2020) €99,900 | 784K | 782K | +2K |\n\n> Восстановление евро на 0.18% в целом благоприятно для экспортных цен, небольшое расширение арбитража`,
    actionTips: '["若EUR/CNY突破7.90全面利好出口定价","利用欧元回升窗口加速锁定合同","EUR/RUB 84.18稳定利好俄罗斯市场定价"]',
    dataSummary: '[{"label":"EUR/CNY","value":"7.8480"},{"label":"日环比","value":"+0.18%"},{"label":"两周区间","value":"7.82-7.86"}]',
  },

  // ===== sortOrder=2: 970(2025)首次出现 =====
  {
    icon: "🆕", region: "欧洲", regionEn: "Europe", regionRu: "Европа",
    tags: '["970(2025)","首次出现"]',
    tagsEn: '["970(2025)","First Sighting"]',
    tagsRu: '["970(2025)","Первое появление"]',
    text: "🆕 970(2025)首次出现在售！579h波兰≈€500K→392.4万，970最新年款进入二手市场，渠道利润巨大",
    textEn: "🆕 970(2025) first time on market! 579h Poland ≈€500K→CNY 3.924M, latest 970 generation enters used market, huge channel profit",
    textRu: "🆕 970(2025) впервые на рынке! 579 моточасов Польша ≈€500K→3.924 млн юаней, новейшее поколение 970 на вторичном рынке, огромная прибыль",
    detailedContent: `## 🆕 970(2025)首次出现在售 — 关键信号\n\n**核心发现：** 579h波兰克热扎努夫，CLAAS POLSKA经销商出售，≈€500K(2,150,000 PLN)→392.4万元\n\n### 970系列价格全景\n| 年份 | 最低价(EUR) | 最高价(EUR) | 在售数 |\n|------|-----------|-----------|--------|\n| **2025 🆕** | **€500,000** | **€500,000** | **1台** |\n| 2024 | £284,371 | €440,000 | 3台 |\n| 2023 | €375,000 | €549,692 | 3台 |\n| 2022 | €390,900 | €473,600 | 3台 |\n| 2021 | €300,470 | €428,400 | 4台 |\n| 2020-2019 | €315,306 | €323,114 | 3台 |\n| 2018-2016 | €149,929 | 面议 | 3台 |\n| 2013-2009 | €64,960 | €185,000 | 5台 |\n\n### 战略意义\n1. **970最新年款(2025)进入二手市场** — 意味着新一代970流通加速\n2. **仅579h低工时** — 准新车况\n3. **波兰经销商** — 正规渠道可追溯\n4. **€500K价格锚点** — 验证970系列高保值性`,
    detailedContentEn: `## 🆕 970(2025) First Sighting — Key Signal\n\n**Core Finding:** 579h Krzyzanow, Poland, CLAAS POLSKA dealer, ≈€500K(2,150,000 PLN)→CNY 3.924M\n\n### 970 Series Price Panorama\n| Year | Low(EUR) | High(EUR) | Listed |\n|------|-----------|-----------|--------|\n| **2025 🆕** | **€500,000** | **€500,000** | **1 unit** |\n| 2024 | £284,371 | €440,000 | 3 units |\n| 2023 | €375,000 | €549,692 | 3 units |\n| 2022 | €390,900 | €473,600 | 3 units |\n| 2021 | €300,470 | €428,400 | 4 units |\n| 2020-2019 | €315,306 | €323,114 | 3 units |\n| 2018-2016 | €149,929 | POA | 3 units |\n| 2013-2009 | €64,960 | €185,000 | 5 units |\n\n### Strategic Significance\n1. **Latest 970(2025) enters used market** — new generation circulation accelerating\n2. **Only 579h low hours** — near-new condition\n3. **Polish dealer** — traceable formal channel\n4. **€500K price anchor** — validates 970 series high value retention`,
    detailedContentRu: `## 🆕 970(2025) Первое появление — Ключевой сигнал\n\n**Основная находка:** 579 моточасов Кшижанов, Польша, дилер CLAAS POLSKA, ≈€500K(2,150,000 PLN)→3.924 млн юаней\n\n### Ценовая панорама серии 970\n| Год | Мин.(EUR) | Макс.(EUR) | В продаже |\n|------|-----------|-----------|--------|\n| **2025 🆕** | **€500,000** | **€500,000** | **1 ед.** |\n| 2024 | £284,371 | €440,000 | 3 ед. |\n| 2023 | €375,000 | €549,692 | 3 ед. |\n| 2022 | €390,900 | €473,600 | 3 ед. |\n| 2021 | €300,470 | €428,400 | 4 ед. |\n| 2020-2019 | €315,306 | €323,114 | 3 ед. |\n| 2018-2016 | €149,929 | POA | 3 ед. |\n| 2013-2009 | €64,960 | €185,000 | 5 ед. |\n\n### Стратегическое значение\n1. **Новейший 970(2025) на вторичном рынке** — ускорение оборота нового поколения\n2. **Всего 579 моточасов** — почти новое состояние\n3. **Польский дилер** — отслеживаемый официальный канал\n4. **€500K ценовой якорь** — подтверждает высокое сохранение стоимости серии 970`,
    actionTips: '["关注970(2025)采购渠道获取同款","利用€500K锚点凸显2017款性价比","制作970全系列价格对比图推动买家决策"]',
    dataSummary: '[{"label":"970(2025)","value":"€500K→392.4万"},{"label":"工时","value":"579h"}]',
  },

  // ===== sortOrder=3: 970(2024,870h)准新低价 =====
  {
    icon: "💎", region: "欧洲", regionEn: "Europe", regionRu: "Европа",
    tags: '["970(2024)","准新低价","870h"]',
    tagsEn: '["970(2024)","Near-New","870h"]',
    tagsRu: '["970(2024)","Почти новый","870 моточасов"]',
    text: "🆕 970(2024, 870h)准新低价！£284,371→€328,815→258.1万，德国巴登-符腾堡，潜在58.6%价差率入榜！",
    textEn: "🆕 970(2024, 870h) near-new low price! £284,371→€328,815→CNY 2.581M, Baden-Württemberg Germany, potential 58.6% spread rate!",
    textRu: "🆕 970(2024, 870 моточасов) почти новый по низкой цене! £284,371→€328,815→2.581 млн юаней, Баден-Вюртемберг Германия, потенциал 58.6% разницы!",
    detailedContent: `## 🆕 970(2024, 870h)准新低价机\n\n**核心发现：** 德国巴登-符腾堡，CLAAS经销商出售，仅870h，£284,371→€328,815→258.1万元\n\n### 对比分析\n| 机型 | 价格 | 工时 | 性价比 |\n|------|------|------|--------|\n| **970(2024) 🆕** | **258.1万** | **870h** | ⭐⭐⭐⭐⭐ 最佳 |\n| 970(2025) | 392.4万 | 579h | ⭐⭐⭐⭐ |\n| 970(2024)法国 | 345.3万 | 1,377h | ⭐⭐⭐ |\n| 970(2017)国内 | 163万 | — | ⭐⭐⭐ |\n\n### 潜在价差\n- 若国内获取同款，870h准新车况\n- **潜在价差率58.6%**（vs 国内163万同款）\n- 建议联系德国巴登-符腾堡卖家`,
    detailedContentEn: `## 🆕 970(2024, 870h) Near-New Low Price\n\n**Core Finding:** Baden-Württemberg Germany, CLAAS dealer, only 870h, £284,371→€328,815→CNY 2.581M\n\n### Comparison\n| Model | Price | Hours | Value |\n|------|------|------|--------|\n| **970(2024) 🆕** | **CNY 2.581M** | **870h** | ⭐⭐⭐⭐⭐ Best |\n| 970(2025) | CNY 3.924M | 579h | ⭐⭐⭐⭐ |\n| 970(2024) France | CNY 3.453M | 1,377h | ⭐⭐⭐ |\n| 970(2017) Domestic | CNY 1.63M | — | ⭐⭐⭐ |\n\n### Potential Spread\n- If same model acquired domestically, 870h near-new condition\n- **Potential spread rate 58.6%** (vs domestic 970(2017) at CNY 1.63M)\n- Recommend contacting Baden-Württemberg seller`,
    detailedContentRu: `## 🆕 970(2024, 870 моточасов) Почти новый по низкой цене\n\n**Основная находка:** Баден-Вюртемберг, Германия, дилер CLAAS, всего 870 моточасов, £284,371→€328,815→2.581 млн юаней\n\n### Сравнение\n| Модель | Цена | Моточасы | Ценность |\n|------|------|------|--------|\n| **970(2024) 🆕** | **2.581 млн** | **870** | ⭐⭐⭐⭐⭐ Лучшая |\n| 970(2025) | 3.924 млн | 579 | ⭐⭐⭐⭐ |\n| 970(2024) Франция | 3.453 млн | 1,377 | ⭐⭐⭐ |\n| 970(2017) внутр. | 1.63 млн | — | ⭐⭐⭐ |\n\n### Потенциальная разница\n- При получении аналогичной модели в Китае, 870 моточасов почти новое состояние\n- **Потенциальная разница 58.6%** (сравнение с 970(2017) по 1.63 млн юаней)\n- Рекомендуется связаться с продавцом из Баден-Вюртемберга`,
    actionTips: '["联系德国巴登-符腾堡卖家获取报价","评估870h准新车采购+运费总成本","利用此价格锚点推进国内970(2017)销售"]',
    dataSummary: '[{"label":"970(2024)","value":"258.1万"},{"label":"工时","value":"870h"},{"label":"潜在价差","value":"58.6%"}]',
  },

  // ===== sortOrder=4: 5300RC(2020) 335.6%全品类第一 =====
  {
    icon: "🏆", region: "中国", regionEn: "China", regionRu: "Китай",
    tags: '["5300RC(2020)","335.6%","白菜价"]',
    tagsEn: '["5300RC(2020)","335.6%","Bargain"]',
    tagsRu: '["5300RC(2020)","335.6%","Дешёвка"]',
    text: "5300RC(2020)18万白菜价！国际€99,900→78.4万，价差60.4万(335.6%)全品类第一！需确认车况及出口可行性",
    textEn: "5300RC(2020) CNY 180K bargain! Intl €99,900→CNY 784K, spread CNY 604K (335.6%) #1 across all categories! Condition check needed",
    textRu: "5300RC(2020) 180 тыс. юаней дешёвка! Междун. €99,900→784 тыс., разница 604 тыс. (335.6%) №1 среди всех категорий! Нужна проверка состояния",
    detailedContent: `## 🏆 5300RC(2020) 335.6%价差率 — 全品类套利冠军\n\n**核心标的：** CLAAS Quadrant 5300RC(2020)，国际€99,900→78.4万 vs 国内仅18万元\n\n### 套利明细\n| 指标 | 数值 |\n|------|------|\n| 国际参考价 | €99,900（Agroline德国博克尔） |\n| 国际人民币价 | 78.4万 |\n| 国内售价 | **18万元** |\n| 价差 | **60.4万元** |\n| 价差率 | **335.6% ⭐⭐⭐⭐⭐** |\n| 排名 | **全品类第一** |\n\n### ⚠️ 注意事项\n- 18万价格需确认车况是否正常\n- 需确认该设备是否可出口\n- 若确认可用，利润空间60.4万为全品类最高\n\n### 5300系列市场背景\n- Agroline 33条5300系列在售，供给充裕\n- 价格区间€68,000-€190,393\n- 2022款国内95万全新，价差率仅19.9%`,
    detailedContentEn: `## 🏆 5300RC(2020) 335.6% Spread Rate — #1 Across All Categories\n\n**Core Target:** CLAAS Quadrant 5300RC(2020), Intl €99,900→CNY 784K vs Domestic only CNY 180K\n\n### Arbitrage Details\n| Indicator | Value |\n|------|------|\n| International Reference | €99,900 (Agroline Bockel Germany) |\n| International CNY | 784K |\n| Domestic Price | **CNY 180K** |\n| Spread | **CNY 604K** |\n| Spread Rate | **335.6% ⭐⭐⭐⭐⭐** |\n| Ranking | **#1 Across All Categories** |\n\n### ⚠️ Notes\n- Confirm condition of the CNY 180K unit\n- Verify export feasibility\n- If confirmed, CNY 604K profit potential is highest across all categories`,
    detailedContentRu: `## 🏆 5300RC(2020) 335.6% разницы — №1 среди всех категорий\n\n**Основная цель:** CLAAS Quadrant 5300RC(2020), €99,900→784 тыс. vs внутренние всего 180 тыс. юаней\n\n### Детали арбитража\n| Показатель | Значение |\n|------|------|\n| Международная ссылка | €99,900 (Agroline Бокель, Германия) |\n| Международная в юанях | 784K |\n| Внутренняя цена | **180K юаней** |\n| Разница | **604K юаней** |\n| Ставка разницы | **335.6% ⭐⭐⭐⭐⭐** |\n| Рейтинг | **№1 среди всех категорий** |\n\n### ⚠️ Примечания\n- Подтвердить состояние агрегата за 180K юаней\n- Проверить возможность экспорта\n- При подтверждении потенциал прибыли 604K юаней — самый высокий`,
    actionTips: '["紧急确认18万5300RC车况","评估出口可行性+物流成本","若确认有效立即优先推进出口流程"]',
    dataSummary: '[{"label":"国际价","value":"78.4万"},{"label":"国内价","value":"18万"},{"label":"价差率","value":"335.6%"},{"label":"排名","value":"全品类第一"}]',
  },

  // ===== sortOrder=5: FR450(101.4%) 10台爆款 =====
  {
    icon: "🇨🇳", region: "中国", regionEn: "China", regionRu: "Китай",
    tags: '["FR450爆款","101.4%","10台库存"]',
    tagsEn: '["FR450 Hot Seller","101.4%","10 Units"]',
    tagsRu: '["FR450 хит","101.4%","10 ед."]',
    text: "New Holland FR450(2013) 101.4%价差率！21.5万/台，10台库存走量爆款，汇率波动影响小利润确定性高",
    textEn: "New Holland FR450(2013) 101.4% spread rate! CNY 215K/unit, 10 units volume seller, low FX impact high profit certainty",
    textRu: "New Holland FR450(2013) 101.4% разницы! 215 тыс. юаней/ед., 10 ед. хит продаж, низкое влияние валют, высокая определённость прибыли",
    detailedContent: `## New Holland FR450 爆款速推\n\n**核心优势：** 一口价21.5万/台 + 101.4%价差率 + 10台库存\n\n### FR450套利分析\n| 指标 | 数值 |\n|------|------|\n| 国内售价 | 21.5万/台 |\n| 俄市场参考价 | 43.3万 |\n| 价差 | 21.8万/台 |\n| 价差率 | **101.4%** |\n| 库存 | **10台** |\n| 汇率敏感度 | 低（绝对价差小） |\n| 总利润空间 | **218万** |\n\n### 为什么是爆款？\n1. **101.4%价差率** → 翻倍利润\n2. **21.5万低门槛** → 买家决策快\n3. **10台库存** → 走量模式\n4. **汇率波动影响小** → 利润确定性高\n5. **俄罗斯需求旺盛** → EU制裁加速替代`,
    detailedContentEn: `## New Holland FR450 Hot Seller Push\n\n**Core Advantage:** Fixed price CNY 215K/unit + 101.4% spread rate + 10 units inventory\n\n### FR450 Arbitrage Analysis\n| Indicator | Value |\n|------|------|\n| Domestic Price | CNY 215K/unit |\n| Russian Market Ref | CNY 433K |\n| Spread per Unit | CNY 218K |\n| Spread Rate | **101.4%** |\n| Inventory | **10 units** |\n| FX Sensitivity | Low (small absolute spread) |\n| Total Profit | **CNY 2.18M** |\n\n### Why It's a Hit\n1. **101.4% spread rate** → Double profit\n2. **CNY 215K low barrier** → Fast buyer decisions\n3. **10 units inventory** → Volume model\n4. **Minimal FX impact** → High profit certainty\n5. **Strong Russian demand** → EU sanctions accelerate substitution`,
    detailedContentRu: `## New Holland FR450 Хит продаж\n\n**Главное преимущество:** Фиксированная цена 215 тыс. юаней/ед. + 101.4% разницы + 10 ед. на складе\n\n### Анализ арбитража FR450\n| Показатель | Значение |\n|------|------|\n| Внутренняя цена | 215 тыс. юаней/ед. |\n| Справочная цена РФ | 433 тыс. юаней |\n| Разница за ед. | 218 тыс. юаней |\n| Ставка разницы | **101.4%** |\n| Остаток | **10 ед.** |\n| Чувствительность к валютам | Низкая |\n| Общая прибыль | **2.18 млн юаней** |\n\n### Почему это хит\n1. **101.4% разницы** → двойная прибыль\n2. **215 тыс. низкий порог** → быстрое решение\n3. **10 ед. на складе** → объёмные продажи\n4. **Минимальное влияние валют** → высокая определённость\n5. **Высокий спрос в РФ** → санкции ЕС ускоряют замещение`,
    actionTips: '["FR450俄语区批量速推10台","21.5万低门槛吸引小型买家","瞄准俄罗斯+中亚FR系列需求买家"]',
    dataSummary: '[{"label":"FR450价差率","value":"101.4%"},{"label":"库存","value":"10台"},{"label":"单台利润","value":"21.8万"}]',
  },

  // ===== sortOrder=6: BP1290(2020) 97.1%打捆机冠军 =====
  {
    icon: "🌾", region: "欧洲", regionEn: "Europe", regionRu: "Европа",
    tags: '["BP1290","97.1%","打捆机冠军"]',
    tagsEn: '["BP1290","97.1%","Baler Champion"]',
    tagsRu: '["BP1290","97.1%","Чемпион прессов"]',
    text: "Krone BiG Pack 1290(2020)打捆机套利冠军！国际€170,765→134.0万 vs 国内68万，价差66.0万(97.1%)",
    textEn: "Krone BiG Pack 1290(2020) baler arbitrage champion! Intl €170,765→CNY 1.34M vs domestic CNY 680K, spread CNY 660K (97.1%)",
    textRu: "Krone BiG Pack 1290(2020) чемпион арбитража пресс-подборщиков! €170,765→1.34 млн vs внутренние 680 тыс., разница 660 тыс. (97.1%)",
    detailedContent: `## Krone BiG Pack 1290(2020) 打捆机套利冠军\n\n### 套利明细\n| 指标 | 数值 |\n|------|------|\n| 国际参考价 | €170,765（Agroline奥地利） |\n| 国际人民币价 | 134.0万 |\n| 国内售价 | **68万元** |\n| 价差 | **66.0万元** |\n| 价差率 | **97.1% ⭐⭐⭐⭐⭐** |\n| 排名 | **打捆机品类第一** |\n\n### BP1290系列在售情况\n| 年份 | 价格区间(EUR) | 数量 |\n|------|-------------|------|\n| 2024 | €200,000-€213,010 | 2台 |\n| 2022 | €222,171 | 1台 |\n| 2021 | €201,600 | 1台 |\n| **2020 🎯** | **€170,765** | **1台** |\n| 2018-2019 | €101,100-€115,000 | 2台 |\n| 2010-2016 | €30,627-€115,450 | 5台 |\n\n### 市场背景\n- 乌克兰渠道：基辅2024款€200,000、2021款€201,600\n- BP1290全球14条在售，价格€30,627-€222,171`,
    detailedContentEn: `## Krone BiG Pack 1290(2020) Baler Arbitrage Champion\n\n### Arbitrage Details\n| Indicator | Value |\n|------|------|\n| International Reference | €170,765 (Agroline Austria) |\n| International CNY | 1.34M |\n| Domestic Price | **CNY 680K** |\n| Spread | **CNY 660K** |\n| Spread Rate | **97.1% ⭐⭐⭐⭐⭐** |\n| Ranking | **Baler Category #1** |\n\n### BP1290 Series Availability\n| Year | Price Range (EUR) | Units |\n|------|-------------|------|\n| 2024 | €200,000-€213,010 | 2 |\n| 2022 | €222,171 | 1 |\n| 2021 | €201,600 | 1 |\n| **2020 🎯** | **€170,765** | **1** |\n| 2018-2019 | €101,100-€115,000 | 2 |\n| 2010-2016 | €30,627-€115,450 | 5 |\n\n### Market Background\n- Ukraine channel: Kyiv 2024 €200,000, 2021 €201,600\n- BP1290 globally 14 units listed, price €30,627-€222,171`,
    detailedContentRu: `## Krone BiG Pack 1290(2020) Чемпион арбитража пресс-подборщиков\n\n### Детали арбитража\n| Показатель | Значение |\n|------|------|\n| Международная ссылка | €170,765 (Agroline Австрия) |\n| Международная в юанях | 1.34 млн |\n| Внутренняя цена | **680 тыс. юаней** |\n| Разница | **660 тыс. юаней** |\n| Ставка разницы | **97.1% ⭐⭐⭐⭐⭐** |\n| Рейтинг | **Категория прессов №1** |\n\n### Доступность серии BP1290\n| Год | Ценовой диапазон (EUR) | Ед. |\n|------|-------------|------|\n| 2024 | €200,000-€213,010 | 2 |\n| 2022 | €222,171 | 1 |\n| 2021 | €201,600 | 1 |\n| **2020 🎯** | **€170,765** | **1** |\n| 2018-2019 | €101,100-€115,000 | 2 |\n| 2010-2016 | €30,627-€115,450 | 5 |\n\n### Рыночный контекст\n- Украинский канал: Киев 2024 €200,000, 2021 €201,600\n- BP1290 глобально 14 ед., цены €30,627-€222,171`,
    actionTips: '["BP1290东欧推量，66万利润空间为打捆机品类最高","利用乌克兰基辅BP1290渠道(€200K)拓展东欧买家","组合FR450+BP1290走量方案提升客单价"]',
    dataSummary: '[{"label":"BP1290价差","value":"66.0万(97.1%)"},{"label":"品类排名","value":"打捆机第一"}]',
  },

  // ===== sortOrder=7: 980(2016) 73.1%套利王 =====
  {
    icon: "📊", region: "中国", regionEn: "China", regionRu: "Китай",
    tags: '["980套利王","73.1%","104.5万"]',
    tagsEn: '["980 Arbitrage King","73.1%","CNY 1.045M"]',
    tagsRu: '["980 Арбитраж","73.1%","1.045 млн"]',
    text: "Jaguar 980(2016)持续稳居套利王！国际€316K→247.5万 vs 国内143万，价差104.5万(73.1%)，新增2台2024面议",
    textEn: "Jaguar 980(2016) remains arbitrage king! Intl €316K→CNY 2.475M vs domestic CNY 1.43M, spread CNY 1.045M (73.1%), 2x 2024 units POA",
    textRu: "Jaguar 980(2016) остаётся королём арбитража! €316K→2.475 млн vs внутренние 1.43 млн, разница 1.045 млн (73.1%), 2 ед. 2024 цена по запросу",
    detailedContent: `## Jaguar 980(2016) 套利王分析\n\n### 套利对比\n| 机型 | 国际价 | 国内价 | 价差 | 价差率 |\n|------|--------|--------|------|--------|\n| **980(2016)** | 247.5万 | 143万 | **104.5万** | **73.1%** ⭐⭐⭐⭐⭐ |\n| 980(2015)抵押 | 247.5万 | 130万 | 117.5万 | 90.4% |\n| 980(2025)天花板 | 417.9万 | — | — | — |\n| 980(2024)面议×2 | 面议 | — | — | 🆕新增 |\n\n### 980系列最新在售\n| 年份 | 价格(EUR) | 人民币 | 所在地 |\n|------|-----------|--------|--------|\n| **2025** | **€532,500** | **417.9万** | 德国博克尔 |\n| 2024(T4/E5) | 面议 (×2) | — | 德国兰茨贝格 🆕 |\n| 2023(4WD) | €378,426 | 297.0万 | 德国汉堡 |\n| 2022 | €461,400 | 362.1万 | 德国汉堡 |\n| **2016 🎯** | **€316K** | **248.0万** | — |\n| 2014 | €216,500 | 169.9万 | 德国昆德 |\n\n> 980系列供给增加：2025天花板€532.5K + 2台2024面议`,
    detailedContentEn: `## Jaguar 980(2016) Arbitrage King Analysis\n\n### Arbitrage Comparison\n| Model | Intl Price | Domestic | Spread | Rate |\n|------|--------|--------|------|--------|\n| **980(2016)** | CNY 2.475M | CNY 1.43M | **CNY 1.045M** | **73.1%** ⭐⭐⭐⭐⭐ |\n| 980(2015) mtg | CNY 2.475M | CNY 1.30M | CNY 1.175M | 90.4% |\n| 980(2025) ceiling | CNY 4.179M | — | — | — |\n| 980(2024) POA×2 | POA | — | — | 🆕 New |\n\n### 980 Series Latest Listings\n| Year | Price (EUR) | CNY | Location |\n|------|-----------|--------|--------|\n| **2025** | **€532,500** | **4.179M** | Bockel, Germany |\n| 2024(T4/E5) | POA (×2) | — | Landsberg, Germany 🆕 |\n| 2023(4WD) | €378,426 | 2.970M | Hamburg, Germany |\n| 2022 | €461,400 | 3.621M | Hamburg, Germany |\n| **2016 🎯** | **€316K** | **2.480M** | — |\n| 2014 | €216,500 | 1.699M | Kunde, Germany |`,
    detailedContentRu: `## Jaguar 980(2016) Анализ короля арбитража\n\n### Сравнение арбитража\n| Модель | Междун. | Внутр. | Разница | Ставка |\n|------|--------|--------|------|--------|\n| **980(2016)** | 2.475 млн | 1.43 млн | **1.045 млн** | **73.1%** ⭐⭐⭐⭐⭐ |\n| 980(2015) | 2.475 млн | 1.30 млн | 1.175 млн | 90.4% |\n| 980(2025) потолок | 4.179 млн | — | — | — |\n| 980(2024) POA×2 | POA | — | — | 🆕 |\n\n### Последние предложения 980\n| Год | Цена (EUR) | Юани | Место |\n|------|-----------|--------|--------|\n| **2025** | **€532,500** | **4.179 млн** | Бокель, Германия |\n| 2024(T4/E5) | POA (×2) | — | Ландсберг, Германия 🆕 |\n| 2023(4WD) | €378,426 | 2.970 млн | Гамбург |\n| 2022 | €461,400 | 3.621 млн | Гамбург |\n| **2016 🎯** | **€316K** | **2.480 млн** | — |\n| 2014 | €216,500 | 1.699 млн | Кунде |`,
    actionTips: '["980俄语区重点推，73.1%稳定高利润","利用980(2025)€532K天花板锚定高端客户","紧追2台980(2024)面议争取低于€400K报价"]',
    dataSummary: '[{"label":"980价差","value":"104.5万(73.1%)"},{"label":"980(2025)","value":"€532.5K"}]',
  },

  // ===== sortOrder=8: 俄罗斯制裁 =====
  {
    icon: "🇷🇺", region: "俄罗斯", regionEn: "Russia", regionRu: "Россия",
    tags: '["EU制裁","替代窗口","5%关税"]',
    tagsEn: '["EU Sanctions","Substitution","5% Tariff"]',
    tagsRu: '["Санкции ЕС","Замена","5% пошлина"]',
    text: "EU第20轮制裁持续发酵！欧美配件断供加剧，中国设备替代窗口扩大。俄农机排2026优先产业第一，5%低关税+补贴",
    textEn: "EU 20th round sanctions escalating! Western parts supply disrupted, Chinese equipment substitution window expands. Russian agri-machinery ranked #1 priority industry for 2026, 5% low tariff + subsidies",
    textRu: "20-й раунд санкций ЕС усиливается! Перебои с запчастями из Европы и США, окно замещения китайским оборудованием расширяется. Сельхозмашиностроение РФ №1 в 2026, 5% пошлина + субсидии",
    detailedContent: `## 🇷🇺 俄罗斯市场 — EU制裁替代窗口持续扩大\n\n### 制裁影响\n| 维度 | 影响 | 神雕机会 |\n|------|------|---------|\n| 欧美配件断供 | CLAAS/Deere/Kubota配件中断加剧 | 配件供应承诺成核心卖点 |\n| 金融制裁 | SWIFT+信用证受限 | CIPS人民币结算可行 |\n| 物流 | 中俄铁路正常 | 30-40天到货 |\n| 关税 | 5%低关税（优先产业） | 成本优势明显 |\n| 政府补贴 | 农机采购50%补贴 | 融资方案灵活 |\n\n### 核心数据\n| 指标 | 数值 |\n|------|------|\n| 2026年优先级 | **农机排第一** |\n| 关税 | **5%**（优惠税率） |\n| 政府补贴 | 农机购置补贴50% |\n| EUR/RUB | 84.18（稳定） |\n| 替代窗口 | **持续扩大** |\n\n### 推荐机型\n- CLAAS 970(2017) — 51.8%价差率，青储机首选\n- FR450(2013) 10台 — 101.4%价差率，走量爆款\n- BP1290(2020) — 97.1%价差率，打捆机强力需求`,
    detailedContentEn: `## 🇷🇺 Russia — EU Sanctions Substitution Window Expanding\n\n### Sanctions Impact\n| Dimension | Impact | ShenDiao Opportunity |\n|------|------|---------|\n| Western parts disruption | CLAAS/Deere/Kubota parts increasingly cut | Parts supply commitment as core selling point |\n| Financial sanctions | SWIFT+L/C restricted | CIPS RMB settlement viable |\n| Logistics | China-Russia rail normal | 30-40 day delivery |\n| Tariff | 5% low (priority industry) | Clear cost advantage |\n| Government subsidies | 50% machinery subsidy | Flexible financing |\n\n### Core Data\n| Indicator | Value |\n|------|------|\n| 2026 Priority | **Agri-machinery #1** |\n| Tariff | **5%** (preferential) |\n| Gov subsidy | 50% machinery subsidy |\n| EUR/RUB | 84.18 (stable) |\n| Substitution window | **Expanding** |\n\n### Recommended Models\n- CLAAS 970(2017) — 51.8% spread, forage harvester #1 choice\n- FR450(2013) 10 units — 101.4% spread, volume seller\n- BP1290(2020) — 97.1% spread, strong baler demand`,
    detailedContentRu: `## 🇷🇺 Россия — Окно замещения из-за санкций ЕС расширяется\n\n### Влияние санкций\n| Измерение | Влияние | Возможность Шэньдяо |\n|------|------|---------|\n| Перебои с запчастями | Прекращение поставок CLAAS/Deere/Kubota | Обещание поставок запчастей как ключевое преимущество |\n| Финансовые санкции | SWIFT+аккредитивы ограничены | Расчёты CIPS в юанях возможны |\n| Логистика | Ж/д Китай-РФ нормально | 30-40 дней доставки |\n| Пошлина | 5% (приоритетная отрасль) | Явное ценовое преимущество |\n| Госсубсидии | 50% субсидия на технику | Гибкое финансирование |\n\n### Основные данные\n| Показатель | Значение |\n|------|------|\n| Приоритет 2026 | **Сельхозмашиностроение №1** |\n| Пошлина | **5%** (льготная) |\n| Госсубсидия | 50% на покупку техники |\n| EUR/RUB | 84.18 (стабильно) |\n| Окно замещения | **Расширяется** |\n\n### Рекомендуемые модели\n- CLAAS 970(2017) — разница 51.8%\n- FR450(2013) 10 ед. — разница 101.4%\n- BP1290(2020) — разница 97.1%`,
    actionTips: '["俄语区主推970+FR450+BP1290三大标的","提供俄语说明书+配件供应承诺增强信任","利用5%低关税+50%补贴政策设计融资方案"]',
    dataSummary: '[{"label":"俄农机优先级","value":"2026第一"},{"label":"关税","value":"5%"},{"label":"补贴","value":"50%"}]',
  },

  // ===== sortOrder=9: 乌兹别克+256.77% =====
  {
    icon: "🇺🇿", region: "乌兹别克斯坦", regionEn: "Uzbekistan", regionRu: "Узбекистан",
    tags: '["增速最快","+256%","棉花采收"]',
    tagsEn: '["Fastest","+256%","Cotton"]',
    tagsRu: '["Самый быстрый","+256%","Хлопок"]',
    text: "乌兹别克斯坦Q1进口增长256.77%全球最快！棉花采收机械化率<40%，中吉乌铁路加速建设中，50%政府补贴",
    textEn: "Uzbekistan Q1 import growth 256.77% globally fastest! Cotton harvest mechanization <40%, China-Kyrgyzstan-Uzbekistan railway accelerating, 50% gov subsidy",
    textRu: "Узбекистан рост импорта Q1 256.77% — самый быстрый в мире! Механизация хлопкоуборки <40%, ж/д Китай-Кыргызстан-Узбекистан ускоряется, 50% госсубсидия",
    detailedContent: `## 🇺🇿 乌兹别克斯坦市场持续爆发\n\n### 核心数据\n| 指标 | 数值 |\n|------|------|\n| Q1进口增速 | **+256.77%** 全球最快 |\n| 棉花采收机械化率 | 不足40% |\n| 政府补贴 | 农机购置补贴50% |\n| 物流 | 中吉乌铁路建设加速 |\n| 新疆农机展 | 确认需求旺盛 |\n\n### 推荐机型\n| 品类 | 推荐 | 价格 |\n|------|------|------|\n| 青储收获机 | CLAAS 830/850/860 | 60-120万 |\n| 拖拉机 | NH/Deere 100-200HP | 30-80万 |\n| 打捆机 | Krone 500/600 | 15-40万 |\n\n### 行动重点\n- 重点关注棉花采收相关机型\n- 利用政府50%补贴设计融资方案\n- 中吉乌铁路建成后物流更便捷\n- 乌兹别克语+俄语版产品手册优先制作`,
    detailedContentEn: `## 🇺🇿 Uzbekistan Market Continues to Surge\n\n### Core Data\n| Indicator | Value |\n|------|------|\n| Q1 Import Growth | **+256.77%** globally fastest |\n| Cotton Harvest Mechanization | <40% |\n| Government Subsidy | 50% machinery purchase subsidy |\n| Logistics | China-Kyrgyzstan-Uzbekistan railway accelerating |\n| Xinjiang Expo | Demand confirmed strong |\n\n### Recommended Models\n| Category | Recommend | Price |\n|------|------|------|\n| Forage Harvesters | CLAAS 830/850/860 | CNY 600K-1.2M |\n| Tractors | NH/Deere 100-200HP | CNY 300K-800K |\n| Balers | Krone 500/600 | CNY 150K-400K |\n\n### Action Focus\n- Focus on cotton harvesting related models\n- Design financing using 50% gov subsidy\n- Railway completion will improve logistics\n- Uzbek + Russian product brochures priority`,
    detailedContentRu: `## 🇺🇿 Рынок Узбекистана продолжает бурный рост\n\n### Основные данные\n| Показатель | Значение |\n|------|------|\n| Рост импорта Q1 | **+256.77%** самый быстрый в мире |\n| Механизация хлопкоуборки | <40% |\n| Госсубсидия | 50% на покупку техники |\n| Логистика | Ж/д Китай-Кыргызстан-Узбекистан ускоряется |\n| Выставка в Синьцзяне | Спрос подтверждён |\n\n### Рекомендуемые модели\n| Категория | Рекомендация | Цена |\n|------|------|------|\n| Силосоуборочные | CLAAS 830/850/860 | 600K-1.2 млн |\n| Тракторы | NH/Deere 100-200 л.с. | 300K-800K |\n| Пресс-подборщики | Krone 500/600 | 150K-400K |\n\n### Основные действия\n- Акцент на модели для хлопкоуборки\n- Финансовые решения с 50% госсубсидией\n- После ж/д логистика станет удобнее`,
    actionTips: '["乌兹别克语+俄语版产品手册优先制作","棉花采收机型重点推广","50%政府补贴融资方案吸引买家"]',
    dataSummary: '[{"label":"Q1增速","value":"+256.77%"},{"label":"补贴","value":"50%"},{"label":"机械化率","value":"<40%"}]',
  },

  // ===== sortOrder=10: 非洲+东南亚 =====
  {
    icon: "🌍", region: "全球", regionEn: "Global", regionRu: "Глобально",
    tags: '["非洲","东南亚","新兴市场"]',
    tagsEn: '["Africa","SE Asia","Emerging Markets"]',
    tagsRu: '["Африка","ЮВА","Развивающиеся рынки"]',
    text: "全球新兴市场多点爆发！肯尼亚+46.6%、印尼+121.07%、巴西进口替代加速+NAMPO展后需求持续释放",
    textEn: "Global emerging markets multi-point explosion! Kenya +46.6%, Indonesia +121.07%, Brazil import substitution accelerating + post-NAMPO demand continued release",
    textRu: "Глобальные развивающиеся рынки — взрывной рост! Кения +46.6%, Индонезия +121.07%, Бразилия ускорение импортозамещения + спрос после NAMPO",
    detailedContent: `## 🌍 全球新兴市场全景\n\n### 区域爆发数据\n| 区域 | 增速 | 主力需求 | 机会等级 |\n|------|------|---------|---------|\n| 🇮🇩 印尼 | **+121.07%** | 小型拖拉机/收割机 | ⭐⭐⭐⭐⭐ |\n| 🇰🇪 肯尼亚 | **+46.6%** | 50-100HP拖拉机 | ⭐⭐⭐⭐ |\n| 🇧🇷 巴西 | -13.1%(触底) | 5300RC/进口替代 | ⭐⭐⭐⭐ |\n| 🌍 非洲NAMPO | 展后持续 | 中型/大型农机 | ⭐⭐⭐ |\n\n### 各市场策略\n| 市场 | 推荐策略 | 主推机型 |\n|------|---------|---------|\n| 印尼 | 小型农机+本地语资料 | 5070小方捆/50HP拖拉机 |\n| 肯尼亚 | 50-100HP拖拉机组合 | FR450/二手拖拉机 |\n| 巴西 | 5300RC+关税审批 | 5300RC(2022)全新 |\n| 非洲大陆 | 自贸区关税优惠 | 二手农机性价比方案 |\n\n### 共同趋势\n- 中国二手农机=欧美新品20-30%价格\n- 新兴市场对性价比敏感\n- 本地化（语言/售后）是关键差异化`,
    detailedContentEn: `## 🌍 Global Emerging Markets Panorama\n\n### Regional Surge Data\n| Region | Growth | Primary Demand | Opportunity |\n|------|------|---------|---------|\n| 🇮🇩 Indonesia | **+121.07%** | Small tractors/harvesters | ⭐⭐⭐⭐⭐ |\n| 🇰🇪 Kenya | **+46.6%** | 50-100HP tractors | ⭐⭐⭐⭐ |\n| 🇧🇷 Brazil | -13.1% (bottoming) | 5300RC/import substitution | ⭐⭐⭐⭐ |\n| 🌍 Africa NAMPO | Post-exhibition | Medium/large machinery | ⭐⭐⭐ |\n\n### Market Strategies\n| Market | Strategy | Key Models |\n|------|---------|---------|\n| Indonesia | Small machinery + local language | 5070 baler/50HP tractor |\n| Kenya | 50-100HP tractor bundles | FR450/used tractors |\n| Brazil | 5300RC + tariff approval | 5300RC(2022) brand new |\n| Africa | FTA tariff advantages | Used machinery value |\n\n### Common Trends\n- Chinese used machinery = 20-30% of EU new prices\n- Emerging markets price-sensitive\n- Localization (language/after-sales) is key differentiator`,
    detailedContentRu: `## 🌍 Глобальная панорама развивающихся рынков\n\n### Данные регионального роста\n| Регион | Рост | Основной спрос | Возможность |\n|------|------|---------|---------|\n| 🇮🇩 Индонезия | **+121.07%** | Малые тракторы/комбайны | ⭐⭐⭐⭐⭐ |\n| 🇰🇪 Кения | **+46.6%** | Тракторы 50-100 л.с. | ⭐⭐⭐⭐ |\n| 🇧🇷 Бразилия | -13.1% (дно) | 5300RC/импортозамещение | ⭐⭐⭐⭐ |\n| 🌍 Африка NAMPO | После выставки | Средняя/крупная техника | ⭐⭐⭐ |\n\n### Стратегии по рынкам\n| Рынок | Стратегия | Модели |\n|------|---------|---------|\n| Индонезия | Малая техника + местный язык | 5070/50 л.с. |\n| Кения | Тракторы 50-100 л.с. | FR450/б/у тракторы |\n| Бразилия | 5300RC + одобрение пошлины | 5300RC(2022) новый |\n| Африка | Преимущества ЗСТ | Б/у техника |\n\n### Общие тренды\n- Китайская б/у техника = 20-30% цены новой в ЕС\n- Развивающиеся рынки чувствительны к цене\n- Локализация — ключевое отличие`,
    actionTips: '["印尼+肯尼亚双线推进小型农机和拖拉机","巴西5300RC出口提前完成MAPA审批","利用非洲自贸区关税优惠扩大出口"]',
    dataSummary: '[{"label":"印尼","value":"+121.07%"},{"label":"肯尼亚","value":"+46.6%"},{"label":"巴西","value":"进口替代加速"}]',
  },

  // ===== sortOrder=11: 操作建议 =====
  {
    icon: "🔄", region: "中国", regionEn: "China", regionRu: "Китай",
    tags: '["操作建议","10大优先"]',
    tagsEn: '["Action Plan","10 Priorities"]',
    tagsRu: '["План действий","10 приоритетов"]',
    text: "今日10大操作：970推进出口(51.8%)→FR450爆款速推(101.4%)→BP1290东欧(97.1%)→5300RC白菜价→980俄语区→关注970(2025)渠道",
    textEn: "Today's 10 priorities: 970 export push(51.8%)→FR450 hot seller(101.4%)→BP1290 E.Europe(97.1%)→5300RC bargain→980 Russia→970(2025) channel",
    textRu: "10 приоритетов: 970 экспорт(51.8%)→FR450 хит(101.4%)→BP1290 В.Европа(97.1%)→5300RC дешёвка→980 РФ→970(2025) канал",
    detailedContent: `## 🔄 今日10大操作优先级\n\n| 优先级 | 操作 | 价差率 | 紧迫度 |\n|--------|------|--------|--------|\n| 1 | **970(2017)加速出口** 51.8%价差(84.5万利润) | 51.8% | 🔴 最急 |\n| 2 | **FR450爆款10台速推** 101.4%走量 | 101.4% | 🔴 最急 |\n| 3 | **BP1290东欧推量** 97.1%(66.0万利润) | 97.1% | 🔴 最急 |\n| 4 | **5300RC(2020)白菜价** 确认车况+出口可行性 | 335.6% | 🔴 最急 |\n| 5 | **980俄语区推** 73.1%稳定利润 | 73.1% | 🟡 高 |\n| 6 | **🆕关注970(2025)渠道** €500K波兰采购 | — | 🟡 高 |\n| 7 | **🆕970(2024,870h)准新** 联系德国卖家 | 58.6% | 🟡 高 |\n| 8 | **🆕980(2024)面议×2** 低于€400K报价 | — | 🟡 高 |\n| 9 | **950(2018)新机会** 44.5%(42.3万利润) | 44.5% | 🟢 中 |\n| 10 | **BigM 420东欧推进** 60.2%价差率 | 60.2% | 🟢 中 |\n\n### 关键时间节点\n- **本周内**：完成970出口+FR450至少各1单\n- **7月**：AGRO 2026乌克兰展前布局\n- **持续**：关注EUR/CNY 7.90突破信号`,
    detailedContentEn: `## 🔄 Today's 10 Action Priorities\n\n| Priority | Action | Spread Rate | Urgency |\n|--------|------|--------|--------|\n| 1 | **970(2017) accelerate export** 51.8% (CNY 845K profit) | 51.8% | 🔴 Most urgent |\n| 2 | **FR450 hot seller push** 101.4% volume | 101.4% | 🔴 Most urgent |\n| 3 | **BP1290 E.Europe push** 97.1% (CNY 660K profit) | 97.1% | 🔴 Most urgent |\n| 4 | **5300RC(2020) bargain** check condition + export | 335.6% | 🔴 Most urgent |\n| 5 | **980 Russia region** 73.1% stable profit | 73.1% | 🟡 High |\n| 6 | **🆕 Track 970(2025) channel** €500K Poland | — | 🟡 High |\n| 7 | **🆕 970(2024,870h) near-new** contact DE seller | 58.6% | 🟡 High |\n| 8 | **🆕 980(2024) POA×2** bid <€400K | — | 🟡 High |\n| 9 | **950(2018) new opportunity** 44.5%(CNY 423K) | 44.5% | 🟢 Medium |\n| 10 | **BigM 420 E.Europe push** 60.2% spread | 60.2% | 🟢 Medium |\n\n### Key Milestones\n- **This week**: Complete at least 1 unit each for 970 export + FR450\n- **July**: AGRO 2026 Ukraine exhibition preparation\n- **Ongoing**: Watch EUR/CNY 7.90 breakout signal`,
    detailedContentRu: `## 🔄 10 приоритетов действий на сегодня\n\n| Приоритет | Действие | Разница | Срочность |\n|--------|------|--------|--------|\n| 1 | **970(2017) ускорить экспорт** 51.8% (845K прибыли) | 51.8% | 🔴 Самое срочное |\n| 2 | **FR450 хит 10 ед.** 101.4% | 101.4% | 🔴 Самое срочное |\n| 3 | **BP1290 В.Европа** 97.1% (660K прибыли) | 97.1% | 🔴 Самое срочное |\n| 4 | **5300RC(2020) дешёвка** проверить состояние | 335.6% | 🔴 Самое срочное |\n| 5 | **980 регион РФ** 73.1% стабильная прибыль | 73.1% | 🟡 Высокая |\n| 6 | **🆕 970(2025) канал** €500K Польша | — | 🟡 Высокая |\n| 7 | **🆕 970(2024,870h)** связаться с продавцом DE | 58.6% | 🟡 Высокая |\n| 8 | **🆕 980(2024) POA×2** предложить <€400K | — | 🟡 Высокая |\n| 9 | **950(2018)** 44.5%(423K прибыли) | 44.5% | 🟢 Средняя |\n| 10 | **BigM 420 В.Европа** 60.2% | 60.2% | 🟢 Средняя |\n\n### Ключевые вехи\n- **На этой неделе**: завершить минимум по 1 ед. 970 + FR450\n- **Июль**: подготовка к AGRO 2026 Украина\n- **Постоянно**: следить за прорывом EUR/CNY 7.90`,
    actionTips: '["970+FR450+BP1290三条线并行推进","5300RC(2020)白菜价优先确认车况","本周完成至少1单970出口+1单FR450"]',
    dataSummary: '[{"label":"操作总数","value":"10条"},{"label":"最优先","value":"970/FR450/BP1290/5300RC"}]',
  },
];

async function main() {
  // 先清空旧数据
  await prisma.marketIntel.deleteMany();
  console.log("已清空旧数据");

  // 导入新数据
  for (let i = 0; i < ALL_MARKET_INTEL.length; i++) {
    const item = ALL_MARKET_INTEL[i];
    const sortOrder = item.sortOrder !== undefined ? item.sortOrder : i;
    await prisma.marketIntel.create({
      data: {
        date: TODAY,
        icon: item.icon,
        region: item.region,
        regionEn: item.regionEn || null,
        regionRu: item.regionRu || null,
        tags: item.tags,
        tagsEn: item.tagsEn || null,
        tagsRu: item.tagsRu || null,
        text: item.text,
        textEn: item.textEn || null,
        textRu: item.textRu || null,
        detailedContent: item.detailedContent,
        detailedContentEn: item.detailedContentEn || null,
        detailedContentRu: item.detailedContentRu || null,
        dataSummary: item.dataSummary || null,
        actionTips: item.actionTips || null,
        sortOrder,
      },
    });
  }
  console.log(`已导入 ${ALL_MARKET_INTEL.length} 条情报数据 (日期: 2026-06-18)`);
  console.log("验证: 5070 (🔥) 在 sortOrder=0 首位");
  console.log("验证: 其余情报从 sortOrder=1 开始排列");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
