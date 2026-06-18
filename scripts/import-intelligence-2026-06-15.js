/**
 * 导入2026-06-15市场情报数据到数据库
 * 基于 2026-06-14_跨境套利日报.md 生成（当日日报未生成，使用最新一期）
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const TODAY = new Date("2026-06-15");

const ALL_MARKET_INTEL = [
  {
    icon: "🔥", region: "中国", tags: ["爆款", "5070小方捆", "12台库存"], date: TODAY,
    text: "纽荷兰5070小方捆·12台库存爆款！¥3.4万/台，海外$7,000+，利润58.8%，小方捆打捆机全球需求旺盛",
    textEn: "New Holland 5070 Small Square Baler·12 units! ¥34K/unit, overseas $7K+, 58.8% margin, global demand strong",
    textRu: "New Holland 5070 Малый тюковый пресс·12 ед! ¥34K/ед, зарубеж $7K+, 58.8% маржа, глобальный спрос высок",
    regionEn: "China", regionRu: "Китай",
    tagsEn: '["Hot Deal", "5070 Baler", "12 Units"]', tagsRu: '["Хит", "5070 Пресс", "12 ед."]',
    detailedContent: `## 🔥 纽荷兰5070小方捆 — 今日头条爆款

**核心标的：** 纽 Holland 5070 小方捆打捆机，神雕农机库存12台，国内仅¥34,000/台

### 价差分析
| 指标 | 数值 |
|------|------|
| 国内售价 | ¥34,000/台（¥3.4万） |
| 海外参考价 | $7,000-8,500（¥5-6.1万） |
| 单台利润 | **¥1.6-2.7万** |
| 利润率 | **58.8%** |
| 库存 | **12台** |
| 总利润空间 | **¥19-32万** |

### 为什么是爆款
1. ✅ 价格低 — 3.4万是小方捆市场的"白菜价"
2. ✅ 库存多 — 12台可批量出货
3. ✅ 品牌好 — 纽荷兰国际认知度极高
4. ✅ 需求旺 — 全球牧草收获机械化率持续提升
5. ✅ 利润稳 — 58.8%利润率极具竞争力`,
    detailedContentEn: `## 🔥 New Holland 5070 Small Square Baler — Today's Headline

**Core Target:** New Holland 5070, Shendiao inventory 12 units, only ¥34,000/unit

### Spread Analysis
| Indicator | Value |
|------|------|
| Domestic price | ¥34,000/unit |
| Overseas reference | $7,000-8,500 |
| Profit per unit | ¥16-27K |
| Margin rate | 58.8% |
| Inventory | 12 units |`,
    detailedContentRu: `## 🔥 New Holland 5070 Малый тюковый пресс — Горячее предложение

**Основная цель:** New Holland 5070, инвентарь 12 ед., всего ¥34,000/ед.

### Анализ разницы
| Показатель | Значение |
|------|------|
| Внутренняя цена | ¥34,000/ед |
| Зарубежный ориентир | $7,000-8,500 |
| Прибыль на единицу | ¥16-27K |
| Маржа | 58.8% |
| Инвентарь | 12 ед. |`,
    actionTips: ["优先打包12台5070批量出口", "制作英文/俄文/法文产品单页", "Facebook农机群组推广", "对接非洲/东南亚经销商", "提供FOB天津/青岛报价"],
    dataSummary: [{ label: "国内售价", value: "¥3.4万/台" }, { label: "海外参考", value: "$7,000+" }, { label: "利润率", value: "58.8%" }, { label: "库存", value: "12台" }],
  },
  {
    icon: "🇷🇺", region: "俄罗斯", tags: ["EU制裁", "农机优先产业"], date: TODAY,
    text: "EU第20轮制裁持续发酵+俄罗斯2026农机排第一优先产业，5%低关税补贴，中国设备替代窗口扩大",
    textEn: "EU 20th round sanctions persist + Russia prioritizes agricultural machinery #1 in 2026 with 5% low tariff subsidies, Chinese equipment substitution window expands",
    textRu: "20-й раунд санкций ЕС продолжается + Россия ставит сельхозтехнику на #1 приоритет в 2026 г. с 5% низкой пошлиной, окно замены китайским оборудованием расширяется",
    regionEn: "Russia", regionRu: "Россия",
    tagsEn: '["EU Sanctions", "Priority Industry"]', tagsRu: '["Санкции ЕС", "Приоритетная отрасль"]',
    detailedContent: `## EU制裁+俄罗斯农机优先产业持续利好\n\n**制裁背景：** EU第20轮制裁（4月23日）持续影响欧美农机供应链。\n\n### 俄罗斯农机市场关键数据\n| 指标 | 数值 |\n|------|------|\n| 2026年优先产业 | 农机排第一 |\n| 进口关税 | 5%低关税+政府补贴 |\n| 2025年市场规模 | $8.23亿 |\n| 2034年预计规模 | $13.3亿（CAGR 5.4%） |\n| 欧美配件供应 | 断供加剧 |\n\n### 影响分析\n- CLAAS/Deere/Kubota配件供应中断加剧\n- 中国二手农机不受制裁限制\n- 中俄铁路运输正常（30-40天到货）\n- 俄罗斯市场规模持续扩大，CAGR 5.4%`,
    detailedContentEn: `## EU Sanctions + Russia Agricultural Machinery Priority Continue to Benefit\n\n**Sanctions Background:** EU 20th round sanctions (April 23) continue impacting Western agricultural machinery supply chains.\n\n### Key Russia Market Data\n| Indicator | Value |\n|------|------|\n| 2026 priority industry | Agricultural machinery #1 |\n| Import tariff | 5% low tariff + gov subsidies |\n| 2025 market size | $823M |\n| 2034 projected size | $1.33B (CAGR 5.4%) |\n| Western parts supply | Increasingly disrupted |\n\n### Impact Analysis\n- CLAAS/Deere/Kubota parts supply increasingly disrupted\n- Chinese used agricultural machinery not subject to sanctions\n- China-Russia rail transport normal (30-40 day delivery)\n- Russia market continues expanding at CAGR 5.4%`,
    detailedContentRu: `## Санкции ЕС + приоритет сельхозтехники России продолжают приносить пользу\n\n**Предыстория санкций:** 20-й раунд санкций ЕС (23 апреля) продолжает влиять на цепочки поставок западной сельхозтехники.\n\n### Ключевые данные рынка РФ\n| Показатель | Значение |\n|------|------|\n| 2026 приоритетная отрасль | Сельхозтехника №1 |\n| Импортная пошлина | 5% низкая пошлина + госсубсидии |\n| Рынок 2025 | $823 млн |\n| Прогноз 2034 | $1.33 млрд (CAGR 5.4%) |\n| Поставки запчастей Запада | Всё больше нарушаются |\n\n### Анализ\n- Поставки запчастей CLAAS/Deere/Kubota всё больше нарушаются\n- Китайская б/у техника не подпадает под санкции\n- Ж/д Китай-Россия работает нормально (30-40 дней)\n- Рынок РФ продолжает расти с CAGR 5.4%`,
    actionTips: ["重点推CLAAS二手970/980/EU制裁替代机型", "利用5%低关税+政府补贴政策促销", "建立莫斯科/新西伯利亚备件前置仓"],
  },
  {
    icon: "💶", region: "欧洲", tags: ["Agroline", "970/980价格"], date: TODAY,
    text: "970(2025)€505.7K高位企稳+980(2025)€532.5K天花板创新高！CLAAS高端需求持续走强",
    textEn: "970(2025) €505.7K stable at high + 980(2025) €532.5K new ceiling record! CLAAS high-end demand continues to strengthen",
    textRu: "970(2025) €505.7K стабильно на высоком уровне + 980(2025) €532.5K новый потолок! Спрос на премиум CLAAS продолжает расти",
    regionEn: "Europe", regionRu: "Европа",
    tagsEn: '["Agroline", "970/980 Price"]', tagsRu: '["Agroline", "Цены 970/980"]',
    detailedContent: `## 欧洲CLAAS价格趋势\n\n### Agroline实时价格矩阵\n| 型号 | 年份 | 最低价(EUR) | 最高价(EUR) | 在售数量 |\n|------|------|-----------|-----------|--------|\n| Jaguar 970 | 2025 | €505,700 | €505,700 | 1台（波兰） |\n| Jaguar 970 | 2022-2023 | €390,900 | €473,600 | 3台（德国） |\n| Jaguar 970 | 2019-2021 | €300,470 | €428,400 | 6台（德国） |\n| Jaguar 970 | 2010-2013 | €110,000 | €185,000 | 4台 |\n| Jaguar 980 | 2025 | €532,500 | €532,500 | 1台（德国） |\n| Jaguar 980 | 2022-2023 | €378,426 | €461,400 | 2台 |\n\n### 关键发现\n- 🆕 980(2025) €532,500仅363h准新车，价格天花板创新高\n- 970(2025) €505,700(579h)连续多周高位企稳\n- 高端机型供给有限但需求刚性`,
    detailedContentEn: `## European CLAAS Price Trends\n\n### Agroline Real-time Price Matrix\n| Model | Year | Min(EUR) | Max(EUR) | Available |\n|------|------|-----------|-----------|--------|\n| Jaguar 970 | 2025 | €505,700 | €505,700 | 1 unit (Poland) |\n| Jaguar 970 | 2022-2023 | €390,900 | €473,600 | 3 units (Germany) |\n| Jaguar 970 | 2019-2021 | €300,470 | €428,400 | 6 units (Germany) |\n| Jaguar 970 | 2010-2013 | €110,000 | €185,000 | 4 units |\n| Jaguar 980 | 2025 | €532,500 | €532,500 | 1 unit (Germany) |\n| Jaguar 980 | 2022-2023 | €378,426 | €461,400 | 2 units |\n\n### Key Findings\n- 🆕 980(2025) €532,500 only 363h, near-new, new price ceiling\n- 970(2025) €505,700 (579h) stable at high for weeks\n- High-end models limited supply but inelastic demand`,
    detailedContentRu: `## Европейские ценовые тренды CLAAS\n\n### Ценовая матрица Agroline в реальном времени\n| Модель | Год | Мин.(EUR) | Макс.(EUR) | В наличии |\n|------|------|-----------|-----------|--------|\n| Jaguar 970 | 2025 | €505,700 | €505,700 | 1 ед. (Польша) |\n| Jaguar 970 | 2022-2023 | €390,900 | €473,600 | 3 ед. (Германия) |\n| Jaguar 970 | 2019-2021 | €300,470 | €428,400 | 6 ед. (Германия) |\n| Jaguar 970 | 2010-2013 | €110,000 | €185,000 | 4 ед. |\n| Jaguar 980 | 2025 | €532,500 | €532,500 | 1 ед. (Германия) |\n| Jaguar 980 | 2022-2023 | €378,426 | €461,400 | 2 ед. |\n\n### Ключевые находки\n- 🆕 980(2025) €532,500 всего 363 моточасов, почти новый, новый ценовой потолок\n- 970(2025) €505,700 (579 моточасов) стабилен на высоком уровне неделями\n- Ограниченное предложение премиум-моделей при неэластичном спросе`,
    actionTips: ["利用980(2025)€532.5K天花板效应提升980(2016)143万性价比认知", "970(2017)163万对标970(2019)€315,900→247.4万", "高端机型主推俄语区+乌克兰买家"],
    dataSummary: [{ label: "980(2025)天花板", value: "€532.5K" }, { label: "970在售", value: "17台" }],
  },
  {
    icon: "📊", region: "中国", tags: ["5300RC", "334%最暴力"], date: TODAY,
    text: "5300RC(2020)仅18万白菜价！国际€99.9K→78.2万，334%价差率全品类第一，需确认车况",
    textEn: "5300RC(2020) only CNY 180K bargain bin! Intl €99.9K→CNY 782K, 334% spread rate #1 across all categories, condition verification needed",
    textRu: "5300RC(2020) всего 180 тыс. юаней! Международный €99.9K→782 тыс. юаней, 334% разница №1 среди всех категорий, требуется проверка состояния",
    regionEn: "China", regionRu: "Китай",
    tagsEn: '["5300RC", "334% Most Aggressive"]', tagsRu: '["5300RC", "334% Самый агрессивный"]',
    detailedContent: `## 5300RC(2020)最暴力套利分析\n\n**核心标的：** CLAAS Quadrant 5300 FC (2020)，国内仅18万元，国际€99,900→78.2万元\n\n### 价差对比\n| 指标 | 数值 |\n|------|------|\n| 国内售价 | 18万元 |\n| 国际参考价 | €99,900 (78.2万) |\n| 价差 | 60.2万元 |\n| 价差率 | **334.4%** ⭐⭐⭐⭐⭐ |\n| 车型 | 大方捆打捆机 |\n| 车况 | 需确认 |\n\n### 与6月12日对比\n- 6月12日参考价：85万(估)→372.2%\n- 6月14日最新价：78.2万(€99,900 Agroline真实数据)→334.4%\n- 📉 使用Agroline真实报价后价差率-37.8pp，但仍为全品类第一\n\n### 风险\n- 18万白菜价需确认真实车况和是否可出口\n- 如确认，利润空间60.2万，性价比极高`,
    detailedContentEn: `## 5300RC(2020) Most Aggressive Arbitrage Analysis\n\n**Core Target:** CLAAS Quadrant 5300 FC (2020), domestic only CNY 180K, international €99,900→CNY 782K\n\n### Spread Comparison\n| Indicator | Value |\n|------|------|\n| Domestic price | CNY 180K |\n| International reference | €99,900 (CNY 782K) |\n| Spread | CNY 602K |\n| Spread rate | **334.4%** ⭐⭐⭐⭐⭐ |\n| Type | Large square baler |\n| Condition | Needs verification |\n\n### vs June 12\n- June 12 reference: CNY 850K (estimated)→372.2%\n- June 14 latest: CNY 782K (€99,900 Agroline real data)→334.4%\n- 📉 Using Agroline real quote, spread rate -37.8pp, but still #1\n\n### Risk\n- CNY 180K bargain price needs vehicle condition verification\n- If confirmed, CNY 602K profit, exceptional value`,
    detailedContentRu: `## 5300RC(2020) Самый агрессивный арбитражный анализ\n\n**Основная цель:** CLAAS Quadrant 5300 FC (2020), внутренняя цена всего 180 тыс. юаней, международная €99,900→782 тыс. юаней\n\n### Сравнение разницы\n| Показатель | Значение |\n|------|------|\n| Внутренняя цена | 180 тыс. юаней |\n| Международный ориентир | €99,900 (782 тыс. юаней) |\n| Разница | 602 тыс. юаней |\n| Ставка разницы | **334.4%** ⭐⭐⭐⭐⭐ |\n| Тип | Большой пресс-подборщик |\n| Состояние | Требует проверки |\n\n### По сравнению с 12 июня\n- 12 июня ориентир: 850 тыс. юаней (оценка)→372.2%\n- 14 июня последние данные: 782 тыс. юаней (€99,900 реальные данные Agroline)→334.4%\n\n### Риск\n- Цена 180 тыс. юаней требует проверки реального состояния\n- При подтверждении прибыль 602 тыс. юаней`,
    actionTips: ["优先确认5300RC(2020)车况和是否可出口", "如确认可出口，定价参考国际€99.9K对标", "334%价差率可作营销爆点"],
    dataSummary: [{ label: "5300RC价差率", value: "334.4%" }, { label: "利润空间", value: "60.2万" }],
  },
  {
    icon: "🇨🇳", region: "中国", tags: ["FR450爆款", "BP1290新亮点"], date: TODAY,
    text: "FR450(101.4%)+Krone BP1290(96.6%)双爆款！FR450 10台走量+BP1290东欧推量，汇率稳定=定价最优",
    textEn: "FR450(101.4%)+Krone BP1290(96.6%) dual hot sellers! FR450 10 units volume + BP1290 Eastern Europe push, stable FX = optimal pricing",
    textRu: "FR450(101.4%)+Krone BP1290(96.6%) двойной хит! FR450 10 ед. объём продаж + BP1290 продвижение в Восточную Европу, стабильный курс = оптимальное ценообразование",
    regionEn: "China", regionRu: "Китай",
    tagsEn: '["FR450 Hot", "BP1290 New"]', tagsRu: '["FR450 хит", "BP1290 новый"]',
    detailedContent: `## 双爆款套利分析\n\n### FR450(2013)爆款\n| 指标 | 数值 |\n|------|------|\n| 国内售价 | 21.5万/台 |\n| 俄市场参考价 | 43.3万 |\n| 价差率 | **101.4%** |\n| 库存 | **10台** |\n| 汇率敏感度 | 低 |\n\n### Krone Big Pack 1290(2020)新亮点\n| 指标 | 数值 |\n|------|------|\n| 国内售价 | 68万元 |\n| 国际参考价 | €170,765 (133.7万) |\n| 价差率 | **96.6%** 🆕 |\n| 利润空间 | 65.7万/台 |\n\n### 对比总结\n| 机型 | 价差率 | 库存 | 汇率敏感 | 目标市场 |\n|------|--------|------|---------|--------|\n| FR450(2013) | 101.4% | 10台 | 低 | 俄语区 |\n| Krone BP1290(2020) | 96.6% | 1台 | 中 | 东欧 |\n| BigM 420(2018) | 59.8% | 1台 | 中 | 东欧/俄 |`,
    detailedContentEn: `## Dual Hot Seller Arbitrage Analysis\n\n### FR450(2013) Hot Seller\n| Indicator | Value |\n|------|------|\n| Domestic price | CNY 215K/unit |\n| Russian market reference | CNY 433K |\n| Spread rate | **101.4%** |\n| Inventory | **10 units** |\n| FX sensitivity | Low |\n\n### Krone Big Pack 1290(2020) New Highlight\n| Indicator | Value |\n|------|------|\n| Domestic price | CNY 680K |\n| International reference | €170,765 (CNY 1.337M) |\n| Spread rate | **96.6%** 🆕 |\n| Profit margin | CNY 657K/unit |\n\n### Summary Comparison\n| Model | Spread Rate | Inventory | FX Sens | Target Market |\n|------|--------|------|---------|--------|\n| FR450(2013) | 101.4% | 10 units | Low | Russian region |\n| Krone BP1290(2020) | 96.6% | 1 unit | Med | Eastern Europe |\n| BigM 420(2018) | 59.8% | 1 unit | Med | Eastern Europe/RU |`,
    detailedContentRu: `## Двойной арбитражный анализ хитов\n\n### FR450(2013) хит\n| Показатель | Значение |\n|------|------|\n| Внутренняя цена | 215 тыс. юаней/ед. |\n| Ориентир РФ рынка | 433 тыс. юаней |\n| Ставка разницы | **101.4%** |\n| Остаток | **10 ед.** |\n| Чувствит. к валютам | Низкая |\n\n### Krone Big Pack 1290(2020) новый\n| Показатель | Значение |\n|------|------|\n| Внутренняя цена | 680 тыс. юаней |\n| Международный ориентир | €170,765 (1.337 млн) |\n| Ставка разницы | **96.6%** 🆕 |\n| Маржа прибыли | 657 тыс. юаней/ед. |\n\n### Сводка\n| Модель | Разница | Запас | Чувств. | Рынок |\n|------|--------|------|---------|--------|\n| FR450(2013) | 101.4% | 10 ед. | Низкая | РФ |\n| BP1290(2020) | 96.6% | 1 ед. | Средняя | В.Европа |\n| BigM 420(2018) | 59.8% | 1 ед. | Средняя | В.Европа/РФ |`,
    actionTips: ["FR450俄语区批量速推10台", "Krone BP1290东欧推量，96.6%价差率新亮点", "BigM 420搭配Krone组合出口"],
    dataSummary: [{ label: "FR450价差", value: "101.4%" }, { label: "BP1290价差", value: "96.6%" }],
  },
  {
    icon: "💶", region: "欧洲", tags: ["汇率稳定", "7.8294"], date: TODAY,
    text: "EUR/CNY 7.8294连续两周7.82-7.85窄幅震荡，波动率<0.5%，套利定价确定性极高",
    textEn: "EUR/CNY 7.8294 narrow range 7.82-7.85 for two weeks, volatility <0.5%, extremely high arbitrage pricing certainty",
    textRu: "EUR/CNY 7.8294 узкий диапазон 7.82-7.85 в течение двух недель, волатильность <0.5%, чрезвычайно высокая определённость арбитражного ценообразования",
    regionEn: "Europe", regionRu: "Европа",
    tagsEn: '["FX Stability", "7.8294"]', tagsRu: '["Стабильность валют", "7.8294"]',
    detailedContent: `## 汇率状态更新\n\n### 两周汇率走势\n| 日期 | EUR/CNY | 变化 | 波动率 |\n|------|---------|------|--------|\n| 6月1日 | 7.8920 | — | — |\n| 6月5日 | 7.8670 | -0.32% | <0.5% |\n| 6月8日 | 7.8919 | +0.32% | <0.5% |\n| 6月10日 | 7.8400 | -0.66% | <0.5% |\n| 6月12日 | 7.8425 | +0.03% | <0.5% |\n| **6月14日** | **7.8294** | **-0.17%** | **<0.5%** |\n\n### 影响评估\n- 汇率连续两周在7.82-7.85极窄区间\n- 波动率<0.5%，套利计算确定性极高\n- 美元微降至USD/CNY 6.8120(-0.04%)\n- **若持续走低至7.80以下需调整出口定价**`,
    detailedContentEn: `## FX Status Update\n\n### Two-Week FX Trend\n| Date | EUR/CNY | Change | Volatility |\n|------|---------|------|--------|\n| June 1 | 7.8920 | — | — |\n| June 5 | 7.8670 | -0.32% | <0.5% |\n| June 8 | 7.8919 | +0.32% | <0.5% |\n| June 10 | 7.8400 | -0.66% | <0.5% |\n| June 12 | 7.8425 | +0.03% | <0.5% |\n| **June 14** | **7.8294** | **-0.17%** | **<0.5%** |\n\n### Impact Assessment\n- FX in extremely narrow 7.82-7.85 range for two weeks\n- Volatility <0.5%, extremely high arbitrage pricing certainty\n- USD slightly down to USD/CNY 6.8120 (-0.04%)\n- **If continues below 7.80, need to adjust export pricing**`,
    detailedContentRu: `## Обновление статуса валют\n\n### Двухнедельный тренд валют\n| Дата | EUR/CNY | Изменение | Волатильность |\n|------|---------|------|--------|\n| 1 июня | 7.8920 | — | — |\n| 5 июня | 7.8670 | -0.32% | <0.5% |\n| 8 июня | 7.8919 | +0.32% | <0.5% |\n| 10 июня | 7.8400 | -0.66% | <0.5% |\n| 12 июня | 7.8425 | +0.03% | <0.5% |\n| **14 июня** | **7.8294** | **-0.17%** | **<0.5%** |\n\n### Оценка влияния\n- Курс в крайне узком диапазоне 7.82-7.85 две недели\n- Волатильность <0.5%, чрезвычайно высокая определённость\n- Доллар незначительно снизился до USD/CNY 6.8120 (-0.04%)\n- **При снижении ниже 7.80 потребуется корректировка цен**`,
    actionTips: ["EUR/CNY稳定窗口期集中签约", "若跌破7.80启动汇率对冲(CIPS结算)", "980/FR450等高价差产品优先出货"],
  },
  {
    icon: "🇺🇦", region: "乌克兰", tags: ["FAO恢复", "AGRO 2026展"], date: TODAY,
    text: "FAO预测乌克兰83.6百万吨谷物产量+AGRO 2026展7月基辅举办，战后重建农机需求确定性高",
    textEn: "FAO predicts Ukraine 83.6M tons grain output + AGRO 2026 exhibition in Kyiv July, post-war reconstruction machinery demand highly certain",
    textRu: "ФАО прогнозирует 83.6 млн тонн зерна в Украине + выставка AGRO 2026 в Киеве в июле, спрос на технику для послевоенного восстановления весьма определён",
    regionEn: "Ukraine", regionRu: "Украина",
    tagsEn: '["FAO Recovery", "AGRO 2026"]', tagsRu: '["Восстановление ФАО", "AGRO 2026"]',
    detailedContent: `## 乌克兰市场更新\n\n### 关键数据\n| 指标 | 数值 |\n|------|------|\n| FAO 2026/27 谷物产量预测 | 83.6百万吨 |\n| AGRO 2026展 | 7月，基辅，第34届 |\n| 农产品出口(2026.1-2月) | 9.95万吨(+9.3%) |\n| 黑海+多瑙河路线 | 已恢复运行 |\n\n### 对神雕农机的意义\n1. FAO确认乌克兰粮食增产 → 农机需求确定性高\n2. 970(2016)基辅直接挂牌 → 验证需求真实\n3. AGRO 2026展7月 → 需求窗口\n4. 黑海贸易路线恢复 → 物流可行\n\n### 推荐机型\n- 970(2017) 163万：匹配乌克兰中型农场需求\n- 980(2016) 143万：高端市场\n- FR450 21.5万：走量机型`,
    detailedContentEn: `## Ukraine Market Update\n\n### Key Data\n| Indicator | Value |\n|------|------|\n| FAO 2026/27 grain output forecast | 83.6M tons |\n| AGRO 2026 exhibition | July, Kyiv, 34th edition |\n| Agricultural exports (Jan-Feb 2026) | 99.5K tons (+9.3%) |\n| Black Sea + Danube routes | Operational |\n\n### Implications for Shendiao\n1. FAO confirms Ukraine grain increase → agricultural machinery demand certainty\n2. 970(2016) listed in Kyiv → validates real demand\n3. AGRO 2026 July → demand window\n4. Black Sea trade routes restored → logistics feasible`,
    detailedContentRu: `## Обновление рынка Украины\n\n### Ключевые данные\n| Показатель | Значение |\n|------|------|\n| Прогноз ФАО 2026/27 | 83.6 млн тонн |\n| Выставка AGRO 2026 | Июль, Киев, 34-я |\n| Экспорт с/х (янв-фев 2026) | 99.5 тыс. тонн (+9.3%) |\n| Маршруты Чёрного моря+Дуная | Действуют |\n\n### Значение для Shendiao\n1. ФАО подтверждает рост зерна → определённость спроса на технику\n2. 970(2016) выставлен в Киеве → подтверждает реальный спрос`,
    actionTips: ["7月AGRO展前完成线上对接", "970/980重点推向乌克兰买家", "黑海+多瑙河双通道物流方案"],
  },
  {
    icon: "🏆", region: "欧洲", tags: ["CLAAS市占率", "R&D投入"], date: TODAY,
    text: "CLAAS全球青储机市占率>65%+Jaguar 1000系列+44%+R&D投入3.199亿欧创新高，品牌护城河极深",
    textEn: "CLAAS global forage harvester market share >65% + Jaguar 1000 series +44% + R&D spending €319.9M record high, deep brand moat",
    textRu: "Доля CLAAS на мировом рынке силосоуборочных комбайнов >65% + серия Jaguar 1000 +44% + расходы на НИОКР €319.9 млн рекорд, глубокий брендовый ров",
    regionEn: "Europe", regionRu: "Европа",
    tagsEn: '["CLAAS Market Share", "R&D Record"]', tagsRu: '["Доля CLAAS", "Рекорд НИОКР"]',
    detailedContent: `## CLAAS品牌实力\n\n### 核心数据\n| 指标 | 数值 |\n|------|------|\n| 全球青储机市占率 | >65% |\n| Jaguar 1000系列2025销售额 | +44% |\n| 2025年R&D投入 | 3.199亿欧元（新高） |\n| 2026年新平台 | CLAAS connect 数字平台 |\n| AXION 9.450 Terra Trac | 2026年度拖拉机 |\n\n### 对神雕农机的意义\n- CLAAS品牌→高保值率→二手市场需求刚性\n- 市占率>65%意味着全球青储机标准由CLAAS定义\n- R&D投入新高→产品力持续升级→品牌溢价\n- CLAAS connect数字平台→提高设备透明度和可信度\n\n### 二手市场受益\n- 品牌越强，二手流通性越好\n- 神雕农机CLAAS库存匹配全球最大需求池`,
    detailedContentEn: `## CLAAS Brand Strength\n\n### Core Data\n| Indicator | Value |\n|------|------|\n| Global forage harvester market share | >65% |\n| Jaguar 1000 series 2025 sales | +44% |\n| 2025 R&D spending | €319.9M (record high) |\n| 2026 new platform | CLAAS connect digital platform |\n| AXION 9.450 Terra Trac | 2026 Tractor of the Year |\n\n### Implications for Shendiao\n- CLAAS brand → high resale value → rigid used demand\n- >65% market share means CLAAS defines global forage harvester standards\n- Record R&D → continued product power → brand premium`,
    detailedContentRu: `## Сила бренда CLAAS\n\n### Основные данные\n| Показатель | Значение |\n|------|------|\n| Мировая доля силосоуборочных | >65% |\n| Продажи Jaguar 1000 2025 | +44% |\n| Расходы на НИОКР 2025 | €319.9 млн (рекорд) |\n| Новая платформа 2026 | CLAAS connect |\n| AXION 9.450 Terra Trac | Трактор года 2026 |\n\n### Значение для Shendiao\n- Бренд CLAAS → высокая остаточная стоимость → устойчивый спрос на б/у`,
    actionTips: ["利用CLAAS>65%市占率作为核心卖点", "CLAAS品牌背书制作俄语/英语版品牌手册", "重点囤CLAAS高端机型库存"],
    dataSummary: [{ label: "CLAAS市占率", value: ">65%" }, { label: "R&D投入", value: "€319.9M" }],
  },
  {
    icon: "🇧🇷", region: "巴西", tags: ["进口替代", "5300RC"], date: TODAY,
    text: "巴西Q1销量-13.1%但进口替代加速，5300RC(95万全新)受益，51.8%对标价差但仍需MAPA备案",
    textEn: "Brazil Q1 sales -13.1% but import substitution accelerating, 5300RC (CNY 950K new) benefiting, 51.8% reference spread but MAPA approval required",
    textRu: "Продажи в Бразилии Q1 -13.1%, но импортное замещение ускоряется, 5300RC (950 тыс. юаней новый) выигрывает, ориентировочная разница 51.8%, требуется одобрение MAPA",
    regionEn: "Brazil", regionRu: "Бразилия",
    tagsEn: '["Import Substitution", "5300RC"]', tagsRu: '["Импортное замещение", "5300RC"]',
    detailedContent: `## 巴西农机市场\n\n### 市场现状\n| 指标 | 数值 |\n|------|------|\n| Q1销量增速 | -13.1% |\n| 进口替代趋势 | 加速中 |\n| 5300RC国内价 | 95万(全新) |\n| 国际对标价 | EU€145.2K→113.7万 |\n| 价差率(5300RC) | 19.7%(原估52.7%→下调) |\n| 970(2017)对标价差 | EU€316K→247.4万 vs 163万=51.8% |\n| 关税 | 14%+MAPA审批 |\n\n### 机会分析\n- 巴西进口替代加速，中国设备机会增加\n- 5300RC(全新95万)国际对标113.7万，价差18.7万(19.7%)\n- 970(2017)巴西市场对标价差51.8%\n- 14%关税需提前完成MAPA审批\n- 建议葡萄牙语产品手册`,
    detailedContentEn: `## Brazil Agricultural Machinery Market\n\n### Market Status\n| Indicator | Value |\n|------|------|\n| Q1 sales growth | -13.1% |\n| Import substitution trend | Accelerating |\n| 5300RC domestic price | CNY 950K (new) |\n| International reference | EU€145.2K→CNY 1.137M |\n| Spread rate (5300RC) | 19.7% (down from est 52.7%) |\n| 970(2017) ref spread | EU€316K→CNY 2.474M vs 1.63M=51.8% |\n| Tariff | 14% + MAPA approval |\n\n### Opportunity Analysis\n- Brazil import substitution accelerating, Chinese equipment opportunity growing\n- 14% tariff requires MAPA pre-approval`,
    detailedContentRu: `## Рынок сельхозтехники Бразилии\n\n### Состояние рынка\n| Показатель | Значение |\n|------|------|\n| Рост продаж Q1 | -13.1% |\n| Тренд импортного замещения | Ускоряется |\n| 5300RC внутренняя цена | 950 тыс. (новый) |\n| Международный ориентир | €145.2K→1.137 млн |\n| Пошлина | 14% + одобрение MAPA |\n\n### Анализ возможностей\n- Импортное замещение в Бразилии ускоряется, растут возможности для китайской техники\n- 14% пошлина требует предварительного одобрения MAPA`,
    actionTips: ["970(2017)巴西市场重点推广，51.8%对标价差", "5300RC全新+BigM 420搭配出口巴西", "提前完成巴西14%关税+MAPA审批准备"],
  },
  {
    icon: "🇺🇿", region: "乌兹别克斯坦", tags: ["+256%增速", "棉花机械化"], date: TODAY,
    text: "乌兹别克Q1进口+256.77%全球最快！棉花采收机械化率不足40%，50%政府补贴持续驱动需求",
    textEn: "Uzbekistan Q1 imports +256.77% globally fastest! Cotton harvest mechanization rate below 40%, 50% gov subsidy continues driving demand",
    textRu: "Узбекистан импорт Q1 +256.77% — самый быстрый в мире! Механизация хлопкоуборки ниже 40%, 50% госсубсидия продолжает стимулировать спрос",
    regionEn: "Uzbekistan", regionRu: "Узбекистан",
    tagsEn: '["+256% Growth", "Cotton Mechanization"]', tagsRu: '["+256% рост", "Механизация хлопка"]',
    detailedContent: `## 乌兹别克斯坦市场持续爆发\n\n### 核心数据\n| 指标 | 数值 |\n|------|------|\n| Q1进口增速 | **+256.77%** |\n| 棉花采收机械化率 | 不足40% |\n| 政府补贴 | 农机购置补贴50% |\n| 主要需求 | 棉花采收+拖拉机+打捆机 |\n\n### 推荐机型\n| 品类 | 推荐型号 | 适合场景 |\n|------|---------|--------|\n| 青储收获机 | CLAAS 850/860 | 棉花秸秆+青储 |\n| 拖拉机 | NH/Deere 100-200HP | 田间作业 |\n| 打捆机 | Krone 500/600 | 秸秆打捆 |\n\n### 机会\n- 中吉乌铁路加速建设，物流将更便捷\n- 新疆农机展确认中亚需求\n- 俄语+乌兹别克语产品资料是成交关键`,
    detailedContentEn: `## Uzbekistan Market Continues to Surge\n\n### Core Data\n| Indicator | Value |\n|------|------|\n| Q1 import growth | **+256.77%** |\n| Cotton harvest mechanization | Below 40% |\n| Govt subsidy | 50% machinery purchase subsidy |\n| Main demand | Cotton harvest + tractors + balers |\n\n### Recommended Models\n| Category | Model | Application |\n|------|---------|--------|\n| Forage harvester | CLAAS 850/860 | Cotton straw + silage |\n| Tractors | NH/Deere 100-200HP | Field work |\n| Balers | Krone 500/600 | Straw baling |`,
    detailedContentRu: `## Рынок Узбекистана продолжает бурный рост\n\n### Основные данные\n| Показатель | Значение |\n|------|------|\n| Рост импорта Q1 | **+256.77%** |\n| Механизация хлопкоуборки | Ниже 40% |\n| Госсубсидия | 50% на покупку техники |\n| Основной спрос | Хлопкоуборка + тракторы + прессы |\n\n### Рекомендуемые модели\n| Категория | Модель | Применение |\n|------|---------|--------|\n| Силосоуборочные | CLAAS 850/860 | Хлопковая солома + силос |\n| Тракторы | NH/Deere 100-200 л.с. | Полевые работы |\n| Прессы | Krone 500/600 | Тюкование соломы |`,
    actionTips: ["乌兹别克语+俄语版产品手册优先制作", "棉花采收机型重点推广", "50%政府补贴融资方案设计对接"],
  },
  {
    icon: "🌍", region: "非洲", tags: ["肯尼亚+46%", "NAMPO展后"], date: TODAY,
    text: "肯尼亚农机进口+46.6%+NAMPO展后需求持续，非洲市场50-100HP拖拉机为主力需求",
    textEn: "Kenya agricultural machinery imports +46.6% + post-NAMPO demand continues, 50-100HP tractors main demand in Africa",
    textRu: "Импорт сельхозтехники в Кению +46.6% + спрос после NAMPO продолжается, тракторы 50-100 л.с. основной спрос в Африке",
    regionEn: "Africa", regionRu: "Африка",
    tagsEn: '["Kenya +46%", "Post-NAMPO"]', tagsRu: '["Кения +46%", "После NAMPO"]',
    detailedContent: `## 非洲市场更新\n\n### 区域动态\n| 区域 | 增速/特点 | 需求机型 |\n|------|----------|--------|\n| 🇰🇪 肯尼亚 | 进口+46.6% | 50-100HP拖拉机 |\n| 🇳🇬 尼日利亚 | 可耕地最大 | 中型拖拉机/收割机 |\n| 🇿🇦 南非 | 商业化农业 | 大型农机具 |\n| 🇪🇬 埃及 | 灌溉农业 | 拖拉机/水泵 |\n\n### 机会点\n- 中国二手农机=欧洲新品20-30%价格\n- 非洲大陆自贸区降低关税壁垒\n- NAMPO南非展后需求持续释放\n- 50-100HP拖拉机为非洲主力需求\n- 神雕JD 8400(2016)+8R系列可匹配`,
    detailedContentEn: `## Africa Market Update\n\n### Regional Dynamics\n| Region | Growth/Features | Demanded Models |\n|------|----------|--------|\n| 🇰🇪 Kenya | Imports +46.6% | 50-100HP tractors |\n| 🇳🇬 Nigeria | Largest arable land | Medium tractors/harvesters |\n| 🇿🇦 South Africa | Commercial farming | Large machinery |\n| 🇪🇬 Egypt | Irrigated farming | Tractors/water pumps |\n\n### Opportunities\n- Chinese used machinery = 20-30% of European new prices\n- AfCFTA reduces tariff barriers`,
    detailedContentRu: `## Обновление рынка Африки\n\n### Региональная динамика\n| Регион | Рост/Особенности | Востребованные модели |\n|------|----------|--------|\n| 🇰🇪 Кения | Импорт +46.6% | Тракторы 50-100 л.с. |\n| 🇳🇬 Нигерия | Самые большие пашни | Средние тракторы/комбайны |\n| 🇿🇦 ЮАР | Коммерческое фермерство | Крупная техника |\n| 🇪🇬 Египет | Орошаемое земледелие | Тракторы/насосы |\n\n### Возможности\n- Китайская б/у техника = 20-30% цены новой европейской\n- AfCFTA снижает тарифные барьеры`,
    actionTips: ["非洲主推50-100HP拖拉机", "关注肯尼亚+尼日利亚高潜市场", "JD 8400+8R系列匹配非洲需求"],
  },
  {
    icon: "🌏", region: "东南亚", tags: ["印尼+121%", "中泰协议"], date: TODAY,
    text: "印尼农机进口+121.07%爆发！中泰农机协议推进中，东南亚小型农机需求旺盛",
    textEn: "Indonesia agri machinery imports +121.07% exploding! China-Thailand agreement advancing, Southeast Asia small machinery demand strong",
    textRu: "Импорт сельхозтехники в Индонезию +121.07% взрывной! Китайско-тайское соглашение продвигается, спрос на малую технику в ЮВА высок",
    regionEn: "Southeast Asia", regionRu: "Юго-Восточная Азия",
    tagsEn: '["Indonesia +121%", "China-Thailand Deal"]', tagsRu: '["Индонезия +121%", "Китайско-тайское соглашение"]',
    detailedContent: `## 东南亚农机市场\n\n### 区域增速\n| 国家 | 增速 | 主力机型 |\n|------|------|--------|\n| 🇮🇩 印尼 | **+121.07%** | 微耕机/小型收割机 |\n| 🇹🇭 泰国 | 中速 | 插秧机/收割机 |\n| 🇵🇭 菲律宾 | 快速 | 手扶拖拉机/收割机 |\n| 🇻🇳 越南 | 中速 | 插秧机/烘干机 |\n\n### 神雕机会\n- 印尼+121.07%为全球增速前三\n- 中泰农机协议推进降低贸易壁垒\n- 小型农机需求旺盛，中国品牌优势明显\n- 但神雕主营大型青储机/打捆机，需评估适配度`,
    detailedContentEn: `## Southeast Asia Agri Machinery Market\n\n### Regional Growth\n| Country | Growth | Key Models |\n|------|------|--------|\n| 🇮🇩 Indonesia | **+121.07%** | Mini tillers/small harvesters |\n| 🇹🇭 Thailand | Moderate | Transplanters/harvesters |\n| 🇵🇭 Philippines | Fast | Walking tractors/harvesters |\n| 🇻🇳 Vietnam | Moderate | Transplanters/dryers |\n\n### Shendiao Opportunity\n- Indonesia +121.07% among top 3 globally\n- China-Thailand agreement reduces trade barriers\n- But Shendiao primarily deals in large harvesters/balers`,
    detailedContentRu: `## Рынок сельхозтехники ЮВА\n\n### Региональный рост\n| Страна | Рост | Основные модели |\n|------|------|--------|\n| 🇮🇩 Индонезия | **+121.07%** | Мотоблоки/малые комбайны |\n| 🇹🇭 Таиланд | Умеренный | Сажалки/комбайны |\n| 🇵🇭 Филиппины | Быстрый | Мотоблоки/комбайны |\n| 🇻🇳 Вьетнам | Умеренный | Сажалки/сушилки |\n\n### Возможности\n- Индонезия +121.07% в топ-3 в мире\n- Соглашение Китай-Таиланд снижает барьеры`,
    actionTips: ["东南亚市场评估大型农机的适配度", "关注中泰协议降低出口门槛动态", "印尼+121%可作为市场叙事素材"],
  },
  {
    icon: "🔄", region: "全球", tags: ["操作建议", "7大优先"], date: TODAY,
    text: "今日7大操作优先：970(51.8%)→FR450爆款速推(101.4%)→BP1290东欧推量(96.6%)→5300RC确认车况→BigM(59.8%)→980天花板效应→汇率监控",
    textEn: "Today's 7 priorities: 970(51.8%)→FR450 push(101.4%)→BP1290 Eastern Europe(96.6%)→5300RC verify→BigM(59.8%)→980 ceiling→FX monitoring",
    textRu: "7 приоритетов: 970(51.8%)→FR450 продвижение(101.4%)→BP1290 В.Европа(96.6%)→5300RC проверка→BigM(59.8%)→980 потолок→мониторинг валют",
    regionEn: "Global", regionRu: "Глобально",
    tagsEn: '["Action Plan", "7 Priorities"]', tagsRu: '["План действий", "7 приоритетов"]',
    detailedContent: `## 今日7大操作优先级（基于6月14日数据）\n\n| 优先级 | 操作 | 价差率 | 紧迫度 |\n|--------|------|--------|--------|\n| 1 | 970(2017)重点推进出口(51.8%) | 84.4万利润 | 🔴 最急 |\n| 2 | FR450爆款10台速推(101.4%) | 101.4% | 🔴 最急 |\n| 3 | Krone BP1290东欧推量(96.6%) | 96.6% 🆕 | 🟡 高 |\n| 4 | 5300RC(2020)确认车况(334%) | 334.4% | 🟡 高 |\n| 5 | BigM 420东欧+巴西推进(59.8%) | 59.8% | 🟡 高 |\n| 6 | 利用980(2025)天花板效应营销 | — | 🟢 中 |\n| 7 | 监控EUR/CNY走势，跌破7.80需调整 | — | 🟢 中 |\n\n### 关键时间节点\n- **本周**：完成970+FR450各至少1单\n- **7月**：AGRO 2026乌克兰展，提前对接\n- **汇率关口**：EUR/CNY如跌破7.80需启动对冲`,
    detailedContentEn: `## Today's 7 Action Priorities (Based on June 14 Data)\n\n| Priority | Action | Spread Rate | Urgency |\n|--------|------|--------|--------|\n| 1 | 970(2017) accelerate export (51.8%) | CNY 844K profit | 🔴 Most urgent |\n| 2 | FR450 10 units push (101.4%) | 101.4% | 🔴 Most urgent |\n| 3 | Krone BP1290 Eastern Europe push (96.6%) | 96.6% 🆕 | 🟡 High |\n| 4 | 5300RC(2020) verify condition (334%) | 334.4% | 🟡 High |\n| 5 | BigM 420 Eastern Europe+Brazil (59.8%) | 59.8% | 🟡 High |\n| 6 | Leverage 980(2025) ceiling marketing | — | 🟢 Medium |\n| 7 | Monitor EUR/CNY, below 7.80 needs action | — | 🟢 Medium |\n\n### Key Milestones\n- **This week**: Complete at least 1 order each for 970 + FR450\n- **July**: AGRO 2026 Ukraine exhibition\n- **FX threshold**: EUR/CNY below 7.80 needs hedging`,
    detailedContentRu: `## 7 приоритетов действий (на основе данных 14 июня)\n\n| Приоритет | Действие | Разница | Срочность |\n|--------|------|--------|--------|\n| 1 | 970(2017) ускорить экспорт (51.8%) | 844 тыс. прибыль | 🔴 Срочно |\n| 2 | FR450 10 ед. продвижение (101.4%) | 101.4% | 🔴 Срочно |\n| 3 | Krone BP1290 В.Европа (96.6%) | 96.6% 🆕 | 🟡 Высокая |\n| 4 | 5300RC(2020) проверка (334%) | 334.4% | 🟡 Высокая |\n| 5 | BigM 420 В.Европа+Бразилия (59.8%) | 59.8% | 🟡 Высокая |\n| 6 | Маркетинг потолка 980(2025) | — | 🟢 Средняя |\n| 7 | Мониторинг EUR/CNY, ниже 7.80 нужны меры | — | 🟢 Средняя |\n\n### Ключевые вехи\n- **На этой неделе**: Завершить минимум 1 заказ 970 + FR450\n- **Июль**: Выставка AGRO 2026 Украина`,
    actionTips: ["970+FR450双线并行推进出口", "BP1290东欧推量为新操作亮点", "监控汇率走势，跌破7.80启动对冲"],
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
  console.log(`已导入 ${ALL_MARKET_INTEL.length} 条情报数据 (日期: 2026-06-15)`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
