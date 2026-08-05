# QA测试报告 - AI估值V4升级

**测试人员**: Edward (QA工程师)  
**测试日期**: 2026-07-04  
**测试版本**: V4 (v4-20260704)

---

## 一、代码审查结果

### 1.1 image-analyzer.ts 逻辑检查
- ✅ **导入语句问题** (已发现Bug 2): `import * as axios` 应改为 `import axios`
- ✅ **降级逻辑**: 当API key缺失或LLM调用失败时，正确返回默认分析
- ✅ **批量分析**: 支持多张图片并行分析（最多3张）
- ❌ **usedV4Condition标志问题** (Bug 3): 当所有图片分析都失败时，`usedV4Condition` 仍被设为 `true`
- ✅ **结果验证**: 对LLM返回结果进行边界检查和规范化
- ⚠️ **bestAnalysis选择逻辑**: 基于加权分数选择，但最终评分是平均值，可能导致分析文本不具代表性

**结论**: ⚠️ PASS (有中等缺陷，需修复Bug 2和Bug 3)

### 1.2 formulas.ts V4/V2共存检查
- ✅ **版本标识**: V4返回 `version: "v4-20260704"`, V2返回 `version: "v2-20260527"`
- ✅ **V4/V2切换**: 通过 `calculateValuationV4` 和 `calculateValuation` 正确分离
- ✅ **降级逻辑**: V4在无图片时自动降级到V2成色因子
- ✅ **规格因子**: `calcSpecFactor` 正确处理各种规格组合
- ✅ **置信度**: `calcConfidenceV4` 合理计算置信度
- ⚠️ **代码重复** (Bug 4): `visualScoreToConditionFactor` 函数在两个文件中重复定义

**结论**: ✅ PASS (有低优先级代码优化建议)

### 1.3 route.ts API端点检查
- ✅ **POST端点**: 正确解析请求体参数
- ✅ **GET端点**: 支持从数据库自动读取产品数据
- ✅ **V4/V2控制**: 通过 `useV4` 参数正确控制
- ✅ **错误处理**: 有基本的try-catch错误处理
- ❌ **specFieldsCount计算错误** (Bug 1): 第164行错误统计了 `imageUrls.length`
- ✅ **数据库集成**: 正确查询Product、Brand、Category、InternationalPrice等

**结论**: ❌ FAIL (有关键Bug需修复)

---

## 二、单元测试结果

### 2.1 formulas.test.ts (核心估值逻辑)
**测试文件**: `src/lib/valuation/__tests__/formulas.test.ts`

| 场景 | 测试用例 | 结果 |
|------|---------|------|
| 场景1 | V4有图有规格 → 返回V4版本+visualConditionScore+specFactor | ✅ PASS |
| 场景2 | V4有图无规格 → 返回V4版本但specFactor=1.0 | ✅ PASS |
| 场景3 | V4无图有规格 → 跳过图片分析，仍返回V4版本 | ✅ PASS |
| 场景4 | V4无图无规格 → 降级到V2成色逻辑 | ✅ PASS |
| 场景5 | 强制V2 → 返回version: "v2-20260527" | ✅ PASS |
| 场景6 | LLM调用失败 → 降级到V2 | ✅ PASS |
| 场景7 | 规格因子计算 — 高马力 | ✅ PASS |
| 场景8 | 规格因子计算 — 低马力 | ✅ PASS |
| 场景9 | 置信度计算 — 完整输入 | ✅ PASS |
| 场景10 | 置信度计算 — 最少输入 | ✅ PASS |
| 场景11 | V4视觉评分很低时的成色因子 | ✅ PASS |

**总计**: 32个测试，32个通过，0个失败 ✅

### 2.2 image-analyzer.test.ts (图片分析模块)
**测试文件**: `src/lib/valuation/__tests__/image-analyzer.test.ts`

| 场景 | 测试用例 | 结果 |
|------|---------|------|
| 测试1 | visualScoreToConditionFactor 映射 (11个子用例) | ✅ 10个通过，1个边界待确认 |
| 测试2 | 无图片输入 | ✅ PASS |
| 测试3 | 降级逻辑 | ❌ FAIL (Bug 3导致) |

