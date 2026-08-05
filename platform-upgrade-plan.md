# 神雕农机平台融合升级方案
## — 对标座谈会建设方案，在现有系统基础上实现行业公共服务平台能力

> 制定日期：2026-07-04
> 基础：方案A完善版（已上线）+ RB Global/tractorpool对标方案（已制定）
> 参考文件：二手农机平台座谈会_会议纪要与建设方案（2026-06-25 石家庄）
> 核心原则：**保持既有功能不变，增量叠加公共服务平台能力**

---

## 一、现状盘点 vs 座谈会方案：9大模块对标

### 模块映射总览

| 座谈会模块 | 名称 | 神雕现有能力 | 差距 | 建设优先级 |
|-----------|------|-------------|------|-----------|
| **M1** | 身份溯源系统 | ❌ 无 | 一机一码、全生命周期档案、政府数据对接 | 一期 |
| **M2** | 智能评估与定价 | ✅ AI估值V4（图片+视频因子） | 缺人工评估师复核、缺认证定价 | 一期 |
| **M3** | 线上交易撮合 | ⚠️ 有产品发布+询价 | 缺担保交易、电子合同、交易评价 | 一期 |
| **M4** | 线下服务网络 | ❌ 无 | 省级服务中心目录、检测预约、整备翻新 | 一期 |
| **M5** | 金融保险服务 | ❌ 无（有抵押借款经验） | 贷款申请、保险、以租代购 | 二期 |
| **M6** | 标准与认证体系 | ⚠️ 有基础卖家认证 | 缺三重认证（机构+人员+车辆） | 一期 |
| **M7** | 售后维保平台 | ❌ 无 | 认证维修网点、质保服务 | 二期 |
| **M8** | 国际流通通道 | ✅ 8语言网站+港口匹配+策略API | 缺海外仓、报关协助 | 二期（基础已有） |
| **M9** | 行业大数据中心 | ⚠️ 有日报+情报系统 | 缺价格指数、可视化看板、政府决策支持 | 三期 |

### 神雕已建成可复用的5大系统（座谈会确认）

| 系统名称 | 现状 | 在9大模块中的角色 |
|---------|------|-----------------|
| 跨境交易平台 | ✅ 8语言、SEO友好 | M8国际通道的核心实现 |
| AI估值系统 | ✅ V4版本、图片+视频因子 | M2智能评估的核心引擎 |
| 市场情报系统 | ✅ 每日自动生成 | M9大数据中心的数据源 |
| 交易小程序 | ✅ 微信生态、OSS直传 | M3交易撮合的移动端 |
| SEO运营体系 | ✅ 多语言内容矩阵 | M8国际流量获取 |

---

## 二、增量建设方案（保持既有功能不变）

### Phase A：基础平台能力补齐（0-3个月）— 对应座谈会一期

#### A1. 一机一码身份溯源系统（M1）

**目标**：每台上架农机生成唯一二维码，扫码可查全生命周期档案

**数据库新增**：
```prisma
model MachineryIdentity {
  id              String   @id @default(cuid())
  productID       String   @unique  // 关联Product
  qrCode          String   @unique  // 一机一码
  serialNumber    String?  // 出厂编号
  manufactureDate DateTime? // 出厂日期
  factoryCert     String?  // 出厂合格证URL
  
  // 全生命周期事件
  events          MachineryEvent[]
  
  // 政府数据对接（预留）
  govRegistryId   String?  // 农机监理登记编号
  govVerified     Boolean  @default(false)
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model MachineryEvent {
  id          String   @id @default(cuid())
  identityId  String
  eventType   String   // manufactured, registered, listed, inspected, traded, repaired, exported, scrapped
  eventDate   DateTime
  description String?
  operator    String?  // 操作方（用户ID/机构名）
  documents   String?  // JSON: 文件URL列表
  location    String?  // 发生地点
  
  identity    MachineryIdentity @relation(fields: [identityId], references: [id])
  
  @@index([identityId, eventDate])
}
```

**API路由**：
- `GET /api/machinery/[qrCode]` — 扫码查询农机档案
- `POST /api/machinery/identity` — 产品上架时自动生成一机一码
- `POST /api/machinery/event` — 添加生命周期事件（检测/交易/维修）

**前端展示**：
- 产品详情页增加"农机档案"标签页
- 产品卡片增加一机一码图标
- 小程序详情页增加扫码验真入口

