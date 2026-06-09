/**
 * 导入市场情报数据到数据库（多语言版）
 * 从 2026-06-07 跨境套利日报 提取生成
 * 自动化任务 — 2026-06-08 10:34
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const ALL_MARKET_INTEL = [
  // == 1. 汇率 ==
  {
    icon: "💰", region: "汇率", tags: ["EUR/CNY", "7.8919", "周末央行中间价"], date: "2026-06-07",
    text: "EUR/CNY央行中间价7.8919(+0.14%)vs实时7.8074回调-0.76%，暗示人民币走强不可持续，预计下周回升至7.82-7.85",
    textEn: "EUR/CNY PBOC fix 7.8919(+0.14%) vs real 7.8074(-0.76%), signaling RMB strength unsustainable, expected to revert 7.82-7.85 next week",
    textRu: "EUR/CNY курс ЦБ 7.8919(+0.14%) против рынка 7.8074(-0.76%), укрепление юаня неустойчиво, ожидается возврат к 7.82-7.85",
    detailedContent: `## 当日核心汇率（2026-06-07 市场实时汇率）

| 货币对 | 汇率 | 日环比变化 | 备注 |
|--------|------|------------|------|
| EUR/CNY | 7.8919 | +0.0108 (央行中间价，vs 6月6日 7.8752) | 央行中间价微升0.14%，欧元震荡企稳 |
| USD/CNY | 6.8157 | +0.0147 (央行中间价，vs 6月6日 6.8010) | 美元微升，中行现汇买入6.7791 |

> 数据来源：中国人民银行6月7日汇率中间价、chl.cn
> 6月6日参考汇率：EUR/CNY 7.8074 (实时) | USD/CNY 6.7764 (实时)

### ⚠️ 周末汇率不确定性
- 今日为周日，央行中间价仅反映估值，实际汇率待周一开盘确认
- 欧元在上周五经历0.76%大幅回调后，央行中间价仅微调0.14%，显示央行对人民币走强态度谨慎
- 关键信号：央行中间价仅微调，暗示人民币快速走强不可持续，预计下周EUR/CNY将回升至7.82-7.85区间

### 汇率对套利利润的影响
- 周末央行中间价7.8919高于周五实时7.8074，对欧元计价套利标的有利
- 以970(2017)：€265,169→以7.89计算209.2万，比7.81高出约2.4万元
- USD/CNY央行中间价创阶段新高6.8157，美元结算利润扩大`,
    detailedContentEn: `## Core Exchange Rates (2026-06-07 Market Data)

| Currency | Rate | Daily Change | Notes |
|----------|------|-------------|-------|
| EUR/CNY | 7.8919 | +0.0108 (PBOC fix, vs Jun 6: 7.8752) | PBOC fix edging up 0.14% |
| USD/CNY | 6.8157 | +0.0147 (PBOC fix, vs Jun 6: 6.8010) | USD edging up |

> Source: PBOC Jun 7, chl.cn

### ⚠️ Weekend FX Uncertainty
- Sunday: PBOC fix reflects valuation, actual rates wait for Monday opening
- Euro -0.76% Friday, fix only -0.14% — signaling RMB strength unsustainable
- Expected EUR/CNY to recover to 7.82-7.85 next week

### Impact on Arbitrage
- PBOC fix 7.8919 vs Friday real 7.8074 — favorable for EUR arbitrage
- 970(2017): €265,169→2.092M at 7.89 vs 2.068M at 7.81 (+24K RMB)`,
    detailedContentRu: `## Ключевые курсы валют (рынок 2026-06-07)

| Валюта | Курс | Изменение | Примечание |
|--------|------|----------|------------|
| EUR/CNY | 7.8919 | +0.0108 (курс ЦБ) | Курс ЦБ вырос на 0.14% |
| USD/CNY | 6.8157 | +0.0147 (курс ЦБ) | Доллар вырос |

### ⚠️ Неопределённость выходных
- Воскресенье: курс ЦБ отражает оценку, реальный курс ждать понедельника
- Евро -0.76% в пятницу, курс ЦБ -0.14% — сигнал, что юань неустойчив
- Ожидается восстановление EUR/CNY до 7.82-7.85`,
    actionTips: ["关注周一EUR/CNY开盘，若回升至7.85以上则验证欧元回调是短期波动", "央行中间价7.8919高于实时7.8074，欧元实际价值被低估，可逢低购入欧元", "利用周末央行估值作为谈判锚点，向买家展示欧元区价格上行趋势"],
    dataSummary: [{ label: "EUR/CNY央行价", value: "7.8919(+0.14%)" }, { label: "EUR/CNY实时(周五)", value: "7.8074(-0.76%)" }, { label: "USD/CNY央行价", value: "6.8157(+0.58%)" }],
  },
  // == 2. 欧洲 — 德国天价 ==
  {
    icon: "🇪🇺", region: "欧洲", tags: ["€550K天价", "德国萨安州", "970供给紧缺"], date: "2026-06-07",
    text: "德国萨安州970(2023)€550K创新天价！比法国同级高15.8%，反映欧洲高端青储机供给紧缺持续，可作营销话术强化",
    textEn: "Germany Saxony-Anhalt 970(2023) €550K record high! 15.8% above French equivalent, reflecting sustained EU supply tightness — leverage as marketing narrative",
    textRu: "Германия 970(2023) €550K рекорд! На 15.8% выше французского аналога — дефицит в ЕС сохраняется, использовать в маркетинге",
    detailedContent: `## 欧洲市场最新报价（Agriaffaires，EUR）

> 数据来源：Agriaffaires欧洲平台，24条CLAAS Jaguar 970在售（较昨日25条-1），2026-06-07采集。换算汇率 EUR→CNY@7.89。

### 🔥 本周新变化 — 德国天价
| 型号 | 年份 | 价格(EUR) | 换算人民币 | 工时 | 所在地 |
|------|------|-----------|-----------|------|--------|
| CLAAS Jaguar 970 | 2023 | **€550,000** | **≈ 434.0万元** | 1,101h | 德国萨安州 |
| CLAAS Jaguar 970 | 2024 | €475,000 | ≈ 374.8万元 | 1,100h | 法国马恩省 |

> 德国€550K比法国€475K高15.8%！反映德国市场供给紧缺加剧

### 其他关键报价
| 品牌 | 型号 | 年份 | 价格(EUR) | 换算人民币 | 工时 | 所在地 |
|------|------|------|-----------|-----------|------|--------|
| CLAAS | Jaguar 970 | 2024 | €329,000 | ≈ 259.6万元 | 870h | 德国巴符州 |
| CLAAS | Jaguar 970 | 2021 | €359,500 | ≈ 283.6万元 | 1,943h | 德国萨安州 |
| CLAAS | Jaguar 970 | 2021 | €360,000 | ≈ 284.0万元 | 1,950h | 德国梅前州 |
| CLAAS | Jaguar 970 | 2022 | €325,000 | ≈ 256.4万元 | 1,250h | 法国芒什省 |
| CLAAS | Jaguar 970 | 2019 | €265,169 | ≈ 209.2万元 | 2,000h | 英国坎布里亚郡 |
| CLAAS | Jaguar 970 | 2013 | €167,500 | ≈ 132.2万元 | 3,436h | 德国下萨克森 |
| CLAAS | Jaguar 980 | 2024 | €467,900 | ≈ 369.2万元 | 1,750h | 德国巴符州 |
| CLAAS | Jaguar 990 | 2024 | €379,000 | ≈ 299.0万元 | — | 德国巴符州 |

### 核心发现
- 德国萨安州970(2023)€550,000创新天价，供给极度紧缺
- 970在售总量24条（vs前日25条），供给稳定中小幅下降
- 德国天价可作为神雕降价营销的锚点：国际最高€550K vs 国内163万`,
    detailedContentEn: `## Europe Market Prices (Agriaffaires, EUR)

> Source: Agriaffaires, 24 CLAAS Jaguar 970 listings (vs 25 yesterday, -1), collected 2026-06-07. Rate EUR→CNY@7.89.

### 🔥 This Week — German Record High
| Model | Year | Price(EUR) | RMB | Hours | Location |
|-------|------|-----------|-----|-------|----------|
| CLAAS Jaguar 970 | 2023 | **€550,000** | **≈ 4.340M** | 1,101h | Saxony-Anhalt, DE |
| CLAAS Jaguar 970 | 2024 | €475,000 | ≈ 3.748M | 1,100h | Marne, FR |

> German €550K is 15.8% above French €475K! Supply tightness in Germany intensifying

### Key Observations
- German 970(2023) €550K record high — supply extremely tight
- Total 970 listings: 24 (vs 25 previous day), slight supply decline
- German record can serve as marketing anchor: int'l peak €550K vs China 1.63M`,
    detailedContentRu: `## Цены в Европе (Agriaffaires, EUR)

> Источник: Agriaffaires, 24 объявления CLAAS Jaguar 970, 2026-06-07. Курс EUR→CNY@7.89.

### 🔥 Рекорд Германии
| Модель | Год | Цена(EUR) | Юани | Часы | Локация |
|--------|-----|-----------|------|------|--------|
| CLAAS Jaguar 970 | 2023 | **€550,000** | **≈ 4.340 млн** | 1,101h | Саксония-Анхальт, DE |
| CLAAS Jaguar 970 | 2024 | €475,000 | ≈ 3.748 млн | 1,100h | Марна, FR |

### Ключевые выводы
- Рекорд Германии €550K — дефицит в ЕС усиливается
- Всего 24 объявления 970 (против 25 ранее), предложение снижается
- €550K vs Китай 1.63 млн — мощный маркетинговый аргумент`,
    actionTips: ["以€550K天价为营销锚点，向买家展示德国高端青储机供给紧缺状况", "强调神雕国内163万的极端性价比，与€550K形成强烈对比", "若买家犹豫，用德国天价作为价格上涨趋势证明，加速成交"],
    dataSummary: [{ label: "德国970(2023)", value: "€550K(434万)" }, { label: "国内970(2017)", value: "163万" }, { label: "供给趋势", value: "24条(-1)紧缺" }],
  },
  // == 3. 欧洲 — 980套利 ==
  {
    icon: "🇪🇺", region: "欧洲", tags: ["980", "€320K", "价差109.5万", "76.6%"], date: "2026-06-07",
    text: "Jaguar 980(2016)国内143万 vs 国际252.5万(€320K法国厄尔省)，价差109.5万(76.6%)！全系列最高套利标的",
    textEn: "Jaguar 980(2016) China 1.43M vs int'l 2.525M(€320K Eure France), spread 1.095M(76.6%)! Highest arbitrage margin in line",
    textRu: "Jaguar 980(2016) Китай 1.43 млн vs мир 2.525 млн(€320K Эр Франция), спред 1.095 млн(76.6%)! Максимальный арбитраж",
    detailedContent: `## 980系列套利机会分析

### 最新国际报价
| 型号 | 年份 | 价格(EUR) | 换算人民币(@7.89) | 工时 | 所在地 |
|------|------|-----------|-----------------|------|--------|
| Jaguar 980 | 2024 | €467,900 | ≈ 369.2万元 | 1,750h | 德国巴符州 |
| Jaguar 980 | 2023 | €359,000 | ≈ 283.2万元 | 1,380h | 法国芒什省 |
| Jaguar 980 | 2023 | €320,000 | ≈ 252.5万元 | 2,304h | 法国厄尔省 |

### 核心套利分析
| 机型 | 国际人民币价 | 国内售价 | 价差（万元） | 价差率 |
|------|-------------|---------|-------------|--------|
| CLAAS Jaguar 980(2016) | 252.5万元(EU€320K) | 143万元 | 109.5 | **76.6%** |
| CLAAS Jaguar 980(2015) | 252.5万元(EU€320K) | 130万元(抵押) | 122.5 | **94.2%** |

> 🔥 980系列是当前最高套利标的！美元计价市场暂无可比报价，应优先推俄语区。
> 国内143万 vs 国际252.5万，价差109.5万创全系列最高

### 新机交付周期优势
- 新机交付12-18个月，二手溢价持续
- 国际买家可能因新机太贵转而寻找二手980
- 国内2016/2015款是价格洼地`,
    detailedContentEn: `## 980 Series Arbitrage Analysis

### Latest Int'l Quotes
| Model | Year | Price(EUR) | RMB(@7.89) | Hours | Location |
|-------|------|-----------|-----------|-------|----------|
| Jaguar 980 | 2024 | €467,900 | ≈ 3.692M | 1,750h | Baden-Württemberg, DE |
| Jaguar 980 | 2023 | €359,000 | ≈ 2.832M | 1,380h | Manche, FR |
| Jaguar 980 | 2023 | €320,000 | ≈ 2.525M | 2,304h | Eure, FR |

### Core Arbitrage
| Model | Int'l Price | China Price | Spread | Rate |
|-------|------------|-------------|--------|------|
| CLAAS Jaguar 980(2016) | 2.525M(€320K) | 1.43M | 1.095M | **76.6%** |
| CLAAS Jaguar 980(2015) | 2.525M(€320K) | 1.30M(pledge) | 1.225M | **94.2%** |

> 🔥 980 series is the highest arbitrage target! Priority push to Russian-speaking regions.`,
    detailedContentRu: `## Анализ арбитража серии 980

### Последние международные цены
| Модель | Год | Цена(EUR) | Юани(@7.89) | Часы | Локация |
|--------|-----|-----------|-------------|------|--------|
| Jaguar 980 | 2024 | €467,900 | ≈ 3.692 млн | 1,750h | Баден-Вюртемберг |
| Jaguar 980 | 2023 | €359,000 | ≈ 2.832 млн | 1,380h | Манш, FR |
| Jaguar 980 | 2023 | €320,000 | ≈ 2.525 млн | 2,304h | Эр, FR |

### Основной арбитраж
| Модель | Мир | Китай | Спред | Ставка |
|--------|-----|-------|-------|--------|
| CLAAS Jaguar 980(2016) | 2.525M | 1.43M | 1.095M | **76.6%** |

> 🔥 980 — цель №1 по арбитражу! Приоритет: русскоязычные регионы.`,
    actionTips: ["🔥 980(2016) 76.6%价差全系列最高，优先推往俄语区买家", "利用德国€467.9K新机价与国内143万做对比，突出性价比", "监控Agriaffaires 980报价变化，若€320K上调则扩大利润空间"],
    dataSummary: [{ label: "980(2016)国际", value: "€320K(252.5万)" }, { label: "国内售价", value: "143万" }, { label: "价差率", value: "76.6%🔥" }],
  },
  // == 4. 北美 ==
  {
    icon: "🇺🇸", region: "北美", tags: ["TractorHouse", "$285-299K", "价差24.3%", "319条"], date: "2026-06-07",
    text: "北美TractorHouse 319条CLAAS Jaguar在售，970(2017)$285-299K≈193-203万高于国内163万24.3%！逆向出口路径可探索",
    textEn: "NA TractorHouse 319 CLAAS Jaguar listings, 970(2017) $285-299K≈1.93-2.03M, 24.3% above China 1.63M! Reverse export path viable",
    textRu: "СА TractorHouse 319 объявлений CLAAS Jaguar, 970(2017) $285-299K≈1.93-2.03M, на 24.3% выше Китая! Обратный экспорт перспективен",
    detailedContent: `## 北美市场最新报价（TractorHouse/MachineryPete，USD）

> 数据来源：TractorHouse/MachineryPete平台，TractorHouse 319条CLAAS Jaguar在售，24条Jaguar 970。换算汇率 USD→CNY@6.78（中行现汇买入6.7791）。

### 北美970报价一览
| 年份 | 价格(USD) | 换算人民币 | 工时 | 所在地 |
|------|-----------|-----------|------|--------|
| 2022 | $516,161 | ≈ 349.8万元 | 698h | 加拿大安大略 |
| 2021 | $365,000 | ≈ 247.3万元 | 1,967h | 美国密歇根 |
| 2020 | $366,000 | ≈ 248.0万元 | 1,665h | 美国威斯康星 |
| **2017** | **$299,000** | **≈ 202.6万元** | 2,130h | 美国华盛顿 |
| **2017** | **$285,000** | **≈ 193.1万元** | — | 美国明尼苏达 |
| 2016 | $215,000 | ≈ 145.7万元 | 3,110h | 美国明尼苏达 |
| 2015 | $235,000 | ≈ 159.2万元 | 2,908h | 美国明尼苏达 |

### 🔥 北美市场趋势
- **TractorHouse 319条CLAAS Jaguar在售**（含所有型号），价格区间$5,316-$1,480,000
- 970(2017)稳定在$285-299K区间，流动性好
- 970(2016)$215K(145.7万)与国内980(2016)143万接近但工时3,110h较高

### 逆向出口分析
- 国内970(2017)163万 vs 北美$285K(193.1万)-$299K(202.6万)
- 价差30-39.6万(15%-24.3%)
- 需核算跨太平洋海运费率确定实际利润`,
    detailedContentEn: `## NA Market Prices (TractorHouse/MachineryPete, USD)

> Source: TractorHouse/MachineryPete, 319 CLAAS Jaguar listings total, 24 Jaguar 970. Rate USD→CNY@6.78.

### NA 970 Prices
| Year | Price(USD) | RMB | Hours | Location |
|------|-----------|-----|-------|----------|
| 2022 | $516,161 | ≈ 3.498M | 698h | Ontario, CA |
| 2021 | $365,000 | ≈ 2.473M | 1,967h | Michigan, US |
| **2017** | **$299,000** | **≈ 2.026M** | 2,130h | Washington, US |
| **2017** | **$285,000** | **≈ 1.931M** | — | Minnesota, US |

### 🔥 NA Market Trends
- TractorHouse 319 CLAAS Jaguar listings, range $5,316-$1,480,000
- 970(2017) stable at $285-299K, good liquidity
- Reverse export (China→NA): 1.63M vs $285-299K, spread 300-396K(15-24.3%)`,
    detailedContentRu: `## Цены в Северной Америке (TractorHouse/MachineryPete, USD)

> Источник: TractorHouse/MachineryPete, 319 объявлений CLAAS Jaguar. Курс USD→CNY@6.78.

### Цены 970 в США/Канаде
| Год | Цена(USD) | Юани | Часы | Локация |
|-----|-----------|------|------|--------|
| 2022 | $516,161 | ≈ 3.498 млн | 698h | Онтарио, CA |
| **2017** | **$299,000** | **≈ 2.026 млн** | 2,130h | Вашингтон, US |
| **2017** | **$285,000** | **≈ 1.931 млн** | — | Миннесота, US |

### Тренды
- 319 объявлений CLAAS Jaguar на TractorHouse
- 970(2017) стабилен $285-299K
- Обратный экспорт Китай→СА: спред 300-396K(15-24.3%)`,
    actionTips: ["北美970(2017)$285-299K高于国内163万24.3%，可探索逆向出口路径", "TractorHouse 319条在售说明北美市场活跃，考虑涉足北美二手农机供应链", "研究中国→北美物流成本(跨太平洋)，核算实际利润空间"],
    dataSummary: [{ label: "TractorHouse总量", value: "319条CLAAS在售" }, { label: "北美970(2017)", value: "$285-$299K(193-203万)" }, { label: "价差率", value: "15%-24.3%" }],
  },
  // == 5. 套利排行 ==
  {
    icon: "🔥", region: "中国", tags: ["套利排行", "FR450", "5300RC", "980"], date: "2026-06-07",
    text: "FR450(2013)21.5万 vs 俄43.3万(101.4%)最高！5300RC全新95万+53.7%，970(2017)28.3%最稳健三线并进",
    textEn: "FR450(2013) 215K vs RU 433K(101.4%) highest! 5300RC new 950K+53.7%, 970(2017) 28.3% most stable — triple strategy",
    textRu: "FR450(2013) 215K vs РФ 433K(101.4%) макс.! 5300RC новый 950K+53.7%, 970(2017) 28.3% стабильный — тройная стратегия",
    detailedContent: `## 跨境套利机会分析（价差≥25% 优先）

> 价差率 =（国际人民币价 - 国内售价）/ 国内售价 × 100%
> ⚠️ 今日为周日，汇率参照央行中间价 EUR/CNY 7.8919 | USD/CNY 6.8157

### 套利排行（按价差率排序）
| 排名 | 品牌 | 型号 | 年份 | 国际人民币价 | 国内售价 | 价差（万元） | 价差率 | 套利评级 |
|------|------|------|------|--------------|----------|--------------|----------|------------|
| 1 | CLAAS | 5300RC | 2020 | 参考85万元 | 18万元 | 67.0 | 372.2% | ⭐⭐⭐⭐⭐ |
| 2 | New Holland | FR450 | 2013 | 43.3万元(俄市场) | 21.5万元 | 21.8 | **101.4%** | ⭐⭐⭐⭐⭐ |
| 3 | CLAAS | Jaguar 980 | 2016 | 252.5万元(EU€320K) | 143万元 | 109.5 | **76.6%** | ⭐⭐⭐⭐⭐ |
| 4 | CLAAS | 5300RC | 2022 | 146.0万元(EU€185K同级别) | 95万元 | 51.0 | 53.7% | ⭐⭐⭐⭐⭐ |
| 5 | MF | 3404 | 2022 | 142.1万元(EU€180K) | 105万元 | 37.1 | 35.3% | ⭐⭐⭐⭐ |
| 6 | CLAAS | Jaguar 970 | 2017 | 209.2万元(EU€265K) | 163万元 | 46.2 | **28.3%** | ⭐⭐⭐⭐ |
| 7 | CLAAS | Jaguar 970 | 2017 | 202.6万元(US$299K) | 163万元 | 39.6 | 24.3% | ⭐⭐⭐⭐ |
| 8 | CLAAS | Jaguar 850 | 2020 | 146.0万元(EU€185K同系列) | 119万元 | 27.0 | 22.7% | ⭐⭐⭐ |

### 与昨日关键数据对比
| 机型 | 6月6日参考价 | 6月7日最新价 | 变化 | 说明 |
|------|-------------|-------------|------|------|
| 970(2023, DE) | €440,000 | €550,000(新挂牌) | +25.0%↑ | 德国萨安州新天价 |
| EUR/CNY | 7.8074(实时) | 7.8919(央行中间价) | +0.14% | 周末央行中间价微升 |
| 980(2023, FR新增) | — | €359,000 | 新增 | 法国芒什省新挂牌 |
| 970在售数 | 25条(Agriaffaires 970) | 24条 | -1条 | 供给小幅下降 |

### 重点标的说明
1. **CLAAS Jaguar 980 (2016)**：今日重点！价差109.5万(76.6%)，全系列最高套利标的
2. **CLAAS Jaguar 970 (2017)**：英国€265,169→209.2万 vs 国内163万，价差46.2万(28.3%)。最确定的单台套利标的
3. **CLAAS 5300RC (2022全新)**：国内95万全新，国际同级€185K(146万)，价差51万(53.7%)
4. **New Holland FR450 (2013)**：一口价21.5万，俄罗斯市场约43.3万，价差率101.4%！10台库存走量爆款
5. **CLAAS 5300RC (2020)**：仅18万，国际参考85万，价差率372.2%，超高性价比`,
    detailedContentEn: `## Cross-Border Arbitrage Analysis (Spread ≥25% Priority)

> Spread Rate = (Intl RMB Price - China Price) / China Price × 100%
> ⚠️ Sunday — PBOC fix: EUR/CNY 7.8919 | USD/CNY 6.8157

### Arbitrage Ranking (by spread rate)
| # | Brand | Model | Year | Intl Price(RMB) | China Price | Spread | Rate | Rating |
|---|-------|-------|------|-----------------|-------------|--------|------|--------|
| 1 | CLAAS | 5300RC | 2020 | ~850K ref | 180K | 670K | 372.2% | ⭐⭐⭐⭐⭐ |
| 2 | NH | FR450 | 2013 | 433K(RU) | 215K | 218K | 101.4% | ⭐⭐⭐⭐⭐ |
| 3 | CLAAS | 980 | 2016 | 2.525M(EU€320K) | 1.43M | 1.095M | 76.6% | ⭐⭐⭐⭐⭐ |
| 4 | CLAAS | 5300RC | 2022 | 1.46M(EU€185K) | 950K | 510K | 53.7% | ⭐⭐⭐⭐⭐ |
| 5 | MF | 3404 | 2022 | 1.421M(EU€180K) | 1.05M | 371K | 35.3% | ⭐⭐⭐⭐ |
| 6 | CLAAS | 970 | 2017 | 2.092M(EU€265K) | 1.63M | 462K | 28.3% | ⭐⭐⭐⭐ |
| 7 | CLAAS | 970 | 2017 | 2.026M(US$299K) | 1.63M | 396K | 24.3% | ⭐⭐⭐⭐ |

### Key Targets
1. **980(2016)**: 1.095M spread(76.6%) — highest arbitrage margin
2. **970(2017)**: EU 28.3%/NA 24.3% — most certain arbitrage
3. **5300RC(2022 new)**: 950K vs €185K, spread 510K(53.7%)
4. **FR450(2013)**: 215K/unit vs RU 433K, 101.4%! Volume play x10 units`,
    detailedContentRu: `## Анализ арбитража (спред ≥25% приоритет)

> Воскресенье — курс ЦБ: EUR/CNY 7.8919 | USD/CNY 6.8157

### Арбитражный рейтинг
| # | Бренд | Модель | Год | Мир | Китай | Спред | Ставка | Рейтинг |
|---|-------|--------|-----|-----|-------|-------|--------|---------|
| 1 | CLAAS | 5300RC | 2020 | ~850K | 180K | 670K | 372.2% | ⭐⭐⭐⭐⭐ |
| 2 | NH | FR450 | 2013 | 433K(РФ) | 215K | 218K | 101.4% | ⭐⭐⭐⭐⭐ |
| 3 | CLAAS | 980 | 2016 | 2.525M(€320K) | 1.43M | 1.095M | 76.6% | ⭐⭐⭐⭐⭐ |
| 4 | CLAAS | 5300RC | 2022 | 1.46M(€185K) | 950K | 510K | 53.7% | ⭐⭐⭐⭐⭐ |
| 5 | CLAAS | 970 | 2017 | 2.092M(€265K) | 1.63M | 462K | 28.3% | ⭐⭐⭐⭐ |

### Ключевые цели
1. **980(2016)**: 1.095M спред(76.6%) — макс. арбитраж
2. **970(2017)**: ЕС 28.3%/NA 24.3% — самый надёжный
3. **5300RC(2022)**: 950K vs €185K, 53.7%
4. **FR450(2013)**: 215K/шт vs РФ 433K, 101.4%! 10 шт объём`,
    actionTips: ["🔥 980(2016) 76.6%价差优先推俄语区，利用德国€550K天价作营销锚点", "FR450(2013)一口价21.5万/台速推俄罗斯，101.4%走量爆款", "5300RC(2022)全新95万重点推巴西+中东，准备葡语资料", "970(2017)欧洲28.3%/北美24.3%最确定的单台套利标的"],
    dataSummary: [{ label: "TOP1价差率", value: "5300RC 372.2%🔄" }, { label: "TOP2", value: "FR450 101.4%🔥" }, { label: "TOP3", value: "980(2016) 76.6%🔥" }],
  },
  // == 6. 行业动态 ==
  {
    icon: "📋", region: "中国", tags: ["电动化", "十五五", "丘陵山区", "混动收割机"], date: "2026-06-07",
    text: "混动收割机在河南三夏麦收大规模商用，每亩节油5-6元；十五五规划2030年机械化率>80%，丘陵山区机械化政策加码",
    textEn: "Hybrid harvesters deployed at scale in Henan summer harvest, saving ¥5-6/mu fuel; 15th FYP >80% mechanization by 2030, hilly-area policy intensified",
    textRu: "Гибридные комбайны масштабно в Хэнани, экономят 5-6 юаней/му топлива; 15-й план >80% к 2030, политика для холмистых районов",
    detailedContent: `## 行业动态与政策红利（2026年6月7日更新）

### 🔥今日核心情报
1. **混动收割机在河南三夏麦收大规模商用**：每亩节油5-6元，农机电动化进入加速期。虽长期可能改变动力系统格局，但不影响短期柴油农机出口
2. **"十五五"农业农村现代化规划持续推进**：2030年耕种收综合机械化率>80%目标驱动农机需求长期增长
3. **丘陵山区机械化政策加码**：农业农村部+工信部在永康联合召开农机装备补短板推进会，丘陵山区农机具需求将释放
4. **中国农机出海加速**：新疆智能农机博览会(5月底)中亚采购商云集，采棉机等智能农机连续多年出口乌兹别克斯坦

### 对神雕的影响
| 趋势 | 影响 | 应对策略 |
|------|------|---------|
| 混动收割机商用 | 长期可能改变动力系统格局 | 跟踪但短期不影响柴油农机出口 |
| 机械化率>80%目标 | 农机需求长期向上 | 加大出口备货，抢占市场份额 |
| 丘陵山区政策 | 小型农机具需求增加 | 扩展产品线覆盖小型农机 |
| 新疆展中亚采购 | 中亚市场直接获客通道 | 参加下届新疆农机博览会 |

### 🔥 本周新情报补充
- 中国农机出海加速：新疆智能农机博览会中亚采购商云集
- 农机电动化趋势加速：混动收割机在河南三夏麦收大规模商用`,
    detailedContentEn: `## Industry Trends & Policy (Jun 7, 2026 Update)

### 🔥 Core Intel
1. **Hybrid harvesters at scale in Henan**: Save ¥5-6/mu fuel, electrification accelerating
2. **15th Five-Year Plan**: >80% mechanization by 2030 (driving long-term demand)
3. **Hilly-area policy intensified**: MOA + MIIT joint meeting in Yongkang on machinery gaps
4. **China machinery going global**: Xinjiang Expo attracts Central Asian buyers

### Impact on Us
| Trend | Impact | Strategy |
|-------|--------|----------|
| Hybrid harvesters | Long-term powertrain shift | Monitor, diesel export unaffected short-term |
| >80% mechanization | Demand rising long-term | Increase export inventory |
| Hilly-area policy | Small machinery demand up | Expand product line |
| Xinjiang Expo | Central Asia buyer channel | Attend next expo |`,
    detailedContentRu: `## Тренды отрасли и политика (обновление 7 июня 2026)

### 🔥 Ключевая разведка
1. **Гибридные комбайны в Хэнани**: экономят 5-6 юаней/му топлива
2. **15-й пятилетний план**: >80% механизации к 2030
3. **Политика для холмистых районов**: совместное совещание MOA+MIIT
4. **Экспорт Китая растёт**: выставка в Синьцзяне привлекла покупателей из ЦА

### Влияние на нас
| Тренд | Влияние | Стратегия |
|-------|--------|----------|
| Гибриды | Долгосрочные изменения | Мониторинг |
| >80% механизации | Долгосрочный рост | Наращивать экспорт |
| Холмистые районы | Рост спроса на малую технику | Расширить линейку |
| Выставка Синьцзяна | Канал ЦА | Участвовать в следующей |`,
    actionTips: ["十五五80%机械化率目标=农机需求长期向上，加快出口备货", "关注永康丘陵山区机械化推进会后续政策文件，小型农机需求将释放", "混动收割机商用标志农机电动化加速，跟踪动力系统技术趋势但短期不调整策略"],
    dataSummary: [{ label: "机械化率目标", value: ">80%(2030)" }, { label: "混动收割机商用", value: "节油5-6元/亩" }, { label: "政策亮点", value: "丘陵山区加码" }],
  },
  // == 7. 巴西 ==
  {
    icon: "🌾", region: "巴西", tags: ["Q1降13.1%", "进口替代", "5300RC", "NAMPO"], date: "2026-06-07",
    text: "巴西Q1农机销量降13.1%(9,800台)但进口替代加速！大豆种植扩张+粮食产量创10年纪录，5300RC(95万+53.7%)核心受益",
    textEn: "Brazil Q1 machinery sales -13.1%(9,800 units) but import substitution accelerating! Soybean expansion + 10-yr grain record, 5300RC(950K+53.7%) core beneficiary",
    textRu: "Бразилия Q1 продажи -13.1%(9,800 ед.), но импортозамещение ускоряется! Расширение сои + рекорд зерна за 10 лет, 5300RC(950K+53.7%) ключевой бенефициар",
    detailedContent: `## 巴西农机市场情报

### 核心数据
| 指标 | 数据 | 趋势 |
|------|------|------|
| Q1农机销量 | 9,800台（-13.1% YoY） | ⬇️ 销量下滑 |
| 进口设备替代本土 | 逆势加速增长 | ⬆️ 利好进口商 |
| 大豆种植面积 | 继续扩张+3-5% | ⬆️ 长期利好 |
| 粮食产量 | 创10年纪录 | ⬆️ 需求支撑 |

### 市场逻辑
- 国内销量下滑但进口设备正加速替代本土制造
- 海外厂商凭规模效应+定价竞争力抢占份额
- 5300RC(2022全新95万+53.7%价差)是巴西线核心产品
- 巴西参展商在NAMPO南非展获得$339万商业 prospects，积极开拓非洲市场

### 对神雕的影响
| 产品 | 神雕价 | 国际对标价 | 价差率 | 适配场景 |
|------|-------|-----------|--------|---------|
| CLAAS 5300RC(2022全新) | 95万 | €185K≈146万 | 53.7% | 大型饲料基地/畜牧场 |
| CLAAS 5300RC(2020) | 18万 | 参考85万 | 372.2% | 超高性价比 |
| CLAAS Jaguar 970 | 163万 | €265K≈209万 | 28.3% | 大型青储饲料生产 |

### 操作建议
1. 5300RC(95万)是巴西走量核心产品，性价比优势明显
2. 汇率影响微乎其微（5300RC差额大，汇率占比小）
3. 远程视频看车+英语/葡语技术参数准备
4. 提前完成巴西进口审批手续`,
    detailedContentEn: `## Brazil Farm Machinery Intelligence

### Key Data
| Metric | Data | Trend |
|--------|------|-------|
| Q1 machinery sales | 9,800 units (-13.1% YoY) | ⬇️ Decline |
| Import substitution | Accelerating vs domestic | ⬆️ Favorable to importers |
| Soybean area | Expanding +3-5% | ⬆️ Long-term bullish |
| Grain output | 10-year record | ⬆️ Demand support |

### Market Logic
- Domestic sales declining but imports accelerating to replace local manufacturing
- Foreign manufacturers leveraging scale + pricing competitiveness
- 5300RC(2022 new 950K+53.7%) is Brazil core product
- Brazil exhibitors at NAMPO South Africa gained $3.39M business prospects

### Strategy
1. 5300RC(950K) core Brazil volume product
2. FX impact minimal (large spread buffer)
3. Remote video inspection + EN/PT tech specs
4. Pre-clear Brazil import procedures`,
    detailedContentRu: `## Разведка рынка Бразилии

### Ключевые данные
| Показатель | Данные | Тренд |
|------------|--------|-------|
| Q1 продажи | 9,800 ед. (-13.1% г/г) | ⬇️ Спад |
| Импортозамещение | Ускоряется | ⬆️ Благоприятно |
| Соя | Расширение +3-5% | ⬆️ Долгосрочно |
| Урожай зерна | Рекорд за 10 лет | ⬆️ Поддержка спроса |

### Стратегия
1. 5300RC(950K) — основной продукт для Бразилии
2. Влияние валюты минимально
3. Подготовить видеоосмотр + техспеки на EN/PT
4. Пройти процедуры импорта Бразилии заранее`,
    actionTips: ["5300RC(95万+53.7%)巴西线核心产品，抓住进口替代加速窗口", "巴西Q1销量降13.1%但大豆种植扩张+粮食产量10年新高，需求韧性极强", "提前完成巴西进口审批手续(14%关税+审批流程)，备好葡语资料"],
    dataSummary: [{ label: "Q1销量", value: "9,800台(-13.1%)" }, { label: "进口替代", value: "加速中⬆️" }, { label: "TOP推荐", value: "5300RC(53.7%🔥)" }],
  },
  // == 8. 俄罗斯 ==
  {
    icon: "🇷🇺", region: "俄罗斯", tags: ["FR450", "101.4%", "10台爆款", "CTT线上跟进"], date: "2026-06-07",
    text: "FR450(2013)21.5万 vs 俄43.3万(101.4%)！10台库存走量爆款汇率影响最小，CTT展(5月收官)转线上跟进",
    textEn: "FR450(2013) 215K vs RU 433K(101.4%)! 10-unit volume play, minimal FX impact, CTT expo (closed May) following up online",
    textRu: "FR450(2013) 215K vs РФ 433K(101.4%)! 10 единиц объём, мин. влияние валюты, CTT (закрыта) онлайн-продолжение",
    detailedContent: `## 俄罗斯市场分析

### 核心数据
| 指标 | 数据 | 说明 |
|------|------|------|
| CTT展会 | 5月26-29日已收官 | 俄最大工程机械展，转线上跟进 |
| 农机进口 | 俄优先产业第1位 | 5%低关税持续 |
| 收获机械出口增速 | +58.5%(1-4月) | 青储机/收割机需求旺盛 |

### 神雕适配产品 — 三线并进
| 机型 | 神雕价 | 国际对标 | 价差率 | 推荐理由 |
|------|-------|---------|--------|---------|
| New Holland FR450(2013)×10 | 21.5万/台 | 俄市场43.3万 | **101.4%** | ⭐⭐⭐⭐⭐ 走量爆款！汇率影响最小 |
| CLAAS Jaguar 970(2017) | 163万 | €265K≈209万 | **28.3%** | ⭐⭐⭐⭐ 旗舰机型，俄大型农场首选 |
| CLAAS Jaguar 980(2016) | 143万 | €320K≈252.5万 | **76.6%** | ⭐⭐⭐⭐⭐ 全系列最高套利标 |
| CLAAS 5300RC(2022全新) | 95万 | €185K≈146万 | **53.7%** | ⭐⭐⭐⭐⭐ 大方捆需求旺盛 |

### 俄市场需求驱动力
- 俄乌冲突后西方品牌退出，中国农机填补巨大缺口
- 5%低进口关税持续（优先产业第1位）
- 卢布汇率相对稳定，对人民币结算接受度高
- 俄罗斯大型农场对CLAAS系列需求强劲`,
    detailedContentEn: `## Russia Market Analysis

### Key Data
| Metric | Data | Note |
|--------|------|------|
| CTT Expo | May 26-29 closed | Russia's largest machinery expo, online follow-up |
| Machinery import | Russia priority #1 sector | 5% low tariff sustained |
| Harvester export growth | +58.5%(Jan-Apr) | Strong forage/combine demand |

### Recommended Products — Triple Strategy
| Model | Our Price | Intl Benchmark | Spread | Reason |
|-------|----------|---------------|--------|--------|
| NH FR450(2013)×10 | 215K/unit | RU 433K | **101.4%** | Volume play! Minimal FX impact |
| CLAAS Jaguar 970(2017) | 1.63M | €265K≈2.09M | **28.3%** | Flagship, top RU farm choice |
| CLAAS Jaguar 980(2016) | 1.43M | €320K≈2.525M | **76.6%** | Highest margin target |
| CLAAS 5300RC(2022 new) | 950K | €185K≈1.46M | **53.7%** | Strong baler demand |

### Russia Demand Drivers
- Western brand exit post-Ukraine conflict, China machinery filling gap
- 5% low import tariff sustained (priority sector #1)
- Ruble relatively stable, high RMB settlement acceptance`,
    detailedContentRu: `## Анализ рынка России

### Ключевые данные
| Показатель | Данные | Примечание |
|------------|--------|------------|
| CTT выставка | 26-29 мая закрыта | Крупнейшая в РФ, онлайн-продолжение |
| Импорт техники | Приоритет №1 в РФ | 5% низкая пошлина |
| Рост экспорта уборочных | +58.5%(янв-апр) | Высокий спрос |

### Рекомендуемые продукты — тройная стратегия
| Модель | Цена | Бенчмарк | Спред | Причина |
|--------|------|---------|-------|--------|
| NH FR450(2013)×10 | 215K/шт | РФ 433K | **101.4%** | Объём! Мин. FX |
| CLAAS 970(2017) | 1.63M | €265K≈2.09M | **28.3%** | Флагман |
| CLAAS 980(2016) | 1.43M | €320K≈2.525M | **76.6%** | Макс. маржа |
| CLAAS 5300RC(2022) | 950K | €185K≈1.46M | **53.7%** | Спрос на прессы |

### Драйверы спроса РФ
- Уход западных брендов, китайская техника заполняет пробел
- 5% пошлина (приоритет №1)
- Рубль стабилен, высокая приемлемость расчётов в юанях`,
    actionTips: ["FR450(2013)21.5万/台速推俄罗斯市场，101.4%价差走量爆款！@10台库存", "CTT展会线上跟进，联系展会期间建立的联系人推970/980/FR450", "980(2016)76.6%价差全系列最高，优先俄罗斯大型农场客户"],
    dataSummary: [{ label: "FR450价差率", value: "101.4%🔥" }, { label: "库存", value: "10台走量爆款" }, { label: "其他推荐", value: "970(28.3%)/980(76.6%)" }],
  },
  // == 9. 全球市场动态 ==
  {
    icon: "🌍", region: "全球", tags: ["NAMPO南非展", "乌兹别克+256.77%", "乌克兰粮食增产", "东南亚"], date: "2026-06-07",
    text: "NAMPO南非展巴西获$339万商机；乌兹别克+256.77%全球最快；乌克兰粮食增产+东南亚+121.07%中泰协议推进",
    textEn: "NAMPO SA: Brazil exhibitors gained $3.39M prospects; Uzbekistan +256.77% fastest globally; Ukraine grain increase+SE Asia +121.07%+China-Thailand deal",
    textRu: "NAMPO SA: Бразилия получила $3.39M проспектов; Узбекистан +256.77% №1; Украина рост зерна+ЮВА +121.07%+сделка КНР-Таиланд",
    detailedContent: `## 全球目标市场动态全景

### 各市场动态一览
| 市场 | 核心动态 | 对神雕影响 | 优先级 |
|------|---------|-----------|--------|
| 🇷🇺 俄罗斯 | CTT展(5.26-29)已收官转线上跟进，农机进口为优先产业第1位，5%低关税持续 | 🔴 P0—970/980/FR450速推 |
| 🇧🇷 巴西 | Q1销量降13.1%但进口替代加速，大豆种植扩张+粮食产量创10年纪录 | 🟡 P1—5300RC重点，提前完成审批手续 |
| 🇺🇿 乌兹别克 | **+256.77%进口增速全球最快！** 新疆农机博览会确认中亚采购商需求旺盛 | 🆕 P1—中亚重点开拓，970/5300RC/拖拉机 |
| 🇺🇦 乌克兰 | USDA确认2026/27粮食增产，青储机需求旺盛 | 🟢 追踪中 |
| 🌍 非洲 | NAMPO展(5月底)后南非农机需求增长，巴西参展商获$339万商业prospects；肯尼亚农机进口增速46.6% | 🟢 P2—长期跟进，南非/肯尼亚优先 |
| 🌏 东南亚 | 中泰农机进出口协议推进中，印尼+121.07%爆发式增长 | 🟢 P2—新机会，收获机+拖拉机 |
| 🇰🇪 肯尼亚 | 农机进口增速46.6% | 🟢 P2—非洲增长最快的市场之一 |

### 核心策略
- **P0**：俄罗斯（970/980/FR450）+ 汇率对冲
- **P1**：巴西（5300RC）+ 中亚（乌兹别克为中心）
- **P2**：乌克兰、非洲（南非/肯尼亚）、东南亚（泰国/印尼）
- **⏳ 长期**：新机电动化趋势跟踪`,
    detailedContentEn: `## Global Target Market Dynamics

### Market Overview
| Market | Core Dynamic | Priority |
|--------|------------|----------|
| 🇷🇺 Russia | CTT expo closed, online follow-up, priority #1 sector, 5% tariff | 🔴 P0—970/980/FR450 push |
| 🇧🇷 Brazil | Q1 -13.1% sales but import substitution accelerating, soybean expansion | 🟡 P1—5300RC focus |
| 🇺🇿 Uzbekistan | **+256.77% import growth fastest globally!** | 🆕 P1—Central Asia |
| 🇺🇦 Ukraine | USDA confirms 2026/27 grain increase | 🟢 Tracking |
| 🌍 Africa | NAMPO expo, Brazil exhibitors $3.39M prospects; Kenya +46.6% | 🟢 P2—Long-term |
| 🌏 SE Asia | China-Thailand machinery deal, Indonesia +121.07% | 🟢 P2—New opportunity |

### Core Strategy
- **P0**: Russia (970/980/FR450) + FX hedging
- **P1**: Brazil (5300RC) + Central Asia (Uzbekistan)
- **P2**: Ukraine, Africa, SE Asia`,
    detailedContentRu: `## Динамика глобальных целевых рынков

### Обзор рынков
| Рынок | Динамика | Приоритет |
|-------|----------|----------|
| 🇷🇺 Россия | CTT закрыта, приоритет №1, 5% пошлина | 🔴 P0—970/980/FR450 |
| 🇧🇷 Бразилия | Q1 -13.1%, но импортозамещение ускоряется | 🟡 P1—5300RC |
| 🇺🇿 Узбекистан | **+256.77% рост импорта №1 в мире!** | 🆕 P1—ЦА |
| 🇺🇦 Украина | USDA: рост зерна 2026/27 | 🟢 Отслеживание |
| 🌍 Африка | NAMPO, $3.39M проспектов; Кения +46.6% | 🟢 P2 |
| 🌏 ЮВА | Сделка КНР-Таиланд, Индонезия +121.07% | 🟢 P2 |

### Стратегия
- **P0**: Россия + хедж валюты
- **P1**: Бразилия + ЦА
- **P2**: Украина, Африка, ЮВА`,
    actionTips: ["乌兹别克+256.77%全球最快增速，配置俄语销售资源覆盖中亚市场", "NAMPO南非展巴西获$339万商机说明南美-非洲农机贸易通道活跃", "乌克兰粮食增产+东南亚爆发式增长(+121.07%)，保持对这两个市场的动态追踪", "参加明年新疆农机博览会获客中亚买家"],
    dataSummary: [{ label: "乌兹别克增速", value: "+256.77%🔥" }, { label: "印尼增速", value: "+121.07%" }, { label: "肯尼亚增速", value: "+46.6%" }],
  },
  // == 10. 风险提示 ==
  {
    icon: "⚠️", region: "全球", tags: ["周末汇率风险", "德国天价泡沫", "巴西关税", "物流绕行"], date: "2026-06-07",
    text: "五大风险：周末汇率不确定性(周五EUR-0.76%)、德国€550K泡沫风险、巴西14%关税+审批、物流绕行±20%",
    textEn: "5 risks: Weekend FX uncertainty (EUR -0.76% Friday), German €550K bubble risk, Brazil 14% tariff+approval, logistics detour ±20%",
    textRu: "5 рисков: Неопределённость выходных (EUR -0.76%), пузырь €550K в Германии, пошлина Бразилии 14%, логистика ±20%",
    detailedContent: `## 风险提示（2026-06-07更新）

### 五大核心风险
| # | 风险类型 | 当前状态 | 影响程度 |
|---|---------|---------|---------|
| 1 | ⚠️ **周末汇率不确定性** | 今日为周日，央行中间价仅反映估值，实际汇率需待周一开盘确认。周五EUR/CNY大跌0.76%后可能存在技术性反弹 | 🔴 高风险—周一重点关注 |
| 2 | ⚠️ **德国€550K天价泡沫风险** | 德国萨安州970(2023)€550K可能是孤例挂牌价而非市场价，需警惕过度解读 | 🟡 中等—需观察后续挂牌 |
| 3 | ⚠️ **巴西进口关税风险** | 巴西进口农机14%关税+审批流程，5300RC出口巴西需提前完成审批手续 | 🟡 中等—提前准备即可 |
| 4 | ⚠️ **国际物流成本波动** | 苏伊士运河绕行→好望角增加7-10天航程，海运价格波动±20% | 🟡 中等—需预留物流弹性 |
| 5 | ⚠️ **汇率对冲建议** | 对于欧元计价的大额出口合同（如970/980系列），建议通过远期锁定或CIPS人民币结算降低汇率敞口 | 🟡 建议执行 |

### 操作注意事项
- 周末不进行大额签约/付款，待周一开盘确认汇率后再操作
- 德国€550K天价建议仅作营销锚点而非定价基准
- 5300RC巴西线提前完成审批手续，避免客户等审批流失
- 大额订单建议采用CIPS人民币结算规避汇率敞口`,
    detailedContentEn: `## Risk Alert (Updated 2026-06-07)

### Five Core Risks
| # | Risk Type | Status | Severity |
|---|----------|--------|----------|
| 1 | ⚠️ **Weekend FX uncertainty** | Sunday, PBOC fix vs real rate Mon. EUR -0.76% Friday, possible technical rebound | 🔴 High |
| 2 | ⚠️ **German €550K bubble risk** | Could be one-off listing price, avoid over-interpretation | 🟡 Medium |
| 3 | ⚠️ **Brazil import tariff** | 14% tariff + approval process, 5300RC needs pre-clearance | 🟡 Medium |
| 4 | ⚠️ **Logistics cost volatility** | Suez detour +7-10 days, shipping ±20% | 🟡 Medium |
| 5 | ⚠️ **FX hedging needed** | For large EUR contracts, use forward lock or CIPS RMB settlement | 🟡 Recommended |

### Precautions
- No large signing/payment over weekend, wait for Monday opening
- German €550K as marketing anchor only, not pricing benchmark
- 5300RC Brazil: pre-clear approval process to avoid losing clients`,
    detailedContentRu: `## Предупреждение о рисках (обновлено 7 июня 2026)

### Пять ключевых рисков
| # | Тип риска | Статус | Серьёзность |
|---|----------|--------|------------|
| 1 | ⚠️ **Неопределённость курса** | Воскресенье, курс ЦБ vs реальный в понедельник | 🔴 Высокий |
| 2 | ⚠️ **Пузырь €550K Германия** | Возможно единичное объявление | 🟡 Средний |
| 3 | ⚠️ **Пошлина Бразилии** | 14% + одобрение | 🟡 Средний |
| 4 | ⚠️ **Логистика** | Суэц +7-10 дней, ±20% | 🟡 Средний |
| 5 | ⚠️ **Хеджирование** | Для EUR-контрактов: форвард или CIPS | 🟡 Рекомендуется |

### Меры
- Нет крупных сделок в выходные, ждать понедельника
- €550K только как маркетинговый якорь
- Бразилия: пройти одобрение заранее`,
    actionTips: ["⚠️ 周一开盘重点关注EUR/CNY实时汇率，确认趋势后再操作", "德国€550K天价仅作营销锚点而非定价基准，警惕孤例挂牌价", "5300RC巴西线提前完成审批(14%关税)，避免客户等待流失", "大额欧元订单使用CIPS人民币结算或远期锁汇"],
    dataSummary: [{ label: "风险#1", value: "周末汇率不确定性" }, { label: "风险#2", value: "德国€550K泡沫" }, { label: "风险#5", value: "CIPS锁汇建议" }],
  },
  // == 11. 操作建议 ==
  {
    icon: "🎯", region: "中国", tags: ["周末观望", "980推俄", "FR450速推", "5300RC巴西"], date: "2026-06-07",
    text: "周末观望为主+7大优先：980推俄语区(76.6%)、FR450爆款速推(101.4%)、5300RC巴西线、德国天价营销",
    textEn: "Weekend stand-by +7 priorities: 980 to RU(76.6%), FR450 volume play(101.4%), 5300RC Brazil, German record as marketing",
    textRu: "Выходные +7 приоритетов: 980 в РФ(76.6%), FR450 объём(101.4%), 5300RC Бразилия, рекорд Германии в маркетинге",
    detailedContent: `## 今日操作建议（2026-06-07）

### ⏸️ 周末核心策略
> 今日为周日，汇率数据仅央行中间价参考，实际操作建议周一开盘后确认

### 七大优先行动
| 优先级 | 行动项 | 执行细节 | 预期成果 |
|--------|--------|---------|---------|
| ⏸️ **P0** | **周末观望为主** | 周日不进行大额签约/付款，周一开盘确认汇率后再操作 | 规避周末汇率风险 |
| 🔥 **P0** | **980加速推俄语区** | 76.6%价差率为全系列最高，利用CTT展会后续线上热度加速成交 | 最大化单台套利利润 |
| 🔴 **P0** | **FR450一口价爆款速推** | 21.5万/台+101.4%价差率，汇率影响最小，速推俄罗斯买家 | 批量走量+现金流 |
| 🔴 **P0** | **970持续推多市场** | 欧洲28.3%/北美24.3%最确定的单台套利标的，多市场覆盖 | 确定性收入 |
| 🟡 **P1** | **5300RC巴西线准备就绪** | 全新95万+53.7%价差，提前完成巴西进口审批，备好葡语资料 | 新市场突破 |
| 🟢 **P2** | **德国€550K天价作营销素材** | 用国际最高报价对比国内价格，强化神雕价格优势叙事 | 提升品牌形象 |
| 🟢 **P2** | **关注周一汇率开盘** | 若EUR/CNY回升至7.85以上，周五低价购入欧元策略验证成功 | 汇率套利 |

### 本周核心策略
**980推俄+FR450走量+5300RC巴西+德国天价营销** — 四线并进`,
    detailedContentEn: `## Today's Action Plan (2026-06-07)

### ⏸️ Weekend Core Strategy
> Sunday — PBOC fix only, actual operations after Monday opening

### Seven Priority Actions
| Priority | Action | Detail | Expected Result |
|----------|--------|--------|-----------------|
| ⏸️ **P0** | **Weekend stand-by** | No large signing/payment, wait for Mon FX | Avoid weekend risk |
| 🔥 **P0** | **980 push to RU regions** | 76.6% highest margin, leverage CTT expo momentum | Max per-unit profit |
| 🔴 **P0** | **FR450 volume play** | 215K/unit+101.4%, minimal FX impact | Volume + cash flow |
| 🔴 **P0** | **970 multi-market** | EU 28.3%/NA 24.3% most certain arbitrage | Steady revenue |
| 🟡 **P1** | **5300RC Brazil** | New 950K+53.7%, pre-clear import | New market |
| 🟢 **P2** | **German €550K as marketing** | Compare peak int'l vs China price | Brand narrative |
| 🟢 **P2** | **Monitor Monday FX open** | If EUR/CNY >7.85, Friday EUR buy strategy validated | FX arbitrage |

### Week Core Strategy
**980→RU + FR450 volume + 5300RC Brazil + German record marketing**`,
    detailedContentRu: `## План действий (2026-06-07)

### ⏸️ Стратегия выходных
> Воскресенье — только курс ЦБ, действия после открытия в понедельник

### Семь приоритетных действий
| Приоритет | Действие | Детали | Результат |
|-----------|----------|--------|----------|
| ⏸️ **P0** | **Ждать понедельника** | Нет крупных сделок в выходные | Избежать риска |
| 🔥 **P0** | **980 в РФ** | 76.6% макс. маржа | Макс. прибыль |
| 🔴 **P0** | **FR450 объём** | 215K/шт+101.4% | Объём+поток |
| 🔴 **P0** | **970 мульти-рынок** | ЕС 28.3%/NA 24.3% | Стабильный доход |
| 🟡 **P1** | **5300RC Бразилия** | 950K+53.7%, одобрение заранее | Новый рынок |
| 🟢 **P2** | **€550K в маркетинге** | Сравнить пик vs цена Китая | Имидж бренда |
| 🟢 **P2** | **Мониторинг понедельника** | EUR/CNY >7.85 | Валютный арбитраж |

### Стратегия недели
**980→РФ + FR450 объём + 5300RC Бразилия + €550K маркетинг**`,
    actionTips: ["⚠️ P0—周末观望为主，周一开盘确认汇率后再操作", "🔥 P0—980(76.6%)推俄语区优先，FR450一口价速推(101.4%)", "🟡 P1—5300RC巴西线加速，准备葡语资料+审批手续", "🟢 P2—德国€550K作营销素材强化价格优势叙事"],
    dataSummary: [{ label: "核心策略", value: "980推俄+FR450+5300RC巴西" }, { label: "P0优先级", value: "周末观望/980/FR450/970" }, { label: "P1/P2", value: "5300RC巴西/德国营销/周一汇率" }],
  },
];

// ========= 多语言翻译映射 =========
const regionMap = {
  "汇率": { en: "Exchange Rate", ru: "Курс валют" },
  "欧洲": { en: "Europe", ru: "Европа" },
  "北美": { en: "North America", ru: "Северная Америка" },
  "中国": { en: "China", ru: "Китай" },
  "全球": { en: "Global", ru: "Глобальный" },
  "巴西": { en: "Brazil", ru: "Бразилия" },
  "俄罗斯": { en: "Russia", ru: "Россия" },
};

const tagMap = {
  "EUR/CNY": { en: "EUR/CNY", ru: "EUR/CNY" },
  "7.8919": { en: "7.8919", ru: "7.8919" },
  "周末央行中间价": { en: "Weekend PBOC Fix", ru: "Фикс ЦБ выходных" },
  "€550K天价": { en: "€550K Record High", ru: "€550K рекорд" },
  "德国萨安州": { en: "Saxony-Anhalt, DE", ru: "Саксония-Анхальт, DE" },
  "970供给紧缺": { en: "970 Supply Tight", ru: "970 дефицит" },
  "980": { en: "980", ru: "980" },
  "€320K": { en: "€320K", ru: "€320K" },
  "价差109.5万": { en: "Spread 1.095M", ru: "Спред 1.095M" },
  "76.6%": { en: "76.6%", ru: "76.6%" },
  "TractorHouse": { en: "TractorHouse", ru: "TractorHouse" },
  "$285-299K": { en: "$285-299K", ru: "$285-299K" },
  "价差24.3%": { en: "Spread 24.3%", ru: "Спред 24.3%" },
  "319条": { en: "319 Listings", ru: "319 объявлений" },
  "套利排行": { en: "Arbitrage Ranking", ru: "Арбитражный рейтинг" },
  "FR450": { en: "FR450", ru: "FR450" },
  "5300RC": { en: "5300RC", ru: "5300RC" },
  "电动化": { en: "Electrification", ru: "Электрификация" },
  "十五五": { en: "15th Five-Year Plan", ru: "15-й план" },
  "丘陵山区": { en: "Hilly Areas", ru: "Холмистые районы" },
  "混动收割机": { en: "Hybrid Harvester", ru: "Гибридный комбайн" },
  "Q1降13.1%": { en: "Q1 -13.1%", ru: "Q1 -13.1%" },
  "进口替代": { en: "Import Substitution", ru: "Импортозамещение" },
  "NAMPO": { en: "NAMPO", ru: "NAMPO" },
  "101.4%": { en: "101.4%", ru: "101.4%" },
  "10台爆款": { en: "10-Unit Bestseller", ru: "10 единиц бестселлер" },
  "CTT线上跟进": { en: "CTT Online Follow-up", ru: "CTT онлайн-продолжение" },
  "NAMPO南非展": { en: "NAMPO South Africa", ru: "NAMPO ЮАР" },
  "乌兹别克+256.77%": { en: "Uzbekistan +256.77%", ru: "Узбекистан +256.77%" },
  "乌克兰粮食增产": { en: "Ukraine Grain Increase", ru: "Рост зерна Украина" },
  "东南亚": { en: "SE Asia", ru: "ЮВА" },
  "周末汇率风险": { en: "Weekend FX Risk", ru: "Риск валюты выходных" },
  "德国天价泡沫": { en: "German Bubble Risk", ru: "Риск пузыря Германии" },
  "巴西关税": { en: "Brazil Tariff", ru: "Пошлина Бразилии" },
  "物流绕行": { en: "Logistics Detour", ru: "Обход логистики" },
  "周末观望": { en: "Weekend Hold", ru: "Ожидание выходных" },
  "980推俄": { en: "980 Russia Push", ru: "980 в РФ" },
  "FR450速推": { en: "FR450 Fast Track", ru: "FR450 быстро" },
  "5300RC巴西": { en: "5300RC Brazil", ru: "5300RC Бразилия" },
};

function translateRegion(zh) { return regionMap[zh] || { en: zh, ru: zh }; }
function translateTags(zhTags) {
  return zhTags.map(t => (tagMap[t] || { en: t, ru: t }));
}

// ========= 主流程 =========
async function main() {
  await prisma.marketIntel.deleteMany();
  console.log("已清空旧数据");

  const date = new Date("2026-06-07");
  for (let i = 0; i < ALL_MARKET_INTEL.length; i++) {
    const item = ALL_MARKET_INTEL[i];
    const r = translateRegion(item.region);
    const tEn = translateTags(item.tags);
    await prisma.marketIntel.create({
      data: {
        date,
        icon: item.icon,
        region: item.region, regionEn: r.en, regionRu: r.ru,
        tags: JSON.stringify(item.tags),
        tagsEn: JSON.stringify(tEn.map(x => x.en)),
        tagsRu: JSON.stringify(tEn.map(x => x.ru)),
        text: item.text, textEn: item.textEn || null, textRu: item.textRu || null,
        detailedContent: item.detailedContent,
        detailedContentEn: item.detailedContentEn || null,
        detailedContentRu: item.detailedContentRu || null,
        dataSummary: item.dataSummary ? JSON.stringify(item.dataSummary) : null,
        actionTips: item.actionTips ? JSON.stringify(item.actionTips) : null,
        sortOrder: i,
      },
    });
  }
  console.log(`已导入 ${ALL_MARKET_INTEL.length} 条情报数据`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
