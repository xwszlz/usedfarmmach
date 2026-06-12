/**
 * 导入2026-06-12市场情报数据到数据库
 * 基于 2026-06-12_跨境套利日报.md 生成
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const TODAY = new Date("2026-06-12");

const ALL_MARKET_INTEL = [
  {
    icon: "💶", region: "欧洲", tags: ["汇率稳定", "7.8425"], date: TODAY,
    text: "EUR/CNY连续两日完全持平于7.8425，两周波动<0.5%，套利空间极度稳定",
    textEn: "EUR/CNY flat for 2 consecutive days at 7.8425, 2-week volatility <0.5%, arbitrage space extremely stable",
    textRu: "EUR/CNY второй день подряд на уровне 7.8425, волатильность за 2 недели <0.5%, арбитражное пространство крайне стабильно",
    regionEn: "Europe", regionRu: "Европа",
    tagsEn: '["FX Stable", "7.8425"]', tagsRu: '["Курс стабилен", "7.8425"]',
    detailedContent: `## 汇率极度稳定期\n\n**EUR/CNY=7.8425(+0.00%)连续两日完全持平**，近11日EUR/CNY在7.82-7.85区间窄幅震荡。\n\n### 汇率快照\n| 货币对 | 中行折算价 | 现汇买入价 | 现汇卖出价 | 日环比 |\n|--------|-----------|-----------|-----------|-------|\n| EUR/CNY | **7.8425** | 781.68 | 787.41 | **0.00%** |\n| USD/CNY | **6.8150** | 676.47 | 679.32 | **0.00%** |\n\n### 关键信号\n- 两周内波动<0.5%，套利定价确定性极高\n- 现汇买卖差价5.73个点，正常水平\n- 套利空间极为稳定，出口利润格局稳固\n- 若EUR突破7.90需要调整定价策略`,
    detailedContentEn: `## Extreme FX Stability\n\n**EUR/CNY=7.8425(0.00%) flat for 2 consecutive days**, EUR/CNY oscillating in 7.82-7.85 range over past 11 days.\n\n### FX Snapshot\n| Pair | PBOC Midpoint | BOC Buying | BOC Selling | Daily Change |\n|--------|-----------|-----------|-----------|-------|\n| EUR/CNY | **7.8425** | 781.68 | 787.41 | **0.00%** |\n| USD/CNY | **6.8150** | 676.47 | 679.32 | **0.00%** |\n\n### Key Signals\n- 2-week volatility <0.5%, extremely high pricing certainty\n| BOC bid-ask spread | 5.73 points, normal level |\n| Arbitrage space | Extremely stable, export profit structure solid |\n| Risk | If EUR breaks 7.90, reprice strategy |`,
    detailedContentRu: `## Экстремальная стабильность валют\n\n**EUR/CNY=7.8425(0.00%) второй день подряд**, за последние 11 дней EUR/CNY колебался в диапазоне 7.82-7.85.\n\n### Снимок валют\n| Пара | Средний курс | Покупка БК | Продажа БК | Изменение |\n|--------|-----------|-----------|-----------|-------|\n| EUR/CNY | **7.8425** | 781.68 | 787.41 | **0.00%** |\n| USD/CNY | **6.8150** | 676.47 | 679.32 | **0.00%** |\n\n### Ключевые сигналы\n- Волатильность за 2 недели <0.5%, высокая определённость ценообразования\n| Спред купли-продажи БК | 5.73 пункта, нормальный уровень |\n| Арбитражное пространство | Крайне стабильно, структура экспортной прибыли прочная |\n| Риск | При пробое EUR 7.90 нужна корректировка стратегии |`,
    actionTips: ["利用汇率稳定期加速定价和成交", "若EUR突破7.90立即重新定价", "USD/CNY同步稳定利于美金定价"],
    dataSummary: '[{"label":"EUR/CNY","value":"7.8425(+0.00%)"},{"label":"两周波幅","value":"<0.5%"}]',
  },
  {
    icon: "🇩🇪", region: "欧洲", tags: ["2025款970", "英国廉16%"], date: TODAY,
    text: "2025款Jaguar 970€507,800历史高位企稳；英国市场970(2019)€265K比德国€316K便宜16%",
    textEn: "2025 Jaguar 970 €507,800 holds all-time high; UK market 970(2019) €265K vs Germany €316K, 16% cheaper",
    textRu: "Jaguar 970 2025 года €507,800 держится на историческом максимуме; рынок Великобритании 970(2019) €265K vs Германия €316K, на 16% дешевле",
    regionEn: "Europe", regionRu: "Европа",
    tagsEn: '["2025 970", "UK 16% Cheaper"]', tagsRu: '["970 2025", "Великобритания дешевле на 16%"]',
    detailedContent: `## 欧洲970系列价格分化\n\n**2025款970(仅579h)**：€507,800历史高位企稳，连续多日维持\n\n### 德国 vs 英国价格对比\n| 年份 | 德国价(EUR) | 英国价(EUR) | 差值 |\n|------|-----------|-----------|------|\n| 2019 970 | €315,840 | **€265,292** | -16.0% |\n| 2021 970 | €428,400 | €359,500 | — |\n\n### Agriaffaires数据\n- Jaguar全系列**278条**在售（较前日+2条）\n| 型号 | 年份 | 价格 |\n|------|------|------|\n| Jaguar 950 | 2025 | €449,000(仅314h) |\n| Jaguar 960 | 2022 | €382,353 |\n| Jaguar 880 | 2022 | €214,318 |\n\n### 英国市场战略意义\n脱欧后渠道分割加剧，英国欧盟外自主定价可能进一步产生价差，可供欧盟→非欧盟转口套利路径参考`,
    detailedContentEn: `## Europe 970 Series Price Divergence\n\n**2025 970 (only 579h)**: €507,800 holds all-time high, sustained for multiple days\n\n### Germany vs UK Price Comparison\n| Year | Germany (EUR) | UK (EUR) | Difference |\n|------|-----------|-----------|------|\n| 2019 970 | €315,840 | **€265,292** | -16.0% |\n| 2021 970 | €428,400 | €359,500 | — |\n\n### Agriaffaires Data\n- Jaguar series total **278 listings** (+2 vs previous day)\n| Model | Year | Price |\n|------|------|------|\n| Jaguar 950 | 2025 | €449,000 (only 314h) |\n| Jaguar 960 | 2022 | €382,353 |\n| Jaguar 880 | 2022 | €214,318 |\n\n### UK Market Strategic Significance\nPost-Brexit channel divergence may widen further, providing re-export arbitrage path reference from EU to non-EU`,
    detailedContentRu: `## Расхождение цен серии 970 в Европе\n\n**970 2025 года (всего 579 моточасов)**: €507,800 держится на историческом максимуме\n\n### Сравнение Германия vs Великобритания\n| Год | Германия (EUR) | Великобритания (EUR) | Разница |\n|------|-----------|-----------|------|\n| 2019 970 | €315,840 | **€265,292** | -16.0% |\n| 2021 970 | €428,400 | €359,500 | — |\n\n### Данные Agriaffaires\n- Всего серии Jaguar **278** объявлений (+2 к предыдущему дню)\n| Модель | Год | Цена |\n|------|------|------|\n| Jaguar 950 | 2025 | €449,000 (всего 314 ч) |\n| Jaguar 960 | 2022 | €382,353 |\n| Jaguar 880 | 2022 | €214,318 |\n\n### Стратегическое значение рынка Великобритании\nПост-Brexit расхождение каналов может усилиться, создавая возможности для реэкспортного арбитража из ЕС в не-ЕС`,
    actionTips: ["英国€265K作为970国际参考价新锚点", "利用2025款€507K凸显2017款163万性价比", "评估英国采购→非欧盟转口套利路径"],
    dataSummary: '[{"label":"2025款970","value":"€507,800企稳"},{"label":"英国970","value":"便宜16%"},{"label":"Agriaffaires","value":"278条"}]',
  },
  {
    icon: "🇨🇳", region: "中国", tags: ["5300RC", "372.2%价差"], date: TODAY,
    text: "CLAAS 5300RC(2020)仅18万白菜价，国际同级85万+，价差率372.2%全品类第一！",
    textEn: "CLAAS 5300RC(2020) at bargain price of only CNY 180K, international comparable 850K+, 372.2% spread rate #1 across all categories!",
    textRu: "CLAAS 5300RC(2020) по бросовой цене всего 180 тыс. юаней, международный аналог 850 тыс.+, 372.2% — №1 среди всех категорий!",
    regionEn: "China", regionRu: "Китай",
    tagsEn: '["5300RC", "372.2% Spread"]', tagsRu: '["5300RC", "372.2% разница"]',
    detailedContent: `## 5300RC(2020)白菜价持续领跑\n\n### 套利对比\n| 机型 | 国内价 | 国际参考价 | 价差 | 价差率 |\n|------|--------|-----------|------|--------|\n| **5300RC(2020)** | 18万 | 85万+ | 67万 | **372.2%** ⭐⭐⭐⭐⭐ |\n| 5300RC(2022全新) | 95万 | 145.1万 | 50.1万 | 52.7% |\n| FR450(2013) | 21.5万 | 43.3万 | 21.8万 | 101.4% |\n| 980(2016) | 143万 | 251.0万 | 108万 | 75.5% |\n\n### 关键信息\n- FAO乌克兰83.6百万吨谷物预测 → 大方捆需求确定性强\n- 5300RC(2022全新95万)价差率52.7%，乌克兰线核心标的\n- 5300RC(2020)需确认车况和配件齐全\n- 2026全球大方捆市场CAGR 5.2%`,
    detailedContentEn: `## 5300RC(2020) Bargain Price Continues to Lead\n\n### Arbitrage Comparison\n| Model | Domestic | International | Spread | Spread Rate |\n|------|--------|-----------|------|--------|\n| **5300RC(2020)** | CNY 180K | 850K+ | CNY 670K | **372.2%** ⭐⭐⭐⭐⭐ |\n| 5300RC(2022 new) | CNY 950K | CNY 1.451M | CNY 501K | 52.7% |\n| FR450(2013) | CNY 215K | CNY 433K | CNY 218K | 101.4% |\n| 980(2016) | CNY 1.43M | CNY 2.51M | CNY 1.08M | 75.5% |\n\n### Key Info\n- FAO Ukraine 83.6M tons grain forecast → strong large baler demand\n- 5300RC(2022 new CNY 950K) spread 52.7%, core Ukraine line target\n- 5300RC(2020) needs condition and parts verification\n- 2026 global large baler market CAGR 5.2%`,
    detailedContentRu: `## 5300RC(2020) бросовая цена продолжает лидировать\n\n### Арбитражное сравнение\n| Модель | Внутренняя | Международная | Разница | Ставка |\n|------|--------|-----------|------|--------|\n| **5300RC(2020)** | 180 тыс. | 850 тыс.+ | 670 тыс. | **372.2%** ⭐⭐⭐⭐⭐ |\n| 5300RC(2022 нов.) | 950 тыс. | 1.451 млн | 501 тыс. | 52.7% |\n| FR450(2013) | 215 тыс. | 433 тыс. | 218 тыс. | 101.4% |\n| 980(2016) | 1.43 млн | 2.51 млн | 1.08 млн | 75.5% |\n\n### Ключевая информация\n- Прогноз ФАО 83.6 млн тонн зерна в Украине → сильный спрос на большие пресс-подборщики\n- 5300RC(2022 новый 950 тыс.) разница 52.7%, основная цель украинской линии\n- 5300RC(2020) требует проверки состояния и комплектации\n- Мировой рынок больших пресс-подборщиков 2026 CAGR 5.2%`,
    actionTips: ["5300RC(2020)需确认车况后定价", "FAO乌克兰报告作为核心背书材料", "5300RC(2022全新)对接乌克兰线优先"],
    dataSummary: '[{"label":"5300RC价差率","value":"372.2%#1"},{"label":"2022全新","value":"52.7%"}]',
  },
  {
    icon: "🇨🇳", region: "中国", tags: ["FR450爆款", "101.4%价差"], date: TODAY,
    text: "New Holland FR450(2013) 21.5万/台+101.4%价差率+10台库存，汇率零波动=定价信心最强",
    textEn: "New Holland FR450(2013) CNY 215K/unit + 101.4% spread rate + 10 units in stock, zero FX volatility = strongest pricing confidence",
    textRu: "New Holland FR450(2013) 215 тыс. юаней/ед. + 101.4% разница + 10 ед. на складе, нулевая волатильность валют = наивысшая уверенность в ценообразовании",
    regionEn: "China", regionRu: "Китай",
    tagsEn: '["FR450 Hot", "101.4% Spread"]', tagsRu: '["FR450 хит", "101.4% разница"]',
    detailedContent: `## FR450爆款速推\n\n### 核心数据\n| 指标 | 数值 |\n|------|------|\n| 国内售价 | **21.5万/台** |\n| 俄市场参考价 | 43.3万 |\n| 价差 | 21.8万/台 |\n| 价差率 | **101.4%** |\n| 库存 | **10台** |\n| 汇率敏感度 | 极低（绝对价差小） |\n\n### 为何是今日最佳走量标的？\n1. **汇率极度稳定**：EUR/CNY和USD/CNY均持平，定价确定性强\n2. **绝对价差小**：21.8万/台，汇率波动影响有限\n3. **翻倍利润**：101.4%价差率，买入→翻倍卖出\n4. **10台走量**：批量出货效率高\n5. **低门槛**：21.5万买家决策快`,
    detailedContentEn: `## FR450 Hot Seller Push\n\n### Core Data\n| Indicator | Value |\n|------|------|\n| Domestic price | **CNY 215K/unit** |\n| Russian market ref | CNY 433K |\n| Spread per unit | CNY 218K |\n| Spread rate | **101.4%** |\n| Inventory | **10 units** |\n| FX sensitivity | Very low (small absolute spread) |\n\n### Why Today's Best Volume Target?\n1. **Extremely stable FX**: EUR/CNY and USD/CNY flat, strong pricing certainty\n2. **Small absolute spread**: CNY 218K/unit, limited FX impact\n3. **Double profit**: 101.4% spread, buy → double sell\n4. **Volume model**: 10 units, high batch efficiency\n5. **Low barrier**: CNY 215K, fast buyer decisions`,
    detailedContentRu: `## FR450 хит продаж\n\n### Основные данные\n| Показатель | Значение |\n|------|------|\n| Внутренняя цена | **215 тыс. юаней/ед.** |\n| Справочная РФ | 433 тыс. юаней |\n| Разница за ед. | 218 тыс. юаней |\n| Ставка разницы | **101.4%** |\n| Остаток | **10 ед.** |\n| Чувствительность к курсу | Очень низкая |\n\n### Почему лучшая цель сегодня?\n1. **Крайне стабильный курс**: EUR/CNY и USD/CNY без изменений\n2. **Малая абсолютная разница**: 218 тыс./ед., ограниченное влияние курса\n3. **Двойная прибыль**: 101.4% разница\n4. **Объёмная модель**: 10 ед., высокая эффективность партии\n5. **Низкий порог**: 215 тыс., быстрое решение покупателя`,
    actionTips: ["FR450俄语区批量速推10台", "21.5万一口价加速成交", "汇率稳定=最佳定价窗口"],
    dataSummary: '[{"label":"FR450价差","value":"101.4%"},{"label":"库存","value":"10台"},{"label":"汇率影响","value":"极低"}]',
  },
  {
    icon: "🇨🇳", region: "中国", tags: ["980套利王", "75.5%价差"], date: TODAY,
    text: "Jaguar 980(2016)EU€320K→251万vs国内143万，价差108万(75.5%)，青储机系列最高套利标的",
    textEn: "Jaguar 980(2016) EU€320K→CNY2.51M vs domestic CNY1.43M, spread CNY1.08M (75.5%), highest arbitrage target in forage harvester lineup",
    textRu: "Jaguar 980(2016) ЕС€320K→2.51 млн юаней vs внутренние 1.43 млн, разница 1.08 млн (75.5%), самая высокая арбитражная цель среди силосоуборочных",
    regionEn: "China", regionRu: "Китай",
    tagsEn: '["980 Arbitrage King", "75.5% Spread"]', tagsRu: '["980 Арбитраж", "75.5% разница"]',
    detailedContent: `## Jaguar 980套利王\n\n### 套利对比（今日汇率7.8425）\n| 机型 | 国际价 | 国内价 | 价差 | 价差率 |\n|------|--------|--------|------|--------|\n| **980(2016)** | €320K=251.0万 | 143万 | **108.0万** | **75.5%** ⭐⭐⭐⭐⭐ |\n| 980(2015抵押) | €320K参考 | 130万 | 121万参考 | 93.1%参考 |\n| 970(2017) | €265K=208.1万 | 163万 | 45.1万 | 27.7% |\n| 850(2020) | €185K=145.1万 | 119万 | 26.1万 | 21.9% |\n\n### 操作重点\n- **FAO乌克兰恢复计划**：83.6百万吨谷物产量预测，青储机需求刚性\n- **AGRO 2026展7月基辅**：展前窗口期内应推动成交\n- **980+970组合方案**：提升客单价\n- 980(2015抵押)价差率更高但需先解决抵押问题`,
    detailedContentEn: `## Jaguar 980 Arbitrage King\n\n### Arbitrage Comparison (Today's FX 7.8425)\n| Model | International | Domestic | Spread | Spread Rate |\n|------|--------|--------|------|--------|\n| **980(2016)** | €320K=CNY2.51M | CNY1.43M | **CNY1.08M** | **75.5%** ⭐⭐⭐⭐⭐ |\n| 980(2015 mortgage) | €320K ref | CNY1.30M | CNY1.21M ref | 93.1% ref |\n| 970(2017) | €265K=CNY2.081M | CNY1.63M | CNY0.451M | 27.7% |\n| 850(2020) | €185K=CNY1.451M | CNY1.19M | CNY0.261M | 21.9% |\n\n### Action Focus\n- **FAO Ukraine recovery plan**: 83.6M tons grain forecast, rigid demand for forage harvesters\n- **AGRO 2026 July Kyiv**: Push deals before exhibition window\n- **980+970 combo**: Increase ticket size\n- 980(2015 mortgage) has higher spread but mortgage issue needs resolution first`,
    detailedContentRu: `## Jaguar 980 арбитражный король\n\n### Арбитражное сравнение (курс 7.8425)\n| Модель | Международная | Внутренняя | Разница | Ставка |\n|------|--------|--------|------|--------|\n| **980(2016)** | €320K=2.51 млн | 1.43 млн | **1.08 млн** | **75.5%** ⭐⭐⭐⭐⭐ |\n| 980(2015 залог) | €320K реф. | 1.30 млн | 1.21 млн реф. | 93.1% реф. |\n| 970(2017) | €265K=2.081 млн | 1.63 млн | 0.451 млн | 27.7% |\n| 850(2020) | €185K=1.451 млн | 1.19 млн | 0.261 млн | 21.9% |\n\n### Основные действия\n- **План восстановления ФАО Украина**: 83.6 млн тонн зерна\n- **Выставка AGRO 2026 июль Киев**: продвигать сделки до окна выставки\n- **980+970 комбо**: увеличить средний чек\n- 980(2015 залог) — выше разница, но сначала решить вопрос залога`,
    actionTips: ["980优先推俄语区+乌克兰买家", "利用FAO报告+AGRO展背书", "AGRO 2026展前完成至少1台出口"],
    dataSummary: '[{"label":"980价差","value":"108万(75.5%)"},{"label":"FAO谷物","value":"83.6百万吨"}]',
  },
  {
    icon: "🆕", region: "全球", tags: ["BigM 420", "60%价差"], date: TODAY,
    text: "Krone BigM 420(2018)新入套利排行！EU€100K→78.4万vs国内49万，价差29.4万(60.0%)",
    textEn: "Krone BigM 420(2018) enters arbitrage ranking! EU€100K→CNY784K vs domestic CNY490K, spread CNY294K (60.0%)",
    textRu: "Krone BigM 420(2018) входит в арбитражный рейтинг! ЕС€100K→784 тыс. vs внутренние 490 тыс., разница 294 тыс. (60.0%)",
    regionEn: "Global", regionRu: "Глобально",
    tagsEn: '["BigM 420", "60% Spread"]', tagsRu: '["BigM 420", "60% разница"]',
    detailedContent: `## BigM 420新套利标的\n\n### 套利分析\n| 指标 | 数值 |\n|------|------|\n| 国际参考价 | €100,000 = 78.4万元 |\n| 国内售价 | **49万元** |\n| 价差 | 29.4万元 |\n| 价差率 | **60.0%** ⭐⭐⭐⭐⭐ |\n| 品牌 | **Krone**（德国一线） |\n\n### CLAAS全球统治力及其他品牌\n- 🏆 CLAAS全球青储机市占率>65%（Accio 2026报告）\n- 📈 Jaguar 1000系列销售额2025年+44%\n- 🚜 AXION 9.450获"2026年度拖拉机"称号\n- 🔬 CLAAS R&D投入3.199亿欧元创新高\n- Krone BigM 420为Krone品牌割草机旗舰\n\n### 为什么BigM是好的标？\n- 49万性价比极高\n- 60.0%价差率足有吸引力\n- Krone品牌认可度在欧洲很高\n- 适合东欧+俄罗斯市场需求`,
    detailedContentEn: `## BigM 420 New Arbitrage Target\n\n### Arbitrage Analysis\n| Indicator | Value |\n|------|------|\n| International ref | €100,000 = CNY 784K |\n| Domestic price | **CNY 490K** |\n| Spread | CNY 294K |\n| Spread rate | **60.0%** ⭐⭐⭐⭐⭐ |\n| Brand | **Krone** (German premium) |\n\n### CLAAS Global Dominance\n- 🏆 CLAAS global forage harvester market share >65% (Accio 2026)\n- 📈 Jaguar 1000 series sales 2025 +44%\n- 🚜 AXION 9.450 won "2026 Tractor of the Year"\n- 🔬 CLAAS R&D investment €319.9M all-time high\n- Krone BigM 420 is Krone's flagship mower\n\n### Why BigM is a Good Target?\n- CNY 490K excellent value\n- 60.0% spread rate sufficiently attractive\n- Krone brand well recognized in Europe\n- Suitable for Eastern Europe + Russia demand`,
    detailedContentRu: `## BigM 420 новая арбитражная цель\n\n### Арбитражный анализ\n| Показатель | Значение |\n|------|------|\n| Международная справка | €100,000 = 784 тыс. |\n| Внутренняя цена | **490 тыс. юаней** |\n| Разница | 294 тыс. юаней |\n| Ставка разницы | **60.0%** ⭐⭐⭐⭐⭐ |\n| Бренд | **Krone** (немецкий премиум) |\n\n### Глобальное доминирование CLAAS\n- 🏆 Доля рынка CLAAS >65% (Accio 2026)\n- 📈 Продажи серии Jaguar 1000 +44% в 2025\n- 🚜 AXION 9.450 — «Трактор года 2026»\n- 🔬 Инвестиции CLAAS в НИОКР €319.9 млн — рекорд\n\n### Почему BigM — хорошая цель?\n- 490 тыс. — отличное соотношение цена/качество\n- 60.0% ставка разницы достаточно привлекательна\n- Бренд Krone хорошо узнаваем в Европе\n- Подходит для Восточной Европы + России`,
    actionTips: ["BigM 420东欧推进", "利用Krone品牌认可度推广", "49万性价比突出可放大预算"],
    dataSummary: '[{"label":"BigM价差","value":"60.0%"},{"label":"CLAAS市占率","value":">65%"},{"label":"R&D投入","value":"€3.199亿"}]',
  },
  {
    icon: "🇷🇺", region: "俄罗斯", tags: ["EU制裁", "5%低关税"], date: TODAY,
    text: "EU第20轮制裁加剧欧美配件断供；2026俄农机排第一优先产业，5%低关税+政府补贴",
    textEn: "EU 20th round of sanctions worsens Western parts shortage; Russia ranks agriculture machinery #1 priority in 2026, 5% low tariff + gov subsidies",
    textRu: "20-й раунд санкций ЕС усугубляет дефицит западных запчастей; РФ ставит сельхозмашиностроение в приоритет №1 в 2026, 5% пошлина + госсубсидии",
    regionEn: "Russia", regionRu: "Россия",
    tagsEn: '["EU Sanctions", "5% Low Tariff"]', tagsRu: '["Санкции ЕС", "5% низкая пошлина"]',
    detailedContent: `## EU制裁对俄农机市场影响\n\n### 制裁背景\n- 4月23日EU第20轮制裁落地，120项新增制裁清单\n- 欧美农机配件断供加剧，CLAAS/Deere/Kubota供货受限\n\n### 俄罗斯农机市场\n| 维度 | 详情 |\n|------|------|\n| 2026国家优先产业 | **农机排第一** |\n| 进口关税 | 二手农机**5%低关税** |\n| 政府补贴 | 农机购置补贴政策延续 |\n| 替代窗口 | 中国/土耳其设备替代需求强劲 |\n| 物流通道 | 中俄铁路运输正常，30-40天到货 |\n\n### 推荐机型\n- CLAAS 970/980/850青储机（俄语区刚需）\n- Krone/BigM系列\n- FR450打捆机（101.4%价差走量）`,
    detailedContentEn: `## EU Sanctions Impact on Russian Agricultural Machinery Market\n\n### Sanctions Background\n- EU 20th round sanctions on April 23, 120 new items\n- Western parts shortage worsening, CLAAS/Deere/Kubota supply restricted\n\n### Russian Market\n| Dimension | Details |\n|------|------|\n| 2026 national priority | **Agricultural machinery #1** |\n| Import tariff | Used machinery **5% low tariff** |\n| Gov subsidies | Machinery purchase subsidy continuing |\n| Substitution window | Chinese/Turkish equipment demand strong |\n| Logistics | China-Russia rail normal, 30-40 day delivery |\n\n### Recommended Models\n- CLAAS 970/980/850 (Russian market rigid demand)\n- Krone/BigM series\n- FR450 baler (101.4% spread volume seller)`,
    detailedContentRu: `## Влияние санкций ЕС на рынок сельхозтехники РФ\n\n### Предыстория санкций\n- 20-й раунд санкций ЕС 23 апреля, 120 новых позиций\n- Дефицит западных запчастей усугубляется, поставки CLAAS/Deere/Kubota ограничены\n\n### Российский рынок\n| Измерение | Детали |\n|------|------|\n| Приоритет 2026 | **Сельхозтехника №1** |\n| Импортная пошлина | **5% низкая пошлина** на б/у технику |\n| Госсубсидии | Продолжение субсидирования покупки техники |\n| Окно замены | Высокий спрос на китайское/турецкое оборудование |\n| Логистика | Ж/д Китай-РФ в норме, 30-40 дней доставки |\n\n### Рекомендуемые модели\n- CLAAS 970/980/850 (жёсткий спрос русскоязычного региона)\n- Серия Krone/BigM\n- Пресс-подборщик FR450 (101.4% разница, объёмные продажи)`,
    actionTips: ["重点推CLAAS 970/980/850替代欧美断供", "提供俄语说明书+配件供应承诺", "利用5%低关税+补贴政策促销"],
    dataSummary: '[{"label":"EU制裁","value":"第20轮120项"},{"label":"俄关税","value":"5%低关税"},{"label":"优先产业","value":"农机#1"}]',
  },
  {
    icon: "🇺🇦", region: "乌克兰", tags: ["FAO恢复", "AGRO 2026"], date: TODAY,
    text: "FAO确认乌克兰83.6百万吨谷物预测；AGRO 2026展7月基辅举办，战后农业重建窗口打开",
    textEn: "FAO confirms Ukraine 83.6M tons grain forecast; AGRO 2026 exhibition July in Kyiv, post-war agricultural reconstruction window open",
    textRu: "ФАО подтверждает прогноз 83.6 млн тонн зерна в Украине; выставка AGRO 2026 в июле в Киеве, окно послевоенного восстановления сельского хозяйства открыто",
    regionEn: "Ukraine", regionRu: "Украина",
    tagsEn: '["FAO Recovery", "AGRO 2026"]', tagsRu: '["Восстановление ФАО", "AGRO 2026"]',
    detailedContent: `## 乌克兰农机需求分析\n\n### 核心数据\n| 指标 | 数值 |\n|------|------|\n| FAO谷物产量预测 | **83.6百万吨** |\n| 2026年1-2月农产品出口 | 9.95万吨(+9.3%) |\n| AGRO 2026展 | 7月基辅，第34届 |\n| 黑海+多瑙河路线 | 已恢复运行 |\n| USDA 2026/27 | 确认增产 |\n\n### 战后面临的农机需求\n1. 大量农机在战争中被毁 → 替换需求\n2. FAO三年恢复计划 → 确定性资金\n3. 青储机/打捆机为核心需求\n4. 神雕库存：970/980/5300RC/Fr450均可对接\n\n### 操作建议\n- 7月AGRO展前完成线上对接\n- 利用FAO报告作为采购背书\n- 黑海+多瑙河双通道物流方案`,
    detailedContentEn: `## Ukraine Agricultural Machinery Demand Analysis\n\n### Core Data\n| Indicator | Value |\n|------|------|\n| FAO grain forecast | **83.6M tons** |\n| Jan-Feb 2026 agri exports | 99.5K tons (+9.3%) |\n| AGRO 2026 | July, Kyiv, 34th edition |\n| Black Sea+Danube routes | Operational |\n| USDA 2026/27 | Confirms increase |\n\n### Post-War Machinery Demand\n1. Many machines destroyed → replacement demand\n2. FAO 3-year recovery plan → committed funding\n3. Forage harvesters/balers core demand\n4. Shendiao inventory: 970/980/5300RC/FR450 all matchable\n\n### Recommendations\n- Complete online matchmaking before AGRO July\n- Use FAO report as procurement backing\n- Black Sea+Danube dual-channel logistics`,
    detailedContentRu: `## Анализ спроса на сельхозтехнику в Украине\n\n### Основные данные\n| Показатель | Значение |\n|------|------|\n| Прогноз ФАО зерна | **83.6 млн тонн** |\n| Экспорт с/х янв-фев 2026 | 99.5 тыс. тонн (+9.3%) |\n| Выставка AGRO 2026 | Июль, Киев, 34-я |\n| Маршруты Чёрного моря+Дуная | Действуют |\n| USDA 2026/27 | Подтверждает рост |\n\n### Послевоенный спрос\n1. Много техники уничтожено → потребность в замене\n2. Трёхлетний план восстановления ФАО → финансирование есть\n3. Силосоуборочные/пресс-подборщики — ключевой спрос\n4. Склад Shendiao: 970/980/5300RC/FR450 — все подходят\n\n### Рекомендации\n- Провести онлайн-согласование до AGRO в июле\n- Использовать отчёт ФАО как подтверждение закупок\n- Двухканальная логистика Чёрное море+Дунай`,
    actionTips: ["7月AGRO展前完成产品信息推送", "FAO报告+神雕库存精准匹配", "980/FR450乌克兰线优先推进"],
    dataSummary: '[{"label":"FAO谷物","value":"83.6百万吨"},{"label":"AGRO展","value":"7月基辅"}]',
  },
  {
    icon: "🇺🇿", region: "乌兹别克斯坦", tags: ["增速最快", "+256.77%"], date: TODAY,
    text: "乌兹别克斯坦Q1进口增长256.77%全球最快！棉花采收机械化率不足40%，需求空间巨大",
    textEn: "Uzbekistan Q1 imports +256.77% globally fastest! Cotton harvesting mechanization below 40%, massive demand gap",
    textRu: "Импорт Узбекистана Q1 +256.77% — самый быстрый в мире! Механизация хлопкоуборки ниже 40%, огромный дефицит спроса",
    regionEn: "Uzbekistan", regionRu: "Узбекистан",
    tagsEn: '["Fastest Growth", "+256.77%"]', tagsRu: '["Самый быстрый рост", "+256.77%"]',
    detailedContent: `## 乌兹别克斯坦市场爆发\n\n### 核心数据\n| 指标 | 数值 |\n|------|------|\n| Q1进口增速 | **+256.77%** |\n| 棉花采收机械化率 | 不足40% |\n| 政府补贴 | 农机购置补贴50% |\n| 物流 | 中吉乌铁路建设加速 |\n\n### 推荐机型及报价\n| 品类 | 推荐型号 | 报价范围 |\n|------|---------|----------|\n| 青储收获机 | CLAAS 850/860 | 60-120万 |\n| 拖拉机 | NH/Deere 100-200HP | 30-80万 |\n| 打捆机 | Krone 500/600 | 15-40万 |\n\n### 操作重点\n- 棉花采收相关机型为最大需求\n- 政府50%补贴融资方案有吸引力\n- 中吉乌铁路通车后物流极大改善\n- 建议乌兹别克语+俄语产品手册优先制作`,
    detailedContentEn: `## Uzbekistan Market Surge\n\n### Core Data\n| Indicator | Value |\n|------|------|\n| Q1 import growth | **+256.77%** |\n| Cotton harvesting mechanization | Below 40% |\n| Gov subsidy | 50% machinery purchase |\n| Logistics | China-Kyrgyzstan-Uzbekistan railway accelerating |\n\n### Recommended Models\n| Category | Recommendation | Price Range |\n|------|---------|----------|\n| Forage harvesters | CLAAS 850/860 | CNY 600K-1.2M |\n| Tractors | NH/Deere 100-200HP | CNY 300K-800K |\n| Balers | Krone 500/600 | CNY 150K-400K |\n\n### Action Focus\n- Cotton harvesting related models = largest demand\n- 50% gov subsidy financing attractive\n| Logistics improvement | After railway completion |\n| Market material | Uzbek + Russian manuals priority`,
    detailedContentRu: `## Рынок Узбекистана на подъёме\n\n### Основные данные\n| Показатель | Значение |\n|------|------|\n| Рост импорта Q1 | **+256.77%** |\n| Механизация хлопкоуборки | Ниже 40% |\n| Субсидия | 50% на покупку техники |\n| Логистика | Ж/д Китай-Кыргызстан-Узбекистан ускоряется |\n\n### Рекомендуемые модели\n| Категория | Рекомендация | Цена |\n|------|---------|----------|\n| Силосоуборочные | CLAAS 850/860 | 600 тыс.-1.2 млн |\n| Тракторы | NH/Deere 100-200 л.с. | 300-800 тыс. |\n| Пресс-подборщики | Krone 500/600 | 150-400 тыс. |\n\n### Основные действия\n- Модели для уборки хлопка — основной спрос\n| Субсидия 50% | Привлекательная финансовая схема |\n| Улучшение логистики | После завершения ж/д |\n| Язык | Узбекские + русские руководства в приоритете`,
    actionTips: ["乌兹别克语+俄语产品手册优先", "棉花采收机型重点推广", "利用50%政府补贴设计融资方案"],
    dataSummary: '[{"label":"进口增速","value":"+256.77%"},{"label":"机械化率","value":"<40%"}]',
  },
  {
    icon: "🇧🇷", region: "巴西", tags: ["进口替代", "5300RC"], date: TODAY,
    text: "巴西Q1销量-13.1%但进口替代加速！5300RC(95万全新)核心受益，52.7%价差空间",
    textEn: "Brazil Q1 sales -13.1% but import substitution accelerating! 5300RC (CNY950K brand new) core beneficiary, 52.7% spread",
    textRu: "Продажи Бразилии Q1 -13.1%, но импортное замещение ускоряется! 5300RC (950 тыс. юаней новый) — бенефициар, разница 52.7%",
    regionEn: "Brazil", regionRu: "Бразилия",
    tagsEn: '["Import Substitution", "5300RC"]', tagsRu: '["Импортное замещение", "5300RC"]',
    detailedContent: `## 巴西农机进口替代加速\n\n### 市场现状\n| 指标 | 数值 |\n|------|------|\n| Q1整机销量增速 | -13.1% |\n| 进口替代趋势 | **加速中** |\n| 5300RC国内价 | 95万(全新) |\n| 国际同级参考 | €185K(145.1万) |\n| 价差率 | **52.7%** ⭐⭐⭐⭐⭐ |\n| 关税 | 14% + MAPA审批 |\n\n### 5300RC巴西战略\n- CLAAS 5300RC(2022全新95万)为巴西线核心标的\n- MF 3404(2022,105万)价差率34.4%为次级标的\n- 需提前完成巴西14%关税+MAPA审批\n- 交货周期35-45天\n- 建议制作葡萄牙语产品手册`,
    detailedContentEn: `## Brazil Import Substitution Accelerating\n\n### Market Status\n| Indicator | Value |\n|------|------|\n| Q1 machinery sales | -13.1% |\n| Import substitution | **Accelerating** |\n| 5300RC domestic price | CNY 950K (brand new) |\n| International ref | €185K (CNY 1.451M) |\n| Spread rate | **52.7%** ⭐⭐⭐⭐⭐ |\n| Tariff | 14% + MAPA approval |\n\n### 5300RC Brazil Strategy\n- CLAAS 5300RC(2022 new, CNY950K) core target for Brazil\n- MF 3404(2022, CNY1.05M) spread 34.4% secondary target\n- Need advance Brazil 14% tariff + MAPA approval\n- Delivery cycle 35-45 days\n- Recommend Portuguese product manual`,
    detailedContentRu: `## Импортное замещение Бразилии ускоряется\n\n### Состояние рынка\n| Показатель | Значение |\n|------|------|\n| Продажи Q1 | -13.1% |\n| Импортное замещение | **Ускоряется** |\n| 5300RC внутренняя цена | 950 тыс. (новый) |\n| Международная справка | €185K (1.451 млн) |\n| Ставка разницы | **52.7%** ⭐⭐⭐⭐⭐ |\n| Пошлина | 14% + одобрение MAPA |\n\n### Стратегия 5300RC в Бразилии\n- CLAAS 5300RC(2022 новый, 950 тыс.) — основная цель для Бразилии\n- MF 3404(2022, 1.05 млн) разница 34.4% — вторичная цель\n- Требуется предварительное одобрение 14% пошлины + MAPA\n- Цикл поставки 35-45 дней\n- Рекомендуется руководство на португальском языке`,
    actionTips: ["5300RC优先推送巴西买家", "提前完成巴西14%关税+MAPA审批", "制作葡萄牙语产品手册"],
    dataSummary: '[{"label":"5300RC价差","value":"52.7%"},{"label":"巴西Q1","value":"-13.1%"}]',
  },
  {
    icon: "🌍", region: "非洲", tags: ["肯尼亚+46%", "NAMPO展后"], date: TODAY,
    text: "非洲农机需求升温：肯尼亚进口+46.6%，50-100HP拖拉机为主力需求，中国二手=欧洲新品20-30%价格",
    textEn: "Africa machinery demand heating up: Kenya imports +46.6%, 50-100HP tractors main demand, Chinese used = 20-30% of European new price",
    textRu: "Спрос в Африке растёт: импорт Кении +46.6%, тракторы 50-100 л.с. — основной спрос, китайская б/у техника = 20-30% цены новой европейской",
    regionEn: "Africa", regionRu: "Африка",
    tagsEn: '["Kenya +46%", "Post-NAMPO"]', tagsRu: '["Кения +46%", "После NAMPO"]',
    detailedContent: `## 非洲农机市场升温\n\n### 区域数据\n| 区域 | 主要特点 | 需求机型 |\n|------|---------|--------|\n| 🇰🇪 **肯尼亚** | 进口+46.6% | 50-100HP拖拉机 |\n| 🇳🇬 尼日利亚 | 可耕地最大 | 中型拖拉机/收割机 |\n| 🇿🇦 南非 | 商业化农业 | 大型农机具 |\n| 🇪🇬 埃及 | 灌溉农业 | 拖拉机/水泵 |\n\n### 东南亚（参考）\n| 国家 | 增速 | 主力机型 |\n|------|------|---------|\n| 🇮🇩 印尼 | **+121.07%** | 微耕机/小型收割机 |\n| 🇹🇭 泰国 | 中速 | 插秧机/收割机 |\n| 🇵🇭 菲律宾 | 快速 | 手扶拖拉机/收割机 |\n| 🇻🇳 越南 | 中速 | 插秧机/烘干机 |\n\n### 机会\n- 中国二手农机 = 欧洲新品20-30%价格\n- 非洲大陆自贸区降低关税壁垒\n- NAMPO展后需求持续释放\n- 东南亚印尼+121%为全球增速前三`,
    detailedContentEn: `## Africa Machinery Market Heating Up\n\n### Regional Data\n| Region | Features | Demanded Models |\n|------|---------|--------|\n| 🇰🇪 **Kenya** | Imports +46.6% | 50-100HP tractors |\n| 🇳🇬 Nigeria | Largest arable land | Medium tractors/harvesters |\n| 🇿🇦 South Africa | Commercial farming | Large machinery |\n| 🇪🇬 Egypt | Irrigated farming | Tractors/water pumps |\n\n### Southeast Asia (Reference)\n| Country | Growth | Key Models |\n|------|------|---------|\n| 🇮🇩 Indonesia | **+121.07%** | Mini tillers/small harvesters |\n| 🇹🇭 Thailand | Moderate | Rice transplanters/harvesters |\n| 🇵🇭 Philippines | Fast | Walking tractors/harvesters |\n| 🇻🇳 Vietnam | Moderate | Rice transplanters/dryers |\n\n### Opportunities\n- Chinese used = 20-30% European new prices\n- African Continental Free Trade Area reduces tariffs\n- Post-NAMPO demand continues\n- Indonesia +121% top 3 globally`,
    detailedContentRu: `## Рынок Африки нагревается\n\n### Региональные данные\n| Регион | Особенности | Востребованные модели |\n|------|---------|--------|\n| 🇰🇪 **Кения** | Импорт +46.6% | Тракторы 50-100 л.с. |\n| 🇳🇬 Нигерия | Крупнейшие пашни | Средние тракторы/комбайны |\n| 🇿🇦 ЮАР | Коммерческое земледелие | Крупная техника |\n| 🇪🇬 Египет | Орошаемое земледелие | Тракторы/насосы |\n\n### Юго-Восточная Азия (справка)\n| Страна | Рост | Основные модели |\n|------|------|---------|\n| 🇮🇩 Индонезия | **+121.07%** | Мотоблоки/малые комбайны |\n| 🇹🇭 Таиланд | Умеренный | Рассадопосадочные/комбайны |\n| 🇵🇭 Филиппины | Быстрый | Мотоблоки/комбайны |\n| 🇻🇳 Вьетнам | Умеренный | Рассадопосадочные/сушилки |\n\n### Возможности\n- Китайская б/у = 20-30% цены новой европейской\n- Африканская зона свободной торговли снижает пошлины\n- Спрос после NAMPO продолжается\n- Индонезия +121% в топ-3 мира`,
    actionTips: ["非洲主推50-100HP拖拉机+肯尼亚高潜市场", "利用非洲自贸区关税优惠", "印尼东南亚市场布局小型农机"],
    dataSummary: '[{"label":"肯尼亚","value":"+46.6%"},{"label":"印尼","value":"+121.07%"}]',
  },
  {
    icon: "🔄", region: "全球", tags: ["7大操作", "操作建议"], date: TODAY,
    text: "今日7大操作优先：980俄语区(75.5%)→FR450爆款(101.4%)→5300RC乌克兰线(52.7%)→英镑价差→BigM东欧→CLAAS品牌→市场调研",
    textEn: "Today's 7 priorities: 980 Russian region (75.5%) → FR450 hot seller (101.4%) → 5300RC Ukraine line (52.7%) → UK price gap → BigM Eastern Europe → CLAAS brand → Market research",
    textRu: "7 приоритетов: 980 русскоязычный регион (75.5%) → FR450 хит (101.4%) → 5300RC Украина (52.7%) → ценовой разрыв UK → BigM Восточная Европа → бренд CLAAS → исследование рынка",
    regionEn: "Global", regionRu: "Глобально",
    tagsEn: '["Action Plan", "7 Priorities"]', tagsRu: '["План действий", "7 приоритетов"]',
    detailedContent: `## 今日7大操作优先级\n\n| 优先级 | 操作 | 价差率 | 紧迫度 |\n|--------|------|--------|--------|\n| **1** | 980加速俄语区/乌克兰成交 | 75.5% | 🔴 最急 |\n| **2** | FR450爆款10台速推 | 101.4% | 🔴 最急 |\n| **3** | 5300RC对接乌克兰FAO线 | 52.7% | 🟡 高 |\n| **4** | 🆕 利用英国€265K价差优势 | — | 🟡 高 |\n| **5** | BigM 420东欧推进 | 60.0% | 🟡 高 |\n| **6** | CLAAS品牌背书>65%市占率 | — | 🟢 中 |\n| **7** | 英国市场采购渠道调研 | — | 🟢 中 |\n\n### 关键时间节点\n- **今天9:15**：央行公布EUR/CNY中间价\n- **7月**：AGRO 2026乌克兰展\n- **两周内**：汇率0波动期—最佳定价窗口\n\n### 汇率稳定意味着什么？\n- 近11日EUR/CNY区间7.82-7.85，波动<0.5%\n- 套利计算置信度极高\n- CIPS人民币结算可完全规避汇率风险`,
    detailedContentEn: `## Today's 7 Action Priorities\n\n| Priority | Action | Spread | Urgency |\n|--------|------|--------|--------|\n| **1** | 980 Russian region/Ukraine deals | 75.5% | 🔴 Most urgent |\n| **2** | FR450 10 units hot push | 101.4% | 🔴 Most urgent |\n| **3** | 5300RC FAO Ukraine line | 52.7% | 🟡 High |\n| **4** | 🆕 Leverage UK €265K gap | — | 🟡 High |\n| **5** | BigM 420 Eastern Europe push | 60.0% | 🟡 High |\n| **6** | CLAAS brand strength >65% share | — | 🟢 Medium |\n| **7** | UK procurement channel research | — | 🟢 Medium |\n\n### Key Milestones\n- **Today 9:15**: PBOC EUR/CNY midpoint\n- **July**: AGRO 2026 Ukraine\n- **2-week**: Zero FX volatility window — best pricing period\n\n### What FX Stability Means\n- 11-day EUR/CNY range 7.82-7.85, volatility <0.5%\n- Extremely high arbitrage calculation confidence\n- CIPS RMB settlement can fully hedge FX risk`,
    detailedContentRu: `## 7 приоритетов действий на сегодня\n\n| Приоритет | Действие | Разница | Срочность |\n|--------|------|--------|--------|\n| **1** | 980 русскоязычный регион/Украина | 75.5% | 🔴 Самое срочное |\n| **2** | FR450 хит 10 ед. | 101.4% | 🔴 Самое срочное |\n| **3** | 5300RC линия ФАО Украина | 52.7% | 🟡 Высокая |\n| **4** | 🆕 Использовать разрыв цен UK €265K | — | 🟡 Высокая |\n| **5** | BigM 420 Восточная Европа | 60.0% | 🟡 Высокая |\n| **6** | Сила бренда CLAAS >65% доли | — | 🟢 Средняя |\n| **7** | Исследование канала закупок UK | — | 🟢 Средняя |\n\n### Ключевые вехи\n- **Сегодня 9:15**: Средний курс НБК EUR/CNY\n- **Июль**: AGRO 2026 Украина\n- **2 недели**: Окно нулевой волатильности — лучший период ценообразования\n\n### Что означает стабильность курса\n- 11-дневный диапазон 7.82-7.85, волатильность <0.5%\n- Очень высокая уверенность в арбитражных расчётах\n- Расчёты CIPS в юанях полностью хеджируют валютный риск`,
    actionTips: ["980俄语区+FR450爆款双线并行", "汇率稳定期最佳定价窗口", "英国€265K渠道调研新机会"],
    dataSummary: '[{"label":"操作优先","value":"7大优先级"},{"label":"汇率窗口","value":"11日<0.5%波动"}]',
  },
];

async function main() {
  // 只清空当日数据（保留永久推广位 sortOrder=0 的条目）
  const todayStart = new Date(TODAY);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(TODAY);
  todayEnd.setHours(23, 59, 59, 999);
  
  await prisma.marketIntel.deleteMany({
    where: {
      date: { gte: todayStart, lte: todayEnd },
      sortOrder: { gt: 0 }  // 不删 sortOrder=0 的永久推广条目
    }
  });
  console.log("已清空当日日报数据（保留永久推广位）");

  // sortOrder 从 1 开始，0 留给永久推广位
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
        dataSummary: item.dataSummary || null,
        actionTips: item.actionTips ? JSON.stringify(item.actionTips) : null,
        sortOrder: i + 1,  // +1 给永久推广位腾位置
      },
    });
  }
  
  // 更新永久推广条目日期为今天（确保 API 按日期筛选时可见）
  const permEntry = await prisma.marketIntel.findFirst({ where: { sortOrder: 0 } });
  if (permEntry) {
    await prisma.marketIntel.update({ where: { id: permEntry.id }, data: { date: TODAY } });
    console.log(`已更新永久推广条目 ${permEntry.id} 日期为 ${TODAY.toISOString().split('T')[0]}`);
  }
  
  console.log(`已导入 ${ALL_MARKET_INTEL.length} 条当日情报 (日期: ${TODAY.toISOString().split('T')[0]})`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
