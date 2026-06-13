/**
 * 导入2026-06-13市场情报数据到数据库
 * 基于 2026-06-12_跨境套利日报.md 生成
 * 注：2026-06-13（周六）日报未生成，使用最新一期2026-06-12日报作为数据源
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const TODAY = new Date("2026-06-13");

const ALL_MARKET_INTEL = [
  {
    icon: "💶", region: "中国", tags: ["汇率稳定", "7.8425"], date: TODAY,
    text: "EUR/CNY连续两日持平7.8425(0.00%)！近11日窄幅震荡7.82-7.85，套利定价确定性极高",
    textEn: "EUR/CNY flat at 7.8425 for consecutive days (0.00%)! Narrow range 7.82-7.85 over 11 days, arbitrage pricing certainty extremely high",
    textRu: "EUR/CNY стабилен на 7.8425 два дня подряд (0.00%)! Узкий диапазон 7.82-7.85 за 11 дней, определённость ценообразования арбитража чрезвычайно высока",
    regionEn: "China", regionRu: "Китай",
    tagsEn: '["FX Stability", "7.8425"]', tagsRu: '["Стабильность валют", "7.8425"]',
    detailedContent: `## 汇率进入极度稳定期\n\n**最新汇率：** EUR/CNY中行折算价**7.8425**，连续两日完全持平（vs 6月11日7.8425）\n\n### EUR/CNY走势回顾（6月8日-12日）\n| 日期 | EUR/CNY | 变化 |\n|------|---------|------|\n| 6月8日 | 7.8240 | — |\n| 6月9日 | 7.8476 | +0.30% |\n| 6月10日 | 7.8400 | -0.10% |\n| 6月11日 | 7.8425 | +0.03% |\n| **6月12日** | **7.8425** | **0.00%** |\n\n### 汇率影响分析\n- EUR/CNY在7.84±0.02区间窄幅震荡格局延续\n- 现汇买入价781.68 vs 现汇卖出价787.41，买卖差价5.73个点（正常水平）\n- USD/CNY同步持平：6.8150(0.00%)\n- **关键信号：汇率进入极度稳定期，两周内波动<0.5%，出口利润格局稳固**\n\n### 套利计算建议\n- 当前汇率下套利计算置信度极高\n- 建议以7.84±0.01为基准报价，预留3%汇率缓冲\n- 若EUR突破7.90需重新调整定价策略`,
    detailedContentEn: `## FX Enters Extreme Stability Period\n\n**Latest rate:** BOC midpoint EUR/CNY **7.8425**, completely flat for consecutive days (vs June 11 7.8425)\n\n### EUR/CNY Trend Review (June 8-12)\n| Date | EUR/CNY | Change |\n|------|---------|------|\n| June 8 | 7.8240 | — |\n| June 9 | 7.8476 | +0.30% |\n| June 10 | 7.8400 | -0.10% |\n| June 11 | 7.8425 | +0.03% |\n| **June 12** | **7.8425** | **0.00%** |\n\n### FX Impact Analysis\n- EUR/CNY continues narrow range oscillation in 7.84±0.02 band\n- BOC buying 781.68 vs selling 787.41, spread 5.73 points (normal)\n- USD/CNY also flat: 6.8150 (0.00%)\n- **Key signal: FX enters extreme stability period, <0.5% volatility over 2 weeks, export profit structure solid**\n\n### Pricing Recommendations\n- Arbitrage calculations have extremely high confidence at current rate\n- Recommend pricing at 7.84±0.01 baseline with 3% FX buffer\n- Adjust pricing strategy if EUR breaks 7.90`,
    detailedContentRu: `## Валюта входит в период крайней стабильности\n\n**Последний курс:** Средний курс БК Китая EUR/CNY **7.8425**, полностью стабилен два дня подряд (vs 11 июня 7.8425)\n\n### Тренд EUR/CNY (8-12 июня)\n| Дата | EUR/CNY | Изменение |\n|------|---------|------|\n| 8 июня | 7.8240 | — |\n| 9 июня | 7.8476 | +0.30% |\n| 10 июня | 7.8400 | -0.10% |\n| 11 июня | 7.8425 | +0.03% |\n| **12 июня** | **7.8425** | **0.00%** |\n\n### Анализ влияния валют\n- EUR/CNY продолжает колебания в узком диапазоне 7.84±0.02\n- Покупка БК 781.68 vs продажа 787.41, спред 5.73 пункта (нормально)\n- USD/CNY также стабилен: 6.8150 (0.00%)\n- **Ключевой сигнал: валюта входит в период крайней стабильности, волатильность <0.5% за 2 недели**\n\n### Рекомендации по ценообразованию\n- Расчёты арбитража имеют чрезвычайно высокую точность при текущем курсе\n- Рекомендуется ценообразование на базе 7.84±0.01 с 3% валютным буфером\n- Скорректировать стратегию при прорыве EUR выше 7.90`,
    actionTips: ["以7.84±0.01为基准报价，预留3%汇率缓冲", "加速签订锁定汇率合同", "当前是套利定价确定性最高时期，加快成交"],
    dataSummary: '[{"label":"EUR/CNY","value":"7.8425(0.00%)"},{"label":"USD/CNY","value":"6.8150(0.00%)"}]',
  },
  {
    icon: "🇬🇧", region: "欧洲", tags: ["英国市场", "价格差异16%"], date: TODAY,
    text: "英国市场970(2019)仅€265K比德国€316K便宜16%！脱欧后渠道分割创造新套利路径",
    textEn: "UK market 970(2019) only €265K vs Germany €316K, 16% cheaper! Post-Brexit channel divergence creates new arbitrage path",
    textRu: "Рынок Великобритании: 970(2019) всего €265K vs Германия €316K, на 16% дешевле! Разделение каналов после Brexit создаёт новый арбитражный путь",
    regionEn: "Europe", regionRu: "Европа",
    tagsEn: '["UK Market", "16% Price Gap"]', tagsRu: '["Рынок Великобритании", "Разница цен 16%"]',
    detailedContent: `## 英国市场970定价差异分析\n\n**核心发现：** Agriaffaires新增英国坎布里亚970(2019)仅€265,292，对比德国同期€315,840，**英国市场便宜16%**\n\n### 价格对比\n| 市场 | 型号 | 年份 | 价格(EUR) | 价格(CNY@7.8425) | 差异 |\n|------|------|------|-----------|-----------------|------|\n| 🇬🇧 英国 | Jaguar 970 | 2019 | €265,292 | ≈208.1万元 | — |\n| 🇩🇪 德国 | Jaguar 970 | 2019 | €315,840 | ≈247.7万元 | 便宜**16%** |\n| 🇩🇪 德国 | Jaguar 970 | 2019 | €323,114 | ≈253.4万元 | 便宜**18%** |\n\n### 英国市场分析\n- 脱欧后渠道分割：英国独立于EU农机市场\n- 英镑计价 vs 欧元计价：汇率错配创造机会\n- 英国农机经欧盟转口可能享受不同关税待遇\n- 建议评估从英进口→非欧盟转口的套利路径可行性\n\n### 对神雕的影响\n- 970(2017)国内163万 vs 英国€265K≈208万→价差45.1万(27.7%)\n- 英国€265K拉高国际对标价格，970(2017)套利空间+1.0pp\n- Agriaffaires Jaguar总量278条（+2条），供给微增`,
    detailedContentEn: `## UK Market 970 Pricing Gap Analysis\n\n**Key Finding:** New Agriaffaires listing: UK Cumbria 970(2019) only €265,292 vs Germany €315,840, **UK market 16% cheaper**\n\n### Price Comparison\n| Market | Model | Year | Price(EUR) | Price(CNY@7.8425) | Difference |\n|------|------|------|-----------|-----------------|------|\n| 🇬🇧 UK | Jaguar 970 | 2019 | €265,292 | ≈CNY 2.081M | — |\n| 🇩🇪 Germany | Jaguar 970 | 2019 | €315,840 | ≈CNY 2.477M | **16%** cheaper |\n| 🇩🇪 Germany | Jaguar 970 | 2019 | €323,114 | ≈CNY 2.534M | **18%** cheaper |\n\n### UK Market Analysis\n- Post-Brexit channel divergence: UK independent from EU machinery market\n- GBP vs EUR pricing: FX misalignment creates opportunity\n- UK machinery via EU re-export may enjoy different tariff treatment\n- Recommend assessing UK import → non-EU re-export arbitrage path feasibility\n\n### Impact on Shendiao\n- 970(2017) domestic CNY 1.63M vs UK €265K≈CNY 2.08M → spread CNY 451K (27.7%)\n- UK €265K raises intl reference price, 970(2017) spread +1.0pp\n- Agriaffaires Jaguar total 278 listings (+2), supply slightly increasing`,
    detailedContentRu: `## Анализ разницы цен 970 на рынке Великобритании\n\n**Ключевая находка:** Новое объявление Agriaffaires: UK 970(2019) всего €265,292 vs Германия €315,840, **на 16% дешевле**\n\n### Сравнение цен\n| Рынок | Модель | Год | Цена(EUR) | Цена(CNY@7.8425) | Разница |\n|------|------|------|-----------|-----------------|------|\n| 🇬🇧 Великобритания | 970 | 2019 | €265,292 | ≈2.081 млн | — |\n| 🇩🇪 Германия | 970 | 2019 | €315,840 | ≈2.477 млн | **16%** |\n| 🇩🇪 Германия | 970 | 2019 | €323,114 | ≈2.534 млн | **18%** |\n\n### Анализ рынка Великобритании\n- Разделение каналов после Brexit: UK независим от рынка ЕС\n- Ценообразование в GBP vs EUR: валютные несоответствия создают возможности\n- Реэкспорт из UK через ЕС может иметь различные тарифные условия\n\n### Влияние на Шэньдяо\n- 970(2017) внутренняя 1.63 млн vs UK €265K≈2.08 млн → разница 451 тыс. (27.7%)\n- UK €265K повышает международную справочную цену, пространство арбитража 970(2017) +1.0pp\n- Agriaffaires Jaguar всего 278 объявлений (+2)`,
    actionTips: ["评估英国采购→非欧盟转口的套利路径可行性", "利用英国€265K拉高国际对标价推动970成交", "调研脱欧后英国农机渠道特性"],
    dataSummary: '[{"label":"UK 970(2019)","value":"€265K"},{"label":"vs德国","value":"便宜16%"}]',
  },
  {
    icon: "🏆", region: "全球", tags: ["CLAAS市占率", "65%+"], date: TODAY,
    text: "CLAAS全球青储机市占率>65%！Jaguar 1000系列销售额+44%，JAGUAR 1200创世界纪录4515吨/12h",
    textEn: "CLAAS global forage harvester market share >65%! Jaguar 1000 series sales +44%, JAGUAR 1200 sets world record 4,515 tons/12h",
    textRu: "Рыночная доля CLAAS в мире >65%! Продажи серии Jaguar 1000 +44%, JAGUAR 1200 установил мировой рекорд 4,515 т/12ч",
    regionEn: "Global", regionRu: "Глобально",
    tagsEn: '["CLAAS Market Share", "65%+"]', tagsRu: '["Доля рынка CLAAS", "65%+"]',
    detailedContent: `## CLAAS全球统治力确认\n\n**核心数据：** Accio 2026报告确认CLAAS全球青储机市占率>65%\n\n### 关键指标\n| 指标 | 数值 |\n|------|------|\n| 全球青储机市占率 | **>65%** |\n| Jaguar 1000系列销售额(2025) | **+44%** |\n| JAGUAR 1200世界纪录 | 12h收割4515吨 |\n| R&D投入(2025) | 3.199亿欧元 |\n| 2026年全系数字平台 | CLAAS connect集成 |\n\n### 对神雕的赋能\n- CLAAS>65%市占率+1000系列+44%=最强品牌背书\n- 神雕970/980库存直接受益于品牌溢价\n- 可制作中英俄三语CLAAS品牌推广页\n- 向买家展示CLAAS全球影响力增强信任感`,
    detailedContentEn: `## CLAAS Global Dominance Confirmed\n\n**Core Data:** Accio 2026 Report confirms CLAAS global forage harvester market share >65%\n\n### Key Metrics\n| Metric | Value |\n|------|------|\n| Global forage harvester share | **>65%** |\n| Jaguar 1000 series sales (2025) | **+44%** |\n| JAGUAR 1200 world record | 4,515 tons/12h |\n| R&D spend (2025) | €319.9M |\n| 2026 full-line digital platform | CLAAS connect integrated |\n\n### Empowering Shendiao\n- CLAAS >65% share + 1000 series +44% = strongest brand endorsement\n- Shendiao 970/980 inventory directly benefits from brand premium\n- Create trilingual CLAAS brand promotion page (ZH/EN/RU)\n- Show buyers CLAAS global influence to build trust`,
    detailedContentRu: `## Глобальное доминирование CLAAS подтверждено\n\n**Основные данные:** Отчёт Accio 2026 подтверждает долю рынка CLAAS >65%\n\n### Ключевые показатели\n| Показатель | Значение |\n|------|------|\n| Доля рынка силосоуборочных комбайнов | **>65%** |\n| Продажи серии Jaguar 1000 (2025) | **+44%** |\n| Мировой рекорд JAGUAR 1200 | 4,515 т/12ч |\n| Инвестиции в R&D (2025) | €319.9 млн |\n| Цифровая платформа 2026 | CLAAS connect |\n\n### Влияние на Шэньдяо\n- CLAAS >65% доли + серия 1000 +44% = самый сильный брендовый背书\n- Запасы Шэньдяо 970/980 напрямую выигрывают от премии бренда\n- Создать трёхъязычную страницу бренда CLAAS`,
    actionTips: ["制作中英俄三语CLAAS品牌推广页增强买家信任", "销售话术中强调CLAAS全球市占率>65%", "利用JAGUAR 1200世界纪录作为营销素材"],
    dataSummary: '[{"label":"CLAAS市占率","value":">65%"},{"label":"1000系列增速","value":"+44%"}]',
  },
  {
    icon: "📊", region: "中国", tags: ["980套利王", "75.5%价差"], date: TODAY,
    text: "Jaguar 980(2016)青储机系列最高套利！€320K→251万 vs 国内143万，价差108万(75.5%)",
    textEn: "Jaguar 980(2016) highest arbitrage in forage harvester lineup! €320K→CNY 2.51M vs domestic CNY 1.43M, spread CNY 1.08M (75.5%)",
    textRu: "Jaguar 980(2016) — самый прибыльный арбитраж в линейке! €320K→2.51 млн vs внутренние 1.43 млн, разница 1.08 млн (75.5%)",
    regionEn: "China", regionRu: "Китай",
    tagsEn: '["980 Arbitrage King", "75.5% Spread"]', tagsRu: '["980 Арбитражный король", "75.5% разница"]',
    detailedContent: `## Jaguar 980 套利深度分析\n\n**核心标的：** CLAAS Jaguar 980 (2016/2015)，EU €320K(厄尔省) = 251.0万元\n\n### 套利排行\n| 排名 | 品牌 | 型号 | 年份 | 国际万元 | 国内万元 | 价差(万元) | 价差率 |\n|------|------|------|------|----------|----------|-----------|--------|\n| 1 | CLAAS | 5300RC | 2020 | 85 | 18 | 67.0 | **372.2%** |\n| 2 | NH | FR450 | 2013 | 43.3 | 21.5 | 21.8 | **101.4%** |\n| **3** | **CLAAS** | **980** | **2016** | **251.0** | **143** | **108.0** | **75.5%** |\n| 4 | Krone | BigM 420 | 2018 | 78.4 | 49 | 29.4 | **60.0%** |\n| 5 | CLAAS | 5300RC | 2022 | 145.1 | 95 | 50.1 | **52.7%** |\n\n### 980操作要点\n- 青储机系列最高套利标的（含980两代）\n- 980(2016) 143万 vs 980(2015) 130万(抵押)，均可在售\n- 优先推俄语区+乌克兰买家\n- AGRO 2026展7月前应完成至少1台出口`,
    detailedContentEn: `## Jaguar 980 Deep Arbitrage Analysis\n\n**Core Target:** CLAAS Jaguar 980 (2016/2015), EU €320K (Eure, France) = CNY 2.51M\n\n### Arbitrage Ranking\n| Rank | Brand | Model | Year | Intl(CNY M) | Domestic | Spread(M) | Spread Rate |\n|------|------|------|------|----------|----------|-----------|--------|\n| 1 | CLAAS | 5300RC | 2020 | 0.85 | 0.18 | 0.67 | **372.2%** |\n| 2 | NH | FR450 | 2013 | 0.433 | 0.215 | 0.218 | **101.4%** |\n| **3** | **CLAAS** | **980** | **2016** | **2.51** | **1.43** | **1.08** | **75.5%** |\n| 4 | Krone | BigM 420 | 2018 | 0.784 | 0.49 | 0.294 | **60.0%** |\n| 5 | CLAAS | 5300RC | 2022 | 1.451 | 0.95 | 0.501 | **52.7%** |\n\n### 980 Action Points\n- Highest arbitrage target in forage harvester series (both 980 generations)\n- 980(2016) CNY 1.43M vs 980(2015) CNY 1.3M (lien), both available\n- Priority: Russian-speaking region + Ukrainian buyers\n- Complete at least 1 export before AGRO 2026 in July`,
    detailedContentRu: `## Глубокий арбитражный анализ Jaguar 980\n\n**Основная цель:** CLAAS Jaguar 980 (2016/2015), ЕС €320K (Эр, Франция) = 2.51 млн юаней\n\n### Рейтинг арбитража\n| Место | Бренд | Модель | Год | Междун.(млн) | Внутр.(млн) | Разница(млн) | % |\n|------|------|------|------|----------|----------|-----------|--------|\n| 1 | CLAAS | 5300RC | 2020 | 0.85 | 0.18 | 0.67 | **372.2%** |\n| 2 | NH | FR450 | 2013 | 0.433 | 0.215 | 0.218 | **101.4%** |\n| **3** | **CLAAS** | **980** | **2016** | **2.51** | **1.43** | **1.08** | **75.5%** |\n| 4 | Krone | BigM 420 | 2018 | 0.784 | 0.49 | 0.294 | **60.0%** |\n| 5 | CLAAS | 5300RC | 2022 | 1.451 | 0.95 | 0.501 | **52.7%** |\n\n### Действия по 980\n- Самая высокая цель арбитража в линейке силосоуборочных\n- 980(2016) 1.43 млн vs 980(2015) 1.3 млн (залог), оба доступны\n- Приоритет: русскоязычный регион + Украина\n- Завершить экспорт минимум 1 ед. до AGRO 2026 в июле`,
    actionTips: ["980加速俄语区成交，75.5%全青储机系列最高", "AGRO展前完成1台980出口乌克兰", "980+970组合方案提升客单价"],
    dataSummary: '[{"label":"980价差","value":"108万(75.5%)"},{"label":"在售","value":"2台(2016+2015)"}]',
  },
  {
    icon: "🇨🇳", region: "中国", tags: ["FR450爆款", "101.4%价差"], date: TODAY,
    text: "New Holland FR450(2013)汇率稳定期最佳走量标的！21.5万×10台+101.4%价差率+汇率零波动=定价信心最强",
    textEn: "New Holland FR450(2013) best volume seller in FX stability period! CNY 215K×10 units + 101.4% spread + zero FX volatility = highest pricing confidence",
    textRu: "New Holland FR450(2013) — лучший объёмный продавец в период стабильности валют! 215K×10 ед. + 101.4% разница + нулевая волатильность = максимальная уверенность",
    regionEn: "China", regionRu: "Китай",
    tagsEn: '["FR450 Hot Seller", "101.4% Spread"]', tagsRu: '["FR450 хит", "101.4% разница"]',
    detailedContent: `## FR450爆款速推策略\n\n**核心信息：** 21.5万/台×10台库存+101.4%价差率+汇率零波动=定价信心最强时期\n\n### FR450套利分析\n| 指标 | 数值 |\n|------|------|\n| 国内售价 | 21.5万元/台 |\n| 俄市场参考价 | 43.3万元 |\n| 价差 | 21.8万元 |\n| 价差率 | **101.4%** |\n| 库存 | **10台** |\n| 汇率敏感度 | 低（绝对价差小） |\n\n### 为什么现在是出手时机？\n1. EUR/CNY连续两日7.8425持平→套利计算置信度最高\n2. 101.4%价差=翻倍利润，汇率波动影响最小\n3. 21.5万低门槛=买家决策快\n4. 10台库存=走量模式，充分满足批量需求`,
    detailedContentEn: `## FR450 Hot Seller Strategy\n\n**Core Info:** CNY 215K/unit×10 units + 101.4% spread + zero FX volatility = highest pricing confidence period\n\n### FR450 Arbitrage Analysis\n| Indicator | Value |\n|------|------|\n| Domestic price | CNY 215K/unit |\n| Russian market ref | CNY 433K |\n| Spread | CNY 218K |\n| Spread rate | **101.4%** |\n| Inventory | **10 units** |\n| FX sensitivity | Low |\n\n### Why Now Is The Time\n1. EUR/CNY flat at 7.8425 for 2 days → highest arbitrage calculation confidence\n2. 101.4% spread = double profit, minimal FX impact\n3. CNY 215K low barrier = fast buyer decisions\n4. 10 units inventory = volume model, meets bulk demand`,
    detailedContentRu: `## Стратегия FR450 хита продаж\n\n**Ключевая информация:** 215 тыс. юаней/ед. × 10 ед. + 101.4% разница + нулевая волатильность = период максимальной уверенности\n\n### Арбитражный анализ FR450\n| Показатель | Значение |\n|------|------|\n| Внутренняя цена | 215 тыс./ед. |\n| Справочная цена РФ | 433 тыс. |\n| Разница | 218 тыс. |\n| Ставка разницы | **101.4%** |\n| Остаток | **10 ед.** |\n| Чувствительность к валютам | Низкая |\n\n### Почему сейчас лучшее время\n1. EUR/CNY стабилен 2 дня → максимальная точность расчёта\n2. 101.4% разница = двойная прибыль\n3. Низкий порог 215 тыс. = быстрое решение\n4. 10 ед. на складе = объёмные продажи`,
    actionTips: ["FR450俄语区批量速推10台", "汇率稳定期定价信心最强，加快成交", "一口价21.5万策略吸引小型买家"],
    dataSummary: '[{"label":"FR450价差","value":"101.4%"},{"label":"库存","value":"10台"}]',
  },
  {
    icon: "💰", region: "中国", tags: ["5300RC白菜价", "372.2%"], date: TODAY,
    text: "CLAAS 5300RC(2020)仅18万白菜价！国际参考85万，372.2%价差率全品类第一需确认车况",
    textEn: "CLAAS 5300RC(2020) only CNY 180K bargain! Intl reference CNY 850K, 372.2% spread rate #1 overall, condition verification needed",
    textRu: "CLAAS 5300RC(2020) всего 180 тыс. юаней — дешевле некуда! Межд. справочная 850K, 372.2% разница #1, требуется проверка состояния",
    regionEn: "China", regionRu: "Китай",
    tagsEn: '["5300RC Bargain", "372.2%"]', tagsRu: '["5300RC дешевизна", "372.2%"]',
    detailedContent: `## 5300RC(2020)白菜价分析\n\n**核心信息：** CLAAS 5300RC(2020)仅售18万元，国际同级参考85万元以上，价差率372.2%全品类第一\n\n### 套利分析\n| 指标 | 数值 |\n|------|------|\n| 国内售价 | **18万元** |\n| 国际同级参考 | **85万元** |\n| 价差 | **67.0万元** |\n| 价差率 | **372.2%** |\n| 套利排名 | **全品类第一** |\n| 车况 | 需确认 |\n\n### 注意事项\n- ⚠️ 18万价格极低，需重点确认车况和手续完整性\n- 若车况经现场验证良好，应作为最优先出口标的\n- 国际买方对此价格敏感度极高，需提供详细车况报告\n- 配合FAO乌克兰谷物增产需求，可对接乌克兰大方捆买家`,
    detailedContentEn: `## 5300RC(2020) Bargain Analysis\n\n**Core Info:** CLAAS 5300RC(2020) only CNY 180K, intl reference CNY 850K+, spread rate 372.2% #1 overall\n\n### Arbitrage Analysis\n| Indicator | Value |\n|------|------|\n| Domestic price | **CNY 180K** |\n| Intl reference | **CNY 850K** |\n| Spread | **CNY 670K** |\n| Spread rate | **372.2%** |\n| Ranking | **#1 overall** |\n| Condition | Needs verification |\n\n### Notes\n- ⚠️ Extremely low price of CNY 180K, condition verification critical\n- If verified in good condition, should be top export priority\n- Intl buyers highly price-sensitive to this, provide detailed condition report\n- Leverage FAO Ukraine grain demand to connect with Ukrainian large baler buyers`,
    detailedContentRu: `## Анализ дешевизны 5300RC(2020)\n\n**Ключевая информация:** CLAAS 5300RC(2020) всего 180 тыс. юаней, международная справочная 850K+, разница 372.2% #1\n\n### Арбитражный анализ\n| Показатель | Значение |\n|------|------|\n| Внутренняя цена | **180 тыс.** |\n| Межд. справочная | **850 тыс.** |\n| Разница | **670 тыс.** |\n| Ставка разницы | **372.2%** |\n| Рейтинг | **#1** |\n| Состояние | Требует проверки |\n\n### Примечания\n- ⚠️ Чрезвычайно низкая цена, критически важна проверка состояния\n- При подтверждении хорошего состояния — приоритетный экспорт\n- Международные покупатели очень чувствительны к цене`,
    actionTips: ["重点确认5300RC(2020)车况和手续", "若车况良好作为最优先出口标的", "配合FAO乌克兰谷物增产对接大方捆需求"],
    dataSummary: '[{"label":"5300RC价差率","value":"372.2%"},{"label":"国内价","value":"18万"}]',
  },
  {
    icon: "🇺🇦", region: "乌克兰", tags: ["FAO恢复计划", "AGRO 2026"], date: TODAY,
    text: "FAO确认乌克兰83.6百万吨谷物产量预测+AGRO 2026展7月基辅举办，农机确定性需求窗口打开",
    textEn: "FAO confirms Ukraine 83.6M ton grain forecast + AGRO 2026 exhibition in Kyiv July, agricultural machinery definitive demand window opening",
    textRu: "ФАО подтверждает прогноз 83.6 млн т зерна в Украине + выставка AGRO 2026 в Киеве в июле, окно спроса на сельхозтехнику открывается",
    regionEn: "Ukraine", regionRu: "Украина",
    tagsEn: '["FAO Recovery Plan", "AGRO 2026"]', tagsRu: '["План восстановления ФАО", "AGRO 2026"]',
    detailedContent: `## 乌克兰农机需求窗口\n\n### 最新进展\n| 项目 | 状态 |\n|------|------|\n| FAO三年恢复计划 | 推进中 |\n| 2026年谷物产量预测 | **83.6百万吨**（USDA确认增产） |\n| AGRO 2026国际农业展 | **7月基辅举办，第34届** |\n| 黑海+多瑙河路线 | 已恢复运行 |\n\n### 对神雕的机会\n| 机型 | 年出口潜力 | 匹配度 |\n|------|-----------|--------|\n| 980(2016) 143万 | 2-3台/年 | ⭐⭐⭐⭐⭐ |\n| 970(2017) 163万 | 3-5台/年 | ⭐⭐⭐⭐⭐ |\n| 5300RC(2022) 95万 | 5-10台/年 | ⭐⭐⭐⭐⭐ |\n| FR450(2013) 21.5万 | 10-20台/年 | ⭐⭐⭐⭐ |\n\n### 行动要点\n- AGRO 2026展前完成线上对接\n- FAO资金支持计划可降低买家资金门槛\n- 提供战后重建特别融资方案`,
    detailedContentEn: `## Ukraine Agricultural Machinery Demand Window\n\n### Latest Progress\n| Item | Status |\n|------|------|\n| FAO 3-year recovery plan | Advancing |\n| 2026 grain production forecast | **83.6M tons** (USDA confirms increase) |\n| AGRO 2026 International Ag Expo | **July Kyiv, 34th edition** |\n| Black Sea + Danube routes | Operational |\n\n### Shendiao Opportunities\n| Model | Annual Export Potential | Fit |\n|------|-----------|------|\n| 980(2016) CNY 1.43M | 2-3 units/yr | ⭐⭐⭐⭐⭐ |\n| 970(2017) CNY 1.63M | 3-5 units/yr | ⭐⭐⭐⭐⭐ |\n| 5300RC(2022) CNY 0.95M | 5-10 units/yr | ⭐⭐⭐⭐⭐ |\n| FR450(2013) CNY 0.215M | 10-20 units/yr | ⭐⭐⭐⭐ |\n\n### Action Points\n- Complete online connections before AGRO 2026\n- FAO funding programs can lower buyer capital barriers\n- Offer post-war reconstruction special financing packages`,
    detailedContentRu: `## Окно спроса на сельхозтехнику в Украине\n\n### Последние новости\n| Проект | Статус |\n|------|------|\n| План восстановления ФАО на 3 года | Выполняется |\n| Прогноз производства зерна 2026 | **83.6 млн т** |\n| Выставка AGRO 2026 | **Июль, Киев, 34-я** |\n| Маршруты Чёрного моря + Дуная | Действуют |\n\n### Возможности Шэньдяо\n| Модель | Потенциал экспорта/год | Совпадение |\n|------|-----------|------|\n| 980(2016) 1.43 млн | 2-3 ед. | ⭐⭐⭐⭐⭐ |\n| 970(2017) 1.63 млн | 3-5 ед. | ⭐⭐⭐⭐⭐ |\n| 5300RC(2022) 0.95 млн | 5-10 ед. | ⭐⭐⭐⭐⭐ |\n| FR450(2013) 0.215 млн | 10-20 ед. | ⭐⭐⭐⭐ |\n\n### Действия\n- Завершить онлайн-подключение до AGRO 2026\n- Программы финансирования ФАО снижают барьеры`,
    actionTips: ["AGRO 2026展7月前完成线上对接乌克兰买家", "5300RC+980优先推乌克兰FAO恢复需求", "提供战后重建特别融资方案"],
    dataSummary: '[{"label":"FAO乌克兰谷物","value":"83.6百万吨"},{"label":"AGRO 2026","value":"7月基辅"}]',
  },
  {
    icon: "🇷🇺", region: "俄罗斯", tags: ["EU制裁", "替代窗口"], date: TODAY,
    text: "EU第20轮制裁持续发酵+配件断供加剧+俄罗斯2026农机排第一优先产业，中国设备替代窗口稳固",
    textEn: "EU 20th round sanctions continue + parts disruption worsening + Russia 2026 ag machinery #1 priority industry, Chinese equipment substitution window solid",
    textRu: "20-й раунд санкций ЕС продолжается + перебои с запчастями усиливаются + с/х машиностроение РФ приоритет №1 в 2026, окно замещения китайской техникой стабильно",
    regionEn: "Russia", regionRu: "Россия",
    tagsEn: '["EU Sanctions", "Substitution Window"]', tagsRu: '["Санкции ЕС", "Окно замены"]',
    detailedContent: `## EU制裁对中国农机出口俄罗斯的影响\n\n### 制裁现状\n| 维度 | 具体变化 |\n|------|--------|\n| EU第20轮制裁 | 4月23日实施，新增120项 |\n| 欧美配件断供 | CLAAS/Deere/Kubota配件供应中断加剧 |\n| 中国设备替代 | 二手中国农机不受制裁限制 |\n| 中俄人民币结算 | 通道全面稳定，汇率零波动 |\n\n### 俄罗斯政策利好\n| 政策 | 详情 |\n|------|------|\n| 2026优先产业 | 农机排**第一** |\n| 进口关税 | 5%低关税 |\n| 政府补贴 | 农机采购补贴可用 |\n| 物流通道 | 中俄铁路运输30-40天到货 |\n\n### 对神雕的影响\n- 970/980/850均符合俄市场刚需\n- 中俄人民币结算通道稳定，汇率风险低\n- 可利用5%低关税+补贴政策设计促销方案`,
    detailedContentEn: `## EU Sanctions Impact on Chinese Agricultural Exports to Russia\n\n### Sanction Status\n| Dimension | Specific Changes |\n|------|--------|\n| EU 20th round | Implemented Apr 23, 120 new items |\n| Western parts disruption | CLAAS/Deere/Kubota parts supply worsening |\n| Chinese substitution | Used Chinese machinery not sanctioned |\n| CNY settlement | Channel fully stable, zero FX volatility |\n\n### Russia Policy Benefits\n| Policy | Detail |\n|------|------|\n| 2026 priority industry | Ag machinery **#1** |\n| Import tariff | 5% low tariff |\n| Government subsidy | Machinery purchase subsidy available |\n| Logistics | China-Russia rail 30-40 days delivery |\n\n### Shendiao Impact\n- 970/980/850 all meet Russian market demand\n| CNY-RUB settlement channel stable, low FX risk\n- Leverage 5% low tariff + subsidies for promotion packages`,
    detailedContentRu: `## Влияние санкций ЕС на экспорт китайской техники в Россию\n\n### Статус санкций\n| Измерение | Конкретные изменения |\n|------|--------|\n| 20-й раунд ЕС | Вступил в силу 23 апреля, 120 новых позиций |\n| Перебои с запчастями | CLAAS/Deere/Kubota усиливаются |\n| Замена китайской | Б/у китайская техника не под санкциями |\n| Расчёты в юанях | Канал полностью стабилен |\n\n### Политика РФ\n| Политика | Детали |\n|------|------|\n| Приоритет 2026 | **№1** |\n| Пошлина | 5% |\n| Субсидии | Доступны |\n| Логистика | Ж/д 30-40 дней |\n\n### Влияние на Шэньдяо\n- 970/980/850 — всё соответствует спросу РФ\n- Расчёты в юанях стабильны, низкий валютный риск`,
    actionTips: ["重点推CLAAS二手970/980替代欧美断供机型", "利用中俄人民币结算通道降低汇率风险", "借助5%低关税+政府补贴政策设计促销方案"],
    dataSummary: '[{"label":"EU制裁规模","value":"120项新增"},{"label":"俄农机关税","value":"5%"}]',
  },
  {
    icon: "🇺🇿", region: "乌兹别克斯坦", tags: ["增速最快", "+256%"], date: TODAY,
    text: "乌兹别克斯坦Q1进口增长256.77%全球最快！新疆农机展确认需求，棉花采收机械化率<40%",
    textEn: "Uzbekistan Q1 import growth +256.77% globally fastest! Xinjiang exhibition confirms demand, cotton harvest mechanization <40%",
    textRu: "Узбекистан Q1 рост импорта +256.77% — самый быстрый в мире! Выставка в Синьцзяне подтверждает спрос, механизация хлопкоуборки <40%",
    regionEn: "Uzbekistan", regionRu: "Узбекистан",
    tagsEn: '["Fastest Growth", "+256%"]', tagsRu: '["Самый быстрый рост", "+256%"]',
    detailedContent: `## 乌兹别克斯坦市场持续爆发\n\n### 核心数据\n| 指标 | 数值 |\n|------|------|\n| Q1进口增速 | **+256.77%** |\n| 棉花采收机械化率 | 不足40% |\n| 政府补贴 | 农机购置补贴50% |\n| 物流 | 中吉乌铁路建设加速 |\n\n### 新疆农机展关联\n| 维度 | 详情 |\n|------|------|\n| 地理距离 | 新疆与乌兹别克接壤，物流距离近 |\n| 机型匹配 | 棉花采收机(采棉机)需求旺盛 |\n| 语言文化 | 部分俄语通用，沟通成本低 |\n\n### 推荐机型\n- 青储收获机：CLAAS 850/860（60-120万）\n- 拖拉机：NH/Deere 100-200HP（30-80万）\n- 打捆机：Krone 500/600（15-40万）`,
    detailedContentEn: `## Uzbekistan Market Continues to Surge\n\n### Core Data\n| Indicator | Value |\n|------|------|\n| Q1 import growth | **+256.77%** |\n| Cotton harvest mechanization | Below 40% |\n| Government subsidies | 50% machinery purchase subsidy |\n| Logistics | China-Kyrgyzstan-Uzbekistan railway accelerating |\n\n### Xinjiang Exhibition Connection\n| Dimension | Detail |\n|------|------|\n| Distance | Xinjiang borders Uzbekistan, close logistics |\n| Model match | Cotton harvesters in high demand |\n| Language | Russian partially common, low communication cost |\n\n### Recommended Models\n- Forage harvesters: CLAAS 850/860 (CNY 600K-1.2M)\n- Tractors: NH/Deere 100-200HP (CNY 300K-800K)\n- Balers: Krone 500/600 (CNY 150K-400K)`,
    detailedContentRu: `## Рынок Узбекистана продолжает бурный рост\n\n### Основные данные\n| Показатель | Значение |\n|------|------|\n| Рост импорта Q1 | **+256.77%** |\n| Механизация хлопкоуборки | Ниже 40% |\n| Субсидии | 50% |\n| Логистика | Ж/д Китай-Кыргызстан-Узбекистан |\n\n### Связь с выставкой в Синьцзяне\n| Измерение | Детали |\n|------|------|\n| Расстояние | Синьцзян граничит с Узбекистаном |\n| Техника | Хлопкоуборочные машины |\n| Язык | Русский частично используется |\n\n### Рекомендуемые модели\n- Силосоуборочные: CLAAS 850/860\n- Тракторы: NH/Deere 100-200 л.с.\n- Пресс-подборщики: Krone 500/600`,
    actionTips: ["乌兹别克语+俄语版产品手册优先制作", "重点关注采棉机相关机型推广", "50%政府补贴融资方案设计"],
    dataSummary: '[{"label":"乌兹别克Q1增速","value":"+256.77%"},{"label":"采棉机械化","value":"<40%"}]',
  },
  {
    icon: "🌍", region: "非洲", tags: ["肯尼亚+46%", "NAMPO展后"], date: TODAY,
    text: "NAMPO南非展后需求增长！肯尼亚农机进口+46.6%，印尼+121.07%爆发，新兴市场持续升温",
    textEn: "Post-NAMPO South Africa demand growing! Kenya ag machinery imports +46.6%, Indonesia +121.07% surge, emerging markets heating up",
    textRu: "Спрос после NAMPO в ЮАР растёт! Кения +46.6%, Индонезия +121.07% взрыв, развивающиеся рынки набирают обороты",
    regionEn: "Africa", regionRu: "Африка",
    tagsEn: '["Kenya +46%", "Post-NAMPO"]', tagsRu: '["Кения +46%", "После NAMPO"]',
    detailedContent: `## 新兴市场动态\n\n### 非洲市场\n| 国家 | 增速 | 需求机型 |\n|------|------|--------|\n| 🇰🇪 肯尼亚 | **+46.6%** | 50-100HP拖拉机 |\n| 🇳🇬 尼日利亚 | 稳健 | 中型拖拉机/收割机 |\n| 🇿🇦 南非 | 商业化农业 | 大型农机具 |\n| 🇪🇬 埃及 | 灌溉农业 | 拖拉机/水泵 |\n\n### 东南亚市场\n| 国家 | 增速 | 需求机型 |\n|------|------|--------|\n| 🇮🇩 印尼 | **+121.07%** | 微耕机/小型收割机 |\n| 🇹🇭 泰国 | 中速 | 插秧机/收割机 |\n| 🇵🇭 菲律宾 | 快速 | 手扶拖拉机/收割机 |\n\n### 机会点\n- 中国二手农机=欧洲新品20-30%价格\n- 非洲大陆自贸区降低关税壁垒\n- NAMPO展后需求持续释放\n- 印尼+121.07%为全球增速前三`,
    detailedContentEn: `## Emerging Markets Update\n\n### Africa Market\n| Country | Growth | Demanded Models |\n|------|------|--------|\n| 🇰🇪 Kenya | **+46.6%** | 50-100HP tractors |\n| 🇳🇬 Nigeria | Steady | Medium tractors/Harvesters |\n| 🇿🇦 South Africa | Commercial ag | Large machinery |\n| 🇪🇬 Egypt | Irrigated farming | Tractors/Pumps |\n\n### Southeast Asia Market\n| Country | Growth | Demanded Models |\n|------|------|--------|\n| 🇮🇩 Indonesia | **+121.07%** | Mini tillers/Small harvesters |\n| 🇹🇭 Thailand | Moderate | Rice transplanters/Harvesters |\n| 🇵🇭 Philippines | Fast | Walking tractors/Harvesters |\n\n### Opportunities\n- Chinese used machinery = 20-30% of European new prices\n- African Continental Free Trade Area reduces tariffs\n- Post-NAMPO demand continues\n- Indonesia +121.07% ranks top 3 globally`,
    detailedContentRu: `## Обновление развивающихся рынков\n\n### Африка\n| Страна | Рост | Модели |\n|------|------|--------|\n| 🇰🇪 Кения | **+46.6%** | 50-100 л.с. тракторы |\n| 🇳🇬 Нигерия | Стабильный | Средние тракторы |\n| 🇿🇦 ЮАР | Коммерческое | Крупная техника |\n| 🇪🇬 Египет | Орошение | Тракторы/Насосы |\n\n### ЮВА\n| Страна | Рост | Модели |\n|------|------|--------|\n| 🇮🇩 Индонезия | **+121.07%** | Мотоблоки |\n| 🇹🇭 Таиланд | Умеренный | Рассадопосадочные |\n| 🇵🇭 Филиппины | Быстрый | Мотоблоки |\n\n### Возможности\n- Китайская б/у = 20-30% цены новой европейской`,
    actionTips: ["非洲主推50-100HP拖拉机+关注肯尼亚高潜市场", "印尼市场优先布局小型拖拉机+收割机", "利用非洲自贸区关税优惠加速进入"],
    dataSummary: '[{"label":"肯尼亚增速","value":"+46.6%"},{"label":"印尼增速","value":"+121.07%"}]',
  },
  {
    icon: "🔄", region: "全球", tags: ["操作建议", "7大优先"], date: TODAY,
    text: "今日7大操作优先：980俄语区(75.5%)→FR450爆款(101.4%)→5300RC乌克兰(52.7%)→英国市场调研→BigM东欧(60.0%)→CLAAS品牌背书→汇率稳定锁定合同",
    textEn: "Today's 7 priorities: 980 Russian region (75.5%)→FR450 hot seller (101.4%)→5300RC Ukraine (52.7%)→UK market research→BigM Eastern Europe (60.0%)→CLAAS brand→FX stable lock contracts",
    textRu: "7 приоритетов: 980 РФ (75.5%)→FR450 хит (101.4%)→5300RC Украина (52.7%)→Великобритания→BigM ВЕ (60.0%)→бренд CLAAS→фиксация контрактов",
    regionEn: "Global", regionRu: "Глобально",
    tagsEn: '["Action Plan", "7 Priorities"]', tagsRu: '["План действий", "7 приоритетов"]',
    detailedContent: `## 今日7大操作优先级\n\n| 优先级 | 操作 | 价差率 | 紧迫度 |\n|--------|------|--------|--------|\n| 1 | **980加速俄语区成交** | 75.5% | 🔴 最急 |\n| 2 | **FR450爆款10台速推** | 101.4% | 🔴 最急 |\n| 3 | **5300RC乌克兰线(95万)** | 52.7% | 🟡 高 |\n| 4 | **英国市场采购渠道调研** | 16%差价 | 🟡 高 |\n| 5 | **BigM 420东欧推进** | 60.0% | 🟡 高 |\n| 6 | **CLAAS品牌背书营销** | — | 🟢 中 |\n| 7 | **汇率稳定期锁定合同** | — | 🟢 中 |\n\n### 本周关键时间节点\n- **汇率持续稳定**：EUR/CNY=7.8425连续两日持平，套利计算置信度最高\n- **英国市场新发现**：970(2019)比德国便宜16%，需评估采购→转口可行性\n- **AGRO 2026展**：7月基辅（倒计时约3周）\n- **本周目标**：980+FR450各完成至少1单对接`,
    detailedContentEn: `## Today's 7 Action Priorities\n\n| Priority | Action | Spread Rate | Urgency |\n|--------|------|--------|--------|\n| 1 | **980 accelerate Russian region deals** | 75.5% | 🔴 Most urgent |\n| 2 | **FR450 hot seller 10 units push** | 101.4% | 🔴 Most urgent |\n| 3 | **5300RC Ukraine line (CNY 950K)** | 52.7% | 🟡 High |\n| 4 | **UK market sourcing channel research** | 16% gap | 🟡 High |\n| 5 | **BigM 420 Eastern Europe push** | 60.0% | 🟡 High |\n| 6 | **CLAAS brand endorsement marketing** | — | 🟢 Medium |\n| 7 | **Lock contracts in FX stability period** | — | 🟢 Medium |\n\n### Key Milestones This Week\n- **FX continues stable**: EUR/CNY=7.8425 flat 2 days, highest arb calculation confidence\n- **UK market discovery**: 970(2019) 16% cheaper than Germany\n- **AGRO 2026 exhibition**: July Kyiv (about 3 weeks countdown)\n- **This week target**: Complete at least 1 deal connect each for 980 + FR450`,
    detailedContentRu: `## 7 приоритетов действий на сегодня\n\n| Приоритет | Действие | Ставка разницы | Срочность |\n|--------|------|--------|--------|\n| 1 | **980 ускорить сделки в РФ** | 75.5% | 🔴 Самое срочное |\n| 2 | **FR450 хит 10 ед.** | 101.4% | 🔴 Самое срочное |\n| 3 | **5300RC линия Украина** | 52.7% | 🟡 Высокая |\n| 4 | **Исследование закупок UK** | 16% | 🟡 Высокая |\n| 5 | **BigM 420 Восточная Европа** | 60.0% | 🟡 Высокая |\n| 6 | **Маркетинг бренда CLAAS** | — | 🟢 Средняя |\n| 7 | **Фиксация контрактов** | — | 🟢 Средняя |\n\n### Ключевые вехи\n- Валюта стабильна, высокая точность расчётов\n- Рынок UK на 16% дешевле Германии\n- AGRO 2026 в июле в Киеве`,
    actionTips: ["980俄语区+FR450爆款双线并行推广", "英国€265K市场调研评估采购渠道", "汇率稳定期加速锁定长期合同"],
    dataSummary: '[{"label":"首推机型","value":"980+FR450"},{"label":"汇率状态","value":"7.8425(持平)"}]',
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
        dataSummary: item.dataSummary || null,
        actionTips: item.actionTips ? JSON.stringify(item.actionTips) : null,
        sortOrder: i,
      },
    });
  }
  console.log(`已导入 ${ALL_MARKET_INTEL.length} 条情报数据 (日期: 2026-06-13)`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
