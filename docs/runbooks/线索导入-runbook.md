# 线索导入 Runbook · 78 户经销商（Round-1）

面向**执行导入的人**（老板 / 运营）。照本手册六步走完即可，每一步都写清了「怎么做」和「怎么验证」。

- 数据源：`82户经销商联系表-外发版-2026-10-13.xlsx`（78 行）
- 产物：`境内-2026-10-13.csv`（58）／`境外-2026-10-13.csv`（18）／`待核-2026-10-13.csv`（2）
- 代码分支：`feat/leads-etl-t01`

---

## 🔴 第 0 步（最关键，跳过则后面全白做）：先合并分支并部署到 `.cn`

**必须先合并 `feat/leads-etl-t01` 并部署到 `.cn`，然后才能导入。**

### 为什么

`src/lib/raw-listing/import-leads.ts` 在修复前是这样写的：

```ts
notes: `[import] ${source} by ${actorId}`,   // 整体覆盖，完全不读 CSV 的「备注」列
```

也就是说：**在旧代码下，CSV 里「备注」列写什么都会被丢掉**。而备注承载着这些信息：

| 标记 | 丢了会怎样 |
|---|---|
| `[同号·关联：XXX]` | 外呼员不知道同号的另一户是谁 ⇒ **重复拨打**（U7-B 方案直接失效） |
| `[电话占位]` | 外呼员会去拨「平台联系」「拍卖页联系」这类**占位假号**（实测 4 条） |
| `[自家·禁外呼]` | 电话打到**自家主体**（实测 2 条） |
| `[品牌兜底]` | 品牌是兜底猜的，事后无法回溯数据质量 |
| `[性质]` `[机型组]` `[补全]` | Round-1 唯一的结构化分类信息全部消失 |

分支 `feat/leads-etl-t01` 已把这里改成拼接 `row.notes`，**只有部署上去之后备注才会真正落库**。

### 怎么做

```bash
git checkout main && git pull
git merge --no-ff feat/leads-etl-t01      # 或经 PR 合并
# 然后按现有发布流程部署到 .cn（ECS 101.200.125.199）
```

### 怎么验证（**不要跳过**）

**先用 1 条测试数据验，确认备注保住了再导全量。**

1. 造一个只有 1 行的 CSV（列名照 `templates/线索导入模板.csv`），备注列填一个明显串，例如：
   ```
   品牌,机型,地区,卖家,电话,邮箱,来源链接,备注,归属
   claas,AXION 850,北京,测试商户(勿外呼),010-00000000,,https://example.com,[电话占位]·部署自检,cn
   ```
2. 走 `/admin/leads/import` 上传，确认导入成功。
3. 在 `.cn` 库里查这一行：
   ```sql
   SELECT id, "brandName", "sellerName", notes
   FROM "RawListing"
   WHERE "sellerName" = '测试商户(勿外呼)';
   ```
4. **判定标准**：
   - ✅ `notes` 里**同时**含 `[import] manual_dealer by ...` **和** `[电话占位]·部署自检` ⇒ 新代码已生效，**可以继续导全量**。
   - ❌ `notes` 只有 `[import] ...` 一句、你填的备注不见了 ⇒ **新代码没生效，立刻停止**，回去检查部署，不要导全量。
5. 验证通过后删掉这条测试数据（避免污染线索池）：
   ```sql
   DELETE FROM "RawListing" WHERE "sellerName" = '测试商户(勿外呼)';
   ```

---

## 第 1 步：境内 58 户导入 `.cn`

1. 打开 `.cn` 站 `/admin/leads/import`
2. 上传 `境内-2026-10-13.csv`
3. 列映射确认（CSV 表头已对齐 `HEADER_RULES`，应自动识别）：

   | CSV 列 | 落到字段 |
   |---|---|
   | 品牌 | `brandName` |
   | 机型 | `modelName` |
   | 地区 | `location` |
   | 卖家 | `sellerName` |
   | 电话 | `sellerPhone` |
   | 邮箱 | `sellerEmail` |
   | 来源链接 | `sourceUrl` |
   | 备注 | `notes` |
   | 归属 | `goodsRegion` |

4. ⚠️ **必须确认「归属」列被识别为 `goodsRegion`**。若这一列没映射上，`manual_` 前缀的行会被判成 `unknown` ⇒ **不入库**，会出现「返回 success 但一行没进」的静默 0 入库。
5. 执行导入，期望：`imported=58, skipped=0, errors=0`

### 验证

```sql
SELECT count(*) FROM "RawListing" WHERE source='manual_dealer';                 -- 期望 58
SELECT count(*) FROM "RawListing" WHERE source='manual_dealer' AND notes IS NOT NULL
                                    AND notes LIKE '%[性质]%';                    -- 期望 58
```

