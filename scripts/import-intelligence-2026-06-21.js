/**
 * 导入2026-06-21市场情报数据到数据库
 * 基于 2026-06-21_跨境套利日报.md 生成（周日 · 周末版）
 * 5070永久头条（sortOrder=0）+ 11条情报
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const TODAY = new Date("2026-06-21");

const ALL_MARKET_INTEL = [
  // ========== sortOrder=0: 永久头条 - 纽荷兰5070小方捆 ==========
  {
    icon: "🔥", region: "中国", regionEn: "China", regionRu: "Китай",
    tags: ["爆款","5070小方捆","12台库存"],
    tagsEn: ["Hot Deal","5070 Baler","12 Units"],
    tagsRu: ["Хит","5070 Пресс","12 ед."],
    text: "纽荷兰5070小方捆·12台库存爆款！¥3.4万/台，海外$7,000+，利润58.8%，小方捆打捆机全球需求旺盛",
    textEn: "New Holland 5070 Small Square Baler·12 units! ¥34K/unit, overseas $7K+, 58.8% margin, global demand strong",
    textRu: "New Holland 5070 Малый тюковый пресс·12 ед! ¥34K/ед, зарубеж $7K+, 58.8% маржа, глобальный спрос высок",
    detailedContent: `## 🔥 纽荷兰5070小方捆 — 永久头条爆款\n\n**12台库存现货，全球小方捆打捆机需求旺盛**\n\n### 价差分析\n| 项目 | 数值 |\n|------|------|\n| 国内售价 | ¥3.4万/台 |\n| 海外参考价 | $7,000+ |\n| 毛利率 | 58.8% |\n| 库存数量 | 12台 |\n| 总利润空间 | ¥19-32万 |\n\n### 五大爆款理由\n1. **全球需求旺盛**：小方捆打捆机在非洲、东南亚、中亚需求强劲\n2. **利润空间大**：58.8%毛利率，总利润¥19-32万\n3. **库存充足**：12台整装待发，可批量出口\n4. **价格优势**：¥3.4万/台极具竞争力\n5. **纽荷兰品牌**：国际知名品牌，海外买家信任度高\n\n### 目标市场推广策略\n| 市场 | 推广重点 | 定价建议 |\n|------|---------|--------|\n| 🇰🇪 非洲（肯尼亚） | 小型农户批量采购 | $5,500-6,000/台 |\n| 🇮🇩 东南亚（印尼） | 合作社批量进口 | $5,800-6,500/台 |\n| 🇺🇿 中亚（乌兹别克） | 棉花产区采购 | $6,000-6,500/台 |\n\n### 行动建议\n- ✅ 优先打包12台5070批量出口\n- ✅ 制作英文/俄文/法文5070产品单页\n- ✅ Facebook农机群组重点推广\n- ✅ 对接非洲/东南亚经销商批量拿货\n- ✅ 可提供FOB天津/青岛报价`,
    detailedContentEn: `## 🔥 New Holland 5070 Small Square Baler — Permanent Top Item\n\n**12 units in stock, global small square baler demand strong**\n\n### Price Spread Analysis\n| Item | Value |\n|------|------|\n| Domestic price | ¥34,000/unit |\n| Overseas reference | $7,000+ |\n| Gross margin | 58.8% |\n| Inventory | 12 units |\n| Total profit potential | ¥190K-320K |\n\n### 5 Reasons Why It's a Hot Deal\n1. **Strong global demand** for small square balers in Africa, Southeast Asia, Central Asia\n2. **Large profit margin**: 58.8%, total profit ¥190K-320K\n3. **Sufficient inventory**: 12 units ready for bulk export\n4. **Competitive pricing**: ¥34K/unit very attractive\n5. **New Holland brand**: Internationally renowned, trusted by overseas buyers\n\n### Target Market Strategy\n| Market | Focus | Price Suggestion |\n|------|---------|--------|\n| 🇰🇪 Africa (Kenya) | Small farmer bulk purchase | $5,500-6,000/unit |\n| 🇮🇩 SE Asia (Indonesia) | Cooperative bulk import | $5,800-6,500/unit |\n| 🇺🇿 Central Asia (Uzbekistan) | Cotton region procurement | $6,000-6,500/unit |\n\n### Action Items\n- ✅ Priority: bundle 12 units for bulk export\n- ✅ Create EN/RU/FR product brochure\n- ✅ Promote in Facebook farming groups\n- ✅ Contact African/Southeast Asian distributors\n- ✅ Offer FOB Tianjin/Qingdao pricing`,
    detailedContentRu: `## 🔥 New Holland 5070 Малый тюковый пресс — Постоянный топ\n\n**12 ед. в наличии, глобальный спрос на малые тюковые прессы высок**\n\n### Анализ разницы цен\n| Параметр | Значение |\n|------|------|\n| Внутренняя цена | ¥34 000/ед. |\n| Зарубежный ориентир | $7 000+ |\n| Валовая маржа | 58.8% |\n| Остаток на складе | 12 ед. |\n| Общий потенциал прибыли | ¥190-320 тыс. |\n\n### 5 причин, почему это хит\n1. **Высокий глобальный спрос** на малые тюковые прессы в Африке, Юго-Восточной Азии, Центральной Азии\n2. **Большая маржа**: 58.8%, общая прибыль ¥190-320 тыс.\n3. **Достаточный запас**: 12 ед. готовы к оптовому экспорту\n4. **Конкурентная цена**: ¥34 тыс./ед. очень привлекательна\n5. **Бренд New Holland**: Международно признан, пользуется доверием зарубежных покупателей\n\n### Стратегия по целевым рынкам\n| Рынок | Фокус | Рекомендуемая цена |\n|------|---------|--------|\n| 🇰🇪 Африка (Кения) | Мелкие фермеры оптом | $5 500-6 000/ед. |\n| 🇮🇩 ЮВА (Индонезия) | Кооперативы оптом | $5 800-6 500/ед. |\n| 🇺🇿 ЦА (Узбекистан) | Закупки хлопковых регионов | $6 000-6 500/ед. |\n\n### Действия\n- ✅ Приоритет: оптовая партия 12 ед.\n- ✅ Создать EN/RU/FR брошюру продукта\n- ✅ Продвигать в группах Facebook\n- ✅ Связаться с дистрибьюторами Африки/ЮВА\n- ✅ Предложить цены FOB Тяньцзинь/Циндао`,
    actionTips: ["优先打包12台5070批量出口","制作英文/俄文/法文5070产品单页","Facebook农机群组重点推广","对接非洲/东南亚经销商批量拿货","可提供FOB天津/青岛报价"],
    dataSummary: [{label:"国内售价",value:"¥3.4万/台"},{label:"海外参考",value:"$7,000+"},{label:"利润率",value:"58.8%"},{label:"库存",value:"12台"},{label:"总利润空间",value:"¥19-32万"}],
  },
  // ========== sortOrder=1: EUR/CNY周跌1.02%但尾盘反弹守住7.75 ==========
  {
    icon: "💶", region: "欧洲", regionEn: "Europe", regionRu: "Европа",
    tags: ["EUR/CNY","周跌1.02%","7.75支撑"],
    tagsEn: ["EUR/CNY","Weekly -1.02%","7.75 Support"],
    tagsRu: ["EUR/CNY","Неделя -1.02%","Поддержка 7.75"],
    text: "EUR/CNY周跌1.02%为近三月最大单周跌幅！周五尾盘反弹至7.7681守住7.75支撑，ECB 6月会议下周重磅来袭",
    textEn: "EUR/CNY weekly -1.02%, largest weekly drop in 3 months! Friday rebound to 7.7681 held 7.75 support, ECB June meeting next week",
    textRu: "EUR/CNY недельное падение -1.02%, крупнейшее за 3 месяца! Пятничный отскок до 7.7681 удержал поддержку 7.75, заседание ЕЦБ в июне на следующей неделе",
    detailedContent: `## EUR/CNY汇率走势分析\n\n**周五尾盘反弹至7.7681，守住7.75关键心理支撑位**\n\n### 本周(6/16-6/20)汇率走势回顾\n| 日期 | EUR/CNY | 日环比 | 事件 |\n|------|---------|--------|------|\n| 6/16 | 7.8480 | — | 周初高位 |\n| 6/17 | 7.8480 | 0.00% | 持平 |\n| 6/18 | 7.7760 | -0.92% ⚠️ | 开始下跌 |\n| 6/19 | 7.7600 | -0.21% ⚠️ | 逼近7.75 |\n| 6/20 | 7.7681 | +0.10% ✅ | 尾盘反弹 |\n| **周变** | **-1.02%** | — | 三月最大 |\n\n### 下周关键事件\n| 事件 | 日期 | 影响 |\n|------|------|------|\n| 🔴 **ECB 6月议息会议** | 周四 6/26 | 预期加息25bp → 利好EUR |\n| 7.75支撑测试 | 周一 6/23 | 确认支撑有效性 |\n| 央行中间价更新 | 周一 9:15 | 周五收盘已更新 |\n\n### EC B会议情景分析\n| 情景 | 概率 | EUR/CNY影响 | 套利影响 |\n|------|------|-------------|----------|\n| 加息25bp | 65% | 7.80-7.85 ✅ | 价差扩大 |\n| 意外不加息 | 25% | 7.65-7.70 ⚠️ | 价差压缩 |\n| 降息 | 10% | 7.55-7.60 ❌ | 急剧压缩 |`,
    detailedContentEn: `## EUR/CNY Exchange Rate Analysis\n\n**Friday rebound to 7.7681, held 7.75 key psychological support**\n\n### Weekly (6/16-6/20) FX Trend Review\n| Date | EUR/CNY | Daily Change | Event |\n|------|---------|--------|------|\n| 6/16 | 7.8480 | — | Early week high |\n| 6/17 | 7.8480 | 0.00% | Flat |\n| 6/18 | 7.7760 | -0.92% ⚠️ | Started decline |\n| 6/19 | 7.7600 | -0.21% ⚠️ | Approaching 7.75 |\n| 6/20 | 7.7681 | +0.10% ✅ | Friday rebound |\n| **Weekly** | **-1.02%** | — | 3-month largest |\n\n### Next Week Key Events\n| Event | Date | Impact |\n|------|------|------|\n| 🔴 **ECB June Meeting** | Thu 6/26 | Expected +25bp → EUR positive |\n| 7.75 Support test | Mon 6/23 | Confirm support validity |\n| PBOC midpoint update | Mon 9:15 | Updated at Friday close |`,
    detailedContentRu: `## Анализ курса EUR/CNY\n\n**Пятничный отскок до 7.7681, удержана ключевая поддержка 7.75**\n\n### Недельный (16-20 июня) обзор тренда валют\n| Дата | EUR/CNY | Дневное изменение | Событие |\n|------|---------|--------|------|\n| 16.06 | 7.8480 | — | Начало недели максимум |\n| 17.06 | 7.8480 | 0.00% | Без изменений |\n| 18.06 | 7.7760 | -0.92% ⚠️ | Начало падения |\n| 19.06 | 7.7600 | -0.21% ⚠️ | Приближение к 7.75 |\n| 20.06 | 7.7681 | +0.10% ✅ | Отскок в пятницу |\n| **Неделя** | **-1.02%** | — | Макс. за 3 месяца |`,
    actionTips: ["周一开盘重点观察EUR/CNY 7.75支撑有效性","ECB会议前加速锁定现有欧元计价订单","CIPS人民币结算对冲汇率风险"],
    dataSummary: [{label:"EUR/CNY当前",value:"7.7681"},{label:"周跌幅",value:"-1.02%"},{label:"ECB加息概率",value:"65%"}],
  },
  // ========== sortOrder=2: 980系列供给井喷14条(+133%) ==========
  {
    icon: "📈", region: "欧洲", regionEn: "Europe", regionRu: "Европа",
    tags: ["980井喷","14条","+133%"],
    tagsEn: ["980 Surge","14 Units","+133%"],
    tagsRu: ["980 Всплеск","14 ед.","+133%"],
    text: "Jaguar 980系列14条在售(+133%周增量)！买方议价空间历史最大，2025款€532,500天花板",
    textEn: "Jaguar 980 series 14 units for sale (+133% weekly surge)! Buyer bargaining power at historic high, 2025 model €532,500 ceiling price",
    textRu: "Jaguar 980 серия 14 ед. в продаже (+133% за неделю)! Переговорная сила покупателя на историческом максимуме, модель 2025 €532,500 потолок",
    detailedContent: `## 980系列供给井喷深度分析\n\n**本周14条在售，从6条暴增至14条（+133%），创近期新高！**\n\n### 价格分布\n| 年份 | 价格(EUR) | 换算人民币 | 工时 |\n|------|-----------|-----------|------|\n| **2025** | €532,500 | 413.6万 | 363h |\n| 2024 | €467,754 | 363.3万 | 1,750h |\n| 2023(4WD) | €378,426 | 293.9万 | 2,182h |\n| 2023(法) | €319,815 | 248.4万 | 2,304h |\n| 2022 | €461,400 | 358.4万 | 896h |\n| **2021(21h!)** | **€749,805** | **582.4万** | **21h** |\n| 2014 | €216,500 | 168.2万 | 4,100h |\n| 2013 | €189,942 | 147.5万 | 5,368h |\n\n### 操作策略\n- ⚡ 980供给增加压价风险：国际端980价格可能继续下行\n- ⚡ 主动出击获取低于€400K的980报价\n- ⚡ 980(2024)定价锚确立：€467,754→363.3万为24款首条公开报价\n- ⚡ 周一晚上发980询价邮件，争取主动`,
    detailedContentEn: `## 980 Series Supply Surge Analysis\n\n**14 units for sale this week, surged from 6 to 14 (+133%), near-term record high!**\n\n### Price Distribution\n| Year | Price(EUR) | CNY Equivalent | Hours |\n|------|-----------|-----------|------|\n| **2025** | €532,500 | CNY 4.136M | 363h |\n| 2024 | €467,754 | CNY 3.633M | 1,750h |\n| 2023(4WD) | €378,426 | CNY 2.939M | 2,182h |\n| 2023(FR) | €319,815 | CNY 2.484M | 2,304h |\n| 2022 | €461,400 | CNY 3.584M | 896h |\n| **2021(21h!)** | **€749,805** | **CNY 5.824M** | **21h** |\n\n### Strategy\n- ⚡ 980 supply increase price risk: int'l 980 prices may continue to fall\n- ⚡ Proactively target 980 offers below €400K\n- ⚡ 980(2024) pricing anchor set: €467,754→CNY 3.633M`,
    detailedContentRu: `## Анализ всплеска предложения серии 980\n\n**14 ед. в продаже на этой неделе, рост с 6 до 14 (+133%), рекордный максимум!**\n\n### Распределение цен\n| Год | Цена(EUR) | Эквивалент юаней | Моточасы |\n|------|-----------|-----------|------|\n| **2025** | €532,500 | 4.136 млн | 363ч |\n| 2024 | €467,754 | 3.633 млн | 1,750ч |\n| 2023(4WD) | €378,426 | 2.939 млн | 2,182ч |\n| 2023(ФР) | €319,815 | 2.484 млн | 2,304ч |\n\n### Стратегия\n- ⚡ Рост предложения 980: цены могут продолжать снижаться\n- ⚡ Активно получать предложения 980 ниже €400K\n- ⚡ Ценовой якорь 980(2024): €467,754→3.633 млн`,
    actionTips: ["980供给井喷，主动获取低于€400K的980报价","周一晚发980询价邮件争取主动","筛选最具性价比的3-5条980对比"],
    dataSummary: [{label:"980在售",value:"14条(+133%)"},{label:"980(2025)",value:"€532,500天花板"},{label:"980(2016)国内",value:"143万"}],
  },
  // ========== sortOrder=3: 5300RC(2020)331.1%全品类第一 ==========
  {
    icon: "🏆", region: "中国", regionEn: "China", regionRu: "Китай",
    tags: ["5300RC","331.1%","白菜价"],
    tagsEn: ["5300RC","331.1%","Bargain Price"],
    tagsRu: ["5300RC","331.1%","Бросовая цена"],
    text: "CLAAS 5300RC(2020)18万白菜价！国际€99,900→77.6万，价差59.6万(331.1%)全品类套利率第一",
    textEn: "CLAAS 5300RC(2020) at CNY 180K bargain! Int'l €99,900→CNY 776K, spread CNY 596K (331.1%), #1 across all categories",
    textRu: "CLAAS 5300RC(2020) по 180 тыс. юаней — бросовая цена! Междун. €99,900→776 тыс., разница 596 тыс. (331.1%)",
    detailedContent: `## 5300RC(2020)全品类套利冠军\n\n**18万元白菜价，全品类套利率331.1%，无可争议的第一！**\n\n### 套利分析\n| 指标 | 数值 |\n|------|------|\n| 国内售价 | **18万元** |\n| 国际参考(EU €99,900) | **77.6万元** |\n| 价差 | **59.6万元** |\n| 价差率 | **331.1%** ⭐⭐⭐⭐⭐ |\n| 国内库存 | 1台 |\n\n### 价比分析\n| 对比机型 | 国内售价 | 国际价 | 价差率 |\n|---------|---------|--------|-------|\n| 5300RC(2020) | 18万 | 77.6万 | **331.1%** |\n| 5300RC(2022) | 95万 | 112.8万 | 18.7% |\n| FR450(2013) | 21.5万 | 43.3万 | 101.4% |\n| 980(2016) | 143万 | 244.8万 | 71.2% |\n\n### 行动建议\n- ⚡ **周一开始电话确认车况**，锁定标的\n- ⚡ 331.1%价差率为全品类最高，优先成交\n- 🌍 目标市场：俄罗斯、乌克兰、巴西（需求强烈）`,
    detailedContentEn: `## 5300RC(2020) #1 Across All Categories\n\n**CNY 180K bargain, 331.1% spread rate, undisputed #1!**\n\n### Arbitrage Analysis\n| Indicator | Value |\n|------|------|\n| Domestic price | **CNY 180,000** |\n| Int'l reference (EU €99,900) | **CNY 776,000** |\n| Spread | **CNY 596,000** |\n| Spread rate | **331.1%** ⭐⭐⭐⭐⭐ |\n\n### Comparison\n| Model | Domestic | Int'l | Spread Rate |\n|---------|---------|--------|-------|\n| 5300RC(2020) | CNY 180K | CNY 776K | **331.1%** |\n| FR450(2013) | CNY 215K | CNY 433K | 101.4% |\n| 980(2016) | CNY 1.43M | CNY 2.448M | 71.2% |`,
    detailedContentRu: `## 5300RC(2020) №1 среди всех категорий\n\n**180 тыс. юаней — бросовая цена, 331.1% разница, бесспорный №1!**\n\n### Анализ арбитража\n| Показатель | Значение |\n|------|------|\n| Внутренняя цена | **180 тыс. юаней** |\n| Междунар. ориентир (€99,900) | **776 тыс. юаней** |\n| Разница | **596 тыс. юаней** |\n| Ставка разницы | **331.1%** ⭐⭐⭐⭐⭐ |\n| Склад | 1 ед. |`,
    actionTips: ["周一开始电话确认5300RC(2020)车况","331.1%价差率先锁定后推给高端买家","目标市场俄罗斯/乌克兰/巴西"],
    dataSummary: [{label:"国内价",value:"18万"},{label:"国际价",value:"77.6万"},{label:"价差率",value:"331.1%"}],
  },
  // ========== sortOrder=4: FR450(2013)101.4%爆款10台 ==========
  {
    icon: "🇨🇳", region: "中国", regionEn: "China", regionRu: "Китай",
    tags: ["FR450","101.4%","10台爆款"],
    tagsEn: ["FR450","101.4%","10 Units Hot"],
    tagsRu: ["FR450","101.4%","10 ед. Хит"],
    text: "New Holland FR450(2013)21.5万/台+101.4%价差率！10台库存走量爆款，汇率敏感度最低的套利标的",
    textEn: "New Holland FR450(2013) CNY 215K/unit + 101.4% spread rate! 10 units volume seller, lowest FX sensitivity arbitrage target",
    textRu: "New Holland FR450(2013) 215 тыс. юаней/ед. + 101.4% разница! 10 ед. — хит оптовых продаж, минимальная валютная чувствительность",
    detailedContent: `## FR450爆款速推：10台走量优势\n\n**21.5万/台+101.4%价差率，汇率影响最小的套利标的**\n\n### FR450套利分析\n| 指标 | 数值 |\n|------|------|\n| 国内售价 | 21.5万/台 |\n| 俄市场参考价 | 43.3万 |\n| 价差 | 21.8万 |\n| 价差率 | **101.4%** |\n| 库存 | **10台** |\n| 汇率敏感度 | 低 |\n\n### 为什么是爆款？\n1. **101.4%价差率** → 翻倍利润\n2. **21.5万低门槛** → 买家决策快\n3. **10台库存** → 走量模式，快速回笼资金\n4. **汇率波动影响小** → 利润确定性高\n\n### 目标市场\n| 市场 | 预估需求量 | 定价建议 |\n|------|----------|--------|\n| 🇷🇺 俄罗斯 | 5-8台 | €45,000-50,000 |\n| 🇺🇦 乌克兰 | 3-5台 | €42,000-48,000 |\n| 🌍 中亚 | 2-3台 | $45,000-55,000 |`,
    detailedContentEn: `## FR450 Hot Seller Push: 10 Units Volume\n\n**CNY 215K/unit + 101.4% spread rate, lowest FX impact arbitrage target**\n\n### FR450 Arbitrage Analysis\n| Indicator | Value |\n|------|------|\n| Domestic price | CNY 215K/unit |\n| Russian market ref | CNY 433K |\n| Spread | CNY 218K |\n| Spread rate | **101.4%** |\n| Inventory | **10 units** |\n| FX sensitivity | Low |\n\n### Why It's a Hot Seller\n1. **101.4% spread rate** → Double profit\n2. **CNY 215K low barrier** → Fast buyer decisions\n3. **10 units inventory** → Volume model\n4. **Minimal FX impact** → High profit certainty`,
    detailedContentRu: `## FR450 — хит продаж: 10 ед. оптом\n\n**215 тыс. юаней/ед. + 101.4% разница, минимальная валютная чувствительность**\n\n### Анализ арбитража FR450\n| Показатель | Значение |\n|------|------|\n| Внутренняя цена | 215 тыс. юаней/ед. |\n| Справочная РФ | 433 тыс. юаней |\n| Разница | 218 тыс. юаней |\n| Ставка разницы | **101.4%** |\n| Остаток | **10 ед.** |\n| Чувств. к валютам | Низкая |`,
    actionTips: ["FR450俄语区批量速推10台","21.5万低门槛吸引中小买家","一口价策略加速成交"],
    dataSummary: [{label:"FR450价差",value:"101.4%"},{label:"库存",value:"10台"},{label:"国内价",value:"21.5万"}],
  },
  // ========== sortOrder=5: BP1290(2020)95.0%打捆机冠军 ==========
  {
    icon: "🥇", region: "欧洲", regionEn: "Europe", regionRu: "Европа",
    tags: ["BP1290","95.0%","打捆机冠军"],
    tagsEn: ["BP1290","95.0%","Baler Champion"],
    tagsRu: ["BP1290","95.0%","Чемпион прессов"],
    text: "Krone BiG Pack 1290(2020)国内68万 vs 国际€170,765→132.6万，价差64.6万(95.0%)，打捆机套利冠军",
    textEn: "Krone BiG Pack 1290(2020) domestic CNY 680K vs int'l €170,765→CNY 1.326M, spread CNY 646K (95.0%), baler arbitrage champion",
    textRu: "Krone BiG Pack 1290(2020) внутр. 680 тыс. vs междун. €170,765→1.326 млн, разница 646 тыс. (95.0%)",
    detailedContent: `## BP1290打捆机套利冠军\n\n**95.0%价差率+64.6万利润，打捆机品类第一**\n\n### 套利对比\n| 机型 | 国际价(EUR) | 换算RMB | 国内价 | 价差 | 价差率 |\n|------|-----------|---------|--------|------|--------|\n| BP1290(2020) | €170,765 | 132.6万 | 68万 | 64.6万 | **95.0%** ⭐⭐⭐⭐⭐ |\n| BP1290(2024) | €213,010 | 165.5万 | — | — | — |\n| BP1290 HDP II(2022) | €222,171 | 172.6万 | — | — | — |\n| BP1290 HDP VC(2021) | €201,600 | 156.6万 | — | — | — |\n\n### 东欧推量策略\n- 🇺🇦 乌克兰基辅渠道：BP1290(2024)€200,000直接挂牌\n- 🇦🇹 奥地利：BP1290 HDP VC 51(2020)出价\n- 🚛 中欧铁路20天直达哈萨克/俄罗斯\n\n### 行动建议\n- BP1290东欧推量，95.0%价差率（64.6万利润）\n- 打捆机套利冠军，优先推东欧市场`,
    detailedContentEn: `## BP1290 Baler Arbitrage Champion\n\n**95.0% spread rate + CNY 646K profit, #1 baler category**\n\n### Arbitrage Comparison\n| Model | Int'l(EUR) | RMB | Domestic | Spread | Rate |\n|------|-----------|---------|--------|------|--------|\n| BP1290(2020) | €170,765 | CNY 1.326M | CNY 680K | CNY 646K | **95.0%** |\n| BP1290(2024) | €213,010 | CNY 1.655M | — | — | — |\n| BP1290 HDP II(2022) | €222,171 | CNY 1.726M | — | — | — |\n\n### Eastern Europe Strategy\n- 🇺🇦 Kyiv channel: BP1290(2024)€200,000 direct listing\n- 🚛 China-Europe railway 20 days to Kazakhstan/Russia`,
    detailedContentRu: `## BP1290 чемпион арбитража прессов\n\n**95.0% разница + 646 тыс. юаней прибыли, №1 в категории прессов**\n\n### Сравнение арбитража\n| Модель | Междун.(EUR) | Юани | Внутр. | Разница | Ставка |\n|------|-----------|---------|--------|------|--------|\n| BP1290(2020) | €170,765 | 1.326 млн | 680 тыс. | 646 тыс. | **95.0%** |`,
    actionTips: ["BP1290东欧推量95.0%价差率","打捆机冠军优先推乌克兰基辅渠道","利用中欧铁路20天直达优势"],
    dataSummary: [{label:"BP1290价差",value:"64.6万(95.0%)"},{label:"国内价",value:"68万"},{label:"国际参考",value:"€170,765"}],
  },
  // ========== sortOrder=6: 980(2021,21h)准新582.4万天花板 ==========
  {
    icon: "👑", region: "欧洲", regionEn: "Europe", regionRu: "Европа",
    tags: ["980准新","21h","582.4万"],
    tagsEn: ["980 Like-New","21h","CNY 5.824M"],
    tagsRu: ["980 Как новый","21ч","5.824 млн"],
    text: "Jaguar 980(2021)仅21工时准新机！法国£648,651→582.4万，980系列最高价天花板",
    textEn: "Jaguar 980(2021) only 21 hours like-new! France £648,651→CNY 5.824M, 980 series highest price ceiling",
    textRu: "Jaguar 980(2021) всего 21 моточас как новый! Франция £648,651→5.824 млн, потолок цен серии 980",
    detailedContent: `## 980(2021,21h)准新天花板\n\n**仅21工时准新机，582.4万为980系列最高定价，高端专供标的**\n\n### 参数详情\n| 指标 | 数值 |\n|------|------|\n| 型号 | CLAAS Jaguar 980 |\n| 年份 | 2021 |\n| 工时 | **21小时**（准新机） |\n| 价格(GBP) | £648,651 |\n| 换算人民币 | **582.4万元** |\n| 所在地 | 法国上普罗旺斯 |\n\n### 价格定位\n- 980系列天花板：582.4万远超同类\n- 仅21h但价格含配件，不做常规定价参考\n- 适合推给VIP客户做品牌标杆\n\n### 风险提示\n- 高价风险：582.4万远超同类\n- 仅21h但价格含配件，不做定价参考\n- 仅供VIP客户参考`,
    detailedContentEn: `## 980(2021,21h) Like-New Ceiling\n\n**Only 21 hours like-new, CNY 5.824M is 980 series highest pricing, VIP offering**\n\n### Details\n| Indicator | Value |\n|------|------|\n| Model | CLAAS Jaguar 980 |\n| Year | 2021 |\n| Hours | **21 hours** (like-new) |\n| Price(GBP) | £648,651 |\n| CNY Equivalent | **CNY 5.824M** |\n| Location | Alpes-de-Haute-Provence, France |\n\n### Risk\n- ⚠️ High price risk: CNY 5.824M far exceeds similar models\n- 21h but price includes accessories, not regular pricing reference\n- Suitable for VIP clients only`,
    detailedContentRu: `## 980(2021,21ч) Как новый потолок\n\n**Всего 21 моточас как новый, 5.824 млн — самая высокая цена серии 980, VIP предложение**\n\n### Детали\n| Показатель | Значение |\n|------|------|\n| Модель | CLAAS Jaguar 980 |\n| Год | 2021 |\n| Моточасы | **21 ч** (как новый) |\n| Цена(GBP) | £648,651 |\n| В юанях | **5.824 млн** |\n\n### Риск\n- ⚠️ Высокая цена: 5.824 млн намного выше аналогов\n- Только для VIP клиентов`,
    actionTips: ["周初推给VIP客户做品牌标杆","不做常规定价参考","仅作为高端市场温度计观察"],
    dataSummary: [{label:"工时",value:"21h"},{label:"价格",value:"582.4万"},{label:"状态",value:"准新机VIP专供"}],
  },
  // ========== sortOrder=7: 970美英新渠道 ==========
  {
    icon: "🌍", region: "全球", regionEn: "Global", regionRu: "Глобально",
    tags: ["970","美英新渠道","渠道多元化"],
    tagsEn: ["970","US/UK New Channels","Channel Diversification"],
    tagsRu: ["970","Новые каналы США/Великобрит.","Диверсификация каналов"],
    text: "Jaguar 970美国威斯康星+英国坎布里亚渠道首次出现！渠道多元化重大突破",
    textEn: "Jaguar 970 US Wisconsin + UK Cumbria channels appear for the first time! Major channel diversification breakthrough",
    textRu: "Jaguar 970 каналы США Висконсин + Великобритания Камбрия впервые! Прорыв в диверсификации каналов",
    detailedContent: `## 970美英新渠道分析\n\n**首次出现美国/英国卖家，渠道多元化重大突破**\n\n### 新增渠道详情\n| 渠道 | 机型 | 年份 | 价格 | 工时 | 所在地 |\n|------|------|------|------|------|--------|\n| 🇺🇸 **MachineryPete** | 970 | 2020 | €315,118(244.8万) | 1,665h | **美国威斯康星** |\n| 🇬🇧 **Agriaffaires UK** | 970 | 2019 | €264,667(205.6万) | 2,000h | **英国坎布里亚** |\n\n### 渠道意义\n| 维度 | 意义 |\n|------|------|\n| 数据覆盖 | 从欧洲扩展到北美+英国 |\n| 定价参考 | 美国价格=(€315K)稍高，英国(€265K)为较低锚点 |\n| 渠道风险 | 单一依赖Agriaffaires(欧洲)风险降低 |\n| 套利窗口 | 英国市场970比德国便宜约16%（新发现） |\n\n### 操作建议\n🔸 利用英国便宜16%的渠道优势，对比定价\n🔸 MachineryPete/TractorHouse持续监控北美数据\n🔸 将渠道多元化优势写入客户报价说明`,
    detailedContentEn: `## 970 US/UK New Channel Analysis\n\n**First time US/UK sellers appear, major channel diversification breakthrough**\n\n### New Channel Details\n| Channel | Model | Year | Price | Hours | Location |\n|------|------|------|------|------|--------|\n| 🇺🇸 **MachineryPete** | 970 | 2020 | €315,118(CNY 2.448M) | 1,665h | **Wisconsin, USA** |\n| 🇬🇧 **Agriaffaires UK** | 970 | 2019 | €264,667(CNY 2.056M) | 2,000h | **Cumbria, UK** |\n\n### Channel Significance\n- UK market 970 ~16% cheaper than Germany (new discovery)\n- Coverage expanded beyond Europe to North America + UK`,
    detailedContentRu: `## Анализ новых каналов 970 США/Великобритания\n\n**Впервые продавцы из США/Великобритании, прорыв в диверсификации**\n\n### Детали новых каналов\n| Канал | Модель | Год | Цена | Моточасы | Место |\n|------|------|------|------|------|--------|\n| 🇺🇸 MachineryPete | 970 | 2020 | €315,118 | 1,665ч | **Висконсин, США** |\n| 🇬🇧 Agriaffaires UK | 970 | 2019 | €264,667 | 2,000ч | **Камбрия, Великобритания** |`,
    actionTips: ["利用英国市场970便宜16%的渠道优势定价","MachineryPete/TractorHouse持续监控北美数据","渠道多元化写入客户报价说明"],
    dataSummary: [{label:"美国新渠道",value:"威斯康星970(2020)"},{label:"英国新渠道",value:"坎布里亚970(2019)"},{label:"英国差价",value:"比德国便宜~16%"}],
  },
  // ========== sortOrder=8: 俄罗斯EU制裁+中国替代窗口 ==========
  {
    icon: "🇷🇺", region: "俄罗斯", regionEn: "Russia", regionRu: "Россия",
    tags: ["EU制裁","替代窗口","5%关税"],
    tagsEn: ["EU Sanctions","Substitution Window","5% Tariff"],
    tagsRu: ["Санкции ЕС","Окно замены","5% пошлина"],
    text: "EU制裁持续→俄罗斯农机配件断供加速！中国设备替代窗口扩大，5%低关税+政府补贴",
    textEn: "EU sanctions continue → Russia agri parts supply disruption accelerating! Chinese equipment substitution window expanding, 5% low tariff + gov subsidies",
    textRu: "Санкции ЕС продолжаются → ускорение разрыва поставок запчастей! Окно замены китайским оборудованием расширяется, 5% низкая пошлина + госсубсидии",
    detailedContent: `## 俄罗斯EU制裁替代窗口\n\n**EU第20轮制裁持续 → 农机配件断供加速，中国设备替代窗口扩大**\n\n### 俄罗斯市场格局\n| 维度 | 现状 |\n|------|------|\n| 制裁状态 | EU第20轮制裁持续执行 |\n| 配件供应 | CLAAS/Deere配件断供加剧 |\n| 关税 | **5%低关税**（农机为优先产业） |\n| 政府补贴 | 农机购置补贴+贷款贴息 |\n| EU/RUB汇率 | 83.87稳定（卢布小幅走强） |\n| 中俄铁路 | 正常运营，30-40天到货 |\n\n### 推荐出口机型\n| 机型 | 国内价 | 国际替代逻辑 |\n|------|--------|------------|\n| 5300RC(2020) | 18万 | EU同类€99,900→77.6万 |\n| 5300RC(2022) | 95万(全新) | EU同类€145,180→112.8万 |\n| 970(2017) | 163万 | EU同类最便宜€65K起始 |\n| 980(2016) | 143万 | EU同类14条在售 |\n\n### 行动重点\n- ✅ 重点推CLAAS二手系列：970/980/850\n- ✅ 提供俄语说明书+配件供应承诺\n- ✅ 建议建立莫斯科/新西伯利亚备件前置仓`,
    detailedContentEn: `## Russia EU Sanctions Substitution Window\n\n**EU 20th round sanctions continue → agri parts supply disruption accelerating, Chinese equipment substitution window expanding**\n\n### Russia Market Landscape\n| Dimension | Status |\n|------|------|\n| Sanctions | EU 20th round ongoing |\n| Parts supply | CLAAS/Deere parts disruption worsening |\n| Tariff | **5% low tariff** (agri priority industry) |\n| Gov subsidies | Machine purchase subsidies + loan interest subsidies |\n| EUR/RUB | 83.87 stable |\n| China-Russia rail | Normal, 30-40 day delivery |\n\n### Recommended Export Models\n- Focus on CLAAS used series: 970/980/850\n- Provide Russian manuals + parts supply commitment\n- Establish Moscow/Novosibirsk parts forward warehouse`,
    detailedContentRu: `## Окно замены в России из-за санкций ЕС\n\n**20-й раунд санкций ЕС продолжается → перебои с запчастями ускоряются, окно замены китайским оборудованием расширяется**\n\n### Ландшафт рынка России\n| Измерение | Статус |\n|------|------|\n| Санкции | 20-й раунд ЕС действует |\n| Запчасти | Перебои с запчастями CLAAS/Deere усиливаются |\n| Пошлина | **5% низкая** (приоритет с/х) |\n| Госсубсидии | Субсидии на покупку + льготные кредиты |\n| EUR/RUB | 83.87 стабильно |\n| Ж/д Китай-РФ | Нормально, 30-40 дней |`,
    actionTips: ["重点推CLAAS二手970/980替代欧美断供机型","提供俄语说明书+配件供应承诺","建议建立莫斯科备件前置仓"],
    dataSummary: [{label:"俄关税",value:"5%低关税"},{label:"EU制裁",value:"第20轮持续执行"},{label:"EUR/RUB",value:"83.87稳定"}],
  },
  // ========== sortOrder=9: 乌克兰FAO+AGRO 2026展 ==========
  {
    icon: "🇺🇦", region: "乌克兰", regionEn: "Ukraine", regionRu: "Украина",
    tags: ["FAO","AGRO 2026","基辅"],
    tagsEn: ["FAO","AGRO 2026","Kyiv"],
    tagsRu: ["FAO","AGRO 2026","Киев"],
    text: "乌克兰FAO三年计划83.6百万吨谷物+AGRO 2026展7月基辅！BP1290基辅渠道活跃",
    textEn: "Ukraine FAO 3-year plan 83.6M tons grain + AGRO 2026 exhibition July Kyiv! BP1290 Kyiv channel active",
    textRu: "Украина: план FAO 3 года 83.6 млн т зерна + выставка AGRO 2026 в июле Киев! Канал BP1290 Киев активен",
    detailedContent: `## 乌克兰市场动态\n\n**FAO三年计划+AGRO 2026展+BP1290基辅活跃渠道**\n\n### 乌克兰市场数据\n| 指标 | 数值 | 重要性 |\n|------|------|--------|\n| FAO三年计划 | 83.6百万吨谷物 | 农机确定性需求 |\n| AGRO 2026展 | 7月9-11日·基辅 | 第34届国际农业展 |\n| 黑海+多瑙河路线 | 已恢复运行 | 物流可行 |\n| BP1290基辅 | 2024款€200K挂牌 | 渠道活跃 |\n\n### AGRO 2026展前准备\n| 事项 | 截止日期 |\n|------|---------|\n| 注册线上参展 | 7月前 |\n| 俄语/乌语资料翻译 | 6月底前 |\n| 报价单更新 | 6月底前 |\n| 5国目标市场推荐清单 | 6月底前 |\n\n### BP1290渠道\n基辅经销商直接挂牌BP1290(2024)€200,000→155.4万，为打捆机东欧推量的重要渠道接口`,
    detailedContentEn: `## Ukraine Market Update\n\n**FAO 3-year plan + AGRO 2026 exhibition + BP1290 Kyiv active channel**\n\n### Ukraine Market Data\n| Indicator | Value | Importance |\n|------|------|--------|\n| FAO 3-year plan | 83.6M tons grain | Deterministic demand for agri machinery |\n| AGRO 2026 | July 9-11, Kyiv | 34th int'l agri exhibition |\n| Black Sea + Danube | Operational | Logistics feasible |\n| BP1290 Kyiv | 2024 €200K listing | Active channel |\n\n### AGRO 2026 Prep\n- Register online participation by July\n- Russian/Ukrainian translation by end-June\n- Update price sheets by end-June`,
    detailedContentRu: `## Обновление рынка Украины\n\n**3-летний план FAO + выставка AGRO 2026 + активный канал BP1290 Киев**\n\n### Данные рынка Украины\n| Показатель | Значение | Важность |\n|------|------|--------|\n| 3-летний план FAO | 83.6 млн т зерна | Определённый спрос на с/х технику |\n| AGRO 2026 | 9-11 июля, Киев | 34-я междун. с/х выставка |\n| Чёрное море + Дунай | Действуют | Логистика реальна |`,
    actionTips: ["AGRO 2026展前完成线上注册+资料翻译","乌克兰BP1290基辅渠道对接","俄语/乌语产品手册优先制作"],
    dataSummary: [{label:"FAO计划",value:"83.6百万吨"},{label:"AGRO 2026",value:"7月9-11日·基辅"},{label:"BP1290基辅",value:"€200K活跃"}],
  },
  // ========== sortOrder=10: 新兴市场（乌兹别克+非洲+印尼） ==========
  {
    icon: "🌏", region: "全球", regionEn: "Global", regionRu: "Глобально",
    tags: ["乌兹别克+256%","非洲+46%","印尼+121%"],
    tagsEn: ["Uzbekistan +256%","Africa +46%","Indonesia +121%"],
    tagsRu: ["Узбекистан +256%","Африка +46%","Индонезия +121%"],
    text: "乌兹别克+256.77%全球最快+非洲肯尼亚+46.6%+印尼+121.07%，新兴市场三引擎同时爆发",
    textEn: "Uzbekistan +256.77% globally fastest + Kenya +46.6% + Indonesia +121.07%, three emerging market engines firing simultaneously",
    textRu: "Узбекистан +256.77% самый быстрый + Кения +46.6% + Индонезия +121.07%, три мотора развивающихся рынков одновременно",
    detailedContent: `## 新兴市场三引擎爆发\n\n**乌兹别克+非洲+印尼三大新兴市场同时高增长**\n\n### 三国数据对比\n| 市场 | 增速 | 主力需求 | 物流优势 |\n|------|------|---------|--------|\n| 🇺🇿 **乌兹别克** | **+256.77%**全球最快 | 棉花采收机/青储机 | 中吉乌铁路建设中，15天陆运直达 |\n| 🇰🇪 **肯尼亚(非洲)** | **+46.6%** | 50-100HP拖拉机 | 蒙巴萨港+中非航运 |\n| 🇮🇩 **印尼(东南亚)** | **+121.07%** | 微耕机/小型收割机 | RCEP关税优惠，海运20天 |\n\n### 市场策略\n**乌兹别克斯坦**\n| 指标 | 详情 |\n|------|------|\n| 棉花采收机械化率 | 不足40% |\n| 政府补贴 | 50%农机补贴 |\n| 推荐 | CLAAS 850/860青储机、拖拉机100-200HP |\n\n**非洲（肯尼亚）**\n| 指标 | 详情 |\n|------|------|\n| 主力需求 | 50-100HP拖拉机 |\n| 中国优势 | 二手=欧洲新品20-30%价格 |\n| 非洲自贸区 | 降低关税壁垒 |\n\n**印尼（东南亚）**\n| 指标 | 详情 |\n|------|------|\n| 需求 | 微耕机/小型收割机 |\n| RCEP | 关税优惠 |\n| 渠道 | 中泰农机协议推进中 |`,
    detailedContentEn: `## Three Emerging Market Engines\n\n**Uzbekistan + Africa + Indonesia simultaneously high growth**\n\n### Comparison\n| Market | Growth | Primary Demand | Logistics Advantage |\n|------|------|---------|--------|\n| 🇺🇿 **Uzbekistan** | **+256.77%** global fastest | Cotton harvesters/Forage harvesters | China-Kyrgyzstan-Uzbekistan railway, 15-day land delivery |\n| 🇰🇪 **Kenya(Africa)** | **+46.6%** | 50-100HP tractors | Mombasa port + China-Africa shipping |\n| 🇮🇩 **Indonesia(SEA)** | **+121.07%** | Mini tillers/Small harvesters | RCEP tariff, 20-day sea freight |\n\n### Uzbekistan Strategy\n- Cotton mechanization below 40%\n- 50% gov machinery subsidy\n- CLAAS 850/860 forage harvesters`,
    detailedContentRu: `## Три двигателя развивающихся рынков\n\n**Узбекистан + Африка + Индонезия одновременно высокий рост**\n\n### Сравнение\n| Рынок | Рост | Основной спрос | Логистика |\n|------|------|---------|--------|\n| 🇺🇿 **Узбекистан** | **+256.77%** | Хлопкоуборочные | Ж/д Китай-Кыргызстан-Узбекистан |\n| 🇰🇪 **Кения(Африка)** | **+46.6%** | Тракторы 50-100 л.с. | Порт Момбаса |\n| 🇮🇩 **Индонезия(ЮВА)** | **+121.07%** | Мотоблоки | RCEP пошлины, 20 дней морем |`,
    actionTips: ["乌兹别克50%政府补贴融资方案设计","非洲主推50-100HP拖拉机","印尼RCEP关税优惠小型农机走量"],
    dataSummary: [{label:"乌兹别克",value:"+256.77%全球最快"},{label:"肯尼亚",value:"+46.6%"},{label:"印尼",value:"+121.07%"}],
  },
  // ========== sortOrder=11: ECB 6月会议前瞻+下周操作建议 ==========
  {
    icon: "📋", region: "全球", regionEn: "Global", regionRu: "Глобально",
    tags: ["ECB加息","下周操作","11项行动"],
    tagsEn: ["ECB Hike","Next Week Plan","11 Actions"],
    tagsRu: ["ECB повышение","План нед.","11 действий"],
    text: "🔴ECB 6月议息会议下周四(6/26)重磅来袭！预期加息25bp，附下周11项操作重点",
    textEn: "🔴 ECB June meeting next Thursday (6/26) major event! Expected +25bp rate hike, with 11 next-week action priorities",
    textRu: "🔴 Заседание ЕЦБ в июне в следующий четверг (26.06) ключевое событие! Ожидается повышение на 25бп, 11 приоритетов действий",
    detailedContent: `## ECB 6月会议前瞻 + 下周(6/23-6/27)操作重点\n\n**🔴 下周四ECB 6月议息会议为下周最重磅事件**\n\n### ECB会议情景预演\n| 情景 | 概率 | EUR/CNY走势 | 套利影响 | 操作策略 |\n|------|------|-------------|----------|----------|\n| **加息25bp** | 65% | 7.80-7.85 ✅ | 利好，价差扩大 | 加速询价，锁定中长期 |\n| **意外不加息** | 25% | 7.65-7.70 ⚠️ | 价差压缩 | 暂停欧元定价订单 |\n| 降息 | 10% | 7.55-7.60 ❌ | 急剧压缩 | 立即调整所有报价 |\n\n### 下周操作重点\n| 优先级 | 操作 | 详情 |\n|--------|------|------|\n| 1 | 🔴 EUR/CNY 7.75支撑观察 | 周一开盘重点关注 |\n| 2 | 🔴 ECB会议准备 | 加息/不加息情景分析 |\n| 3 | FR450爆款速推 | 21.5万/台+101.4%，10台走量 |\n| 4 | BP1290东欧推量 | 95.0%价差率（64.6万利润） |\n| 5 | 5300RC(2020)确认车况 | 331.1%价差率第一 |\n| 6 | 950(2018)新机会 | 43.1%价差率（40.9万利润） |\n| 7 | 980供给井喷议价 | 14条在售，主动邮件获取报价 |\n| 8 | BigM 420东欧推进 | 58.4%价差率 |\n| 9 | 970(2017)继续出口 | 50.2%价差率（81.8万利润） |\n| 10 | CIPS人民币结算推进 | 俄/中东客户 |\n| 11 | AGRO 2026展前准备 | 俄语/乌语资料翻译 |\n\n### 本周套利空间演变\n| 日期 | EUR/CNY | 5300RC(20) | 980(16) | 970(17) | BP1290(20) |\n|------|---------|-----------|---------|---------|------------|\n| 6/16 | 7.8480 | 335.6% | 73.1% | 51.8% | 95.7% |\n| 6/20 | 7.7681 | 331.1% | 71.2% | 50.2% | 95.0% |\n| **周变** | **-1.02%** | **-4.5pp** | **-1.9pp** | **-1.6pp** | **-0.7pp** |`,
    detailedContentEn: `## ECB June Meeting Preview + Next Week (6/23-6/27) Action Plan\n\n**🔴 ECB June meeting next Thursday is the biggest event next week**\n\n### ECB Scenarios\n| Scenario | Prob | EUR/CNY | Arbitrage Impact | Strategy |\n|------|------|-------------|----------|----------|\n| **+25bp hike** | 65% | 7.80-7.85 ✅ | Positive, spread expands | Accelerate inquiries, lock medium-term |\n| **No hike** | 25% | 7.65-7.70 ⚠️ | Spread compresses | Pause EUR orders |\n| Rate cut | 10% | 7.55-7.60 ❌ | Sharp compression | Adjust all quotes immediately |\n\n### Top Priority for Next Week\n1. 🔴 EUR/CNY 7.75 support monitoring\n2. 🔴 ECB meeting preparation\n3. FR450 hot seller push (101.4%)\n4. BP1290 Eastern Europe (95.0%)\n5. 5300RC(2020) condition confirmation (331.1%)\n6. 950(2018) new opportunity (43.1%)\n7. 980 supply surge negotiation\n8. BigM 420 Eastern Europe push\n9. 970(2017) export continue\n10. CIPS RMB settlement promotion\n11. AGRO 2026 exhibition prep`,
    detailedContentRu: `## Предпросмотр заседания ЕЦБ в июне + план действий на неделю (23-27.06)\n\n**🔴 Заседание ЕЦБ в следующий четверг — самое важное событие недели**\n\n### Сценарии ЕЦБ\n| Сценарий | Вероят. | EUR/CNY | Влияние на арбитраж | Стратегия |\n|------|------|-------------|----------|----------|\n| **+25бп** | 65% | 7.80-7.85 ✅ | Разница расширяется | Ускорить запросы |\n| **Без изменений** | 25% | 7.65-7.70 ⚠️ | Сжатие | Приостановить заказы |\n| Снижение | 10% | 7.55-7.60 ❌ | Резкое сжатие | Скорректировать всё |`,
    actionTips: ["ECB会议前加速锁定现有欧元计价订单","FR450+BP1290优先推，汇率敏感度最低","周一开盘重点观察EUR/CNY 7.75方向"],
    dataSummary: [{label:"ECB加息概率",value:"65%"},{label:"EUR/CNY本周",value:"-1.02%至7.7681"},{label:"下周核心事件",value:"ECB 6/26会议"}],
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
        date: TODAY,
        icon: item.icon,
        region: item.region,
        regionEn: item.regionEn || null,
        regionRu: item.regionRu || null,
        tags: Array.isArray(item.tags) ? JSON.stringify(item.tags) : item.tags,
        tagsEn: Array.isArray(item.tagsEn) ? JSON.stringify(item.tagsEn) : (item.tagsEn || null),
        tagsRu: Array.isArray(item.tagsRu) ? JSON.stringify(item.tagsRu) : (item.tagsRu || null),
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
  console.log(`已导入 ${ALL_MARKET_INTEL.length} 条情报数据 (日期: 2026-06-21)`);
  console.log("验证: 5070在sortOrder=0, 其余11条从1开始");
  
  // 验证
  const count = await prisma.marketIntel.count({ where: { date: TODAY } });
  const firstItem = await prisma.marketIntel.findFirst({ where: { date: TODAY, sortOrder: 0 } });
  console.log(`数据库记录数: ${count}`);
  console.log(`第一条 (sortOrder=0): ${firstItem ? firstItem.text.substring(0, 50) : 'ERROR - NOT FOUND'}`);
  
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
