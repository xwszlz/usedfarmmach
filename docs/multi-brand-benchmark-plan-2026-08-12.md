# 多品牌国际基准价体系扩展方案（研究稿 · 2026-08-12）

> 目标：把当前"只覆盖 CLAAS Jaguar 一个品牌"的国际价格跟踪，扩展到 **~20 个主流农机品牌 × 多数据源**，提升套利分析准确性，并把检索网站从 Agroline/MachineryPete 扩到全球主流二手机平台 + 区域平台（俄/巴/东南亚/非洲）。

---

## 一、根因：为什么现在只有克拉斯

| 维度 | 现状 | 问题 |
|---|---|---|
| 数据表 | `InternationalPrice` 有 `productId` 外键，**每条国际价都绑定我们的一台库存产品** | 只能对标已进货的机器，无法独立建立"品牌×机型"的全球基准价 |
| 抓取脚本 | `fetch-live-market-data.js` 用正则 `(\d{3,4})` 只抽 Jaguar 型号；Agroline/MachineryPete 计数是 CLAAS 专用伪随机 | 写死 CLAAS，其他品牌即使有库存价也不进报告 |
| 数据源 | 仅 Agroline、MachineryPete（且为伪随机计数，非真实抓取） | 无真实多站抓取，准确性靠"编"而非"采" |
| 库存品牌 | 实际有 20+ 品牌（claas 14 / new-holland 16 / john-deere 7 / krone 10 / massey-ferguson 3 / case-ih 2 / kuhn 3 / grimme 1 + 东方红/谷神/法拉信等） | 绝大多数品牌的海外对标价完全空缺 |

**结论**：要扩大范围、增强准确性，必须新建一张**与库存解耦的"品牌基准价表"**，并重构采集与报告链路。

---

## 二、品牌宇宙（建议 ~22 个主流品牌，按品类分组）

优先对齐**我们已有库存** + **目标市场（俄/哈/东南亚/非洲/巴西）高需求**的品类。

### 拖拉机 Tractors（11）
| # | 品牌 | 英文名 | 备注 |
|---|---|---|---|
| 1 | 约翰迪尔 | John Deere | 库存 7，全球最大二手机存量 |
| 2 | 纽荷兰 | New Holland | 库存 16，俄线主力 |
| 3 | 凯斯 | Case IH | 库存 2 |
| 4 | 马斯奇奥/麦赛福格森 | Massey Ferguson | 库存 3，非洲/南美强 |
| 5 | 芬特 | Fendt | 德系高端，溢价高 |
| 6 | 维特拉 | Valtra | 北欧/俄线强 |
| 7 | 道依茨法尔 | Deutz-Fahr | 欧系中端 |
| 8 | 久保田 | Kubota | 东南亚/小农机强 |
| 9 | 东方红 | YTO | 国产库存，内销+中亚 |
| 10 | 雷沃 | Lovol | 国产，东南亚/非洲出海 |
| 11 | 麦考密克 | McCormick | 意系，欧非 |

### 收获 / 青贮 Harvesting & Forage（7）
| # | 品牌 | 英文名 | 备注 |
|---|---|---|---|
| 12 | 克拉斯 | CLAAS | 库存 14，当前唯一对标线 |
| 13 | 科罗尼 | Krone | 库存 10，青贮强 |
| 14 | 纽荷兰 | New Holland | 同上（跨品类） |
| 15 | 约翰迪尔 | John Deere | 跨品类 |
| 16 | 凯斯 | Case IH | 跨品类 |
| 17 | 维米尔 | Vermeer | 圆捆/搂草，美系 |
| 18 | 麦克海尔 | McHale | 欧系打捆高端 |

### 耕整 / 播种 Soil & Seed（5）
| # | 品牌 | 英文名 | 备注 |
|---|---|---|---|
| 19 | 库恩 | Kuhn | 库存 3，耕播全系 |
| 20 | 雷肯 | Lemken | 德系犁/整地高端 |
| 21 | 阿玛松 | Amazone | 德系播种/植保 |
| 22 | 雷锡萨/佩特 | Horsch / Väderstad | 可选，欧系精密播种 |

### 块茎 / 甜菜 + 伸缩臂（可选扩展）
| # | 品牌 | 英文名 | 备注 |
|---|---|---|---|
| — | 格里美 | Grimme | 库存 1，块茎机 |
| — | JCB / 曼尼通 | JCB / Manitou | 伸缩臂，欧非基建农用 |

> **首期落地建议**：先覆盖 **前 18 个**（拖拉机 11 + 收获青贮 7 中与上面不重复的），即约翰迪尔、纽荷兰、凯斯、麦赛福格森、芬特、维特拉、道依茨法尔、久保田、东方红、雷沃、麦考密克、克拉斯、科罗尼、维米尔、麦克海尔、库恩、雷肯、阿玛松。每个品牌挑 1–2 个旗舰机型（如 JD 8R/6R、NH T7/T8、CLAAS Jaguar/ Xerion、Krone BigX 等）起步，再逐步铺开。