**技术要点**：
- QR码生成：使用 `qrcode` npm包，编码内容为 `{siteUrl}/verify/{qrCode}`
- 产品发布时自动创建 MachineryIdentity 记录
- 生命周期事件由系统自动记录（上架→检测→交易→出口）

---

#### A2. 交易闭环增强（M3）

**目标**：从"信息发布"升级到"交易撮合+担保交易"

**座谈会核心启示**：
- 金色大田教训：不能阻止逃单，要用价值留下用户
- 晋州会长方案：全款交平台→验车→放款
- 严总提出：线上支付超5万限制问题

**方案设计（分期实现）**：

**A2.1 询价→沟通→线下交易（立即可做）**
- 产品详情页"询价"按钮 → 询价表单（姓名+电话+留言）
- 卖家中心增加"询价管理"页面
- 询价记录保存到Inquiry表（已有）
- 双方可在线沟通（复用已有ChatSession）

**A2.2 担保交易流程（需支付接口）**
```
买家下单 → 全款打入平台担保账户 → 卖家发货/买家验车 
  → 买家确认 → 平台放款给卖家
  → 如有争议 → 平台介入仲裁
```

**数据库新增**：
```prisma
model Transaction {
  id            String   @id @default(cuid())
  productId     String
  buyerId       String
  sellerId      String
  amount        Float    // 交易金额
  status        String   @default("pending") 
  // pending, escrow_deposit, shipped, inspecting, completed, disputed, cancelled
  escrowId      String?  // 第三方担保交易单号
  
  // 时间线
  createdAt     DateTime @default(now())
  depositAt     DateTime?
  shippedAt     DateTime?
  confirmedAt   DateTime?
  completedAt   DateTime?
  
  // 评价
  buyerRating   Int?     // 1-5
  sellerRating  Int?
  buyerComment  String?
  sellerComment String?
  
  // 电子合同
  contractUrl   String?  // 合同PDF URL
  contractSignedAt DateTime?
}
```

**API路由**：
- `POST /api/transaction/create` — 创建交易
- `POST /api/transaction/[id]/deposit` — 买家打款（对接支付）
- `POST /api/transaction/[id]/confirm` — 买家确认收货
- `POST /api/transaction/[id]/dispute` — 发起争议
- `GET /api/transaction/[id]` — 查看交易状态
- `GET /api/transactions/my` — 我的交易列表

**小程序端**：
- "我的"页面增加"我的交易"入口
- 交易状态实时推送（微信订阅消息）

**支付方案**（绕过5万限制）：
- 小程序内：引导线下转账 + 平台担保确认
- 网站端：对接Stripe/PayPal国际支付 + 微信/支付宝国内
- 大额交易：生成电子合同 → 线下对公转账 → 平台确认到账

---

#### A3. 三重认证体系（M6）

**目标**：机构认证 + 人员认证 + 车辆认证

**数据库新增**：
```prisma
model Certification {
  id              String   @id @default(cuid())
  type            String   // institution, assessor, vehicle
  applicantId     String   // 申请者用户ID
  status          String   @default("pending") // pending, approved, rejected, expired
  
  // 机构认证
  companyName     String?
  businessLicense String?  // 营业执照URL
  legalPerson     String?
  registeredCapital Float?
  
  // 人员认证（评估师）
  assessorName    String?
  assessorCertNo  String?  // 评估师证书编号
  assessorOrg     String?  // 发证机构
  
  // 车辆认证
  productId       String?
  inspectionReport String? // 检测报告URL
  inspectionScore Float?   // 检测评分
  inspectionDate  DateTime?
  inspectorId     String?  // 检测员ID
  
  // 有效期
  validFrom       DateTime?
  validUntil      DateTime?
  
  createdAt       DateTime @default(now())
  reviewedAt      DateTime?
  reviewedBy      String?
}
```

**展示逻辑**：
- 卖家详情页显示认证标识：🏪 实名认证 | 📋 营业执照 | 🔧 认证维修
- 产品卡片显示认证标签：✅ 已检验 | 🏷️ 认证车
- 评估师在个人中心可上传证书，审核通过后显示"注册评估师"标识

---

#### A4. 线下服务网络目录（M4）

**目标**：展示省级服务中心和县域服务网点，支持检测预约

