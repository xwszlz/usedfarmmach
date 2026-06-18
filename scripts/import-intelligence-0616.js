/**
 * 导入2026-06-16市场情报数据到数据库
 * 基于 2026-06-15_跨境套利日报.md 生成（当日日报未生成，使用最新一期）
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const TODAY = new Date("2026-06-16");

const ALL_MARKET_INTEL = [
  {
    icon: "💶", region: "欧洲", tags: ["汇率", "欧元反弹"], date: TODAY,
    text: "EUR/CNY 7.8555大幅反弹+0.33%！重回7.85上方，套利空间小幅扩大，出口定价可保持乐观",
    textEn: "EUR/CNY 7.8555 strong rebound +0.33%! Back above 7.85, arbitrage space slightly expanded, export pricing can remain optimistic",
    textRu: "EUR/CNY 7.8555 сильный отскок +0.33%! Вернулся выше 7.85, арбитражное пространство немного расширилось, ценообразование экспорта может оставаться оптимистичным",
    regionEn: "Europe", regionRu: "Европа",
    tagsEn: '["FX", "Euro Rebound"]', tagsRu: '["Валютный курс", "Отскок евро"]',
    detailedContent: `## EUR/CNY 7.8555 汇率快报（2026-06-15更新，用于6月16日交易决策）\n\n**核心数据：** EUR/CNY中行折算价7.8555，较6月14日7.8294反弹+0.33%。\n\n| 货币对 | 中行折算价 | 现汇买入价 | 现汇卖出价 | 日环比 |\n|--------|-----------|-----------|-----------|--------|\n| EUR/CNY | **7.8555** | 781.20 | 787.45 | **+0.33%** |\n| USD/CNY | **6.8330** | 678.40 | 681.30 | **+0.31%** |\n\n### 汇率走势分析\n- 近两周EUR/CNY在7.82-7.86区间窄幅震荡\n- 6月15日单日+0.33%为近两周最大单日涨幅\n- 美元同步走强（USD/CNY 6.8330，+0.31%）\n- **若EUR/CNY突破7.90需启动汇率对冲**`,
    detailedContentEn: `## EUR/CNY 7.8555 FX Flash Report (Updated Jun 15, for Jun 16 trading decisions)\n\n**Core Data:** EUR/CNY PBOC midpoint 7.8555, up +0.33% from Jun 14's 7.8294.\n\n| Pair | PBOC Midpoint | Buying | Selling | Daily Change |\n|--------|-----------|-----------|-----------|--------|\n| EUR/CNY | **7.8555** | 781.20 | 787.45 | **+0.33%** |\n| USD/CNY | **6.8330** | 678.40 | 681.30 | **+0.31%** |\n\n### FX Trend Analysis\n- Two-week range: 7.82-7.86 narrow fluctuation\n- Jun 15 single-day +0.33% is the largest in two weeks\n- USD also strengthening (USD/CNY 6.8330, +0.31%)\n- **If EUR/CNY breaks 7.90, initiate FX hedging**`,
    detailedContentRu: `## EUR/CNY 7.8555 Валютный флэш-отчёт (обновлено 15 июня, для торговых решений 16 июня)\n\n**Основные данные:** Средний курс НБК EUR/CNY 7.8555, рост +0.33% с 7.8294 от 14 июня.\n\n| Пара | Средний НБК | Покупка | Продажа | Дневное изменение |\n|--------|-----------|-----------|-----------|--------|\n| EUR/CNY | **7.8555** | 781.20 | 787.45 | **+0.33%** |\n| USD/CNY | **6.8330** | 678.40 | 681.30 | **+0.31%** |\n\n### Анализ тренда валют\n- Двухнедельный диапазон: 7.82-7.86 узкие колебания\n- 15 июня +0.33% за день — самый большой рост за две недели\n- Доллар также укрепляется (USD/CNY 6.8330, +0.31%)\n- **Если EUR/CNY пробьет 7.90, начать хеджирование**`,
    actionTips: ["EUR/CNY反弹至7.8555=套利空间小幅扩大，合同可加速锁定", "若汇率突破7.90启动汇率对冲", "出口报价利用反弹窗口保持乐观定价"],
    dataSummary: JSON.stringify([{ label: "EUR/CNY", value: "7.8555(+0.33%)" }, { label: "USD/CNY", value: "6.8330(+0.31%)" }]),
  },
  {
    icon: "🏆", region: "中国", tags: ["5300RC", "336%价差"], date: TODAY,
    text: "CLAAS 5300RC(2020) 18万元白菜价！国际€99,900→78.5万，价差60.5万，336.1%全品类第一",
    textEn: "CLAAS 5300RC(2020) bargain at CNY 180K! International €99,900→CNY 785K, spread CNY 605K, 336.1% highest across all categories",
    textRu: "CLAAS 5300RC(2020) по бросовой цене 180 тыс. юаней! Международная €99,900→785 тыс. юаней, разница 605 тыс., 336.1% — самая высокая среди всех категорий",
    regionEn: "China", regionRu: "Китай",
    tagsEn: '["5300RC", "336% Spread"]', tagsRu: '["5300RC", "336% разница"]',
    detailedContent: `## CLAAS 5300RC(2020) 336.1% 套利分析\n\n**核心标的：** CLAAS Quadrant 5300 FC (2020)，国内仅18万元，国际€99,900→78.5万元\n\n### 套利详情\n| 指标 | 数值 |\n|------|------|\n| 国内售价 | **18万元** |\n| 国际参考价 | €99,900（德国博克尔）→ **78.5万元** |\n| 价差 | **60.5万元** |\n| 价差率 | **336.1%** ⭐⭐⭐⭐⭐ |\n| 排名 | 全品类第一 |\n\n### ⚠️ 需确认事项\n1. 18万低价是否对应正常车况？需实车验证\n2. 出口手续是否齐全\n3. 如车况良好则为最高优先操作标的`,
    detailedContentEn: `## CLAAS 5300RC(2020) 336.1% Arbitrage Analysis\n\n**Core Target:** CLAAS Quadrant 5300 FC (2020), domestic only CNY 180K, international €99,900→CNY 785K\n\n### Arbitrage Details\n| Indicator | Value |\n|------|------|\n| Domestic price | **CNY 180K** |\n| International reference | €99,900 (Böckel, Germany) → **CNY 785K** |\n| Spread | **CNY 605K** |\n| Spread rate | **336.1%** ⭐⭐⭐⭐⭐ |\n| Ranking | #1 across all categories |\n\n### ⚠️ Items to Verify\n1. Does the CNY 180K price reflect normal condition? Need physical inspection\n2. Export documentation complete?\n3. If condition is good, this is the highest priority operation target`,
    detailedContentRu: `## CLAAS 5300RC(2020) 336.1% Арбитражный анализ\n\n**Основная цель:** CLAAS Quadrant 5300 FC (2020), внутренняя цена всего 180 тыс. юаней, международная €99,900→785 тыс. юаней\n\n### Детали арбитража\n| Показатель | Значение |\n|------|------|\n| Внутренняя цена | **180 тыс. юаней** |\n| Международная справочная | €99,900 (Бёкель, Германия) → **785 тыс. юаней** |\n| Разница | **605 тыс. юаней** |\n| Ставка разницы | **336.1%** ⭐⭐⭐⭐⭐ |\n| Рейтинг | №1 среди всех категорий |\n\n### ⚠️ Что проверить\n1. Соответствует ли цена 180 тыс. юаней нормальному состоянию? Нужен осмотр\n2. Полны ли экспортные документы?\n3. При хорошем состоянии — цель высшего приоритета`,
    actionTips: ["5300RC(2020)优先确认车况和出口手续", "如车况良好立即启动俄语区+中亚营销", "336%价差可作为全站引流爆款"],
    dataSummary: JSON.stringify([{ label: "5300RC价差", value: "336.1%" }, { label: "国内售价", value: "18万元" }]),
  },
  {
    icon: "🇨🇳", region: "中国", tags: ["FR450", "101.4%价差"], date: TODAY,
    text: "New Holland FR450(2013) 21.5万/台+101.4%价差率！10台库存走量爆款，汇率反弹利好出口定价",
    textEn: "New Holland FR450(2013) CNY 215K/unit + 101.4% spread rate! 10 units in stock volume seller, FX rebound benefits export pricing",
    textRu: "New Holland FR450(2013) 215 тыс. юаней/ед. + 101.4% разница! 10 ед. на складе — хит продаж, отскок валюты улучшает экспортное ценообразование",
    regionEn: "China", regionRu: "Китай",
    tagsEn: '["FR450", "101.4% Spread"]', tagsRu: '["FR450", "101.4% разница"]',
    detailedContent: `## FR450爆款速推（持续推荐）\n\n**核心优势：** 一口价21.5万/台 + 101.4%价差率 + 10台库存 + 汇率反弹利好\n\n### FR450套利分析（6月15日更新）\n| 指标 | 数值 |\n|------|------|\n| 国内售价 | **21.5万/台** |\n| 俄市场参考价 | 43.3万 |\n| 价差 | 21.8万 |\n| 价差率 | **101.4%** ⭐⭐⭐⭐⭐ |\n| 库存 | **10台** |\n| 汇率敏感度 | 低（绝对价差小） |\n\n### 为什么持续推荐？\n1. 101.4%价差率→翻倍利润，全品类第二\n2. 21.5万低门槛→买家决策快\n3. 10台库存→走量模式\n4. 汇率反弹6月15日+0.33%→出口定价信心增强`,
    detailedContentEn: `## FR450 Hot Seller Push (Continued)\n\n**Core Advantage:** Fixed price CNY 215K/unit + 101.4% spread rate + 10 units in stock + FX rebound boost\n\n### FR450 Arbitrage Analysis (Updated Jun 15)\n| Indicator | Value |\n|------|------|\n| Domestic price | **CNY 215K/unit** |\n| Russian market reference | CNY 433K |\n| Spread | CNY 218K |\n| Spread rate | **101.4%** ⭐⭐⭐⭐⭐ |\n| Inventory | **10 units** |\n| FX sensitivity | Low (small absolute spread) |\n\n### Why Continue Recommending?\n1. 101.4% spread → double profit, #2 across all categories\n2. CNY 215K low barrier → fast buyer decisions\n3. 10 units inventory → volume model\n4. FX rebound +0.33% Jun 15 → stronger export pricing confidence`,
    detailedContentRu: `## FR450 — хит продаж (продолжение)\n\n**Главное преимущество:** фиксированная цена 215 тыс. юаней/ед. + 101.4% разница + 10 ед. на складе + подъём валют\n\n### Арбитражный анализ FR450 (обновлено 15 июня)\n| Показатель | Значение |\n|------|------|\n| Внутренняя цена | **215 тыс. юаней/ед.** |\n| Справочная цена на рынке РФ | 433 тыс. юаней |\n| Разница | 218 тыс. юаней |\n| Ставка разницы | **101.4%** ⭐⭐⭐⭐⭐ |\n| Остаток на складе | **10 ед.** |\n| Чувствительность к валютам | Низкая |\n\n### Почему продолжаем рекомендовать?\n1. 101.4% разница → двойная прибыль, №2 среди всех категорий\n2. Низкий порог 215 тыс. → быстрое решение покупателя\n3. 10 ед. на складе → модель объёмных продаж\n4. Отскок валют +0.33% 15 июня → уверенность в экспортном ценообразовании`,
    actionTips: ["FR450 10台批量速推俄语区+中亚", "21.5万低门槛吸引小型买家", "汇率反弹窗口内加速签单"],
    dataSummary: JSON.stringify([{ label: "FR450价差", value: "101.4%" }, { label: "库存", value: "10台" }]),
  },
  {
    icon: "🇨🇳", region: "中国", tags: ["BP1290", "97.2%新冠军"], date: TODAY,
    text: "Krone Big Pack 1290(2020)新晋打捆机套利冠军！国际€170,765→134.1万 vs 国内68万，价差66.1万(97.2%)",
    textEn: "Krone Big Pack 1290(2020) new baler arbitrage champion! International €170,765→CNY 1.341M vs domestic CNY 680K, spread CNY 661K (97.2%)",
    textRu: "Krone Big Pack 1290(2020) новый чемпион по арбитражу пресс-подборщиков! Международная €170,765→1.341 млн юаней vs внутренние 680 тыс., разница 661 тыс. (97.2%)",
    regionEn: "China", regionRu: "Китай",
    tagsEn: '["BP1290", "97.2% New Champ"]', tagsRu: '["BP1290", "97.2% новый чемпион"]',
    detailedContent: `## Krone Big Pack 1290(2020) 打捆机套利冠军\n\n**🆕 新发现标的：** Krone BiG Pack 1290 HDP VC 51 (2020)，国内68万元，国际€170,765(奥地利)→134.1万元\n\n### 套利详情\n| 指标 | 数值 |\n|------|------|\n| 国内售价 | **68万元** |\n| 国际参考价 | €170,765（奥地利）→ **134.1万元** |\n| 价差 | **66.1万元** |\n| 价差率 | **97.2%** ⭐⭐⭐⭐⭐ |\n| 排名 | 打捆机品类第一，全品类第三 |\n\n### 操作建议\n- 俄语区打捆机刚需旺盛\n- 大口径大方捆（HDP VC 51）适合大型农场\n- 优先推哈萨克斯坦+俄罗斯市场\n- Krone品牌在俄语区认知度极高`,
    detailedContentEn: `## Krone Big Pack 1290(2020) Baler Arbitrage Champion\n\n**🆕 New Discovery:** Krone BiG Pack 1290 HDP VC 51 (2020), domestic CNY 680K, international €170,765 (Austria)→CNY 1.341M\n\n### Arbitrage Details\n| Indicator | Value |\n|------|------|\n| Domestic price | **CNY 680K** |\n| International reference | €170,765 (Austria) → **CNY 1.341M** |\n| Spread | **CNY 661K** |\n| Spread rate | **97.2%** ⭐⭐⭐⭐⭐ |\n| Ranking | #1 in baler category, #3 overall |\n\n### Action Recommendations\n- High demand for balers in Russian-speaking region\n- Large-size big baler (HDP VC 51) suitable for large farms\n- Prioritize Kazakhstan + Russia markets\n- Krone brand highly recognized in Russian-speaking region`,
    detailedContentRu: `## Krone Big Pack 1290(2020) Чемпион по арбитражу пресс-подборщиков\n\n**🆕 Новое открытие:** Krone BiG Pack 1290 HDP VC 51 (2020), внутренняя цена 680 тыс. юаней, международная €170,765 (Австрия)→1.341 млн юаней\n\n### Детали арбитража\n| Показатель | Значение |\n|------|------|\n| Внутренняя цена | **680 тыс. юаней** |\n| Международная справочная | €170,765 (Австрия) → **1.341 млн юаней** |\n| Разница | **661 тыс. юаней** |\n| Ставка разницы | **97.2%** ⭐⭐⭐⭐⭐ |\n| Рейтинг | №1 в категории пресс-подборщиков, №3 в общем |\n\n### Рекомендации\n- Высокий спрос на пресс-подборщики в русскоязычном регионе\n- Крупный пресс-подборщик (HDP VC 51) подходит для больших ферм\n- Приоритет: Казахстан + Россия\n- Бренд Krone широко известен в русскоязычном регионе`,
    actionTips: ["BP1290东欧优先量推，97.2%打捆机冠军", "Krone品牌优势+大口径适合大型农场", "结合08款BP1290(€30.6K)做价格锚点"],
    dataSummary: JSON.stringify([{ label: "BP1290价差", value: "97.2%" }, { label: "价差利润", value: "66.1万" }]),
  },
  {
    icon: "🇨🇳", region: "中国", tags: ["980套利", "73.5%价差"], date: TODAY,
    text: "Jaguar 980(2016) 国际€316K→248.1万 vs 国内143万，价差105.1万(73.5%)，全系列套利王持续领跑",
    textEn: "Jaguar 980(2016) International €316K→CNY 2.481M vs domestic CNY 1.43M, spread CNY 1.051M (73.5%), series arbitrage king continues leading",
    textRu: "Jaguar 980(2016) Международная €316K→2.481 млн юаней vs внутренние 1.43 млн, разница 1.051 млн (73.5%), король арбитража серии продолжает лидировать",
    regionEn: "China", regionRu: "Китай",
    tagsEn: '["980 Arbitrage", "73.5% Spread"]', tagsRu: '["980 арбитраж", "73.5% разница"]',
    detailedContent: `## Jaguar 980(2016) 套利分析\n\n**核心标的：** CLAAS Jaguar 980 (2016)，国际€316K→248.1万元 vs 国内143万元\n\n### 980套利对比\n| 指标 | 数值 |\n|------|------|\n| 国际价 | €316,000（法国/德国）→ **248.1万元** |\n| 国内售价 | **143万元** |\n| 价差 | **105.1万元** |\n| 价差率 | **73.5%** ⭐⭐⭐⭐⭐ |\n\n### 980市场环境\n- 980(2025)€532,500天花板效应→推高980(2016)性价比认知\n- 980(2014)€216,500→170.1万 vs 国内143万，价差27.1万(19.0%)\n- 980(2016)套利空间远高于其他年份\n- 汇率7.8555较6月14日7.8294反弹→980套利空间小幅扩大`,
    detailedContentEn: `## Jaguar 980(2016) Arbitrage Analysis\n\n**Core Target:** CLAAS Jaguar 980 (2016), international €316K→CNY 2.481M vs domestic CNY 1.43M\n\n### 980 Arbitrage Comparison\n| Indicator | Value |\n|------|------|\n| International price | €316,000 (France/Germany) → **CNY 2.481M** |\n| Domestic price | **CNY 1.43M** |\n| Spread | **CNY 1.051M** |\n| Spread rate | **73.5%** ⭐⭐⭐⭐⭐ |\n\n### 980 Market Environment\n- 980(2025)€532,500 ceiling effect → boosts 980(2016) value perception\n- 980(2014)€216,500→CNY 1.701M vs domestic CNY 1.43M, spread CNY 271K(19.0%)\n- 980(2016) arbitrage space far exceeds other years\n- EUR/CNY 7.8555 vs Jun 14's 7.8294 → 980 arbitrage space slightly expanded`,
    detailedContentRu: `## Арбитражный анализ Jaguar 980(2016)\n\n**Основная цель:** CLAAS Jaguar 980 (2016), международная €316K→2.481 млн юаней vs внутренние 1.43 млн\n\n### Сравнение арбитража 980\n| Показатель | Значение |\n|------|------|\n| Международная цена | €316,000 (Франция/Германия) → **2.481 млн юаней** |\n| Внутренняя цена | **1.43 млн юаней** |\n| Разница | **1.051 млн юаней** |\n| Ставка разницы | **73.5%** ⭐⭐⭐⭐⭐ |\n\n### Рынок 980\n- Эффект потолка 980(2025)€532,500 → повышает восприятие ценности 980(2016)\n- 980(2014)€216,500→1.701 млн vs внутренние 1.43 млн, разница 271K(19.0%)\n- Арбитраж 980(2016) значительно выше других годов\n- EUR/CNY 7.8555 vs 7.8294 14 июня → арбитраж 980 немного расширился`,
    actionTips: ["980(2016)持续优先推俄语区+乌克兰买家", "利用980(2025)€532.5K天花板做性价比锚点", "73.5%为全系列套利王，重点成交标"],
    dataSummary: JSON.stringify([{ label: "980价差", value: "105.1万(73.5%)" }, { label: "980在售", value: "3台" }]),
  },
  {
    icon: "🇨🇳", region: "中国", tags: ["970套利", "52.2%稳定"], date: TODAY,
    text: "CLAAS Jaguar 970(2017) 国际€315,900→248.1万 vs 国内163万，价差85.1万(52.2%)，套利空间稳定",
    textEn: "CLAAS Jaguar 970(2017) International €315,900→CNY 2.481M vs domestic CNY 1.63M, spread CNY 851K (52.2%), stable arbitrage space",
    textRu: "CLAAS Jaguar 970(2017) Международная €315,900→2.481 млн юаней vs внутренние 1.63 млн, разница 851 тыс. (52.2%), стабильное арбитражное пространство",
    regionEn: "China", regionRu: "Китай",
    tagsEn: '["970 Arbitrage", "52.2% Stable"]', tagsRu: '["970 арбитраж", "52.2% стабильно"]',
    detailedContent: `## CLAAS Jaguar 970(2017) 稳定套利分析\n\n**核心标的：** CLAAS Jaguar 970 (2017)，国内163万，国际970(2019)€315,900→248.1万\n\n### 970系列价格分布\n| 年份 | 国际价(EUR) | 换算人民币(@7.8555) |\n|------|-----------|-------------------|\n| 2024 | €440,000 (法国勃艮第, 1377h) | **345.6万** |\n| 2022 | €473,600 (德国汉堡) | **372.0万** |\n| 2021 | €428,400 (德国昆德, 1950h) | **336.5万** |\n| 2019 | €315,900 (德国汉堡, 2000h) | **248.1万** ← 对标度 |\n| 2017 | — | **163万 ← 神雕售价** |\n| 2013 | €167,500 (4-trac, 2564h) | **131.6万** |\n\n### 套利分析\n| 指标 | 数值 |\n|------|------|\n| 国内售价 | **163万元** |\n| 对标国际价 | €315,900 → **248.1万元** |\n| 价差 | **85.1万元** |\n| 价差率 | **52.2%** ⭐⭐⭐⭐⭐ |\n\n### 970推广策略\n- 俄语区+乌克兰：970为青储机第一刚需机型\n- 利用2024款€440K高价做价格锚点\n- 2017款相对2019款仅差2年，性价比极高`,
    detailedContentEn: `## CLAAS Jaguar 970(2017) Stable Arbitrage Analysis\n\n**Core Target:** CLAAS Jaguar 970 (2017), domestic CNY 1.63M, international 970(2019)€315,900→CNY 2.481M\n\n### 970 Series Price Distribution\n| Year | International(EUR) | Converted to CNY (@7.8555) |\n|------|-----------|-------------------|\n| 2024 | €440,000 (Burgundy, France, 1377h) | **CNY 3.456M** |\n| 2022 | €473,600 (Hamburg, Germany) | **CNY 3.720M** |\n| 2021 | €428,400 (Kunde, Germany, 1950h) | **CNY 3.365M** |\n| 2019 | €315,900 (Hamburg, 2000h) | **CNY 2.481M** ← Benchmark |\n| 2017 | — | **CNY 1.63M ← Shendiao price** |\n| 2013 | €167,500 (4-trac, 2564h) | **CNY 1.316M** |\n\n### Arbitrage Analysis\n| Indicator | Value |\n|------|------|\n| Domestic price | **CNY 1.63M** |\n| International benchmark | €315,900 → **CNY 2.481M** |\n| Spread | **CNY 851K** |\n| Spread rate | **52.2%** ⭐⭐⭐⭐⭐ |\n\n### 970 Promotion Strategy\n- Russian-speaking region + Ukraine: 970 is #1 demanded forage harvester\n- Use 2024 model €440K as price anchor\n- 2017 vs 2019 only 2 years difference, excellent value proposition`,
    detailedContentRu: `## CLAAS Jaguar 970(2017) Стабильный арбитражный анализ\n\n**Основная цель:** CLAAS Jaguar 970 (2017), внутренняя 1.63 млн, международная 970(2019)€315,900→2.481 млн\n\n### Распределение цен серии 970\n| Год | Международная (EUR) | Конвертация в юани (@7.8555) |\n|------|-----------|-------------------|\n| 2024 | €440,000 (Бургундия, Франция, 1377ч) | **3.456 млн** |\n| 2022 | €473,600 (Гамбург, Германия) | **3.720 млн** |\n| 2021 | €428,400 (Кунде, Германия, 1950ч) | **3.365 млн** |\n| 2019 | €315,900 (Гамбург, 2000ч) | **2.481 млн** ← Ориентир |\n| 2017 | — | **1.63 млн ← Цена Шэньдяо** |\n| 2013 | €167,500 (4-trac, 2564ч) | **1.316 млн** |\n\n### Арбитражный анализ\n| Показатель | Значение |\n|------|------|\n| Внутренняя цена | **1.63 млн юаней** |\n| Международный ориентир | €315,900 → **2.481 млн юаней** |\n| Разница | **851 тыс. юаней** |\n| Ставка разницы | **52.2%** ⭐⭐⭐⭐⭐ |\n\n### Стратегия продвижения 970\n- Русскоязычный регион + Украина: 970 — самый востребованный силосоуборочный комбайн\n- Использовать 2024 модель €440K как ценовой якорь\n- 2017 vs 2019 всего 2 года разницы, отличное ценностное предложение`,
    actionTips: ["970(2017)稳定套利52.2%，俄语区刚需机型首选", "利用2024款€440K高价锚点突出性价比", "85万利润空间可灵活定价促成交"],
    dataSummary: JSON.stringify([{ label: "970价差", value: "85.1万(52.2%)" }, { label: "970对标年份", value: "2019款€315.9K" }]),
  },
  {
    icon: "🆕", region: "中国", tags: ["950新机会", "44.7%"], date: TODAY,
    text: "CLAAS Jaguar 950(2018) 新发现套利标的！国际€175K→137.5万 vs 国内95万，价差42.5万(44.7%)",
    textEn: "CLAAS Jaguar 950(2018) newly discovered arbitrage target! International €175K→CNY 1.375M vs domestic CNY 950K, spread CNY 425K (44.7%)",
    textRu: "CLAAS Jaguar 950(2018) новый арбитражный объект! Международная €175K→1.375 млн юаней vs внутренние 950 тыс., разница 425 тыс. (44.7%)",
    regionEn: "China", regionRu: "Китай",
    tagsEn: '["950 New", "44.7% Spread"]', tagsRu: '["950 новый", "44.7% разница"]',
    detailedContent: `## CLAAS Jaguar 950(2018) 新套利机会\n\n**🆕 新发现标的：** CLAAS Jaguar 950 (2018)，国内95万元，国际€175,000(法国)→137.5万元\n\n### 950系列价格分布\n| 年份 | 价格(EUR) | 换算人民币 | 所在地 |\n|------|-----------|-----------|--------|\n| 2023 | €449,000 | **352.7万** | 德国（价格天花板） |\n| 2020 | €280,000 | **220.0万** | 德国 |\n| 2018 → **对标** | **€175,000** | **137.5万** | 法国 |\n| 2016 | €73,000 | **57.3万** | 德国 |\n| 2014 | €95,000 | **74.6万** | 波兰 |\n\n### 套利分析\n| 指标 | 数值 |\n|------|------|\n| 国内售价（2018款） | **95万元** |\n| 国际对标价 | €175,000 → **137.5万元** |\n| 价差 | **42.5万元** |\n| 价差率 | **44.7%** ⭐⭐⭐⭐ |\n\n### 为何值得关注\n- 950系列为970的次旗舰，中型农场刚需\n- 2023款€449K天花板印证950高端需求\n- 44.7%价差率中型机中表现优秀`,
    detailedContentEn: `## CLAAS Jaguar 950(2018) New Arbitrage Opportunity\n\n**🆕 New Discovery:** CLAAS Jaguar 950 (2018), domestic CNY 950K, international €175,000 (France)→CNY 1.375M\n\n### 950 Series Price Distribution\n| Year | Price (EUR) | Converted CNY | Location |\n|------|-----------|-----------|--------|\n| 2023 | €449,000 | **CNY 3.527M** | Germany (price ceiling) |\n| 2020 | €280,000 | **CNY 2.200M** | Germany |\n| 2018 → **Benchmark** | **€175,000** | **CNY 1.375M** | France |\n| 2016 | €73,000 | **CNY 573K** | Germany |\n| 2014 | €95,000 | **CNY 746K** | Poland |\n\n### Arbitrage Analysis\n| Indicator | Value |\n|------|------|\n| Domestic price (2018) | **CNY 950K** |\n| International benchmark | €175,000 → **CNY 1.375M** |\n| Spread | **CNY 425K** |\n| Spread rate | **44.7%** ⭐⭐⭐⭐ |\n\n### Why Worth Watching\n- 950 series is 970's sub-flagship, rigid demand for medium farms\n- 2023 €449K ceiling confirms 950 high-end demand\n- 44.7% spread rate excellent among mid-range machines`,
    detailedContentRu: `## CLAAS Jaguar 950(2018) Новая арбитражная возможность\n\n**🆕 Новое открытие:** CLAAS Jaguar 950 (2018), внутренняя 950 тыс., международная €175,000 (Франция)→1.375 млн\n\n### Распределение цен серии 950\n| Год | Цена (EUR) | Конвертация в юани | Местоположение |\n|------|-----------|-----------|--------|\n| 2023 | €449,000 | **3.527 млн** | Германия (потолок цен) |\n| 2020 | €280,000 | **2.200 млн** | Германия |\n| 2018 → **Ориентир** | **€175,000** | **1.375 млн** | Франция |\n| 2016 | €73,000 | **573 тыс.** | Германия |\n| 2014 | €95,000 | **746 тыс.** | Польша |\n\n### Арбитражный анализ\n| Показатель | Значение |\n|------|------|\n| Внутренняя цена (2018) | **950 тыс. юаней** |\n| Международный ориентир | €175,000 → **1.375 млн юаней** |\n| Разница | **425 тыс. юаней** |\n| Ставка разницы | **44.7%** ⭐⭐⭐⭐ |\n\n### Почему стоит внимания\n- Серия 950 — субфлагман 970, необходимый для средних ферм\n- Потолок 2023 €449K подтверждает высокий спрос на 950\n- 44.7% — отличная ставка среди машин среднего класса`,
    actionTips: ["950(2018)44.7%新增套利标的，中型机新方向", "利用2023款€449K天花板做性价比锚点", "适合推向中亚+非洲中型农场需求"],
    dataSummary: JSON.stringify([{ label: "950价差", value: "42.5万(44.7%)" }, { label: "950对标价", value: "€175K" }]),
  },
  {
    icon: "🇪🇺", region: "欧洲", tags: ["990系列", "高端需求"], date: TODAY,
    text: "CLAAS 990系列€349.6K-€529K全球在售5台！2022款美国€529K创新高，全球高端青储机需求强劲",
    textEn: "CLAAS 990 series €349.6K-€529K globally, 5 units for sale! 2022 US model €529K sets new high, global high-end forage harvester demand strong",
    textRu: "Серия CLAAS 990 €349.6K-€529K, 5 ед. в продаже! 2022 модель из США €529K устанавливает новый максимум, глобальный спрос на высококлассные силосоуборочные комбайны высок",
    regionEn: "Europe", regionRu: "Европа",
    tagsEn: '["990 Series", "High-End Demand"]', tagsRu: '["Серия 990", "Высококлассный спрос"]',
    detailedContent: `## CLAAS Jaguar 990 系列全球市场新发现\n\n**🆕 首次系统整理：** Agriaffaires平台990系列5台在售，价格区间€349.6K-€529K\n\n### 990系列价格\n| 年份 | 价格(EUR) | 换算人民币(@7.8555) | 所在地 |\n|------|-----------|-------------------|--------|\n| 2023 | €475,000 | **373.1万** | 德国 |\n| 2022 | **€529,000** | **415.5万** 🔥 | **美国（最高价）** |\n| 2022 | €396,500 | **311.5万** | 德国（欧洲主力） |\n| 2020 | €349,600 | **274.6万** | 德国 |\n\n### 战略意义\n- 990系列为CLAAS旗舰青储机，950/970/980/990四代同堂\n- 2022款美国€529K → 北美需求强劲，价格高于欧洲\n- 欧洲主力2022款€396.5K为基准对标价\n- 990系列全球需求强劲，神雕暂无990库存=市场机会`,
    detailedContentEn: `## CLAAS Jaguar 990 Series Global Market Discovery\n\n**🆕 First systematic compilation:** 5 units of 990 series for sale on Agriaffaires, price range €349.6K-€529K\n\n### 990 Series Prices\n| Year | Price (EUR) | Converted CNY (@7.8555) | Location |\n|------|-----------|-------------------|--------|\n| 2023 | €475,000 | **CNY 3.731M** | Germany |\n| 2022 | **€529,000** | **CNY 4.155M** 🔥 | **USA (highest)** |\n| 2022 | €396,500 | **CNY 3.115M** | Germany (Europe baseline) |\n| 2020 | €349,600 | **CNY 2.746M** | Germany |\n\n### Strategic Significance\n- 990 series is CLAAS flagship forage harvester, 4 generations coexist: 950/970/980/990\n- 2022 US model €529K → North America strong demand, price above Europe\n- European baseline 2022 €396.5K as benchmark\n- 990 series global demand strong, Shendiao has no 990 inventory = market opportunity`,
    detailedContentRu: `## Открытие глобального рынка серии CLAAS Jaguar 990\n\n**🆕 Первая систематическая компиляция:** 5 ед. серии 990 в продаже на Agriaffaires, диапазон цен €349.6K-€529K\n\n### Цены серии 990\n| Год | Цена (EUR) | Конвертация в юани (@7.8555) | Местоположение |\n|------|-----------|-------------------|--------|\n| 2023 | €475,000 | **3.731 млн** | Германия |\n| 2022 | **€529,000** | **4.155 млн** 🔥 | **США (самый высокий)** |\n| 2022 | €396,500 | **3.115 млн** | Германия (европейский базовый) |\n| 2020 | €349,600 | **2.746 млн** | Германия |\n\n### Стратегическое значение\n- Серия 990 — флагман CLAAS, 4 поколения: 950/970/980/990\n- 2022 модель США €529K → высокий спрос в Северной Америке\n- Европейская базовая 2022 €396.5K как ориентир\n- Глобальный спрос на 990 серию высок, у Шэньдяо нет 990 на складе = рыночная возможность`,
    actionTips: ["990系列全球高端需求强劲，可考虑收购990库存", "利用€529K美国高价证明高端市场需求", "990/950/970/980价格矩阵完善CLAAS产品说服力"],
    dataSummary: JSON.stringify([{ label: "990价格区间", value: "€349.6K-€529K" }, { label: "990在售", value: "5台全球" }]),
  },
  {
    icon: "🇷🇺", region: "俄罗斯", tags: ["EU制裁", "替代窗口"], date: TODAY,
    text: "EU第20轮对俄制裁持续发酵！欧美农机配件断供加剧，中国设备替代窗口扩大，俄2026农机第一优先产业",
    textEn: "EU 20th round of sanctions on Russia continues to escalate! Western agri machinery parts supply further disrupted, Chinese equipment substitution window expanding, Russia agri machinery ranked #1 priority industry in 2026",
    textRu: "20-й раунд санкций ЕС против России продолжает усиливаться! Перебои с запчастями западной техники нарастают, окно замены китайским оборудованием расширяется, сельхозмашиностроение — приоритет №1 в России в 2026",
    regionEn: "Russia", regionRu: "Россия",
    tagsEn: '["EU Sanctions", "Substitution Window"]', tagsRu: '["Санкции ЕС", "Окно замены"]',
    detailedContent: `## EU第20轮对俄制裁+俄罗斯农机市场\n\n**制裁状态：** 4月23日EU发布第20轮对俄制裁，新增120项，为2年来最大规模。\n\n### 俄罗斯农机市场关键数据\n| 指标 | 数值 |\n|------|------|\n| 市场规模（2025） | **$8.23亿** |\n| 2034年预计规模 | **$13.3亿** |\n| CAGR | **5.4%** |\n| 俄2026优先产业 | **农机排第一** |\n| 进口关税 | **5%（低税率）** |\n| 政府补贴 | **有（农机购置）** |\n\n### 对中国设备的影响\n- 🇨🇳 中国二手农机不受EU制裁限制\n- 🇨🇳 中国品牌在俄市占率快速增长\n- 中俄铁路运输正常，30-40天到货\n- 俄语产品手册+配件承诺=成交关键`,
    detailedContentEn: `## EU 20th Round Sanctions + Russia Ag Machinery Market\n\n**Sanctions Status:** EU published 20th round of sanctions on April 23, adding 120 new items — largest in 2 years.\n\n### Russia Ag Machinery Market Key Data\n| Indicator | Value |\n|------|------|\n| Market size (2025) | **$823M** |\n| 2034 projected | **$1.33B** |\n| CAGR | **5.4%** |\n| Russia 2026 priority | **Agri machinery #1** |\n| Import tariff | **5% (low rate)** |\n| Government subsidies | **Yes (machinery purchase)** |\n\n### Impact on Chinese Equipment\n- Chinese used machinery not subject to EU sanctions\n- Chinese brand market share in Russia growing rapidly\n- China-Russia rail transport normal, 30-40 day delivery\n- Russian language manuals + parts commitment = deal key`,
    detailedContentRu: `## Санкции ЕС 20-го раунда + рынок сельхозтехники России\n\n**Статус санкций:** ЕС опубликовал 20-й раунд санкций 23 апреля, добавив 120 новых позиций — крупнейший за 2 года.\n\n### Ключевые данные рынка сельхозтехники России\n| Показатель | Значение |\n|------|------|\n| Размер рынка (2025) | **$823 млн** |\n| Прогноз на 2034 | **$1.33 млрд** |\n| CAGR | **5.4%** |\n| Приоритет России 2026 | **Сельхозмашиностроение №1** |\n| Импортная пошлина | **5% (низкая)** |\n| Госсубсидии | **Да (на покупку техники)** |\n\n### Влияние на китайское оборудование\n- Китайская б/у техника не подпадает под санкции ЕС\n- Доля китайских брендов в России быстро растёт\n- Ж/д Китай-Россия работает нормально, 30-40 дней доставки\n- Русскоязычные инструкции + гарантия запчастей = ключ к сделке`,
    actionTips: ["俄市场5%低关税+补贴窗口，加速CLAAS系列推广", "提供俄语说明书+配件供应承诺增强信任", "970/980/850均符合俄市场刚需，重点推"],
    dataSummary: JSON.stringify([{ label: "俄市场规模", value: "$8.23亿→$13.3亿" }, { label: "进口关税", value: "5%低税率" }]),
  },
  {
    icon: "🇺🇿", region: "乌兹别克斯坦", tags: ["全球最快", "+256%"], date: TODAY,
    text: "乌兹别克斯坦进口+256.77%全球最快！棉花采收机械化率不足40%，政府补贴50%，需求空间巨大",
    textEn: "Uzbekistan imports +256.77% globally fastest! Cotton harvesting mechanization rate below 40%, government subsidy 50%, massive demand potential",
    textRu: "Импорт Узбекистана +256.77% — самый быстрый в мире! Механизация хлопкоуборки ниже 40%, госсубсидия 50%, огромный потенциал спроса",
    regionEn: "Uzbekistan", regionRu: "Узбекистан",
    tagsEn: '["Fastest Global", "+256%"]', tagsRu: '["Самый быстрый в мире", "+256%"]',
    detailedContent: `## 乌兹别克斯坦市场持续爆发\n\n### 核心数据\n| 指标 | 数值 |\n|------|------|\n| Q1进口增速 | **+256.77%** 🌍全球最快 |\n| 棉花采收机械化率 | 不足40% |\n| 政府补贴 | 农机购置补贴**50%** |\n| 物流 | 中吉乌铁路建设加速 |\n\n### 推荐机型\n| 品类 | 推荐型号 | 报价（万元） |\n|------|---------|------------|\n| 青储收获机 | CLAAS 850/860 | 60-120 |\n| 拖拉机 | NH/Deere 100-200HP | 30-80 |\n| 打捆机 | Krone 500/600 | 15-40 |\n| 大方捆 | BP1290/Krone | 68-100 |\n\n### 行动重点\n- 重点关注棉花采收及青储相关机型\n- 利用政府50%补贴设计融资方案\n- 中吉乌铁路建成后物流将更便捷`,
    detailedContentEn: `## Uzbekistan Market Continues to Surge\n\n### Core Data\n| Indicator | Value |\n|------|------|\n| Q1 import growth | **+256.77%** 🌍 Globally fastest |\n| Cotton harvesting mechanization | Below 40% |\n| Government subsidies | **50%** machinery purchase subsidy |\n| Logistics | China-Kyrgyzstan-Uzbekistan railway accelerating |\n\n### Recommended Models\n| Category | Recommended | Price (CNY 10K) |\n|------|---------|------------|\n| Forage harvester | CLAAS 850/860 | 60-120 |\n| Tractors | NH/Deere 100-200HP | 30-80 |\n| Balers | Krone 500/600 | 15-40 |\n| Large square baler | BP1290/Krone | 68-100 |\n\n### Action Focus\n- Focus on cotton harvesting and forage related models\n- Design financing using 50% government subsidy\n- Logistics will be more convenient after China-Kyrgyzstan-Uzbekistan railway completion`,
    detailedContentRu: `## Рынок Узбекистана продолжает бурный рост\n\n### Основные данные\n| Показатель | Значение |\n|------|------|\n| Рост импорта за Q1 | **+256.77%** 🌍 Самый быстрый в мире |\n| Механизация хлопкоуборки | Ниже 40% |\n| Госсубсидии | **50%** субсидия на покупку техники |\n| Логистика | Ж/д Китай-Кыргызстан-Узбекистан ускоряется |\n\n### Рекомендуемые модели\n| Категория | Рекомендация | Цена (10 тыс. юаней) |\n|------|---------|------------|\n| Силосоуборочные | CLAAS 850/860 | 60-120 |\n| Тракторы | NH/Deere 100-200 л.с. | 30-80 |\n| Пресс-подборщики | Krone 500/600 | 15-40 |\n| Большие пресс-подборщики | BP1290/Krone | 68-100 |\n\n### Основные действия\n- Акцент на модели для уборки хлопка и силоса\n- Разработать финансирование с использованием 50% господдержки\n- После ж/д Китай-Кыргызстан-Узбекистан логистика станет удобнее`,
    actionTips: ["乌兹别克语+俄语版产品手册优先制作", "棉花采收+青储机型重点推广", "利用50%政府补贴设计融资方案"],
    dataSummary: JSON.stringify([{ label: "乌兹别克增速", value: "+256.77%" }, { label: "机械化率", value: "<40%" }]),
  },
  {
    icon: "🌍", region: "全球", tags: ["操作建议", "8大优先"], date: TODAY,
    text: "今日8大操作优先：970俄语区(52.2%)→FR450速推(101.4%)→BP1290东欧(97.2%)→5300RC验证(336%)→950新标的(44.7%)→BigM 420→汇率监控→AGRO展",
    textEn: "Today's 8 priorities: 970 Russian region (52.2%) → FR450 quick push (101.4%) → BP1290 Eastern Europe (97.2%) → 5300RC verify (336%) → 950 new target (44.7%) → BigM 420 → FX monitor → AGRO exhibition",
    textRu: "8 приоритетов на сегодня: 970 русскоязычный регион (52.2%) → FR450 быстрый запуск (101.4%) → BP1290 Восточная Европа (97.2%) → 5300RC проверка (336%) → 950 новая цель (44.7%) → BigM 420 → мониторинг валют → выставка AGRO",
    regionEn: "Global", regionRu: "Глобально",
    tagsEn: '["Action Plan", "8 Priorities"]', tagsRu: '["План действий", "8 приоритетов"]',
    detailedContent: `## 今日8大操作优先级（基于2026-06-15日报）\n\n| 优先级 | 操作 | 价差/关键点 | 紧迫度 |\n|--------|------|------------|--------|\n| 1 | **970(2017)俄语区推进** | 52.2%价差(85.1万) | 🔴 最急 |\n| 2 | **FR450爆款速推10台** | 101.4%价差(21.8万/台) | 🔴 最急 |\n| 3 | **BP1290(2020)东欧推量** 🆕 | 97.2%价差(66.1万) | 🔴 最急 |\n| 4 | **5300RC(2020)确认车况** | 336.1%最高价差 | 🟡 高 |\n| 5 | **950(2018)新机会** 🆕 | 44.7%价差(42.5万) | 🟡 高 |\n| 6 | **BigM 420东欧推进** | 60.4%价差(29.6万) | 🟡 高 |\n| 7 | **📊 关注EUR/CNY走势** | 7.8555若突破7.90需对冲 | 🟡 高 |\n| 8 | **AGRO 2026展对接** | 7月基辅 | 🟢 中 |\n\n### 关键时间节点\n- 🟢 EUR/CNY 7.8555反弹→套利窗口最稳\n- 🗓️ 7月：AGRO 2026乌克兰展\n- 📈 990系列€349.6K-€529K全球在售=高端需求标杆`,
    detailedContentEn: `## Today's 8 Action Priorities (Based on 2026-06-15 Report)\n\n| Priority | Action | Spread/Key Point | Urgency |\n|--------|------|------------|--------|\n| 1 | **970(2017) Russian region push** | 52.2% spread (CNY 851K) | 🔴 Most urgent |\n| 2 | **FR450 hot seller 10 units** | 101.4% spread (CNY 218K/unit) | 🔴 Most urgent |\n| 3 | **BP1290(2020) Eastern Europe volume** 🆕 | 97.2% spread (CNY 661K) | 🔴 Most urgent |\n| 4 | **5300RC(2020) verify condition** | 336.1% highest spread | 🟡 High |\n| 5 | **950(2018) new opportunity** 🆕 | 44.7% spread (CNY 425K) | 🟡 High |\n| 6 | **BigM 420 Eastern Europe push** | 60.4% spread (CNY 296K) | 🟡 High |\n| 7 | **📊 Monitor EUR/CNY trend** | 7.8555, hedge if breaks 7.90 | 🟡 High |\n| 8 | **AGRO 2026 exhibition** | July, Kyiv | 🟢 Medium |\n\n### Key Milestones\n- 🟢 EUR/CNY 7.8555 rebound → arbitrage window most stable\n- 🗓️ July: AGRO 2026 Ukraine exhibition\n- 📈 990 series €349.6K-€529K global sales = high-end demand benchmark`,
    detailedContentRu: `## 8 приоритетов действий на сегодня (на основе отчёта от 15.06.2026)\n\n| Приоритет | Действие | Разница/Ключевой момент | Срочность |\n|--------|------|------------|--------|\n| 1 | **970(2017) продвижение в русскоязычный регион** | 52.2% разница (851 тыс.) | 🔴 Самое срочное |\n| 2 | **FR450 хит продаж 10 ед.** | 101.4% разница (218 тыс./ед.) | 🔴 Самое срочное |\n| 3 | **BP1290(2020) Восточная Европа объём** 🆕 | 97.2% разница (661 тыс.) | 🔴 Самое срочное |\n| 4 | **5300RC(2020) проверка состояния** | 336.1% самая высокая | 🟡 Высокая |\n| 5 | **950(2018) новая возможность** 🆕 | 44.7% разница (425 тыс.) | 🟡 Высокая |\n| 6 | **BigM 420 Восточная Европа** | 60.4% разница (296 тыс.) | 🟡 Высокая |\n| 7 | **📊 Мониторинг EUR/CNY** | 7.8555, хедж при пробое 7.90 | 🟡 Высокая |\n| 8 | **Выставка AGRO 2026** | Июль, Киев | 🟢 Средняя |\n\n### Ключевые вехи\n- 🟢 EUR/CNY 7.8555 отскок → самое стабильное арбитражное окно\n- 🗓️ Июль: выставка AGRO 2026 Украина\n- 📈 Серия 990 €349.6K-€529K глобальные продажи = ориентир высококлассного спроса`,
    actionTips: ["970俄语区+FR450爆款+BP1290东欧三线并行", "5300RC(2020)优先确认车况决定是否推", "若EUR/CNY突破7.90启动汇率对冲"],
    dataSummary: JSON.stringify([{ label: "核心汇率", value: "EUR/CNY 7.8555" }, { label: "操作数", value: "8大优先" }]),
  },
  {
    icon: "🇧🇷", region: "巴西", tags: ["5300RC", "进口替代"], date: TODAY,
    text: "巴西Q1销量-13.1%但进口替代加速！5300RC(95万全新)核心受益，51.9%价差空间，14%关税需提前审批",
    textEn: "Brazil Q1 sales -13.1% but import substitution accelerating! 5300RC (CNY 950K brand new) core beneficiary, 51.9% spread space, 14% tariff requires advance approval",
    textRu: "Продажи в Бразилии Q1 -13.1%, но импортозамещение ускоряется! 5300RC (950 тыс. юаней новый) — основной бенефициар, разница 51.9%, пошлина 14% требует предварительного одобрения",
    regionEn: "Brazil", regionRu: "Бразилия",
    tagsEn: '["5300RC", "Import Substitution"]', tagsRu: '["5300RC", "Импортозамещение"]',
    detailedContent: `## 巴西农机市场更新\n\n### 市场现状\n| 指标 | 数值 |\n|------|------|\n| Q1销量增速 | **-13.1%**（整体市场承压） |\n| 进口替代 | **加速中** 🔥 |\n| 5300RC国内价 | **95万（全新）** |\n| 国际同级参考 | €185K（144.3万） |\n| 价差率 | 51.9%（按7.8555汇率） |\n| 关税 | **14%+MAP审批流程** |\n\n### 5300RC巴西机会\n- 全新大方捆(95万)→巴西市场核心标的\n- 14%关税需提前完成审批\n- 巴西青储/牧草市场需求旺盛\n- 建议制作葡萄牙语产品手册\n- Q1销量下滑但进口替代=中国设备机会`,
    detailedContentEn: `## Brazil Agricultural Machinery Market Update\n\n### Market Status\n| Indicator | Value |\n|------|------|\n| Q1 sales growth | **-13.1%** (market under pressure) |\n| Import substitution | **Accelerating** 🔥 |\n| 5300RC domestic price | **CNY 950K (brand new)** |\n| International reference | €185K (CNY 1.443M) |\n| Spread rate | 51.9% (at 7.8555 FX) |\n| Tariff | **14% + MAPA approval** |\n\n### 5300RC Brazil Opportunity\n- Brand new large square baler (CNY 950K) → core target for Brazil\n- 14% tariff requires advance approval\n- Brazil forage/pasture market demand strong\n- Recommend Portuguese product manual\n- Q1 sales decline but import substitution = Chinese equipment opportunity`,
    detailedContentRu: `## Обновление рынка сельхозтехники Бразилии\n\n### Состояние рынка\n| Показатель | Значение |\n|------|------|\n| Рост продаж Q1 | **-13.1%** (рынок под давлением) |\n| Импортозамещение | **Ускоряется** 🔥 |\n| 5300RC внутренняя цена | **950 тыс. юаней (новый)** |\n| Международная справочная | €185K (1.443 млн юаней) |\n| Ставка разницы | 51.9% (по курсу 7.8555) |\n| Пошлина | **14% + одобрение MAPA** |\n\n### Возможности 5300RC в Бразилии\n- Новый большой пресс-подборщик (950 тыс.) → основная цель для Бразилии\n- 14% пошлина требует предварительного одобрения\n- Высокий спрос на кормовую/пастбищную технику\n- Рекомендуется руководство на португальском языке\n- Спад продаж Q1, но импортозамещение = возможность для китайского оборудования`,
    actionTips: ["5300RC巴西市场需提前完成MAP审批+14%关税准备", "制作葡萄牙语产品手册", "5300RC+BP1290巴西组合推广"],
    dataSummary: JSON.stringify([{ label: "5300RC价差", value: "51.9%" }, { label: "巴西关税", value: "14%" }]),
  },
  {
    icon: "🌏", region: "东南亚", tags: ["印尼爆发", "+121%"], date: TODAY,
    text: "印尼农机进口+121.07%爆发式增长！肯尼亚+46.6%，东南亚+非洲双引擎驱动全球农机需求",
    textEn: "Indonesia agricultural machinery imports +121.07% explosive growth! Kenya +46.6%, Southeast Asia + Africa dual engines driving global agri machinery demand",
    textRu: "Импорт сельхозтехники в Индонезию +121.07% взрывной рост! Кения +46.6%, Юго-Восточная Азия + Африка — двойные двигатели глобального спроса на сельхозтехнику",
    regionEn: "Southeast Asia", regionRu: "Юго-Восточная Азия",
    tagsEn: '["Indonesia Surge", "+121%"]', tagsRu: '["Взрывной рост Индонезии", "+121%"]',
    detailedContent: `## 东南亚+非洲双引擎市场\n\n### 区域增速对比\n| 区域 | 国家 | 增速 | 核心需求 |\n|------|------|------|--------|\n| 🌏 东南亚 | 🇮🇩 印尼 | **+121.07%** | 微耕机/小型收割机 |\n| 🌍 非洲 | 🇰🇪 肯尼亚 | **+46.6%** | 50-100HP拖拉机 |\n| 🌏 东南亚 | 🇹🇭 泰国 | 中速 | 插秧机/收割机 |\n| 🌍 非洲 | 🇳🇬 尼日利亚 | 快速 | 中型拖拉机 |\n\n### 神雕机会\n- 印尼+121.07%为全球增速前三\n- 肯尼亚+46.6%非洲需求持续释放\n- 中国二手农机=欧洲新品20-30%价格\n- 小型农机+50-100HP拖拉机为核心需求`,
    detailedContentEn: `## Southeast Asia + Africa Dual Engine Markets\n\n### Regional Growth Comparison\n| Region | Country | Growth | Core Demand |\n|------|------|------|--------|\n| 🌏 SE Asia | 🇮🇩 Indonesia | **+121.07%** | Mini tillers / Small harvesters |\n| 🌍 Africa | 🇰🇪 Kenya | **+46.6%** | 50-100HP tractors |\n| 🌏 SE Asia | 🇹🇭 Thailand | Moderate | Rice transplanters / Harvesters |\n| 🌍 Africa | 🇳🇬 Nigeria | Fast | Medium tractors |\n\n### Shendiao Opportunity\n- Indonesia +121.07% ranks among top 3 globally\n- Kenya +46.6% Africa demand continues to be released\n- Chinese used machinery = 20-30% of European new prices\n- Small machinery + 50-100HP tractors are core demand`,
    detailedContentRu: `## Двухдвигательные рынки Юго-Восточной Азии + Африки\n\n### Сравнение регионального роста\n| Регион | Страна | Рост | Основной спрос |\n|------|------|------|--------|\n| 🌏 ЮВА | 🇮🇩 Индонезия | **+121.07%** | Мотоблоки / Малые комбайны |\n| 🌍 Африка | 🇰🇪 Кения | **+46.6%** | Тракторы 50-100 л.с. |\n| 🌏 ЮВА | 🇹🇭 Таиланд | Умеренный | Рассадопосадочные / Комбайны |\n| 🌍 Африка | 🇳🇬 Нигерия | Быстрый | Средние тракторы |\n\n### Возможности Шэньдяо\n- Индонезия +121.07% — в топ-3 в мире\n- Кения +46.6% — спрос в Африке продолжает расти\n- Китайская б/у техника = 20-30% цены новой европейской\n- Малая техника + тракторы 50-100 л.с. — основной спрос`,
    actionTips: ["东南亚主推印尼市场小型农机", "非洲重点肯尼亚+尼日利亚50-100HP拖拉机", "利用价格优势（欧洲新品20-30%）抢占市场"],
    dataSummary: JSON.stringify([{ label: "印尼增速", value: "+121.07%" }, { label: "肯尼亚增速", value: "+46.6%" }]),
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
        dataSummary: item.dataSummary ? item.dataSummary : null,
        actionTips: item.actionTips ? JSON.stringify(item.actionTips) : null,
        sortOrder: i,
      },
    });
  }
  console.log(`已导入 ${ALL_MARKET_INTEL.length} 条情报数据 (日期: 2026-06-16)`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
