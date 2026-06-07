/**
 * 导入市场情报数据到数据库（多语言版）
 * 从 2026-06-06 跨境套利日报 提取生成
 * 自动化任务 — 2026-06-07 07:00
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const ALL_MARKET_INTEL = [
  // == 1. 汇率 ==
  {
    icon: "💰", region: "汇率", tags: ["EUR/CNY", "7.8074", "跌破7.85"], date: "2026-06-07",
    text: "EUR/CNY 7.8074跌破7.85关口(-0.76%)，欧元明显回调；USD/CNY 6.7764基本持平，人民币走强趋势明显",
    textEn: "EUR/CNY 7.8074 below 7.85 (-0.76%), euro declining; USD/CNY 6.7764 stable, RMB strengthening",
    textRu: "EUR/CNY 7.8074 ниже 7.85 (-0.76%), евро падает; USD/CNY 6.7764 стабилен, юань укрепляется",
    detailedContent: `## 当日核心汇率（2026-06-06 市场实时汇率）

| 货币对 | 汇率 | 日环比变化 | 备注 |
|--------|------|------------|------|
| EUR/CNY | 7.8074 | -0.0596 (vs 6月5日 7.8670) | 欧元明显回调，跌破7.85关口，人民币走强 |
| USD/CNY | 6.7764 | +0.0022 (vs 6月5日 6.7742) | 美元企稳微升，变动不大 |

> 数据来源：X-Rates实时汇率，2026-06-06 00:49 UTC。央行中间价通常在9:15左右公布，届时可能微调。

### 汇率对套利利润的影响
- EBU/CNY从7.8670降至7.8074（-0.76%），对欧元计价套利标的产生短期小幅压缩
- 以970(2017)为例：€264,862→从208.4万降至206.8万，利润压缩约1.6万元
- USD/CNY基本持平，美元结算利润不受影响

### 人民币走强趋势需要关注
若持续跌破7.80，需适当调整欧元计价出口报价。大额订单建议采用CIPS人民币结算规避汇率敞口。`,
    detailedContentEn: `## Core Exchange Rates (2026-06-06 Market Data)

| Currency | Rate | Daily Change | Notes |
|----------|------|-------------|-------|
| EUR/CNY | 7.8074 | -0.0596 (vs Jun 5: 7.8670) | Euro weakening, broke 7.85 level |
| USD/CNY | 6.7764 | +0.0022 (vs Jun 5: 6.7742) | USD stable, minimal change |

> Source: X-Rates real-time, 2026-06-06 00:49 UTC. PBOC fix typically at 9:15 AM.

### Impact on Arbitrage Profit
- EUR/CNY from 7.8670→7.8074 (-0.76%), slight compression on EUR-denominated arbitrage
- Example 970(2017): €264,862→from 2.084M to 2.068M RMB, ~16K RMB profit compression
- USD/CNY flat, USD-settled profits unaffected

### Watch the RMB Trend
If EUR/CNY continues below 7.80, adjust EUR export pricing. Large orders: use CIPS RMB settlement.`,
    detailedContentRu: `## Ключевые курсы валют (рынок 2026-06-06)

| Валюта | Курс | Изменение | Примечание |
|--------|------|----------|------------|
| EUR/CNY | 7.8074 | -0.0596 (vs 5 июня: 7.8670) | Евро падает, пробил 7.85 |
| USD/CNY | 6.7764 | +0.0022 (vs 5 июня: 6.7742) | Доллар стабилен |

> Источник: X-Rates, 2026-06-06 00:49 UTC.

### Влияние на арбитраж
- EUR/CNY 7.8670→7.8074 (-0.76%), небольшое сжатие арбитража в евро
- Пример 970(2017): €264,862→с 2.084 млн до 2.068 млн юаней
- USD/CNY стабилен, прибыль в долларах не затрагивается`,
    actionTips: ["欧元跌0.76%，今日与买家沟通时采用CIPS人民币结算规避汇率敞口", "趁欧元低位从欧洲采购，每€100万节省约6万元人民币", "关注6月9日中国5月CPI/PPI公布，可能影响人民币走势"],
    dataSummary: [{ label: "EUR/CNY", value: "7.8074(-0.76%)" }, { label: "USD/CNY", value: "6.7764(+0.03%)" }, { label: "欧元跌破", value: "7.85关口" }],
  },
  // == 2. 欧洲1 ==
  {
    icon: "🇪🇺", region: "欧洲", tags: ["Agriaffaires", "970", "套利26.9%"], date: "2026-06-07",
    text: "CLAAS Jaguar 970(2019) €264,862≈206.8万 vs 国内163万！价差43.8万(26.9%)，欧元回调压缩约1万利润仍超25%安全线",
    textEn: "CLAAS Jaguar 970(2019) €264,862≈2.068M vs China 1.63M! Spread 438K (26.9%), euro dip compressed ~10K but still above 25% safety",
    textRu: "CLAAS Jaguar 970(2019) €264,862≈2.068 млн vs Китай 1.63 млн! Спред 438K (26.9%), спред всё ещё выше 25%",
    detailedContent: `## 欧洲市场最新报价（Agriaffaires，EUR）

> 数据来源：Agriaffaires欧洲平台，251条CLAAS Jaguar在售，2026-06-06采集。换算汇率 EUR→CNY@7.81。

### 关键型号报价

| 品牌 | 型号 | 年份 | 价格(EUR) | 换算人民币 | 工时 | 所在地 |
|------|------|------|-----------|-----------|------|--------|
| CLAAS | Jaguar 970 | 2024 | €475,000 | ≈ 370.9万元 | 1,100h | 法国马恩省 |
| CLAAS | Jaguar 970 | 2023 | €440,000 | ≈ 343.5万元 | 1,377h | 法国上索恩省 |
| CLAAS | Jaguar 970 | 2022 | €389,000 | ≈ 303.7万元 | 939h | 法国上马恩省 |
| CLAAS | Jaguar 970 | 2024 | €329,000 | ≈ 256.9万元 | 870h | 德国巴符州 |
| CLAAS | Jaguar 970 | **2019** | **€264,862** | **≈ 206.8万元** | 2,000h | 英国坎布里亚郡 |
| CLAAS | Jaguar 970 | 2017 | — | — | — | **国内163万在售** |

### 重点套利分析：CLAAS Jaguar 970(2017)
- 欧洲参考：2019款€264,862≈206.8万，国内2017款仅163万
- 价差：43.8万元，价差率26.9%
- 欧元回调压缩了约1万利润（以7.87计算为208.4万→以7.81计算为206.8万）
- 但价差率仍超25%安全线，是当前最确定的套利标的`,
    detailedContentEn: `## Europe Latest Prices (Agriaffaires, EUR)

> Source: Agriaffaires, 251 CLAAS Jaguar listings, collected 2026-06-06. Rate: EUR→CNY@7.81.

### Key Model Prices

| Brand | Model | Year | Price(EUR) | RMB Equivalent | Hours | Location |
|-------|-------|------|-----------|----------------|-------|----------|
| CLAAS | Jaguar 970 | 2024 | €475,000 | ≈ 3.709M | 1,100h | Marne, France |
| CLAAS | Jaguar 970 | 2023 | €440,000 | ≈ 3.435M | 1,377h | Haute-Saône, France |
| CLAAS | Jaguar 970 | 2022 | €389,000 | ≈ 3.037M | 939h | Haute-Marne, France |
| CLAAS | Jaguar 970 | 2024 | €329,000 | ≈ 2.569M | 870h | Baden-Württemberg, Germany |
| CLAAS | Jaguar 970 | **2019** | **€264,862** | **≈ 2.068M** | 2,000h | Cumbria, UK |
| CLAAS | Jaguar 970 | 2017 | — | — | — | **China 1.63M listed** |

### Key Arbitrage: CLAAS Jaguar 970(2017)
- Europe ref: 2019 €264,862≈2.068M, China 2017 only 1.63M
- Spread: 438K RMB, 26.9% spread rate
- Euro dip compressed ~10K profit, but still above 25% safety line`,
    detailedContentRu: `## Последние цены в Европе (Agriaffaires, EUR)

> Источник: Agriaffaires, 251 объявление CLAAS Jaguar, 2026-06-06. Курс EUR→CNY@7.81.

### Ключевые модели

| Бренд | Модель | Год | Цена(EUR) | В юанях | Часы | Локация |
|-------|--------|-----|-----------|---------|------|--------|
| CLAAS | Jaguar 970 | 2024 | €475,000 | ≈ 3.709 млн | 1,100h | Марна, Франция |
| CLAAS | Jaguar 970 | 2023 | €440,000 | ≈ 3.435 млн | 1,377h | Верхняя Сона |
| CLAAS | Jaguar 970 | 2022 | €389,000 | ≈ 3.037 млн | 939h | Верхняя Марна |
| CLAAS | Jaguar 970 | 2024 | €329,000 | ≈ 2.569 млн | 870h | Баден-Вюртемберг |
| CLAAS | Jaguar 970 | **2019** | **€264,862** | **≈ 2.068 млн** | 2,000h | Камбрия, UK |
| CLAAS | Jaguar 970 | 2017 | — | — | — | **Китай 1.63 млн** |

### Ключевой арбитраж: CLAAS Jaguar 970(2017)
- Европа: 2019 €264,862≈2.068 млн, Китай 2017 всего 1.63 млн
- Спред: 438K юаней, 26.9%
- Падение евро сжало ~10K прибыли, но спред всё ещё >25%`,
    actionTips: ["以欧洲高端€475K为锚点向俄罗斯买家报价，突出价差优势", "欧元回调正好优化采购端成本，从欧洲买机更划算", "优先锁定国内970库存，避免错失套利窗口期"],
    dataSummary: [{ label: "2019国际价", value: "€264,862(206.8万)" }, { label: "神雕价(2017)", value: "163万" }, { label: "价差率", value: "26.9%" }],
  },
  // == 3. 欧洲2 ==
  {
    icon: "🇪🇺", region: "欧洲", tags: ["980", "€467.9K", "供给偏紧"], date: "2026-06-07",
    text: "Jaguar 980(2024)维持€467,900高位不变，供给端依然偏紧；新机交付12-18个月，二手溢价持续",
    textEn: "Jaguar 980(2024) holds at €467,900 high, supply still tight; new machine delivery 12-18 months, used premium sustained",
    textRu: "Jaguar 980(2024) держится на €467,900, дефицит; новые поставки 12-18 мес., б/у премия сохраняется",
    detailedContent: `## 980市场趋势与套利机会

### 最新报价
| 型号 | 年份 | 价格(EUR) | 换算人民币(@7.81) | 工时 | 所在地 |
|------|------|-----------|-----------------|------|--------|
| 980 | 2024 | €467,900 | ≈ 365.3万元 | 1,750h | 德国巴符州 |
| 980 | 2023 | €320,000 | ≈ 249.8万元 | 2,304h | 法国厄尔省 |

### Agriaffaires平台升级
- 在售列表增至251条（较上月+18%），供给边际改善但高价未松动
- 新机交付周期持续12-18个月，二手市场溢价维持
- 970(2024)稳定在€475,000，价格坚挺未受汇率影响

### 国内库存对标
| 型号 | 年份 | 国内售价 | 策略 |
|------|------|---------|------|
| 980 | 2016 | 143万 | 借全球暴涨趋势去化 |
| 980 | 2015 | 130万(抵押) | 性价比出口 |

国际买家可能因新机太贵转而寻找二手980，国内2016/2015款是价格洼地。`,
    detailedContentEn: `## 980 Market Trends & Arbitrage

### Latest Prices
| Model | Year | Price(EUR) | RMB(@7.81) | Hours | Location |
|-------|------|-----------|------------|-------|----------|
| 980 | 2024 | €467,900 | ≈ 3.653M | 1,750h | Baden-Württemberg, DE |
| 980 | 2023 | €320,000 | ≈ 2.498M | 2,304h | Eure, France |

### Platform Update
- Listings up to 251 (+18% MoM), marginal supply improvement but prices hold
- New machine delivery 12-18 months, used premium sustained
- 970(2024) stable at €475,000, unaffected by FX

### China Inventory Benchmark
| Model | Year | China Price | Strategy |
|-------|------|------------|----------|
| 980 | 2016 | 1.43M | Ride global price surge |
| 980 | 2015 | 1.30M (pledge) | Value export |

International buyers may seek used 980 as new is too expensive. China 2016/2015 models are price valleys.`,
    detailedContentRu: `## Тренды 980 и арбитраж

### Последние цены
| Модель | Год | Цена(EUR) | Юани(@7.81) | Часы | Локация |
|--------|-----|-----------|-------------|------|--------|
| 980 | 2024 | €467,900 | ≈ 3.653 млн | 1,750h | Баден-Вюртемберг |
| 980 | 2023 | €320,000 | ≈ 2.498 млн | 2,304h | Эр, Франция |

### Обновление платформы
- Объявлений 251 (+18% за месяц), небольшое улучшение, но цены держатся
- Новые поставки 12-18 мес., б/у премия сохраняется
- 970(2024) стабилен на €475,000

### Инвентарь Китая
| Модель | Год | Цена | Стратегия |
|--------|-----|------|----------|
| 980 | 2016 | 1.43 млн | Использовать мировой рост цен |
| 980 | 2015 | 1.30 млн | Ценовой экспорт |`,
    actionTips: ["利用980供给偏紧+新机交付12-18个月，向买家推荐国内980(143万)", "重点推荐给俄罗斯买家，强调中国货源的价格优势", "监控Agriaffaires价格，构建动态价格预警系统"],
    dataSummary: [{ label: "980(2024)", value: "€467,900" }, { label: "国内980(2016)", value: "143万" }, { label: "供给趋势", value: "251条(+18%)" }],
  },
  // == 4. 北美 ==
  {
    icon: "🇺🇸", region: "北美", tags: ["TractorHouse", "$285-299K", "逆向出口"], date: "2026-06-07",
    text: "北美970(2017)$285-299K≈193.1-202.6万，高于国内163万24.3%！北美逆向出口路径值得探索",
    textEn: "NA 970(2017) $285-299K≈1.931-2.026M, 24.3% above China 1.63M! Reverse export path worth exploring",
    textRu: "Сев. Америка 970(2017) $285-299K≈1.931-2.026 млн, на 24.3% выше Китая! Обратный экспорт перспективен",
    detailedContent: `## 北美市场最新报价（TractorHouse/MachineryPete，USD）

> 数据来源：TractorHouse/MachineryPete平台，49+条Jaguar 970在售，2026-06-06采集。换算汇率 USD→CNY@6.78。

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

### 北美出口路径分析
- 970(2017)国内163万 vs 北美$285K(193.1万)-$299K(202.6万)，价差30-39.6万(15%-24.3%)
- 逆向出口（中国→北美）需核算跨太平洋海运费率
- 北美竞争定价稳定，$285-299K区间流动性好`,
    detailedContentEn: `## NA Market Prices (TractorHouse/MachineryPete, USD)

> Source: TractorHouse/MachineryPete, 49+ Jaguar 970 listings, 2026-06-06. Rate: USD→CNY@6.78.

### NA 970 Prices

| Year | Price(USD) | RMB | Hours | Location |
|------|-----------|-----|-------|----------|
| 2022 | $516,161 | ≈ 3.498M | 698h | Ontario, CA |
| 2021 | $365,000 | ≈ 2.473M | 1,967h | Michigan, US |
| 2020 | $366,000 | ≈ 2.480M | 1,665h | Wisconsin, US |
| **2017** | **$299,000** | **≈ 2.026M** | 2,130h | Washington, US |
| **2017** | **$285,000** | **≈ 1.931M** | — | Minnesota, US |
| 2016 | $215,000 | ≈ 1.457M | 3,110h | Minnesota, US |
| 2015 | $235,000 | ≈ 1.592M | 2,908h | Minnesota, US |

### Reverse Export Analysis
- China 970(2017) 1.63M vs NA $285-299K(1.931-2.026M), spread 300-396K(15%-24.3%)
- Reverse export (China→NA) requires trans-Pacific shipping cost analysis
- NA pricing stable, $285-299K range has good liquidity`,
    detailedContentRu: `## Цены в Северной Америке (TractorHouse/MachineryPete, USD)

> Источник: TractorHouse/MachineryPete, 49+ Jaguar 970, 2026-06-06. Курс USD→CNY@6.78.

### Цены 970 в США/Канаде

| Год | Цена(USD) | Юани | Часы | Локация |
|-----|-----------|------|------|--------|
| 2022 | $516,161 | ≈ 3.498 млн | 698h | Онтарио, CA |
| 2021 | $365,000 | ≈ 2.473 млн | 1,967h | Мичиган, US |
| **2017** | **$299,000** | **≈ 2.026 млн** | 2,130h | Вашингтон, US |
| **2017** | **$285,000** | **≈ 1.931 млн** | — | Миннесота, US |

### Обратный экспорт
- Китай 1.63 млн vs NA $285-299K(1.931-2.026 млн), спред 300-396K(15%-24.3%)
- Обратный экспорт (Китай→NA) требует анализа транспацифической логистики`,
    actionTips: ["北美970(2017)$285-299K高于国内163万，探索逆向出口路径", "研究中国→北美物流成本(跨太平洋)，核算利润空间", "制作中-美价格对比表，向有意向的北美客户推广"],
    dataSummary: [{ label: "北美970(2017)", value: "$285K-$299K(193-203万)" }, { label: "国内970", value: "163万" }, { label: "价差率", value: "15%-24.3%" }],
  },
  // == 5. 套利排行 ==
  {
    icon: "🔥", region: "中国", tags: ["套利排行", "FR450", "5300RC", "372.2%"], date: "2026-06-07",
    text: "FR450(2013)155.8%走量爆款！5300RC(2020仅18万)价差率372.2%最暴力！970(2017)26.9%最稳健",
    textEn: "FR450(2013) 155.8% volume play! 5300RC(2020 only 180K) 372.2% highest spread! 970(2017) 26.9% most stable",
    textRu: "FR450(2013) 155.8% объёмная сделка! 5300RC(2020 всего 180K) 372.2% макс. спред! 970(2017) 26.9% стабильный",
    detailedContent: `## 跨境套利机会分析（价差≥25% 优先）

> 价差率 =（国际人民币价 - 国内售价）/ 国内售价 × 100%
> ⚠️ 今日欧元回落至7.81，对欧元计价套利标的产生短期小幅压缩

### 套利排行

| 排名 | 品牌 | 型号 | 年份 | 国际人民币价 | 国内售价 | 价差（万元） | 价差率 | 套利评级 |
|------|------|------|------|--------------|----------|--------------|--------|----------|
| 1 | CLAAS | Jaguar 970 | 2017 | 202.6万(US$299K) | 163万 | 39.6 | 24.3% | ⭐⭐⭐⭐ |
| 2 | CLAAS | Jaguar 970 | 2017 | 206.8万(EU€265K) | 163万 | 43.8 | 26.9% | ⭐⭐⭐⭐ |
| 3 | CLAAS | Jaguar 980 | 2016 | 145.7万(US$215K) | 143万 | 2.7 | 1.9% | ⭐⭐ |
| 4 | CLAAS | 5300RC | 2022 | 144.4万(EU€185K同级别) | 95万 | 49.4 | 52.0% | ⭐⭐⭐⭐⭐ |
| 5 | New Holland | FR450 | 2013 | 55万(俄市场) | 21.5万 | 33.5 | 155.8% | ⭐⭐⭐⭐⭐ |
| 6 | CLAAS | 5300RC | 2020 | 参考85万 | 18万 | 67.0 | 372.2% | ⭐⭐⭐⭐⭐ |

### 重点标的说明
1. **FR450(2013)**：一口价21.5万/台×10台，俄罗斯市场约55万，价差率155.8%！走量爆款，汇率波动对其影响最小
2. **5300RC(2022全新)**：95万全新，对标€185K(144.4万)，价差49.4万(52.0%)。巴西线核心产品
3. **5300RC(2020)**：仅18万，国际参考85万，价差率372.2%！超高性价比
4. **970(2017)**：欧洲价差26.9%/北美价差24.3%，最确定的套利标的`,
    detailedContentEn: `## Cross-Border Arbitrage Analysis (Spread ≥25% Priority)

> Spread Rate = (Intl RMB Price - China Price) / China Price × 100%
> ⚠️ Euro dip to 7.81 today, slight compression on EUR arbitrage

### Arbitrage Ranking

| Rank | Brand | Model | Year | Intl Price(RMB) | China Price | Spread | Rate | Rating |
|------|-------|-------|------|-----------------|-------------|--------|------|--------|
| 1 | CLAAS | Jaguar 970 | 2017 | 2.026M($299K) | 1.63M | 396K | 24.3% | ⭐⭐⭐⭐ |
| 2 | CLAAS | Jaguar 970 | 2017 | 2.068M(€265K) | 1.63M | 438K | 26.9% | ⭐⭐⭐⭐ |
| 3 | CLAAS | Jaguar 980 | 2016 | 1.457M($215K) | 1.43M | 27K | 1.9% | ⭐⭐ |
| 4 | CLAAS | 5300RC | 2022 | 1.444M(€185K) | 950K | 494K | 52.0% | ⭐⭐⭐⭐⭐ |
| 5 | New Holland | FR450 | 2013 | 550K(RU) | 215K | 335K | 155.8% | ⭐⭐⭐⭐⭐ |
| 6 | CLAAS | 5300RC | 2020 | ~850K ref | 180K | 670K | 372.2% | ⭐⭐⭐⭐⭐ |

### Key Targets
1. **FR450(2013)**: 215K/unit ×10, Russia ~550K, 155.8%! Volume play, minimal FX impact
2. **5300RC(2022 New)**: 950K new vs €185K(1.444M), spread 494K(52.0%). Brazil core product
3. **5300RC(2020)**: Only 180K, intl ref 850K, 372.2%! Super value
4. **970(2017)**: EU 26.9%/NA 24.3%, most certain arbitrage target`,
    detailedContentRu: `## Арбитражный анализ (спред ≥25% приоритет)

> Спред = (Межд. цена - Цена Китая) / Цена Китая × 100%
> ⚠️ Евро упал до 7.81, небольшое сжатие арбитража в евро

### Арбитражный рейтинг

| # | Бренд | Модель | Год | Межд. цена | Китай | Спред | Ставка | Рейтинг |
|---|-------|--------|-----|-----------|-------|-------|--------|---------|
| 1 | CLAAS | 970 | 2017 | 2.026M($299K) | 1.63M | 396K | 24.3% | ⭐⭐⭐⭐ |
| 2 | CLAAS | 970 | 2017 | 2.068M(€265K) | 1.63M | 438K | 26.9% | ⭐⭐⭐⭐ |
| 3 | CLAAS | 980 | 2016 | 1.457M($215K) | 1.43M | 27K | 1.9% | ⭐⭐ |
| 4 | CLAAS | 5300RC | 2022 | 1.444M(€185K) | 950K | 494K | 52.0% | ⭐⭐⭐⭐⭐ |
| 5 | NH | FR450 | 2013 | 550K(РФ) | 215K | 335K | 155.8% | ⭐⭐⭐⭐⭐ |
| 6 | CLAAS | 5300RC | 2020 | ~850K | 180K | 670K | 372.2% | ⭐⭐⭐⭐⭐ |

### Ключевые цели
1. **FR450(2013)**: 215K/шт ×10, Россия ~550K, 155.8%! Объём, мин. влияние валюты
2. **5300RC(2022 новый)**: 950K vs €185K(1.444M), спред 494K(52.0%). Бразилия
3. **5300RC(2020)**: Всего 180K, реф. 850K, 372.2%! Супер-ценность
4. **970(2017)**: ЕС 26.9%/NA 24.3%, самый надёжный арбитраж`,
    actionTips: ["FR450(2013)一口价21.5万/台速推俄罗斯市场，155.8%走量爆款", "5300RC(2022)全新95万重点推巴西/中东", "5300RC(2020)仅18万是超级性价比标的，尽快挂网推", "970(2017)欧洲套利26.9%最确定的单台套利标的"],
    dataSummary: [{ label: "TOP1价差率", value: "5300RC 372.2%(18万→85万)" }, { label: "TOP2", value: "FR450 155.8%" }, { label: "TOP3", value: "5300RC 52.0%全新" }],
  },
  // == 6. 全球趋势 ==
  {
    icon: "📈", region: "全球", tags: ["价格趋势", "两源稳定", "三源体系"], date: "2026-06-07",
    text: "三源数据体系稳定：Agriaffaires 251条/Agroline 20-26条/TractorHouse 49+条；970(2024)€475K坚挺",
    textEn: "Tri-source data stable: Agriaffaires 251/Agroline 20-26/TractorHouse 49+ listings; 970(2024) €475K firm",
    textRu: "Три источника стабильны: Agriaffaires 251/Agroline 20-26/TractorHouse 49+; 970(2024) €475K устойчив",
    detailedContent: `## 国际市场价格趋势与数据源评估

### 关键机型价格稳定
| 机型 | 6月5日参考价 | 6月6日最新价 | 变化 | 说明 |
|------|-------------|-------------|------|------|
| 970(2024, EU) | €475,000 (Agriaffaires) | €475,000 (Agriaffaires) | 0% | 价格稳定 |
| 970(2017 US) | $285,000~$299,000 | $285,000~$299,000 | — | 北美竞争定价稳定 |
| EUR/CNY | 7.8670 | 7.8074 | **-0.76%↓** | 欧元明显回调 |
| USD/CNY | 6.7742 | 6.7764 | +0.03% | 美元基本持平 |

### 核心发现
1. 欧洲新机交付周期持续12-18个月，二手溢价不受汇率波动影响
2. Agriaffaires平台251条在售，数据量远超此前Agroline样本
3. TractorHouse/ MachineryPete北美数据表现稳定
4. 三源数据(Agriaffaires+Agroline+TractorHouse)交叉验证体系运行良好`,
    detailedContentEn: `## Global Price Trends & Data Source Evaluation

### Key Model Price Stability
| Model | Jun 5 Ref | Jun 6 Latest | Change | Note |
|-------|-----------|-------------|--------|------|
| 970(2024, EU) | €475,000 | €475,000 | 0% | Stable |
| 970(2017 US) | $285K-$299K | $285K-$299K | — | NA pricing stable |
| EUR/CNY | 7.8670 | 7.8074 | **-0.76%↓** | Euro dip |
| USD/CNY | 6.7742 | 6.7764 | +0.03% | USD flat |

### Key Findings
1. EU new machine delivery 12-18 months, used premium unaffected by FX
2. Agriaffaires 251 listings, far exceeds previous Agroline sample
3. TractorHouse data stable
4. Tri-source cross-validation system (Agriaffaires+Agroline+TractorHouse) working well`,
    detailedContentRu: `## Глобальные тренды и оценка источников

### Стабильность ключевых моделей
| Модель | 5 июня | 6 июня | Изм. | Примечание |
|--------|--------|--------|------|------------|
| 970(2024, EU) | €475,000 | €475,000 | 0% | Стабильно |
| 970(2017 US) | $285K-$299K | $285K-$299K | — | Стабильно |
| EUR/CNY | 7.8670 | 7.8074 | **-0.76%↓** | Падение евро |
| USD/CNY | 6.7742 | 6.7764 | +0.03% | USD стабилен |

### Ключевые выводы
1. Новые поставки в ЕС 12-18 мес., б/у премия не зависит от валюты
2. Agriaffaires 251 объявление, значительно больше предыдущей выборки Agroline
3. Система кросс-валидации трёх источников работает хорошо`,
    actionTips: ["以€475K(2024款)为锚点强化国内163万970的性价比话术", "监控Agriaffaires价格变化，为动态定价提供依据", "三源数据交叉验证，确保报价精度"],
    dataSummary: [{ label: "970(2024)EU", value: "€475K(稳定)" }, { label: "970(2017)US", value: "$285-299K" }, { label: "欧元回调", value: "-0.76%↓" }],
  },
  // == 7. 巴西 ==
  {
    icon: "🌾", region: "巴西", tags: ["大豆", "青储机", "5300RC"], date: "2026-06-07",
    text: "巴西大豆种植面积扩张，大型青储机需求+15%！5300RC全新95万价差52.0%是巴西线首选",
    textEn: "Brazil soybean area expanding, large forage harvester demand +15%! 5300RC new 950K spread 52.0% — top Brazil pick",
    textRu: "Бразилия: соя расширяется, спрос на кормоуборочные +15%! 5300RC новый 950K спред 52.0% — выбор №1",
    detailedContent: `## 巴西农机市场机会

### 驱动力分析
| 驱动因素 | 详情 |
|----------|------|
| 大豆种植面积扩张 | 2026年种植面积继续扩大+3-5% |
| 青储机需求 | 大型青储收获机需求同比增长+15% |
| 畜牧业扩张 | 饲料加工设备需求同步增长 |

### 神雕适配产品
| 机型 | 神雕价 | 国际对标价 | 价差率 | 适配场景 |
|------|-------|-----------|--------|---------|
| CLAAS 5300RC(2022全新) | 95万 | €185K≈144.4万 | 52.0% | 大型饲料基地/畜牧场 |
| CLAAS Jaguar 970 | 163万 | €264K≈206.8万 | 26.9% | 大型青储饲料生产 |

### 操作建议
1. 5300RC(95万)性价比优势明显，是巴西走量核心产品
2. 汇率影响微乎其微（5300RC差额大，汇率占比小）
3. 远程视频看车+英语/葡语技术参数准备`,
    detailedContentEn: `## Brazil Farm Machinery Opportunities

### Drivers
| Factor | Detail |
|--------|--------|
| Soybean expansion | 2026 planting area +3-5% |
| Forage demand | Large harvesters +15% YoY |
| Livestock growth | Feed equipment demand growing |

### Recommended Products
| Model | Our Price | Intl Benchmark | Spread | Scenario |
|-------|----------|---------------|--------|----------|
| CLAAS 5300RC(2022 New) | 950K | €185K≈1.444M | 52.0% | Large feed bases |
| CLAAS Jaguar 970 | 1.63M | €264K≈2.068M | 26.9% | Large silage production |

### Strategy
1. 5300RC(950K) clear value advantage, Brazil volume product
2. FX impact minimal (5300RC spread is large)
3. Remote video inspection + EN/PT tech specs ready`,
    detailedContentRu: `## Возможности рынка Бразилии

### Драйверы
| Фактор | Детали |
|--------|--------|
| Расширение сои | 2026 площадь +3-5% |
| Спрос на кормоуборочные | Крупные комбайны +15% г/г |
| Рост животноводства | Спрос на кормовое оборудование |

### Рекомендуемые продукты
| Модель | Наша цена | Межд. бенчмарк | Спред | Сценарий |
|--------|----------|---------------|--------|----------|
| CLAAS 5300RC(2022 новый) | 950K | €185K≈1.444M | 52.0% | Крупные фермы |
| CLAAS Jaguar 970 | 1.63M | €264K≈2.068M | 26.9% | Производство силоса |`,
    actionTips: ["5300RC(95万)重点推巴西市场，抓住+15%需求增长窗口", "准备葡语/英语产品资料和远程看车方案", "对接收割机械经销商网络，建立巴西本地代理"],
    dataSummary: [{ label: "巴西需求增长", value: "+15%" }, { label: "TOP推荐", value: "5300RC(95万/52.0%)" }, { label: "驱动因素", value: "大豆扩张+畜牧扩张" }],
  },
  // == 8. 俄罗斯 ==
  {
    icon: "🇷🇺", region: "俄罗斯", tags: ["出口红利", "CTT收官", "+58.5%"], date: "2026-06-07",
    text: "CTT展会5月29日收官，Q1中国对俄农机出口+66.5%！970(163万)/FR450(21.5万)最优先",
    textEn: "CTT expo closed May 29, Q1 China→Russia machinery export +66.5%! 970(1.63M)/FR450(215K) top priority",
    textRu: "CTT выставка закрыта 29 мая, Q1 экспорт Китай→РФ +66.5%! 970(1.63M)/FR450(215K) приоритет",
    detailedContent: `## 俄罗斯市场分析

### 核心数据
| 指标 | 数据 | 说明 |
|------|------|------|
| CTT展会 | 5月26-29日已收官 | 俄最大工程机械展 |
| Q1中国对俄农机出口 | +66.5% | 红利期延续 |
| 收获机械出口增速 | +58.5%(1-4月) | 青储机/收割机需求旺盛 |
| 俄新车关税 | 提升窗口期 | 二手农机不受限制 |

### 神雕适配产品
| 机型 | 神雕价 | 国际价差 | 推荐理由 |
|------|-------|---------|---------|
| CLAAS Jaguar 970(2017) | 163万 | 26.9% | 旗舰机型，俄大型农场首选 |
| New Holland FR450(2013)×10 | 21.5万/台 | 155.8% | 走量爆款 |
| CLAAS 5300RC(2022全新) | 95万 | 52.0% | 大方捆需求旺盛 |

### 操作建议
1. 重点联系俄罗斯农机经销商和大型农场推970/FR450
2. 虽然欧元回调(7.81)，但26.9%价差率仍远超安全线，且俄罗斯实需强烈
3. FR450的155.8%价差率汇率影响最小，应速推`,
    detailedContentEn: `## Russia Market Analysis

### Key Data
| Metric | Data | Note |
|--------|------|------|
| CTT Expo | May 26-29 closed | Russia's largest machinery expo |
| Q1 China→RU export | +66.5% | Boom continuing |
| Harvester export growth | +58.5%(Jan-Apr) | Strong forage/combine demand |
| RU new car tariffs | Rising window | Used machinery unaffected |

### Recommended Products
| Model | Our Price | Spread | Reason |
|-------|----------|--------|--------|
| CLAAS Jaguar 970(2017) | 1.63M | 26.9% | Flagship, top RU farm choice |
| NH FR450(2013)×10 | 215K/unit | 155.8% | Volume play |
| CLAAS 5300RC(2022 New) | 950K | 52.0% | Strong baler demand |

### Strategy
1. Contact RU dealers and large farms for 970/FR450
2. Despite euro dip(7.81), 26.9% spread well above safety, RU demand strong
3. FR450 155.8% spread, minimal FX impact — push fast`,
    detailedContentRu: `## Анализ рынка России

### Ключевые данные
| Показатель | Данные | Примечание |
|------------|--------|------------|
| CTT выставка | 26-29 мая закрыта | Крупнейшая в РФ |
| Q1 экспорт КНР→РФ | +66.5% | Бум продолжается |
| Рост экспорта уборочных | +58.5%(янв-апр) | Высокий спрос |
| Пошлины на новые авто РФ | Растут | Б/у техника не затронута |

### Рекомендуемые продукты
| Модель | Цена | Спред | Причина |
|--------|------|-------|--------|
| CLAAS Jaguar 970(2017) | 1.63M | 26.9% | Флагман, выбор ферм РФ |
| NH FR450(2013)×10 | 215K/шт | 155.8% | Объём |
| CLAAS 5300RC(2022 новый) | 950K | 52.0% | Спрос на пресс-подборщики |`,
    actionTips: ["联系俄罗斯农机经销商推970/FR450，强调26.9%/155.8%价差", "利用收获机械+58.5%行业势头推进客户开发", "虽然欧元回调但俄实需强烈，价差率仍远超安全线"],
    dataSummary: [{ label: "Q1对俄出口", value: "+66.5%" }, { label: "收获机械", value: "+58.5%" }, { label: "TOP推荐", value: "FR450(155.8%)" }],
  },
  // == 9. 中亚 ==
  {
    icon: "🇺🇿", region: "中亚", tags: ["乌兹别克", "+256.77%", "新市场"], date: "2026-06-07",
    text: "乌兹别克斯坦农机进口增速+256.77%全球最快！中亚市场爆发式增长，970/5300RC/拖拉机线重点",
    textEn: "Uzbekistan machinery import growth +256.77% fastest globally! Central Asia boom, 970/5300RC/tractors priority",
    textRu: "Узбекистан импорт +256.77% самый быстрый в мире! Бум ЦА, 970/5300RC/тракторы приоритет",
    detailedContent: `## 中亚市场—乌兹别克斯坦爆发

### 核心数据
| 指标 | 数据 |
|------|------|
| 乌兹别克进口增速 | +256.77% |
| 全球排名 | 最快增速市场 |
| 需求品类 | 收获机械、拖拉机、青储机 |

### 目标市场动态全景
| 市场 | 核心动态 | 对神雕影响 |
|------|---------|-----------|
| 俄罗斯 | CTT展会已收官，Q1对俄出口+66.5%，红利期延续 | 🔴 P0—970/FR450速推 |
| 巴西 | 大豆种植扩张，大型青储机需求+15% | 🟡 5300RC重点 |
| **乌兹别克** | **+256.77%进口增速，全球最快** | **🆕 中亚重点开拓** |
| 乌克兰 | USDA确认粮食增产，青储机需求旺盛 | 🟢 追踪中 |
| 东南亚 | 水稻收获机+拖拉机需求上升，中泰农机协议推进中 | 🟢 新机会 |
| 非洲 | 机械化率低但基础设施限制 | ⏳ 长期跟进 |

### 操作建议
将中亚（乌兹别克为中心）作为第二梯队重点开拓市场，970/5300RC/拖拉机等品类有需求`,
    detailedContentEn: `## Central Asia — Uzbekistan Boom

### Key Data
| Metric | Value |
|--------|-------|
| Uzbekistan import growth | +256.77% |
| Global rank | Fastest growing market |
| Demand categories | Harvesters, tractors, forage harvesters |

### Target Market Dynamics
| Market | Key Dynamic | Impact |
|--------|------------|--------|
| Russia | CTT closed, Q1 +66.5%, boom continues | 🔴 P0—970/FR450 push |
| Brazil | Soybean expansion, forage +15% | 🟡 5300RC focus |
| **Uzbekistan** | **+256.77%, fastest global** | **🆕 Central Asia priority** |
| Ukraine | USDA confirms grain increase | 🟢 Tracking |
| SE Asia | Rice harvesters + tractors rising | 🟢 New opportunity |
| Africa | Low mechanization, infrastructure limits | ⏳ Long-term |

### Strategy
Make Central Asia (Uzbekistan-centric) tier-2 priority market, 970/5300RC/tractors in demand`,
    detailedContentRu: `## Центральная Азия — взрыв Узбекистана

### Ключевые данные
| Показатель | Значение |
|------------|----------|
| Рост импорта Узбекистана | +256.77% |
| Мировой рейтинг | Самый быстрорастущий рынок |
| Категории спроса | Уборочные, тракторы, кормоуборочные |

### Динамика рынков
| Рынок | Динамика | Влияние |
|-------|----------|--------|
| Россия | CTT закрыта, Q1 +66.5% | 🔴 P0—970/FR450 |
| Бразилия | Соя растёт, +15% | 🟡 5300RC |
| **Узбекистан** | **+256.77%, #1 в мире** | **🆕 Приоритет ЦА** |
| Украина | USDA: рост зерна | 🟢 Отслеживание |
| ЮВА | Рисовые комбайны растут | 🟢 Новое |
| Африка | Низкая механизация | ⏳ Долгосрочно |`,
    actionTips: ["乌兹别克+256.77%是最快增速市场，配置俄语销售资源覆盖", "970/5300RC/拖拉机品类作为中亚主打产品", "利用俄罗斯物流通道覆盖中亚，降低单点物流成本"],
    dataSummary: [{ label: "乌兹别克增速", value: "+256.77%" }, { label: "全球排名", value: "最快增速市场" }, { label: "战略定位", value: "第二梯队重点开拓" }],
  },
  // == 10. 政策 ==
  {
    icon: "📋", region: "中国", tags: ["十五五", "徐工采埃孚", "湖南出口德国"], date: "2026-06-07",
    text: "十五五规划2030年机械化率>80%；徐工+采埃孚合资加速国产替代；湖南农机出口德国成第一大目的国",
    textEn: "15th Five-Year Plan >80% mechanization by 2030; XCMG+ZF JV accelerates domestic substitution; Hunan→Germany #1 export destination",
    textRu: "15-й план: >80% механизации к 2030; XCMG+ZF ускоряют импортозамещение; Хунань→Германия экспорт №1",
    detailedContent: `## 行业动态与政策红利（2026年6月更新）

### 🔥今日新情报
1. **中国农机出口持续高景气**：2026年1-4月全国农机出口+28.9%，收获机械+58.5%，高景气延续到5-6月
2. **"十五五"农业农村现代化规划**：2030年耕种收综合机械化率>80%（目标持续驱动农机需求增长）
3. **湖南农机出口德国成第一大目的国**：前4月3.4亿元+39.7%，欧洲高端市场突破确认
4. **徐工+采埃孚合资推进国产高端化**：农机动力换挡传动系统加速国产替代
5. **河南三夏麦收规模化推进**：混动收割机大规模商用，农机电动化进入加速期

### 对神雕的影响
| 趋势 | 影响 | 应对策略 |
|------|------|---------|
| 机械化率>80%目标 | 农机需求长期向上 | 加大出口备货，抢占市场份额 |
| 湖南出口德国+39.7% | 欧洲高端市场空间已打开 | 中国二手农机出口德国通道确认 |
| 国产替代加速 | 徐工/柳工/中联等巨头进入 | 利用先发优势做跨境贸易快速覆盖 |
| 电动化趋势 | 长期可能改变动力系统格局 | 跟踪但短期不影响柴油农机出口 |`,
    detailedContentEn: `## Industry Trends & Policy (June 2026 Update)

### 🔥 Today's Intel
1. **China machinery export boom**: Jan-Apr +28.9%, harvesters +58.5%, momentum into May-Jun
2. **15th Five-Year Plan**: >80% mechanization by 2030 (driving sustained demand)
3. **Hunan→Germany #1 destination**: Jan-Apr ¥340M +39.7%, EU high-end market breakthrough confirmed
4. **XCMG+ZF JV**: Accelerating domestic high-end power-shift transmission systems
5. **Henan summer harvest**: Hybrid harvesters at scale, electrification accelerating

### Impact on Us
| Trend | Impact | Strategy |
|-------|--------|----------|
| >80% mechanization target | Demand rising long-term | Increase export inventory |
| Hunan→Germany +39.7% | EU high-end market opened | China used machinery→Germany channel confirmed |
| Domestic substitution | XCMG/Liugong/Zoomlion entering | Use first-mover advantage for cross-border trade |
| Electrification | May change powertrain landscape | Monitor, short-term diesel export unaffected |`,
    detailedContentRu: `## Тренды отрасли и политика (июнь 2026)

### 🔥 Свежая разведка
1. **Экспорт сельхозтехники Китая**: янв-апр +28.9%, уборочные +58.5%
2. **15-й пятилетний план**: >80% механизации к 2030
3. **Хунань→Германия направление №1**: ¥340 млн +39.7% за 4 месяца
4. **XCMG+ZF СП**: ускорение импортозамещения трансмиссий
5. **Хэнань летний урожай**: гибридные комбайны в масштабе

### Влияние на нас
| Тренд | Влияние | Стратегия |
|-------|--------|----------|
| >80% механизации | Долгосрочный рост спроса | Наращивать экспорт |
| Хунань→Германия +39.7% | Рынок ЕС открыт | Канал Китай→Германия подтверждён |
| Импортозамещение | Выход гигантов | Преимущество первопроходца |
| Электрификация | Долгосрочные изменения | Мониторинг, дизель пока не затронут |`,
    actionTips: ["十五五80%机械化率目标=农机需求长期向上，加快海外仓布局", "湖南前4月3.4亿出口德国说明高端市场已打开，神雕可跟进", "关注徐工/中联等国产替代竞争，差异化做跨境贸易"],
    dataSummary: [{ label: "机械化率目标", value: ">80%(2030)" }, { label: "农机出口增速", value: "+28.9%" }, { label: "湖南→德国", value: "前4月3.4亿元+39.7%" }],
  },
  // == 11. 风险 ==
  {
    icon: "⚠️", region: "全球", tags: ["风险提示", "汇率升级", "物流关税"], date: "2026-06-07",
    text: "五大风险：汇率波动风险升级(欧元单日-0.76%)、物流±20%、进口政策调整、国产替代加速",
    textEn: "5 risks: FX volatility escalated (EUR -0.76% daily), logistics ±20%, import policy shifts, domestic substitution accelerating",
    textRu: "5 рисков: волатильность валют (EUR -0.76%), логистика ±20%, импортная политика, ускорение замещения",
    detailedContent: `## 风险提示（2026-06-06更新）

### 五大核心风险

| # | 风险类型 | 当前状态 | 影响程度 |
|---|---------|---------|---------|
| 1 | ⚠️ 汇率波动风险升级 | 欧元单日回落0.76%跌破7.85，若持续下行可能压缩10-15%的套利利润 | 🔴 高风险—重点关注 |
| 2 | 国际物流成本波动 | 苏伊士运河绕行→好望角增加7-10天航程，海运价格波动±20% | ⚠️ 中等 |
| 3 | 进口政策风险 | 国内二手农机进口限制政策可能调整，需持续关注海关通知 | 🔴 高风险 |
| 4 | 汇率对冲建议 | 对于欧元计价的大额出口合同，建议通过远期锁定或CIPS人民币结算降低汇率敞口 | 🟡 建议执行 |
| 5 | 国内替代加速 | 徐工/柳工/中联全线进军农机，中长期可能改变高端农机进口格局 | 🟡 低-中 |`,
    detailedContentEn: `## Risk Alert (Updated 2026-06-06)

### Five Core Risks

| # | Risk Type | Status | Severity |
|---|----------|--------|----------|
| 1 | ⚠️ FX volatility escalated | EUR -0.76% below 7.85, continued decline may compress 10-15% arbitrage profit | 🔴 High |
| 2 | Logistics cost volatility | Suez detour→Cape of Good Hope +7-10 days, shipping ±20% | ⚠️ Medium |
| 3 | Import policy risk | China used machinery import restrictions may change | 🔴 High |
| 4 | FX hedging | For large EUR contracts, use forward lock or CIPS RMB settlement | 🟡 Action Recommended |
| 5 | Domestic substitution | XCMG/Liugong/Zoomlion entering machinery, may shift landscape | 🟡 Low-Med |`,
    detailedContentRu: `## Предупреждение о рисках (обновлено 2026-06-06)

### Пять ключевых рисков

| # | Тип риска | Статус | Серьёзность |
|---|----------|--------|------------|
| 1 | ⚠️ Волатильность валют | EUR -0.76% ниже 7.85, продолжение может сжать 10-15% прибыли | 🔴 Высокий |
| 2 | Логистика | Суэц→Мыс Доброй Надежды +7-10 дней, доставка ±20% | ⚠️ Средний |
| 3 | Импортная политика | Ограничения на импорт б/у техники могут измениться | 🔴 Высокий |
| 4 | Хеджирование | Для крупных EUR-контрактов: форвард или CIPS RMB | 🟡 Рекомендуется |
| 5 | Импортозамещение | XCMG и др. выходят на рынок | 🟡 Низкий-средний |`,
    actionTips: ["⚠️ 欧元单日-0.76%跌破7.85，关注欧央行6月议息会议决议", "大额订单签约时加入汇率锁定条款，优先CIPS人民币结算", "面对国内替代加速，利用跨境先发优势快速占领海外市场份额"],
    dataSummary: [{ label: "汇率风险", value: "欧元-0.76%跌破7.85" }, { label: "物流波动", value: "±20%" }, { label: "新增风险", value: "进口政策调整" }],
  },
  // == 12. 行动建议 ==
  {
    icon: "🎯", region: "中国", tags: ["操作建议", "锁汇", "FR450速推", "巴西线"], date: "2026-06-07",
    text: "六大优先：汇率对冲锁定、970/980推俄语区、FR450速推、5300RC巴西线、趁欧元低位采购、关注6.9数据",
    textEn: "6 priorities: FX hedge, push 970/980 to Russian-speaking regions, FR450 fast track, 5300RC Brazil, buy on euro dip, monitor Jun 9 data",
    textRu: "6 приоритетов: хедж валюты, 970/980 в русскоязычные регионы, FR450 быстро, 5300RC Бразилия, закуп на спаде евро, данные 9 июня",
    detailedContent: `## 今日操作建议（2026-06-06）

### 六大优先行动

| 优先级 | 行动项 | 执行细节 | 预期成果 |
|--------|--------|---------|---------|
| ⚠️ P0 | 汇率对冲优先 | 欧元跌0.76%，今日与买家沟通时采用CIPS人民币结算 | 规避汇率敞口 |
| 🔴 P0 | 970/980持续推往俄语区 | 虽然欧元回调，但26.9%价差率仍远超安全线 | 快速出货创收 |
| 🔴 P0 | FR450一口价爆款 | 21.5万/台+155.8%价差率，汇率影响最小应速推 | 批量走量+现金流 |
| 🟡 P1 | 5300RC巴西线加速 | 全新95万+52.0%价差，巴西大捆需求暴增 | 新市场突破 |
| 🟢 P2 | 趁欧元低位入场 | 当前€100万节省约6万元人民币购买力 | 降低采购成本 |
| 🟢 P2 | 关注下周数据 | 6月9日中国5月CPI/PPI公布，可能影响人民币走势 | 提前预判 |

> **策略核心**：锁汇降风险 + 存量去化 + 爆款走量 + 新市场开拓`,
    detailedContentEn: `## Today's Action Plan (2026-06-06)

### Six Priority Actions

| Priority | Action | Detail | Expected Result |
|----------|--------|--------|-----------------|
| ⚠️ P0 | FX hedge first | EUR -0.76%, use CIPS RMB settlement today | Eliminate FX exposure |
| 🔴 P0 | Push 970/980 to RU regions | 26.9% spread still well above safety despite euro dip | Fast sales revenue |
| 🔴 P0 | FR450 volume play | 215K/unit +155.8% spread, minimal FX impact | Volume + cash flow |
| 🟡 P1 | 5300RC Brazil accelerate | New 950K +52.0% spread, Brazil baler demand surging | New market breakthrough |
| 🟢 P2 | Buy on euro dip | €1M saves ~60K RMB purchasing power | Lower procurement cost |
| 🟢 P2 | Monitor next week data | Jun 9 China CPI/PPI release may affect RMB | Early positioning |

> **Core Strategy**: Hedge risk + clear inventory + volume play + new market expansion`,
    detailedContentRu: `## План действий на сегодня (2026-06-06)

### Шесть приоритетных действий

| Приоритет | Действие | Детали | Результат |
|-----------|----------|--------|----------|
| ⚠️ P0 | Хедж валюты | EUR -0.76%, использовать CIPS RMB сегодня | Устранение валютного риска |
| 🔴 P0 | 970/980 в русскоязычные регионы | Спред 26.9% всё ещё выше безопасного уровня | Быстрые продажи |
| 🔴 P0 | FR450 объёмная сделка | 215K/шт +155.8%, мин. влияние валюты | Объём + денежный поток |
| 🟡 P1 | 5300RC Бразилия | Новый 950K +52.0%, спрос на пресс-подборщики растёт | Новый рынок |
| 🟢 P2 | Закуп на спаде евро | €1M экономит ~60K юаней | Снижение затрат |
| 🟢 P2 | Данные 9 июня | CPI/PPI Китая за май, может повлиять на юань | Раннее позиционирование |

> **Стратегия**: Хедж + очистка склада + объём + новые рынки`,
    actionTips: ["⚠️ P0—汇率对冲，今日与买家沟通采用CIPS人民币结算", "🔴 P0—970/980持续推往俄语区，FR450一口价速推", "🟡 P1—5300RC巴西线加速，🍃 P2—趁欧元低位采购+关注6.9数据"],
    dataSummary: [{ label: "策略核心", value: "锁汇+去化+走量+开拓" }, { label: "P0优先", value: "汇率/970/980/FR450" }, { label: "P1/P2", value: "5300RC巴西/低价采购/6.9数据" }],
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
  "中亚": { en: "Central Asia", ru: "Центральная Азия" },
};

const tagMap = {
  "EUR/CNY": { en: "EUR/CNY", ru: "EUR/CNY" }, "7.8074": { en: "7.8074", ru: "7.8074" },
  "跌破7.85": { en: "Below 7.85", ru: "Ниже 7.85" },
  "Agriaffaires": { en: "Agriaffaires", ru: "Agriaffaires" },
  "970": { en: "970", ru: "970" }, "套利26.9%": { en: "Arbitrage 26.9%", ru: "Арбитраж 26.9%" },
  "980": { en: "980", ru: "980" }, "€467.9K": { en: "€467.9K", ru: "€467.9K" },
  "供给偏紧": { en: "Tight Supply", ru: "Дефицит" },
  "TractorHouse": { en: "TractorHouse", ru: "TractorHouse" },
  "$285-299K": { en: "$285-299K", ru: "$285-299K" },
  "逆向出口": { en: "Reverse Export", ru: "Обратный экспорт" },
  "套利排行": { en: "Arbitrage Ranking", ru: "Арбитражный рейтинг" },
  "FR450": { en: "FR450", ru: "FR450" }, "5300RC": { en: "5300RC", ru: "5300RC" },
  "372.2%": { en: "372.2%", ru: "372.2%" },
  "价格趋势": { en: "Price Trends", ru: "Ценовой тренд" },
  "两源稳定": { en: "Stable Sources", ru: "Стабильные источники" },
  "三源体系": { en: "Three-Source System", ru: "Три источника" },
  "大豆": { en: "Soybean", ru: "Соя" },
  "青储机": { en: "Forage Harvester", ru: "Кормоуборочный" },
  "出口红利": { en: "Export Boom", ru: "Экспортный бум" },
  "CTT收官": { en: "CTT Closed", ru: "CTT завершена" }, "+58.5%": { en: "+58.5%", ru: "+58.5%" },
  "乌兹别克": { en: "Uzbekistan", ru: "Узбекистан" },
  "+256.77%": { en: "+256.77%", ru: "+256.77%" }, "新市场": { en: "New Market", ru: "Новый рынок" },
  "十五五": { en: "15th Five-Year Plan", ru: "15-й план" },
  "徐工采埃孚": { en: "XCMG+ZF", ru: "XCMG+ZF" },
  "湖南出口德国": { en: "Hunan→Germany", ru: "Хунань→Германия" },
  "风险提示": { en: "Risk Alert", ru: "Предупреждение" },
  "汇率升级": { en: "FX Warning", ru: "Риск валюты" },
  "物流关税": { en: "Logistics&Tariff", ru: "Логистика" },
  "操作建议": { en: "Action Plan", ru: "План действий" },
  "锁汇": { en: "Hedge", ru: "Хедж" },
  "FR450速推": { en: "Push FR450", ru: "FR450 приоритет" },
  "巴西线": { en: "Brazil Route", ru: "Канал Бразилия" },
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
