/**
 * 导入2026-06-17市场情报数据到数据库
 * 基于 2026-06-17_跨境套利日报.md 生成
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const TODAY = new Date("2026-06-17");

const ALL_MARKET_INTEL = [
  // ========== 🔥 5070 永久头条 (sortOrder=0) ==========
  {
    icon: "🔥", region: "中国", tags: ["爆款", "5070小方捆", "12台库存"], date: TODAY,
    text: "纽荷兰5070小方捆·12台库存爆款！¥3.4万/台，海外$7,000+，利润58.8%，小方捆打捆机全球需求旺盛",
    textEn: "New Holland 5070 Small Square Baler·12 units! ¥34K/unit, overseas $7K+, 58.8% margin, global demand strong",
    textRu: "New Holland 5070 Малый тюковый пресс·12 ед! ¥34K/ед, зарубеж $7K+, 58.8% маржа, глобальный спрос высок",
    regionEn: "China", regionRu: "Китай",
    tagsEn: '["Hot Deal", "5070 Baler", "12 Units"]', tagsRu: '["Хит", "5070 Пресс", "12 ед."]',
    detailedContent: `## 🔥 纽荷兰5070小方捆 — 永久头条爆款\n\n**核心卖点：** 12台库存批量出口首选！国内¥3.4万/台，海外参考价$7,000+，单台利润58.8%\n\n### 价差分析\n| 指标 | 数值 |\n|------|------|\n| 国内售价 | **¥34,000/台** |\n| 海外参考价 | **$7,000+** |\n| 利润率 | **58.8%** |\n| 库存 | **12台** |\n| 单台利润 | ¥1.6-2.7万 |\n| 总利润空间 | **¥19-32万** |\n\n### 五大爆款理由\n1. **全球刚需**：小方捆打捆机为中小型农场基础设备，非洲、东南亚、拉美需求旺盛\n2. **批量优势**：12台一致性好，可整柜发货降低物流成本\n3. **品牌溢价**：New Holland国际知名度高，在俄语区/中亚/非洲认可度极高\n4. **低门槛走量**：¥3.4万单价低，买家决策快，适合走量模式\n5. **价格优势**：比欧洲同类便宜40%+，比北美便宜30%+\n\n### 推广策略\n| 区域 | 策略 | 优先级 |\n|------|------|--------|\n| 🌍 非洲 | Facebook农机群组+WhatsApp直推 | 🔴 最高 |\n| 🌏 东南亚 | 对接当地经销商批量拿货 | 🔴 最高 |\n| 🌏 中亚 | 哈萨克斯坦+乌兹别克斯坦直推 | 🔴 最高 |\n| 🌍 南美 | 巴西/阿根廷中小农场需求 | 🟡 高 |\n\n### 报价方案\n- **FOB天津/青岛**：提供完整出口报关+海运一站式服务\n- **批量折扣**：12台整批采购享额外优惠\n- **配件包**：可配易损件包提升竞争力`,
    detailedContentEn: `## 🔥 New Holland 5070 Small Square Baler — Permanent Headline\n\n**Core Selling Point:** 12 units bulk export! Domestic ¥34K/unit, overseas reference $7,000+, 58.8% margin per unit\n\n### Price Spread Analysis\n| Indicator | Value |\n|------|------|\n| Domestic price | **¥34,000/unit** |\n| Overseas reference | **$7,000+** |\n| Profit margin | **58.8%** |\n| Inventory | **12 units** |\n| Profit per unit | ¥16K-27K |\n| Total profit | **¥190K-320K** |\n\n### Five Hot Seller Reasons\n1. **Global demand**: Small square balers are essential for medium/small farms, high demand in Africa, SE Asia, Latin America\n2. **Batch advantage**: 12 identical units reduce logistics cost\n3. **Brand premium**: New Holland globally recognized, especially in Russian-speaking regions/Central Asia/Africa\n4. **Low barrier**: ¥34K low unit price, fast buyer decisions\n5. **Price advantage**: 40%+ cheaper than European equivalents, 30%+ cheaper than North America\n\n### Promotion Strategy\n| Region | Strategy | Priority |\n|------|------|--------|\n| 🌍 Africa | Facebook agri groups + WhatsApp direct | 🔴 Highest |\n| 🌏 SE Asia | Local dealer bulk orders | 🔴 Highest |\n| 🌏 Central Asia | Kazakhstan + Uzbekistan direct push | 🔴 Highest |\n| 🌍 South America | Brazil/Argentina small farm demand | 🟡 High |`,
    detailedContentRu: `## 🔥 New Holland 5070 Малый тюковый пресс — Постоянный заголовок\n\n**Основное преимущество:** 12 ед. для массового экспорта! Внутренняя ¥34K/ед., зарубежная $7,000+, 58.8% прибыли\n\n### Анализ цен\n| Показатель | Значение |\n|------|------|\n| Внутренняя цена | **¥34,000/ед.** |\n| Зарубежная справочная | **$7,000+** |\n| Маржа прибыли | **58.8%** |\n| Остаток | **12 ед.** |\n| Прибыль на ед. | ¥16K-27K |\n| Общая прибыль | **¥190K-320K** |\n\n### Пять причин хита продаж\n1. **Глобальный спрос**: Малые тюковые прессы необходимы для средних/малых ферм\n2. **Преимущество партии**: 12 одинаковых ед. снижают логистические расходы\n3. **Премиум бренда**: New Holland всемирно известен\n4. **Низкий порог**: ¥34K — быстрые решения покупателя\n5. **Ценовое преимущество**: На 40%+ дешевле европейских аналогов`,
    actionTips: ["优先打包12台5070批量出口", "制作英文/俄文/法文5070产品单页", "Facebook农机群组重点推广", "对接非洲/东南亚经销商批量拿货", "可提供FOB天津/青岛报价"],
    dataSummary: JSON.stringify([{ label: "国内售价", value: "¥3.4万/台" }, { label: "海外参考", value: "$7,000+" }, { label: "利润率", value: "58.8%" }, { label: "库存", value: "12台" }, { label: "总利润空间", value: "¥19-32万" }]),
  },

  // ========== sortOrder=1 汇率 ==========
  {
    icon: "💶", region: "欧洲", tags: ["汇率", "欧元回升"], date: TODAY,
    text: "EUR/CNY 7.8480小幅回升+0.18%！从7.8340反弹重回7.84上方，套利空间微扩，出口定价保持乐观",
    textEn: "EUR/CNY 7.8480 slightly up +0.18%! Rebounded from 7.8340 back above 7.84, arbitrage space slightly expanded, export pricing remains optimistic",
    textRu: "EUR/CNY 7.8480 незначительно вырос +0.18%! Отскочил с 7.8340 обратно выше 7.84, арбитражное пространство немного расширилось, ценообразование экспорта остается оптимистичным",
    regionEn: "Europe", regionRu: "Европа",
    tagsEn: '["FX", "Euro Rebound"]', tagsRu: '["Валютный курс", "Отскок евро"]',
    detailedContent: `## EUR/CNY 7.8480 汇率快报（2026-06-17）\n\n**核心数据：** EUR/CNY中行折算价7.8480，较6月16日7.8340反弹+0.18%。USD/CNY 6.7583基本持平。\n\n| 货币对 | 中行折算价 | 现汇买入价 | 现汇卖出价 | 日环比 |\n|--------|-----------|-----------|-----------|--------|\n| EUR/CNY | **7.8480** | 780.30 | 785.60 | **+0.18%** |\n| USD/CNY | **6.7583** | 672.50 | 676.00 | **-0.01%** |\n| EUR/RUB | **84.18** | — | — | 基本持平 |\n\n### 汇率走势分析\n- 近两周EUR/CNY在7.82-7.86区间窄幅震荡\n- 6月17日单日+0.18%，当前处于区间中上沿\n- 美元基本持平（USD/CNY 6.7583）\n- **关键信号：欧元小幅回升利好套利空间。若突破7.90则全面利好出口定价**\n- EUR/RUB 84.18稳定，俄罗斯市场汇率稳定`,
    detailedContentEn: `## EUR/CNY 7.8480 FX Flash Report (2026-06-17)\n\n**Core Data:** EUR/CNY PBOC midpoint 7.8480, up +0.18% from Jun 16's 7.8340. USD/CNY 6.7583 flat.\n\n| Pair | PBOC Midpoint | Buying | Selling | Daily Change |\n|--------|-----------|-----------|-----------|--------|\n| EUR/CNY | **7.8480** | 780.30 | 785.60 | **+0.18%** |\n| USD/CNY | **6.7583** | 672.50 | 676.00 | **-0.01%** |\n| EUR/RUB | **84.18** | — | — | Flat |\n\n### FX Trend Analysis\n- Two-week range: 7.82-7.86 narrow fluctuation\n- Jun 17 +0.18%, currently in upper-mid of range\n- USD flat (USD/CNY 6.7583)\n- **Key signal: EUR rebounding benefits arbitrage. If breaks 7.90, fully bullish for export pricing**`,
    detailedContentRu: `## EUR/CNY 7.8480 Валютный отчёт (17.06.2026)\n\n**Основные данные:** Средний курс НБК EUR/CNY 7.8480, рост +0.18% с 7.8340 от 16 июня. USD/CNY 6.7583 без изменений.\n\n| Пара | Средний НБК | Покупка | Продажа | Дневное изменение |\n|--------|-----------|-----------|-----------|--------|\n| EUR/CNY | **7.8480** | 780.30 | 785.60 | **+0.18%** |\n| USD/CNY | **6.7583** | 672.50 | 676.00 | **-0.01%** |\n| EUR/RUB | **84.18** | — | — | Стабильно |`,
    actionTips: ["EUR/CNY反弹至7.8480=套利空间微扩，合同可加速锁定", "若汇率突破7.90启动汇率对冲", "出口报价利用反弹窗口保持乐观定价"],
    dataSummary: JSON.stringify([{ label: "EUR/CNY", value: "7.8480(+0.18%)" }, { label: "USD/CNY", value: "6.7583(-0.01%)" }]),
  },

  // ========== sortOrder=2 5300RC 335.6% ==========
  {
    icon: "🏆", region: "中国", tags: ["5300RC", "336%价差"], date: TODAY,
    text: "CLAAS 5300RC(2020) 18万元白菜价！国际€99,900→78.4万，价差60.4万，335.6%全品类第一！汇率微升",
    textEn: "CLAAS 5300RC(2020) bargain at CNY 180K! International €99,900→CNY 784K, spread CNY 604K, 335.6% highest across all categories! FX slightly up",
    textRu: "CLAAS 5300RC(2020) по бросовой цене 180 тыс. юаней! Международная €99,900→784 тыс. юаней, разница 604 тыс., 335.6% — самая высокая среди всех категорий!",
    regionEn: "China", regionRu: "Китай",
    tagsEn: '["5300RC", "336% Spread"]', tagsRu: '["5300RC", "336% разница"]',
    detailedContent: `## CLAAS 5300RC(2020) 335.6% 套利分析\n\n**核心标的：** CLAAS Quadrant 5300 FC (2020)，国内仅18万元，国际€99,900(德国博克尔)→78.4万元(@7.8480)\n\n### 套利详情\n| 指标 | 数值 |\n|------|------|\n| 国内售价 | **18万元** |\n| 国际参考价 | €99,900（德国博克尔）→ **78.4万元** |\n| 价差 | **60.4万元** |\n| 价差率 | **335.6%** ⭐⭐⭐⭐⭐ |\n| 汇率 | EUR/CNY 7.8480（较6月16日7.8340回升） |\n| 排名 | 全品类第一 |\n\n### 与6月16日对比\n| 指标 | 6月16日 | 6月17日 | 变化 |\n|------|--------|--------|------|\n| EUR/CNY | 7.8340 | **7.8480** | +0.18% |\n| 国际人民币价 | 78.2万 | **78.4万** | +0.2万 |\n| 价差率 | 334.4% | **335.6%** | +1.2pp |\n\n### ⚠️ 需确认事项\n1. 18万低价是否对应正常车况？需实车验证\n2. 出口手续是否齐全\n3. 5300系列Agroline 33条在售，€68,000起，供给充裕`,
    detailedContentEn: `## CLAAS 5300RC(2020) 335.6% Arbitrage Analysis\n\n**Core Target:** CLAAS Quadrant 5300 FC (2020), domestic only CNY 180K, international €99,900 (Böckel, Germany)→CNY 784K (@7.8480)\n\n### Arbitrage Details\n| Indicator | Value |\n|------|------|\n| Domestic price | **CNY 180K** |\n| International reference | €99,900 (Böckel, Germany) → **CNY 784K** |\n| Spread | **CNY 604K** |\n| Spread rate | **335.6%** ⭐⭐⭐⭐⭐ |\n| FX rate | EUR/CNY 7.8480 |\n| Ranking | #1 across all categories |`,
    detailedContentRu: `## CLAAS 5300RC(2020) 335.6% Арбитражный анализ\n\n**Основная цель:** CLAAS Quadrant 5300 FC (2020), внутренняя цена всего 180 тыс. юаней, международная €99,900 (Бёкель, Германия)→784 тыс. юаней (@7.8480)\n\n### Детали арбитража\n| Показатель | Значение |\n|------|------|\n| Внутренняя цена | **180 тыс. юаней** |\n| Международная справочная | €99,900 → **784 тыс. юаней** |\n| Разница | **604 тыс. юаней** |\n| Ставка разницы | **335.6%** ⭐⭐⭐⭐⭐ |\n| Рейтинг | №1 среди всех категорий |`,
    actionTips: ["5300RC(2020)优先确认车况和出口手续", "如车况良好立即启动俄语区+中亚营销", "336%价差可作为全站引流爆款"],
    dataSummary: JSON.stringify([{ label: "5300RC价差", value: "335.6%" }, { label: "国内售价", value: "18万元" }, { label: "利润空间", value: "60.4万" }]),
  },

  // ========== sortOrder=3 FR450 101.4% ==========
  {
    icon: "🇨🇳", region: "中国", tags: ["FR450", "101.4%价差"], date: TODAY,
    text: "New Holland FR450(2013) 21.5万/台+101.4%价差率！10台库存走量爆款，汇率反弹利好出口定价",
    textEn: "New Holland FR450(2013) CNY 215K/unit + 101.4% spread rate! 10 units in stock volume seller, FX rebound benefits export pricing",
    textRu: "New Holland FR450(2013) 215 тыс. юаней/ед. + 101.4% разница! 10 ед. на складе — хит продаж, отскок валюты улучшает экспортное ценообразование",
    regionEn: "China", regionRu: "Китай",
    tagsEn: '["FR450", "101.4% Spread"]', tagsRu: '["FR450", "101.4% разница"]',
    detailedContent: `## FR450爆款速推（持续推荐）\n\n**核心优势：** 一口价21.5万/台 + 101.4%价差率 + 10台库存 + 汇率反弹利好\n\n### FR450套利分析（6月17日更新）\n| 指标 | 数值 |\n|------|------|\n| 国内售价 | **21.5万/台** |\n| 俄市场参考价 | 43.3万 |\n| 价差 | 21.8万 |\n| 价差率 | **101.4%** ⭐⭐⭐⭐⭐ |\n| 库存 | **10台** |\n| 汇率 | EUR/CNY 7.8480 (6月17日) |\n\n### 为什么持续推荐？\n1. 101.4%价差率→翻倍利润，全品类第二\n2. 21.5万低门槛→买家决策快\n3. 10台库存→走量模式\n4. 汇率反弹6月17日+0.18%→出口定价信心增强`,
    detailedContentEn: `## FR450 Hot Seller Push (Continued)\n\n**Core Advantage:** Fixed price CNY 215K/unit + 101.4% spread rate + 10 units in stock + FX rebound boost\n\n### FR450 Arbitrage Analysis (Updated Jun 17)\n| Indicator | Value |\n|------|------|\n| Domestic price | **CNY 215K/unit** |\n| Russian market reference | CNY 433K |\n| Spread | CNY 218K |\n| Spread rate | **101.4%** ⭐⭐⭐⭐⭐ |\n| Inventory | **10 units** |\n| FX rate | EUR/CNY 7.8480 (Jun 17) |`,
    detailedContentRu: `## FR450 — хит продаж (продолжение)\n\n**Главное преимущество:** фиксированная цена 215 тыс. юаней/ед. + 101.4% разница + 10 ед. на складе + подъём валют\n\n### Арбитражный анализ FR450 (обновлено 17 июня)\n| Показатель | Значение |\n|------|------|\n| Внутренняя цена | **215 тыс. юаней/ед.** |\n| Справочная цена на рынке РФ | 433 тыс. юаней |\n| Разница | 218 тыс. юаней |\n| Ставка разницы | **101.4%** ⭐⭐⭐⭐⭐ |\n| Остаток на складе | **10 ед.** |`,
    actionTips: ["FR450 10台批量速推俄语区+中亚", "21.5万低门槛吸引小型买家", "汇率反弹窗口内加速签单"],
    dataSummary: JSON.stringify([{ label: "FR450价差", value: "101.4%" }, { label: "库存", value: "10台" }, { label: "单价", value: "21.5万" }]),
  },

  // ========== sortOrder=4 BP1290 97.1% ==========
  {
    icon: "🇨🇳", region: "中国", tags: ["BP1290", "97.1%价差"], date: TODAY,
    text: "Krone Big Pack 1290(2020)打捆机套利冠军！国际€170,765→134.0万 vs 国内68万，价差66.0万(97.1%)",
    textEn: "Krone Big Pack 1290(2020) baler arbitrage champion! International €170,765→CNY 1.34M vs domestic CNY 680K, spread CNY 660K (97.1%)",
    textRu: "Krone Big Pack 1290(2020) чемпион по арбитражу пресс-подборщиков! Международная €170,765→1.34 млн юаней vs внутренние 680 тыс., разница 660 тыс. (97.1%)",
    regionEn: "China", regionRu: "Китай",
    tagsEn: '["BP1290", "97.1% Spread"]', tagsRu: '["BP1290", "97.1% разница"]',
    detailedContent: `## Krone Big Pack 1290(2020) 打捆机套利冠军\n\n**核心标的：** Krone BiG Pack 1290 HDP VC 51 (2020)，国内68万元，国际€170,765(奥地利)→134.0万元(@7.8480)\n\n### 套利详情\n| 指标 | 数值 |\n|------|------|\n| 国内售价 | **68万元** |\n| 国际参考价 | €170,765（奥地利）→ **134.0万元** |\n| 价差 | **66.0万元** |\n| 价差率 | **97.1%** ⭐⭐⭐⭐⭐ |\n| 排名 | 打捆机品类第一，全品类第三 |\n\n### 市场环境\n- BP1290系列14条在售，价格€30,627-€222,171\n- 汇率7.8480较6月14日7.8294微升→价差率从94.6%升至97.1%\n- 俄语区打捆机刚需旺盛\n- Krone品牌在俄语区认知度极高`,
    detailedContentEn: `## Krone Big Pack 1290(2020) Baler Arbitrage Champion\n\n**Core Target:** Krone BiG Pack 1290 HDP VC 51 (2020), domestic CNY 680K, international €170,765 (Austria)→CNY 1.34M (@7.8480)\n\n### Arbitrage Details\n| Indicator | Value |\n|------|------|\n| Domestic price | **CNY 680K** |\n| International reference | €170,765 (Austria) → **CNY 1.34M** |\n| Spread | **CNY 660K** |\n| Spread rate | **97.1%** ⭐⭐⭐⭐⭐ |\n| Ranking | #1 in baler category, #3 overall |`,
    detailedContentRu: `## Krone Big Pack 1290(2020) Чемпион по арбитражу пресс-подборщиков\n\n**Основная цель:** Krone BiG Pack 1290 HDP VC 51 (2020), внутренняя цена 680 тыс. юаней, международная €170,765 (Австрия)→1.34 млн юаней (@7.8480)\n\n### Детали арбитража\n| Показатель | Значение |\n|------|------|\n| Внутренняя цена | **680 тыс. юаней** |\n| Международная справочная | €170,765 (Австрия)→**1.34 млн юаней** |\n| Разница | **660 тыс. юаней** |\n| Ставка разницы | **97.1%** ⭐⭐⭐⭐⭐ |`,
    actionTips: ["BP1290东欧优先量推，97.1%打捆机冠军", "Krone品牌优势+大口径适合大型农场", "结合BP1290系列14条在售数据做价格锚点"],
    dataSummary: JSON.stringify([{ label: "BP1290价差", value: "97.1%" }, { label: "价差利润", value: "66.0万" }, { label: "国内售价", value: "68万" }]),
  },

  // ========== sortOrder=5 980 73.1% ==========
  {
    icon: "🇨🇳", region: "中国", tags: ["980套利", "73.1%价差"], date: TODAY,
    text: "Jaguar 980(2016) 国际€316K→247.5万 vs 国内143万，价差104.5万(73.1%)，980(2024)×2台面议供给增加",
    textEn: "Jaguar 980(2016) International €316K→CNY 2.475M vs domestic CNY 1.43M, spread CNY 1.045M (73.1%), 980(2024)×2 units negotiable supply increasing",
    textRu: "Jaguar 980(2016) Международная €316K→2.475 млн юаней vs внутренние 1.43 млн, разница 1.045 млн (73.1%), 980(2024)×2 ед. договорная — предложение растёт",
    regionEn: "China", regionRu: "Китай",
    tagsEn: '["980 Arbitrage", "73.1% Spread"]', tagsRu: '["980 арбитраж", "73.1% разница"]',
    detailedContent: `## Jaguar 980(2016) 套利分析\n\n**核心标的：** CLAAS Jaguar 980 (2016)，国际€316K→247.5万元 vs 国内143万元\n\n### 980套利对比\n| 指标 | 数值 |\n|------|------|\n| 国际价 | €316,000（法国/德国）→ **247.5万元** |\n| 国内售价 | **143万元** |\n| 价差 | **104.5万元** |\n| 价差率 | **73.1%** ⭐⭐⭐⭐⭐ |\n\n### 980市场环境\n- 🆕 980(2025)€532,500天花板连续四期维持高位\n- 🆕 **980(2024 T4/E5)×2台面议**：德国兰茨贝格，1,287h和1,934h，980准新供给增加\n- 980(2014)€216,500→169.9万 vs 国内143万，价差26.9万(18.8%)\n- 买方议价空间扩大（面议机会）`,
    detailedContentEn: `## Jaguar 980(2016) Arbitrage Analysis\n\n**Core Target:** CLAAS Jaguar 980 (2016), international €316K→CNY 2.475M vs domestic CNY 1.43M\n\n### 980 Arbitrage Comparison\n| Indicator | Value |\n|------|------|\n| International price | €316,000 (France/Germany) → **CNY 2.475M** |\n| Domestic price | **CNY 1.43M** |\n| Spread | **CNY 1.045M** |\n| Spread rate | **73.1%** ⭐⭐⭐⭐⭐ |\n\n### 980 Market Environment\n- 🆕 980(2025)€532,500 ceiling maintained for 4 consecutive periods\n- 🆕 **980(2024 T4/E5)×2 units negotiable**: Landsberg, Germany, 1,287h & 1,934h`,
    detailedContentRu: `## Арбитражный анализ Jaguar 980(2016)\n\n**Основная цель:** CLAAS Jaguar 980 (2016), международная €316K→2.475 млн юаней vs внутренние 1.43 млн\n\n### Сравнение арбитража 980\n| Показатель | Значение |\n|------|------|\n| Международная цена | €316,000 (Франция/Германия) → **2.475 млн юаней** |\n| Внутренняя цена | **1.43 млн юаней** |\n| Разница | **1.045 млн юаней** |\n| Ставка разницы | **73.1%** ⭐⭐⭐⭐⭐ |`,
    actionTips: ["980(2016)持续优先推俄语区+乌克兰买家", "利用980(2024)×2台面议机会尝试主动报价", "73.1%为全系列套利王，重点成交标的"],
    dataSummary: JSON.stringify([{ label: "980价差", value: "104.5万(73.1%)" }, { label: "980(2024)", value: "2台面议" }]),
  },

  // ========== sortOrder=6 970 51.8% ==========
  {
    icon: "🇨🇳", region: "中国", tags: ["970套利", "51.8%稳定"], date: TODAY,
    text: "CLAAS Jaguar 970(2017) 国际€315,306→247.5万 vs 国内163万，价差84.5万(51.8%)，套利空间稳定",
    textEn: "CLAAS Jaguar 970(2017) International €315,306→CNY 2.475M vs domestic CNY 1.63M, spread CNY 845K (51.8%), stable arbitrage",
    textRu: "CLAAS Jaguar 970(2017) Международная €315,306→2.475 млн юаней vs внутренние 1.63 млн, разница 845 тыс. (51.8%), стабильный арбитраж",
    regionEn: "China", regionRu: "Китай",
    tagsEn: '["970 Arbitrage", "51.8% Stable"]', tagsRu: '["970 арбитраж", "51.8% стабильно"]',
    detailedContent: `## CLAAS Jaguar 970(2017) 稳定套利分析\n\n**核心标的：** CLAAS Jaguar 970 (2017)，国内163万，国际970(2019)€315,306→247.5万\n\n### 🆕 970系列关键更新（vs 6月16日）\n| 新增 | 年份 | 价格 | 备注 |\n|------|------|------|------|\n| 🆕 | 970 **2025** | **≈€500K→392.4万** | 579h波兰，970最新年款首次出现！ |\n| 🆕 | 970 **2024**(870h) | **£284,371→258.1万** | 德国准新低工时，性价比极高 |\n| 🆕 | 970 **2023**(1101h) | **£475,393→431.4万** | 970系列价格天花板 |\n| 🆕 | 970 **2021**(1706h) | **£293,879→266.7万** | 法国索姆新上架 |\n| 🆕 | 970 **2009** | **£56,183→51.0万** | 970系列地板价 |\n| 🆕 | 970 2011双发494 | **£83,530→75.9万** | 双发动机版本 |\n\n### 套利分析\n| 指标 | 数值 |\n|------|------|\n| 国内售价 | **163万元** |\n| 对标国际价 | €315,306 → **247.5万元** |\n| 价差 | **84.5万元** |\n| 价差率 | **51.8%** ⭐⭐⭐⭐⭐ |`,
    detailedContentEn: `## CLAAS Jaguar 970(2017) Stable Arbitrage Analysis\n\n**Core Target:** CLAAS Jaguar 970 (2017), domestic CNY 1.63M, international 970(2019)€315,306→CNY 2.475M\n\n### 🆕 970 Series Key Updates (vs Jun 16)\n| New | Year | Price | Notes |\n|------|------|------|------|\n| 🆕 | 970 **2025** | **≈€500K→CNY 3.924M** | 579h Poland, first-ever 2025 model! |\n| 🆕 | 970 **2024**(870h) | **£284,371→CNY 2.581M** | Germany nearly new low hours |\n| 🆕 | 970 **2023**(1101h) | **£475,393→CNY 4.314M** | 970 series price ceiling |\n| 🆕 | 970 **2009** | **£56,183→CNY 510K** | 970 series floor price |`,
    detailedContentRu: `## CLAAS Jaguar 970(2017) Стабильный арбитражный анализ\n\n**Основная цель:** CLAAS Jaguar 970 (2017), внутренняя 1.63 млн, международная 970(2019)€315,306→2.475 млн\n\n### 🆕 Ключевые обновления серии 970\n| Новое | Год | Цена | Примечания |\n|------|------|------|------|\n| 🆕 | 970 **2025** | **≈€500K→3.924 млн** | 579ч Польша, впервые! |\n| 🆕 | 970 **2024**(870ч) | **£284,371→2.581 млн** | Почти новый |\n| 🆕 | 970 **2009** | **£56,183→510 тыс.** | Минимальная цена 970 |`,
    actionTips: ["970(2017)稳定套利51.8%，俄语区刚需机型首选", "关注970(2024,870h)准新低价258.1万，潜在58.6%价差率", "利用970(2025)€500K高价锚点突出性价比"],
    dataSummary: JSON.stringify([{ label: "970价差", value: "84.5万(51.8%)" }, { label: "970新增", value: "6条新数据" }]),
  },

  // ========== sortOrder=7 970(2025)首次出现 ==========
  {
    icon: "🆕", region: "欧洲", tags: ["970(2025)", "首次出现"], date: TODAY,
    text: "🚀 970(2025)首次出现在售！579h波兰≈€500K→392.4万，970最新年款进入二手市场，高端需求信号",
    textEn: "🚀 970(2025) appears for the first time! 579h Poland ≈€500K→CNY 3.924M, newest 970 model enters used market, high-end demand signal",
    textRu: "🚀 970(2025) появляется впервые! 579ч Польша ≈€500K→3.924 млн, новейшая модель 970 выходит на рынок подержанной техники, сигнал высокого спроса",
    regionEn: "Europe", regionRu: "Европа",
    tagsEn: '["970(2025)", "First Appearance"]', tagsRu: '["970(2025)", "Первое появление"]',
    detailedContent: `## 🚀 970(2025)首次出现在售 — 重大信号\n\n### 核心信息\n| 指标 | 数值 |\n|------|------|\n| 型号 | CLAAS Jaguar 970 |\n| 年份 | **2025** |\n| 价格 | ≈€500,000（2,150,000 PLN） |\n| 折合人民币 | **392.4万元** (@7.8480) |\n| 工时 | **579h** — 极低 |\n| 所在地 | 波兰克热扎努夫 |\n\n### 市场意义\n1. 970最新年款（2025款）首次进入二手市场 → 新一代970流通加速\n2. €500K≈392.4万为970系列中高价位，反映新机价值\n3. 对比国内163万(2017款)，**价差潜力229.4万(140.7%)**\n4. 若能获取同款渠道→利润空间巨大\n5. 579h仅相当于约1个作业季的使用量\n\n### ⚠️ 注意\n- 2025年仅1条数据，样本量不足\n- €500K为波兰兹罗提折算价，需更多数据验证\n- 不代表神雕有2025款库存，仅市场情报参考`,
    detailedContentEn: `## 🚀 970(2025) First Appearance on Market — Major Signal\n\n### Core Info\n| Indicator | Value |\n|------|------|\n| Model | CLAAS Jaguar 970 |\n| Year | **2025** |\n| Price | ≈€500,000 (2,150,000 PLN) |\n| Converted CNY | **CNY 3.924M** (@7.8480) |\n| Hours | **579h** — very low |\n| Location | Krzyżanów, Poland |\n\n### Market Significance\n1. Newest 970 model (2025) enters used market for the first time\n2. €500K≈CNY 3.924M reflects new machine value\n3. vs domestic 2017 model CNY 1.63M, potential spread CNY 2.294M (140.7%)\n4. Getting access to same model channel → massive profit potential`,
    detailedContentRu: `## 🚀 970(2025) Впервые появляется на рынке — Важный сигнал\n\n### Основная информация\n| Показатель | Значение |\n|------|------|\n| Модель | CLAAS Jaguar 970 |\n| Год | **2025** |\n| Цена | ≈€500,000 (2,150,000 PLN) |\n| Конвертация | **3.924 млн юаней** (@7.8480) |\n| Моточасы | **579ч** — очень мало |\n| Расположение | Кшижанув, Польша |`,
    actionTips: ["关注970(2025)采购渠道，若能同款渠道利润巨大", "利用€500K作为970系列价格锚点提升库存价值感", "持续监测970(2025)在售数量变化趋势"],
    dataSummary: JSON.stringify([{ label: "970(2025)价格", value: "€500K→392.4万" }, { label: "工时", value: "579h" }, { label: "所在地", value: "波兰" }]),
  },

  // ========== sortOrder=8 BigM 420 60.2% ==========
  {
    icon: "🇨🇳", region: "中国", tags: ["BigM 420", "60.2%价差"], date: TODAY,
    text: "Krone BigM 420(2018) 国际€100K→78.5万 vs 国内49万，价差29.5万(60.2%)，Krone品牌+东欧刚需",
    textEn: "Krone BigM 420(2018) International €100K→CNY 785K vs domestic CNY 490K, spread CNY 295K (60.2%), Krone brand + Eastern Europe demand",
    textRu: "Krone BigM 420(2018) Международная €100K→785 тыс. юаней vs внутренние 490 тыс., разница 295 тыс. (60.2%), бренд Krone + спрос Восточной Европы",
    regionEn: "China", regionRu: "Китай",
    tagsEn: '["BigM 420", "60.2% Spread"]', tagsRu: '["BigM 420", "60.2% разница"]',
    detailedContent: `## Krone BigM 420(2018) 套利分析\n\n**核心标的：** Krone BigM 420 (2018)，国内49万元，国际€100K→78.5万元\n\n### 套利详情\n| 指标 | 数值 |\n|------|------|\n| 国内售价 | **49万元** |\n| 国际参考价 | €100,000→ **78.5万元** |\n| 价差 | **29.5万元** |\n| 价差率 | **60.2%** ⭐⭐⭐⭐⭐ |\n\n### 推广建议\n- Krone品牌在俄语区/东欧认知度极高\n- BigM 420为自走式割草机，适用于东欧大草原\n- 与BP1290组合推广效果更好`,
    detailedContentEn: `## Krone BigM 420(2018) Arbitrage Analysis\n\n**Core Target:** Krone BigM 420 (2018), domestic CNY 490K, international €100K→CNY 785K\n\n### Arbitrage Details\n| Indicator | Value |\n|------|------|\n| Domestic price | **CNY 490K** |\n| International reference | €100,000→ **CNY 785K** |\n| Spread | **CNY 295K** |\n| Spread rate | **60.2%** ⭐⭐⭐⭐⭐ |`,
    detailedContentRu: `## Krone BigM 420(2018) Арбитражный анализ\n\n**Основная цель:** Krone BigM 420 (2018), внутренняя цена 490 тыс. юаней, международная €100K→785 тыс. юаней\n\n### Детали арбитража\n| Показатель | Значение |\n|------|------|\n| Внутренняя цена | **490 тыс. юаней** |\n| Международная справочная | €100,000→**785 тыс. юаней** |\n| Разница | **295 тыс. юаней** |\n| Ставка разницы | **60.2%** ⭐⭐⭐⭐⭐ |`,
    actionTips: ["BigM 420东欧推进，60.2%价差+Krone品牌优势", "与BP1290组合推广提高客户黏性", "49万性价比突出，适合中型买家"],
    dataSummary: JSON.stringify([{ label: "BigM 420价差", value: "60.2%" }, { label: "价差利润", value: "29.5万" }]),
  },

  // ========== sortOrder=9 950 44.5% ==========
  {
    icon: "🆕", region: "中国", tags: ["950新机会", "44.5%"], date: TODAY,
    text: "CLAAS Jaguar 950(2018) 套利机会！国际€175K→137.3万 vs 国内95万，价差42.3万(44.5%)，中型机新方向",
    textEn: "CLAAS Jaguar 950(2018) arbitrage opportunity! International €175K→CNY 1.373M vs domestic CNY 950K, spread CNY 423K (44.5%), new mid-range direction",
    textRu: "CLAAS Jaguar 950(2018) арбитражная возможность! Международная €175K→1.373 млн юаней vs внутренние 950 тыс., разница 423 тыс. (44.5%)",
    regionEn: "China", regionRu: "Китай",
    tagsEn: '["950 New", "44.5% Spread"]', tagsRu: '["950 новый", "44.5% разница"]',
    detailedContent: `## CLAAS Jaguar 950(2018) 套利机会\n\n**核心标的：** CLAAS Jaguar 950 (2018)，国内95万元，国际€175,000(德国瓦尔堡)→137.3万元\n\n### 套利分析\n| 指标 | 数值 |\n|------|------|\n| 国内售价 | **95万元** |\n| 国际对标价 | €175,000 → **137.3万元** |\n| 价差 | **42.3万元** |\n| 价差率 | **44.5%** ⭐⭐⭐⭐ |\n\n### 950系列在售（Agroline 9条）\n| 年份 | 价格(EUR) | 换算人民币 | 所在地 |\n|------|-----------|-----------|--------|\n| 2021 | €330,136 | 259.1万 | 德国巴伐利亚 |\n| 2020 | €327,100 | 256.7万 | 德国汉堡 |\n| 2019 | €283,200 | 222.2万 | 德国汉堡 |\n| **2018对标** | **€175,000** | **137.3万** | **德国瓦尔堡** |\n\n### 为何值得关注\n- 950系列为970的次旗舰，中型农场刚需\n- Agroline 9条在售数据充分支撑定价\n- 中型机市场潜力大`,
    detailedContentEn: `## CLAAS Jaguar 950(2018) Arbitrage Opportunity\n\n**Core Target:** CLAAS Jaguar 950 (2018), domestic CNY 950K, international €175,000 (Warburg, Germany)→CNY 1.373M\n\n### Arbitrage Analysis\n| Indicator | Value |\n|------|------|\n| Domestic price | **CNY 950K** |\n| International benchmark | €175,000 → **CNY 1.373M** |\n| Spread | **CNY 423K** |\n| Spread rate | **44.5%** ⭐⭐⭐⭐ |`,
    detailedContentRu: `## CLAAS Jaguar 950(2018) Арбитражная возможность\n\n**Основная цель:** CLAAS Jaguar 950 (2018), внутренняя 950 тыс., международная €175,000 (Варбург)→1.373 млн\n\n### Арбитражный анализ\n| Показатель | Значение |\n|------|------|\n| Внутренняя цена | **950 тыс. юаней** |\n| Международный ориентир | €175,000 → **1.373 млн юаней** |\n| Разница | **423 тыс. юаней** |\n| Ставка разницы | **44.5%** ⭐⭐⭐⭐ |`,
    actionTips: ["950(2018)44.5%中型机新方向，适合中亚+非洲中型农场", "利用2023款€449K天花板做性价比锚点", "Agroline 9条在售数据充分支撑定价"],
    dataSummary: JSON.stringify([{ label: "950价差", value: "42.3万(44.5%)" }, { label: "950在售", value: "9条数据" }]),
  },

  // ========== sortOrder=10 俄罗斯 ==========
  {
    icon: "🇷🇺", region: "俄罗斯", tags: ["EU制裁", "替代窗口"], date: TODAY,
    text: "EU第20轮对俄制裁持续！配件断供加剧，俄2026农机第一优先产业，5%低关税+补贴窗口利好中国出口",
    textEn: "EU 20th round sanctions on Russia continue! Parts supply further disrupted, Russia agri #1 priority 2026, 5% low tariff + subsidy window benefits Chinese exports",
    textRu: "20-й раунд санкций ЕС против России продолжается! Перебои с запчастями нарастают, сельхозмашиностроение приоритет №1, 5% пошлина + субсидии выгодны китайскому экспорту",
    regionEn: "Russia", regionRu: "Россия",
    tagsEn: '["EU Sanctions", "Substitution Window"]', tagsRu: '["Санкции ЕС", "Окно замены"]',
    detailedContent: `## EU第20轮对俄制裁+俄罗斯农机市场\n\n### 俄罗斯农机市场关键数据\n| 指标 | 数值 |\n|------|------|\n| 2026优先产业 | **农机排第一** |\n| 进口关税 | **5%（低税率）** |\n| 政府补贴 | 有（农机购置补贴） |\n| EUR/RUB | **84.18（稳定）** |\n| 市场规模(2025) | **$8.23亿** |\n| CAGR | **5.4%** |\n| 2034预计 | **$13.3亿** |\n\n### 对中国设备的影响\n- 中国二手农机不受EU制裁限制\n- 欧美配件断供→中国品牌替代窗口扩大\n- 中俄铁路运输正常，30-40天到货\n- 俄语产品手册+配件承诺=成交关键`,
    detailedContentEn: `## EU 20th Round Sanctions + Russia Ag Machinery\n\n### Key Data\n| Indicator | Value |\n|------|------|\n| 2026 priority industry | **Agri machinery #1** |\n| Import tariff | **5% (low rate)** |\n| Government subsidies | Yes |\n| EUR/RUB | **84.18 (stable)** |\n| Market size (2025) | **$823M** |\n| CAGR | **5.4%** |\n\n### Impact on Chinese Equipment\n- Chinese used machinery not subject to EU sanctions\n- Western parts disruption → Chinese brand substitution window expanding`,
    detailedContentRu: `## Санкции ЕС 20-го раунда + сельхозтехника России\n\n### Ключевые данные\n| Показатель | Значение |\n|------|------|\n| Приоритет 2026 | **Сельхозмашиностроение №1** |\n| Импортная пошлина | **5% (низкая)** |\n| Госсубсидии | Да |\n| EUR/RUB | **84.18 (стабильно)** |\n\n### Влияние на китайское оборудование\n- Китайская б/у техника не подпадает под санкции ЕС`,
    actionTips: ["俄市场5%低关税+补贴窗口，加速CLAAS系列推广", "提供俄语说明书+配件供应承诺增强信任", "970/980/850均符合俄市场刚需，重点推"],
    dataSummary: JSON.stringify([{ label: "俄市场规模", value: "$8.23亿→$13.3亿" }, { label: "进口关税", value: "5%低税率" }, { label: "EUR/RUB", value: "84.18稳定" }]),
  },

  // ========== sortOrder=11 乌兹别克斯坦 ==========
  {
    icon: "🇺🇿", region: "乌兹别克斯坦", tags: ["全球最快", "+256%"], date: TODAY,
    text: "乌兹别克斯坦进口+256.77%全球最快！棉花采收机械化率不足40%，政府补贴50%，农牧机械需求空间巨大",
    textEn: "Uzbekistan imports +256.77% globally fastest! Cotton harvesting mechanization below 40%, govt subsidy 50%, massive agri machinery demand",
    textRu: "Импорт Узбекистана +256.77% — самый быстрый в мире! Механизация хлопкоуборки ниже 40%, госсубсидия 50%, огромный спрос на сельхозтехнику",
    regionEn: "Uzbekistan", regionRu: "Узбекистан",
    tagsEn: '["Fastest Global", "+256%"]', tagsRu: '["Самый быстрый", "+256%"]',
    detailedContent: `## 乌兹别克斯坦市场持续爆发\n\n### 核心数据\n| 指标 | 数值 |\n|------|------|\n| Q1进口增速 | **+256.77%** 🌍全球最快 |\n| 棉花采收机械化率 | 不足40% |\n| 政府补贴 | 农机购置补贴**50%** |\n| 物流 | 中吉乌铁路建设加速 |\n\n### 推荐机型（面向乌兹别克市场）\n| 品类 | 推荐型号 | 报价（万元） |\n|------|---------|------------|\n| 青储收获机 | CLAAS 850/860 | 60-120 |\n| 拖拉机 | NH/Deere 100-200HP | 30-80 |\n| 打捆机 | Krone 500/600 | 15-40 |\n| 大方捆 | BP1290/Krone | 68-100 |\n| 小方捆 | **5070（12台）** | **¥3.4万/台** 🔥 |`,
    detailedContentEn: `## Uzbekistan Market Continues to Surge\n\n### Core Data\n| Indicator | Value |\n|------|------|\n| Q1 import growth | **+256.77%** 🌍 Globally fastest |\n| Cotton harvesting mechanization | Below 40% |\n| Government subsidies | **50%** machinery purchase subsidy |\n\n### Recommended Models\n| Category | Recommended | Price (CNY 10K) |\n|------|---------|------------|\n| Forage harvester | CLAAS 850/860 | 60-120 |\n| Tractors | NH/Deere 100-200HP | 30-80 |`,
    detailedContentRu: `## Рынок Узбекистана продолжает бурный рост\n\n### Основные данные\n| Показатель | Значение |\n|------|------|\n| Рост импорта за Q1 | **+256.77%** 🌍 Самый быстрый в мире |\n| Механизация хлопкоуборки | Ниже 40% |\n| Госсубсидии | **50%** субсидия на покупку техники |\n\n### Рекомендуемые модели\n| Категория | Рекомендация | Цена (10 тыс. юаней) |\n|------|---------|------------|\n| Силосоуборочные | CLAAS 850/860 | 60-120 |`,
    actionTips: ["5070小方捆适合乌兹别克棉花产区，12台批量出口最佳", "乌兹别克语+俄语版产品手册优先制作", "利用50%政府补贴设计融资方案"],
    dataSummary: JSON.stringify([{ label: "乌兹别克增速", value: "+256.77%" }, { label: "机械化率", value: "<40%" }, { label: "补贴", value: "50%" }]),
  },

  // ========== sortOrder=12 操作建议 ==========
  {
    icon: "🌍", region: "全球", tags: ["操作建议", "10大优先"], date: TODAY,
    text: "今日10大操作优先：970(51.8%)→FR450速推→BP1290(97.1%)→5300RC验证→970(2025)渠道→980面议→950新标的→BigM→汇率监控→5070批量",
    textEn: "Today's 10 priorities: 970(51.8%)→FR450 fast push→BP1290(97.1%)→5300RC verify→970(2025) channel→980 negotiable→950 new target→BigM→FX monitor→5070 bulk",
    textRu: "10 приоритетов на сегодня: 970(51.8%)→FR450→BP1290(97.1%)→5300RC→970(2025)→980→950→BigM→мониторинг валют→5070",
    regionEn: "Global", regionRu: "Глобально",
    tagsEn: '["Action Plan", "10 Priorities"]', tagsRu: '["План действий", "10 приоритетов"]',
    detailedContent: `## 今日10大操作优先级（基于2026-06-17日报）\n\n| 优先级 | 操作 | 价差/关键点 | 紧迫度 |\n|--------|------|------------|--------|\n| 1 | **970(2017)俄语区推进** | 51.8%价差(84.5万) | 🔴 最急 |\n| 2 | **FR450爆款速推10台** | 101.4%价差(21.8万/台) | 🔴 最急 |\n| 3 | **BP1290(2020)东欧推量** | 97.1%价差(66.0万) | 🔴 最急 |\n| 4 | **5300RC(2020)确认车况** | 335.6%最高价差 | 🟡 高 |\n| 5 | **🆕 关注970(2025)采购渠道** | 579h波兰≈€500K | 🟡 高 |\n| 6 | **🆕 980(2024)面议机会** | 2台T4/E5面议 | 🟡 高 |\n| 7 | **950(2018)新机会** | 44.5%价差(42.3万) | 🟡 高 |\n| 8 | **BigM 420东欧推进** | 60.2%价差(29.5万) | 🟡 高 |\n| 9 | **📊 关注EUR/CNY走势** | 7.8480，若突破7.90全面利好 | 🟡 高 |\n| 10 | **🔥 5070小方捆批量出口** | ¥3.4万/台，12台库存 | 🟡 高 |\n\n### 关键时间节点\n- 🟢 EUR/CNY 7.8480回升→套利空间微扩\n- 🆕 970(2025)首次出现→全球高端需求持续旺盛\n- 🆕 970(2024, 870h)£284,371→258.1万潜在采购机会\n- 🗓️ 7月：AGRO 2026乌克兰展`,
    detailedContentEn: `## Today's 10 Action Priorities (Based on 2026-06-17 Report)\n\n| Priority | Action | Spread/Key Point | Urgency |\n|--------|------|------------|--------|\n| 1 | **970(2017) Russia region push** | 51.8% (CNY 845K) | 🔴 Most urgent |\n| 2 | **FR450 hot seller 10 units** | 101.4% (CNY 218K/unit) | 🔴 Most urgent |\n| 3 | **BP1290(2020) E. Europe** | 97.1% (CNY 660K) | 🔴 Most urgent |\n| 4 | **5300RC(2020) verify** | 335.6% highest | 🟡 High |\n| 5 | **🆕 970(2025) channel** | 579h Poland≈€500K | 🟡 High |\n| 6 | **🆕 980(2024) negotiate** | 2 units T4/E5 negotiable | 🟡 High |\n| 7 | **950(2018) new** | 44.5% (CNY 423K) | 🟡 High |\n| 8 | **BigM 420 E. Europe** | 60.2% (CNY 295K) | 🟡 High |\n| 9 | **📊 EUR/CNY monitor** | 7.8480 | 🟡 High |\n| 10 | **🔥 5070 bulk export** | ¥34K/unit, 12 units | 🟡 High |`,
    detailedContentRu: `## 10 приоритетов на сегодня (на основе отчёта от 17.06.2026)\n\n| Приоритет | Действие | Разница | Срочность |\n|--------|------|------------|--------|\n| 1 | **970(2017) Россия** | 51.8% (845K) | 🔴 Самое срочное |\n| 2 | **FR450 хит 10 ед.** | 101.4% (218K/ед.) | 🔴 Самое срочное |\n| 3 | **BP1290 Вост. Европа** | 97.1% (660K) | 🔴 Самое срочное |\n| 4 | **5300RC(2020) проверка** | 335.6% | 🟡 Высокая |`,
    actionTips: ["970俄语区+FR450爆款+BP1290东欧三线并行", "5300RC(2020)优先确认车况决定是否推", "5070小方捆12台批量出口非洲/东南亚/中亚"],
    dataSummary: JSON.stringify([{ label: "核心汇率", value: "EUR/CNY 7.8480" }, { label: "操作数", value: "10大优先" }, { label: "套利排行TOP3", value: "5300RC 336%/FR450 101%/BP1290 97%" }]),
  },
];

async function main() {
  // 先清空旧数据
  await prisma.marketIntel.deleteMany();
  console.log("已清空旧数据");

  // 导入新数据（5070在索引0=sortOrder=0）
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
  console.log(`已导入 ${ALL_MARKET_INTEL.length} 条情报数据 (日期: 2026-06-17)`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
