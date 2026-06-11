/**
 * 导入2026-06-11市场情报数据到数据库
 * 基于 2026-06-10_跨境套利日报.md 生成（当日日报尚未生成）
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const TODAY = new Date("2026-06-11");

const ALL_MARKET_INTEL = [
  {
    icon: "💶", region: "欧洲", tags: ["汇率预警", "EUR跌破7.84"], date: TODAY,
    text: "EUR/CNY跌破7.84关口！连续三日下行，近10日从7.89降至7.81，欧元弱势趋势确立",
    textEn: "EUR/CNY breaks below 7.84! Third consecutive day of decline, from 7.89 to 7.81 in 10 days, EUR weakness trend confirmed",
    textRu: "EUR/CNY пробил отметку 7.84! Третий день подряд снижения, с 7.89 до 7.81 за 10 дней, тренд ослабления евро подтверждён",
    regionEn: "Europe", regionRu: "Европа",
    tagsEn: '["FX Alert", "EUR below 7.84"]', tagsRu: '["Валютное предупреждение", "EUR ниже 7.84"]',
    detailedContent: `## EUR/CNY跌破7.84 — 汇率快报\n\n**最新数据：** 中行2026-06-10折算价7.8400，较6月9日7.8476再降0.10%，市场实时价7.8156。\n\n### 汇率走势\n| 日期 | 中行折算价 | 日环比 |\n|------|-----------|--------|\n| 6月8日 | 7.8240 | -0.82%（vs前周）|\n| 6月9日 | 7.8476 | +0.30% |\n| 6月10日 | **7.8400** | **-0.10%** |\n| 市场实时 | 7.8156 | 低于中间价 |\n\n### 对套利业务影响\n- 欧元贬值0.10% → 国际对标价RMB换算值微降约0.3万/百万欧元级标的\n- 对套利影响有限（<0.5%），但持续下行趋势值得关注\n- **利好以人民币计价出口**：持有人民币时换算成欧元更有价格优势\n\n### 行动建议\n- 利用EUR弱势加速锁定现有合同\n- 以人民币定价出口更有利\n- 通过CIPS人民币结算对冲汇率风险`,
    detailedContentEn: `## EUR/CNY Below 7.84 — FX Flash\n\n**Latest Data:** BOC 2026-06-10 midpoint 7.8400, down 0.10% from June 9's 7.8476, market real-time 7.8156.\n\n### FX Trend\n| Date | BOC Midpoint | Daily Change |\n|------|-----------|--------|\n| June 8 | 7.8240 | -0.82% (vs prev week) |\n| June 9 | 7.8476 | +0.30% |\n| June 10 | **7.8400** | **-0.10%** |\n| Market real-time | 7.8156 | Below midpoint |\n\n### Impact on Arbitrage\n- EUR -0.10% → International RMB equivalent down ~CNY 3K per million EUR-level target\n- Limited impact (<0.5%), but sustained downtrend worth monitoring\n- **Positive for RMB-denominated exports**: RMB stronger against EUR improves price advantage\n\n### Recommendations\n- Use EUR weakness to accelerate locking existing contracts\n- RMB pricing more advantageous for exports\n- Hedge FX risk via CIPS RMB settlement`,
    detailedContentRu: `## EUR/CNY ниже 7.84 — Валютная сводка\n\n**Последние данные:** Средний курс Банка Китая 2026-06-10 7.8400, снижение на 0.10% с 7.8476 (9 июня), рыночный курс 7.8156.\n\n### Тренд валют\n| Дата | Средний курс БК | Дневное изменение |\n|------|-----------|--------|\n| 8 июня | 7.8240 | -0.82% |\n| 9 июня | 7.8476 | +0.30% |\n| 10 июня | **7.8400** | **-0.10%** |\n| Рынок | 7.8156 | Ниже среднего |\n\n### Влияние на арбитраж\n- EUR -0.10% → Эквивалент RMB снижен на ~3 тыс. юаней на объект стоимостью млн EUR\n- Влияние ограничено (<0.5%), но тенденция заслуживает внимания\n- **Благоприятно для экспорта в юанях**\n\n### Рекомендации\n- Ускорить фиксацию контрактов на фоне слабости EUR\n- Ценообразование в юанях более выгодно\n- Хеджирование валютных рисков через CIPS`,
    actionTips: ["利用EUR弱势以人民币定价加速出口", "监测EUR/CNY是否跌破7.80关键关口", "CIPS人民币结算规避汇率波动风险"],
    dataSummary: [{ label: "EUR/CNY中行", value: "7.8400(-0.10%)" }, { label: "市场实时", value: "7.8156" }],
  },
  {
    icon: "🇩🇪", region: "欧洲", tags: ["2025款970", "€507,800高位"], date: TODAY,
    text: "2025款Jaguar 970维持€507,800历史高位！波兰经销商连续调价，高端机型供不应求确认",
    textEn: "2025 Jaguar 970 maintains €507,800 historic high! Polish dealer continuous price adjustments confirm high-end model supply shortage",
    textRu: "Jaguar 970 2025 года сохраняет €507,800 — исторический максимум! Польский дилер продолжает корректировать цены, подтверждая дефицит高端ных моделей",
    regionEn: "Europe", regionRu: "Европа",
    tagsEn: '["2025 970", "€507.8K High"]', tagsRu: '["970 2025", "€507,8K Максимум"]',
    detailedContent: `## 2025款Jaguar 970历史高位企稳\n\n**核心数据：** 波兰克日扎努夫，CLAAS POLSKA经销商，仅579h，€507,800（≈398.1万元）\n\n### 970系列价格分层\n| 年份 | 价格区间(EUR) | 说明 |\n|------|-------------|------|\n| 2025 | €507,800 | 仅1台，旗舰标杆价 |\n| 2022-2024 | €390,900-€473,600 | 2022有ORBIS750割台的€473.6K为次高 |\n| 2019-2021 | €300,470-€428,400 | Stage V版本€300K为性价比标杆 |\n| 2010-2016 | €110,000-€167,500 | 老款，低价区间 |\n\n### 含义\n- 970高端需求强劲，供不应求确认\n- 970(2017)国内163万对比国际同级有上调空间\n- 2010年(€110K)到2025年(€507.8K)：15年四倍价差说明二手保值率极高`,
    detailedContentEn: `## 2025 Jaguar 970 Stabilizes at Historic High\n\n**Core Data:** Krzyzanow, Poland, CLAAS POLSKA dealer, only 579h, €507,800 (≈CNY 3.981M)\n\n### 970 Series Price Tiers\n| Year | Price Range (EUR) | Description |\n|------|-------------|------|\n| 2025 | €507,800 | Single unit, flagship benchmark |\n| 2022-2024 | €390,900-€473,600 | 2022 w/ ORBIS750 at €473.6K second highest |\n| 2019-2021 | €300,470-€428,400 | Stage V at €300K value benchmark |\n| 2010-2016 | €110,000-€167,500 | Old models, low price range |\n\n### Implications\n- Strong 970 high-end demand, supply shortage confirmed\n- Domestic 970(2017) at CNY 1.63M has room for upward adjustment\n- 2010 (€110K) to 2025 (€507.8K): 4x over 15 years shows excellent resale value`,
    detailedContentRu: `## Jaguar 970 2025 года стабилизировался на историческом максимуме\n\n**Ключевые данные:** Кшижанов, Польша, дилер CLAAS POLSKA, всего 579 моточасов, €507,800 (≈3.981 млн юаней)\n\n### Ценовые уровни серии 970\n| Год | Диапазон цен (EUR) | Описание |\n|------|-------------|------|\n| 2025 | €507,800 | Единственный, флагманский ориентир |\n| 2022-2024 | €390,900-€473,600 | 2022 с ORBIS750 €473.6K второй |\n| 2019-2021 | €300,470-€428,400 | Stage V €300K ориентир ценности |\n| 2010-2016 | €110,000-€167,500 | Старые модели |\n\n### Значение\n- Высокий спрос на 970, дефицит подтверждён\n- Внутренняя 970(2017) 1.63 млн юаней имеет потенциал роста\n- 4-кратный рост за 15 лет показывает отличную остаточную стоимость`,
    actionTips: ["970(2017)国内163万有上调空间，暂缓低价出货", "利用€507.8K锚定效应凸显2017款性价比", "制作970全系价格对比表向俄语买家展示"],
    dataSummary: [{ label: "2025款€507.8K", value: "历史高位" }, { label: "970在售总量", value: "Agroline 16台" }],
  },
  {
    icon: "🇪🇺", region: "欧洲", tags: ["Jaguar 980", "75.5%价差"], date: TODAY,
    text: "Jaguar 980(2016)青储机系列最高套利标的！EU€320K→250.9万 vs 国内143万，价差107.9万(75.5%)",
    textEn: "Jaguar 980(2016) highest arbitrage target in forage harvester lineup! EU€320K→CNY2.509M vs domestic CNY1.43M, spread CNY1.079M (75.5%)",
    textRu: "Jaguar 980(2016) — самая прибыльная цель в линейке силосоуборочных! ЕС€320K→2.509 млн юаней vs 1.43 млн, разница 1.079 млн (75.5%)",
    regionEn: "Europe", regionRu: "Европа",
    tagsEn: '["Jaguar 980", "75.5% Spread"]', tagsRu: '["Jaguar 980", "75.5% разница"]',
    detailedContent: `## Jaguar 980 套利深度分析\n\n**核心标的：** CLAAS Jaguar 980 (2016) 国内143万在售\n\n### 国际对标价\n| 年份 | 国际参考 | 换算CNY |\n|------|---------|--------|\n| 2024 | €467,900 (1,750h) | 366.8万 |\n| 2023 | €359,000 (1,380h) | 281.5万 |\n| **2023** | **€320,000 (2,304h)** | **250.9万** |\n| **国内980(2016)** | **—** | **143万** |\n\n### 套利对比\n| 机型 | 国际价 | 国内价 | 价差 | 价差率 |\n|------|--------|--------|------|--------|\n| **980(2016)** | 250.9万 | 143万 | **107.9万** | **75.5%** ⭐⭐⭐⭐⭐ |\n| 970(2017) | 206.5万 | 163万 | 43.5万 | 26.7% |\n| FR450(2013) | 43.3万 | 21.5万 | 21.8万 | 101.4% |\n| 5300RC(2022) | 145.0万 | 95万 | 50.0万 | 52.6% |\n| BigM 420(2018) | 78.4万 | 49万 | 29.4万 | 60.0% |\n\n### 操作策略\n- **优先推俄语区+乌克兰买家**，75.5%为全系列青储机最高\n- FAO乌克兰三年计划确认需求+AGRO 2026展7月举办，时间窗口明确\n- 建议一周内完成至少1台980出口`,
    detailedContentEn: `## Jaguar 980 Deep Arbitrage Analysis\n\n**Core Target:** CLAAS Jaguar 980 (2016) domestic CNY 1.43M in stock\n\n### International Benchmark\n| Year | International Reference | Converted to CNY |\n|------|---------|--------|\n| 2024 | €467,900 (1,750h) | 3.668M |\n| 2023 | €359,000 (1,380h) | 2.815M |\n| **2023** | **€320,000 (2,304h)** | **2.509M** |\n| **Domestic 980(2016)** | **—** | **1.43M** |\n\n### Arbitrage Comparison\n| Model | International | Domestic | Spread | Rate |\n|------|--------|--------|------|--------|\n| **980(2016)** | CNY 2.509M | CNY 1.43M | **CNY 1.079M** | **75.5%** ⭐⭐⭐⭐⭐ |\n| 970(2017) | CNY 2.065M | CNY 1.63M | CNY 435K | 26.7% |\n| FR450(2013) | CNY 433K | CNY 215K | CNY 218K | 101.4% |\n| 5300RC(2022) | CNY 1.45M | CNY 950K | CNY 500K | 52.6% |\n| BigM 420(2018) | CNY 784K | CNY 490K | CNY 294K | 60.0% |\n\n### Strategy\n- Priority: Russian region + Ukraine buyers, 75.5% highest in forage harvester lineup\n- FAO Ukraine plan + AGRO 2026 July exhibition = clear timeline\n- Complete at least 1 unit 980 export within this week`,
    detailedContentRu: `## Глубокий арбитражный анализ Jaguar 980\n\n**Основная цель:** CLAAS Jaguar 980 (2016) на складе по 1.43 млн юаней\n\n### Международный ориентир\n| Год | Международная ссылка | Конвертация в юани |\n|------|---------|--------|\n| 2024 | €467,900 (1,750ч) | 3.668 млн |\n| 2023 | €359,000 (1,380ч) | 2.815 млн |\n| **2023** | **€320,000 (2,304ч)** | **2.509 млн** |\n| **980(2016) внутр.** | **—** | **1.43 млн** |\n\n### Арбитражное сравнение\n| Модель | Междунар. | Внутр. | Разница | Ставка |\n|------|--------|--------|------|--------|\n| **980(2016)** | 2.509 млн | 1.43 млн | **1.079 млн** | **75.5%** ⭐⭐⭐⭐⭐ |\n| 970(2017) | 2.065 млн | 1.63 млн | 435K | 26.7% |\n| FR450(2013) | 433K | 215K | 218K | 101.4% |\n| 5300RC(2022) | 1.45 млн | 950K | 500K | 52.6% |\n| BigM 420(2018) | 784K | 490K | 294K | 60.0% |\n\n### Стратегия\n- Приоритет: русскоязычный регион + Украина, 75.5%最高 в линейке\n- План FAO Украина + выставка AGRO 2026 = чёткий тайминг\n- Завершить экспорт минимум 1 шт. 980 на этой неделе`,
    actionTips: ["980优先推俄语区+乌克兰买家，75.5%系列最高", "AGRO 2026展前完成1台980出口", "980+970组合方案提升客单价"],
    dataSummary: [{ label: "980价差", value: "107.9万(75.5%)" }, { label: "980在售", value: "3台" }],
  },
  {
    icon: "🇨🇳", region: "中国", tags: ["FR450爆款", "101.4%价差"], date: TODAY,
    text: "FR450(2013)爆款速推！21.5万/台+101.4%价差率，10台走量，汇率影响最小",
    textEn: "FR450(2013) hot seller push! CNY 215K/unit + 101.4% spread, 10 units volume, minimal FX impact",
    textRu: "FR450(2013) хит продаж! 215 тыс. юаней/ед. + 101.4% разница, 10 ед. объёмных продаж, минимальное влияние валют",
    regionEn: "China", regionRu: "Китай",
    tagsEn: '["FR450 Hot Seller", "101.4% Spread"]', tagsRu: '["FR450 хит", "101.4% разница"]',
    detailedContent: `## FR450爆款速推\n\n**核心优势：** 一口价21.5万/台 + 101.4%价差率 + 汇率波动影响最小\n\n### FR450套利分析\n| 指标 | 数值 |\n|------|------|\n| 国内售价 | 21.5万/台 |\n| 俄市场参考价 | 43.3万 |\n| 价差 | 21.8万 |\n| 价差率 | **101.4%** |\n| 库存 | **10台** |\n| 汇率敏感度 | 低（绝对价差小） |\n\n### 为什么是爆款？\n1. 101.4%价差率 → 翻倍利润\n2. 21.5万低门槛 → 买家决策快\n3. 10台库存 → 走量模式\n4. 汇率波动影响小 → 利润确定性高\n\n### 竞品对比\n- FR500(9040)(2015): 35万, 价差约46%\n- Krone BiG Pack 1290(2020): 68万 → 时间窗口偏长`,
    detailedContentEn: `## FR450 Hot Seller Push\n\n**Core Advantage:** Fixed price CNY 215K/unit + 101.4% spread + minimal FX impact\n\n### FR450 Arbitrage Analysis\n| Indicator | Value |\n|------|------|\n| Domestic price | CNY 215K/unit |\n| Russian market reference | CNY 433K |\n| Spread | CNY 218K |\n| Spread rate | **101.4%** |\n| Inventory | **10 units** |\n| FX sensitivity | Low (small absolute spread) |\n\n### Why Hot Seller?\n1. 101.4% spread → Double profit\n2. CNY 215K low barrier → Fast buyer decisions\n3. 10 units inventory → Volume model\n4. Minimal FX impact → High profit certainty\n\n### Competitor Comparison\n- FR500(9040)(2015): CNY 350K, spread ~46%\n- Krone BiG Pack 1290(2020): CNY 680K, longer timeline`,
    detailedContentRu: `## FR450 — хит продаж\n\n**Главное преимущество:** 215 тыс. юаней/ед. + 101.4% разница + минимальное влияние валют\n\n### Арбитражный анализ FR450\n| Показатель | Значение |\n|------|------|\n| Внутренняя цена | 215 тыс. юаней/ед. |\n| Справочная РФ | 433 тыс. юаней |\n| Разница | 218 тыс. юаней |\n| Ставка разницы | **101.4%** |\n| Склад | **10 ед.** |\n| Чувствит. к валютам | Низкая |\n\n### Почему хит?\n1. 101.4% → двойная прибыль\n2. Низкий порог 215 тыс. → быстрое решение\n3. 10 ед. → объёмные продажи\n4. Минимальное влияние валют → высокая определённость`,
    actionTips: ["FR450俄语区批量速推10台，101.4%翻倍利润", "21.5万低门槛在线报价吸引小型买家", "一口价策略加速成交，本周内清库存"],
    dataSummary: [{ label: "FR450价差", value: "101.4%" }, { label: "库存", value: "10台" }],
  },
  {
    icon: "🇺🇦", region: "乌克兰", tags: ["FAO三年计划", "AGRO展"], date: TODAY,
    text: "FAO乌克兰三年计划确认！2026年谷物产量预计83.6百万吨(+4.5%)，AGRO 2026展7月基辅举办",
    textEn: "FAO Ukraine three-year recovery plan confirmed! 2026 grain production forecast 83.6M tons (+4.5%), AGRO 2026 exhibition July in Kyiv",
    textRu: "Трёхлетний план восстановления Украины ФАО подтверждён! Прогноз урожая зерна 2026 — 83.6 млн тонн (+4.5%), выставка AGRO 2026 в июле в Киеве",
    regionEn: "Ukraine", regionRu: "Украина",
    tagsEn: '["FAO Plan", "AGRO Exhibition"]', tagsRu: '["План ФАО", "Выставка AGRO"]',
    detailedContent: `## FAO乌克兰三年恢复计划 + AGRO 2026展\n\n### FAO三年计划要点（6月1日发布）\n| 项目 | 内容 |\n|------|------|\n| 谷物产量预测 | 2026年83.6百万吨（+4.5% YoY） |\n| 国际资金 | 陆续到位中 |\n| 优先领域 | 排雷 → 灌溉修复 → 农机替代 |\n| 黑海路线 | 已恢复运行 |\n| 多瑙河路线 | 替代通道运行中 |\n\n### AGRO 2026乌克兰国际农业展\n| 信息 | 详情 |\n|------|------|\n| 时间 | 2026年7月 |\n| 地点 | 基辅 |\n| 届次 | 第34届 |\n| 规模 | 战后最大农业展 |\n| 对接机会 | CTT展后第2个农业展窗口 |\n\n### 对神雕农机意义\n- FAO计划确认 → 农机进口确定性需求\n- 83.6百万吨谷物 = 大规模收获作业需求\n- AGRO 2026展前完成线上产品对接\n- 提前准备俄语/乌克兰语产品手册`,
    detailedContentEn: `## FAO Ukraine Recovery Plan + AGRO 2026 Exhibition\n\n### FAO 3-Year Plan Highlights (Released June 1)\n| Item | Details |\n|------|------|\n| Grain output forecast | 2026: 83.6M tons (+4.5% YoY) |\n| International funding | Arriving progressively |\n| Priority areas | Demining → Irrigation repair → Machinery replacement |\n| Black Sea route | Operational |\n| Danube route | Alternative channel running |\n\n### AGRO 2026 Ukraine International Agricultural Exhibition\n| Info | Details |\n|------|------|\n| Date | July 2026 |\n| Location | Kyiv |\n| Edition | 34th |\n| Scale | Largest post-war agricultural exhibition |\n| Opportunity | Second agricultural exhibition window after CTT |\n\n### Significance for ShenDiao\n- FAO plan confirms → deterministic demand for machinery imports\n- 83.6M tons grain = large-scale harvesting operations required\n- Complete online product matching before AGRO 2026\n- Prepare Russian/Ukrainian language product catalogs`,
    detailedContentRu: `## План восстановления ФАО Украины + Выставка AGRO 2026\n\n### Основные пункты трёхлетнего плана ФАО (опубликован 1 июня)\n| Пункт | Детали |\n|------|------|\n| Прогноз урожая зерна | 2026: 83.6 млн тонн (+4.5% к 2025) |\n| Международное финансирование | Поступает постепенно |\n| Приоритетные направления | Разминирование → ремонт орошения → замена техники |\n| Маршрут Чёрного моря | Действует |\n| Маршрут Дуная | Альтернативный канал работает |\n\n### AGRO 2026 Украинская международная сельскохозяйственная выставка\n| Информация | Детали |\n|------|------|\n| Дата | Июль 2026 |\n| Место | Киев |\n| Выпуск | 34-й |\n| Масштаб | Крупнейшая послевоенная с/х выставка |\n\n### Значение для ShenDiao\n- План ФАО → детерминированный спрос на импорт техники\n- 83.6 млн тонн зерна = масштабные уборочные работы\n- Завершить онлайн-подбор продукции до AGRO 2026`,
    actionTips: ["一周内完成乌克兰买家线上对接", "提前制作俄语/乌克兰语产品手册+报价", "重点推5300RC(95万全新)+FR450适合FAO需求"],
    dataSummary: [{ label: "FAO谷物预测", value: "83.6百万吨(+4.5%)" }, { label: "AGRO展", value: "7月基辅" }],
  },
  {
    icon: "🔥", region: "中国", tags: ["5300RC", "372.2%白菜价"], date: TODAY,
    text: "CLAAS 5300RC(2020)仅18万元！参考国际同级85万+，372.2%价差率全品类第一",
    textEn: "CLAAS 5300RC(2020) only CNY 180K! International comparable 850K+, 372.2% spread rate — #1 across all categories",
    textRu: "CLAAS 5300RC(2020) всего 180 тыс. юаней! Международный аналог 850 тыс.+, 372.2% — №1 среди всех категорий",
    regionEn: "China", regionRu: "Китай",
    tagsEn: '["5300RC", "372.2% Bargain"]', tagsRu: '["5300RC", "372.2% Скидка"]',
    detailedContent: `## 5300RC(2020) 18万白菜价分析\n\n### 核心发现\n| 指标 | 数值 |\n|------|------|\n| 国内售价 | **18万元** |\n| 国际同级参考 | **85万元+** |\n| 价差 | **67万元** |\n| 价差率 | **372.2%** ⭐⭐⭐⭐⭐ |\n| 车况 | 待确认（低价可能伴随维修需求） |\n\n### 对比5300RC(2022全新95万)\n| 对比项 | 5300RC 2020(18万) | 5300RC 2022(95万全新) |\n|--------|------------------|---------------------|\n| 价差率 | **372.2%** | 52.6% |\n| 风险 | 需确认车况 | 全新无风险 |\n| 适用买家 | 维修能力强的中亚/俄买家 | 预算充裕的乌克兰/巴西买家 |\n| 推荐策略 | 先验车再报价 | 直接推向乌克兰/巴西线 |\n\n### 操作建议\n- 先确认18万5300RC真实车况\n- 若车况良好 → 优先推向中亚维修能力强的买家\n- 若需维修 → 核算维修成本后定价`,
    detailedContentEn: `## 5300RC(2020) CNY 180K Bargain Analysis\n\n### Core Finding\n| Indicator | Value |\n|------|------|\n| Domestic price | **CNY 180K** |\n| International comparable | **CNY 850K+** |\n| Spread | **CNY 670K** |\n| Spread rate | **372.2%** ⭐⭐⭐⭐⭐ |\n| Condition | TBC (low price may indicate repair needs) |\n\n### Compare with 5300RC(2022 new CNY 950K)\n| Item | 5300RC 2020(180K) | 5300RC 2022(950K new) |\n|--------|------------------|---------------------|\n| Spread rate | **372.2%** | 52.6% |\n| Risk | Condition TBC | Zero risk (new) |\n| Target buyers | Central Asia/Russia with repair capability | Ukraine/Brazil with budget |\n\n### Recommendations\n- First verify actual condition of the 180K 5300RC\n- If good condition → push to Central Asia buyers with repair capability\n- If repairs needed → price after calculating repair cost`,
    detailedContentRu: `## 5300RC(2020) 180 тыс. юаней — анализ выгодной цены\n\n### Основные выводы\n| Показатель | Значение |\n|------|------|\n| Внутренняя цена | **180 тыс. юаней** |\n| Международный аналог | **850 тыс. юаней+** |\n| Разница | **670 тыс. юаней** |\n| Ставка разницы | **372.2%** ⭐⭐⭐⭐⭐ |\n| Состояние | Требуется проверка |\n\n### Сравнение с 5300RC(2022 новый 950 тыс.)\n| Параметр | 5300RC 2020(180K) | 5300RC 2022(950K) |\n|--------|------------------|---------------------|\n| Разница | **372.2%** | 52.6% |\n| Риск | Требуется проверка | Без риска |\n\n### Рекомендации\n- Сначала проверить состояние\n- Если в порядке → в Центральную Азию\n- Если нужен ремонт → пересчитать`,
    actionTips: ["先验车确认18万5300RC真实车况", "若车况良好优先推向中亚维修能力强买家", "对比5300RC(2022)95万全新，分两条线推进"],
    dataSummary: [{ label: "5300RC价差率", value: "372.2%" }, { label: "国际参考", value: "85万+" }],
  },
  {
    icon: "🇷🇺", region: "俄罗斯", tags: ["EU制裁", "5%低关税"], date: TODAY,
    text: "EU第20轮制裁持续发酵！欧美农机配件断供加剧，俄将农机列2026第一优先产业，5%低关税+补贴",
    textEn: "EU 20th round sanctions continue impacting! Western machinery parts supply disrupted, Russia ranks agricultural machinery as #1 priority industry for 2026, 5% low tariff + subsidies",
    textRu: "20-й раунд санкций ЕС продолжает действовать! Перебои с запчастями западной техники, Россия ставит сельхозмашиностроение приоритетом №1 на 2026, 5% пошлина + субсидии",
    regionEn: "Russia", regionRu: "Россия",
    tagsEn: '["EU Sanctions", "5% Low Tariff"]', tagsRu: '["Санкции ЕС", "5% пошлина"]',
    detailedContent: `## 俄罗斯农机市场 — EU制裁与政策红利\n\n### EU第20轮制裁影响\n| 影响维度 | 详情 |\n|---------|------|\n| 制裁时间 | 4月23日发布，2年来最大规模 |\n| 新增制裁 | 120项清单 |\n| 配件供应 | CLAAS/Deere/Kubota配件中断加剧 |\n| 替代机会 | 中国/土耳其设备不受制裁限制 |\n\n### 俄罗斯政策红利\n| 政策 | 内容 |\n|------|------|\n| 2026优先产业 | 农机排第一 |\n| 关税 | CLAAS同类型5%低关税 |\n| 政府补贴 | 农机购置补贴持续 |\n| CTT展后 | 线上跟进持续 |\n\n### 神雕机会\n- EU制裁=中国二手农机进入俄罗斯窗口扩大\n- 5%低关税+补贴=买家购买力增强\n- 970/980/850三个型号最受俄市场欢迎`,
    detailedContentEn: `## Russian Ag Machinery Market — EU Sanctions & Policy Dividends\n\n### EU 20th Round Sanctions Impact\n| Dimension | Details |\n|---------|------|\n| Timing | April 23, largest in 2 years |\n| New sanctions | 120 items |\n| Parts supply | CLAAS/Deere/Kubota parts increasingly disrupted |\n| Substitution | Chinese/Turkish equipment not restricted |\n\n### Russian Policy Dividends\n| Policy | Details |\n|------|------|\n| 2026 priority | Agricultural machinery #1 |\n| Tariff | 5% low tariff for CLAAS-like models |\n| Subsidies | Machinery purchase subsidies ongoing |\n| Post-CTT | Online follow-up continuing |\n\n### ShenDiao Opportunity\n- EU sanctions = expanded window for Chinese used machinery into Russia\n- 5% tariff + subsidies = enhanced buyer purchasing power\n- 970/980/850 most popular models for Russian market`,
    detailedContentRu: `## Рынок сельхозтехники России — санкции ЕС и политические дивиденды\n\n### Влияние 20-го раунда санкций ЕС\n| Измерение | Детали |\n|---------|------|\n| Время | 23 апреля, крупнейший за 2 года |\n| Новые санкции | 120 позиций |\n| Запчасти | Перебои с запчастями CLAAS/Deere/Kubota |\n| Замена | Китайское/турецкое оборудование не ограничено |\n\n### Политические дивиденды России\n| Политика | Детали |\n|------|------|\n| Приоритет 2026 | Сельхозмашиностроение №1 |\n| Пошлина | 5% для аналогов CLAAS |\n| Субсидии | Действуют |\n\n### Возможность ShenDiao\n- Санкции ЕС = расширенное окно для китайской б/у техники\n- 5% пошлина + субсидии = повышенная покупательная способность\n- 970/980/850 — самые популярные модели для РФ`,
    actionTips: ["重点推CLAAS 970/980/850覆盖俄市场刚需", "利用5%低关税+补贴政策设计报价策略", "提供俄语说明书+配件供应承诺增强信任"],
    dataSummary: [{ label: "制裁新增", value: "120项" }, { label: "俄农机关税", value: "5%" }],
  },
  {
    icon: "🇺🇿", region: "乌兹别克斯坦", tags: ["增速最快", "+257%"], date: TODAY,
    text: "乌兹别克斯坦Q1进口增长256.77%全球最快！棉花采收机械化率不足40%，青储机需求空间巨大",
    textEn: "Uzbekistan Q1 import growth +256.77% globally fastest! Cotton harvesting mechanization below 40%, huge forage harvester demand",
    textRu: "Узбекистан рост импорта Q1 +256.77% — самый быстрый в мире! Механизация хлопкоуборки ниже 40%, огромный спрос на силосоуборочные",
    regionEn: "Uzbekistan", regionRu: "Узбекистан",
    tagsEn: '["Fastest Growth", "+257%"]', tagsRu: '["Самый быстрый рост", "+257%"]',
    detailedContent: `## 乌兹别克斯坦市场持续爆发\n\n### 核心数据\n| 指标 | 数值 |\n|------|------|\n| Q1进口增速 | **+256.77%** |\n| 棉花采收机械化率 | 不足40% |\n| 政府补贴 | 农机购置补贴50% |\n| 物流 | 中吉乌铁路建设加速 |\n\n### 新疆农机展反馈\n- 中亚买家对CLAAS青储机采购意愿强烈\n- 新疆农机展确认乌兹别克需求持续高涨\n- 棉花采收+青储收获双线需求\n\n### 神雕推荐机型\n| 品类 | 推荐型号 | 报价 |\n|------|---------|------|\n| 青储收获机 | CLAAS 850/860 | 60-120万 |\n| 拖拉机 | NH/Deere 100-200HP | 30-80万 |\n| 打捆机 | Krone 500/600 | 15-40万 |`,
    detailedContentEn: `## Uzbekistan Market Continues to Surge\n\n### Core Data\n| Indicator | Value |\n|------|------|\n| Q1 import growth | **+256.77%** |\n| Cotton harvesting mechanization | Below 40% |\n| Govt subsidies | 50% machinery purchase subsidy |\n| Logistics | China-Kyrgyzstan-Uzbekistan railway accelerating |\n\n### Xinjiang Exhibition Feedback\n- Central Asian buyers show strong purchase intent for CLAAS forage harvesters\n- Uzbekistan demand confirmed continuously high\n- Dual demand: cotton harvesting + forage harvesting\n\n### Recommended Models\n| Category | Model | Price |\n|------|---------|------|\n| Forage harvester | CLAAS 850/860 | CNY 600K-1.2M |\n| Tractor | NH/Deere 100-200HP | CNY 300K-800K |\n| Baler | Krone 500/600 | CNY 150K-400K |`,
    detailedContentRu: `## Рынок Узбекистана продолжает бурный рост\n\n### Основные данные\n| Показатель | Значение |\n|------|------|\n| Рост импорта Q1 | **+256.77%** |\n| Механизация хлопкоуборки | Ниже 40% |\n| Госсубсидии | 50% субсидия |\n| Логистика | Ж/д Китай-Кыргызстан-Узбекистан ускоряется |\n\n### Рекомендуемые модели\n| Категория | Модель | Цена |\n|------|---------|------|\n| Силосоуборочный | CLAAS 850/860 | 600K-1.2M юаней |\n| Трактор | NH/Deere 100-200 л.с. | 300K-800K юаней |\n| Пресс-подборщик | Krone 500/600 | 150K-400K юаней |`,
    actionTips: ["乌兹别克语+俄语版产品手册优先制作", "利用50%政府补贴设计融资方案", "中吉乌铁路开通前锁定物流方案"],
    dataSummary: [{ label: "Q1进口增速", value: "+256.77%" }, { label: "机械化率", value: "<40%" }],
  },
  {
    icon: "🇧🇷", region: "巴西", tags: ["进口替代", "5300RC核心"], date: TODAY,
    text: "巴西Q1农机销量-13.1%但进口替代加速！5300RC(95万全新)52.6%价差空间，14%关税需提前审批",
    textEn: "Brazil Q1 machinery sales -13.1% but import substitution accelerating! 5300RC (CNY 950K new) 52.6% spread, 14% tariff requires pre-approval",
    textRu: "Продажи техники в Бразилии Q1 -13.1%, но импортозамещение ускоряется! 5300RC (950 тыс. юаней новый) 52.6% разница, 14% пошлина требует предварительного одобрения",
    regionEn: "Brazil", regionRu: "Бразилия",
    tagsEn: '["Import Substitution", "5300RC Core"]', tagsRu: '["Импортозамещение", "5300RC основной"]',
    detailedContent: `## 巴西农机市场 — 进口替代加速\n\n### 市场现状\n| 指标 | 数值 |\n|------|------|\n| Q1销量增速 | -13.1% |\n| 进口替代 | 加速中 |\n| 5300RC国内价 | 95万(全新) |\n| 国际同级参考 | €185K(145.0万) |\n| 价差率 | **52.6%** |\n| 进口关税 | 14%+MAPA审批 |\n\n### 5300RC巴西机会\n- 全新大方捆(95万)→巴西市场核心标的\n- 52.6%价差远高于30%套利阈值\n- 14%关税需提前完成MAPA审批\n- 交货周期35-45天\n\n### 巴西市场数据\n- 5300RC(2022)全新款，国际€185K\n- 巴西大型农场对大方捆需求确定\n- China-Brazil贸易关系稳定\n- 建议制作葡萄牙语产品手册`,
    detailedContentEn: `## Brazil Ag Machinery — Import Substitution Accelerating\n\n### Market Status\n| Indicator | Value |\n|------|------|\n| Q1 sales growth | -13.1% |\n| Import substitution | Accelerating |\n| 5300RC domestic price | CNY 950K (new) |\n| International reference | €185K (CNY 1.45M) |\n| Spread rate | **52.6%** |\n| Import tariff | 14% + MAPA approval |\n\n### 5300RC Brazil Opportunity\n- New large square baler (CNY 950K) → core target for Brazil\n- 52.6% spread far above 30% threshold\n- 14% tariff requires MAPA pre-approval\n- Delivery cycle 35-45 days\n\n### Brazil Market Data\n- 5300RC(2022) new, international €185K\n- Large Brazilian farms have confirmed demand for large square balers\n- China-Brazil trade relations stable`,
    detailedContentRu: `## Рынок Бразилии — импортозамещение ускоряется\n\n### Состояние рынка\n| Показатель | Значение |\n|------|------|\n| Рост продаж Q1 | -13.1% |\n| Импортозамещение | Ускоряется |\n| 5300RC внутр. цена | 950 тыс. (новый) |\n| Междунар. аналог | €185K (1.45 млн) |\n| Разница | **52.6%** |\n| Пошлина | 14% + одобрение MAPA |\n\n### Возможности 5300RC в Бразилии\n- Новый пресс-подборщик (950 тыс.) → основная цель\n- 52.6% разница значительно выше порога 30%\n- 14% пошлина требует предварительного одобрения\n- Цикл поставки 35-45 дней`,
    actionTips: ["5300RC(95万全新)优先推送巴西买家", "提前完成巴西14%关税的MAPA审批", "制作葡萄牙语产品手册增强信任"],
    dataSummary: [{ label: "5300RC价差率", value: "52.6%" }, { label: "巴西关税", value: "14%+MAPA" }],
  },
  {
    icon: "🌍", region: "非洲", tags: ["肯尼亚+46.6%", "NAMPO展"], date: TODAY,
    text: "NAMPO展后非洲需求增长！肯尼亚农机进口+46.6%，中国二手农机=欧洲新品20-30%价格",
    textEn: "Post-NAMPO Africa demand growing! Kenya machinery imports +46.6%, Chinese used machinery = 20-30% of European new prices",
    textRu: "Спрос в Африке после NAMPO растёт! Импорт техники в Кению +46.6%, китайская б/у техника = 20-30% цены новой европейской",
    regionEn: "Africa", regionRu: "Африка",
    tagsEn: '["Kenya +46.6%", "Post-NAMPO"]', tagsRu: '["Кения +46.6%", "После NAMPO"]',
    detailedContent: `## 非洲市场更新\n\n### 区域动态\n| 区域 | 特点 | 需求机型 |\n|------|------|--------|\n| 🇰🇪 肯尼亚 | 进口+46.6% | 50-100HP拖拉机 |\n| 🇳🇬 尼日利亚 | 可耕地最大 | 中型拖拉机/收割机 |\n| 🇿🇦 南非 | 商业化农业 | 大型农机具 |\n| 🇪🇬 埃及 | 灌溉农业 | 拖拉机/水泵 |\n\n### 机会点\n- 中国二手农机=欧洲新品20-30%价格\n- 非洲大陆自贸区降低关税壁垒\n- NAMPO展后需求持续释放\n- 50-100HP拖拉机为非洲主力需求\n\n### 神雕策略\n- 主推50-100HP二手拖拉机\n- 关注肯尼亚+尼日利亚高潜市场\n- 利用非洲自贸区关税优惠`,
    detailedContentEn: `## Africa Market Update\n\n### Regional Dynamics\n| Region | Features | Demanded Models |\n|------|------|--------|\n| 🇰🇪 Kenya | Imports +46.6% | 50-100HP tractors |\n| 🇳🇬 Nigeria | Largest arable land | Medium tractors / Harvesters |\n| 🇿🇦 South Africa | Commercial farming | Large machinery |\n| 🇪🇬 Egypt | Irrigated farming | Tractors / Water pumps |\n\n### Opportunities\n- Chinese used machinery = 20-30% of European new prices\n- African Continental Free Trade Area reduces tariff barriers\n- Post-NAMPO demand continues to release\n- 50-100HP tractors are primary demand in Africa\n\n### ShenDiao Strategy\n- Focus on 50-100HP used tractors\n- Monitor Kenya + Nigeria high-potential markets\n- Leverage AfCFTA tariff advantages`,
    detailedContentRu: `## Обновление рынка Африки\n\n### Региональная динамика\n| Регион | Особенности | Востребованные модели |\n|------|------|--------|\n| 🇰🇪 Кения | Импорт +46.6% | Тракторы 50-100 л.с. |\n| 🇳🇬 Нигерия | Крупнейшие пашни | Средние тракторы / Комбайны |\n| 🇿🇦 ЮАР | Коммерческое фермерство | Крупная техника |\n| 🇪🇬 Египет | Орошаемое земледелие | Тракторы / Насосы |\n\n### Возможности\n- Китайская б/у = 20-30% цены новой европейской\n- Африканская зона свободной торговли снижает пошлины\n- Спрос после NAMPO продолжает расти`,
    actionTips: ["非洲主推50-100HP二手拖拉机", "关注肯尼亚+尼日利亚高潜市场", "利用非洲自贸区关税优惠设计报价"],
    dataSummary: [{ label: "肯尼亚增速", value: "+46.6%" }, { label: "非洲主力机型", value: "50-100HP拖" }],
  },
  {
    icon: "🌏", region: "东南亚", tags: ["印尼+121%", "小型农机"], date: TODAY,
    text: "印尼农机进口+121.07%爆发式增长！中泰农机协议推进中，东南亚成新增长极",
    textEn: "Indonesia machinery imports +121.07% explosive growth! China-Thailand machinery agreement advancing, Southeast Asia becomes new growth pole",
    textRu: "Импорт техники в Индонезию +121.07% взрывной рост! Китайско-тайское соглашение продвигается, ЮВА — новый полюс роста",
    regionEn: "Southeast Asia", regionRu: "Юго-Восточная Азия",
    tagsEn: '["Indonesia +121%", "Small Machinery"]', tagsRu: '["Индонезия +121%", "Малая техника"]',
    detailedContent: `## 东南亚农机市场更新\n\n### 区域数据\n| 国家 | 增速 | 主力机型 |\n|------|------|--------|\n| 🇮🇩 印尼 | **+121.07%** | 微耕机/小型收割机 |\n| 🇹🇭 泰国 | 中速 | 插秧机/收割机 |\n| 🇵🇭 菲律宾 | 快速 | 手扶拖拉机/收割机 |\n| 🇻🇳 越南 | 中速 | 插秧机/烘干机 |\n\n### 机会点\n- 印尼+121.07%为全球增速前三\n- 中泰农机协议推进，降低贸易壁垒\n- 小型农机需求旺盛，中国品牌优势明显\n- 神雕可关注小型打包机/青储机机会`,
    detailedContentEn: `## Southeast Asia Ag Machinery Market Update\n\n### Regional Data\n| Country | Growth | Key Models |\n|------|------|--------|\n| 🇮🇩 Indonesia | **+121.07%** | Mini tillers / Small harvesters |\n| 🇹🇭 Thailand | Moderate | Rice transplanters / Harvesters |\n| 🇵🇭 Philippines | Fast | Walking tractors / Harvesters |\n| 🇻🇳 Vietnam | Moderate | Rice transplanters / Dryers |\n\n### Opportunities\n- Indonesia +121.07% among top 3 globally\n- China-Thailand agreement reduces trade barriers\n- Small machinery demand strong, Chinese brands have advantages\n- ShenDiao can explore small baler/forage harvester opportunities`,
    detailedContentRu: `## Обновление рынка ЮВА\n\n### Региональные данные\n| Страна | Рост | Основные модели |\n|------|------|--------|\n| 🇮🇩 Индонезия | **+121.07%** | Мотоблоки / Малые комбайны |\n| 🇹🇭 Таиланд | Умеренный | Рисопосадочные / Комбайны |\n| 🇵🇭 Филиппины | Быстрый | Мотоблоки / Комбайны |\n| 🇻🇳 Вьетнам | Умеренный | Рисопосадочные / Сушилки |\n\n### Возможности\n- Индонезия +121.07% — в топ-3 в мире\n- Китайско-тайское соглашение снижает барьеры`,
    actionTips: ["东南亚市场可关注小型打包机/青储机机会", "对接中泰农机协议降低出口门槛", "提供印尼语产品资料"],
    dataSummary: [{ label: "印尼增速", value: "+121.07%" }, { label: "主要需求", value: "小型农機" }],
  },
  {
    icon: "🔄", region: "全球", tags: ["本周操作建议", "7大优先"], date: TODAY,
    text: "今日7大操作优先级：980(75.5%)→FR450(101.4%)→5300RC乌克兰(52.6%)→EUR弱势锁汇→BigM东欧→AGRO展→970持有观望",
    textEn: "Today's 7 priorities: 980(75.5%)→FR450(101.4%)→5300RC Ukraine(52.6%)→EUR weak lock→BigM E.Europe→AGRO exhibition→970 hold",
    textRu: "7 приоритетов: 980(75.5%)→FR450(101.4%)→5300RC Украина(52.6%)→фиксация EUR→BigM В.Европа→AGRO→970 выжидать",
    regionEn: "Global", regionRu: "Глобально",
    tagsEn: '["Action Plan", "7 Priorities"]', tagsRu: '["План действий", "7 приоритетов"]',
    detailedContent: `## 今日7大操作优先级\n\n| 优先级 | 操作 | 价差率 | 紧迫度 |\n|--------|------|--------|--------|\n| 1 | **980加速乌克兰/东欧成交** | 75.5% | 🔴 最急 |\n| 2 | **FR450爆款10台速推** | 101.4% | 🔴 最急 |\n| 3 | **5300RC(2022)乌克兰线** | 52.6% | 🟡 高 |\n| 4 | **利用EUR弱势锁汇**（以人民币定价） | — | 🟡 高 |\n| 5 | **BigM 420东欧推进** | 60.0% | 🟡 高 |\n| 6 | **预备AGRO 2026展对接** | — | 🟢 中 |\n| 7 | **970(2017)持有观望** | 26.7%<30% | 🟢 中 |\n\n### 关键数据速查\n| 机型 | 国内价 | 国际参考价 | 价差率 | 策略 |\n|------|--------|-----------|--------|------|\n| 980(2016) | 143万 | 250.9万(EU€320K) | 75.5% | 🔴 加速推 |\n| FR450(2013)×10 | 21.5万/台 | 43.3万 | 101.4% | 🔴 速推 |\n| 5300RC(2020) | 18万 | 85万+ | 372.2% | ⚠️ 先验车 |\n| 5300RC(2022) | 95万 | 145.0万(EU€185K) | 52.6% | 🟡 乌克兰线 |\n| BigM 420(2018) | 49万 | 78.4万(EU€100K) | 60.0% | 🟡 东欧推 |\n| 970(2017) | 163万 | 206.5万(EU€263.5K) | 26.7% | 🟢 观望 |\n\n### 关键时间节点\n- **本周内**：完成980+FR450各至少1单\n- **7月**：AGRO 2026乌克兰展\n- EUR/CNY 7.80为警戒线 — 跌破则重估所有欧元区参考价`,
    detailedContentEn: `## Today's 7 Action Priorities\n\n| Priority | Action | Spread Rate | Urgency |\n|--------|------|--------|--------|\n| 1 | **980 accelerate Ukraine/E.Europe deals** | 75.5% | 🔴 Most urgent |\n| 2 | **FR450 hot seller 10 units push** | 101.4% | 🔴 Most urgent |\n| 3 | **5300RC(2022) Ukraine line** | 52.6% | 🟡 High |\n| 4 | **Lock EUR weak rate** (RMB pricing) | — | 🟡 High |\n| 5 | **BigM 420 Eastern Europe push** | 60.0% | 🟡 High |\n| 6 | **Prepare AGRO 2026 exhibition** | — | 🟢 Medium |\n| 7 | **970(2017) hold & wait** | 26.7%<30% | 🟢 Medium |\n\n### Key Data Quick View\n| Model | Domestic | Int'l Reference | Spread | Strategy |\n|------|--------|-----------|--------|------|\n| 980(2016) | CNY 1.43M | CNY 2.509M(€320K) | 75.5% | 🔴 Accelerate |\n| FR450(2013)×10 | CNY 215K/unit | CNY 433K | 101.4% | 🔴 Hot push |\n| 5300RC(2020) | CNY 180K | CNY 850K+ | 372.2% | ⚠️ Inspect first |\n| 5300RC(2022) | CNY 950K | CNY 1.45M(€185K) | 52.6% | 🟡 Ukraine line |\n| BigM 420(2018) | CNY 490K | CNY 784K(€100K) | 60.0% | 🟡 E.Europe |\n| 970(2017) | CNY 1.63M | CNY 2.065M(€263.5K) | 26.7% | 🟢 Hold |\n\n### Key Milestones\n- **This week**: Complete at least 1 order each for 980 + FR450\n- **July**: AGRO 2026 Ukraine exhibition\n- EUR/CNY 7.80 alert line — re-evaluate all EUR-zone reference prices if broken`,
    detailedContentRu: `## 7 приоритетов действий на сегодня\n\n| Приоритет | Действие | Разница | Срочность |\n|--------|------|--------|--------|\n| 1 | **980 ускорить сделки Украина/В.Европа** | 75.5% | 🔴 Самое срочное |\n| 2 | **FR450 хит 10 ед.** | 101.4% | 🔴 Самое срочное |\n| 3 | **5300RC(2022) линия Украина** | 52.6% | 🟡 Высокая |\n| 4 | **Фиксация слабого EUR** | — | 🟡 Высокая |\n| 5 | **BigM 420 В.Европа** | 60.0% | 🟡 Высокая |\n| 6 | **Подготовка к AGRO 2026** | — | 🟢 Средняя |\n| 7 | **970(2017) выжидать** | 26.7% | 🟢 Средняя |\n\n### Быстрый просмотр данных\n| Модель | Внутр. | Междунар. | Разница | Стратегия |\n|------|--------|-----------|--------|------|\n| 980(2016) | 1.43 млн | 2.509 млн | 75.5% | 🔴 Ускорить |\n| FR450(2013)×10 | 215K/ед. | 433K | 101.4% | 🔴 Хит |\n| 5300RC(2020) | 180K | 850K+ | 372.2% | ⚠️ Проверить |\n| 5300RC(2022) | 950K | 1.45 млн | 52.6% | 🟡 Украина |\n| BigM 420 | 490K | 784K | 60.0% | 🟡 В.Европа |\n| 970(2017) | 1.63 млн | 2.065 млн | 26.7% | 🟢 Ждать |\n\n### Ключевые вехи\n- **На этой неделе**: по 1 заказу 980 + FR450\n- **Июль**: AGRO 2026 Украина\n- EUR/CNY 7.80 — линия тревоги`,
    actionTips: ["980+FR450双线并行本周内完成各1单", "利用EUR弱势锁定人民币定价合同", "5300RC下2020款验车后定报价策略"],
    dataSummary: [{ label: "本周目标", value: "980+FR450各1单" }, { label: "EUR警戒线", value: "7.80" }],
  },
];

async function main() {
  // 先清空旧数据
  await prisma.marketIntel.deleteMany();
  console.log("已清空旧数据");

  // 导入新数据
  for (let i = 0; i < ALL_MARKET_INTEL.length; i++) {
    const item = ALL_MARKET_INTEL[i];
    await prisma.marketIntel.create({
      data: {
        date: item.date,
        icon: item.icon,
        region: item.region,
        regionEn: item.regionEn || null,
        regionRu: item.regionRu || null,
        tags: Array.isArray(item.tags) ? JSON.stringify(item.tags) : item.tags,
        tagsEn: item.tagsEn || null,
        tagsRu: item.tagsRu || null,
        text: item.text,
        textEn: item.textEn || null,
        textRu: item.textRu || null,
        detailedContent: item.detailedContent,
        detailedContentEn: item.detailedContentEn || null,
        detailedContentRu: item.detailedContentRu || null,
        dataSummary: item.dataSummary ? JSON.stringify(item.dataSummary) : null,
        actionTips: item.actionTips ? JSON.stringify(item.actionTips) : null,
        sortOrder: i,
      },
    });
  }
  console.log(`已导入 ${ALL_MARKET_INTEL.length} 条情报数据 (日期: 2026-06-11)`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