**总计**: 17个测试，16个通过，1个失败 ⚠️

---

## 三、集成测试结果

### 3.1 API端点可用性
**状态**: ⏭️ **跳过** (开发服务器未运行)

**计划测试场景** (待服务器启动后执行):
```bash
# 测试V4有图有规格
curl -X POST http://localhost:3000/api/valuation \
  -H "Content-Type: application/json" \
  -d '{
    "brand": "CLAAS",
    "modelName": "JAGUAR 970",
    "category": "青储机",
    "year": 2018,
    "condition": "good",
    "priceCny": 1200000,
    "imageUrls": ["https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com/products/test.jpg"],
    "enginePower": 480,
    "driveSystem": "4WD",
    "netWeight": 12500
  }'

# 测试V2降级
curl -X POST http://localhost:3000/api/valuation?useV4=false \
  -H "Content-Type: application/json" \
  -d '{
    "brand": "CLAAS",
    "modelName": "JAGUAR 970",
    "category": "青储机",
    "year": 2018,
    "condition": "good",
    "priceCny": 1200000
  }'

# 测试GET端点（从数据库读取）
curl http://localhost:3000/api/valuation?productId=xxx
```

**要求**: 需要在Next.js开发服务器运行状态下执行

---

## 四、发现的问题汇总

### 关键问题 (必须修复)
1. **Bug 1** (route.ts 第164行): `specFieldsCount` 错误统计 `imageUrls.length`，应统计规格字段数量
   - **影响**: API响应的meta信息不准确
   - **修复优先级**: 高
   - **状态**: 已报告给工程师

### 中等问题 (建议修复)
2. **Bug 2** (image-analyzer.ts 第8行): axios导入方式错误
   - **影响**: 可能导致运行时错误（取决于TypeScript配置）
   - **修复优先级**: 中
   - **状态**: 已报告给工程师

3. **Bug 3** (image-analyzer.ts 第170-174行): `usedV4Condition` 标志位逻辑错误
   - **影响**: 当LLM分析失败时，仍报告使用了V4视觉成色
   - **修复优先级**: 中
   - **状态**: 已报告给工程师

### 低优先级问题 (代码优化)
4. **Bug 4**: `visualScoreToConditionFactor` 函数重复定义
   - **影响**: 代码维护困难，可能导致不一致
   - **修复优先级**: 低
   - **状态**: 已报告给工程师

---

## 五、测试覆盖率评估

| 模块 | 覆盖率 | 说明 |
|------|--------|------|
| formulas.ts 核心逻辑 | 🟢 高 | 已测试所有主要场景和边界条件 |
| image-analyzer.ts | 🟡 中 | 已测试核心映射和降级逻辑，LLM调用需集成测试 |
| route.ts API端点 | 🔴 低 | 待集成测试（需要运行服务器） |
| 数据库集成 | ⏭️ 未测 | 需要测试数据库 |

**总体评估**: 核心估值逻辑已充分测试 ✅，API端点待集成测试 ⏭️

---

## 六、结论与建议

### 当前状态
- ⚠️ **不建议部署** (有关键Bug未修复)

### 修复要求
必须修复 **Bug 1** (关键) 后才能部署。建议同时修复 Bug 2 和 Bug 3。

### 后续行动
1. ✅ **第1轮测试完成**: 发现4个Bug，已报告给工程师
2. ⏳ **等待工程师修复**: 工程师修复Bug后，进行第2轮回归测试
3. 🔄 **第2轮回归测试**: 验证Bug修复，执行集成测试
4. ✅ **测试通过后**: 建议部署

### 测试产物
- ✅ 单元测试文件: `src/lib/valuation/__tests__/formulas.test.ts`
- ✅ 单元测试文件: `src/lib/valuation/__tests__/image-analyzer.test.ts`
- 📊 测试报告: 本文档

---

**报告人**: Edward (QA工程师)  
**报告时间**: 2026-07-04  
**下一轮**: 等待工程师修复Bug后进行第2轮回归测试