---

## 三、数据源扩展（分梯队，避免一次性铺太大）

### Tier 1（首期，3–5 个高质量站）
| 站点 | 区域 | 强势品类 | 数据可用性 |
|---|---|---|---|
| **Agroline** | 欧洲 | CLAAS / Krone / John Deere 青贮收获 | 列表页结构化较好 |
| **MachineryPete** | 美国 | JD / NH / Case 拖拉机、联合收割 | 有价格历史 |
| **Mascus** | 全球 | 全品类二手机 | 全球最大之一，结构化 |
| **e-farm** | 全球 | 带估值（valuation）的二手机 | 直接给估值，准确性高 |
| **TractorHouse** | 美国 | 拖拉机/联合收割 | 体量大 |

### Tier 2（二期，拍卖 + 结果价，更准确）
| 站点 | 区域 | 价值 |
|---|---|---|
| **IronPlanet / Ritchie Bros** | 美/全球 | 拍卖成交价（真实成交，非挂牌） |
| **EquipmentFacts** | 美国 | 拍卖结果数据库，可拉历史 |
| **Fastline** | 美国 | 挂牌+成交 |
| **MarketBook** | 全球 | 二手设备挂牌 |
| **EuroAuctions** | 全球 | 工业/农机拍卖 |

### Tier 3（三期，区域平台 —— 直击目标市场）
| 站点 | 区域 | 价值 |
|---|---|---|
| **Avito / OLX / specagro** | 俄罗斯/独联体 | **我们的核心目标市场**，俄线定价直接参考 |
| **Encontro / OLX** | 巴西 | 南美市场 |
| **铁甲二手机 / 农机通 / 中国农机流通协会** | 中国 | 国产机内销+出海基准 |
| **TractorsForAfrica / AgriMag** | 非洲 | 非洲出海参考 |

> **关键认知**：我们做的是"中国/低价市场采购 → 俄/哈/东南亚/非洲高价卖出"的套利。所以**俄罗斯本土二手机价格（Avito/OLX）比欧美挂牌价更贴近真实套利空间**，Tier 3 的俄系站点应优先于欧美观望站。

---

## 四、准确性增强方法论

当前 `InternationalPrice` 已有 `confidenceScore`、`sourceDate`、`lastVerified` 字段但没用起来。新体系要落地这套机制：

1. **多源交叉验证 + 置信度评分（0–1）**
   - 1 源 → 0.3；2 源 → 0.6；≥3 源 → 0.85+
   - 样本量 < 3 或日期 > 30 天 → 自动降权
2. **异常值过滤**：取中位数而非均值，剔除 >1.5×IQR 的离群挂牌（避免天价/僵尸挂牌污染套利率）
3. **币种归一化（每日 FX）**：EUR/CNY≈7.90、USD/CNY≈7.25、RUB/CNY≈0.09，全部折算为 CNY 再算价差
4. **时效性**：`sourceDate` 必填；`lastVerified` 超 30 天标黄、超 60 天标红待刷新
5. **人工复核闸门**：套利率 Top 10 的标的，进入报告前需人工/agent 复核（避免伪价差误导采购）
6. **挂牌价 vs 成交价区分**：拍卖成交价（Tier 2）权重高于挂牌价（Tier 1）

---

## 五、数据架构改造（核心）

### 新增模型 `BrandBenchmark`（与库存解耦）
```prisma
model BrandBenchmark {
  id              String   @id @default(cuid())
  brand           String   // 品牌 slug，对齐 Brand 主数据
  brandNameZh     String?
  model           String   // 机型，如 "Jaguar 970" / "8R 410"
  category        String   // 品类：tractor / harvester / forage / soil ...
  sourceSite      String   // agroline / machinerypete / mascus / avito ...
  priceForeign    Float    // 原始外币价
  currency        String   @default("EUR")
  priceCny        Float    // 折算人民币
  exchangeRate    Float?
  sourceUrl       String?
  sourceDate      String?  // 采集日
  confidenceScore Float    @default(0.5)
  lastVerified    DateTime?
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  @@index([brand, model])
  @@index([category])
}
```

### 采集链路分工
| 表 | 用途 | 数据来源 |
|---|---|---|
| `InternationalPrice`（保留） | **我们库存机器**的海外对标（已进货的转售套利） | 人工/agent 按产品维护 |
| `BrandBenchmark`（新增） | **全品牌全球基准价指数**（含我们没进货但想对标的品牌） | 多站采集 + agent 研究刷新 |

### 重构抓取脚本
- 新建 `scripts/fetch-benchmark.js` 替代 `fetch-live-market-data.js` 中写死的 CLAAS 逻辑：读 `BrandBenchmark`，按品牌/品类汇总，输出 `market_data.json`（多品牌）。
- `fetch-live-market-data.js` 保留给库存转售分析（InternationalPrice 线），两者并行。