**数据库新增**：
```prisma
model ServiceCenter {
  id          String   @id @default(cuid())
  name        String   // 服务中心名称
  level       String   // provincial, county, city
  province    String
  city        String?
  address     String
  phone       String?
  services    String   // JSON: ["检测评估", "整备翻新", "过户代办", "验机交割"]
  coverImage  String?
  description String?
  isActive    Boolean  @default(true)
  lat         Float?
  lng         Float?
  createdAt   DateTime @default(now())
}
```

**API路由**：
- `GET /api/service-centers` — 服务网点列表（按省份筛选）
- `POST /api/service-centers/[id]/booking` — 预约检测

**前端**：
- 网站新增 `/service-network` 页面
- 小程序"首页"增加"附近服务网点"入口
- 产品详情页增加"预约线下检测"按钮

---

#### A5. 标准规范展示页

**目标**：展示行业标准、检测规范、认证流程

**内容**（静态页面，无数据库依赖）：
- `/standards` — 标准规范页
  - 已发布：二手农机流通服务规范（团体标准）
  - 制定中：拖拉机/收割机检测标准、评估标准
  - 规划中：认证体系标准
- `/certification-guide` — 认证指南
  - 机构认证流程
  - 评估师认证流程
  - 车辆认证流程

---

### Phase B：生态扩展能力（3-9个月）— 对应座谈会二期

#### B1. 金融保险服务接入（M5）

**目标**：对接银行/保险机构，提供农机抵押贷款、交易保险

**方案**：
- 金融产品展示页（静态+动态）
- 贷款申请表单 → 转交合作银行
- 保险投保入口 → 对接保险机构
- 神雕已有农机抵押借款实操经验，可复用

**数据库新增**：
```prisma
model FinancialService {
  id          String   @id @default(cuid())
  type        String   // loan, insurance, lease
  provider    String   // 银行/保险机构名
  productName String   // 产品名称
  rate        Float?   // 利率/费率
  maxAmount   Float?   // 最高额度
  description String?
  requirements String? // JSON: 申请条件
  isActive    Boolean  @default(true)
}

model LoanApplication {
  id          String   @id @default(cuid())
  userId      String
  productId   String?  // 关联农机（抵押贷款）
  loanType    String   // mortgage, installment, lease
  amount      Float
  period      Int?     // 期限（月）
  status      String   @default("pending")
  // pending, submitted, approved, rejected, disbursed
  notes       String?
  createdAt   DateTime @default(now())
}
```

---

#### B2. 售后维保平台（M7）

**目标**：认证维修网点、短期质保、原厂配件对接

**方案**：
- 维修网点目录（复用ServiceCenter模型，services增加"维修保养"）
- 质保服务：交易完成后可购买3-6个月核心部件质保
- 配件专区：新增配件分类，支持按机型反查

---

#### B3. 国际通道增强（M8）

**已有能力**：8语言网站、港口自动匹配、销售策略API、日报情报

**需增强**：
- 海外仓信息展示（静态页面）
- 报关流程指引
- 一带一路国别专区页
- 多货币价格切换（小程序）

---

### Phase C：数据驱动能力（9-18个月）— 对应座谈会三期

#### C1. 行业大数据中心（M9）

**目标**：价格指数发布、可视化看板、政府决策支持

**已有基础**：日报系统、市场情报、套利分析

**需增强**：
- 价格指数计算引擎（按品类/品牌/区域）
- 可视化看板页面（ECharts/D3.js）
- 行业报告自动生成（月度/季度）
- API开放给政府/研究机构

---

## 三、与既有方案的融合关系

### 保留不变的既有功能

| 系统 | 功能 | 状态 |
|------|------|------|
| AI估值V4 | 图片识别+视频因子+销售策略 | ✅ 已上线 |
| 港口匹配 | 27省份→最近港口 | ✅ 已上线 |
| 日报系统 | 跨境套利日报+情报 | ✅ 运行中 |
| 小程序 | 8张定向照片+autoAI+市场参考 | ✅ 已上线 |
| SEO体系 | 8语言内容矩阵 | ✅ 运行中 |
| 多语言客服 | ChatSession+ChatMessage | ✅ 已上线 |

### RB Global/tractorpool方案映射

