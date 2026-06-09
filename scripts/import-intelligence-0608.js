/**
 * 导入2026-06-08市场情报数据到数据库
 * 基于 2026-06-08_跨境套利日报.md 生成
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const TODAY = new Date("2026-06-08");

const ALL_MARKET_INTEL = [
  {
    icon: "🇷🇺", region: "俄罗斯", tags: ["EU制裁", "替代窗口"], date: TODAY,
    text: "EU第20轮对俄制裁落地！新增120项制裁清单，欧美农机配件断供加剧，中国设备替代窗口持续扩大",
    textEn: "EU 20th round of sanctions on Russia enacted! 120 new items added, Western agricultural machinery parts supply disrupted, Chinese equipment substitution window continues to expand",
    textRu: "20-й раунд санкций ЕС против России вступил в силу! Добавлено 120 позиций, перебои в поставках запчастей западной сельхозтехники, окно замены китайским оборудованием продолжает расширяться",
    regionEn: "Russia", regionRu: "Россия",
    tagsEn: '["EU Sanctions", "Substitution Window"]', tagsRu: '["Санкции ЕС", "Окно замены"]',
    detailedContent: `## EU第20轮对俄制裁深度影响\n\n**制裁背景：** 4月23日EU发布第20轮对俄制裁，新增120项制裁清单，为2年来最大规模。\n\n### 对农机市场的影响\n| 影响维度 | 具体变化 |\n|---------|--------|\n| 欧美配件断供 | CLAAS/Deere/Kubota配件供应中断加剧 |\n| 中国设备替代 | 二手中国农机不受制裁限制 |\n| 俄优先产业 | 2026年农机排第一，5%低关税+政府补贴 |\n| 物流通道 | 中俄铁路运输正常，30-40天到货 |\n\n### 行动建议\n- 重点推CLAAS二手系列：970/980/850均符合俄市场刚需\n- 提供俄语说明书+配件供应承诺增强信任\n- 建立莫斯科/新西伯利亚备件前置仓`,
    detailedContentEn: `## Deep Impact of EU 20th Round Sanctions on Russia\n\n**Background:** EU published the 20th round of sanctions on April 23, adding 120 new items — the largest in 2 years.\n\n### Impact on Agricultural Machinery Market\n| Impact Dimension | Specific Changes |\n|---------|--------|\n| Western parts disruption | CLAAS/Deere/Kubota parts supply increasingly interrupted |\n| Chinese equipment substitution | Used Chinese machinery not subject to sanctions |\n| Russia priority industry | Agricultural machinery ranked #1 in 2026, 5% low tariff + gov subsidies |\n| Logistics channel | China-Russia rail transport normal, 30-40 day delivery |\n\n### Action Recommendations\n- Focus on CLAAS used series: 970/980/850 all meet Russian market demand\n- Provide Russian manuals + parts supply commitment to enhance trust\n- Establish Moscow/Novosibirsk parts forward warehouse`,
    detailedContentRu: `## Глубокое влияние 20-го раунда санкций ЕС на Россию\n\n**Предыстория:** ЕС опубликовал 20-й раунд санкций 23 апреля, добавив 120 новых позиций — крупнейший за 2 года.\n\n### Влияние на рынок сельхозтехники\n| Измерение | Конкретные изменения |\n|---------|--------|\n| Перебои с запчастями | Поставки запчастей CLAAS/Deere/Kubota всё больше прерываются |\n| Замена китайским оборудованием | Б/у китайская техника не подпадает под санкции |\n| Приоритетная отрасль РФ | Сельхозмашиностроение №1 в 2026, 5% низкая пошлина + господдержка |\n| Логистика | Китайско-российские ж/д перевозки в норме, 30-40 дней доставки |\n\n### Рекомендации\n- Акцент на б/у серию CLAAS: 970/980/850 — всё соответствует спросу российского рынка\n- Предоставить русские инструкции + обязательства по поставке запчастей\n- Создать склад запчастей в Москве/Новосибирске`,
    actionTips: ["重点推CLAAS二手970/980替代欧美断供机型", "承诺配件供应增强买家信心", "利用5%低关税+政府补贴政策促销"],
  },
  {
    icon: "💶", region: "欧洲", tags: ["Agroline", "2025款970"], date: TODAY,
    text: "2025款Jaguar 970首次现身Agroline！€507,300(579h)，为平台最高价，970系列保值性极强",
    textEn: "2025 Jaguar 970 first appears on Agroline! €507,300 (579h), platform's highest price, 970 series retains value strongly",
    textRu: "Jaguar 970 2025 года впервые на Agroline! €507,300 (579 моточасов), самая высокая цена на платформе, серия 970 сильно удерживает стоимость",
    regionEn: "Europe", regionRu: "Европа",
    tagsEn: '["Agroline", "2025 970"]', tagsRu: '["Agroline", "970 2025"]',
    detailedContent: `## 2025款Jaguar 970首次出现\n\n**核心发现：** 波兰克日扎努夫，CLAAS POLSKA经销商出售，579h，€507,300\n\n### 970系列价格分布\n| 年份 | 最低价(EUR) | 最高价(EUR) | 均价(EUR) |\n|------|-----------|-----------|--------|\n| 2025 | €507,300 | €507,300 | €507,300 |\n| 2024 | €329,000 | €475,000 | €415,000 |\n| 2022-2023 | €325,000 | €550,000 | €430,000 |\n| 2020-2021 | €300,470 | €428,400 | €360,000 |\n| 2019及以前 | €65,000 | €323,114 | €210,000 |\n\n### 保值性分析\n- 2017款国内163万 vs 2025款国际395.7万\n- 8年折价率仅58.8%，远低于行业均值70%+\n- 970系列为CLAAS青储机旗舰，需求刚性`,
    detailedContentEn: `## 2025 Jaguar 970 First Sighting\n\n**Key Finding:** Krzyzanow, Poland, CLAAS POLSKA dealer, 579h, €507,300\n\n### 970 Series Price Distribution\n| Year | Lowest(EUR) | Highest(EUR) | Average(EUR) |\n|------|-----------|-----------|--------|\n| 2025 | €507,300 | €507,300 | €507,300 |\n| 2024 | €329,000 | €475,000 | €415,000 |\n| 2022-2023 | €325,000 | €550,000 | €430,000 |\n| 2020-2021 | €300,470 | €428,400 | €360,000 |\n| 2019 & earlier | €65,000 | €323,114 | €210,000 |\n\n### Value Retention Analysis\n- 2017 domestic CNY 1.63M vs 2025 international CNY 3.957M\n- 8-year depreciation only 58.8%, well below industry average of 70%+\n- 970 series is CLAAS forage harvester flagship, inelastic demand`,
    detailedContentRu: `## Первое появление Jaguar 970 2025 года\n\n**Ключевая находка:** Кшижанов, Польша, дилер CLAAS POLSKA, 579 моточасов, €507,300\n\n### Распределение цен серии 970\n| Год | Мин.(EUR) | Макс.(EUR) | Средн.(EUR) |\n|------|-----------|-----------|--------|\n| 2025 | €507,300 | €507,300 | €507,300 |\n| 2024 | €329,000 | €475,000 | €415,000 |\n| 2022-2023 | €325,000 | €550,000 | €430,000 |\n| 2020-2021 | €300,470 | €428,400 | €360,000 |\n| 2019 и ранее | €65,000 | €323,114 | €210,000 |\n\n### Анализ сохранения стоимости\n- 2017 внутренний 1.63 млн юаней vs 2025 международный 3.957 млн юаней\n- Амортизация за 8 лет всего 58.8%, значительно ниже среднеотраслевых 70%+\n- Серия 970 — флагман силосоуборочных комбайнов CLAAS, неэластичный спрос`,
    actionTips: ["970(163万)重点推向俄语区+乌克兰买家", "制作EU vs CN价格对比表", "利用2025款高价锚点凸显2017款性价比"],
    dataSummary: [{ label: "2025款€507K", value: "平台最高" }, { label: "970在售", value: "32台" }],
  },
  {
    icon: "🇺🇦", region: "乌克兰", tags: ["基辅970", "战后重建"], date: TODAY,
    text: "乌克兰基辅970(2016)直接挂牌Agroline！1920h，反映战后农业重建对青储机的刚性需求",
    textEn: "Kyiv Ukraine 970(2016) listed directly on Agroline! 1920h, reflects post-war agricultural reconstruction demand for forage harvesters",
    textRu: "Киев, Украина: 970(2016) напрямую на Agroline! 1920 моточасов, отражает спрос на силосоуборочные комбайны в ходе послевоенного восстановления",
    regionEn: "Ukraine", regionRu: "Украина",
    tagsEn: '["Kyiv 970", "Post-war Reconstruction"]', tagsRu: '["Киев 970", "Послевоенное восстановление"]',
    detailedContent: `## 乌克兰基辅970渠道分析\n\n**关键信号：** Agroline发现970(2016, 1920h)直接在乌克兰基辅挂牌，价格待询。\n\n### 乌克兰市场动态\n| 指标 | 数值 |\n|------|------|\n| 2026年1-2月农产品出口 | 9.95万吨(+9.3%) |\n| AGRO 2026展 | 7月基辅，第34届 |\n| 黑海+多瑙河路线 | 已恢复运行 |\n| 粮食出口增长 | USDA确认2026/27增产 |\n\n### 为什么重要？\n1. 970直接在乌克兰挂牌 = 乌克兰买家有购买意愿\n2. 2016年/1920h = 中等工况，适合出口\n3. AGRO 2026展7月举办 = 需求窗口打开\n4. 黑海贸易路线恢复 = 物流可行`,
    detailedContentEn: `## Ukraine Kyiv 970 Channel Analysis\n\n**Key Signal:** Agroline found 970(2016, 1920h) listed directly in Kyiv, Ukraine, price on request.\n\n### Ukraine Market Dynamics\n| Indicator | Value |\n|------|------|\n| Jan-Feb 2026 agricultural exports | 99.5K tons (+9.3%) |\n| AGRO 2026 Exhibition | July, Kyiv, 34th edition |\n| Black Sea + Danube routes | Operational |\n| Grain export growth | USDA confirms 2026/27 increase |\n\n### Why It Matters\n1. 970 listed directly in Ukraine = Ukrainian buyers have purchase intent\n2. 2016/1920h = Moderate condition, suitable for export\n3. AGRO 2026 exhibition in July = Demand window opening\n4. Black Sea trade routes restored = Logistics feasible`,
    detailedContentRu: `## Анализ канала 970 в Киеве, Украина\n\n**Ключевой сигнал:** На Agroline найден 970(2016, 1920 моточасов) напрямую в Киеве, Украина, цена по запросу.\n\n### Динамика рынка Украины\n| Показатель | Значение |\n|------|------|\n| Экспорт с/х продукции янв-фев 2026 | 99.5 тыс. тонн (+9.3%) |\n| Выставка AGRO 2026 | Июль, Киев, 34-я |\n| Маршруты Чёрного моря + Дуная | Действуют |\n| Рост экспорта зерна | USDA подтверждает рост 2026/27 |\n\n### Почему это важно\n1. 970 выставлен напрямую в Украине = украинские покупатели имеют намерение купить\n2. 2016/1920 моточасов = среднее состояние, подходит для экспорта\n3. Выставка AGRO 2026 в июле = окно спроса открывается\n4. Торговые маршруты Чёрного моря восстановлены = логистика реальна`,
    actionTips: ["970出口乌克兰定价参考基辅挂牌价", "7月AGRO展前完成线上对接", "黑海+多瑙河双通道物流方案"],
  },
  {
    icon: "📊", region: "中国", tags: ["980套利王", "74.5%价差"], date: TODAY,
    text: "Jaguar 980(2016)全系列最高套利标的！EU€320K→249.6万 vs 国内143万，价差106.6万(74.5%)",
    textEn: "Jaguar 980(2016) highest arbitrage target in the lineup! EU€320K→CNY2.496M vs domestic CNY1.43M, spread CNY1.066M (74.5%)",
    textRu: "Jaguar 980(2016) — самая прибыльная арбитражная цель! ЕС€320K→2.496 млн юаней vs внутренние 1.43 млн, разница 1.066 млн (74.5%)",
    regionEn: "China", regionRu: "Китай",
    tagsEn: '["980 Arbitrage King", "74.5% Spread"]', tagsRu: '["980 Арбитражный король", "74.5% разница"]',
    detailedContent: `## Jaguar 980 套利分析\n\n**核心标的：** CLAAS Jaguar 980 (2016)，EU €320K(法国厄尔省) = 249.6万元\n\n### 套利对比\n| 机型 | 国际价 | 国内价 | 价差 | 价差率 |\n|------|--------|--------|------|--------|\n| **980(2016)** | 249.6万 | 143万 | **106.6万** | **74.5%** ⭐⭐⭐⭐⭐ |\n| 5300RC(2022) | 144.3万 | 95万 | 49.3万 | 51.9% |\n| FR450(2013) | 43.3万 | 21.5万 | 21.8万 | 101.4% |\n| BigM 420(2018) | 78.0万 | 49万 | 29.0万 | 59.2% |\n\n### 980操作建议\n- 优先推俄语区+乌克兰买家\n- 74.5%价差率为全系列最高\n- AGRO 2026展7月前应完成至少1台出口`,
    detailedContentEn: `## Jaguar 980 Arbitrage Analysis\n\n**Core Target:** CLAAS Jaguar 980 (2016), EU €320K (Eure, France) = CNY 2.496M\n\n### Arbitrage Comparison\n| Model | International | Domestic | Spread | Spread Rate |\n|------|--------|--------|------|--------|\n| **980(2016)** | CNY 2.496M | CNY 1.43M | **CNY 1.066M** | **74.5%** ⭐⭐⭐⭐⭐ |\n| 5300RC(2022) | CNY 1.443M | CNY 0.95M | CNY 0.493M | 51.9% |\n| FR450(2013) | CNY 0.433M | CNY 0.215M | CNY 0.218M | 101.4% |\n| BigM 420(2018) | CNY 0.780M | CNY 0.49M | CNY 0.290M | 59.2% |\n\n### 980 Action Recommendations\n- Prioritize Russian-speaking region + Ukrainian buyers\n- 74.5% spread rate is the highest in the lineup\n- Complete at least 1 unit export before AGRO 2026 in July`,
    detailedContentRu: `## Арбитражный анализ Jaguar 980\n\n**Основная цель:** CLAAS Jaguar 980 (2016), ЕС €320K (Эр, Франция) = 2.496 млн юаней\n\n### Арбитражное сравнение\n| Модель | Международная | Внутренняя | Разница | Ставка разницы |\n|------|--------|--------|------|--------|\n| **980(2016)** | 2.496 млн | 1.43 млн | **1.066 млн** | **74.5%** ⭐⭐⭐⭐⭐ |\n| 5300RC(2022) | 1.443 млн | 0.95 млн | 0.493 млн | 51.9% |\n| FR450(2013) | 0.433 млн | 0.215 млн | 0.218 млн | 101.4% |\n| BigM 420(2018) | 0.780 млн | 0.49 млн | 0.290 млн | 59.2% |\n\n### Рекомендации по 980\n- Приоритет: русскоязычный регион + покупатели из Украины\n- 74.5% ставка разницы — самая высокая в линейке\n- Завершить экспорт минимум 1 ед. до выставки AGRO 2026 в июле`,
    actionTips: ["980加速俄语区成交，74.5%全系列最高", "AGRO展前完成1台980出口乌克兰", "980+970组合方案提升客单价"],
    dataSummary: [{ label: "980价差", value: "106.6万(74.5%)" }, { label: "980在售", value: "3台" }],
  },
  {
    icon: "🇨🇳", region: "中国", tags: ["FR450爆款", "101.4%价差"], date: TODAY,
    text: "New Holland FR450(2013)汇率影响最小+101.4%价差率！21.5万/台，10台库存走量爆款",
    textEn: "New Holland FR450(2013) least FX impact + 101.4% spread rate! CNY 215K/unit, 10 units in stock volume seller",
    textRu: "New Holland FR450(2013) минимальное влияние валют + 101.4% разница! 215 тыс. юаней/ед., 10 ед. на складе — хит продаж",
    regionEn: "China", regionRu: "Китай",
    tagsEn: '["FR450 Hot Seller", "101.4% Spread"]', tagsRu: '["FR450 хит", "101.4% разница"]',
    detailedContent: `## FR450爆款速推\n\n**核心优势：** 一口价21.5万/台 + 101.4%价差率 + 汇率波动影响最小\n\n### FR450套利分析\n| 指标 | 数值 |\n|------|------|\n| 国内售价 | 21.5万/台 |\n| 俄市场参考价 | 43.3万 |\n| 价差 | 21.8万 |\n| 价差率 | **101.4%** |\n| 库存 | **10台** |\n| 汇率敏感度 | 低（绝对价差小） |\n\n### 为什么是爆款？\n1. 101.4%价差率 → 翻倍利润\n2. 21.5万低门槛 → 买家决策快\n3. 10台库存 → 走量模式\n4. 汇率波动影响小 → 利润确定性高`,
    detailedContentEn: `## FR450 Hot Seller Push\n\n**Core Advantage:** Fixed price CNY 215K/unit + 101.4% spread rate + minimal FX impact\n\n### FR450 Arbitrage Analysis\n| Indicator | Value |\n|------|------|\n| Domestic price | CNY 215K/unit |\n| Russian market reference | CNY 433K |\n| Spread | CNY 218K |\n| Spread rate | **101.4%** |\n| Inventory | **10 units** |\n| FX sensitivity | Low (small absolute spread) |\n\n### Why It's a Hot Seller\n1. 101.4% spread rate → Double profit\n2. CNY 215K low barrier → Fast buyer decisions\n3. 10 units inventory → Volume model\n4. Minimal FX impact → High profit certainty`,
    detailedContentRu: `## FR450 — хит продаж\n\n**Главное преимущество:** фиксированная цена 215 тыс. юаней/ед. + 101.4% разница + минимальное влияние валют\n\n### Арбитражный анализ FR450\n| Показатель | Значение |\n|------|------|\n| Внутренняя цена | 215 тыс. юаней/ед. |\n| Справочная цена на рынке РФ | 433 тыс. юаней |\n| Разница | 218 тыс. юаней |\n| Ставка разницы | **101.4%** |\n| Остаток на складе | **10 ед.** |\n| Чувствительность к валютам | Низкая |\n\n### Почему это хит\n1. 101.4% разница → двойная прибыль\n2. Низкий порог 215 тыс. → быстрое решение покупателя\n3. 10 ед. на складе → модель объёмных продаж\n4. Минимальное влияние валют → высокая определённость прибыли`,
    actionTips: ["FR450俄语区批量速推10台", "21.5万低门槛吸引小型买家", "一口价策略加速成交"],
    dataSummary: [{ label: "FR450价差", value: "101.4%" }, { label: "库存", value: "10台" }],
  },
  {
    icon: "🌏", region: "东南亚", tags: ["印尼爆发", "+121%"], date: TODAY,
    text: "印尼农机进口+121.07%爆发式增长！中泰农机协议推进中，东南亚成新增长极",
    textEn: "Indonesia agricultural machinery imports +121.07% explosive growth! China-Thailand agricultural machinery agreement advancing, Southeast Asia becoming new growth pole",
    textRu: "Импорт сельхозтехники в Индонезию +121.07% взрывной рост! Китайско-тайское соглашение о сельхозтехнике продвигается, Юго-Восточная Азия — новый полюс роста",
    regionEn: "Southeast Asia", regionRu: "Юго-Восточная Азия",
    tagsEn: '["Indonesia Surge", "+121%"]', tagsRu: '["Взрывной рост Индонезии", "+121%"]',
    detailedContent: `## 东南亚农机市场更新\n\n### 区域数据\n| 国家 | 增速 | 主力机型 |\n|------|------|--------|\n| 🇮🇩 印尼 | **+121.07%** | 微耕机/小型收割机 |\n| 🇹🇭 泰国 | 中速 | 插秧机/收割机 |\n| 🇵🇭 菲律宾 | 快速 | 手扶拖拉机/收割机 |\n| 🇻🇳 越南 | 中速 | 插秧机/烘干机 |\n\n### 机会点\n- 印尼+121.07%为全球增速前三\n- 中泰农机协议推进，降低贸易壁垒\n- 小型农机需求旺盛，中国品牌优势明显`,
    detailedContentEn: `## Southeast Asia Agricultural Machinery Market Update\n\n### Regional Data\n| Country | Growth | Key Models |\n|------|------|--------|\n| 🇮🇩 Indonesia | **+121.07%** | Mini tillers / Small harvesters |\n| 🇹🇭 Thailand | Moderate | Rice transplanters / Harvesters |\n| 🇵🇭 Philippines | Fast | Walking tractors / Harvesters |\n| 🇻🇳 Vietnam | Moderate | Rice transplanters / Dryers |\n\n### Opportunities\n- Indonesia +121.07% ranks among top 3 globally\n- China-Thailand agreement advancing, reducing trade barriers\n- Small machinery demand strong, Chinese brands have clear advantages`,
    detailedContentRu: `## Обновление рынка сельхозтехники Юго-Восточной Азии\n\n### Региональные данные\n| Страна | Рост | Основные модели |\n|------|------|--------|\n| 🇮🇩 Индонезия | **+121.07%** | Мотоблоки / Малые комбайны |\n| 🇹🇭 Таиланд | Умеренный | Рассадопосадочные / Комбайны |\n| 🇵🇭 Филиппины | Быстрый | Мотоблоки / Комбайны |\n| 🇻🇳 Вьетнам | Умеренный | Рассадопосадочные / Сушилки |\n\n### Возможности\n- Индонезия +121.07% — в топ-3 по темпам роста в мире\n- Китайско-тайское соглашение продвигается, снижение торговых барьеров\n- Спрос на малую технику высокий, китайские бренды имеют явные преимущества`,
    actionTips: ["印尼市场优先布局小型拖拉机+收割机", "对接中泰农机协议降低出口门槛", "提供印尼语产品资料"],
  },
  {
    icon: "🇺🇿", region: "乌兹别克斯坦", tags: ["增速最快", "+256%"], date: TODAY,
    text: "乌兹别克斯坦Q1进口增长256.77%全球最快！棉花采收机械化率不足40%，需求空间巨大",
    textEn: "Uzbekistan Q1 import growth +256.77% globally fastest! Cotton harvesting mechanization rate below 40%, massive demand space",
    textRu: "Узбекистан рост импорта за Q1 +256.77% — самый быстрый в мире! Механизация хлопкоуборки ниже 40%, огромный потенциал спроса",
    regionEn: "Uzbekistan", regionRu: "Узбекистан",
    tagsEn: '["Fastest Growth", "+256%"]', tagsRu: '["Самый быстрый рост", "+256%"]',
    detailedContent: `## 乌兹别克斯坦市场持续爆发\n\n### 核心数据\n| 指标 | 数值 |\n|------|------|\n| Q1进口增速 | **+256.77%** |\n| 棉花采收机械化率 | 不足40% |\n| 政府补贴 | 农机购置补贴50% |\n| 物流 | 中吉乌铁路建设加速 |\n\n### 推荐机型\n| 品类 | 推荐型号 | 报价 |\n|------|---------|------|\n| 青储收获机 | CLAAS 850/860 | 60-120万 |\n| 拖拉机 | NH/Deer 100-200HP | 30-80万 |\n| 打捆机 | Krone 500/600 | 15-40万 |\n\n### 行动重点\n- 重点关注棉花采收相关机型\n- 利用政府50%补贴设计融资方案\n- 中吉乌铁路建成后物流将更便捷`,
    detailedContentEn: `## Uzbekistan Market Continues to Surge\n\n### Core Data\n| Indicator | Value |\n|------|------|\n| Q1 import growth | **+256.77%** |\n| Cotton harvesting mechanization | Below 40% |\n| Government subsidies | 50% machinery purchase subsidy |\n| Logistics | China-Kyrgyzstan-Uzbekistan railway accelerating |\n\n### Recommended Models\n| Category | Recommended | Price |\n|------|---------|------|\n| Forage harvester | CLAAS 850/860 | CNY 600K-1.2M |\n| Tractors | NH/Deere 100-200HP | CNY 300K-800K |\n| Balers | Krone 500/600 | CNY 150K-400K |\n\n### Action Focus\n- Focus on cotton harvesting related models\n- Design financing using 50% government subsidy\n- Logistics will be more convenient after China-Kyrgyzstan-Uzbekistan railway completion`,
    detailedContentRu: `## Рынок Узбекистана продолжает бурный рост\n\n### Основные данные\n| Показатель | Значение |\n|------|------|\n| Рост импорта за Q1 | **+256.77%** |\n| Механизация хлопкоуборки | Ниже 40% |\n| Госпособия | 50% субсидия на покупку техники |\n| Логистика | Строительство ж/д Китай-Кыргызстан-Узбекистан ускоряется |\n\n### Рекомендуемые модели\n| Категория | Рекомендация | Цена |\n|------|---------|------|\n| Силосоуборочные | CLAAS 850/860 | 600 тыс.-1.2 млн юаней |\n| Тракторы | NH/Deere 100-200 л.с. | 300-800 тыс. юаней |\n| Пресс-подборщики | Krone 500/600 | 150-400 тыс. юаней |\n\n### Основные действия\n- Акцент на модели для уборки хлопка\n- Разработать финансовые решения с использованием 50% господдержки\n- После завершения ж/д Китай-Кыргызстан-Узбекистан логистика станет удобнее`,
    actionTips: ["乌兹别克语+俄语版产品手册优先制作", "棉花采收机型重点推广", "50%政府补贴融资方案设计"],
  },
  {
    icon: "💶", region: "欧洲", tags: ["汇率预警", "周一开盘"], date: TODAY,
    text: "EUR/CNY周一开盘偏弱！市场实时约7.80，央行中间价待9:15更新，短期套利空间可能收窄2-3%",
    textEn: "EUR/CNY opens weak on Monday! Market real-time ~7.80, PBOC midpoint pending 9:15 update, short-term arbitrage space may narrow 2-3%",
    textRu: "EUR/CNY открылся слабо в понедельник! Рыночный курс ~7.80, средний курс НБК ожидается в 9:15, краткосрочное арбитражное пространство может сузиться на 2-3%",
    regionEn: "Europe", regionRu: "Европа",
    tagsEn: '["FX Alert", "Monday Open"]', tagsRu: '["Валютное предупреждение", "Открытие понедельника"]',
    detailedContent: `## 汇率预警\n\n**今日汇率状态：** 周一开盘，央行中间价沿用上周五(6月5日)\n\n### 汇率快照\n| 货币对 | 央行中间价 | 中行现汇卖出 | 市场实时 |\n|--------|----------|------------|--------|\n| EUR/CNY | 7.8919(6月5日) | 7.8561 | ~7.80 |\n| USD/CNY | 6.8157(6月5日) | 6.8076 | ~6.80 |\n\n### 风险评估\n- 欧元偏弱，若央行中间价下调至7.86以下\n- EUR计价出口利润率将收窄2-3%\n- 建议加速锁定现有合同\n- 可通过CIPS人民币结算对冲汇率风险`,
    detailedContentEn: `## FX Alert\n\n**Today's FX Status:** Monday open, PBOC midpoint carried from last Friday (June 5)\n\n### FX Snapshot\n| Pair | PBOC Midpoint | BOC Selling | Market Real-time |\n|--------|----------|------------|--------|\n| EUR/CNY | 7.8919 (June 5) | 7.8561 | ~7.80 |\n| USD/CNY | 6.8157 (June 5) | 6.8076 | ~6.80 |\n\n### Risk Assessment\n- Euro weak; if PBOC midpoint drops below 7.86\n- EUR-denominated export margins will narrow 2-3%\n- Recommend accelerating contract locks\n- Can hedge FX risk via CIPS RMB settlement`,
    detailedContentRu: `## Валютное предупреждение\n\n**Статус валют сегодня:** Открытие понедельника, средний курс НБК перенесён с прошлой пятницы (5 июня)\n\n### Снимок валют\n| Пара | Средний НБК | Продажа БК Китая | Рыночный курс |\n|--------|----------|------------|--------|\n| EUR/CNY | 7.8919 (5 июня) | 7.8561 | ~7.80 |\n| USD/CNY | 6.8157 (5 июня) | 6.8076 | ~6.80 |\n\n### Оценка рисков\n- Евро слабеет; если средний курс НБК упадёт ниже 7.86\n- Маржинальность экспорта в EUR снизится на 2-3%\n- Рекомендуется ускорить фиксацию текущих контрактов\n- Можно хеджировать валютные риски через расчёты в юанях CIPS`,
    actionTips: ["若EUR/CNY下调，加速锁定现有合同", "通过CIPS人民币结算对冲汇率风险", "980/FR450等高价差产品优先出货"],
  },
  {
    icon: "🇧🇷", region: "巴西", tags: ["5300RC", "触底反弹"], date: TODAY,
    text: "巴西Q1销量-13.1%但进口替代加速！5300RC(95万全新)核心受益，51.9%价差空间",
    textEn: "Brazil Q1 sales -13.1% but import substitution accelerating! 5300RC (CNY 950K brand new) core beneficiary, 51.9% spread space",
    textRu: "Продажи в Бразилии Q1 -13.1%, но импортное замещение ускоряется! 5300RC (950 тыс. юаней новый) — основной бенефициар, разница 51.9%",
    regionEn: "Brazil", regionRu: "Бразилия",
    tagsEn: '["5300RC", "Bottom Rebound"]', tagsRu: '["5300RC", "Отскок от дна"]',
    detailedContent: `## 巴西农机市场\n\n### 市场现状\n| 指标 | 数值 |\n|------|------|\n| Q1销量增速 | -13.1% |\n| 进口替代 | 加速中 |\n| 5300RC国内价 | 95万(全新) |\n| 国际同级参考 | €185K(144.3万) |\n| 价差率 | **51.9%** |\n| 关税 | 14%+审批流程 |\n\n### 5300RC巴西机会\n- 全新大方捆(95万)→巴西市场核心标的\n- 14%关税需提前完成审批\n- 交货周期35-45天\n- 建议制作葡萄牙语产品手册`,
    detailedContentEn: `## Brazil Agricultural Machinery Market\n\n### Market Status\n| Indicator | Value |\n|------|------|\n| Q1 sales growth | -13.1% |\n| Import substitution | Accelerating |\n| 5300RC domestic price | CNY 950K (brand new) |\n| International reference | €185K (CNY 1.443M) |\n| Spread rate | **51.9%** |\n| Tariff | 14% + approval process |\n\n### 5300RC Brazil Opportunity\n- Brand new large square baler (CNY 950K) → core target for Brazil\n- 14% tariff requires advance approval\n- Delivery cycle 35-45 days\n- Recommend Portuguese product manual`,
    detailedContentRu: `## Рынок сельхозтехники Бразилии\n\n### Состояние рынка\n| Показатель | Значение |\n|------|------|\n| Рост продаж Q1 | -13.1% |\n| Импортное замещение | Ускоряется |\n| 5300RC внутренняя цена | 950 тыс. юаней (новый) |\n| Международная справочная | €185K (1.443 млн юаней) |\n| Ставка разницы | **51.9%** |\n| Пошлина | 14% + процесс одобрения |\n\n### Возможности 5300RC в Бразилии\n- Новый большой пресс-подборщик (950 тыс. юаней) → основная цель для Бразилии\n- 14% пошлина требует предварительного одобрения\n- Цикл поставки 35-45 дней\n- Рекомендуется руководство на португальском языке`,
    actionTips: ["5300RC优先推送巴西买家", "提前完成巴西14%关税审批", "制作葡萄牙语产品手册"],
  },
  {
    icon: "🇰🇿", region: "哈萨克斯坦", tags: ["物流优势", "免关税"], date: TODAY,
    text: "中欧铁路直达15-20天到货！哈萨克斯坦免关税+霍尔果斯口岸2天快速通关",
    textEn: "China-Europe railway direct delivery 15-20 days! Kazakhstan duty-free + Khorgos port 2-day fast customs clearance",
    textRu: "Прямая доставка по ж/д Китай-Европа 15-20 дней! Казахстан без пошлин + быстрое оформление через Хоргос за 2 дня",
    regionEn: "Kazakhstan", regionRu: "Казахстан",
    tagsEn: '["Logistics Advantage", "Duty-Free"]', tagsRu: '["Логистическое преимущество", "Без пошлин"]',
    detailedContent: `## 哈萨克斯坦物流优势\n\n### 通道对比\n| 指标 | 中欧铁路 | 海运(替代) |\n|------|---------|----------|\n| 时效 | 15-20天 | 45-60天 |\n| 口岸 | 霍尔果斯 | — |\n| 通关 | 2天 | — |\n| 关税 | 欧亚经济联盟优惠 | — |\n\n### 哈萨克市场\n- 农机保有量约25万台(70%超10年)\n- 年替换需求1.5-2万台\n- 中国二手占比35%且快速增长\n- 最受欢迎：青储机/拖拉机/播种机`,
    detailedContentEn: `## Kazakhstan Logistics Advantages\n\n### Channel Comparison\n| Indicator | China-Europe Railway | Maritime (Alternative) |\n|------|---------|----------|\n| Transit time | 15-20 days | 45-60 days |\n| Port | Khorgos | — |\n| Customs clearance | 2 days | — |\n| Tariff | EAEU preferential | — |\n\n### Kazakhstan Market\n- Agricultural machinery fleet ~250K units (70% over 10 years)\n| Annual replacement demand | 15-20K units |\n| Chinese used share | 35% and growing |\n| Most popular | Forage harvesters / Tractors / Seeders |`,
    detailedContentRu: `## Логистические преимущества Казахстана\n\n### Сравнение каналов\n| Показатель | Ж/д Китай-Европа | Морской (альтернатива) |\n|------|---------|----------|\n| Сроки | 15-20 дней | 45-60 дней |\n| Порт | Хоргос | — |\n| Таможенное оформление | 2 дня | — |\n| Пошлина | Льгота ЕАЭС | — |\n\n### Рынок Казахстана\n- Парк сельхозтехники ~250 тыс. ед. (70% старше 10 лет)\n- Годовая потребность в замене | 15-20 тыс. ед.\n- Доля китайской б/у техники | 35% и растёт\n- Самые популярные | Силосоуборочные / Тракторы / Сеялки |`,
    actionTips: ["哈萨克市场主推铁路直达+免关税优势", "阿拉木图设展示中心+备件仓", "青储机+拖拉机组合推广"],
  },
  {
    icon: "🌍", region: "非洲", tags: ["NAMPO展后", "肯尼亚+46%"], date: TODAY,
    text: "NAMPO南非展后需求增长！肯尼亚农机进口+46.6%，非洲新兴市场持续升温",
    textEn: "Post-NAMPO South Africa demand growing! Kenya agricultural machinery imports +46.6%, African emerging markets continue heating up",
    textRu: "Спрос после выставки NAMPO в ЮАР растёт! Импорт сельхозтехники в Кению +46.6%, африканские развивающиеся рынки продолжают набирать обороты",
    regionEn: "Africa", regionRu: "Африка",
    tagsEn: '["Post-NAMPO", "Kenya +46%"]', tagsRu: '["После NAMPO", "Кения +46%"]',
    detailedContent: `## 非洲市场更新\n\n### 区域动态\n| 区域 | 特点 | 需求机型 |\n|------|------|--------|\n| 🇰🇪 肯尼亚 | 进口+46.6% | 50-100HP拖拉机 |\n| 🇳🇬 尼日利亚 | 可耕地最大 | 中型拖拉机/收割机 |\n| 🇿🇦 南非 | 商业化农业 | 大型农机具 |\n| 🇪🇬 埃及 | 灌溉农业 | 拖拉机/水泵 |\n\n### 机会\n- 中国二手农机=欧洲新品20-30%价格\n- 非洲大陆自贸区降低关税壁垒\n- NAMPO展后需求持续释放\n- 50-100HP拖拉机为非洲主力需求`,
    detailedContentEn: `## Africa Market Update\n\n### Regional Dynamics\n| Region | Features | Demanded Models |\n|------|------|--------|\n| 🇰🇪 Kenya | Imports +46.6% | 50-100HP tractors |\n| 🇳🇬 Nigeria | Largest arable land | Medium tractors / Harvesters |\n| 🇿🇦 South Africa | Commercial farming | Large machinery |\n| 🇪🇬 Egypt | Irrigated farming | Tractors / Water pumps |\n\n### Opportunities\n- Chinese used machinery = 20-30% of European new prices\n- African Continental Free Trade Area reduces tariff barriers\n- Post-NAMPO demand continues to be released\n- 50-100HP tractors are primary demand in Africa`,
    detailedContentRu: `## Обновление рынка Африки\n\n### Региональная динамика\n| Регион | Особенности | Востребованные модели |\n|------|------|--------|\n| 🇰🇪 Кения | Импорт +46.6% | Тракторы 50-100 л.с. |\n| 🇳🇬 Нигерия | Самые большие пашни | Средние тракторы / Комбайны |\n| 🇿🇦 ЮАР | Коммерческое фермерство | Крупная техника |\n| 🇪🇬 Египет | Орошаемое земледелие | Тракторы / Водяные насосы |\n\n### Возможности\n- Китайская б/у техника = 20-30% цены новой европейской\n- Африканская континентальная зона свободной торговли снижает тарифные барьеры\n- Спрос после выставки NAMPO продолжает расти\n- Тракторы 50-100 л.с. — основной спрос в Африке`,
    actionTips: ["非洲主推50-100HP拖拉机", "关注肯尼亚+尼日利亚高潜市场", "利用非洲自贸区关税优惠"],
  },
  {
    icon: "🔄", region: "全球", tags: ["操作建议", "7大优先"], date: TODAY,
    text: "今日7大操作优先：980推俄语区(74.5%)→FR450爆款速推(101.4%)→5300RC乌克兰线(51.9%)→汇率对冲→BigM东欧→AGRO展→Stage V 970",
    textEn: "Today's 7 priorities: 980 push Russian region (74.5%) → FR450 hot seller (101.4%) → 5300RC Ukraine line (51.9%) → FX hedge → BigM Eastern Europe → AGRO exhibition → Stage V 970",
    textRu: "7 приоритетов на сегодня: 980 продвижение в русскоязычный регион (74.5%) → FR450 хит продаж (101.4%) → 5300RC линия Украина (51.9%) → хеджирование валют → BigM Восточная Европа → выставка AGRO → Stage V 970",
    regionEn: "Global", regionRu: "Глобально",
    tagsEn: '["Action Plan", "7 Priorities"]', tagsRu: '["План действий", "7 приоритетов"]',
    detailedContent: `## 今日7大操作优先级\n\n| 优先级 | 操作 | 价差率 | 紧迫度 |\n|--------|------|--------|--------|\n| 1 | 980加速俄语区成交 | 74.5% | 🔴 最急 |\n| 2 | FR450爆款10台速推 | 101.4% | 🔴 最急 |\n| 3 | 5300RC乌克兰线 | 51.9% | 🟡 高 |\n| 4 | 汇率对冲(CIPS结算) | — | 🟡 高 |\n| 5 | BigM 420东欧推进 | 59.2% | 🟡 高 |\n| 6 | AGRO 2026展对接 | — | 🟢 中 |\n| 7 | Stage V 970(€300K)东欧 | — | 🟢 中 |\n\n### 关键时间节点\n- **今天9:15**：央行公布EUR/CNY中间价\n- **7月**：AGRO 2026乌克兰展\n- **本周内**：完成980+FR450各至少1单`,
    detailedContentEn: `## Today's 7 Action Priorities\n\n| Priority | Action | Spread Rate | Urgency |\n|--------|------|--------|--------|\n| 1 | 980 accelerate Russian region deals | 74.5% | 🔴 Most urgent |\n| 2 | FR450 hot seller 10 units push | 101.4% | 🔴 Most urgent |\n| 3 | 5300RC Ukraine line | 51.9% | 🟡 High |\n| 4 | FX hedge (CIPS settlement) | — | 🟡 High |\n| 5 | BigM 420 Eastern Europe push | 59.2% | 🟡 High |\n| 6 | AGRO 2026 exhibition connection | — | 🟢 Medium |\n| 7 | Stage V 970 (€300K) Eastern Europe | — | 🟢 Medium |\n\n### Key Milestones\n- **Today 9:15**: PBOC announces EUR/CNY midpoint\n- **July**: AGRO 2026 Ukraine exhibition\n- **This week**: Complete at least 1 order each for 980 + FR450`,
    detailedContentRu: `## 7 приоритетов действий на сегодня\n\n| Приоритет | Действие | Ставка разницы | Срочность |\n|--------|------|--------|--------|\n| 1 | 980 ускорить сделки в русскоязычном регионе | 74.5% | 🔴 Самое срочное |\n| 2 | FR450 хит продаж 10 ед. | 101.4% | 🔴 Самое срочное |\n| 3 | 5300RC линия Украина | 51.9% | 🟡 Высокая |\n| 4 | Хеджирование валют (расчёты CIPS) | — | 🟡 Высокая |\n| 5 | BigM 420 продвижение в Восточную Европу | 59.2% | 🟡 Высокая |\n| 6 | Подключение к выставке AGRO 2026 | — | 🟢 Средняя |\n| 7 | Stage V 970 (€300K) Восточная Европа | — | 🟢 Средняя |\n\n### Ключевые вехи\n- **Сегодня 9:15**: НБК объявляет средний курс EUR/CNY\n- **Июль**: Выставка AGRO 2026 Украина\n- **На этой неделе**: Завершить минимум по 1 заказу 980 + FR450`,
    actionTips: ["980俄语区+FR450爆款双线并行推", "央行9:15中间价出炉后重新评估", "本周内完成980+FR450各1单目标"],
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
  console.log(`已导入 ${ALL_MARKET_INTEL.length} 条情报数据 (日期: 2026-06-08)`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
