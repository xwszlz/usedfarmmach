/**
 * 导入2026-06-20市场情报数据到数据库
 * 基于 2026-06-20_跨境套利日报.md 生成（周六·周末版）
 * 
 * 🔥 永久头条规则：5070小方捆必须在sortOrder=0
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const TODAY = new Date("2026-06-20");

const ALL_MARKET_INTEL = [
  // ===== sortOrder=0: 永久头条 =====
  {
    icon: "\ud83d\udd25", region: "\u4e2d\u56fd", tags: '["\u7206\u6b3e","5070\u5c0f\u65b9\u6346","12\u53f0\u5e93\u5b58"]',
    regionEn: "China", regionRu: "\u041a\u0438\u0442\u0430\u0439",
    tagsEn: '["Hot Deal","5070 Baler","12 Units"]', tagsRu: '["\u0425\u0438\u0442","5070 \u041f\u0440\u0435\u0441\u0441","12 \u0435\u0434."]',
    text: "\u7ebd\u8377\u51705070\u5c0f\u65b9\u6346\u00b712\u53f0\u5e93\u5b58\u7206\u6b3e\uff01\u00a53.4\u4e07/\u53f0\uff0c\u6d77\u5916$7,000+\uff0c\u5229\u6da658.8%\uff0c\u5c0f\u65b9\u6346\u6253\u6346\u673a\u5168\u7403\u9700\u6c42\u65fa\u76db",
    textEn: "New Holland 5070 Small Square Baler\u00b712 units! \u00a534K/unit, overseas $7K+, 58.8% margin, global demand strong",
    textRu: "New Holland 5070 \u041c\u0430\u043b\u044b\u0439 \u0442\u044e\u043a\u043e\u0432\u044b\u0439 \u043f\u0440\u0435\u0441\u0441\u00b712 \u0435\u0434! \u00a534K/\u0435\u0434, \u0437\u0430\u0440\u0443\u0431\u0435\u0436 $7K+, 58.8% \u043c\u0430\u0440\u0436\u0430, \u0433\u043b\u043e\u0431\u0430\u043b\u044c\u043d\u044b\u0439 \u0441\u043f\u0440\u043e\u0441 \u0432\u044b\u0441\u043e\u043a",
    // detailedContent uses double quotes inside, so I'll use a template string
    detailedContent: `
## \u7ebd\u8377\u51705070\u5c0f\u65b9\u6346\u00b712\u53f0\u5e93\u5b58\u7206\u6b3e

### \u4ef7\u5dee\u5206\u6790
| \u6307\u6807 | \u6570\u503c |
|---------|--------|
| \u56fd\u5185\u552e\u4ef7 | \u00a534,000/\u53f0 |
| \u6d77\u5916\u53c2\u8003\u4ef7 | $7,000+ |
| \u5355\u53f0\u5229\u6da6 | $3,300-4,100 |
| \u5229\u6da6\u7387 | \u224858.8% |
| \u5e93\u5b58 | **12\u53f0** |
| \u603b\u5229\u6da6\u7a7a\u95f4 | \u00a519-32\u4e07 |

### \u63a8\u5e7f\u7b56\u7565
| \u76ee\u6807\u5e02\u573a | \u7b56\u7565 | \u4f18\u5148\u7ea7 |
|----------------|-----------|------------|
| \u975e\u6d32\uff08\u5c3c\u65e5\u5229\u4e9a/\u80af\u5c3c\u4e9a\uff09 | \u6279\u91cf\u51fa\u53e330-50\u53f0/\u6708 | \u2605\u2605\u2605\u2605\u2605 |
| \u4e1c\u5357\u4e9a\uff08\u5370\u5c3c/\u6cf0\u56fd\uff09 | \u5c0f\u65b9\u6346\u9002\u5408\u7a3b\u8349\u6253\u6346 | \u2605\u2605\u2605\u2605 |
| \u4e2d\u4e9a\uff08\u4e4c\u5179\u522b\u514b/\u54c8\u8428\u514b\uff09 | \u7ebd\u8377\u5170\u54c1\u724c\u8ba4\u53ef\u5ea6\u9ad8 | \u2605\u2605\u2605\u2605 |

### \u4e94\u5927\u7206\u6b3e\u7406\u7531
1. **12\u53f0\u6279\u91cf**\uff1a\u7ebd\u8377\u51705070\u5168\u56fd\u552f\u4e00\u5927\u6279\u91cf\u73b0\u8d27
2. **\u5229\u6da6\u7387\u9ad8**\uff1a58.8%\uff0c\u5355\u53f0\u51c0\u5229$3,300-4,100
3. **\u5168\u7403\u9700\u6c42\u65fa\u76db**\uff1a\u5723\u8bde\u8282\u7a3b\u8349/\u9999\u6e2f\u72ec\u89d2\u517d\u98df\u6599\u8d28\u91cf\u8981\u6c42\u9ad8\u00a0\u62d2\u6536\u7387\u6781\u4f4e
4. **\u4f4e\u95e8\u69db**\uff1a\u00a53.4\u4e07\u8d2d\u4e70\u51b3\u7b56\u5feb
5. **\u8fd0\u8425\u6210\u672c\u4f4e**\uff1a\u00a5\u2160\u21972,800\u5c0f\u65f6\u5927\u4fee\u4fdd\u517b\u6210\u672c\u4f4e
    `,
    detailedContentEn: `
## New Holland 5070 Small Square Baler \u00b7 12 Units Hot Deal

### Spread Analysis
| Indicator | Value |
|---------|--------|
| Domestic Price | \u00a534,000/unit |
| Overseas Reference | $7,000+ |
| Profit per Unit | $3,300-4,100 |
| Profit Margin | \u224858.8% |
| Inventory | **12 units** |
| Total Profit Potential | \u00a5190K-320K |

### Promotion Strategy
| Target Market | Strategy | Priority |
|----------------|-----------|------------|
| Africa (Nigeria/Kenya) | Bulk export 30-50 units/month | \u2605\u2605\u2605\u2605\u2605 |
| SE Asia (Indonesia/Thailand) | Small baler ideal for rice straw | \u2605\u2605\u2605\u2605 |
| Central Asia (Uzbekistan/Kazakhstan) | NH brand recognition | \u2605\u2605\u2605\u2605 |

### 5 Reasons It's a Hot Deal
1. **Bulk inventory**: Only large stock of NH 5070 nationally
2. **High margin**: 58.8%, net $3,300-4,100/unit
3. **Global demand**: Christmas straw/high-quality fodder demand
4. **Low barrier**: \u00a534K fast purchase decisions
5. **Low operating cost**: Low maintenance cost per hour
    `,
    detailedContentRu: `
## New Holland 5070 \u041c\u0430\u043b\u044b\u0439 \u0442\u044e\u043a\u043e\u0432\u044b\u0439 \u043f\u0440\u0435\u0441\u0441 \u00b7 12 \u0435\u0434\u0438\u043d\u0438\u0446

### \u0410\u043d\u0430\u043b\u0438\u0437 \u0441\u043f\u0440\u0435\u0434\u0430
| \u041f\u043e\u043a\u0430\u0437\u0430\u0442\u0435\u043b\u044c | \u0417\u043d\u0430\u0447\u0435\u043d\u0438\u0435 |
|---------|--------|
| \u0412\u043d\u0443\u0442\u0440\u0435\u043d\u043d\u044f\u044f \u0446\u0435\u043d\u0430 | \u00a534\u00a0000/\u0435\u0434. |
| \u0417\u0430\u0440\u0443\u0431\u0435\u0436\u043d\u044b\u0439 \u0440\u0435\u0444\u0435\u0440\u0435\u043d\u0441 | $7,000+ |
| \u041f\u0440\u0438\u0431\u044b\u043b\u044c \u043d\u0430 \u0435\u0434\u0438\u043d\u0438\u0446\u0443 | $3,300-4,100 |
| \u041c\u0430\u0440\u0436\u0430 | \u224858.8% |
| \u0417\u0430\u043f\u0430\u0441 | **12 \u0435\u0434.** |
| \u041e\u0431\u0449\u0438\u0439 \u043f\u043e\u0442\u0435\u043d\u0446\u0438\u0430\u043b \u043f\u0440\u0438\u0431\u044b\u043b\u0438 | \u00a5190K-320K |

### \u0421\u0442\u0440\u0430\u0442\u0435\u0433\u0438\u044f \u043f\u0440\u043e\u0434\u0432\u0438\u0436\u0435\u043d\u0438\u044f
| \u0426\u0435\u043b\u0435\u0432\u043e\u0439 \u0440\u044b\u043d\u043e\u043a | \u0421\u0442\u0440\u0430\u0442\u0435\u0433\u0438\u044f | \u041f\u0440\u0438\u043e\u0440\u0438\u0442\u0435\u0442 |
|----------------|-----------|------------|
| \u0410\u0444\u0440\u0438\u043a\u0430 (\u041d\u0438\u0433\u0435\u0440\u0438\u044f/\u041a\u0435\u043d\u0438\u044f) | \u041e\u043f\u0442\u043e\u0432\u044b\u0439 \u044d\u043a\u0441\u043f\u043e\u0440\u0442 30-50 \u0435\u0434./\u043c\u0435\u0441. | \u2605\u2605\u2605\u2605\u2605 |
| \u042e\u0412\u0410 (\u0418\u043d\u0434\u043e\u043d\u0435\u0437\u0438\u044f/\u0422\u0430\u0438\u043b\u0430\u043d\u0434) | \u041f\u043e\u0434\u0445\u043e\u0434\u0438\u0442 \u0434\u043b\u044f \u0440\u0438\u0441\u043e\u0432\u043e\u0439 \u0441\u043e\u043b\u043e\u043c\u044b | \u2605\u2605\u2605\u2605 |
| \u0426\u0435\u043d\u0442\u0440\u0430\u043b\u044c\u043d\u0430\u044f \u0410\u0437\u0438\u044f | \u0412\u044b\u0441\u043e\u043a\u0430\u044f \u0443\u0437\u043d\u0430\u0432\u0430\u0435\u043c\u043e\u0441\u0442\u044c \u0431\u0440\u0435\u043d\u0434\u0430 NH | \u2605\u2605\u2605\u2605 |

### 5 \u043f\u0440\u0438\u0447\u0438\u043d \u0445\u0438\u0442\u0430
1. **12 \u0435\u0434\u0438\u043d\u0438\u0446**: \u0415\u0434\u0438\u043d\u0441\u0442\u0432\u0435\u043d\u043d\u044b\u0439 \u043a\u0440\u0443\u043f\u043d\u044b\u0439 \u0437\u0430\u043f\u0430\u0441 NH 5070 \u0432 \u0441\u0442\u0440\u0430\u043d\u0435
2. **\u0412\u044b\u0441\u043e\u043a\u0430\u044f \u043c\u0430\u0440\u0436\u0430**: 58.8%, $3,300-4,100/\u0435\u0434.
3. **\u0413\u043b\u043e\u0431\u0430\u043b\u044c\u043d\u044b\u0439 \u0441\u043f\u0440\u043e\u0441**: \u0420\u043e\u0436\u0434\u0435\u0441\u0442\u0432\u0435\u043d\u0441\u043a\u0430\u044f \u0441\u043e\u043b\u043e\u043c\u0430/\u043a\u0430\u0447\u0435\u0441\u0442\u0432\u0435\u043d\u043d\u044b\u0439 \u043a\u043e\u0440\u043c
4. **\u041d\u0438\u0437\u043a\u0438\u0439 \u043f\u043e\u0440\u043e\u0433**: \u00a534K \u0431\u044b\u0441\u0442\u0440\u044b\u0435 \u0440\u0435\u0448\u0435\u043d\u0438\u044f
5. **\u041d\u0438\u0437\u043a\u0438\u0435 \u044d\u043a\u0441\u043f\u043b\u0443\u0430\u0442\u0430\u0446\u0438\u043e\u043d\u043d\u044b\u0435**: \u041d\u0438\u0437\u043a\u0438\u0435 \u0437\u0430\u0442\u0440\u0430\u0442\u044b \u043d\u0430 \u043e\u0431\u0441\u043b\u0443\u0436\u0438\u0432\u0430\u043d\u0438\u0435
    `,
    actionTips: JSON.stringify(["\u4f18\u5148\u6253\u530512\u53f05070\u6279\u91cf\u51fa\u53e3", "\u5236\u4f5c\u82f1\u6587/\u4fc4\u6587/\u6cd5\u65875070\u4ea7\u54c1\u5355\u9875", "Facebook\u519c\u673a\u7fa4\u7ec4\u91cd\u70b9\u63a8\u5e7f", "\u5bf9\u63a5\u975e\u6d32/\u4e1c\u5357\u4e9a\u7ecf\u9500\u5546\u6279\u91cf\u62ff\u8d27", "\u53ef\u63d0\u4f9bFOB\u5929\u6d25/\u9752\u5c9b\u62a5\u4ef7"]),
    dataSummary: JSON.stringify([{ label: "\u56fd\u5185\u552e\u4ef7", value: "\u00a53.4\u4e07/\u53f0" }, { label: "\u6d77\u5916\u53c2\u8003", value: "$7,000+" }, { label: "\u5229\u6da6\u7387", value: "58.8%" }, { label: "\u5e93\u5b58", value: "12\u53f0" }, { label: "\u603b\u5229\u6da6\u7a7a\u95f4", value: "\u00a519-32\u4e07" }]),
  },

  // ===== sortOrder=1: 汇率 — EUR/CNY周跌1.02%周五尾盘反弹守住7.75 =====
  {
    icon: "\ud83d\udcb6", region: "\u6b27\u6d32", regionEn: "Europe", regionRu: "\u0415\u0432\u0440\u043e\u043f\u0430",
    tags: JSON.stringify(["\u6c47\u7387\u9884\u8b66", "EUR/CNY", "\u5468\u8dcc1.02%"]),
    tagsEn: JSON.stringify(["FX Alert", "EUR/CNY", "Weekly -1.02%"]),
    tagsRu: JSON.stringify(["\u0412\u0430\u043b\u044e\u0442\u043d\u043e\u0435 \u043f\u0440\u0435\u0434\u0443\u043f\u0440\u0435\u0436\u0434\u0435\u043d\u0438\u0435", "EUR/CNY", "\u041d\u0435\u0434\u0435\u043b\u044f -1.02%"]),
    text: "EUR/CNY周跌1.02%（7.8480\u21927.7681）近三月最大跌幅！周五尾盘反弹至7.7681守住7.75关键支撑",
    textEn: "EUR/CNY weekly -1.02% (7.8480\u21927.7681) largest in 3 months! Friday rebound to 7.7681 holding 7.75 support",
    textRu: "EUR/CNY \u043d\u0435\u0434\u0435\u043b\u044f -1.02% (7.8480\u21927.7681) \u043a\u0440\u0443\u043f\u043d\u0435\u0439\u0448\u0435\u0435 \u0437\u0430 3 \u043c\u0435\u0441\u044f\u0446\u0430! \u041f\u044f\u0442\u043d\u0438\u0447\u043d\u044b\u0439 \u043e\u0442\u0441\u043a\u043e\u043a \u0434\u043e 7.7681, \u0443\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u044f \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u043a\u0443 7.75",
    detailedContent: `## EUR/CNY周跌1.02% — 近三月最大单周跌幅

**最新汇率（6月19日收盘价）：** EUR/CNY 7.7681（周五尾盘从7.7600反弹+0.10%）

### 汇率快照
| 货币对 | 6月16日(周初) | 6月19日(周末) | 周变化 |
|--------|-------------|-------------|--------|
| EUR/CNY | 7.8480 | 7.7681 | **-1.02%** |
| USD/CNY | 6.7583 | 6.7695 | **+0.17%** |
| EUR/RUB | 84.07 | 83.87 | **-0.23%** |

### 套利空间演变（本周）
| 机型 | 6月16日 | 6月20日 | 周变化 |
|------|--------|--------|-------|
| 5300RC(2020) | 335.6% | **331.1%** | -4.5pp |
| 980(2016) | 73.1% | **71.2%** | -1.9pp |
| 970(2017) | 51.8% | **50.2%** | -1.6pp |
| BP1290(2020) | 95.7% | **95.0%** | -0.7pp |

### 要点
- ✅ 周五尾盘反弹（7.7600→7.7681）确认7.75支撑有效
- ⚠️ 周线阴线形态偏弱，下周关注7.75-7.80区间突破方向
- 🔮 ECB 6月会议加息预期（MUFG +25bp），若落地将利好EUR
- 💡 建议加速锁定EUR计价合同，通过CIPS人民币结算对冲`,
    detailedContentEn: `## EUR/CNY Weekly -1.02% — Largest Single-Week Drop in 3 Months

**Latest FX (June 19 Close):** EUR/CNY 7.7681 (Friday rebound from 7.7600 +0.10%)

### FX Snapshot
| Pair | June 16(Mon) | June 19(Fri) | Weekly |
|--------|-------------|-------------|--------|
| EUR/CNY | 7.8480 | 7.7681 | **-1.02%** |
| USD/CNY | 6.7583 | 6.7695 | **+0.17%** |
| EUR/RUB | 84.07 | 83.87 | **-0.23%** |

### Arbitrage Evolution (This Week)
| Model | June 16 | June 20 | Change |
|------|--------|--------|-------|
| 5300RC(2020) | 335.6% | **331.1%** | -4.5pp |
| 980(2016) | 73.1% | **71.2%** | -1.9pp |
| 970(2017) | 51.8% | **50.2%** | -1.6pp |
| BP1290(2020) | 95.7% | **95.0%** | -0.7pp |

### Key Points
- ✅ Friday rebound confirms 7.75 support holds
- ⚠️ Weekly bearish candle, watch 7.75-7.80 next week
- ECB June meeting expected +25bp (MUFG report), will boost EUR if confirmed`,
    detailedContentRu: `## EUR/CNY \u041d\u0435\u0434\u0435\u043b\u044f -1.02% — \u041a\u0440\u0443\u043f\u043d\u0435\u0439\u0448\u0435\u0435 \u043f\u0430\u0434\u0435\u043d\u0438\u0435 \u0437\u0430 3 \u043c\u0435\u0441\u044f\u0446\u0430

**\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0439 \u043a\u0443\u0440\u0441 (19 \u0438\u044e\u043d\u044f):** EUR/CNY 7.7681

### \u0421\u043d\u0438\u043c\u043e\u043a \u0432\u0430\u043b\u044e\u0442
| \u041f\u0430\u0440\u0430 | 16 \u0438\u044e\u043d\u044f | 19 \u0438\u044e\u043d\u044f | \u0418\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u0435 |
|--------|-------------|-------------|--------|
| EUR/CNY | 7.8480 | 7.7681 | **-1.02%** |
| USD/CNY | 6.7583 | 6.7695 | **+0.17%** |
| EUR/RUB | 84.07 | 83.87 | **-0.23%** |

### \u0414\u0438\u043d\u0430\u043c\u0438\u043a\u0430 \u0430\u0440\u0431\u0438\u0442\u0440\u0430\u0436\u0430
| \u041c\u043e\u0434\u0435\u043b\u044c | 16 \u0438\u044e\u043d\u044f | 20 \u0438\u044e\u043d\u044f | \u0418\u0437\u043c. |
|------|--------|--------|-------|
| 5300RC(2020) | 335.6% | **331.1%** | -4.5pp |
| 980(2016) | 73.1% | **71.2%** | -1.9pp`,
    actionTips: JSON.stringify(["\u5468\u4e00\u5f00\u76d8\u5173\u6ce8EUR/CNY 7.75\u652f\u6491\u662f\u5426\u6709\u6548", "\u52a0\u901f\u9501\u5b9a\u6b27\u5143\u8ba1\u4ef7\u5408\u540c\u9632\u8303\u6c47\u7387\u98ce\u9669", "\u63a8\u5e7fCIPS\u4eba\u6c11\u5e01\u7ed3\u7b97\u5bf9\u51b2\u4fc4/\u4e2d\u4e1c\u5ba2\u6237"]),
    dataSummary: JSON.stringify([{ label: "EUR/CNY", value: "7.7681" }, { label: "\u5468\u8dcc\u5e45", value: "-1.02%" }, { label: "\u652f\u6491\u4f4d", value: "7.75" }]),
  },

  // ===== sortOrder=2: 980供给井喷14条(+133%) =====
  {
    icon: "\ud83d\udcc8", region: "\u6b27\u6d32", regionEn: "Europe", regionRu: "\u0415\u0432\u0440\u043e\u043f\u0430",
    tags: JSON.stringify(["980\u7206\u53d1", "+133%", "\u4e3b\u52a8\u8bae\u4ef7"]),
    tagsEn: JSON.stringify(["980 Surge", "+133%", "Active Pricing"]),
    tagsRu: JSON.stringify(["\u0412\u0437\u0440\u044b\u0432 980", "+133%", "\u0410\u043a\u0442\u0438\u0432\u043d\u043e\u0435 \u0446\u0435\u043d\u043e\u043e\u0431\u0440\u0430\u0437\u043e\u0432\u0430\u043d\u0438\u0435"]),
    text: "980\u7cfb\u5217\u4f9b\u7ed9\u4e95\u55b7\u00b714\u6761\u5728\u552e(+133%)\uff01\u4e70\u65b9\u8bae\u4ef7\u7a7a\u95f4\u5386\u53f2\u6700\u5927\uff0c2024\u6b3e60\u4e07\u5b9a\u4ef7\u951a\u786e\u7acb",
    textEn: "980 series supply eruption! 14 listings (+133%)! Buyer bargaining room at all-time high, 2024 model \u20ac467K anchor set",
    textRu: "\u041f\u0440\u0435\u0434\u043b\u043e\u0436\u0435\u043d\u0438\u0435 980 \u0432\u0437\u043e\u0440\u0432\u0430\u043b\u043e\u0441\u044c! 14 \u043e\u0431\u044a\u044f\u0432\u043b\u0435\u043d\u0438\u0439 (+133%)! \u041c\u0430\u043a\u0441\u0438\u043c\u0430\u043b\u044c\u043d\u043e\u0435 \u043f\u0440\u043e\u0441\u0442\u0440\u0430\u043d\u0441\u0442\u0432\u043e \u0434\u043b\u044f \u043f\u0435\u0440\u0435\u0433\u043e\u0432\u043e\u0440\u043e\u0432",
    detailedContent: `## Jaguar 980系列供给井喷 — 14条在售(+133%)两周翻倍

### 980在售明细（本周新增）
| 年份 | 工时 | 价格(EUR) | 换算RMB | 所在地 |
|------|------|-----------|---------|--------|
| 2025 | 363h | \u20ac532,500 | 413.6万 | 德国 |
| **2024** | **1,750h** | **\u20ac467,754** | **363.3万** | **德国\u2192定价锚** |
| 2024 | 875h | 面议 | — | 卢森堡 |
| 2024(T4) | 1,287h | 面议 | — | 德国 |
| 2023(4WD) | 2,182h | \u20ac378,426 | 293.9万 | 德国 |
| 2023 | 2,304h | \u20ac319,815 | 248.4万 | 法国 |
| 2021 | 21h | \u20ac749,805 | 582.4万 | 法国(\u51c6\u65b0\u5929\u82b1\u677f) |
| 2014 | 4,100h | \u20ac216,500 | 168.2万 | 德国 |

### 操作建议
- \u2795 14条在售 = 买方议价空间历史最大
- \u27a1\u8272\u9010\u4e2a\u5bf9\u6bd4\u7b5b\u90093-5\u6761\u6700\u9ad8\u6027\u4ef7\u6bd4\u7684
- \u27a1\u5468\u672b\u524d\u53d1\u51fa\u4e3b\u52a8\u62a5\u4ef7\u90ae\u4ef6
- \u27a1\u76ee\u6807\u83b7\u53d6\u4f4e\u4e8e\u20ac400K\u7684980\u62a5\u4ef7`,
    detailedContentEn: `## Jaguar 980 Supply Eruption — 14 Listings (+133%) Doubled in 2 Weeks

### 980 Listings Detail (New This Week)
| Year | Hours | Price(EUR) | RMB | Location |
|------|------|-----------|---------|--------|
| 2025 | 363h | \u20ac532,500 | 4.136M | Germany |
| **2024** | **1,750h** | **\u20ac467,754** | **3.633M** | **Anchor Price** |
| 2023(4WD) | 2,182h | \u20ac378,426 | 2.939M | Germany |
| 2021 | 21h | \u20ac749,805 | 5.824M | France |
| 2014 | 4,100h | \u20ac216,500 | 1.682M | Germany |

### Action
- 14 listings = historic buyer bargaining power
- Compare each to filter top 3-5 best value
- Send proactive inquiry emails`,
    detailedContentRu: `## \u041f\u0440\u0435\u0434\u043b\u043e\u0436\u0435\u043d\u0438\u0435 Jaguar 980 \u0432\u0437\u043e\u0440\u0432\u0430\u043b\u043e\u0441\u044c — 14 \u043e\u0431\u044a\u044f\u0432\u043b\u0435\u043d\u0438\u0439 (+133%)

### \u0414\u0435\u0442\u0430\u043b\u0438 980
| \u0413\u043e\u0434 | \u0427\u0430\u0441\u044b | \u0426\u0435\u043d\u0430(EUR) | \u042e\u0430\u043d\u0438 | \u041c\u0435\u0441\u0442\u043e |
|------|------|-----------|---------|--------|
| 2025 | 363h | \u20ac532,500 | 4.136\u043c\u043b\u043d | \u0413\u0435\u0440\u043c\u0430\u043d\u0438\u044f |
| 2024 | 1,750h | \u20ac467,754 | 3.633\u043c\u043b\u043d | \u042f\u043a\u043e\u0440\u044c |
| 2021 | 21h | \u20ac749,805 | 5.824\u043c\u043b\u043d | \u0424\u0440\u0430\u043d\u0446\u0438\u044f |
| 2014 | 4,100h | \u20ac216,500 | 1.682\u043c\u043b\u043d | \u0413\u0435\u0440\u043c\u0430\u043d\u0438\u044f |`,
    actionTips: JSON.stringify(["\u9010\u4e2a\u5bf9\u6bd414\u67619780\u7b5b\u9009\u6700\u4f733-5\u53f0", "\u5468\u672b\u524d\u53d1\u51fa4-5\u5bb6\u4e3b\u52a8\u62a5\u4ef7\u90ae\u4ef6", "\u76ee\u6807\u83b7\u53d6\u4f4e\u4e8e\u20ac400K\u7684980\u62a5\u4ef7"]),
    dataSummary: JSON.stringify([{ label: "980\u5728\u552e", value: "14\u6761(+133%)" }, { label: "\u5b9a\u4ef7\u951a", value: "\u20ac467,754" }]),
  },

  // ===== sortOrder=3: 5300RC(2020) 331.1%全品类第一 =====
  {
    icon: "\ud83c\udde8\ud83c\uddf3", region: "\u4e2d\u56fd", regionEn: "China", regionRu: "\u041a\u0438\u0442\u0430\u0439",
    tags: JSON.stringify(["5300RC", "331.1%", "\u5168\u54c1\u7c7b\u7b2c\u4e00"]),
    tagsEn: JSON.stringify(["5300RC", "331.1%", "Category Leader"]),
    tagsRu: JSON.stringify(["5300RC", "331.1%", "\u041b\u0438\u0434\u0435\u0440 \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438"]),
    text: "5300RC(2020)\uff1a18\u4e07\u767d\u83dc\u4ef7 vs \u56fd\u9645\u20ac99,900\u219277.6\u4e07\uff0c331.1%\u4ef7\u5dee\u7387\u5168\u54c1\u7c7b\u7b2c\u4e00\uff01\u5468\u672b\u786e\u8ba4\u8f66\u51b5",
    textEn: "5300RC(2020): 18K bargain vs int\u2019l \u20ac99,900\u219277.6K, 331.1% spread rate #1! Confirm condition this weekend",
    textRu: "5300RC(2020): 18\u0422 \u043f\u043e \u0431\u0440\u043e\u0441\u043e\u0432\u043e\u0439 \u0446\u0435\u043d\u0435 vs \u043c\u0435\u0436\u0434\u0443\u043d\u0430\u0440. \u20ac99,900\u219277.6K, 331.1% \u0440\u0430\u0437\u043d\u0438\u0446\u0430 #1!",
    detailedContent: `## CLAAS 5300RC(2020) — 18万白菜价331.1%全品类第一

### 套利对比
| 指标 | 数值 |
|------|------|
| 国内售价 | **18万元** |
| 国际参考价 | \u20ac99,900 \u2192 77.6万元(EUR@7.7681) |
| 价差 | **59.6万元** |
| 价差率 | **331.1%** \u2b50\u2b50\u2b50\u2b50\u2b50 |
| 品类 | 大方捆打捆机 |

### 本周套利排行
| 排名 | 机型 | 价差率 | 变化 |
|------|------|--------|------|
| \ud83e\udd47 1 | **5300RC(2020)** | **331.1%** | -4.5pp |
| \ud83e\udd48 2 | FR450(2013) | 101.4% | 持平 |
| \ud83e\udd49 3 | BP1290(2020) | 95.0% | -0.7pp |
| 4 | 980(2016) | 71.2% | -1.9pp |
| 5 | BigM 420(2018) | 58.4% | 持平 |
| 6 | 970(2017) | 50.2% | -1.6pp |

### 行动
- \u26a0\ufe0f EUR周跌1.02%但5300RC因绝对价差大仍为第一
- \u27a1 周末确认车况后立即锁定
- \u27a1 优先推向俄语区/乌克兰买家`,
    detailedContentEn: `## CLAAS 5300RC(2020) — 18K Bargain 331.1% #1

### Arbitrage Comparison
| Indicator | Value |
|------|------|
| Domestic Price | **CNY 180K** |
| International Ref | \u20ac99,900 \u2192 CNY 776K |
| Spread | **CNY 596K** |
| Spread Rate | **331.1%** |
| Category | Large Square Baler |

### Rankings
| Rank | Model | Rate | Change |
|------|------|--------|------|
| #1 | **5300RC(2020)** | **331.1%** | -4.5pp |
| #2 | FR450(2013) | 101.4% | flat |
| #3 | BP1290(2020) | 95.0% | -0.7pp |`,
    detailedContentRu: `## CLAAS 5300RC(2020) — 18K \u043f\u043e \u0431\u0440\u043e\u0441\u043e\u0432\u043e\u0439 \u0446\u0435\u043d\u0435 331.1% #1

### \u0421\u0440\u0430\u0432\u043d\u0435\u043d\u0438\u0435
| \u041f\u043e\u043a\u0430\u0437\u0430\u0442\u0435\u043b\u044c | \u0417\u043d\u0430\u0447\u0435\u043d\u0438\u0435 |
|------|------|
| \u0412\u043d\u0443\u0442\u0440. \u0446\u0435\u043d\u0430 | **180K \u044e\u0430\u043d\u0435\u0439** |
| \u041c\u0435\u0436\u0434\u0443\u043d\u0430\u0440. | \u20ac99,900 \u2192 776K |
| \u0420\u0430\u0437\u043d\u0438\u0446\u0430 | **596K \u044e\u0430\u043d\u0435\u0439** |
| \u0421\u0442\u0430\u0432\u043a\u0430 | **331.1%** |`,
    actionTips: JSON.stringify(["\u5468\u672b\u786e\u8ba45300RC\u8f66\u51b5\u72b6\u6001", "\u786e\u8ba4\u540e\u7acb\u5373\u9501\u5b9a\u5e76\u63a8\u5411\u4fc4\u8bed\u533a/4\u4e4c\u514b\u5170", "\u531799,900\u4e3a\u5356\u5bb6\u62a5\u4ef7\u67b4\u63d0\u5347\u62a5\u4ef7\u81ea\u4fe1"]),
    dataSummary: JSON.stringify([{ label: "\u4ef7\u5dee\u7387", value: "331.1%" }, { label: "\u4ef7\u5dee", value: "59.6\u4e07" }, { label: "\u6392\u540d", value: "\u7b2c\u4e00" }]),
  },

  // ===== sortOrder=4: FR450(2013) 101.4%爆款10台 =====
  {
    icon: "\ud83c\udde8\ud83c\uddf3", region: "\u4e2d\u56fd", regionEn: "China", regionRu: "\u041a\u0438\u0442\u0430\u0439",
    tags: JSON.stringify(["FR450\u7206\u6b3e", "101.4%", "10\u53f0\u5e93\u5b58"]),
    tagsEn: JSON.stringify(["FR450 Hot", "101.4%", "10 Units"]),
    tagsRu: JSON.stringify(["FR450 \u0445\u0438\u0442", "101.4%", "10 \u0435\u0434."]),
    text: "FR450(2013)\uff1a21.5\u4e07/\u53f0+101.4%\u4ef7\u5dee\u7387\uff0c10\u53f0\u5e93\u5b58\u8d70\u91cf\u7206\u6b3e\uff0c\u6c47\u7387\u6ce2\u52a8\u5f71\u54cd\u6700\u5c0f",
    textEn: "FR450(2013): 21.5K/unit + 101.4% spread rate, 10 units volume seller, minimal FX impact",
    textRu: "FR450(2013): 21.5K/\u0435\u0434. + 101.4% \u0440\u0430\u0437\u043d\u0438\u0446\u0430, 10 \u0435\u0434. \u043e\u0431\u044a\u0435\u043c\u043d\u044b\u0439 \u0445\u0438\u0442, \u043c\u0438\u043d\u0438\u043c\u0430\u043b\u044c\u043d\u043e\u0435 \u0432\u043b\u0438\u044f\u043d\u0438\u0435 \u0432\u0430\u043b\u044e\u0442",
    detailedContent: `## New Holland FR450(2013) — 101.4%爆款10台速推

### 套利分析
| 指标 | 数值 |
|------|------|
| 国内一口价 | **21.5万元/台** |
| 俄市场参考价 | 43.3万元 |
| 价差 | 21.8万元 |
| 价差率 | **101.4%** |
| 库存 | **10台** |
| 汇率敏感度 | 低（绝对价差小） |

### 为什么EUR跌了它还是爆款？
- 绝对价差仅21.8万\u2192EUR波动\u00b12%影响\u00b10.44万
- 21.5万低门槛\u2192买家决策快
- 10台走量\u2192盈利确定性高
- 不受EUR/CNY 7.75破位影响`,
    detailedContentEn: `## New Holland FR450(2013) — 101.4% Hot Seller 10 Units

### Analysis
| Indicator | Value |
|------|------|
| Price | **CNY 215K/unit** |
| Russian Ref | CNY 433K |
| Spread | CNY 218K |
| Rate | **101.4%** |
| Stock | **10 units** |
| FX Sensitivity | Low |

### Why Still Hot Despite EUR Drop?
- Only 21.8K spread \u2192 \u00b12% EUR = \u00b14.4K impact
- 215K low barrier \u2192 fast decisions
- 10 units volume`,
    detailedContentRu: `## New Holland FR450(2013) — 101.4% 10 \u0435\u0434\u0438\u043d\u0438\u0446

### \u0410\u043d\u0430\u043b\u0438\u0437
| \u041f\u043e\u043a\u0430\u0437\u0430\u0442\u0435\u043b\u044c | \u0417\u043d\u0430\u0447\u0435\u043d\u0438\u0435 |
|------|------|
| \u0426\u0435\u043d\u0430 | **215K \u044e\u0430\u043d\u0435\u0439/\u0435\u0434.** |
| \u0421\u043f\u0440\u0430\u0432\u043a\u0430 | 433K |
| \u0420\u0430\u0437\u043d\u0438\u0446\u0430 | 218K |
| \u0421\u0442\u0430\u0432\u043a\u0430 | **101.4%** |
| \u0417\u0430\u043f\u0430\u0441 | **10 \u0435\u0434.** |`,
    actionTips: JSON.stringify(["FR450\u4fc4\u8bed\u533a\u6279\u91cf\u901f\u63a810\u53f0", "21.5\u4e07\u4f4e\u95e8\u69db\u5438\u5f15\u5c0f\u578b\u4e70\u5bb6", "\u4e00\u53e3\u4ef7\u7b56\u7565\u52a0\u901f\u6210\u4ea4"]),
    dataSummary: JSON.stringify([{ label: "\u4ef7\u5dee\u7387", value: "101.4%" }, { label: "\u5e93\u5b58", value: "10\u53f0" }, { label: "\u5355\u4ef7", value: "\u00a521.5\u4e07" }]),
  },

  // ===== sortOrder=5: BP1290(2020) 95.0%打捆机冠军 =====
  {
    icon: "\ud83c\udde8\ud83c\uddf3", region: "\u4e2d\u56fd", regionEn: "China", regionRu: "\u041a\u0438\u0442\u0430\u0439",
    tags: JSON.stringify(["BP1290", "95.0%", "\u6253\u6346\u673a\u51a0\u519b"]),
    tagsEn: JSON.stringify(["BP1290", "95.0%", "Baler Champion"]),
    tagsRu: JSON.stringify(["BP1290", "95.0%", "\u0427\u0435\u043c\u043f\u0438\u043e\u043d \u043f\u0440\u0435\u0441\u0441\u043e\u0432"]),
    text: "Krone BP1290(2020)\uff1a\u56fd\u9645\u20ac170,765\u2192132.6\u4e07 vs \u56fd\u518568\u4e07\uff0c\u4ef7\u5dee64.6\u4e07(95.0%)\uff0c\u6253\u6346\u673a\u5957\u5229\u51a0\u519b",
    textEn: "Krone BP1290(2020): int\u2019l \u20ac170,765\u2192132.6K vs domestic 68K, spread 64.6K(95.0%), baler arbitrage champion",
    textRu: "Krone BP1290(2020): \u043c\u0435\u0436\u0434\u0443\u043d\u0430\u0440. \u20ac170,765\u2192132.6K vs \u0432\u043d\u0443\u0442\u0440. 68K, \u0440\u0430\u0437\u043d\u0438\u0446\u0430 64.6K(95.0%)",
    detailedContent: `## Krone BiG Pack 1290(2020) — 95.0%打捆机套利冠军

### 套利分析
| 指标 | 数值 |
|------|------|
| 国内售价 | **68万元** |
| 国际参考价 | \u20ac170,765 \u2192 132.6万元(@7.7681) |
| 价差 | **64.6万元** |
| 价差率 | **95.0%** |
| 品类 | 大方捆打捆机 |

### 本周套利对比（打捆机品类）
| 机型 | 价差率 | 利润 |
|------|--------|------|
| **BP1290(2020)** | **95.0%** | **64.6万** |
| 5300RC(2020) | 331.1% | 59.6万 |
| 5300RC(2022) | 18.7% | 17.8万 |

### 行动建议
- \u27a1 \u4e1c\u6b27\u63a8\u91cf\uff0895.0%\u4ef7\u5dee\u7387\uff09
- \u27a1 BP1290\u6b27\u6d32\u4f9b\u5e9414\u6761\uff0c\u7ed9\u4e70\u5bb6\u9009\u62e9\u7a7a\u95f4\u5927
- \u27a1 \u4f18\u5148\u63a8\u5411\u4e4c\u514b\u5170\u5e02\u573a\uff08\u57fa\u8f85BP1290\u6d3b\u8dc3\uff09`,
    detailedContentEn: `## Krone BiG Pack 1290(2020) — 95.0% Baler Champion

### Analysis
| Indicator | Value |
|------|------|
| Domestic | **CNY 680K** |
| International | \u20ac170,765 \u2192 CNY 1.326M |
| Spread | **CNY 646K** |
| Rate | **95.0%** |
| Category | Large Square Baler |

### Baler Comparison
| Model | Rate | Profit |
|------|--------|------|
| **BP1290(2020)** | **95.0%** | **646K** |
| 5300RC(2020) | 331.1% | 596K |
| 5300RC(2022) | 18.7% | 178K |`,
    detailedContentRu: `## Krone BiG Pack 1290(2020) — 95.0% \u0427\u0435\u043c\u043f\u0438\u043e\u043d

### \u0410\u043d\u0430\u043b\u0438\u0437
| \u041f\u043e\u043a\u0430\u0437\u0430\u0442\u0435\u043b\u044c | \u0417\u043d\u0430\u0447\u0435\u043d\u0438\u0435 |
|------|------|
| \u0412\u043d\u0443\u0442\u0440. | **680K** |
| \u041c\u0435\u0436\u0434\u0443\u043d\u0430\u0440. | \u20ac170,765 \u2192 1.326M |
| \u0420\u0430\u0437\u043d\u0438\u0446\u0430 | **646K** |
| \u0421\u0442\u0430\u0432\u043a\u0430 | **95.0%** |`,
    actionTips: JSON.stringify(["BP1290\u4e1c\u6b27\u63a8\u91cf\uff0c95%+\u4ef7\u5dee\u7387\u4e3a\u6253\u6346\u673a\u5957\u5229\u51a0\u519b", "\u5229\u7528\u6b27\u6d3214\u6761BP1290\u5728\u552e\u63d0\u4f9b\u9009\u62e9\u7a7a\u95f4", "\u4f18\u5148\u63a8\u5411\u4e4c\u514b\u5170\u5e02\u573a"]),
    dataSummary: JSON.stringify([{ label: "\u4ef7\u5dee\u7387", value: "95.0%" }, { label: "\u4ef7\u5dee", value: "64.6\u4e07" }, { label: "\u5b9a\u4f4d", value: "\u6253\u6346\u673a\u51a0\u519b" }]),
  },

  // ===== sortOrder=6: 980(2021,21h)准新天花板 =====
  {
    icon: "\ud83c\uddea\ud83c\uddfa", region: "\u6b27\u6d32", regionEn: "Europe", regionRu: "\u0415\u0432\u0440\u043e\u043f\u0430",
    tags: JSON.stringify(["980\u51c6\u65b0", "21\u5c0f\u65f6", "582.4\u4e07"]),
    tagsEn: JSON.stringify(["980 Quasi-New", "21 Hours", "CNY 5.824M"]),
    tagsRu: JSON.stringify(["980 \u043f\u043e\u0447\u0442\u0438 \u043d\u043e\u0432\u044b\u0439", "21 \u0447\u0430\u0441\u043e\u0432", "5.824\u043c\u043b\u043d"]),
    text: "980(2021,21h)准新机天花板！\u20ac749,805\u2192582.4万\uff0c\u4ec521\u5de5\u65f6\u51e0\u4e4e\u672a\u4f7f\u7528\uff0c\u5468\u672b\u63a8\u7ed9VIP\u5ba2\u6237",
    textEn: "980(2021,21h) quasi-new ceiling! \u20ac749,805\u2192CNY 5.824M, only 21 hours almost unused, push to VIP clients this weekend",
    textRu: "980(2021,21h) \u043f\u043e\u0442\u043e\u043b\u043e\u043a! \u20ac749,805\u21925.824\u043c\u043b\u043d, \u0432\u0441\u0435\u0433\u043e 21 \u0447\u0430\u0441, \u043f\u043e\u0447\u0442\u0438 \u043d\u0435 \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u043d",
    detailedContent: `## 980(2021,21h)准新天花板 — 582.4万高端专供

### 详情
| 指标 | 数值 |
|------|------|
| 型号 | CLAAS Jaguar 980 |
| 年份 | 2021 |
| 工时 | **仅21小时（几乎未使用）** |
| 价格 | \u20ac749,805 |
| 换算RMB | 582.4万元(EUR@7.7681) |
| 所在地 | 法国上普罗旺斯 |

### 定价参考
- 980(2021,21h) = 天花板（含配件）
- 980(2024,1750h) = 定价锚（\u20ac467,754）
- 980(2014,4100h) = 地板（\u20ac216,500）
- 980(2016)国内143万 = 套利核心标的

### 目标客户
- \u2795 \u8d44\u6df1\u519c\u573a/\u79df\u8d41\u516c\u53f8
- \u2795 \u4e1c\u6b27\u5927\u519c\u573a\u4e3b
- \u2795 \u5468\u672bVIP\u63a8\u4ecb`,
    detailedContentEn: `## 980(2021,21h) Quasi-New Ceiling — CNY 5.824M

### Details
| Indicator | Value |
|------|------|
| Model | CLAAS Jaguar 980 |
| Year | 2021 |
| Hours | **Only 21h (barely used)** |
| Price | \u20ac749,805 |
| RMB | CNY 5.824M |
| Location | Alpes-de-Haute-Provence, France |

### Pricing Ladder
- 980(2021,21h) = Ceiling
- 980(2024,1750h) = Anchor
- 980(2014,4100h) = Floor`,
    detailedContentRu: `## 980(2021,21h) \u041f\u043e\u0442\u043e\u043b\u043e\u043a — 5.824\u043c\u043b\u043d

### \u0414\u0435\u0442\u0430\u043b\u0438
| \u041f\u043e\u043a\u0430\u0437\u0430\u0442\u0435\u043b\u044c | \u0417\u043d\u0430\u0447\u0435\u043d\u0438\u0435 |
|------|------|
| \u041c\u043e\u0434\u0435\u043b\u044c | CLAAS Jaguar 980 |
| \u0413\u043e\u0434 | 2021 |
| \u0427\u0430\u0441\u044b | **\u0412\u0441\u0435\u0433\u043e 21\u0447** |
| \u0426\u0435\u043d\u0430 | \u20ac749,805 |
| \u042e\u0430\u043d\u0438 | 5.824\u043c\u043b\u043d |`,
    actionTips: JSON.stringify(["\u5468\u672bVIP\u63a8\u4ecb\u7ed9\u8d44\u6df1\u519c\u573a/\u79df\u8d41\u516c\u53f8", "\u4ec5582.4\u4e07\u5929\u82b1\u677f\u53cd\u5411\u7a81\u663e\u56fd\u5185143\u4e07\u6027\u4ef7\u6bd4", "\u4e0d\u505a\u5b9a\u4ef7\u53c2\u8003\uff0c\u4f46\u53ef\u7528\u4e8e\u55ae\u4ef7\u6c9f\u901a"]),
    dataSummary: JSON.stringify([{ label: "\u5929\u82b1\u677f", value: "582.4\u4e07" }, { label: "\u5de5\u65f6", value: "21h" }, { label: "\u5b9a\u4f4d", value: "VIP\u4e13\u4eab" }]),
  },

  // ===== sortOrder=7: 970美英新渠道 =====
  {
    icon: "\ud83c\uddfa\ud83c\uddf8", region: "\u5168\u7403", regionEn: "Global", regionRu: "\u0413\u043b\u043e\u0431\u0430\u043b\u044c\u043d\u043e",
    tags: JSON.stringify(["970\u65b0\u6e20\u9053", "\u7f8e\u56fd", "\u82f1\u56fd"]),
    tagsEn: JSON.stringify(["970 New Channel", "USA", "UK"]),
    tagsRu: JSON.stringify(["970 \u041d\u043e\u0432\u044b\u0439 \u043a\u0430\u043d\u0430\u043b", "C\u0428\u0410", "\u0412\u0435\u043b\u0438\u043a\u043e\u0431\u0440\u0438\u0442\u0430\u043d\u0438\u044f"]),
    text: "970\u7f8e\u82f1\u65b0\u6e20\u9053\u6253\u901a\uff01\u7f8e\u56fd\u5a01\u65af\u5eb7\u661f(2020/1665h/\u20ac315K)+\u82f1\u56fd\u574e\u5e03\u91cc\u4e9a(2019/2000h/\u20ac265K)",
    textEn: "970 US/UK new channels opened! Wisconsin(2020/1665h/\u20ac315K) + Cumbria(2019/2000h/\u20ac265K)",
    textRu: "970 \u043d\u043e\u0432\u044b\u0435 \u043a\u0430\u043d\u0430\u043b\u044b \u0421\u0428\u0410/\u0412\u0435\u043b\u0438\u043a\u043e\u0431\u0440\u0438\u0442\u0430\u043d\u0438\u044f",
    detailedContent: `## Jaguar 970美英新渠道 — 渠道多元化里程碑

### 新渠道详情
| 渠道 | 年份 | 工时 | 价格(EUR) | 换算RMB |
|------|------|------|-----------|---------|
| \ud83c\uddfa\ud83c\uddf8 美国威斯康星 | 2020 | 1,665h | \u20ac315,118 | 244.8万 |
| \ud83c\uddec\ud83c\udde7 英国坎布里亚 | 2019 | 2,000h | \u20ac264,667 | 205.6万 |

### 意义
- \u2795 \u7f8e\u56fd/\u82f1\u56fd\u5356\u5bb6\u9996\u6b21\u51fa\u73b0 = CLAAS\u5168\u7403\u6d41\u52a8\u6027\u63d0\u5347
- \u2795 \u4e3a\u5317\u7f8e/\u82f1\u56fd\u5411\u4e1c\u6b27\u8f6c\u53e3\u63d0\u4f9b\u53ef\u80fd\u6027
- \u2795 \u82f1\u56fd\u574e\u5e03\u91cc\u4e9a\u4ef7\u683c\u4f4e\u4e8e\u5fb7\u56fd6-16%\uff08\u8131\u6b27\u540e\u6c47\u7387\u4f18\u52bf\uff09`,
    detailedContentEn: `## Jaguar 970 US/UK New Channels — Multi-Sourcing Milestone

### Details
| Channel | Year | Hours | Price(EUR) | RMB |
|------|------|------|-----------|---------|
| \ud83c\uddfa\ud83c\uddf8 Wisconsin, USA | 2020 | 1,665h | \u20ac315,118 | 2.448M |
| \ud83c\uddec\ud83c\udde7 Cumbria, UK | 2019 | 2,000h | \u20ac264,667 | 2.056M |

### Why It Matters
- First-ever USA/UK CLAAS 970 sellers = global liquidity up
- UK Cumbria 6-16% cheaper than Germany (post-Brexit FX advantage)`,
    detailedContentRu: `## Jaguar 970 \u043d\u043e\u0432\u044b\u0435 \u043a\u0430\u043d\u0430\u043b\u044b

### \u0414\u0435\u0442\u0430\u043b\u0438
| \u041a\u0430\u043d\u0430\u043b | \u0413\u043e\u0434 | \u0427\u0430\u0441\u044b | \u0426\u0435\u043d\u0430(EUR) | \u042e\u0430\u043d\u0438 |
|------|------|------|-----------|---------|
| \u0421\u0428\u0410 | 2020 | 1,665h | \u20ac315,118 | 2.448\u043c\u043b\u043d |
| \u0412\u0435\u043b\u0438\u043a\u043e\u0431\u0440\u0438\u0442\u0430\u043d\u0438\u044f | 2019 | 2,000h | \u20ac264,667 | 2.056\u043c\u043b\u043d |`,
    actionTips: JSON.stringify(["\u62d3\u5c55\u5317\u7f8e/\u82f1\u56fd970\u91c7\u8d2d\u6e20\u9053", "\u5229\u7528\u82f1\u56fd\u6c47\u7387\u4f18\u52bf\u83b7\u53d6\u4f4e\u4ef7\u9700\u6c42", "\u7f8e\u82f1\u8d2d\u8f66\u2192\u4e1c\u6b27\u8f6c\u53e3\u8def\u7ebf\u8bd5\u70b9"]),
    dataSummary: JSON.stringify([{ label: "\u7f8e\u56fd\u9700\u6c42", value: "\u20ac315K" }, { label: "\u82f1\u56fd\u9700\u6c42", value: "\u20ac265K" }]),
  },

  // ===== sortOrder=8: 俄罗斯EU制裁 =====
  {
    icon: "\ud83c\uddf7\ud83c\uddfa", region: "\u4fc4\u7f57\u65af", regionEn: "Russia", regionRu: "\u0420\u043e\u0441\u0441\u0438\u044f",
    tags: JSON.stringify(["EU\u5236\u88c1", "\u914d\u4ef6\u65ad\u4f9b", "\u4e2d\u56fd\u66ff\u4ee3"]),
    tagsEn: JSON.stringify(["EU Sanctions", "Parts Shortage", "China Substitution"]),
    tagsRu: JSON.stringify(["\u0421\u0430\u043d\u043a\u0446\u0438\u0438 \u0415\u0421", "\u0414\u0435\u0444\u0438\u0446\u0438\u0442 \u0437\u0430\u043f\u0447\u0430\u0441\u0442\u0435\u0439", "\u0417\u0430\u043c\u0435\u043d\u0430 \u041a\u0438\u0442\u0430\u0435\u043c"]),
    text: "EU\u7b2c20\u8f6e\u5bf9\u4fc4\u5236\u88c1\u6301\u7eed\uff01\u6b27\u7f8e\u519c\u673a\u914d\u4ef6\u65ad\u4f9b\u52a0\u5267\uff0c\u4e2d\u56fd\u8bbe\u5907\u66ff\u4ee3\u7a97\u53e3\u6269\u5927\uff0c4\u6708\u5236\u88c1120\u9879\u65b0\u589e",
    textEn: "EU 20th round Russia sanctions ongoing! Western agri parts shortage worsens, China equipment substitution window expands",
    textRu: "20-\u0439 \u0440\u0430\u0443\u043d\u0434 \u0441\u0430\u043d\u043a\u0446\u0438\u0439 \u0415\u0421 \u043f\u0440\u043e\u0442\u0438\u0432 \u0420\u0424 \u043f\u0440\u043e\u0434\u043e\u043b\u0436\u0430\u0435\u0442\u0441\u044f!",
    detailedContent: `## EU第20轮对俄制裁持续 — 中国设备替代窗口扩大

### 制裁对农机市场影响
| 影响维度 | 具体变化 |
|---------|--------|
| 欧美配件断供 | CLAAS/Deere/Kubota配件供应中断加剧 |
| 中国设备替代 | 二手中国农机不受制裁限制 |
| 俄优先产业 | 2026年农机排第一，5%低关税+政府补贴 |
| 物流通道 | 中俄铁路运输正常，30-40天到货 |
| 卢布稳定 | EUR/RUB 83.87，人民币结算可行 |

### 神雕机会
- \u2795 CLAAS 970/980/850均符合俄市场刚需
- \u2795 可提供俄语说明书+配件供应承诺
- \u2795 CIPS人民币结算可降低汇率风险`,
    detailedContentEn: `## EU 20th Round Russia Sanctions — China Substitution Window Expands

### Impact on Agri-Machinery
| Dimension | Change |
|---------|--------|
| Western parts | CLAAS/Deere/Kubota supply increasingly disrupted |
| China substitution | Used Chinese machinery not subject to sanctions |
| Russia priority | Agri #1 in 2026, 5% tariff + subsidies |
| Logistics | China-Russia rail normal, 30-40 days |

### Opportunity
- CLAAS 970/980/850 meet Russian demand
- Russian manuals + parts commitment
- CIPS RMB settlement hedges FX risk`,
    detailedContentRu: `## 20-\u0439 \u0440\u0430\u0443\u043d\u0434 \u0441\u0430\u043d\u043a\u0446\u0438\u0439 \u0415\u0421

### \u0412\u043b\u0438\u044f\u043d\u0438\u0435
| \u0418\u0437\u043c\u0435\u0440\u0435\u043d\u0438\u0435 | \u0418\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u044f |
|---------|--------|
| \u0417\u0430\u043f\u0447\u0430\u0441\u0442\u0438 | \u041f\u0435\u0440\u0435\u0431\u043e\u0438 \u0421\u0417\u0427 |
| \u0417\u0430\u043c\u0435\u043d\u0430 | \u041a\u0438\u0442\u0430\u0439 \u043d\u0435 \u043f\u043e\u0434 \u0441\u0430\u043d\u043a\u0446\u0438\u044f\u043c\u0438 |
| \u041f\u0440\u0438\u043e\u0440\u0438\u0442\u0435\u0442 | \u0421/\u0445 \u21161 \u0432 2026, 5% \u043f\u043e\u0448\u043b\u0438\u043d\u0430 |
| \u041b\u043e\u0433\u0438\u0441\u0442\u0438\u043a\u0430 | \u041f\u043e\u0435\u0437\u0434\u0430 \u0432 \u043d\u043e\u0440\u043c\u0435, 30-40 \u0434\u043d\u0435\u0439 |`,
    actionTips: JSON.stringify(["\u91cd\u70b9\u63a8CLAAS\u4e8c\u624b970/980\u66ff\u4ee3\u6b27\u7f8e\u65ad\u4f9b\u673a\u578b", "\u627f\u8bfa\u914d\u4ef6\u4f9b\u5e94\u589e\u5f3a\u4e70\u5bb6\u4fe1\u5fc3", "\u5229\u75285%\u4f4e\u5173\u7a0e+\u653f\u5e9c\u8865\u8d34\u653f\u7b56\u4fc3\u9500"]),
    dataSummary: JSON.stringify([{ label: "EUR/RUB", value: "83.87" }, { label: "\u4fc4\u519c\u673a\u5173\u7a0e", value: "5%" }]),
  },

  // ===== sortOrder=9: 乌克兰FAO+AGRO展 =====
  {
    icon: "\ud83c\uddfa\ud83c\udde6", region: "\u4e4c\u514b\u5170", regionEn: "Ukraine", regionRu: "\u0423\u043a\u0440\u0430\u0457\u043d\u0430",
    tags: JSON.stringify(["FAO", "AGRO 2026", "\u7cae\u98df83.6\u767e\u4e07\u5428"]),
    tagsEn: JSON.stringify(["FAO", "AGRO 2026", "8.36M Tons Grain"]),
    tagsRu: JSON.stringify(["\u0424\u0410\u041e", "AGRO 2026", "83.6 \u043c\u043b\u043d \u0442\u043e\u043d\u043d"]),
    text: "FAO\u4e4c\u514b\u5170\u4e09\u5e74\u8ba1\u521283.6\u767e\u4e07\u5428\u8c37\u7269+AGRO 2026\u5c557\u6708\u57fa\u8f85\uff0c\u519c\u673a\u786e\u5b9a\u6027\u9700\u6c42\u5f3a\u52b2",
    textEn: "FAO Ukraine 3-year plan 83.6M tons grain + AGRO 2026 July Kyiv, agricultural machinery demand confirmed strong",
    textRu: "\u0422\u0440\u0435\u0445\u043b\u0435\u0442\u043d\u0438\u0439 \u043f\u043b\u0430\u043d \u0424\u0410\u041e 83.6 \u043c\u043b\u043d \u0442\u043e\u043d\u043d + AGRO 2026 \u041a\u0438\u0435\u0432",
    detailedContent: `## 乌克兰 — FAO粮食计划+AGRO 2026展

### 市场动态
| 指标 | 数值 |
|------|------|
| FAO三年计划谷物产量 | **83.6百万吨** |
| AGRO 2026展 | 7月·基辅·第34届 |
| 1-2月农产品出口 | 9.95万吨(+9.3%) |
| 黑海+多瑙河路线 | 已恢复运行 |
| BP1290基辅渠道 | 活跃在售 |

### 神雕机会
- \u2795 7月AGRO展前应完成至少1台980/FR450出口
- \u2795 BP1290在基辅有活跃渠道\u2192打捆机出口优先
- \u2795 注册线上参展+翻译乌语资料`,
    detailedContentEn: `## Ukraine — FAO Grain Plan + AGRO 2026

### Market Dynamics
| Indicator | Value |
|------|------|
| FAO 3-yr grain | **83.6M tons** |
| AGRO 2026 | July, Kyiv, 34th |
| Jan-Feb exports | 99.5K tons (+9.3%) |
| Black Sea routes | Operational |
| BP1290 Kyiv | Active channel |

### Opportunity
- Complete 1+ export before AGRO July
- BP1290 baler export priority
- Register online + translate Ukrainian materials`,
    detailedContentRu: `## Украина — План ФАО + AGRO 2026

### Динамика
| Показатель | Значение |
|------|------|
| ФАО 3 года | **83.6 млн т** |
| AGRO 2026 | Июль, Киев |
| Экспорт | 99.5K т (+9.3%) |

### Возможности
- Завершить 1+ экспорт до AGRO
- BP1290 приоритет
- Украинские материалы`,
    actionTips: JSON.stringify(["7\u6708AGRO\u5c55\u524d\u5b8c\u6210980/FR450\u5404\u81f31\u53f0\u51fa\u53e3", "\u6ce8\u518c\u7ebf\u4e0a\u53c2\u5c55+\u7ffb\u8bd1\u4e4c\u8bed\u8d44\u6599", "BP1290\u57fa\u8f85\u6e20\u9053\u4f18\u5148\u63a8\u8fdb\u6253\u6346\u673a\u51fa\u53e3"]),
    dataSummary: JSON.stringify([{ label: "\u8c37\u7269\u4ea7\u91cf", value: "83.6\u767e\u4e07\u5428" }, { label: "AGRO\u5c55", value: "7\u6708\u57fa\u8f85" }]),
  },

  // ===== sortOrder=10: 新兴市场 (乌兹别克+非洲+东南亚) =====
  {
    icon: "\ud83c\udf0d", region: "\u5168\u7403", regionEn: "Global", regionRu: "\u0413\u043b\u043e\u0431\u0430\u043b\u044c\u043d\u043e",
    tags: JSON.stringify(["\u65b0\u5174\u5e02\u573a", "\u4e4c\u5179\u522b\u5148", "\u975e\u6d32+\u4e1c\u5357\u4e9a"]),
    tagsEn: JSON.stringify(["Emerging Markets", "Uzbekistan", "Africa+SE Asia"]),
    tagsRu: JSON.stringify(["\u0420\u0430\u0437\u0432\u0438\u0432\u0430\u044e\u0449\u0438\u0435\u0441\u044f", "\u0423\u0437\u0431\u0435\u043a\u0438\u0441\u0442\u0430\u043d", "\u0410\u0444\u0440\u0438\u043a\u0430+\u042e\u0412\u0410"]),
    text: "\u4e4c\u5179\u522b\u514bQ1+256.77%\u5168\u7403\u6700\u5feb\uff01\u80af\u5c3c\u4e9a+46.6%\uff0c\u5370\u5c3c+121.07%\uff0c\u4e09\u5927\u65b0\u5174\u5e02\u573a\u540c\u6b65\u7206\u53d1",
    textEn: "Uzbekistan Q1 +256.77% fastest globally! Kenya +46.6%, Indonesia +121.07%, 3 emerging markets erupting simultaneously",
    textRu: "\u0423\u0437\u0431\u0435\u043a\u0438\u0441\u0442\u0430\u043d Q1 +256.77% \u0441\u0430\u043c\u044b\u0439 \u0431\u044b\u0441\u0442\u0440\u044b\u0439! \u041a\u0435\u043d\u0438\u044f +46.6%, \u0418\u043d\u0434\u043e\u043d\u0435\u0437\u0438\u044f +121.07%",
    detailedContent: `## 全球新兴市场 — 三大区域同步爆发

### 乌兹别克斯坦（+256.77%全球最快）
| 指标 | 数值 |
|------|------|
| Q1进口增速 | **+256.77%** |
| 棉花采收机械化率 | 不足40% |
| 政府补贴 | 农机购置补贴50% |
| 推荐机型 | CLAAS 850/860青储机、NH 100-200HP拖拉机 |

### 非洲（肯尼亚+46.6%/NAMPO展后）
| 区域 | 特点 | 需求机型 |
|------|------|--------|
| \ud83c\uddf0\ud83c\uddea 肯尼亚 | +46.6% | 50-100HP拖拉机 |
| \ud83c\uddf3\ud83c\uddec 尼日利亚 | 可耕地最大 | 中型拖拉机 |
| \ud83c\uddff\ud83c\udde6 南非 | 商业化农业 | 大型农机 |

### 东南亚（印尼+121.07%）
| 国家 | 增速 | 主力机型 |
|------|------|--------|
| \ud83c\uddee\ud83c\udde9 印尼 | +121.07% | 微耕机/小型收割机 |
| \ud83c\uddf9\ud83c\udded 泰国 | 中速 | 插秧机/收割机 |

### 神雕机会
- \u2795 乌兹别克/非洲/东南亚三线并进
- \u2795 中国二手农机=欧美新品20-30%价格
- \u2795 RCEP关税优惠+非洲自贸区降低壁垒`,
    detailedContentEn: `## Global Emerging Markets — 3 Regions Surging

### Uzbekistan (+256.77% Fastest Globally)
| Indicator | Value |
|------|------|
| Q1 import growth | **+256.77%** |
| Cotton mechanization | <40% |
| Gov subsidy | 50% |
| Recommend | CLAAS 850/860, NH 100-200HP |

### Africa (Kenya +46.6%)
| Region | Feature | Demand |
|------|------|--------|
| Kenya | +46.6% | 50-100HP tractors |
| Nigeria | Largest arable | Medium tractors |

### SE Asia (Indonesia +121.07%)
| Country | Growth | Models |
|------|------|--------|
| Indonesia | +121.07% | Mini tillers |
| Thailand | Moderate | Transplanters |`,
    detailedContentRu: `## Развивающиеся рынки — 3 региона

### Узбекистан (+256.77%)
| Показатель | Значение |
|------|------|
| Рост Q1 | **+256.77%** |
| Механизация хлопка | <40% |
| Субсидия | 50% |

### Африка (Кения +46.6%)
| Регион | Особенность | Спрос |
|------|------|--------|
| Кения | +46.6% | 50-100 л.с. |

### ЮВА (Индонезия +121.07%)
| Страна | Рост | Модели |
|------|------|--------|
| Индонезия | +121.07% | Мотоблоки |`,
    actionTips: JSON.stringify(["\u4e4c\u5179\u522b\u5148\u4f18\u5148\u63a8CLAAS 850/860\u9752\u50a8\u673a", "\u975e\u6d32\u4e3b\u63a850-100HP\u62d6\u62c9\u673a", "\u4e1c\u5357\u4e9a\u5229\u7528RCEP\u5173\u7a0e\u4f18\u60e0\u51fa\u53e3\u5c0f\u578b\u519c\u673a"]),
    dataSummary: JSON.stringify([{ label: "\u4e4c\u5179\u522b\u5148", value: "+256.77%" }, { label: "\u5370\u5c3c", value: "+121.07%" }, { label: "\u80af\u5c3c\u4e9a", value: "+46.6%" }]),
  },

  // ===== sortOrder=11: 周末操作建议 =====
  {
    icon: "\ud83d\udccb", region: "\u4e2d\u56fd", regionEn: "China", regionRu: "\u041a\u0438\u0442\u0430\u0439",
    tags: JSON.stringify(["\u5468\u672b\u64cd\u4f5c", "\u4e0b\u5468\u51c6\u5907", "10\u5927\u4f18\u5148"]),
    tagsEn: JSON.stringify(["Weekend Plan", "Next Week Prep", "10 Priorities"]),
    tagsRu: JSON.stringify(["\u041f\u043b\u0430\u043d \u0432\u044b\u0445\u043e\u0434\u043d\u044b\u0445", "\u041f\u043e\u0434\u0433\u043e\u0442\u043e\u0432\u043a\u0430 \u043d\u0435\u0434\u0435\u043b\u0438", "10 \u043f\u0440\u0438\u043e\u0440\u0438\u0442\u0435\u0442\u043e\u0432"]),
    text: "\u5468\u672b\u51c6\u5907\u6e05\u5355\uff1a\u53d1\u51fa970/980\u4e3b\u52a8\u62a5\u4ef7\u90ae\u4ef6\u2192FR450\u7206\u6b3e\u63a8\u5e7f\u2192BP1290\u4e1c\u6b27\u63a8\u91cf\u2192\u5468\u4e00\u5173\u6ce8EUR/CNY",
    textEn: "Weekend prep: Send 970/980 inquiry emails \u2192 FR450 push \u2192 BP1290 Eastern Europe \u2192 Monday EUR/CNY watch",
    textRu: "\u041f\u043e\u0434\u0433\u043e\u0442\u043e\u0432\u043a\u0430: \u043f\u0438\u0441\u044c\u043c\u0430 970/980 \u2192 FR450 \u2192 BP1290 \u0412\u043e\u0441\u0442\u043e\u0447\u043d\u0430\u044f \u0415\u0432\u0440\u043e\u043f\u0430 \u2192 EUR/CNY",
    detailedContent: `## 周末操作建议 · 下周行动准备

### 周末准备清单
| # | 任务 | 状态 |
|---|------|------|
| 1 | 汇总本周出口进展（已签约/待签约/待沟通） | \u23f3 |
| 2 | 整理下周收机清单：980(2023-2024,<2000h)、970(2021-2023,<2000h) | \u23f3 |
| 3 | AGRO 2026展前准备：注册线上参展+俄语/乌语资料翻译 | \u23f3 |
| 4 | 980供给分析报告：14条在售逐个对比，筛选最佳3-5条 | \u23f3 |
| 5 | 周末前发出970/980买方询价邮件 | \u23f3 |
| 6 | 更新5国目标市场产品推荐清单 | \u23f3 |

### 下周操作重点
| 优先级 | 操作 | 目标价差率 |
|--------|------|-----------|
| \u26a1\ufe0f 1 | \u5468\u4e00\u5f00\u76d8\u5173\u6ce8EUR/CNY 7.75\u652f\u6491 | — |
| \u26a1\ufe0f 2 | ECB 6\u6708\u4f1a\u8bae\uff08\u82e5\u52a025bp\u2192EUR\u5229\u597d\uff09 | — |
| \u26a1\ufe0f 3 | FR450\u7206\u6b3e\u901f\u63a8\u00b710\u53f0 | 101.4% |
| \u26a1\ufe0f 4 | BP1290\u4e1c\u6b27\u63a8\u91cf | 95.0% |
| \u26a1\ufe0f 5 | 5300RC(2020)\u786e\u8ba4\u8f66\u51b5\u540e\u9501\u5b9a | 331.1% |
| \u26a1\ufe0f 6 | 950(2018)\u65b0\u673a\u4f1a\u00b740.9\u4e07\u5229\u6da6 | 43.1% |
| \u26a1\ufe0f 7 | \u5229\u7528980\u4f9b\u7ed9\u4e95\u55b7\u8bae\u4ef7 | 71.2% |
| \u26a1\ufe0f 8 | BigM 420\u4e1c\u6b27\u63a8\u8fdb | 58.4% |
| \u26a1\ufe0f 9 | 970(2017)\u51fa\u53e3\u7ee7\u7eed | 50.2% |
| \ud83d\udcb0 10 | CIPS\u4eba\u6c11\u5e01\u7ed3\u7b97\u63a8\u8fdb | — |`,
    detailedContentEn: `## Weekend Prep · Next Week Action Plan

### Weekend Checklist
| # | Task | Status |
|---|------|--------|
| 1 | Summarize weekly export progress | \u23f3 |
| 2 | Sort next week acquisition list | \u23f3 |
| 3 | AGRO 2026 prep: online registration + RU/UA translation | \u23f3 |
| 4 | 980 supply analysis: compare 14 listings pick top 3-5 | \u23f3 |
| 5 | Send 970/980 buyer inquiry emails before weekend | \u23f3 |
| 6 | Update 5-country product recommendation list | \u23f3 |

### Next Week Priorities
| Pri | Action | Target Rate |
|-----|--------|-----------|
| 1 | Monday EUR/CNY 7.75 watch | — |
| 2 | ECB June meeting if +25bp | — |
| 3 | FR450 hot seller push 10 units | 101.4% |
| 4 | BP1290 Eastern Europe push | 95.0% |
| 5 | 5300RC(2020) condition check then lock | 331.1% |
| 6 | 950(2018) new opportunity | 43.1% |
| 7 | Use 980 supply surge for pricing | 71.2% |
| 8 | BigM 420 Eastern Europe | 58.4% |
| 9 | 970(2017) export continue | 50.2% |
| 10 | CIPS RMB settlement push | — |`,
    detailedContentRu: `## План выходных · Подготовка к неделе

### План
| # | Задача | Статус |
|---|--------|--------|
| 1 | Сводка экспорта | \u23f3 |
| 2 | Список закупок | \u23f3 |
| 3 | AGRO 2026 | \u23f3 |
| 4 | Анализ 980 | \u23f3 |
| 5 | Запросы 970/980 | \u23f3 |
| 6 | Рекомендации по 5 странам | \u23f3 |

### Приоритеты недели
| Приор | Действие | Цель |
|-------|---------|------|
| 1 | EUR/CNY | — |
| 2 | ECB | — |
| 3 | FR450 | 101.4% |
| 4 | BP1290 | 95.0% |
| 5 | 5300RC | 331.1% |`,
    actionTips: JSON.stringify(["\u5468\u672b\u53d1\u51fa970/980\u4e3b\u52a8\u62a5\u4ef7\u90ae\u4ef6", "\u5468\u4e009:15\u5173\u6ce8\u592e\u884cEUR/CNY\u4e2d\u95f4\u4ef7", "\u4e0b\u5468\u5b8c\u6210980+FR450\u5404\u81f31\u5355\u76ee\u6807"]),
    dataSummary: JSON.stringify([{ label: "\u5468\u672b\u4efb\u52a1", value: "6\u9879" }, { label: "\u4e0b\u5468\u4f18\u5148", value: "10\u9879" }]),
  },
];

async function main() {
  // 先清空旧数据
  await prisma.marketIntel.deleteMany();
  console.log("已清空旧数据");

  // 导入新数据（sortOrder从0开始=5070永久头条）
  for (let i = 0; i < ALL_MARKET_INTEL.length; i++) {
    const item = ALL_MARKET_INTEL[i];
    await prisma.marketIntel.create({
      data: {
        date: TODAY,
        icon: item.icon,
        region: item.region,
        regionEn: item.regionEn || null,
        regionRu: item.regionRu || null,
        tags: item.tags,
        tagsEn: item.tagsEn || null,
        tagsRu: item.tagsRu || null,
        text: item.text,
        textEn: item.textEn || null,
        textRu: item.textRu || null,
        detailedContent: item.detailedContent,
        detailedContentEn: item.detailedContentEn || null,
        detailedContentRu: item.detailedContentRu || null,
        dataSummary: item.dataSummary || null,
        actionTips: item.actionTips || null,
        sortOrder: i,
      },
    });
  }
  console.log(`已导入 ${ALL_MARKET_INTEL.length} 条情报数据 (日期: 2026-06-20)`);
  console.log("  sortOrder=0: 5070小方捆🔥（永久头条）");
  console.log(`  sortOrder=1~${ALL_MARKET_INTEL.length - 1}: 当日市场情报`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
