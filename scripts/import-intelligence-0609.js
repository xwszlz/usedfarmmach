/**
 * 导入2026-06-09市场情报数据到数据库
 * 基于 2026-06-09_跨境套利日报.md 生成
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const TODAY = new Date("2026-06-09");

const ALL_MARKET_INTEL = [
  {
    icon: "💶", region: "汇率", tags: ["EUR/CNY跌破7.85", "欧元走弱"], date: TODAY,
    text: "EUR/CNY跌破7.85关口！中行折算价7.8476(-0.56%)，欧元短期走弱趋势确认，利好中国出口",
    textEn: "EUR/CNY breaks below 7.85 threshold! BOC midpoint 7.8476 (-0.56%), euro short-term weakening trend confirmed, favorable for Chinese exports",
    textRu: "EUR/CNY пробил отметку 7.85! Средний курс Банка Китая 7.8476 (-0.56%), подтверждена краткосрочная тенденция ослабления евро, благоприятно для китайского экспорта",
    regionEn: "FX Market", regionRu: "Валютный рынок",
    tagsEn: '["EUR/CNY Below 7.85", "EUR Weakens"]', tagsRu: '["EUR/CNY ниже 7.85", "Ослабление евро"]',
    detailedContent: `## EUR/CNY跌破7.85关口\n\n**核心数据：** 2026-06-09中行外汇牌价显示欧元承压下行\n\n| 货币对 | 中行折算价 | 现汇买入价 | 现汇卖出价 | 日环比变化 |\n|--------|-----------|-----------|-----------|-----------|\n| EUR/CNY | 7.8476 | 7.8002 | 7.8573 | **-0.56%**（vs央行6/5中间价7.8919）|\n| USD/CNY | 6.8198 | 6.7743 | 6.8028 | +0.06%（vs央行6/5中间价6.8157）|\n\n### 关键信号\n- 欧元短期走弱确认，跌破7.85心理关口\n- 以人民币计价的出口利润扩大（中国卖家收到人民币更值钱）\n- USD/CNY微升，美元小幅走强\n- 市场实时EUR/CNY ~7.80，央行中间价今日9:15更新\n\n### 对套利的影响\n- EUR计价进口商品成本降低，但出口给欧元区买家的人民币利润扩大\n- 建议在欧元反弹前加速锁定现有合同\n- 可通过CIPS人民币结算对冲汇率风险`,
    detailedContentEn: `## EUR/CNY Breaks Below 7.85\n\n**Core Data:** June 9 BOC forex rates show euro under pressure\n\n| Pair | BOC Midpoint | Buying Rate | Selling Rate | Daily Change |\n|--------|-----------|-----------|-----------|-----------|\n| EUR/CNY | 7.8476 | 7.8002 | 7.8573 | **-0.56%** (vs PBOC 6/5 midpoint 7.8919) |\n| USD/CNY | 6.8198 | 6.7743 | 6.8028 | +0.06% (vs PBOC 6/5 midpoint 6.8157) |\n\n### Key Signals\n- Euro short-term weakness confirmed, below 7.85 psychological level\n- RMB-denominated export margins expand (Chinese sellers receive more valuable RMB)\n- USD/CNY slightly up, USD modestly strengthens\n- Market real-time EUR/CNY ~7.80, PBOC midpoint updates today 9:15\n\n### Impact on Arbitrage\n- EUR-denominated import costs decrease, but RMB profit from eurozone exports expands\n- Recommend accelerating contract locks before euro rebounds\n- Can hedge FX risk via CIPS RMB settlement`,
    detailedContentRu: `## EUR/CNY пробил отметку 7.85\n\n**Основные данные:** Курсы Банка Китая от 9 июня показывают давление на евро\n\n| Пара | Средний курс БК | Покупка | Продажа | Дневное изменение |\n|--------|-----------|-----------|-----------|-----------|\n| EUR/CNY | 7.8476 | 7.8002 | 7.8573 | **-0.56%** (vs средний НБК 6/5 7.8919) |\n| USD/CNY | 6.8198 | 6.7743 | 6.8028 | +0.06% (vs средний НБК 6/5 6.8157) |\n\n### Ключевые сигналы\n- Краткосрочное ослабление евро подтверждено, ниже психологического уровня 7.85\n- Маржа экспорта в юанях расширяется (китайские продавцы получают более ценные юани)\n- USD/CNY немного вырос, USD умеренно укрепляется\n- Рыночный курс EUR/CNY ~7.80, средний курс НБК обновится сегодня в 9:15\n\n### Влияние на арбитраж\n- Стоимость импорта в евро снижается, но прибыль в юанях от экспорта в еврозону растёт\n- Рекомендуется ускорить фиксацию контрактов до отскока евро\n- Возможно хеджирование валютных рисков через расчёты CIPS в юанях`,
    actionTips: ['["加速锁定现有合同防止欧元反弹侵蚀利润", "利用CIPS人民币结算对冲汇率风险", "今日9:15关注央行中间价调整方向"]'],
  },
  {
    icon: "📈", region: "欧洲", tags: ["2025款970涨价", "CLAAS高端"], date: TODAY,
    text: "2025款Jaguar 970连续两日涨价！€507,300→€507,800(+€500)，CLAAS高端二手进入上升通道",
    textEn: "2025 Jaguar 970 prices up for 2 consecutive days! €507,300→€507,800 (+€500), CLAAS high-end used enters upward channel",
    textRu: "Цены на Jaguar 970 2025 года растут второй день подряд! €507,300→€507,800 (+€500), рынок б/у высококлассных CLAAS входит в восходящий канал",
    regionEn: "Europe", regionRu: "Европа",
    tagsEn: '["2025 970 Price Up", "CLAAS High-End"]', tagsRu: '["970 2025 рост цен", "CLAAS премиум"]',
    detailedContent: `## 2025款Jaguar 970连续涨价\n\n**核心发现：** 波兰克日扎努夫CLAAS POLSKA经销商连续两日上调2025款970报价\n\n| 日期 | 价格 | 变化 |\n|------|------|------|\n| 6月8日 | €507,300 | 首次发现 |\n| 6月9日 | **€507,800** | **+€500 (+0.10%)** |\n\n### 970系列保值性分析\n| 特征 | 数值 |\n|------|------|\n| 2025款(579h)当前价 | €507,800 ≈ 398.6万RMB |\n| 2017款国内价 | 163万RMB |\n| 8年折价率 | 仅58.8%（行业均值70%+） |\n| 970系列保值力 | **极强** |\n\n### 信号解读\n- 高端970供给偏紧，经销商有信心加价\n- 对持有2017款970(163万)的卖家是强烈持有/溢价信号\n- 建议适度上调报价10-15万\n\n### Agroline/Affaires 970在售数据\n| 数据源 | 在售数量 | 价格区间 |\n|-------|---------|--------|\n| Agroline(仅970) | 16条 | €110K-€508K |\n| Agriaffaires(全系列) | 253条 | — |`,
    detailedContentEn: `## 2025 Jaguar 970 Consecutive Price Hikes\n\n**Key Finding:** CLAAS POLSKA dealer in Krzyzanow, Poland, raised 2025 970 price for 2 consecutive days\n\n| Date | Price | Change |\n|------|------|------|\n| June 8 | €507,300 | First sighting |\n| June 9 | **€507,800** | **+€500 (+0.10%)** |\n\n### 970 Series Value Retention\n| Metric | Value |\n|------|------|\n| 2025 (579h) current price | €507,800 ≈ CNY 3.986M |\n| 2017 domestic price | CNY 1.63M |\n| 8-year depreciation | Only 58.8% (industry avg 70%+) |\n| 970 value retention | **Very strong** |\n\n### Signal Interpretation\n- High-end 970 supply tight, dealer confident to raise prices\n- Strong hold/upside signal for 2017 970 (CNY 1.63M) holders\n- Recommend modest price increase of 100-150K RMB\n\n### Agroline/Agriaffaires 970 Listings\n| Source | Count | Price Range |\n|-------|---------|--------|\n| Agroline (970 only) | 16 listings | €110K-€508K |\n| Agriaffaires (all series) | 253 listings | — |`,
    detailedContentRu: `## Jaguar 970 2025 года — последовательное повышение цен\n\n**Ключевая находка:** Дилер CLAAS POLSKA в Кшижанове, Польша, второй день подряд повышает цену на 970 2025 года\n\n| Дата | Цена | Изменение |\n|------|------|------|\n| 8 июня | €507,300 | Первое появление |\n| 9 июня | **€507,800** | **+€500 (+0.10%)** |\n\n### Сохранение стоимости серии 970\n| Показатель | Значение |\n|------|------|\n| 2025 (579 моточасов) текущая цена | €507,800 ≈ 3.986 млн юаней |\n| 2017 внутренняя цена | 1.63 млн юаней |\n| Амортизация за 8 лет | всего 58.8% (среднеотраслевая 70%+) |\n| Сохранение стоимости 970 | **Очень сильное** |\n\n### Интерпретация сигнала\n- Предложение высококлассных 970 ограничено, дилер уверенно повышает цены\n- Сильный сигнал удержания/роста для владельцев 970 2017 (1.63 млн юаней)\n- Рекомендуется умеренное повышение цены на 100-150 тыс. юаней`,
    actionTips: ['["持有2017款970适度上调报价10-15万", "970系列重点推向俄语区+乌克兰买家", "制作970系列价格对比表凸显性价比"]'],
  },
  {
    icon: "🇺🇦", region: "乌克兰", tags: ["FAO恢复计划", "AGRO 2026"], date: TODAY,
    text: "FAO发布乌克兰三年紧急恢复计划！2026年谷物产量83.6百万吨(+4.5%)，农机进口需求确定性强",
    textEn: "FAO releases Ukraine 3-year emergency recovery plan! 2026 grain output 83.6M tons (+4.5%), agricultural machinery import demand highly certain",
    textRu: "ФАО публикует 3-летний план чрезвычайного восстановления Украины! Прогноз урожая зерна в 2026 году 83.6 млн тонн (+4.5%), спрос на импорт сельхозтехники высокоопределённый",
    regionEn: "Ukraine", regionRu: "Украина",
    tagsEn: '["FAO Recovery Plan", "AGRO 2026"]', tagsRu: '["План восстановления ФАО", "AGRO 2026"]',
    detailedContent: `## FAO乌克兰三年紧急恢复计划\n\n**发布时间：** 2026年6月1日，基辅\n\n### 核心数据\n| 指标 | 数值 |\n|------|------|\n| 2026年谷物产量 | 83.6百万吨 |\n| 同比增幅 | +3.6百万吨(+4.5% YoY) |\n| 项目方向 | 排雷+灌溉修复+农机替代 |\n| 资金状态 | 国际资金到位 |\n| AGRO 2026展 | 7月基辅第34届 |\n\n### 对神雕农机的影响\n| 机会 | 说明 |\n|------|------|\n| 农机替代需求 | 战后设备被毁恢复性采购 |\n| 黑海贸易恢复 | 物流可行 |\n| 国际资金支持 | 支付能力有保障 |\n| 展前窗口 | 7月AGRO展前线上对接最佳时机 |\n\n### 推荐目标机型\n- CLAAS 980(2016) 75.7%价差 → 青储机首选\n- CLAAS 5300RC(2022) 52.8%价差 → 大方捆需求\n- 基辅970(2016/1920h) → 直接对标`,
    detailedContentEn: `## FAO Ukraine 3-Year Emergency Recovery Plan\n\n**Release Date:** June 1, 2026, Kyiv\n\n### Core Data\n| Indicator | Value |\n|------|------|\n| 2026 grain output | 83.6M tons |\n| YoY increase | +3.6M tons (+4.5% YoY) |\n| Project directions | Demining + irrigation restoration + machinery replacement |\n| Funding status | International funds secured |\n| AGRO 2026 Exhibition | July, Kyiv, 34th edition |\n\n### Impact on ShenDiao Agricultural Machinery\n| Opportunity | Description |\n|------|------|\n| Machinery replacement demand | Restorative buying of destroyed equipment |\n| Black Sea trade restored | Logistics feasible |\n| International funding support | Payment capacity assured |\n| Pre-exhibition window | Best timing for online outreach before AGRO 2026 in July |\n\n### Recommended Target Models\n- CLAAS 980(2016) 75.7% spread → Forage harvester priority\n- CLAAS 5300RC(2022) 52.8% spread → Large square baler demand\n- Kyiv 970(2016/1920h) → Direct benchmark`,
    detailedContentRu: `## 3-летний план чрезвычайного восстановления Украины ФАО\n\n**Дата публикации:** 1 июня 2026 года, Киев\n\n### Основные данные\n| Показатель | Значение |\n|------|------|\n| Урожай зерна 2026 | 83.6 млн тонн |\n| Рост к предыдущему году | +3.6 млн тонн (+4.5%) |\n| Направления проекта | Разминирование + восстановление орошения + замена техники |\n| Статус финансирования | Международное финансирование обеспечено |\n| Выставка AGRO 2026 | Июль, Киев, 34-я |\n\n### Влияние на ШэньДяо Сельхозтехника\n| Возможность | Описание |\n|------|------|\n| Спрос на замену техники | Восстановительные закупки уничтоженного оборудования |\n| Восстановление торговли по Чёрному морю | Логистика реальна |\n| Международное финансирование | Платёжеспособность обеспечена |\n| Окно перед выставкой | Лучшее время для онлайновой работы до AGRO 2026 в июле |\n\n### Рекомендуемые целевые модели\n- CLAAS 980(2016) разница 75.7% → приоритет силосоуборочных\n- CLAAS 5300RC(2022) разница 52.8% → спрос на большие пресс-подборщики\n- Киев 970(2016/1920 моточасов) → прямое сравнение`,
    actionTips: ['["FAO乌克兰计划窗口重点推980+5300RC", "7月AGRO 2026展前完成线上对接", "关注黑海贸易路线物流方案落地"]'],
  },
  {
    icon: "🇨🇳", region: "中国", tags: ["980套利王", "75.7%价差"], date: TODAY,
    text: "Jaguar 980(2016)青储机套利王！EU€320K→251.2万 vs 国内143万，价差108.2万(75.7%)",
    textEn: "Jaguar 980(2016) forage harvester arbitrage king! EU€320K→CNY2.512M vs domestic CNY1.43M, spread CNY1.082M (75.7%)",
    textRu: "Jaguar 980(2016) — король арбитража силосоуборочных! ЕС€320K→2.512 млн юаней vs внутренние 1.43 млн, разница 1.082 млн (75.7%)",
    regionEn: "China", regionRu: "Китай",
    tagsEn: '["980 Arbitrage King", "75.7% Spread"]', tagsRu: '["980 Король арбитража", "75.7% разница"]',
    detailedContent: `## Jaguar 980 套利分析\n\n**核心标的：** CLAAS Jaguar 980 (2016)，法国厄尔省980(2023)€320K参考价 = 251.2万元\n\n### 套利排行\n| 排名 | 机型 | 国际价 | 国内价 | 价差 | 价差率 |\n|------|------|--------|--------|------|--------|\n| 1 | 5300RC(2020) | 85万 | 18万 | 67.0万 | **372.2%** |\n| 2 | FR450(2013) | 43.3万 | 21.5万 | 21.8万 | **101.4%** |\n| 3 | **980(2016)** | **251.2万** | **143万** | **108.2万** | **75.7%** |\n| 4 | BigM 420(2018) | 78.5万 | 49万 | 29.5万 | 60.2% |\n| 5 | 5300RC(2022) | 145.2万 | 95万 | 50.2万 | 52.8% |\n| 6 | MF 3404(2022) | 141.3万 | 105万 | 36.3万 | 34.6% |\n| 7 | 970(2017) | 206.8万 | 163万 | 43.8万 | 26.9% |\n\n### 980操作建议\n- 优先推俄语区+乌克兰买家\n- 75.7%价差率在标准机型中最高\n- FAO乌克兰计划+AGRO 2026展双重催化\n- 建议本周内完成至少1台出口成交`,
    detailedContentEn: `## Jaguar 980 Arbitrage Analysis\n\n**Core Target:** CLAAS Jaguar 980 (2016), France Eure 980(2023) €320K reference = CNY 2.512M\n\n### Arbitrage Ranking\n| Rank | Model | International | Domestic | Spread | Spread Rate |\n|------|------|--------|--------|------|--------|\n| 1 | 5300RC(2020) | CNY 850K | CNY 180K | CNY 670K | **372.2%** |\n| 2 | FR450(2013) | CNY 433K | CNY 215K | CNY 218K | **101.4%** |\n| 3 | **980(2016)** | **CNY 2.512M** | **CNY 1.43M** | **CNY 1.082M** | **75.7%** |\n| 4 | BigM 420(2018) | CNY 785K | CNY 490K | CNY 295K | 60.2% |\n| 5 | 5300RC(2022) | CNY 1.452M | CNY 950K | CNY 502K | 52.8% |\n| 6 | MF 3404(2022) | CNY 1.413M | CNY 1.05M | CNY 363K | 34.6% |\n| 7 | 970(2017) | CNY 2.068M | CNY 1.63M | CNY 438K | 26.9% |\n\n### 980 Action Recommendations\n- Prioritize Russian-speaking + Ukrainian buyers\n- 75.7% spread rate highest among standard models\n- FAO Ukraine plan + AGRO 2026 dual catalyst\n- Complete at least 1 unit export this week`,
    detailedContentRu: `## Арбитражный анализ Jaguar 980\n\n**Основная цель:** CLAAS Jaguar 980 (2016), Франция Эр 980(2023) €320K справочная = 2.512 млн юаней\n\n### Рейтинг арбитража\n| Ранг | Модель | Международная | Внутренняя | Разница | Ставка |\n|------|------|--------|--------|------|--------|\n| 1 | 5300RC(2020) | 850 тыс. | 180 тыс. | 670 тыс. | **372.2%** |\n| 2 | FR450(2013) | 433 тыс. | 215 тыс. | 218 тыс. | **101.4%** |\n| 3 | **980(2016)** | **2.512 млн** | **1.43 млн** | **1.082 млн** | **75.7%** |\n| 4 | BigM 420(2018) | 785 тыс. | 490 тыс. | 295 тыс. | 60.2% |\n| 5 | 5300RC(2022) | 1.452 млн | 950 тыс. | 502 тыс. | 52.8% |\n| 6 | MF 3404(2022) | 1.413 млн | 1.05 млн | 363 тыс. | 34.6% |\n| 7 | 970(2017) | 2.068 млн | 1.63 млн | 438 тыс. | 26.9% |\n\n### Рекомендации по 980\n- Приоритет: русскоязычные + украинские покупатели\n- 75.7% самая высокая среди стандартных моделей\n- Двойной катализатор: план ФАО Украина + AGRO 2026\n- Завершить экспорт минимум 1 ед. на этой неделе`,
    actionTips: ['["980优先推俄语区+乌克兰买家", "75.7%价差率全系列标准机型最高", "本周内完成980+FR450各至少1单"]'],
  },
  {
    icon: "⚡", region: "中国", tags: ["FR450爆款", "101.4%价差"], date: TODAY,
    text: "New Holland FR450(2013)爆款速推！21.5万/台+101.4%价差率+10台库存，汇率波动影响最小",
    textEn: "New Holland FR450(2013) hot seller push! CNY 215K/unit + 101.4% spread rate + 10 units in stock, minimal FX impact",
    textRu: "New Holland FR450(2013) хит продаж! 215 тыс. юаней/ед. + ставка разницы 101.4% + 10 ед. складе, минимальное влияние валют",
    regionEn: "China", regionRu: "Китай",
    tagsEn: '["FR450 Hot Seller", "101.4% Spread"]', tagsRu: '["FR450 хит продаж", "101.4% разница"]',
    detailedContent: `## FR450爆款速推\n\n**核心优势：** 一口价21.5万/台 + 101.4%价差率 + 汇率波动影响最小\n\n### FR450套利参数\n| 指标 | 数值 |\n|------|------|\n| 国内售价 | 21.5万/台 |\n| 俄市场参考价 | 43.3万 |\n| 价差 | 21.8万/台 |\n| 价差率 | **101.4%** |\n| 库存 | **10台** |\n| 汇率敏感度 | 低（绝对价差21.8万） |\n\n### 为什么是爆款？\n1. **翻倍利润**：101.4%价差率，买一台赚一台\n2. **低门槛**：21.5万/台，买家决策周期短\n3. **走量模式**：10台库存，适合批量批发\n4. **利润确定性强**：绝对价差仅21.8万，汇率波动±5%影响仅±1万\n\n### 对标昨日变化\n| 项目 | 6月8日 | 6月9日 | 变化 |\n|------|--------|--------|------|\n| FR450价差率 | 101.4% | **101.4%** | 持平 |\n| EUR/CNY | 7.89 | 7.8476 | ↓-0.56% |\n| FR450受影响 | 极小 | **极小** | 稳定 |`,
    detailedContentEn: `## FR450 Hot Seller Push\n\n**Core Advantage:** Fixed price CNY 215K/unit + 101.4% spread rate + minimal FX impact\n\n### FR450 Arbitrage Parameters\n| Indicator | Value |\n|------|------|\n| Domestic price | CNY 215K/unit |\n| Russian market reference | CNY 433K |\n| Spread | CNY 218K/unit |\n| Spread rate | **101.4%** |\n| Inventory | **10 units** |\n| FX sensitivity | Low (absolute spread CNY 218K) |\n\n### Why It's a Hot Seller\n1. **Double profit**: 101.4% spread rate, buy one earn one\n2. **Low barrier**: CNY 215K/unit, short buyer decision cycle\n3. **Volume model**: 10 units inventory, suitable for wholesale\n4. **High profit certainty**: Only CNY 218K absolute spread, ±5% FX impact = ±CNY 10K\n\n### Comparison vs Yesterday\n| Item | June 8 | June 9 | Change |\n|------|--------|--------|------|\n| FR450 spread rate | 101.4% | **101.4%** | Unchanged |\n| EUR/CNY | 7.89 | 7.8476 | ↓-0.56% |\n| FR450 impact | Minimal | **Minimal** | Stable |`,
    detailedContentRu: `## FR450 хит продаж\n\n**Главное преимущество:** Фиксированная цена 215 тыс. юаней/ед. + ставка разницы 101.4% + минимальное влияние валют\n\n### Параметры арбитража FR450\n| Показатель | Значение |\n|------|------|\n| Внутренняя цена | 215 тыс. юаней/ед. |\n| Справочная на рынке РФ | 433 тыс. юаней |\n| Разница | 218 тыс. юаней/ед. |\n| Ставка | **101.4%** |\n| Остаток | **10 ед.** |\n| Чувствительность к валютам | Низкая |\n\n### Почему хит\n1. **Двойная прибыль**: 101.4% разницы\n2. **Низкий порог**: 215 тыс. юаней/ед., быстрое решение\n3. **Объёмная модель**: 10 ед. на складе\n4. **Высокая определённость**: всего 218 тыс. разница`,
    actionTips: ['["FR450俄语区批量速推10台", "21.5万低门槛吸引小型买家走量", "汇率波动几乎不影响FR450利润"]'],
  },
  {
    icon: "💥", region: "中国", tags: ["5300RC", "372.2%价差率"], date: TODAY,
    text: "CLAAS 5300RC(2020)18万白菜价全品类第一！国际同级85万+，372%价差率但需确认车况",
    textEn: "CLAAS 5300RC(2020) bargain price of CNY 180K ranks #1 across all categories! International equivalent CNY 850K+, 372% spread rate but needs condition verification",
    textRu: "CLAAS 5300RC(2020) по цене 180 тыс. юаней — №1 во всех категориях! Международный аналог 850 тыс.+, разница 372%, но требует проверки состояния",
    regionEn: "China", regionRu: "Китай",
    tagsEn: '["5300RC", "372.2% Spread"]', tagsRu: '["5300RC", "372.2% разница"]',
    detailedContent: `## CLAAS 5300RC(2020) 372.2%价差分析\n\n**核心数据：** 国内售价18万，国际同级大型打捆机参考价85万元\n\n### 价差对比\n| 机型 | 国内价 | 国际参考价 | 价差 | 价差率 |\n|------|--------|-----------|------|--------|\n| **5300RC(2020)** | **18万** | **85万** | **67.0万** | **372.2%** |\n| FR450(2013) | 21.5万 | 43.3万 | 21.8万 | 101.4% |\n| BigM 420(2018) | 49万 | 78.5万 | 29.5万 | 60.2% |\n\n### 风险提示\n| 风险项 | 说明 |\n|--------|------|\n| 车况未知 | 18万极低价可能伴随维修需求 |\n| 买方信任 | 极低价位买家可能顾虑质量 |\n| 关联推荐 | 同时推5300RC(2022全新)95万，形成对比组合 |\n\n### 策略建议\n- 5300RC(2020) + 5300RC(2022全新)打包推广\n- 低价吸引买家咨询后转推更高价产品\n- FAO乌克兰计划对大方捆需求确定`,
    detailedContentEn: `## CLAAS 5300RC(2020) 372.2% Spread Analysis\n\n**Core Data:** Domestic CNY 180K, international large square baler reference CNY 850K\n\n### Spread Comparison\n| Model | Domestic | International | Spread | Spread Rate |\n|------|--------|-----------|------|--------|\n| **5300RC(2020)** | **CNY 180K** | **CNY 850K** | **CNY 670K** | **372.2%** |\n| FR450(2013) | CNY 215K | CNY 433K | CNY 218K | 101.4% |\n| BigM 420(2018) | CNY 490K | CNY 785K | CNY 295K | 60.2% |\n\n### Risk Notes\n| Risk | Description |\n|--------|------|\n| Condition unknown | Extremely low price may imply repair needs |\n| Buyer trust | Very low price may raise quality concerns |\n| Cross-promotion | Bundle with 5300RC(2022 new) CNY 950K for contrast |\n\n### Strategy\n- Bundle 5300RC(2020) + 5300RC(2022 new) promotion\n- Low price as lead magnet → upsell higher-priced products\n- FAO Ukraine plan confirms large baler demand`,
    detailedContentRu: `## CLAAS 5300RC(2020) 372.2% анализ разницы\n\n**Основные данные:** Внутренняя цена 180 тыс. юаней, международный большой пресс-подборщик 850 тыс. юаней\n\n### Сравнение разницы\n| Модель | Внутренняя | Международная | Разница | Ставка |\n|------|--------|-----------|------|--------|\n| **5300RC(2020)** | **180 тыс.** | **850 тыс.** | **670 тыс.** | **372.2%** |\n| FR450(2013) | 215 тыс. | 433 тыс. | 218 тыс. | 101.4% |\n| BigM 420(2018) | 490 тыс. | 785 тыс. | 295 тыс. | 60.2% |\n\n### Риски\n| Риск | Описание |\n|--------|------|\n| Состояние неизвестно | Чрезвычайно низкая цена может означать ремонт |\n| Доверие покупателя | Очень низкая цена вызывает вопросы качества |\n| Перекрёстное продвижение | Пакет с 5300RC(2022 новый) 950 тыс. |`,
    actionTips: ['["5300RC(2020)作为引流品吸引买家咨询", "与5300RC(2022全新)打包推广提升客单价", "需提前确认车况并提供详细检测报告"]'],
  },
  {
    icon: "🇷🇺", region: "俄罗斯", tags: ["EU制裁", "替代窗口"], date: TODAY,
    text: "EU第20轮对俄制裁持续发酵！欧美农机配件断供加剧，中国设备替代窗口再扩大",
    textEn: "EU 20th round sanctions on Russia continue to escalate! Western machinery parts supply disruption deepens, Chinese equipment substitution window widens further",
    textRu: "20-й раунд санкций ЕС против России продолжает усиление! Перебои с запчастями западной техники углубляются, окно замещения китайским оборудованием расширяется",
    regionEn: "Russia", regionRu: "Россия",
    tagsEn: '["EU Sanctions", "Substitution Window"]', tagsRu: '["Санкции ЕС", "Окно замещения"]',
    detailedContent: `## EU第20轮对俄制裁最新影响\n\n**制裁背景：** 4月23日欧盟发布第20轮对俄制裁，120项新制裁清单为2年最大规模，持续发酵中\n\n### 影响维度\n| 维度 | 现状 | 趋势 |\n|------|------|------|\n| 欧美配件供应 | CLAAS/Deere/Kubota配件断供加剧 | ⬆️ 恶化 |\n| 中国二手替代 | 不受制裁限制 | ⬆️ 加速 |\n| 俄优先产业 | 农机排**第一** | ⬆️ 政策支持 |\n| 中俄铁路物流 | 正常运输30-40天 | ✅ 稳定 |\n| 巴西进口替代 | Q1销量-13.1%，本地产不足 | ⬆️ 进口替代加速 |\n\n### 俄罗斯市场信号\n| 信号 | 详情 |\n|------|------|\n| 2026年农机优先产业第1 | 5%低关税+政府补贴 |\n| CTT展后线上 | 持续跟进中 |\n| 卢布汇率 | 相对稳定 |\n\n### 应对策略\n- 重点推CLAAS二手系列(970/980/850)\n- 提供俄语+配件供应承诺增强信任\n- 建立莫斯科/新西伯利亚备件仓`,
    detailedContentEn: `## Latest Impact of EU 20th Sanctions on Russia\n\n**Background:** EU published 20th sanctions on April 23 with 120 new items — largest in 2 years, continuing to escalate\n\n### Impact Matrix\n| Dimension | Status | Trend |\n|------|------|------|\n| Western parts supply | CLAAS/Deere/Kubota disruption deepens | ⬆️ Worsening |\n| Chinese used substitution | Not affected by sanctions | ⬆️ Accelerating |\n| Russia priority | Machinery ranked **#1** | ⬆️ Policy support |\n| China-Russia rail | Normal 30-40 days | ✅ Stable |\n| Brazil import substitution | Q1 -13.1%, local production insufficient | ⬆️ Import substitution accelerating |\n\n### Russia Market Signals\n| Signal | Detail |\n|------|------|\n| 2026 machinery priority #1 | 5% low tariff + gov subsidies |\n| Post-CTT online follow-up | Ongoing |\n| RUB exchange rate | Relatively stable |\n\n### Strategy\n- Focus on CLAAS used series (970/980/850)\n- Provide Russian + parts supply commitment\n- Establish Moscow/Novosibirsk parts warehouse`,
    detailedContentRu: `## Последнее влияние 20-го раунда санкций ЕС на Россию\n\n**Предыстория:** ЕС опубликовал 20-й раунд санкций 23 апреля, 120 новых позиций — крупнейший за 2 года, продолжает усиливаться\n\n### Матрица влияния\n| Измерение | Статус | Тренд |\n|------|------|------|\n| Поставки западных запчастей | Перебои CLAAS/Deere/Kubota углубляются | ⬆️ Ухудшение |\n| Замена китайской б/у | Не подпадает под санкции | ⬆️ Ускорение |\n| Приоритет РФ | Сельхозтехника **№1** | ⬆️ Поддержка политики |\n| Ж/д Китай-Россия | Нормально 30-40 дней | ✅ Стабильно |\n| Импортозамещение Бразилии | Q1 -13.1% | ⬆️ Ускорение |\n\n### Сигналы рынка РФ\n- Сельхозтехника приоритет №1 в 2026\n- 5% низкая пошлина + господдержка\n- Курс рубля относительно стабилен`,
    actionTips: ['["重点推CLAAS二手970/980/850替代欧美断供", "提供俄语+配件供应承诺增强买家信任", "利用5%低关税+政府补贴政策促销"]'],
  },
  {
    icon: "🇺🇿", region: "乌兹别克斯坦", tags: ["增速最快", "+256%"], date: TODAY,
    text: "乌兹别克斯坦Q1进口+256.77%全球最快！棉花采收机械化率不足40%，需求空间巨大",
    textEn: "Uzbekistan Q1 imports +256.77% globally fastest! Cotton harvesting mechanization below 40%, massive demand potential",
    textRu: "Узбекистан Q1 импорт +256.77% — самый быстрый в мире! Механизация хлопкоуборки ниже 40%, огромный потенциал спроса",
    regionEn: "Uzbekistan", regionRu: "Узбекистан",
    tagsEn: '["Fastest Growth", "+256%"]', tagsRu: '["Самый быстрый рост", "+256%"]',
    detailedContent: `## 乌兹别克斯坦市场持续爆发\n\n| 指标 | 数值 |\n|------|------|\n| Q1进口增速 | **+256.77%** |\n| 棉花采收机械化率 | 不足40% |\n| 政府补贴 | 农机购置补贴50% |\n| 中吉乌铁路 | 建设加速中 |\n\n### 推荐出口机型\n| 品类 | 推荐型号 | 报价区间 |\n|------|---------|---------|\n| 青储收获机 | CLAAS 850/860 | 60-120万 |\n| 拖拉机 | NH/Deere 100-200HP | 30-80万 |\n| 打捆机 | Krone 500/600 | 15-40万 |\n\n### 行动重点\n- 棉花采收相关机型优先推广\n- 利用政府50%补贴设计融资方案\n- 中吉乌铁路建成后物流更便捷\n- 乌兹别克语+俄语版产品手册优先制作`,
    detailedContentEn: `## Uzbekistan Market Continues to Surge\n\n| Indicator | Value |\n|------|------|\n| Q1 import growth | **+256.77%** |\n| Cotton harvesting mechanization | Below 40% |\n| Government subsidies | 50% machinery purchase subsidy |\n| China-Kyrgyzstan-Uzbekistan railway | Construction accelerating |\n\n### Recommended Export Models\n| Category | Recommended | Price Range |\n|------|---------|---------|\n| Forage harvesters | CLAAS 850/860 | CNY 600K-1.2M |\n| Tractors | NH/Deere 100-200HP | CNY 300K-800K |\n| Balers | Krone 500/600 | CNY 150K-400K |\n\n### Action Focus\n- Prioritize cotton harvesting related models\n- Design financing using 50% government subsidy\n- Logistics more convenient after railway completion\n- Uzbek + Russian product manuals priority`,
    detailedContentRu: `## Рынок Узбекистана продолжает бурный рост\n\n| Показатель | Значение |\n|------|------|\n| Рост импорта Q1 | **+256.77%** |\n| Механизация хлопкоуборки | Ниже 40% |\n| Господдержка | 50% субсидия на покупку |\n| Ж/д Китай-Кыргызстан-Узбекистан | Строительство ускоряется |\n\n### Рекомендуемые модели для экспорта\n| Категория | Рекомендация | Цена |\n|------|---------|---------|\n| Силосоуборочные | CLAAS 850/860 | 600 тыс.-1.2 млн |\n| Тракторы | NH/Deere 100-200 л.с. | 300-800 тыс. |\n| Пресс-подборщики | Krone 500/600 | 150-400 тыс. |\n\n### Основные действия\n- Приоритет моделей для уборки хлопка\n- 50% господдержка для финансирования`,
    actionTips: ['["乌兹别克语+俄语版产品手册优先制作", "棉花采收机型重点推广", "50%政府补贴融资方案设计"]'],
  },
  {
    icon: "🇧🇷", region: "巴西", tags: ["5300RC", "进口替代"], date: TODAY,
    text: "巴西Q1农机销量-13.1%但进口替代加速！全新5300RC(95万)51.9%价差，14%关税+审批",
    textEn: "Brazil Q1 machinery sales -13.1% but import substitution accelerating! New 5300RC(CNY 950K) 51.9% spread, 14% tariff + approval",
    textRu: "Продажи техники в Бразилии Q1 -13.1%, но импортозамещение ускоряется! Новый 5300RC (950K юаней) разница 51.9%, пошлина 14% + одобрение",
    regionEn: "Brazil", regionRu: "Бразилия",
    tagsEn: '["5300RC", "Import Substitution"]', tagsRu: '["5300RC", "Импортозамещение"]',
    detailedContent: `## 巴西农机市场\n\n| 指标 | 数值 |\n|------|------|\n| Q1销量增速 | -13.1% |\n| 进口替代趋势 | 加速中 |\n| 5300RC国内价 | 95万(全新) |\n| 国际同级参考 | €185K(145.2万) |\n| 价差率 | **51.9%** |\n| 巴西进口关税 | 14%+MAPA审批 |\n| 交货周期 | 35-45天 |\n\n### 5300RC巴西机会分析\n- 全新大方捆(95万)为巴西农场核心需求\n- 14%关税需提前完成MAPA审批\n- 交货周期35-45天可控\n- 建议制作葡萄牙语产品手册\n- Q1销量下滑(-13.1%)意味着国产供应不足，进口替代加速`,
    detailedContentEn: `## Brazil Agricultural Machinery Market\n\n| Indicator | Value |\n|------|------|\n| Q1 sales growth | -13.1% |\n| Import substitution trend | Accelerating |\n| 5300RC domestic price | CNY 950K (brand new) |\n| International reference | €185K (CNY 1.452M) |\n| Spread rate | **51.9%** |\n| Brazil import tariff | 14% + MAPA approval |\n| Delivery cycle | 35-45 days |\n\n### 5300RC Brazil Opportunity Analysis\n- Brand new large square baler (CNY 950K) is core demand for Brazilian farms\n- 14% tariff requires MAPA pre-approval\n- 35-45 day delivery cycle manageable\n- Recommend Portuguese product manual\n- Q1 decline (-13.1%) means insufficient domestic supply, substitution accelerating`,
    detailedContentRu: `## Рынок сельхозтехники Бразилии\n\n| Показатель | Значение |\n|------|------|\n| Рост продаж Q1 | -13.1% |\n| Тренд импортозамещения | Ускоряется |\n| 5300RC внутренняя цена | 950 тыс. юаней (новый) |\n| Международная справочная | €185K (1.452 млн) |\n| Разница | **51.9%** |\n| Пошлина Бразилии | 14% + одобрение MAPA |\n| Цикл поставки | 35-45 дней |\n\n### Анализ возможностей 5300RC в Бразилии\n- Новый большой пресс-подборщик — ключевой спрос\n- Пошлина 14% требует предварительного одобрения`,
    actionTips: ['["5300RC全新大方捆优先推送巴西买家", "提前完成14%关税及MAPA审批流程", "制作葡萄牙语产品手册"]'],
  },
  {
    icon: "🌍", region: "全球", tags: ["BigM东欧", "NAMPO非洲"], date: TODAY,
    text: "BigM 420(2018)东欧60.2%价差+Krone品牌优势；南非NAMPO展后需求增长，肯尼亚+46.6%",
    textEn: "BigM 420(2018) 60.2% spread in Eastern Europe + Krone brand advantage; Post-NAMPO South Africa demand growing, Kenya +46.6%",
    textRu: "BigM 420(2018) 60.2% разница в Восточной Европе + преимущество бренда Krone; Спрос после NAMPO в ЮАР растёт, Кения +46.6%",
    regionEn: "Global", regionRu: "Глобально",
    tagsEn: '["BigM Eastern Europe", "NAMPO Africa"]', tagsRu: '["BigM Восточная Европа", "NAMPO Африка"]',
    detailedContent: `## 全球市场多点开花\n\n### BigM 420(2018)东欧推进\n| 参数 | 数值 |\n|------|------|\n| 国内售价 | 49万 |\n| 国际参考价(EU€100K) | 78.5万 |\n| 价差 | 29.5万 |\n| 价差率 | **60.2%** |\n| 品牌 | Krone（欧洲认可度高） |\n\n### 非洲市场动态\n| 区域 | 特点 | 需求机型 |\n|------|------|--------|\n| 🇰🇪 肯尼亚 | 进口+46.6% | 50-100HP拖拉机 |\n| 🇳🇬 尼日利亚 | 可耕地最大 | 中型拖拉机/收割机 |\n| 🇿🇦 南非 | 商业化农业 | 大型农机具 |\n\n### 机会点\n- Krone品牌在欧洲有天然认可度，BigM 420东欧推进阻力小\n- 非洲中国二手=欧洲新品20-30%价格\n- 非洲大陆自贸区降低关税壁垒\n- 肯尼亚+46.6%确认增长趋势`,
    detailedContentEn: `## Global Market Multi-Point Bloom\n\n### BigM 420(2018) Eastern Europe Push\n| Parameter | Value |\n|------|------|\n| Domestic price | CNY 490K |\n| International reference (EU€100K) | CNY 785K |\n| Spread | CNY 295K |\n| Spread rate | **60.2%** |\n| Brand | Krone (high European recognition) |\n\n### Africa Market Dynamics\n| Region | Feature | Demanded Models |\n|------|------|--------|\n| 🇰🇪 Kenya | Imports +46.6% | 50-100HP tractors |\n| 🇳🇬 Nigeria | Largest arable land | Medium tractors / Harvesters |\n| 🇿🇦 South Africa | Commercial farming | Large machinery |\n\n### Opportunities\n- Krone brand naturally recognized in Europe, low resistance for BigM 420 Eastern Europe push\n- Chinese used = 20-30% of European new prices in Africa\n- African Continental Free Trade Area reduces tariff barriers\n- Kenya +46.6% confirms growth trend`,
    detailedContentRu: `## Глобальное многоточечное развитие\n\n### BigM 420(2018) продвижение в Восточной Европе\n| Параметр | Значение |\n|------|------|\n| Внутренняя цена | 490 тыс. юаней |\n| Международная (€100K) | 785 тыс. юаней |\n| Разница | 295 тыс. юаней |\n| Ставка | **60.2%** |\n| Бренд | Krone (высокое признание в Европе) |\n\n### Динамика рынка Африки\n| Регион | Особенность | Востребованные модели |\n|------|------|--------|\n| 🇰🇪 Кения | Импорт +46.6% | Тракторы 50-100 л.с. |\n| 🇳🇬 Нигерия | Крупнейшие пашни | Средние тракторы |\n| 🇿🇦 ЮАР | Коммерческое фермерство | Крупная техника |`,
    actionTips: '["BigM 420利用Krone品牌优势主推东欧市场", "非洲市场主推50-100HP拖拉机占位", "肯尼亚+尼日利亚高潜市场重点跟进"]',
  },
  {
    icon: "📋", region: "全球", tags: ["操作建议", "7大优先级"], date: TODAY,
    text: "今日7大操作优先级：980俄语区→FR450爆款速推→5300RC乌克兰线→汇率对冲→BigM东欧→AGRO展→2025款970涨价信号",
    textEn: "Today's 7 priorities: 980 Russian region push → FR450 hot seller → 5300RC Ukraine line → FX hedge → BigM Eastern Europe → AGRO exhibition → 2025 970 price hike signal",
    textRu: "7 приоритетов сегодня: 980 русскоязычный регион → FR450 хит → 5300RC Украина → хеджирование валют → BigM Восточная Европа → AGRO → сигнал роста цен 2025 970",
    regionEn: "Global", regionRu: "Глобально",
    tagsEn: '["Action Plan", "7 Priorities"]', tagsRu: '["План действий", "7 приоритетов"]',
    detailedContent: `## 今日7大操作优先级\n\n| 优先级 | 操作 | 价差率 | 紧迫度 | 原因 |\n|--------|------|--------|--------|------|\n| 1 | 980加速俄语区成交 | 75.7% | 🔴 最急 | FAO+AGRO双重催化 |\n| 2 | FR450爆款10台速推 | 101.4% | 🔴 最急 | 汇率影响最小+走量 |\n| 3 | 5300RC乌克兰线 | 52.8% | 🟡 高 | FAO确认大方捆需求 |\n| 4 | 汇率对冲(CIPS结算) | — | 🟡 高 | EUR跌破7.85需锁定 |\n| 5 | BigM 420东欧推进 | 60.2% | 🟡 高 | Krone品牌优势 |\n| 6 | AGRO 2026展对接 | — | 🟢 中 | 7月基辅展前准备 |\n| 7 | 2025款970涨价跟踪 | — | 🟢 中 | 连涨两日信号强烈 |\n\n### 关键时间节点\n- **今日9:15**：央行公布EUR/CNY中间价\n- **7月**：AGRO 2026乌克兰展\n- **本周内**：完成980+FR450各至少1单`,
    detailedContentEn: `## Today's 7 Action Priorities\n\n| Priority | Action | Spread Rate | Urgency | Reason |\n|--------|------|--------|--------|------|\n| 1 | 980 Russian region push | 75.7% | 🔴 Most urgent | FAO+AGRO dual catalyst |\n| 2 | FR450 hot seller 10 units | 101.4% | 🔴 Most urgent | Minimal FX impact + volume |\n| 3 | 5300RC Ukraine line | 52.8% | 🟡 High | FAO confirms large baler demand |\n| 4 | FX hedge (CIPS settlement) | — | 🟡 High | EUR below 7.85 needs lock |\n| 5 | BigM 420 Eastern Europe | 60.2% | 🟡 High | Krone brand advantage |\n| 6 | AGRO 2026 exhibition prep | — | 🟢 Medium | July Kyiv preparation |\n| 7 | 2025 970 price hike tracking | — | 🟢 Medium | 2-day consecutive strong signal |\n\n### Key Milestones\n- **Today 9:15**: PBOC announces EUR/CNY midpoint\n- **July**: AGRO 2026 Ukraine exhibition\n- **This week**: Complete at least 1 order each for 980 + FR450`,
    detailedContentRu: `## 7 приоритетов действий на сегодня\n\n| Приоритет | Действие | Ставка | Срочность | Причина |\n|--------|------|--------|--------|------|\n| 1 | 980 русскоязычный регион | 75.7% | 🔴 Срочно | Двойной катализатор FAO+AGRO |\n| 2 | FR450 хит 10 ед. | 101.4% | 🔴 Срочно | Мин. влияние валют + объём |\n| 3 | 5300RC Украина | 52.8% | 🟡 Высокая | FAO подтверждает спрос |\n| 4 | Хеджирование валют | — | 🟡 Высокая | EUR ниже 7.85 |\n| 5 | BigM 420 Вост. Европа | 60.2% | 🟡 Высокая | Бренд Krone |\n| 6 | AGRO 2026 подготовка | — | 🟢 Средняя | Подготовка к июлю |\n| 7 | Рост 970 2025 отслеживание | — | 🟢 Средняя | 2 дня подряд |\n\n### Ключевые вехи\n- **Сегодня 9:15**: Средний курс EUR/CNY от НБК\n- **Июль**: AGRO 2026 Украина\n- **На этой неделе**: минимум 1 заказ 980 + FR450`,
    actionTips: '["980俄语区+FR450爆款双线并行推", "央行9:15中间价出炉后重新评估汇率风险", "本周内完成980+FR450各1单目标"]',
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
  console.log(`已导入 ${ALL_MARKET_INTEL.length} 条情报数据 (日期: 2026-06-09)`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
