/**
 * 将纽荷兰5070小方捆插入市场情报数据库（头条位置）
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const TODAY = new Date("2026-06-15");
  
  // 1. 把现有所有条目的 sortOrder +1（给5070腾出第0位）
  const existing = await prisma.marketIntel.findMany({
    where: { date: TODAY },
    orderBy: { sortOrder: "asc" },
  });
  
  for (const item of existing) {
    await prisma.marketIntel.update({
      where: { id: item.id },
      data: { sortOrder: item.sortOrder + 1 },
    });
  }
  console.log(`已将 ${existing.length} 条现有情报后移一位`);

  // 2. 插入5070头条
  await prisma.marketIntel.create({
    data: {
      date: TODAY,
      icon: "🔥",
      region: "中国",
      regionEn: "China",
      regionRu: "Китай",
      tags: JSON.stringify(["爆款", "5070小方捆", "12台库存"]),
      tagsEn: JSON.stringify(["Hot Deal", "5070 Baler", "12 Units"]),
      tagsRu: JSON.stringify(["Хит", "5070 Пресс", "12 ед."]),
      text: "纽荷兰5070小方捆·12台库存爆款！¥3.4万/台，海外$7,000+，利润58.8%，小方捆打捆机全球需求旺盛",
      textEn: "New Holland 5070 Small Square Baler·12 units! ¥34K/unit, overseas $7K+, 58.8% margin, global demand strong",
      textRu: "New Holland 5070 Малый тюковый пресс·12 ед! ¥34K/ед, зарубеж $7K+, 58.8% маржа, глобальный спрос высок",
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

### 市场背景
- 小方捆打捆机是全球牧草/秸秆收获的主力机型
- 纽荷兰品牌国际知名度高，二手残值稳定
- 非洲、东南亚、中亚市场需求旺盛
- 中国二手5070价格仅为欧美的40-60%

### 推广策略
| 区域 | 策略 | 预计响应 |
|------|------|---------|
| 非洲（肯尼亚/尼日利亚） | 小型农场主套餐推广 | 快速出货 |
| 东南亚（越南/菲律宾） | 水稻秸秆打捆需求 | 中速 |
| 中亚（哈萨克斯坦） | 牧草打捆主力机型 | 高利润 |

### 为什么是爆款
1. ✅ **价格低** — 3.4万是小方捆市场的"白菜价"
2. ✅ **库存多** — 12台可批量出货，降低单台物流成本
3. ✅ **品牌好** — 纽荷兰国际认知度极高，买家信任
4. ✅ **需求旺** — 全球牧草收获机械化率持续提升
5. ✅ **利润稳** — 58.8%利润率在小型农机中极具竞争力`,
      detailedContentEn: `## 🔥 New Holland 5070 Small Square Baler — Today's Headline Hot Deal

**Core Target:** New Holland 5070 small square baler, Shendiao inventory 12 units, domestic only ¥34,000/unit

### Spread Analysis
| Indicator | Value |
|------|------|
| Domestic price | ¥34,000/unit |
| Overseas reference | $7,000-8,500 (¥50-61K) |
| Profit per unit | **¥16-27K** |
| Margin rate | **58.8%** |
| Inventory | **12 units** |
| Total profit potential | **¥190-320K** |

### Market Background
- Small square balers are the workhorse for global hay/straw harvesting
- New Holland brand has extremely high international recognition
- Strong demand in Africa, Southeast Asia, Central Asia
- Chinese used 5070 prices are only 40-60% of Western markets`,
      detailedContentRu: `## 🔥 New Holland 5070 Малый тюковый пресс — Горячее предложение

**Основная цель:** New Holland 5070 малый тюковый пресс, инвентарь Shendiao 12 ед., внутренняя цена всего ¥34,000/ед.

### Анализ разницы
| Показатель | Значение |
|------|------|
| Внутренняя цена | ¥34,000/ед |
| Зарубежный ориентир | $7,000-8,500 (¥50-61K) |
| Прибыль на единицу | **¥16-27K** |
| Маржа | **58.8%** |
| Инвентарь | **12 ед.** |
| Общий потенциал прибыли | **¥190-320K** |`,
      actionTips: JSON.stringify([
        "优先打包12台5070批量出口（降低单台物流成本）",
        "制作英文/俄文/法文5070产品单页",
        "在Facebook农机群组重点推广",
        "对接非洲/东南亚经销商批量拿货",
        "可提供FOB天津/青岛报价"
      ]),
      dataSummary: JSON.stringify([
        { label: "国内售价", value: "¥3.4万/台" },
        { label: "海外参考", value: "$7,000+" },
        { label: "利润率", value: "58.8%" },
        { label: "库存", value: "12台" },
        { label: "总利润空间", value: "¥19-32万" }
      ]),
      sortOrder: 0,
      isActive: true,
    },
  });
  
  console.log("✅ 5070头条已插入数据库！sortOrder=0");
  
  // 3. 验证
  const top3 = await prisma.marketIntel.findMany({
    where: { date: TODAY, isActive: true },
    orderBy: { sortOrder: "asc" },
    take: 3,
    select: { icon: true, text: true, sortOrder: true },
  });
  console.log("\nTop 3 entries now:");
  top3.forEach((r) => console.log(`  [${r.sortOrder}] ${r.icon} ${r.text.substring(0, 60)}`));

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