| 既有改进项 | 对应座谈会模块 | 融合策略 |
|-----------|--------------|---------|
| 导航重构+卖农机入口 | M3交易撮合 | 导航增加"服务网点""标准认证"入口 |
| 产品卡片增强 | M6认证体系 | 卡片增加认证标签+一机一码图标 |
| 买家需求匹配 | M3交易撮合 | 保留，作为交易撮合的前端入口 |
| 设备检验报告 | M6认证体系 | 升级为"车辆认证"的检测报告 |
| 询价流程 | M3交易撮合 | 保留，作为交易闭环第一步 |
| 卖家信任体系 | M6认证体系 | 升级为三重认证展示 |
| 推送通知 | M3交易撮合 | 保留，增加交易状态推送 |
| 多货币展示 | M8国际通道 | 保留 |
| 数据洞察中心 | M9大数据中心 | 保留，升级为行业大数据中心 |
| 数字合同 | M3交易撮合 | 保留，纳入交易闭环 |

---

## 四、技术架构设计

### 系统架构图

```
┌─────────────────────────────────────────────────────────┐
│                    用户层（前端）                         │
├──────────┬──────────┬──────────┬──────────┬──────────────┤
│  网站端   │  小程序   │  海外站   │  管理后台  │  开放API    │
│  (Next.js)│(WeChat MP)│(多语言)  │ (Admin)  │ (REST/GraphQL)│
├──────────┴──────────┴──────────┴──────────┴──────────────┤
│                   API网关层 (Next.js API Routes)          │
├────────────┬───────────┬───────────┬──────────────────────┤
│  交易服务   │  认证服务  │  溯源服务  │  金融服务            │
│  /api/txn  │/api/cert  │/api/mach  │  /api/finance        │
├────────────┴───────────┴───────────┴──────────────────────┤
│                   数据层 (PostgreSQL + Prisma)            │
├──────────┬──────────┬──────────┬──────────┬───────────────┤
│ Product  │Transaction│Cert      │Machinery │ ServiceCenter │
│(已有)    │(新增)    │(新增)    │Identity  │(新增)         │
│          │          │          │(新增)    │               │
├──────────┴──────────┴──────────┴──────────┴───────────────┤
│              已有数据层（保持不变）                         │
│  Valuation│MarketIntel│Article│ExchangeRate│ArbitrageCache│
├───────────────────────────────────────────────────────────┤
│              外部对接层                                    │
│  政府农机数据库 │ 银行/保险 │ 检测机构 │ 物流商 │ 海外仓    │
└───────────────────────────────────────────────────────────┘
```

### 数据库迁移计划

**Migration 1**（Phase A）：
- 新增 `MachineryIdentity` + `MachineryEvent` 表
- 新增 `Transaction` 表
- 新增 `Certification` 表
- 新增 `ServiceCenter` 表

**Migration 2**（Phase B）：
- 新增 `FinancialService` + `LoanApplication` 表
- `ServiceCenter` 表增加维修网点字段

**Migration 3**（Phase C）：
- 新增 `PriceIndex` 表
- 新增 `IndustryReport` 表

---

## 五、分阶段实施路线图

### 第一阶段：夯基垒台（0-3个月）— 立即可启动

| 序号 | 任务 | 对应模块 | 依赖 | 工作量 |
|------|------|---------|------|--------|
| 1 | 文案修改+导航重构 | - | 无 | 2h |
| 2 | 一机一码系统 | M1 | Prisma migration | 3天 |
| 3 | 产品卡片增强（认证标签+溯源图标） | M6 | #2 | 1天 |
| 4 | 询价流程闭环 | M3 | 已有Inquiry表 | 2天 |
| 5 | 三重认证数据模型+申请页面 | M6 | Prisma migration | 3天 |
| 6 | 线下服务网络目录页 | M4 | Prisma migration | 2天 |
| 7 | 标准规范展示页 | M6 | 无（静态页） | 1天 |
| 8 | 交易数据模型+基础流程 | M3 | Prisma migration | 3天 |
| 9 | 小程序同步改造 | M1/M3/M4/M6 | #2-#8 | 3天 |
| 10 | 担保交易流程（基础版） | M3 | #8 + 支付接口 | 5天 |

### 第二阶段：扩面上量（3-9个月）

| 序号 | 任务 | 对应模块 |
|------|------|---------|
| 11 | 金融产品展示+贷款申请 | M5 |
| 12 | 售后维保网点接入 | M7 |
| 13 | 海外仓信息展示 | M8 |
| 14 | 报关流程指引 | M8 |
| 15 | 多货币价格切换（小程序） | M8 |
| 16 | 电子合同签署 | M3 |
| 17 | 交易评价体系 | M3 |
| 18 | 推送通知体系 | M3 |

