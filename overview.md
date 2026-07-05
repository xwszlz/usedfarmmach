# 产品发布表单重构 — 交付概览

## TL;DR
网站和小程序产品发布页统一重构为6步流程：图片先行(12张) → 视频 → 智能识别+估值 → 确认参数 → 估值报告 → 发布。

## 改动文件清单

### 网站（Next.js）— commit `66da2b5`，已推送
| 文件 | 改动 |
|------|------|
| `src/app/[locale]/seller/products/new/page.tsx` | 完全重写为6步垂直流程 |
| `src/components/seller/ai-assistant.tsx` | 重构：接收imageFiles prop，新增智能选图+并行估值 |

### 小程序（微信）— commit `5ff871b`，本地提交
| 文件 | 改动 |
|------|------|
| `pages/publish/publish.wxml` | 完全重写为6步流程 |
| `pages/publish/publish.js` | 新增智能识别+估值+表单填充逻辑 |
| `pages/publish/publish.wxss` | 新增步骤指示器/智能识别区/估值卡片/AI高亮样式 |

## 新6步流程

```
Step 1: 上传图片（12张自由上传，拍摄建议标签但不强制）
         ↓ 建议拍摄：整机全貌、铭牌、驾驶室、发动机舱...
Step 2: 上传视频（可选，有视频估值更准）
         ↓
Step 3: 智能识别（手动点击 → 压缩选6张 → AI识别 → 并行估值）
         ↓ 识别结果展示 + "一键填充到表单"按钮
Step 4: 确认参数（AI填充字段绿色高亮，用户可修改）
         ├─ 基本信息：品牌、品类、型号、年份、成色
         ├─ 核心参数：马力、发动机、驱动、重量、配置
         ├─ 外形尺寸：长宽高
         ├─ 贸易信息：价格模式、贸易条款、港口
         └─ 补充描述
Step 5: 估值报告 + 销售建议
         ├─ AI估值：最低/参考/最高三档价格 + 报价合理性提示
         └─ 市场参考：同品类均价、国际报价、汇率出口
Step 6: 发布（消耗1积分）
```

## 关键技术点

1. **智能选图**：12张中取首+末+中间均匀采样=6张，压缩到800px/JPEG 0.6，payload<3.5MB
2. **小程序识别**：wx.compressImage → readFile(base64) → data URI → POST recognize API
3. **并行估值**：识别完成后立即用参数调 /api/valuation（skipImageAnalysis=true）
4. **AI填充高亮**：网站用绿色边框+背景，小程序用 .ai-filled class
5. **小程序不体现"AI"**：UI文案用"智能识别"/"智能填充"

## 构建
- next build: 0 errors
- 网站已推送 GitHub，Vercel 自动部署中
- 小程序已本地提交（无远程仓库配置）