### 刷新机制（解决"沙箱不能直爬"）
每日自动化是 **agent 自身**执行的，所以刷新可以走 **agent 驱动的 WebSearch/WebFetch 研究**，而非 Node 爬虫：
- 新增一个**低频研究任务**（不必每日，建议每周 1–2 次）：agent 对各品牌旗舰机型在 Tier 1–2 站点做定向检索，写入 `BrandBenchmark` 并打置信度。
- 每日报告只读 `BrandBenchmark` 快照，不实时爬。
- 长期可补 2–3 个站点的轻量定向爬虫（Agroline/Mascus 列表页结构化较好），但需评估 ToS/反爬/代理。

---

## 六、分阶段实施路线

| 阶段 | 内容 | 工期 | 产出 |
|---|---|---|---|
| **P0 建模** | Prisma 加 `BrandBenchmark`；Brand 主数据补齐缺失国际品牌；定义"品牌×机型×站点"矩阵 | 1–2 天 | 迁移脚本 + 主数据 |
| **P1 种子数据** | 用 agent 研究 + 人工核对，填充首期 18 品牌旗舰机型的 Tier 1 站点基准价 | 2–3 天 | `BrandBenchmark` 首批 ~100–200 行 |
| **P2 刷新器** | 建 agent 驱动的研究刷新任务（每周）；加置信度/异常值/时效逻辑 | 3–5 天 | 可持续刷新链路 |
| **P3 链路重构** | `fetch-benchmark.js` 替代写死 CLAAS；竞争力报告/日报/文章改读多品牌 | 2 天 | 多品牌日报+报告 |
| **P4 扩源** | 接入 Tier 2 拍卖价 + Tier 3 俄/巴/非洲区域站（尤其 Avito/OLX 俄线） | 持续 | 全区域覆盖 |

---

## 七、风险与红线

1. **爬虫合规**：Agroline/Mascus 等站点的 ToS 可能禁止自动化抓取；建议优先用**挂牌价人工/agent 研究采样**而非高频爬虫，避免法律风险与 IP 封禁。
2. **沙箱限制**：当前自动化沙箱无稳定外网出口去直爬，刷新必须走 agent（WebSearch/WebFetch）或人工，不能依赖 Node 爬虫。
3. **数据质量 > 数据量**：20 个品牌若都靠"编"，不如 5 个品牌靠"真采"。前期重质，后期再铺量。
4. **FX 波动**：汇率每日变，所有外币价必须带采集日汇率并定时重算 CNY。
5. **俄线优先级**：套利核心在俄/独联体，俄本土站（Avito/OLX）比欧美挂牌更准，应提至 Tier 1 之后优先补。

---

## 八、决策锁定（2026-08-12 用户拍板 ✅）

| # | 问题 | 决策 | 对架构的影响 |
|---|---|---|---|
| 1 | 首期品牌范围 | **18 个全上**（拖拉机 11 + 收获青贮 4 + 耕整 3） | 不做 8–10 取舍，一次铺满矩阵 |
| 2 | 数据源策略 | **投入轻量爬虫** | 建 `fetch-benchmark.js` 多源适配器（非纯 agent 研究）；沙箱内网络受限时降级保底，ECS 上真跑 |
| 3 | 俄线优先级 | **Avito/OLX 提至首期（原 Tier3→Tier1）** | 俄本土站与 Agroline/Mascus 同级优先采集，套利空间更直接 |
| 4 | 刷新频率 | **每天 1 次** | 新增每日自动化（先 PAUSED，ECS 跑通后启用）调用刷新 |

### 调整后的首期数据源（Tier1，7 站，含俄线）
`Agroline(EU)` · `MachineryPete(US)` · `Mascus(全球)` · `TractorHouse(US)` · `e-farm(全球估值)` · **`Avito(RU)`** · **`OLX(RU/UA)`**
> 原 Tier2（Ritchie Bros/IronPlanet 拍卖成交价）与 Tier3（巴/非洲/中国）作为二期扩源，但**俄线已前置**。

### 执行状态（本轮回填）
- [x] P0 建模：`BrandBenchmark` 模型已加，迁移已 deploy 到 Neon
- [x] P1 矩阵：`scripts/benchmark-config.js` 定义 18 品牌 × 旗舰机型
- [x] P1 种子：WebSearch 研究真实锚定价入库（置信度按源数标注）
- [x] P2/P3：`scripts/fetch-benchmark.js` 轻量爬虫框架（适配器+中位价+IQR离群+跨源置信度+FX+降级）
- [x] 每日刷新自动化：已建（PAUSED），待 ECS 验证后启用
- [x] Git：分支 `feat/multi-brand-benchmark` → PR → squash 合并 → Vercel 部署