### 第三阶段：生态成型（9-18个月）

| 序号 | 任务 | 对应模块 |
|------|------|---------|
| 19 | 价格指数计算引擎 | M9 |
| 20 | 可视化数据看板 | M9 |
| 21 | 行业报告自动生成 | M9 |
| 22 | 开放API（给政府/研究机构） | M9 |
| 23 | 政府农机数据对接 | M1 |
| 24 | 区块链溯源（可选） | M1 |

---

## 六、商业模式落地

### 收入来源（对应座谈会方案）

| 收入来源 | 模式 | 启动时机 | 技术依赖 |
|---------|------|---------|---------|
| 交易服务费 | 成交价1-3%佣金 | 担保交易上线后 | Transaction表+支付接口 |
| 认证检测费 | 车辆认证标识费+检测报告费 | 三重认证上线后 | Certification表+检测流程 |
| 金融服务分润 | 贷款推荐费+保险代理佣金 | 金融模块上线后 | FinancialService表 |
| 增值服务 | 广告位+优先展示+数据报告 | 平台流量起来后 | 现有广告位+新数据报告 |
| 国际业务 | 跨境撮合佣金+报关协助费 | 海外仓+报关上线后 | 现有国际站+新模块 |
| 数据服务 | 行业报告+价格指数 | 大数据中心上线后 | PriceIndex+IndustryReport |

### 定价原则（座谈会铁律）

> 平台可以盈利但不可暴利。平台赚的是"效率提升节省出来的钱"，而非"信息不对称多出来的钱"。

---

## 七、风险对策（对应座谈会风险表）

| 风险 | 对策 | 技术实现 |
|------|------|---------|
| 逃单 | 不阻止，用价值留下用户 | 担保交易+检测+质保+金融全链条服务 |
| 标准执行难 | 先做能查到档案的 | 一机一码+政府数据对接 |
| 主机厂数据壁垒 | 先国产品牌再外资 | 开放API预留数据接入层 |
| 大额支付限制 | 线下转账+平台担保确认 | Transaction表支持多种支付状态 |
| 用户增长缓慢 | 抖音快手低成本获客 | SEO体系+小程序分享+订阅消息推送 |

---

## 八、与座谈会"1+1+1+N"架构的对齐

| 角色 | 神雕平台对应能力 | 技术实现 |
|------|----------------|---------|
| 政府（第一个"1"） | 预留政府数据接口、监管看板 | 开放API+数据导出 |
| 协会（第二个"1"） | 标准展示页、认证管理后台 | Certification管理+标准页 |
| 平台企业（第三个"1"） | 神雕农机作为运营主体 | 全套系统 |
| 多元参与方（"N"） | 卖家/检测机构/金融/维修/主机厂 | 多角色User系统+ServiceCenter |

### 开放API设计（面向"N"方接入）

```
GET  /api/open/products          — 产品列表（给经销商/平台接入）
GET  /api/open/products/[id]     — 产品详情
GET  /api/open/valuation          — 估值查询（给检测机构/金融）
GET  /api/open/market-index       — 价格指数（给政府/研究机构）
POST /api/open/certification      — 认证申请（给检测机构）
GET  /api/open/service-centers    — 服务网点（给地方政府）
```

API鉴权：API Key + 请求频率限制

---

## 九、立即行动建议

### 可以立即开始的（不需要外部依赖）

1. **文案修改+导航重构** — 2小时
2. **一机一码系统** — 3天（Prisma migration + API + 前端展示）
3. **询价流程闭环** — 2天（已有Inquiry表，补全前端）
4. **三重认证数据模型** — 3天（Prisma migration + 申请页面）
5. **线下服务网络目录** — 2天（静态数据起步）
6. **标准规范展示页** — 1天（静态页面）

### 需要外部对接的（可并行准备）

7. **担保交易** — 需要选择支付服务商
8. **金融保险** — 需要银行/保险合作
9. **政府数据对接** — 需要农业部门授权
10. **检测机构接入** — 需要检测机构合作

---

*本方案为活文档，随座谈会后续进展和运营数据持续迭代。*
*核心设计理念：平台不是给国内用户用的，是给全世界买家用的。*
