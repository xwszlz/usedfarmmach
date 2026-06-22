/**
 * 导入2026-06-22市场情报数据到数据库
 * 基于 2026-06-21_跨境套利日报.md（最新可用日报）生成
 * 5070小方捆永久头条(sortOrder=0)，其余11条从1开始
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const TODAY = new Date("2026-06-22");

const ALL_MARKET_INTEL = [
  // ===== sortOrder: 0 — 永久头条：纽荷兰5070小方捆 =====
  {
    icon: "🔥", region: "中国", regionEn: "China", regionRu: "Китай",
    tags: JSON.stringify(["爆款","5070小方捆","12台库存"]),
    tagsEn: JSON.stringify(["Hot Deal","5070 Baler","12 Units"]),
    tagsRu: JSON.stringify(["Хит","5070 Пресс","12 ед."]),
    text: "纽荷兰5070小方捆·12台库存爆款！¥3.4万/台，海外$7,000+，利润58.8%，小方捆打捆机全球需求旺盛",
    textEn: "New Holland 5070 Small Square Baler·12 units! ¥34K/unit, overseas $7K+, 58.8% margin, global demand strong",
    textRu: "New Holland 5070 Малый тюковый пресс·12 ед! ¥34K/ед, зарубеж $7K+, 58.8% маржа, глобальный спрос высок",
    detailedContent: `## 纽 Holland 5070 小方捆 — 永久头条爆款推荐

### 💰 价差分析
| 项目 | 数值 |
|------|------|
| 🇨🇳 国内售价 | **¥34,000/台** |
| 🌍 海外参考价 | **$7,000+** |
| 💵 利润空间 | **58.8%** |
| 📦 库存数量 | **12台** |
| 💰 总利润空间 | **¥19-32万** |

### 🎯 推广策略
| 目标市场 | 推广重点 | 行动 |
|---------|---------|------|
| 🌍 非洲 | 小方捆打捆机需求旺盛，5070性价比突出 | WhatsApp群推 |
| 🌏 东南亚 | 小型农场主力机型，操作简单维护成本低 | 代理商对接 |
| 🌏 中亚 | 牧草收获标配，5070口碑产品 | 阿拉木图展示 |

### 🔥 五大爆款理由
1. **门槛极低**：¥3.4万/台，小型买家也能负担
2. **全球通用**：纽荷兰品牌全球认知度高
3. **利润丰厚**：58.8%利润率，远高于常规二手出口
4. **批量走量**：12台统一规格，一次性采购降本
5. **售后简单**：小方捆结构简单，配件全球可配`,
    detailedContentEn: `## New Holland 5070 Small Square Baler — Permanent Top Pick

### 💰 Price Spread Analysis
| Item | Value |
|------|------|
| 🇨🇳 Domestic Price | **¥34,000/unit** |
| 🌍 Overseas Reference | **$7,000+** |
| 💵 Profit Margin | **58.8%** |
| 📦 Inventory | **12 units** |
| 💰 Total Profit Potential | **¥190K-320K** |

### 🎯 Promotion Strategy
| Target Market | Focus | Action |
|---------|---------|------|
| 🌍 Africa | Strong demand for small square balers | WhatsApp group push |
| 🌏 SE Asia | Primary model for small farms | Agent connection |
| 🌏 Central Asia | Hay harvesting standard | Almaty showroom |

### 🔥 Top 5 Reasons for Hot Deal
1. Ultra-low barrier: ¥34K/unit, accessible to small buyers
2. Global brand recognition: New Holland worldwide
3. Rich profit: 58.8% margin, well above typical used export
4. Bulk volume: 12 units same spec, cost-saving bulk purchase
5. Simple after-sales: Simple structure, parts available globally`,
    detailedContentRu: `## New Holland 5070 Малый тюковый пресс — Постоянная горячая рекомендация

### 💰 Анализ разницы цен
| Параметр | Значение |
|------|------|
| 🇨🇳 Внутренняя цена | **¥34 000/ед.** |
| 🌍 Международный ориентир | **$7 000+** |
| 💵 Маржа прибыли | **58.8%** |
| 📦 Остаток на складе | **12 ед.** |
| 💰 Общий потенциал прибыли | **¥190-320 тыс.** |

### 🎯 Стратегия продвижения
| Целевой рынок | Фокус | Действие |
|---------|---------|------|
| 🌍 Африка | Высокий спрос на малые прессы | WhatsApp рассылка |
| 🌏 ЮВА | Основная модель малых ферм | Агентское подключение |
| 🌏 Центр. Азия | Стандарт заготовки сена | Шоурум в Алматы |

### 🔥 5 причин для покупки
1. Низкий порог: ¥34 тыс./ед., доступно мелким покупателям
2. Мировое признание: бренд New Holland известен глобально
3. Высокая прибыль: 58.8% маржа
4. Оптовый объём: 12 ед. одной спецификации
5. Простое обслуживание: запчасти доступны по всему миру`,
    actionTips: JSON.stringify(["优先打包12台5070批量出口","制作英文/俄文/法文5070产品单页","Facebook农机群组重点推广","对接非洲/东南亚经销商批量拿货","可提供FOB天津/青岛报价"]),
    dataSummary: JSON.stringify([
      {label:"国内售价",value:"¥3.4万/台"},
      {label:"海外参考",value:"$7,000+"},
      {label:"利润率",value:"58.8%"},
      {label:"库存",value:"12台"},
      {label:"总利润空间",value:"¥19-32万"}
    ]),
  },

  // ===== sortOrder: 1 — EUR/CNY汇率 =====
  {
    icon: "💶", region: "欧洲", regionEn: "Europe", regionRu: "Европа",
    tags: JSON.stringify(["EUR/CNY","周跌1.02%","7.75支撑"]),
    tagsEn: JSON.stringify(["EUR/CNY","Weekly -1.02%","7.75 Support"]),
    tagsRu: JSON.stringify(["EUR/CNY","Неделя -1.02%","Поддержка 7.75"]),
    text: "EUR/CNY周线下跌1.02%近三月最大！周五尾盘从7.7600反弹至7.7681守住7.75支撑，ECB会议前观望",
    textEn: "EUR/CNY weekly -1.02% largest in 3 months! Friday rebound from 7.7600 to 7.7681 held 7.75 support, pre-ECB meeting wait-and-see",
    textRu: "EUR/CNY неделя -1.02% — максимум за 3 месяца! Пятничный отскок с 7.7600 до 7.7681 удержал поддержку 7.75, ожидание заседания ЕЦБ",
    detailedContent: `## EUR/CNY汇率周报

### 汇率快照（6月21日周末参考，无新报价）
| 货币对 | 周五收盘 | 日环比 | 周变化 | 备注 |
|--------|---------|--------|--------|------|
| EUR/CNY | **7.7681** | +0.10% | **-1.02%** | ✅ 尾盘反弹守住7.75 |
| USD/CNY | 6.7695 | -0.01% | +0.17% | ➡️ 美元窄幅震荡 |
| EUR/RUB | 83.8730 | -0.21% | -0.23% | 卢布小幅走强 |
| EUR/GBP | 0.8674 | -0.07% | 持平 | 英镑兑欧元稳定 |

### 套利空间影响
| 型号 | 6/16 (7.8480) | 6/21 (7.7681) | 一周变化 |
|------|--------------|--------------|---------|
| 5300RC(2020) 331.1% | 335.6% | 331.1% | -4.5pp |
| 980(2016) 71.2% | 73.1% | 71.2% | -1.9pp |
| 970(2017) 50.2% | 51.8% | 50.2% | -1.6pp |
| BP1290(2020) 95.0% | 95.7% | 95.0% | -0.7pp |

### 🔮 ECB 6月会议（6月26日周四）
| 情景 | 概率 | EUR/CNY走势 | 操作策略 |
|------|------|-------------|----------|
| 加息25bp | 65% | 7.80-7.85 ✅ | 加速询价锁定中长期 |
| 意外不加息 | 25% | 7.65-7.70 ⚠️ | 暂停欧元定价订单 |
| 降息 | 10% | 7.55-7.60 ❌ | 立即调整所有报价`,
    detailedContentEn: `## EUR/CNY FX Weekly Report

### FX Snapshot (June 21 Weekend Reference, No New Quotes)
| Pair | Friday Close | Daily Change | Weekly Change | Note |
|--------|---------|--------|--------|------|
| EUR/CNY | **7.7681** | +0.10% | **-1.02%** | ✅ Bounce held 7.75 |
| USD/CNY | 6.7695 | -0.01% | +0.17% | ➡️ USD narrow range |
| EUR/RUB | 83.8730 | -0.21% | -0.23% | RUB slightly stronger |
| EUR/GBP | 0.8674 | -0.07% | Flat | GBP/EUR stable |

### Arbitrage Space Impact
| Model | 6/16 (7.8480) | 6/21 (7.7681) | Weekly Change |
|------|--------------|--------------|---------|
| 5300RC(2020) 331.1% | 335.6% | 331.1% | -4.5pp |
| 980(2016) 71.2% | 73.1% | 71.2% | -1.9pp |
| 970(2017) 50.2% | 51.8% | 50.2% | -1.6pp |
| BP1290(2020) 95.0% | 95.7% | 95.0% | -0.7pp |

### 🔮 ECB June Meeting (June 26 Thu)
| Scenario | Probability | EUR/CNY Path | Strategy |
|------|------|-------------|----------|
| Hike 25bp | 65% | 7.80-7.85 ✅ | Accelerate lock-in |
| No hike | 25% | 7.65-7.70 ⚠️ | Pause EUR orders |
| Cut 25bp | 10% | 7.55-7.60 ❌ | Adjust all quotes`,
    detailedContentRu: `## EUR/CNY Недельный отчёт по валютам

### Снимок валют (воскресенье, без новых котировок)
| Пара | Закрытие пт | Дневной | Недельный | Примечание |
|--------|---------|--------|--------|------|
| EUR/CNY | **7.7681** | +0.10% | **-1.02%** | ✅ Отскок удержал 7.75 |
| USD/CNY | 6.7695 | -0.01% | +0.17% | ➡️ Узкий диапазон USD |
| EUR/RUB | 83.8730 | -0.21% | -0.23% | RUB слегка укрепился |
| EUR/GBP | 0.8674 | -0.07% | Без изменений | GBP/EUR стабилен |

### Изменение арбитражного пространства
| Модель | 6/16 (7.8480) | 6/21 (7.7681) | Неделя |
|------|--------------|--------------|---------|
| 5300RC(2020) 331.1% | 335.6% | 331.1% | -4.5pp |
| 980(2016) 71.2% | 73.1% | 71.2% | -1.9pp |
| 970(2017) 50.2% | 51.8% | 50.2% | -1.6pp |
| BP1290(2020) 95.0% | 95.7% | 95.0% | -0.7pp |

### 🔮 Заседание ЕЦБ (26 июня чт)
| Сценарий | Вероятность | EUR/CNY | Стратегия |
|------|------|-------------|----------|
| Повышение 25бп | 65% | 7.80-7.85 ✅ | Ускорить фиксацию |
| Без изменений | 25% | 7.65-7.70 ⚠️ | Приостановить EUR |
| Снижение 25бп | 10% | 7.55-7.60 ❌ | Скорректировать цены`,
    actionTips: JSON.stringify(["周一9:15关注央行中间价是否守住7.75","ECB会议前锁汇降低汇率敞口","优先推FR450等汇率不敏感的走量标的"]),
    dataSummary: JSON.stringify([
      {label:"EUR/CNY",value:"7.7681"},
      {label:"周变化",value:"-1.02%"},
      {label:"7.75支撑",value:"✅守住"},
      {label:"ECB加息概率",value:"65%"}
    ]),
  },

  // ===== sortOrder: 2 — 980供给井喷 =====
  {
    icon: "📈", region: "欧洲", regionEn: "Europe", regionRu: "Европа",
    tags: JSON.stringify(["980井喷","+133%","14条在售"]),
    tagsEn: JSON.stringify(["980 Surge","+133%","14 Listings"]),
    tagsRu: JSON.stringify(["980 Всплеск","+133%","14 объявлений"]),
    text: "Jaguar 980系列供给井喷！本周6条→14条(+133%)创近期新高，买方议价空间历史最大",
    textEn: "Jaguar 980 series supply surge! This week 6→14 listings (+133%) recent high, buyer bargaining power at historical peak",
    textRu: "Jaguar 980 всплеск предложения! На этой неделе 6→14 объявлений (+133%), покупательский рынок исторического масштаба",
    detailedContent: `## Jaguar 980系列供给分析

### 本周供给变化
| 日期 | 980在售(条) | 环比变化 |
|------|-----------|---------|
| 6/16 (周二) | 6 | — |
| 6/17 (周三) | 8 | +2 |
| 6/18 (周四) | 10 | +2 |
| 6/19 (周五) | 12 | +2 |
| 6/20 (周六) | 14 | +2 |
| **周变化** | **6→14** | **+133%** |

### 980价格分布（EUR）
| 年份 | 最低价 | 最高价 | 均价 |
|------|-------|-------|------|
| 2025 | €532,500(363h) | €532,500 | €532,500 |
| 2024 | €467,754(1750h) | 面议(875h) | ~€467K |
| 2023 | €284,892 | €378,426 | €327,711 |
| 2022 | €461,400(896h) | €461,400 | €461,400 |
| 2021 | €749,805(21h!) | €749,805 | €749,805 |
| 2014-2013 | €189,942 | €216,500 | €203,221 |

### 操作建议
- 主动邮件获取低价报价（目标<€350K的2023款）
- 14条在售逐一对比，筛选性价比top 3
- 980出口俄乌定价参考248-294万区间`,
    detailedContentEn: `## Jaguar 980 Series Supply Analysis

### Weekly Supply Change
| Date | 980 Listings | Change |
|------|-----------|---------|
| 6/16 (Tue) | 6 | — |
| 6/17 (Wed) | 8 | +2 |
| 6/18 (Thu) | 10 | +2 |
| 6/19 (Fri) | 12 | +2 |
| 6/20 (Sat) | 14 | +2 |
| **Weekly** | **6→14** | **+133%** |

### 980 Price Distribution (EUR)
| Year | Lowest | Highest | Average |
|------|-------|-------|------|
| 2025 | €532,500(363h) | €532,500 | €532,500 |
| 2024 | €467,754(1750h) | Negotiable(875h) | ~€467K |
| 2023 | €284,892 | €378,426 | €327,711 |
| 2022 | €461,400(896h) | €461,400 | €461,400 |
| 2021 | €749,805(21h!) | €749,805 | €749,805 |
| 2014-2013 | €189,942 | €216,500 | €203,221 |

### Action
- Active email to get low-price quotes (target <€350K for 2023 model)
- Compare all 14 listings, select top 3 cost-effective
- 980 export pricing reference: CNY 248-294K range`,
    detailedContentRu: `## Анализ предложения серии Jaguar 980

### Изменение предложения за неделю
| Дата | Объявлений 980 | Изменение |
|------|-----------|---------|
| 6/16 (Вт) | 6 | — |
| 6/17 (Ср) | 8 | +2 |
| 6/18 (Чт) | 10 | +2 |
| 6/19 (Пт) | 12 | +2 |
| 6/20 (Сб) | 14 | +2 |
| **Неделя** | **6→14** | **+133%** |

### Распределение цен 980 (EUR)
| Год | Мин. | Макс. | Средн. |
|------|-------|-------|------|
| 2025 | €532,500(363ч) | €532,500 | €532,500 |
| 2024 | €467,754(1750ч) | Договорная(875ч) | ~€467K |
| 2023 | €284,892 | €378,426 | €327,711 |
| 2022 | €461,400(896ч) | €461,400 | €461,400 |
| 2021 | €749,805(21ч!) | €749,805 | €749,805 |
| 2014-2013 | €189,942 | €216,500 | €203,221 |

### Рекомендация
- Активные запросы на низкие цены (цель <€350K на 2023)
- Сравнить все 14 объявлений, отобрать топ-3
- Ценообразование экспорта 980: 248-294 тыс. юаней`,
    actionTips: JSON.stringify(["主动邮件获取980报价目标<€350K","14条逐一对比筛选top 3性价比","980出口俄乌定价248-294万区间"]),
    dataSummary: JSON.stringify([
      {label:"980在售",value:"14条(+133%)"},
      {label:"2023款最低",value:"€284,892"},
      {label:"2025款",value:"€532,500"}
    ]),
  },

  // ===== sortOrder: 3 — 5300RC(2020) 331.1%全品类第一 =====
  {
    icon: "🏆", region: "中国", regionEn: "China", regionRu: "Китай",
    tags: JSON.stringify(["5300RC","331.1%","全品类第一"]),
    tagsEn: JSON.stringify(["5300RC","331.1%","Category #1"]),
    tagsRu: JSON.stringify(["5300RC","331.1%","Категория №1"]),
    text: "CLAAS 5300RC(2020) 331.1%价差率全品类第一！国内仅18万，国际€99,900→77.6万，价差59.6万",
    textEn: "CLAAS 5300RC(2020) 331.1% spread rate #1 in all categories! Domestic only CNY 180K, international €99,900→CNY 776K, spread CNY 596K",
    textRu: "CLAAS 5300RC(2020) 331.1% разница — №1 среди всех категорий! Внутренняя всего 180 тыс., международная €99,900→776 тыс., разница 596 тыс. юаней",
    detailedContent: `## CLAAS 5300RC(2020) — 全品类套利冠军

### 套利分析
| 指标 | 数值 |
|------|------|
| 🇨🇳 国内售价 | **18万元** |
| 🌍 国际参考 | €99,900 → **77.6万元** |
| 💰 价差 | **59.6万元** |
| 📊 价差率 | **331.1%** ⭐⭐⭐⭐⭐ |
| 📦 库存 | 1台（库存唯一） |

### 全品类价差排行
| 排名 | 型号 | 价差率 | 利润(万) |
|------|------|--------|---------|
| **1** | **5300RC(2020)** | **331.1%** | **59.6** |
| 2 | FR450(2013) | 101.4% | 21.8 |
| 3 | BP1290(2020) | 95.0% | 64.6 |
| 4 | 980(2016) | 71.2% | 101.8 |
| 5 | BigM 420(2018) | 58.4% | 28.6 |
| 6 | 970(2017) | 50.2% | 81.8 |

### 行动建议
- 周一开始电话确认车况！
- 331.1%为全品类最高，锁定后利润有保障
- 适合俄语区+中东买家`,
    detailedContentEn: `## CLAAS 5300RC(2020) — #1 Arbitrage Champion

### Arbitrage Analysis
| Indicator | Value |
|------|------|
| 🇨🇳 Domestic Price | **CNY 180K** |
| 🌍 International Ref | €99,900 → **CNY 776K** |
| 💰 Spread | **CNY 596K** |
| 📊 Spread Rate | **331.1%** ⭐⭐⭐⭐⭐ |
| 📦 Inventory | 1 unit |

### Category Ranking
| Rank | Model | Spread Rate | Profit(10K) |
|------|------|--------|---------|
| **1** | **5300RC(2020)** | **331.1%** | **59.6** |
| 2 | FR450(2013) | 101.4% | 21.8 |
| 3 | BP1290(2020) | 95.0% | 64.6 |
| 4 | 980(2016) | 71.2% | 101.8 |
| 5 | BigM 420(2018) | 58.4% | 28.6 |
| 6 | 970(2017) | 50.2% | 81.8 |

### Action
- Call Monday to confirm condition!
- 331.1% highest margin in all categories
- Suitable for Russian + Middle East buyers`,
    detailedContentRu: `## CLAAS 5300RC(2020) — Чемпион арбитража №1

### Анализ арбитража
| Показатель | Значение |
|------|------|
| 🇨🇳 Внутренняя цена | **180 тыс. юаней** |
| 🌍 Международная | €99,900 → **776 тыс. юаней** |
| 💰 Разница | **596 тыс. юаней** |
| 📊 Ставка разницы | **331.1%** ⭐⭐⭐⭐⭐ |
| 📦 Остаток | 1 ед. |

### Рейтинг категорий
| № | Модель | Ставка разницы | Прибыль(тыс.) |
|------|------|--------|---------|
| **1** | **5300RC(2020)** | **331.1%** | **596** |
| 2 | FR450(2013) | 101.4% | 218 |
| 3 | BP1290(2020) | 95.0% | 646 |
| 4 | 980(2016) | 71.2% | 1,018 |
| 5 | BigM 420(2018) | 58.4% | 286 |
| 6 | 970(2017) | 50.2% | 818 |

### Действие
- Позвонить в понедельник, подтвердить состояние!
- 331.1% — самая высокая маржа
- Подходит русскоязычным + ближневосточным покупателям`,
    actionTips: JSON.stringify(["周一电话确认5300RC车况","锁定后优先推俄语区买家","331.1%利润空间议价空间大"]),
    dataSummary: JSON.stringify([
      {label:"国内价",value:"¥18万"},
      {label:"国际价",value:"€99,900→77.6万"},
      {label:"价差率",value:"331.1%"},
      {label:"排名",value:"全品类第一"}
    ]),
  },

  // ===== sortOrder: 4 — FR450(2013) 101.4%爆款 =====
  {
    icon: "💥", region: "中国", regionEn: "China", regionRu: "Китай",
    tags: JSON.stringify(["FR450","101.4%爆款","10台走量"]),
    tagsEn: JSON.stringify(["FR450","101.4% Hot","10 Units"]),
    tagsRu: JSON.stringify(["FR450","101.4% хит","10 ед."]),
    text: "New Holland FR450(2013) 101.4%价差率！¥21.5万/台+10台库存，走量爆款汇率影响最小",
    textEn: "New Holland FR450(2013) 101.4% spread rate! ¥215K/unit + 10 units inventory, volume seller with minimal FX impact",
    textRu: "New Holland FR450(2013) 101.4% разница! ¥215 тыс./ед. + 10 ед. на складе, объёмный хит с минимальным влиянием валют",
    detailedContent: `## FR450爆款速推

### 核心优势
| 指标 | 数值 |
|------|------|
| 🇨🇳 国内售价 | **¥21.5万/台** |
| 🌍 俄市场参考 | **43.3万元** |
| 💰 单台价差 | **21.8万元** |
| 📊 价差率 | **101.4%** |
| 📦 库存 | **10台** |
| 💵 汇率敏感度 | **低**（不受EUR波动影响） |
| 📈 10台总利润 | **约218万元** |

### 为什么是汇率独立爆款？
1. FR450定价在俄罗斯市场，以RUB定价，不受EUR/CNY波动
2. 10台走量模式→总利润218万
3. 21.5万低门槛→买家决策快
4. EUR周跌1.02%对FR450影响接近于零`,
    detailedContentEn: `## FR450 Hot Seller Push

### Core Advantages
| Indicator | Value |
|------|------|
| 🇨🇳 Domestic Price | **CNY 215K/unit** |
| 🌍 Russia Market Ref | **CNY 433K** |
| 💰 Per-unit Spread | **CNY 218K** |
| 📊 Spread Rate | **101.4%** |
| 📦 Inventory | **10 units** |
| 💵 FX Sensitivity | **Low** (not EUR-linked) |
| 📈 Total Profit (10) | **~CNY 2.18M** |

### Why FX-Independent Hot Seller?
1. FR450 priced in RUB market, unaffected by EUR/CNY
2. 10-unit volume model → total profit CNY 2.18M
3. CNY 215K low barrier → fast buyer decisions
4. EUR weekly -1.02% has near-zero impact on FR450`,
    detailedContentRu: `## FR450 — хит продаж

### Ключевые преимущества
| Показатель | Значение |
|------|------|
| 🇨🇳 Внутренняя цена | **215 тыс. юаней/ед.** |
| 🌍 Рынок РФ | **433 тыс. юаней** |
| 💰 Разница за ед. | **218 тыс. юаней** |
| 📊 Ставка разницы | **101.4%** |
| 📦 Остаток | **10 ед.** |
| 💵 Чувствительность к валютам | **Низкая** |
| 📈 Общая прибыль (10) | **~2.18 млн юаней** |

### Почему это хит?
1. FR450 ценится на рублёвом рынке, не зависит от EUR/CNY
2. Модель 10 ед. → общая прибыль 2.18 млн
3. Низкий порог 215 тыс. → быстрое решение
4. EUR неделя -1.02% почти не влияет на FR450`,
    actionTips: JSON.stringify(["FR450俄语区批量速推10台","21.5万低门槛吸引小型买家","EUR波动的天然对冲标的"]),
    dataSummary: JSON.stringify([
      {label:"国内售价",value:"¥21.5万/台"},
      {label:"价差率",value:"101.4%"},
      {label:"库存",value:"10台"},
      {label:"总利润",value:"~¥218万"}
    ]),
  },

  // ===== sortOrder: 5 — BP1290(2020) 95.0%打捆机冠军 =====
  {
    icon: "🎯", region: "欧洲", regionEn: "Europe", regionRu: "Европа",
    tags: JSON.stringify(["BP1290","95.0%","打捆机冠军"]),
    tagsEn: JSON.stringify(["BP1290","95.0%","Baler Champion"]),
    tagsRu: JSON.stringify(["BP1290","95.0%","Чемпион прессов"]),
    text: "Krone Big Pack 1290(2020) 95.0%价差率！国内68万 vs 国际€170,765→132.6万，利润64.6万打捆机第一",
    textEn: "Krone Big Pack 1290(2020) 95.0% spread rate! Domestic CNY 680K vs international €170,765→CNY 1.326M, profit CNY 646K baler #1",
    textRu: "Krone Big Pack 1290(2020) 95.0% разница! Внутренняя 680 тыс. vs международная €170,765→1.326 млн, прибыль 646 тыс. — №1 среди прессов",
    detailedContent: `## Krone BP1290(2020)打捆机套利冠军

### 套利分析
| 指标 | 数值 |
|------|------|
| 🇨🇳 国内售价 | **68万元** |
| 🌍 国际参考 | €170,765 → **132.6万元** |
| 💰 价差 | **64.6万元** |
| 📊 价差率 | **95.0%** ⭐⭐⭐⭐⭐ |
| 📦 库存 | 在售 |

### 打捆机品类套利排行
| 排名 | 型号 | 价差率 | 利润(万) |
|------|------|--------|---------|
| **1** | **BP1290(2020)** | **95.0%** | **64.6** |
| 2 | BP1290(2022) | €222,171→172.6万 | — |
| 3 | BP1290(2021) | €201,600→156.6万 | — |

### 东欧推广策略
- 乌克兰基辅已有BP1290渠道（2024款€200K在售）
- 东欧(乌克兰/波兰)打捆机需求旺盛
- Krone品牌在东欧认知度极高`,
    detailedContentEn: `## Krone BP1290(2020) Baler Arbitrage Champion

### Arbitrage Analysis
| Indicator | Value |
|------|------|
| 🇨🇳 Domestic Price | **CNY 680K** |
| 🌍 International Ref | €170,765 → **CNY 1.326M** |
| 💰 Spread | **CNY 646K** |
| 📊 Spread Rate | **95.0%** ⭐⭐⭐⭐⭐ |
| 📦 Inventory | Available |

### Baler Category Ranking
| Rank | Model | Spread Rate | Profit(10K) |
|------|------|--------|---------|
| **1** | **BP1290(2020)** | **95.0%** | **64.6** |
| 2 | BP1290(2022) | €222,171→1.726M | — |
| 3 | BP1290(2021) | €201,600→1.566M | — |

### Eastern Europe Strategy
- Ukraine Kyiv has BP1290 channel (2024 €200K listing)
- Eastern Europe baler demand strong
- Krone brand well known in Eastern Europe`,
    detailedContentRu: `## Krone BP1290(2020) Чемпион арбитража среди прессов

### Анализ арбитража
| Показатель | Значение |
|------|------|
| 🇨🇳 Внутренняя цена | **680 тыс. юаней** |
| 🌍 Международная | €170,765 → **1.326 млн** |
| 💰 Разница | **646 тыс. юаней** |
| 📊 Ставка разницы | **95.0%** ⭐⭐⭐⭐⭐ |
| 📦 Остаток | В наличии |

### Рейтинг прессов
| № | Модель | Разница | Прибыль(тыс.) |
|------|------|--------|---------|
| **1** | **BP1290(2020)** | **95.0%** | **646** |
| 2 | BP1290(2022) | €222,171→1.726M | — |
| 3 | BP1290(2021) | €201,600→1.566M | — |

### Стратегия Восточной Европы
- Киев уже имеет канал BP1290 (2024 €200K)
- Спрос на прессы в Восточной Европе высокий
- Krone известен в Восточной Европе`,
    actionTips: JSON.stringify(["BP1290东欧(乌克兰/波兰)重点推广","利用基辅已有渠道加速对接","打捆机品类推荐给东欧经销商"]),
    dataSummary: JSON.stringify([
      {label:"国内价",value:"¥68万"},
      {label:"国际价",value:"€170,765→132.6万"},
      {label:"价差率",value:"95.0%"},
      {label:"利润",value:"64.6万"}
    ]),
  },

  // ===== sortOrder: 6 — 980(2021,21h)准新天花板 =====
  {
    icon: "💎", region: "欧洲", regionEn: "Europe", regionRu: "Европа",
    tags: JSON.stringify(["980准新","仅21小时","582.4万天花板"]),
    tagsEn: JSON.stringify(["980 Like-New","21 Hours Only","CNY 5.824M Ceiling"]),
    tagsRu: JSON.stringify(["980 Как новый","Всего 21 час","5.824 млн потолок"]),
    text: "Jaguar 980(2021)仅21小时准新机！法国£648,651→582.4万，980系列最高价天花板，高端专供",
    textEn: "Jaguar 980(2021) only 21 hours like-new! France £648,651→CNY 5.824M, 980 series ceiling price, high-end exclusive",
    textRu: "Jaguar 980(2021) всего 21 моточас как новый! Франция £648,651→5.824 млн, цена-потолок серии 980, эксклюзив премиум-класса",
    detailedContent: `## 980(2021, 21h)准新天花板

### 关键数据
| 指标 | 数值 |
|------|------|
| 型号 | CLAAS Jaguar 980 (2021) |
| 工时 | **仅21小时**（准新机） |
| 国际价 | £648,651 → **582.4万元** |
| 所在地 | 法国上普罗旺斯 |

### 定价策略
- 582.4万为980系列最高价天花板
- 仅21h工时，几乎是全新机
- 适合推给VIP大客户
- 周初推给中东石油美元买家

### 风险提示
- ⚠️ 582.4万远超同类980定价
- ⚠️ 仅21h但价格含配件，不做大众定价参考
- ✅ 可作为高端锚点，衬托其他980性价比`,
    detailedContentEn: `## 980(2021, 21h) Like-New Ceiling

### Key Data
| Indicator | Value |
|------|------|
| Model | CLAAS Jaguar 980 (2021) |
| Hours | **Only 21 hours** (like-new) |
| International | £648,651 → **CNY 5.824M** |
| Location | Provence-Alpes, France |

### Pricing Strategy
- CNY 5.824M is the 980 series ceiling price
- Only 21h, virtually brand new
- Push to VIP large clients
- Target Middle East petrodollar buyers

### Risk Note
- ⚠️ CNY 5.824M far exceeds typical 980 pricing
- ⚠️ Only 21h but includes attachments, not a mass reference
- ✅ Can serve as high-end anchor for other 980s`,
    detailedContentRu: `## 980(2021, 21ч) Как новый — потолок

### Ключевые данные
| Показатель | Значение |
|------|------|
| Модель | CLAAS Jaguar 980 (2021) |
| Моточасы | **Всего 21 час** (как новый) |
| Международная | £648,651 → **5.824 млн** |
| Расположение | Прованс-Альпы, Франция |

### Стратегия ценообразования
- 5.824 млн — цена-потолок серии 980
- Всего 21 ч, практически новый
- Продвигать VIP-клиентам
- Цель: покупатели с нефтяными деньгами Ближнего Востока

### Предупреждение
- ⚠️ 5.824 млн значительно превышает типичную цену 980
- ⚠️ 21 ч но включает навесное, не ориентир для масс
- ✅ Может служить якорной ценой для других 980`,
    actionTips: JSON.stringify(["周初推给VIP大客户中东买家","用作高端锚点衬托其他980性价比","不做大众定价参考仅做高端案例"]),
    dataSummary: JSON.stringify([
      {label:"型号",value:"980(2021)"},
      {label:"工时",value:"仅21h"},
      {label:"价格",value:"582.4万"},
      {label:"定位",value:"天花板/高端专供"}
    ]),
  },

  // ===== sortOrder: 7 — 970美英新渠道 =====
  {
    icon: "🌐", region: "全球", regionEn: "Global", regionRu: "Глобально",
    tags: JSON.stringify(["970","美英新渠道","渠道多元化"]),
    tagsEn: JSON.stringify(["970","US-UK New Channels","Channel Diversification"]),
    tagsRu: JSON.stringify(["970","Новые каналы США-Великобритания","Диверсификация каналов"]),
    text: "Jaguar 970美英渠道打通！美国威斯康星(2020/€315K)+英国坎布里亚(2019/€265K)首次出现",
    textEn: "Jaguar 970 US-UK channels opened! Wisconsin USA (2020/€315K) + Cumbria UK (2019/€265K) first appearance",
    textRu: "Каналы Jaguar 970 США-Великобритания открыты! Висконсин США (2020/€315K) + Камбрия Великобритания (2019/€265K) впервые",
    detailedContent: `## 970美英新渠道分析

### 新渠道数据
| 渠道 | 年份 | 价格(EUR) | 换算RMB(@7.7681) | 工时 |
|------|------|-----------|------------------|------|
| 🇺🇸 美国威斯康星 | 2020 | €315,118 | **244.8万元** | 1,665h |
| 🇬🇧 英国坎布里亚 | 2019 | €264,667 | **205.6万元** | 2,000h |

### 渠道多元化意义
1. **打破区域集中风险**：此前970以德国+法国为主（占70%+）
2. **美国渠道**：威斯康星是美国农业核心州，渠道可扩展
3. **英国脱欧渠道**：英镑定价+脱欧关税差异→英国970可能比欧洲更便宜
4. **竞品信息**：首次看到美国市场970定价，可对比判断海外市场热度

### 与国内970(2017)¥163万的套利分析
| 渠道 | 国内价 | 国际价 | 价差(万) | 价差率 |
|------|--------|--------|---------|--------|
| 美/威斯康星(2020) | 163万 | 244.8万 | 81.8 | **50.2%** |
| 英/坎布里亚(2019) | 163万 | 205.6万 | 42.6 | **26.1%** |`,
    detailedContentEn: `## 970 US-UK Channel Analysis

### New Channel Data
| Channel | Year | Price(EUR) | RMB(@7.7681) | Hours |
|------|------|-----------|------------------|------|
| 🇺🇸 Wisconsin USA | 2020 | €315,118 | **CNY 2.448M** | 1,665h |
| 🇬🇧 Cumbria UK | 2019 | €264,667 | **CNY 2.056M** | 2,000h |

### Significance
1. Breaks regional concentration risk (previously 70%+ Germany+France)
2. US channel: Wisconsin is core agricultural state
3. UK post-Brexit channel: GBP pricing may offer better deals
4. Competitive intel: First US 970 pricing data

### vs Domestic 970(2017) CNY 1.63M
| Channel | Domestic | International | Spread | Rate |
|------|--------|--------|---------|--------|
| US/Wisconsin(2020) | 1.63M | 2.448M | 818K | **50.2%** |
| UK/Cumbria(2019) | 1.63M | 2.056M | 426K | **26.1%** |`,
    detailedContentRu: `## Анализ каналов 970 США-Великобритания

### Данные новых каналов
| Канал | Год | Цена(EUR) | Юаней(@7.7681) | Моточасы |
|------|------|-----------|------------------|------|
| 🇺🇸 Висконсин США | 2020 | €315,118 | **2.448 млн** | 1,665 |
| 🇬🇧 Камбрия Великобритания | 2019 | €264,667 | **2.056 млн** | 2,000 |

### Значение
1. Снижение региональной концентрации
2. Канал США: Висконсин — ключевой с/х штат
3. Канал Великобритании: цены в GBP
4. Первые данные о ценах 970 в США

### vs внутренняя 970(2017) 1.63 млн
| Канал | Внутренняя | Международная | Разница | Ставка |
|------|--------|--------|---------|--------|
| США/Висконсин(2020) | 1.63M | 2.448M | 818K | **50.2%** |
| Великобритания/Камбрия(2019) | 1.63M | 2.056M | 426K | **26.1%** |`,
    actionTips: JSON.stringify(["美国威斯康星970渠道保持跟进","英国脱欧后渠道关注英镑汇率优势","渠道多元化降低单一市场风险"]),
    dataSummary: JSON.stringify([
      {label:"美国威斯康星",value:"2020/€315K"},
      {label:"英国坎布里亚",value:"2019/€265K"},
      {label:"970国内vs国际",value:"50.2%价差"}
    ]),
  },

  // ===== sortOrder: 8 — ECB 6月会议前瞻 =====
  {
    icon: "🔮", region: "欧洲", regionEn: "Europe", regionRu: "Европа",
    tags: JSON.stringify(["ECB会议","6/26周四","加息65%"]),
    tagsEn: JSON.stringify(["ECB Meeting","June 26 Thu","Hike 65%"]),
    tagsRu: JSON.stringify(["Заседание ЕЦБ","26 июня чт","Повышение 65%"]),
    text: "ECB 6月议息会议（下周四）重磅来袭！市场预期加息25bp概率65%，若落地EUR/CNY有望回升至7.80+",
    textEn: "ECB June meeting (next Thursday) heavy! Market expects 65% probability of 25bp hike, if so EUR/CNY could recover to 7.80+",
    textRu: "Заседание ЕЦБ (следующий четверг)! Рынок ожидает 65% повышение на 25бп, EUR/CNY может восстановиться до 7.80+",
    detailedContent: `## ECB 6月议息会议前瞻

### 会议详情
| 项目 | 内容 |
|------|------|
| 📅 时间 | **2026年6月26日（周四）** |
| 🔮 加息概率 | **65%**（MUFG报告） |
| 💶 当前利率 | 3.00% |
| 📊 预期幅度 | +25bp → 3.25% |

### 三大情景预演
| 情景 | 概率 | EUR/CNY走势 | 套利影响 | 操作策略 |
|------|------|-------------|----------|----------|
| **加息25bp** | 65% | 7.80-7.85 | ✅ 利好价差扩大 | 加速询价，锁定中长期 |
| **意外不加息** | 25% | 7.65-7.70 | ⚠️ 价差压缩 | 暂停欧元定价订单 |
| **降息** | 10% | 7.55-7.60 | ❌ 急剧压缩 | 立即调整所有报价 |

### 准备工作
- 周四前完成EUR计价订单的汇率锁定
- 准备加息/不加息两套报价方案
- FR450等汇率不敏感标的同时推进`,
    detailedContentEn: `## ECB June Meeting Preview

### Meeting Details
| Item | Content |
|------|------|
| 📅 Date | **June 26, 2026 (Thu)** |
| 🔮 Hike Probability | **65%** (MUFG report) |
| 💶 Current Rate | 3.00% |
| 📊 Expected | +25bp → 3.25% |

### Three Scenarios
| Scenario | Probability | EUR/CNY | Arbitrage Impact | Strategy |
|------|------|-------------|----------|----------|
| **Hike 25bp** | 65% | 7.80-7.85 | ✅ Positive | Accelerate lock-in |
| **No hike** | 25% | 7.65-7.70 | ⚠️ Compressed | Pause EUR orders |
| **Cut** | 10% | 7.55-7.60 | ❌ Sharp compression | Adjust all quotes |

### Preparation
- Lock EUR order FX rates before Thursday
- Prepare two sets of quotes for hike/no-hike
- Push FX-insensitive products like FR450 in parallel`,
    detailedContentRu: `## Превью заседания ЕЦБ

### Детали заседания
| Параметр | Содержание |
|------|------|
| 📅 Дата | **26 июня 2026 (чт)** |
| 🔮 Вероятность повышения | **65%** (отчёт MUFG) |
| 💶 Текущая ставка | 3.00% |
| 📊 Ожидается | +25бп → 3.25% |

### Три сценария
| Сценарий | Вероятность | EUR/CNY | Арбитраж | Стратегия |
|------|------|-------------|----------|----------|
| **Повышение 25бп** | 65% | 7.80-7.85 | ✅ Положит. | Ускорить |
| **Без изменений** | 25% | 7.65-7.70 | ⚠️ Сжатие | Приостановить |
| **Снижение** | 10% | 7.55-7.60 | ❌ Резкое сжатие | Корректировка |

### Подготовка
- Зафиксировать курсы EUR до четверга
- Подготовить два варианта котировок
- Продвигать FR450 параллельно`,
    actionTips: JSON.stringify(["周四前完成EUR计价汇率锁定","准备加息/不加息两套报价方案","FR450等汇率不敏感标的同步推进"]),
    dataSummary: JSON.stringify([
      {label:"ECB会议",value:"6/26周四"},
      {label:"加息概率",value:"65%(25bp)"},
      {label:"当前EUR/CNY",value:"7.7681"},
      {label:"目标区间",value:"7.80-7.85(加息)"}
    ]),
  },

  // ===== sortOrder: 9 — 俄罗斯EU制裁+中国替代 =====
  {
    icon: "🇷🇺", region: "俄罗斯", regionEn: "Russia", regionRu: "Россия",
    tags: JSON.stringify(["EU制裁","中国替代","5%低关税"]),
    tagsEn: JSON.stringify(["EU Sanctions","China Substitution","5% Low Tariff"]),
    tagsRu: JSON.stringify(["Санкции ЕС","Замена Китаем","5% низкая пошлина"]),
    text: "EU对俄制裁持续+配件断供加速！俄罗斯农业机械列2026优先产业，5%低关税+政府补贴",
    textEn: "EU sanctions on Russia continue + parts disruption accelerates! Russian ag machinery ranked 2026 priority industry, 5% low tariff + gov subsidies",
    textRu: "Санкции ЕС против России продолжаются + перебои с запчастями растут! Сельхозмашиностроение РФ — приоритет 2026, 5% низкая пошлина + госсубсидии",
    detailedContent: `## 俄罗斯市场：EU制裁+中国替代窗口

### 制裁影响
| 维度 | 变化 |
|------|------|
| EU第20轮制裁 | 新增120项清单，2年来最大规模 |
| 配件断供 | CLAAS/Deere/Kubota配件中断加剧 |
| 中国设备替代 | 二手中国农机不受制裁限制 |
| EUR/RUB | 83.87稳定，卢布小幅走强 |

### 俄罗斯农机政策
| 政策 | 内容 |
|------|------|
| 2026优先产业 | 农业机械排第一 |
| 进口关税 | **5%低关税** |
| 政府补贴 | 农机购置补贴50% |
| 远东路运 | 中俄铁路30-40天到货 |

### 神雕机会
- CLAAS 970/980/850均符合俄市场需求
- 俄语说明书+配件承诺增强信任
- CIPS人民币结算推进中`,
    detailedContentEn: `## Russia Market: EU Sanctions + China Substitution

### Sanction Impact
| Dimension | Change |
|------|------|
| EU 20th round | 120 new items, largest in 2 years |
| Parts disruption | CLAAS/Deere/Kubota supply increasingly interrupted |
| China substitution | Used Chinese machinery not sanctioned |
| EUR/RUB | 83.87 stable, RUB slightly stronger |

### Russia Ag Policy
| Policy | Content |
|------|------|
| 2026 Priority | Agricultural machinery #1 |
| Import tariff | **5% low tariff** |
| Gov subsidy | 50% machinery purchase subsidy |
| Railway | China-Russia 30-40 day delivery |

### Opportunity
- CLAAS 970/980/850 all match Russian demand
- Russian manuals + parts commitment build trust
- CIPS RMB settlement advancing`,
    detailedContentRu: `## Рынок РФ: санкции ЕС + замена Китаем

### Влияние санкций
| Измерение | Изменение |
|------|------|
| 20-й раунд ЕС | 120 позиций, крупнейший за 2 года |
| Перебои с запчастями | CLAAS/Deere/Kubota — рост перебоев |
| Замена Китаем | Б/у китайская техника вне санкций |
| EUR/RUB | 83.87 стабильно, RUB слегка укрепился |

### Политика РФ в АПК
| Политика | Содержание |
|------|------|
| Приоритет 2026 | Сельхозмашиностроение №1 |
| Импортная пошлина | **5% низкая** |
| Госсубсидии | 50% на покупку техники |
| Ж/Д | Китай-Россия 30-40 дней |

### Возможности
- CLAAS 970/980/850 соответствуют спросу РФ
- Русские инструкции + запчасти = доверие
- Расчёты CIPS продвигаются`,
    actionTips: JSON.stringify(["重点推CLAAS二手970/980替代欧美断供","提供俄语说明书+配件供应承诺","利用5%低关税+50%补贴政策促销"]),
    dataSummary: JSON.stringify([
      {label:"EU制裁",value:"第20轮进行中"},
      {label:"俄农业",value:"2026优先产业"},
      {label:"关税",value:"5%"},
      {label:"补贴",value:"50%购置补贴"}
    ]),
  },

  // ===== sortOrder: 10 — 乌克兰FAO+AGRO 2026展 =====
  {
    icon: "🇺🇦", region: "乌克兰", regionEn: "Ukraine", regionRu: "Украина",
    tags: JSON.stringify(["FAO计划","AGRO 2026","83.6百万吨"]),
    tagsEn: JSON.stringify(["FAO Plan","AGRO 2026","83.6M Tons"]),
    tagsRu: JSON.stringify(["План FAO","AGRO 2026","83.6 млн тонн"]),
    text: "FAO确认乌克兰2026谷物83.6百万吨！AGRO 2026展7月基辅举办，BP1290基辅渠道活跃",
    textEn: "FAO confirms Ukraine 2026 grain 83.6M tons! AGRO 2026 exhibition July in Kyiv, BP1290 Kyiv channel active",
    textRu: "ФАО подтвердила 83.6 млн тонн зерна Украины в 2026! Выставка AGRO 2026 в июле в Киеве, канал BP1290 Киев активен",
    detailedContent: `## 乌克兰农机市场

### 核心指标
| 指标 | 数值 |
|------|------|
| 🌾 FAO谷物预测 | 83.6百万吨（2026） |
| 🏆 AGRO 2026展 | 7月9-11日，基辅，第34届 |
| 🚛 物流 | 黑海+多瑙河路线已恢复 |
| 📈 农机需求 | 战后重建刚性增长 |

### 神雕农机乌克兰布局
| 业务线 | 状态 | 行动 |
|--------|------|------|
| BP1290基辅渠道 | ✅ 活跃 | 2024款€200K已有报价 |
| AGRO 2026参展 | 📋 准备中 | 俄语/乌语资料翻译 |
| 黑海物流 | ✅ 可行 | 天津→敖德萨30-40天 |

### 展前准备清单
1. 注册线上参展（或委托当地代理）
2. 俄语/乌语产品资料翻译
3. 更新报价单（含FOB天津/青岛）
4. 准备BP1290/970/980重点展品
5. 提前1个月完成备货`,
    detailedContentEn: `## Ukraine Agricultural Machinery Market

### Core Indicators
| Indicator | Value |
|------|------|
| 🌾 FAO Grain Forecast | 83.6M tons (2026) |
| 🏆 AGRO 2026 | July 9-11, Kyiv, 34th edition |
| 🚛 Logistics | Black Sea + Danube routes restored |
| 📈 Ag machinery demand | Post-war reconstruction rigid growth |

### Shendiao Ukraine Layout
| Business Line | Status | Action |
|--------|------|------|
| BP1290 Kyiv channel | ✅ Active | 2024 €200K quoted |
| AGRO 2026 exhibition | 📋 Prep | RU/UA translation |
| Black Sea logistics | ✅ Feasible | Tianjin→Odessa 30-40 days |

### Pre-Exhibition Checklist
1. Register online (or local agent)
2. RU/UA product materials translation
3. Update quotation sheets
4. Prepare BP1290/970/980 key exhibits
5. Complete stock preparation 1 month ahead`,
    detailedContentRu: `## Рынок сельхозтехники Украины

### Ключевые показатели
| Показатель | Значение |
|------|------|
| 🌾 Прогноз зерна ФАО | 83.6 млн тонн (2026) |
| 🏆 AGRO 2026 | 9-11 июля, Киев, 34-я |
| 🚛 Логистика | Чёрное море + Дунай восстановлены |
| 📈 Спрос на с/х технику | Послевоенный рост |

### План Shendiao в Украине
| Направление | Статус | Действие |
|--------|------|------|
| Канал BP1290 Киев | ✅ Активен | 2024 €200K |
| Выставка AGRO 2026 | 📋 Подготовка | Перевод RU/UA |
| Логистика Чёрного моря | ✅ Возможна | Тяньцзинь→Одесса 30-40 дн. |

### Подготовка к выставке
1. Регистрация онлайн (или местный агент)
2. Перевод материалов на RU/UA
3. Обновление прайс-листов
4. Подготовка BP1290/970/980
5. Завершение закупок за 1 месяц`,
    actionTips: JSON.stringify(["AGRO 2026展7月前完成备货+物流确认","俄语/乌语资料翻译完成","基辅BP1290渠道继续深化"]),
    dataSummary: JSON.stringify([
      {label:"FAO谷物",value:"83.6百万吨(2026)"},
      {label:"AGRO 2026",value:"7/9-11基辅"},
      {label:"BP1290基辅",value:"渠道活跃"}
    ]),
  },

  // ===== sortOrder: 11 — 新兴市场（乌兹别克/非洲/印尼） =====
  {
    icon: "🚀", region: "全球", regionEn: "Global", regionRu: "Глобально",
    tags: JSON.stringify(["乌兹别克+256%","非洲+46%","印尼+121%"]),
    tagsEn: JSON.stringify(["Uzbekistan+256%","Africa+46%","Indonesia+121%"]),
    tagsRu: JSON.stringify(["Узбекистан+256%","Африка+46%","Индонезия+121%"]),
    text: "新兴市场爆发：乌兹别克+256.77%全球最快！非洲肯尼亚+46.6%/印尼+121.07%，三线同时布局窗口",
    textEn: "Emerging markets booming: Uzbekistan +256.77% globally fastest! Kenya Africa +46.6%/Indonesia +121.07%, triple-front expansion window",
    textRu: "Развивающиеся рынки: Узбекистан +256.77% самый быстрый в мире! Кения +46.6%/Индонезия +121.07%, окно расширения на три фронта",
    detailedContent: `## 全球新兴市场三线布局

### 三大市场数据对比
| 市场 | 增速 | 主力需求 | 神雕优势 | 物流 |
|------|------|---------|---------|------|
| 🇺🇿 **乌兹别克斯坦** | **+256.77%** 🏆全球最快 | 棉花采收/青储机 | 中吉乌铁路15天直达 | 陆运 |
| 🇰🇪 **非洲肯尼亚** | **+46.6%** | 50-100HP拖拉机 | 欧洲新品20-30%价格 | 海运 |
| 🇮🇩 **印尼** | **+121.07%** | 小型收割机/微耕机 | RCEP关税优惠 | 海运 |

### 乌兹别克斯坦详情
| 指标 | 数值 |
|------|------|
| Q1进口增速 | **+256.77%**（全球最快） |
| 棉花采收机械化率 | 不足40% |
| 政府补贴 | 50%农机购置补贴 |
| 物流 | 中吉乌铁路建设加速，15天直达 |

### 非洲详情
| 指标 | 数值 |
|------|------|
| 肯尼亚增速 | +46.6% |
| 主力需求 | 50-100HP拖拉机 |
| 中国二手vs欧洲新 | 20-30%价格 |
| 非洲大陆自贸区 | 降低关税壁垒 |

### 印尼详情
| 指标 | 数值 |
|------|------|
| 增速 | +121.07% |
| 主力需求 | 小型收割机/微耕机 |
| RCEP | 关税优惠 |
| 中泰农机协议 | 推进中 |

### 三线布局优先级
1. 🔴 乌兹别克斯坦（最快增长+中吉乌铁路）
2. 🟡 印尼（爆发增长+小型机需求匹配）
3. 🟢 非洲（持续增长+农机需求多元化）`,
    detailedContentEn: `## Global Emerging Markets Triple-Front Expansion

### Three Market Comparison
| Market | Growth | Main Demand | Shendiao Advantage | Logistics |
|------|------|---------|---------|------|
| 🇺🇿 **Uzbekistan** | **+256.77%** 🏆Global fastest | Cotton harvest/Forage | Railway 15-day direct | Land |
| 🇰🇪 **Kenya Africa** | **+46.6%** | 50-100HP tractors | 20-30% of EU new price | Sea |
| 🇮🇩 **Indonesia** | **+121.07%** | Small harvesters/tillers | RCEP tariff benefits | Sea |

### Uzbekistan Details
| Indicator | Value |
|------|------|
| Q1 import growth | **+256.77%** (global fastest) |
| Cotton mechanization | Below 40% |
| Gov subsidy | 50% |
| Logistics | China-Kyrgyzstan-Uzbekistan railway |

### Africa Details
| Indicator | Value |
|------|------|
| Kenya growth | +46.6% |
| Main demand | 50-100HP tractors |
| Chinese used vs EU new | 20-30% price |

### Indonesia Details
| Indicator | Value |
|------|------|
| Growth | +121.07% |
| Main demand | Small harvesters/tillers |
| RCEP | Tariff benefits |

### Priority
1. 🔴 Uzbekistan (fastest + railway)
2. 🟡 Indonesia (surge + small machines)
3. 🟢 Africa (steady + diversified)`,
    detailedContentRu: `## Глобальные развивающиеся рынки — три фронта

### Сравнение трёх рынков
| Рынок | Рост | Основной спрос | Преимущество | Логистика |
|------|------|---------|---------|------|
| 🇺🇿 **Узбекистан** | **+256.77%** 🏆Быстрейший | Хлопок/Силос | Ж/Д 15 дней | Суша |
| 🇰🇪 **Кения Африка** | **+46.6%** | 50-100 л.с. тракторы | 20-30% цены ЕС | Море |
| 🇮🇩 **Индонезия** | **+121.07%** | Малые комбайны | RCEP льготы | Море |

### Узбекистан
| Показатель | Значение |
|------|------|
| Рост Q1 | **+256.77%** (мир) |
| Механизация хлопка | Ниже 40% |
| Субсидия | 50% |
| Ж/Д | Китай-Кыргызстан-Узбекистан |

### Африка
| Показатель | Значение |
|------|------|
| Рост Кении | +46.6% |
| Основной спрос | 50-100 л.с. |

### Индонезия
| Показатель | Значение |
|------|------|
| Рост | +121.07% |
| RCEP | Тарифные льготы |

### Приоритет
1. 🔴 Узбекистан (самый быстрый + ж/д)
2. 🟡 Индонезия (взрыв + малая техника)
3. 🟢 Африка (стабильный + диверсифицированный)`,
    actionTips: JSON.stringify(["乌兹别克语+俄语版产品手册优先制作","印尼市场小型收割机重点布局","非洲50-100HP拖拉机批量对接经销商"]),
    dataSummary: JSON.stringify([
      {label:"乌兹别克",value:"+256.77%全球最快"},
      {label:"非洲肯尼亚",value:"+46.6%"},
      {label:"印尼",value:"+121.07%"},
      {label:"三线优先级",value:"乌兹别克→印尼→非洲"}
    ]),
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
        tagsEn: item.tagsEn || null,
        tagsRu: item.tagsRu || null,
        text: item.text,
        textEn: item.textEn || null,
        textRu: item.textRu || null,
        detailedContent: item.detailedContent,
        detailedContentEn: item.detailedContentEn || null,
        detailedContentRu: item.detailedContentRu || null,
        dataSummary: item.dataSummary ? (Array.isArray(item.dataSummary) ? JSON.stringify(item.dataSummary) : item.dataSummary) : null,
        actionTips: item.actionTips ? (Array.isArray(item.actionTips) ? JSON.stringify(item.actionTips) : item.actionTips) : null,
        sortOrder: i,
      },
    });
  }
  console.log(`已导入 ${ALL_MARKET_INTEL.length} 条情报数据 (日期: 2026-06-22)`);
  console.log("验证: 5070小方捆是第一条 (sortOrder=0):", ALL_MARKET_INTEL[0].text.substring(0, 20));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