第二条**必须等于 58** —— 它就是第 0 步「备注真的落库了」的验收点。

---

## 第 2 步：境外 18 户对账（不重导）

境外 18 户**已经在 `.com`（Neon）库里**，本次不是重新导入，而是补字段对账：

```bash
NEON_DATABASE_URL=postgresql://... npx tsx scripts/leads/reconcile-intl.ts
```

产出四清单，按是否参与 `contentHash` 分类：

| 清单 | 处置 |
|---|---|
| 已存在（一致） | 无需动作 |
| **可直接补** | 只差 `sellerEmail`/`sellerWechat`/`sellerWhatsapp` —— 这三个**不参与 contentHash**，现有 `PATCH /api/admin/leads/[id]` 直接可用，**补了也不影响幂等** |
| **需 T04 扩展** | 差参与 hash 的字段（尤其 `sellerPhone`）—— 现有只有 GET+PATCH、无 PUT，且 PATCH 白名单不含这些字段。**扩展时必须同一事务重算 `contentHash`**，否则下次重导会当成新行产生重复 |
| 新增 / 库有 xlsx 无 / 无法判定 | 人工确认 |

---

## 第 3 步：待核 2 户处置

`待核-2026-10-13.csv` 里是 2 户**疑似自家主体**（`[自家·禁外呼]`）：

| # | 公司 | 地区 |
|---|---|---|
| 10 | ⚠️河北神雕农机服务(自家?) | 河北石家庄元氏 |
| 65 | ⚠️元氏县金色神雕农机专业合作社(自家?) | 河北石家庄元氏 |

- 归属为 `unknown` ⇒ **两侧都不入库**，这是刻意的（避免打到自家）。
- 待老板拍板（U5）后才能决定：确认是自家 ⇒ 永久排除；确认无关 ⇒ 补 `归属=cn` 后按第 1 步重导（幂等，已入库行会自动 skipped）。
- **不要手动把这两行塞进库里。**

---

## 第 4 步：验收（照 `scratch/leads/round1/验收.sql` 跑）

必查项：

```sql
-- .cn 侧
SELECT count(*) FROM "RawListing" WHERE source='manual_dealer';                 -- 期望 58
SELECT count(*) FROM "PiiAuditLog" WHERE action='import' ...;                   -- 期望 >= 58
-- 幂等：同一份 CSV 再导一次 → imported=0, skipped=58
-- 护栏：构造 1 条 goodsRegion='cn' 打到 .com 接口 → 必须 rejectedCount=1

-- .com 侧
SELECT count(*) FROM "RawListing" WHERE source='manual_dealer_intl';            -- 期望 18
SELECT count(DISTINCT "sellerName") FROM "RawListing" WHERE source='manual_dealer_intl';  -- 期望 18
SELECT count(*) FROM (SELECT "contentHash" FROM "RawListing" GROUP BY "contentHash" HAVING count(*)>1) t;  -- 期望 0
SELECT count(*) FROM "RawListing" WHERE goodsRegion='cn';                       -- 期望 0（.com 库绝不能有境内数据）
```

最后一条是**数据不出境红线**的硬校验，必须等于 0。

---

## 第 5 步：外呼前必读

给外呼员的口径：

1. **看到 `[电话占位]` ⇒ 不要拨**，那不是真号码（如「平台联系」「拍卖页联系」「见官网」）。
2. **看到 `[自家·禁外呼]` ⇒ 不要拨**（本次这 2 户在待核 CSV 里，不会进库）。
3. **看到 `[同号·关联：XXX]` ⇒ 拨之前先看 XXX 那户有没有已跟进记录**，避免重复拨打同一部电话。
4. `[补全]T2·低·存疑` 的号码**慎拨**（实测临沂金通 1 条）。
5. `[品牌兜底]` 表示品牌是兜底猜的（本批仅 1 条），机型串以 `机型` 列为准。

---

## 附：出问题怎么办

| 现象 | 原因 | 处置 |
|---|---|---|
| 返回 success 但一行没进 | 「归属」列没映射上 ⇒ `unknown` 不入库 | 重传并确认 `归属`列映射到 `goodsRegion` |
| 导入后备注里看不到标记 | 第 0 步没做，`.cn` 还是旧代码 | 回到第 0 步，先合并部署 |
| 重导出现重复行 | `contentHash` 变了（改过品牌/电话等参与字段） | 别改参与 hash 的字段；要改必须同事务重算 hash |
| `.com` 出现境内数据 | 归属判错 | `goodsRegion` 一经落库不可变更，只能「删除 + 按正确归属重导」 |
