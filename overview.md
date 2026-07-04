# 立即执行阶段 — 交付概览

> 执行日期：2026-07-04
> 对应方案：final-master-plan.md 第四部分「立即执行（第1周）」

---

## TL;DR

完成4项立即执行任务：文案修改、导航重构、封面图修复、产品卡片增强。`next build` 0错误，已commit+push触发Vercel部署。

## 交付概览

| 指标 | 值 |
|------|-----|
| 交付状态 | ✅ 代码完成，push进行中 |
| Build | 0错误 |
| 涉及文件 | 19个 |
| 平台 | 网站 + 小程序 |

## 修改清单

### 1. 小程序文案修改 ✅
- `app.json` tabBar: "找农机"→"买农机", "发布"→"卖农机"
- `app.json` navigationBarTitleText: "神雕农机"→"神雕农机全球交易"
- `index.js` 分享标题同步更新

### 2. 网站i18n文案修改 ✅（8语言）
- `zh.json` heroTitle: "神雕农机全球交易", heroSubtitle: "智能估价 · 跨境物流 · 安全交易"
- `en.json` heroTitle: "Shendiao Farm Machinery Global Trading"
- `ru/es/fr/ar/hi/pt.json` 同步17个新nav keys
- 新增nav keys: buyMachinery, sellMachinery, marketInsights, serviceSupport, browseEquipment, publishProduct, publishGuide, sellerCenter, buyerRequest, dailyReport, arbitrageAnalysis, industryReport, inspectionService, parts, contactUs

### 3. 网站导航重构 ✅
- `navigation.ts` 重构为5个主菜单+下拉子菜单：
  - 首页 | 买农机▼ | 卖农机▼ | 市场洞察▼ | 服务支持▼ | 关于我们
- 英文导航同步重构：HOME | BUY▼ | SELL▼ | INSIGHTS▼ | SERVICES▼ | ABOUT
- navbar.tsx 无需修改（已支持children下拉）

### 4. 封面图修复 ✅
- `mock.js` 8条mock数据全部补上coverUrl（Unsplash农机图）
- `index.js` loadHomeData新增sortByName函数：无图产品排到末尾

### 5. 产品卡片增强 ✅
- **网站** `product-card.tsx`：
  - 无图占位：品牌首字母+提示文字
  - 状态标签：有视频(蓝)/可出口(绿)/进口(紫)
  - 卖家信息：公司名+国家
- **小程序** `machine-card.wxml/wxss`：
  - 状态标签：🎬视频/🚢可出口/✅进口
  - 卖家信息行

## 文件清单

| 文件 | 改动类型 |
|------|---------|
| `shendiao-miniprogram/app.json` | 修改 |
| `shendiao-miniprogram/pages/index/index.js` | 修改 |
| `shendiao-miniprogram/utils/mock.js` | 修改 |
| `shendiao-miniprogram/components/machine-card/machine-card.wxml` | 修改 |
| `shendiao-miniprogram/components/machine-card/machine-card.wxss` | 修改 |
| `messages/zh.json` | 修改 |
| `messages/en.json` | 修改 |
| `messages/ru.json` | 修改 |
| `messages/es.json` | 修改 |
| `messages/fr.json` | 修改 |
| `messages/ar.json` | 修改 |
| `messages/hi.json` | 修改 |
| `messages/pt.json` | 修改 |
| `src/config/navigation.ts` | 重写 |
| `src/components/product/product-card.tsx` | 修改 |

## 下一步

1. 等待Vercel部署完成，线上验证导航和文案
2. 小程序需在微信开发者工具中重新编译验证
3. 进入第一阶段：买家需求匹配API + 一机一码系统
