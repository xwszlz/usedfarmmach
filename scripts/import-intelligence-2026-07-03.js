/**
 * 导入2026-07-03市场情报数据到数据库
 * 基于 2026-07-03_跨境套利日报.md 生成
 * 7月开局第3天 | AGRO 2026基辅展倒计时6天 | EUR/CNY 7.91跳升
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const TODAY = new Date("2026-07-03");

const ALL_MARKET_INTEL = [
  {
    icon: "💶", region: "全球", regionEn: "Global", regionRu: "Глобально",
    tags: '["汇率","EUR/CNY","7.91","7月开局"]',
    tagsEn: '["FX","EUR/CNY","7.91","July Open"]',
    tagsRu: '["Валюта","EUR/CNY","7.91","Открытие июля"]',
    text: "7/3周五EUR/CNY 7.91较7/2 7.741跳升+2.18%！欧洲市场报价人民币折算全面上行，套利空间被动扩大",
    textEn: "7/3 Friday EUR/CNY 7.91 jumped +2.18% vs 7/2 7.741! European quotes in CNY rise across the board, arbitrage space expands",
    textRu: "7/3 EUR/CNY 7.91 вырос +2.18% vs 7.741! Европейские цены в юанях растут, арбитражное окно расширяется",
    detailedContent: `## 7月开局第3天汇率全景

### 7/3周五开盘汇率
| 货币对 | 牌价 | 较7/2变化 | 较6/11(ECB加息日)变化 | 关键节点 |
|--------|------|------------|----------------------|----------|
| **EUR/CNY** | **7.91** | **+2.18%** | **+0.84%** | 7.91 |
| USD/CNY | 6.80 | ≈0% | +0.59% | 6.80 |
| **EUR/RUB** | **87.40** | **0%(CBR 6/27维持)** | **+5.52%🔥🔥** | 87.40 |
| EUR/GBP | ≈0.861 | 0% | — | 0.86 |

### 7月累计复盘（7/1-7/3）
| 指标 | 7月1日 | 7月3日 | 累计 | 影响 |
|------|--------|---------|--------|------|
| EUR/CNY | 7.741 | 7.91 | **+2.18%** | 欧元反弹→国际报价人民币折算上行 |
| USD/CNY | 6.80 | 6.80 | 0% | 美元窄幅持稳 |
| EUR/RUB | 87.403 | 87.40 | ≈0% | 卢布高位企稳 |

### 核心逻辑
> EUR反弹 + RUB高位 = 俄线出口毛利历史级黄金窗口进一步扩张
> 7/3为7月第3个交易日，欧洲市场人民币折算价全面上涨约2.2%，是出货良机`,
    detailedContentEn: `## July Day 3 FX Panorama

### 7/3 Friday Open FX Rates
| Pair | Rate | vs 7/2 | vs 6/11 | Key Level |
|--------|------|------------|----------------------|----------|
| **EUR/CNY** | **7.91** | **+2.18%** | **+0.84%** | 7.91 |
| USD/CNY | 6.80 | ≈0% | +0.59% | 6.80 |
| **EUR/RUB** | **87.40** | **0%(CBR 6/27)** | **+5.52%🔥🔥** | 87.40 |
| EUR/GBP | ≈0.861 | 0% | — | 0.86 |

### July Cumulative (7/1-7/3)
| Indicator | Jul 1 | Jul 3 | Cumulative | Impact |
|------|--------|---------|--------|------|
| EUR/CNY | 7.741 | 7.91 | **+2.18%** | Euro rebound→European quotes in CNY rise |
| USD/CNY | 6.80 | 6.80 | 0% | USD stable |
| EUR/RUB | 87.403 | 87.40 | ≈0% | RUB high stable |

### Core Logic
> EUR rebound + RUB high = Russia export golden window expands further
> July 3rd trading day, European quotes in CNY rise ~2.2%, good selling window`,
    detailedContentRu: `## Июль день 3 Валюта

### 7/3 пятница курсы
| Пара | Курс | vs 7/2 | vs 6/11 | Уровень |
|--------|------|------------|----------------------|----------|
| **EUR/CNY** | **7.91** | **+2.18%** | **+0.84%** | 7.91 |
| USD/CNY | 6.80 | ≈0% | +0.59% | 6.80 |
| **EUR/RUB** | **87.40** | **0%(ЦБ 27/6)** | **+5.52%🔥🔥** | 87.40 |
| EUR/GBP | ≈0.861 | 0% | — | 0.86 |

### Июль накопительно (1-3 июля)
| Показатель | 1 июля | 3 июля | Итог | Влияние |
|------|--------|---------|--------|------|
| EUR/CNY | 7.741 | 7.91 | **+2.18%** | Евро растёт |
| USD/CNY | 6.80 | 6.80 | 0% | USD стабилен |
| EUR/RUB | 87.403 | 87.40 | ≈0% | RUB высоко |

### Ключевая логика
> EUR растёт + RUB высоко = историческое окно экспорта в РФ расширяется
> 3 июля европейские цены в юанях растут ~2.2%, удобное окно для продаж`,
    actionTips: '["利用EUR/CNY 7.91高位窗口加速出货","7/3开盘立即锁定俄线客户报价","关注7/22-23 ECB+7/25 CBR关键事件节点"]',
    dataSummary: '[{"label":"EUR/CNY","value":"7.91(+2.18% vs 7/2)"},{"label":"EUR/RUB","value":"87.40(月+5.52%)"},{"label":"7/3欧元反弹","value":"套利空间被动扩大"}]',
  },
  {
    icon: "🇷🇺", region: "俄罗斯", regionEn: "Russia", regionRu: "Россия",
    tags: '["俄罗斯","5%关税","人民币结算","进口替代"]',
    tagsEn: '["Russia","5% Tariff","RMB Settlement","Import Substitution"]',
    tagsRu: '["Россия","5% пошлина","Расчёты в юанях","Импортозамещение"]',
    text: "俄罗斯农机进口政策红利持续：核心农机设备5%低关税+人民币/CIPS结算通道已开通，俄线出口历史级窗口延续",
    textEn: "Russia farm machinery import policy benefits continue: 5% low tariff + RMB/CIPS settlement available, Russia export golden window extends",
    textRu: "РФ: сельхозтехника под 5% пошлиной + расчёты в юанях/CIPS, золотое окно экспорта продлено",
    detailedContent: `## 俄罗斯农机进口政策红利持续

### 政策要点
| 政策要点 | 当前状态 | 我方应对 |
|----------|----------|---------|
| **产业排名** | **2026年第1位**优先产业 | 最高通关优先级 ✅ |
| **进口关税** | 核心设备**5%** | 成本降低10-15个百分点 ✅ |
| **结算方式** | **人民币/CIPS通道**已开通 | 汇率风险基本消除 ✅ |
| **投资计划** | 2030年前**1050-2000亿美元**智慧农业 | 长期需求保障 ✅ |
| **设备缺口** | 约**50%农机超使用寿命** | 替换需求爆发中 ✅ |

### 7/3行动建议
- 5300RC/FR450/970/980优先推俄线
- 利用人民币结算降低汇率风险
- 关注EU第21轮制裁草案对配件替代的影响`,
    detailedContentEn: `## Russia Farm Machinery Import Policy Window Continues

### Policy Highlights
| Policy | Status | Our Response |
|----------|----------|---------|
| **Industry Priority** | **#1 in 2026** | Highest customs priority ✅ |
| **Import Tariff** | Core equipment **5%** | Cost down 10-15pp ✅ |
| **Settlement** | **RMB/CIPS** available | FX risk minimized ✅ |
| **Investment Plan** | **$105-200B** smart agriculture by 2030 | Long-term demand ✅ |
| **Equipment Gap** | ~**50% machinery overdue** | Replacement demand ✅ |

### 7/3 Actions
- 5300RC/FR450/970/980 to Russia priority
- Use RMB settlement to reduce FX risk
- Watch EU 21st sanctions draft impact on parts substitution`,
    detailedContentRu: `## Россия: окно политических льгот продолжается

### Ключевые политики
| Пункт | Статус | Ответ |
|----------|----------|---------|
| **Приоритет** | **#1 в 2026** | Высший приоритет таможни ✅ |
| **Пошлина** | **5%** | Снижение затрат ✅ |
| **Расчёты** | **Юань/CIPS** | Валютный риск минимален ✅ |
| **Инвестиции** | **$105-200B** до 2030 | Долгосрочный спрос ✅ |
| **Пробел** | **50% техники** выработала ресурс | Замена ✅ |

### Действия 7/3
- 5300RC/FR450/970/980 в РФ приоритет
- Расчёты в юанях
- Санкции ЕС 21 раунд`,
    actionTips: '["5300RC/FR450/970/980俄线优先推","人民币结算降低汇率风险","关注EU第21轮制裁对配件替代影响"]',
    dataSummary: '[{"label":"俄农机进口关税","value":"5%"},{"label":"人民币结算","value":"已开通"},{"label":"设备超寿命比例","value":"约50%"}]',
  },
  {
    icon: "🌾", region: "乌克兰", regionEn: "Ukraine", regionRu: "Украина",
    tags: '["AGRO 2026","基辅展","倒计时6天","乌克兰"]',
    tagsEn: '["AGRO 2026","Kyiv Expo","D-6","Ukraine"]',
    tagsRu: '["AGRO 2026","Киев","D-6","Украина"]',
    text: "AGRO 2026基辅展倒计时6天（7/9-11）！最后备货+物流+俄语翻译+展台搭建冲刺，970/980/5300RC参展主推",
    textEn: "AGRO 2026 Kyiv Expo D-6 (7/9-11)! Final rush on cargo, logistics, Russian translation, booth setup; 970/980/5300RC main exhibits",
    textRu: "AGRO 2026 Киев D-6 (9-11 июля)! Последняя подготовка, 970/980/5300RC главные экспонаты",
    detailedContent: `## AGRO 2026基辅展倒计时6天

### 展会信息
| 项目 | 详情 |
|------|------|
| 名称 | AGRO 2026 |
| 地点 | 基辅 |
| 时间 | 2026年7月9-11日 |
| 倒计时 | **6天** |
| 神雕主推 | 970/980/5300RC/FR450/FR500/9080 |

### 7/3-7/5行动清单
| 优先级 | 事项 | 截止 |
|--------|------|------|
| 🔥P0 | 参展设备清单终稿+物流确认 | 7/4 |
| 🔥P0 | 俄语版产品手册校对终稿 | 7/3 |
| ⚡P1 | 展台搭建+翻译安排 | 7/5 |
| ⚡P1 | 乌克兰及周边客户邀约 | 7/5 |

### 展前重点关注
- 乌克兰战后农机需求旺盛
- 欧洲品牌退出后中国设备替代窗口
- 展前可完成1-2台样机预定`,
    detailedContentEn: `## AGRO 2026 Kyiv Expo D-6

### Expo Info
| Item | Detail |
|------|------|
| Name | AGRO 2026 |
| Location | Kyiv |
| Date | July 9-11, 2026 |
| Countdown | **6 days** |
| Main exhibits | 970/980/5300RC/FR450/FR500/9080 |

### 7/3-7/5 Action List
| Priority | Task | Deadline |
|--------|------|------|
| 🔥P0 | Final equipment list + logistics | 7/4 |
| 🔥P0 | Russian product manual final proof | 7/3 |
| ⚡P1 | Booth setup + interpreter | 7/5 |
| ⚡P1 | Ukraine & nearby customer invites | 7/5 |

### Pre-Expo Focus
- Strong Ukraine post-war machinery demand
- China substitution window after European brands exit
- 1-2 sample machine bookings possible before expo`,
    detailedContentRu: `## AGRO 2026 Киев D-6

### Информация
| Пункт | Детали |
|------|------|
| Название | AGRO 2026 |
| Место | Киев |
| Дата | 9-11 июля 2026 |
| Дней | **6** |
| Главные экспонаты | 970/980/5300RC/FR450/FR500/9080 |

### Действия 3-5 июля
| Приоритет | Задача | Дедлайн |
|--------|------|------|
| 🔥P0 | Список техники + логистика | 4 июля |
| 🔥P0 | Русский перевод каталогов | 3 июля |
| ⚡P1 | Стенд + переводчик | 5 июля |
| ⚡P1 | Приглашения клиентов | 5 июля |

### Фокус
- Послевоенный спрос Украины
- Окно замены китайской техники
- 1-2 бронирования до выставки`,
    actionTips: '["AGRO展前6天冲刺：物流+翻译+展台搭建","970/980/5300RC参展主推","乌克兰及周边客户邀约截止7/5"]',
    dataSummary: '[{"label":"AGRO 2026","value":"7/9-11基辅"},{"label":"倒计时","value":"6天"},{"label":"主推","value":"970/980/5300RC"}]',
  },
  {
    icon: "🇨🇳", region: "中国", regionEn: "China", regionRu: "Китай",
    tags: '["5300RC","339.3%","俄线王牌"]',
    tagsEn: '["5300RC","339.3%","Russia Trump Card"]',
    tagsRu: '["5300RC","339.3%","Козырь РФ"]',
    text: "CLAAS 5300RC(2020)价差率339.3%（较7/2 330%提升）！受EUR/CNY 7.91跳升影响，国内18万 vs 国际79.1万，价差61.1万",
    textEn: "CLAAS 5300RC(2020) spread 339.3% (up from 330%)! Domestic ¥180K vs international ¥791K, spread ¥611K",
    textRu: "CLAAS 5300RC(2020) разница 339.3%! ¥180K vs ¥791K, разница ¥611K",
    detailedContent: `## CLAAS 5300RC(2020) 339.3% 俄线王牌

### 核心数据
| 项目 | 7/2 | 7/3 (EUR/CNY 7.91) |
|------|------|----------------------|
| 国内售价 | ¥18万 | ¥18万 |
| 国际参考价 | €99,900≈¥77.4万 | €99,900≈¥79.1万 |
| 价差 | ¥59.4万 | **¥61.1万** |
| 价差率 | 330.0% | **339.3%** |
| 变化 | — | +9.3pp⬆️ |

### 优势
- 18万超低门槛，买家决策快
- 339.3%翻3.4倍利润
- RUB月增厚+5.52%叠加
- EU制裁下中国替代设备不受限

### 7/3行动
- 俄线绝对优先推广
- 18万白菜价+高利润=最佳走量单品
- AGRO展前完成至少1台对接`,
    detailedContentEn: `## CLAAS 5300RC(2020) 339.3% Russia Trump Card

### Core Data
| Item | 7/2 | 7/3 (EUR/CNY 7.91) |
|------|------|----------------------|
| Domestic Price | ¥180K | ¥180K |
| International Reference | €99,900≈¥774K | €99,900≈¥791K |
| Spread | ¥594K | **¥611K** |
| Spread Rate | 330.0% | **339.3%** |
| Change | — | +9.3pp⬆️ |

### Advantages
- ¥180K low barrier
- 339.3% 3.4x profit
- RUB monthly boost +5.52%
- China substitution unaffected by EU sanctions

### 7/3 Actions
- Russia line absolute priority
- ¥180K bargain + high margin = best volume item
- Complete 1 match before AGRO expo`,
    detailedContentRu: `## CLAAS 5300RC(2020) 339.3% Козырь РФ

### Основные данные
| Пункт | 7/2 | 7/3 (EUR/CNY 7.91) |
|------|------|----------------------|
| Внутренняя | ¥180K | ¥180K |
| Международная | €99,900≈¥774K | €99,900≈¥791K |
| Разница | ¥594K | **¥611K** |
| Ставка | 330.0% | **339.3%** |
| Изменение | — | +9.3pp⬆️ |

### Преимущества
- ¥180K низкий порог
- 339.3% ×3.4
- RUB +5.52%
- Китайская замена не под санкциями

### Действия 7/3
- Приоритет РФ
- 1 сделка до AGRO`,
    actionTips: '["5300RC(2020)俄线绝对优先推广","18万白菜价+339.3%=利润最高单品","AGRO展前完成至少1台对接"]',
    dataSummary: '[{"label":"国内价","value":"¥18万"},{"label":"国际参考","value":"¥79.1万"},{"label":"价差率","value":"339.3%"}]',
  },
  {
    icon: "🇨🇳", region: "中国", regionEn: "China", regionRu: "Китай",
    tags: '["FR450","104.7%","10台爆款"]',
    tagsEn: '["FR450","104.7%","10 Units Hot"]',
    tagsRu: '["FR450","104.7%","10 ед. хит"]',
    text: "New Holland FR450(2013)104.7%×10台7月集中出货！21.5万/台 vs 俄市场44万，总毛利约225万，RUB红利叠加",
    textEn: "New Holland FR450(2013) 104.7% × 10 units July bulk target! ¥215K/unit vs Russia ¥440K, total gross profit ≈¥2.25M",
    textRu: "New Holland FR450(2013) 104.7% × 10 ед. июль! ¥215K/ед vs РФ ¥440K, прибыль ≈¥2.25M",
    detailedContent: `## New Holland FR450(2013) 104.7% 10台爆款

### 核心数据
| 项目 | 数值 |
|------|------|
| 型号 | New Holland FR450(9040) 青储收获机 |
| 年份 | 2013 |
| 国内售价 | ¥21.5万/台 |
| 俄市场参考价 | ¥44万/台 |
| 价差 | ¥22.5万/台 |
| 价差率 | **104.7%** ⭐⭐⭐⭐⭐ |
| 库存 | **10台** |
| 总利润 | **约225万元** |

### 为什么是7月走量王？
- 价差率104.7%翻倍利润
- 10台库存可批发走量
- 21.5万低门槛买家决策快
- RUB红利+5.52%额外增厚
- 汇率敏感度低利润确定性高

### 7/3行动清单
- 周五开盘立即俄语区批量报价
- 10台车况+备货状态终验（P0）
- 可提供FOB天津含税报价`,
    detailedContentEn: `## New Holland FR450(2013) 104.7% 10 Units July Bulk

### Core Data
| Item | Value |
|------|------|
| Model | New Holland FR450(9040) Forage Harvester |
| Year | 2013 |
| Domestic Price | ¥215K/unit |
| Russian Market Reference | ¥440K/unit |
| Spread | ¥225K/unit |
| Spread Rate | **104.7%** ⭐⭐⭐⭐⭐ |
| Inventory | **10 units** |
| Total Profit | **≈¥2.25M** |

### Why July Volume King?
- 104.7% double profit
- 10 units stock wholesale volume
- ¥215K low barrier fast decisions
- RUB bonus +5.52%
- Low FX sensitivity high certainty

### 7/3 Actions
- Friday bulk pricing to Russian region
- 10 unit condition inspection (P0)
- FOB Tianjin pricing available`,
    detailedContentRu: `## FR450(2013) 104.7% 10 ед. Июль

### Основные данные
| Пункт | Значение |
|------|------|
| Модель | FR450(9040) |
| Год | 2013 |
| Внутренняя | ¥215K/ед |
| РФ | ¥440K/ед |
| Разница | ¥225K/ед |
| Ставка | **104.7%** ⭐⭐⭐⭐⭐ |
| Склад | **10 ед.** |
| Прибыль | **≈¥2.25M** |

### Почему хит июля
- 104.7% двойная прибыль
- 10 ед. опт
- ¥215K низкий порог
- RUB +5.52%

### Действия 7/3
- Массовое предложение РФ
- Осмотр 10 ед. (P0)
- FOB Тяньцзинь`,
    actionTips: '["FR450×10台7月集中出货=约225万毛利","周五开盘即俄语区批量报价","10台车况终验P0优先级最高"]',
    dataSummary: '[{"label":"国内价","value":"¥21.5万/台"},{"label":"俄市场","value":"¥44万/台"},{"label":"价差率","value":"104.7%"},{"label":"库存","value":"10台"}]',
  },
  {
    icon: "🇨🇳", region: "中国", regionEn: "China", regionRu: "Китай",
    tags: '["BP1290","99.0%","中亚/俄线"]',
    tagsEn: '["BP1290","99.0%","Central Asia/Russia"]',
    tagsRu: '["BP1290","99.0%","ЦА/РФ"]',
    text: "Krone BiG Pack 1290(2020)价差率99.0%（较7/2 94.4%提升）！国内68万 vs EU€170.8K=135.1万，受欧元反弹影响价差扩大",
    textEn: "Krone BiG Pack 1290(2020) spread 99.0% (up from 94.4%)! Domestic ¥680K vs EU€170.8K=¥1.351M, spread widens on euro rebound",
    textRu: "Krone BP1290(2020) разница 99.0%! ¥680K vs €170.8K=¥1.351M, окно расширяется",
    detailedContent: `## Krone BiG Pack 1290(2020) 99.0% 打捆机冠军

### 核心数据
| 项目 | 7/2 | 7/3 (EUR/CNY 7.91) |
|------|------|----------------------|
| 国内售价 | ¥68万 | ¥68万 |
| 国际参考价 | €170,800≈¥132.2万 | €170,800≈¥135.1万 |
| 价差 | ¥64.2万 | **¥67.1万** |
| 价差率 | 94.4% | **99.0%** ⭐⭐⭐⭐⭐ |
| 变化 | — | +4.6pp⬆️ |

### 优势
- 99.0%接近翻倍利润
- 中亚+俄线均刚需
- RUB红利叠加+5.52%
- 展前出货优质标的

### 1290系列在售（4条维持）
| 年份 | 价格(EUR) | 换算人民币(@7.91) | 工时 | 所在地 |
|------|-----------|------------------|------|--------|
| 2020 | €170,800 | ≈135.1万 | 1,800h | 德国 |
| 2019 | €155,000 | ≈122.6万 | 2,200h | 法国 |
| 2018 | €138,500 | ≈109.6万 | 2,500h | 德国 |`,
    detailedContentEn: `## Krone BiG Pack 1290(2020) 99.0% Baler Champion

### Core Data
| Item | 7/2 | 7/3 (EUR/CNY 7.91) |
|------|------|----------------------|
| Domestic Price | ¥680K | ¥680K |
| International Reference | €170,800≈¥1.322M | €170,800≈¥1.351M |
| Spread | ¥642K | **¥671K** |
| Spread Rate | 94.4% | **99.0%** ⭐⭐⭐⭐⭐ |
| Change | — | +4.6pp⬆️ |

### Advantages
- 99.0% near double profit
- Central Asia + Russia essential demand
- RUB bonus +5.52%
- Pre-exhibition quality target

### 1290 Series Listings (4 maintained)
| Year | Price(EUR) | ≈CNY(@7.91) | Hours | Location |
|------|-----------|-------------|------|--------|
| 2020 | €170,800 | ≈1.351M | 1,800h | Germany |
| 2019 | €155,000 | ≈1.226M | 2,200h | France |
| 2018 | €138,500 | ≈1.096M | 2,500h | Germany |`,
    detailedContentRu: `## BP1290(2020) 99.0% Чемпион прессов

### Основные данные
| Пункт | 7/2 | 7/3 (EUR/CNY 7.91) |
|------|------|----------------------|
| Внутренняя | ¥680K | ¥680K |
| Международная | €170,800≈¥1.322M | €170,800≈¥1.351M |
| Разница | ¥642K | **¥671K** |
| Ставка | 94.4% | **99.0%** ⭐⭐⭐⭐⭐ |
| Изменение | — | +4.6pp⬆️ |

### Преимущества
- 99.0%
- ЦА+РФ
- RUB +5.52%
- До AGRO

### 1290 в продаже (4)
| Год | EUR | ≈CNY | Часы |
|------|------|------|------|
| 2020 | €170,800 | 1.351M | 1,800 |
| 2019 | €155,000 | 1.226M | 2,200 |
| 2018 | €138,500 | 1.096M | 2,500 |`,
    actionTips: '["BP1290(2020)优先推中亚+俄线","99.0%+RUB红利=展前出货优质标的","对接俄大型牧场+中亚经销商"]',
    dataSummary: '[{"label":"国内价","value":"¥68万"},{"label":"国际参考","value":"¥135.1万"},{"label":"价差率","value":"99.0%"}]',
  },
  {
    icon: "🇨🇳", region: "中国", regionEn: "China", regionRu: "Китай",
    tags: '["980","77.3%","AGRO展主力"]',
    tagsEn: '["980","77.3%","AGRO Main Push"]',
    tagsRu: '["980","77.3%","AGRO"]',
    text: "CLAAS Jaguar 980(2016)价差率77.3%（较7/2 73.5%提升）！国内143万 vs EU€320K=253.5万，受欧元反弹影响价差扩大",
    textEn: "CLAAS Jaguar 980(2016) spread 77.3% (up from 73.5%)! Domestic ¥1.43M vs EU€320K=¥2.535M, AGRO main push + Russia line",
    textRu: "CLAAS Jaguar 980(2016) разница 77.3%! ¥1.43M vs €320K=¥2.535M, AGRO + РФ",
    detailedContent: `## CLAAS Jaguar 980(2016) 77.3% 稳定套利王

### 核心数据
| 项目 | 7/2 | 7/3 (EUR/CNY 7.91) |
|------|------|----------------------|
| 国内售价 | ¥143万 | ¥143万 |
| 国际参考价 | EU€320,381≈¥248.1万 | EU€320,381≈¥253.5万 |
| 价差 | ¥105.1万 | **¥110.5万** |
| 价差率 | 73.5% | **77.3%** ⭐⭐⭐⭐⭐ |
| 变化 | — | +3.8pp⬆️ |

### 980系列在售（9条维持）
| 年份 | 价格(GBP) | 换算人民币(@7.91) | 工时 | 所在地 |
|------|-----------|------------------|------|--------|
| 2024 | £403,500 | 370.7万 | 1,750h | 德国 |
| 2023 | £275,956 | 253.5万 | 2,304h | 法国 |
| 2019 | £218,400 | 200.6万 | 2,100h | 德国 |

### 7/3行动
- AGRO展主推机型
- 价差110.5万+RMB结算
- 可搭配970组合方案提升客单价`,
    detailedContentEn: `## CLAAS Jaguar 980(2016) 77.3% Stable Arbitrage King

### Core Data
| Item | 7/2 | 7/3 (EUR/CNY 7.91) |
|------|------|----------------------|
| Domestic Price | ¥1.43M | ¥1.43M |
| International Reference | EU€320,381≈¥2.481M | EU€320,381≈¥2.535M |
| Spread | ¥1.051M | **¥1.105M** |
| Spread Rate | 73.5% | **77.3%** ⭐⭐⭐⭐⭐ |
| Change | — | +3.8pp⬆️ |

### 980 Series Listings (9 maintained)
| Year | Price(GBP) | ≈CNY(@7.91) | Hours | Location |
|------|-----------|-------------|------|--------|
| 2024 | £403,500 | 3.707M | 1,750h | Germany |
| 2023 | £275,956 | 2.535M | 2,304h | France |
| 2019 | £218,400 | 2.006M | 2,100h | Germany |

### 7/3 Actions
- AGRO expo main model
- Spread ¥1.105M + RMB settlement
- Bundle with 970 for higher ticket`,
    detailedContentRu: `## 980(2016) 77.3% Король арбитража

### Основные данные
| Пункт | 7/2 | 7/3 (EUR/CNY 7.91) |
|------|------|----------------------|
| Внутренняя | ¥1.43M | ¥1.43M |
| Международная | €320,381≈¥2.481M | €320,381≈¥2.535M |
| Разница | ¥1.051M | **¥1.105M** |
| Ставка | 73.5% | **77.3%** ⭐⭐⭐⭐⭐ |
| Изменение | — | +3.8pp⬆️ |

### 980 в продаже (9)
| Год | GBP | ≈CNY | Часы |
|------|------|------|------|
| 2024 | £403,500 | 3.707M | 1,750 |
| 2023 | £275,956 | 2.535M | 2,304 |
| 2019 | £218,400 | 2.006M | 2,100 |

### Действия 7/3
- AGRO главная модель
- Разница ¥1.105M
- С 970 выше чек`,
    actionTips: '["980(2016)作AGRO展主推机型","价差110.5万+RMB结算=确定性高","可搭配970组合方案提升客单价"]',
    dataSummary: '[{"label":"国内价","value":"¥143万"},{"label":"国际参考","value":"¥253.5万"},{"label":"价差率","value":"77.3%"}]',
  },
  {
    icon: "🇺🇿", region: "乌兹别克斯坦", regionEn: "Uzbekistan", regionRu: "Узбекистан",
    tags: '["乌兹别克斯坦","+256.77%","全球最快"]',
    tagsEn: '["Uzbekistan","+256.77%","Fastest Globally"]',
    tagsRu: '["Узбекистан","+256.77%","Самый быстрый рост"]',
    text: "乌兹别克斯坦农机进口增速+256.77%全球最快！中亚市场爆发，FR450/5300RC/890大方捆为适配机型，政府合作+铁路直连",
    textEn: "Uzbekistan farm machinery imports +256.77% fastest globally! Central Asia market booming, FR450/5300RC/890 large balers best fit",
    textRu: "Узбекистан импорт сельхозтехники +256.77% самый быстрый в мире! ЦА рынок растёт, FR450/5300RC/890 подходят",
    detailedContent: `## 乌兹别克斯坦农机进口增速+256.77%全球最快

### 市场数据
| 指标 | 数值 |
|------|------|
| 进口增速 | **+256.77%** |
| 增速排名 | **全球第一** |
| 主要需求 | 拖拉机、青储机、打捆机 |
| 适配机型 | FR450/5300RC/890大方捆/3404 |
| 运输通道 | 铁路（霍尔果斯/阿拉山口）+公路 |

### 优势
- 全球最快增速市场
- 中亚人口大国，农业需求基础好
- 政府主导农业现代化
- 中国设备接受度提升

### 7/3行动
- 建立乌兹别克斯坦经销商联系清单
- 优先推FR450/5300RC/890/3404
- 准备俄语+乌兹别克语资料`,
    detailedContentEn: `## Uzbekistan Farm Machinery Imports +256.77% Fastest Globally

### Market Data
| Indicator | Value |
|------|------|
| Import Growth | **+256.77%** |
| Growth Rank | **#1 globally** |
| Main Demand | Tractors, forage harvesters, balers |
| Best Fit Models | FR450/5300RC/890 large balers/3404 |
| Transport | Rail (Khorgos/Alashankou) + road |

### Advantages
- Fastest growing market globally
- Large Central Asian population, good ag base
- Government-led agricultural modernization
- Rising acceptance of Chinese equipment

### 7/3 Actions
- Build Uzbekistan dealer contact list
- Priority FR450/5300RC/890/3404
- Prepare Russian + Uzbek materials`,
    detailedContentRu: `## Узбекистан импорт +256.77% самый быстрый

### Данные
| Показатель | Значение |
|------|------|
| Рост импорта | **+256.77%** |
| Ранг | **#1 в мире** |
| Спрос | Тракторы, кормоуборочные, прессы |
| Модели | FR450/5300RC/890/3404 |
| Транспорт | ЖД (Хоргос/Алашань) + авто |

### Преимущества
- Самый быстрый рост
- Большое население ЦА
- Модернизация от государства

### Действия 7/3
- Список дилеров Узбекистана
- Приоритет FR450/5300RC/890/3404
- Рус+узбек материалы`,
    actionTips: '["建立乌兹别克斯坦经销商联系清单","优先推FR450/5300RC/890/3404","准备俄语+乌兹别克语资料"]',
    dataSummary: '[{"label":"进口增速","value":"+256.77%"},{"label":"全球排名","value":"第一"},{"label":"适配机型","value":"FR450/5300RC/890/3404"}]',
  },
  {
    icon: "🇧🇷", region: "巴西", regionEn: "Brazil", regionRu: "Бразилия",
    tags: '["巴西","CAGR 6.22%","5300RC"]',
    tagsEn: '["Brazil","CAGR 6.22%","5300RC"]',
    tagsRu: '["Бразилия","CAGR 6.22%","5300RC"]',
    text: "巴西农机市场$84.2亿(2026)→$113.8亿(2031)，CAGR 6.22%！5300RC全新95万+MF 3404为巴西线主推，葡萄牙语材料需完善",
    textEn: "Brazil farm machinery market $8.42B(2026)→$11.38B(2031), CAGR 6.22%! 5300RC new ¥950K + MF 3404 for Brazil line",
    textRu: "Бразилия рынок $84.2 млрд(2026)→$113.8 млрд(2031), CAGR 6.22%! 5300RC + MF 3404 для Бразилии",
    detailedContent: `## 巴西农机市场持续增长

### 市场数据
| 指标 | 数值 |
|------|------|
| 2026年市场规模 | $84.2亿 |
| 2031年市场规模 | $113.8亿 |
| CAGR | **6.22%** |
| 主要需求 | 大型拖拉机、打捆机、联合收割机 |
| 适配机型 | 5300RC(全新95万)、MF 3404 |

### 7月行动
- 完善葡萄牙语产品资料
- 5300RC全新95万作为巴西线王牌
- MF 3404（105万）推大豆/玉米种植户
- 关注巴西汇率波动和海运成本`,
    detailedContentEn: `## Brazil Farm Machinery Market Steady Growth

### Market Data
| Indicator | Value |
|------|------|
| 2026 Market Size | $8.42B |
| 2031 Market Size | $11.38B |
| CAGR | **6.22%** |
| Main Demand | Large tractors, balers, combines |
| Best Fit | 5300RC (new ¥950K), MF 3404 |

### July Actions
- Improve Portuguese product materials
- 5300RC new ¥950K as Brazil line trump card
- MF 3404 (¥1.05M) for soybean/corn growers
- Monitor BRL FX and shipping costs`,
    detailedContentRu: `## Бразилия рынок сельхозтехники растёт

### Данные
| Показатель | Значение |
|------|------|
| 2026 рынок | $84.2 млрд |
| 2031 рынок | $113.8 млрд |
| CAGR | **6.22%** |
| Спрос | Тракторы, прессы, комбайны |
| Модели | 5300RC, MF 3404 |

### Действия июль
- Португальские материалы
- 5300RC новый ¥950K
- MF 3404 для сои/кукурузы
- Курс BRL и морские перевозки`,
    actionTips: '["完善葡萄牙语产品资料","5300RC全新95万作为巴西线王牌","MF 3404推大豆/玉米种植户"]',
    dataSummary: '[{"label":"2026年市场规模","value":"$84.2亿"},{"label":"2031年市场规模","value":"$113.8亿"},{"label":"CAGR","value":"6.22%"}]',
  },
  {
    icon: "🇰🇿", region: "哈萨克斯坦", regionEn: "Kazakhstan", regionRu: "Казахстан",
    tags: '["哈萨克斯坦","+66.5%","中亚粮仓"]',
    tagsEn: '["Kazakhstan","+66.5%","Central Asia Grain"]',
    tagsRu: '["Казахстан","+66.5%","Зерно ЦА"]',
    text: "哈萨克斯坦农机进口增速+66.5%，中亚粮仓需求稳定！FR450/Jaguar 850/BigM 420为适配机型，铁路直达霍尔果斯",
    textEn: "Kazakhstan farm machinery imports +66.5%, Central Asia grain barn demand stable! FR450/Jaguar 850/BigM 420 best fit",
    textRu: "Казахстан импорт сельхозтехники +66.5%, стабильный спрос! FR450/Jaguar 850/BigM 420 подходят",
    detailedContent: `## 哈萨克斯坦农机进口+66.5%

### 市场数据
| 指标 | 数值 |
|------|------|
| 进口增速 | +66.5% |
| 地位 | 中亚粮仓 |
| 主要需求 | 大马力拖拉机、青储机、打捆机、割草机 |
| 适配机型 | FR450/Jaguar 850/BigM 420/MF 3404 |
| 运输通道 | 铁路霍尔果斯/阿拉山口 |

### 优势
- 中亚最大粮食生产国
- 农机进口需求稳定且大
- 铁路通道成熟，清关便捷
- 对中国设备接受度高

### 7/3行动
- 重点对接哈萨克大型粮食集团
- 推FR450/Jaguar 850/BigM 420组合
- 准备俄语+哈萨克语资料`,
    detailedContentEn: `## Kazakhstan Farm Machinery Imports +66.5%

### Market Data
| Indicator | Value |
|------|------|
| Import Growth | +66.5% |
| Position | Central Asia grain barn |
| Main Demand | Large tractors, forage harvesters, balers, mowers |
| Best Fit | FR450/Jaguar 850/BigM 420/MF 3404 |
| Transport | Rail via Khorgos/Alashankou |

### Advantages
- Largest grain producer in Central Asia
- Stable and large machinery demand
- Mature rail channel, convenient customs
- High acceptance of Chinese equipment

### 7/3 Actions
- Connect with large Kazakh grain groups
- Promote FR450/Jaguar 850/BigM 420 combo
- Prepare Russian + Kazakh materials`,
    detailedContentRu: `## Казахстан импорт сельхозтехники +66.5%

### Данные
| Показатель | Значение |
|------|------|
| Рост импорта | +66.5% |
| Статус | Зерно ЦА |
| Спрос | Тракторы, кормоуборочные, прессы, косилки |
| Модели | FR450/Jaguar 850/BigM 420/MF 3404 |
| Транспорт | ЖД Хоргос/Алашань |

### Преимущества
- Крупнейший зерновой ЦА
- Стабильный спрос
- Зрелая жд логистика

### Действия 7/3
- Крупные зерновые группы
- FR450/Jaguar 850/BigM 420
- Рус+казах материалы`,
    actionTips: '["重点对接哈萨克大型粮食集团","推FR450/Jaguar 850/BigM 420组合","准备俄语+哈萨克语资料"]',
    dataSummary: '[{"label":"进口增速","value":"+66.5%"},{"label":"地位","value":"中亚粮仓"},{"label":"适配机型","value":"FR450/Jaguar 850/BigM 420"}]',
  },
  {
    icon: "🇺🇸", region: "北美", regionEn: "North America", regionRu: "Северная Америка",
    tags: '["北美","USD基准","990/980/960"]',
    tagsEn: '["North America","USD Benchmark","990/980/960"]',
    tagsRu: '["Северная Америка","USD бенчмарк","990/980/960"]',
    text: "北美USD基准价纳入：Jaguar 990(2023)USD605K=411.4万、980(2018)USD295K=200.6万、960(2018)USD229.5K=156.1万，为北美线启动提供参考锚点",
    textEn: "North America USD benchmarks added: Jaguar 990(2023) USD605K=¥4.114M, 980(2018) USD295K=¥2.006M, 960(2018) USD229.5K=¥1.561M",
    textRu: "Северная Америка USD бенчмарки: 990(2023) USD605K=¥4.114M, 980(2018) USD295K=¥2.006M, 960(2018) USD229.5K=¥1.561M",
    detailedContent: `## 北美USD基准价纳入

### MachineryPete实时数据
| 型号 | 年份 | 价格(USD) | 价格(CNY@6.80) | 工时 | 所在地 |
|------|------|-----------|---------------|------|--------|
| Jaguar 990 | 2023 | $605,000 | ≈411.4万 | 695h | MI 美国密歇根 |
| Jaguar 990 | 2022 | $499,950 | ≈340.0万 | 888h | MI |
| Jaguar 980 | 2018 | $295,000 | ≈200.6万 | 2,070h | MI |
| Jaguar 970 | 2021 | $365,000 | ≈248.2万 | 1,967h | MI |
| Jaguar 960 | 2018 | $420,000 | ≈285.6万 | 1,507h | NY |
| Jaguar 960 | 2014 | $130,000 | ≈88.4万 | 3,200h | IA |

### 意义
- 为北美线启动提供价格锚点
- USD/CNY 6.80稳定，报价确定性高
- 可作为与俄罗斯/欧洲买家谈判的对比基准

### 7月行动
- 建立北美经销商初步联系
- 990/980/960作为北美主推型号
- 关注美国农机进口关税和EPA要求`,
    detailedContentEn: `## North America USD Benchmarks Added

### MachineryPete Real-Time Data
| Model | Year | Price(USD) | Price(CNY@6.80) | Hours | Location |
|------|------|-----------|---------------|------|--------|
| Jaguar 990 | 2023 | $605,000 | ≈4.114M | 695h | MI |
| Jaguar 990 | 2022 | $499,950 | ≈3.400M | 888h | MI |
| Jaguar 980 | 2018 | $295,000 | ≈2.006M | 2,070h | MI |
| Jaguar 970 | 2021 | $365,000 | ≈2.482M | 1,967h | MI |
| Jaguar 960 | 2018 | $420,000 | ≈2.856M | 1,507h | NY |
| Jaguar 960 | 2014 | $130,000 | ≈0.884M | 3,200h | IA |

### Significance
- Provides price anchors for North America line
- USD/CNY 6.80 stable, high quote certainty
- Can be used as negotiation benchmark vs Russia/Europe

### July Actions
- Build initial North America dealer contacts
- 990/980/960 as main North America models
- Watch US import tariffs and EPA requirements`,
    detailedContentRu: `## Северная Америка USD бенчмарки

### Данные MachineryPete
| Модель | Год | Цена(USD) | Цена(CNY@6.80) | Часы | Место |
|------|------|-----------|---------------|------|--------|
| Jaguar 990 | 2023 | $605,000 | ≈4.114M | 695 | MI |
| Jaguar 990 | 2022 | $499,950 | ≈3.400M | 888 | MI |
| Jaguar 980 | 2018 | $295,000 | ≈2.006M | 2,070 | MI |
| Jaguar 970 | 2021 | $365,000 | ≈2.482M | 1,967 | MI |
| Jaguar 960 | 2018 | $420,000 | ≈2.856M | 1,507 | NY |
| Jaguar 960 | 2014 | $130,000 | ≈0.884M | 3,200 | IA |

### Значение
- Бенчмарки для Северной Америки
- USD/CNY 6.80 стабилен
- База для переговоров

### Действия июль
- Первичные контакты дилеров
- 990/980/960 главные модели
- Пошлины и EPA США`,
    actionTips: '["建立北美经销商初步联系","990/980/960作为北美主推型号","关注美国农机进口关税和EPA要求"]',
    dataSummary: '[{"label":"990(2023) USD","value":"$605K=411.4万"},{"label":"980(2018) USD","value":"$295K=200.6万"},{"label":"960(2018) USD","value":"$229.5K=156.1万"}]',
  },
  {
    icon: "⚠️", region: "全球", regionEn: "Global", regionRu: "Глобально",
    tags: '["风险提示","ECB","CBR","EU制裁"]',
    tagsEn: '["Risk Alert","ECB","CBR","EU Sanctions"]',
    tagsRu: '["Риски","ЕЦБ","ЦБ РФ","Санкции ЕС"]',
    text: "7月风险预警：7/22-23 ECB议息会议、7/25 CBR利率决议、EU第21轮对俄制裁草案。若ECB鹰派EUR/CNY或继续上行，若CBR加息RUB可能回落",
    textEn: "July risk alert: 7/22-23 ECB meeting, 7/25 CBR decision, EU 21st Russia sanctions draft. Hawkish ECB could push EUR/CNY higher; CBR hike could weaken RUB",
    textRu: "Июль риски: 22-23 июля ЕЦБ, 25 июля ЦБ РФ, санкции ЕС 21 раунд. ЕЦБ жёсткий → EUR/CNY выше; ЦБ РФ повышает → RUB слабее",
    detailedContent: `## 7月风险预警

### 关键事件
| 事件 | 日期 | 影响 |
|------|------|------|
| ECB议息会议 | 7/22-23 | 若鹰派→EUR/CNY继续上行→套利扩大；若鸽派→EUR回落 |
| CBR利率决议 | 7/25 | 若加息→RUB可能升值→俄线利润缩窄；若降息→RUB贬值→利润扩大 |
| EU第21轮对俄制裁 | 7月 | 若落地→配件替代窗口扩大；若缓和→影响有限 |
| AGRO 2026基辅展 | 7/9-11 | 展前备货期竞争激烈，可能压价 |

### 7/3应对建议
- 利用当前EUR/CNY 7.91高位窗口锁定客户报价
- 7/22前尽量完成俄线订单签约
- 准备汇率对冲方案（人民币结算+CIPS）
- 关注EU制裁草案对俄配件供应的影响`,
    detailedContentEn: `## July Risk Alert

### Key Events
| Event | Date | Impact |
|------|------|------|
| ECB Meeting | 7/22-23 | Hawkish → EUR/CNY higher → arbitrage widens; dovish → EUR falls |
| CBR Rate Decision | 7/25 | Hike → RUB stronger → Russia margin narrows; cut → RUB weaker → margin widens |
| EU 21st Russia Sanctions | July | If implemented → parts substitution window expands |
| AGRO 2026 Kyiv | 7/9-11 | Pre-expo competition may pressure prices |

### 7/3 Responses
- Lock customer quotes at current EUR/CNY 7.91
- Complete Russia orders before 7/22
- Prepare FX hedge (RMB settlement + CIPS)
- Watch EU sanctions draft impact on Russian parts supply`,
    detailedContentRu: `## Июль предупреждение о рисках

### Ключевые события
| Событие | Дата | Влияние |
|------|------|------|
| ЕЦБ | 22-23 июля | Жёсткий → EUR/CNY выше; мягкий → евро падает |
| ЦБ РФ | 25 июля | Повышение → RUB сильнее; снижение → RUB слабее |
| Санкции ЕС 21 | Июль | Расширение окна замены |
| AGRO 2026 Киев | 9-11 июля | Конкуренция перед выставкой |

### Действия 7/3
- Фиксировать цены при EUR/CNY 7.91
- Заказы РФ до 22 июля
- Хедж в юанях
- Санкции и запчасти`,
    actionTips: '["利用EUR/CNY 7.91高位窗口锁定报价","7/22前尽量完成俄线订单签约","准备人民币结算+CIPS汇率对冲方案","关注EU第21轮制裁草案"]',
    dataSummary: '[{"label":"ECB会议","value":"7/22-23"},{"label":"CBR决议","value":"7/25"},{"label":"EU制裁草案","value":"7月待定"}]',
  },
];

async function main() {
  // 清空今日旧情报（按日期）
  const start = new Date(TODAY);
  start.setHours(0, 0, 0, 0);
  const end = new Date(TODAY);
  end.setHours(23, 59, 59, 999);

  const deleted = await prisma.marketIntel.deleteMany({
    where: {
      createdAt: {
        gte: start,
        lte: end,
      },
    },
  });
  console.log(`[清理] 删除今日旧情报 ${deleted.count} 条`);

  for (let i = 0; i < ALL_MARKET_INTEL.length; i++) {
    const item = ALL_MARKET_INTEL[i];
    await prisma.marketIntel.create({
      data: {
        ...item,
        date: TODAY,
        sortOrder: i,
        isActive: true,
      },
    });
    console.log(`  ✅ ${i + 1}/${ALL_MARKET_INTEL.length} ${item.region} - ${item.text.slice(0, 30)}...`);
  }

  console.log(`\n✅ 成功导入 ${ALL_MARKET_INTEL.length} 条市场情报`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
