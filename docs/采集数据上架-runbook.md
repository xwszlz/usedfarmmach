# 采集数据上架 · 审核运维手册（runbook）

> 适用模块：《采集数据上架》审核闭环（T03 后端 API / T04 列表页 / T05 详情页）。
> 面向：具备 `admin` / `super_admin` 角色的运维与审核人员。
> 关联文档：`docs/采集数据上架方案.md`、`docs/采集数据上架-决策清单.md`、`docs/采集数据上架-T03T04设计.md`。

---

## 1. 入口与权限

| 页面 | 路径 | 说明 |
| --- | --- | --- |
| 审核列表 | `/{locale}/admin/raw-listings` | 批量筛选 / 勾选 / 同型号套用 |
| 单条详情 | `/{locale}/admin/raw-listings/{id}` | 全字段查看 + 单条审核动作 |
| 后台侧边栏 | 后台「采集审核」菜单 | 仅管理员可见 |

- **权限口径**：仅 `admin` / `super_admin` 可访问。`editor` 被拦截。
  - 页面层：`admin/layout.tsx` 放行了 `editor`，故列表页/详情页均**页内二次收紧**，非管理员 `redirect` 回 `/{locale}/admin`。
  - API 层：`requireRawListingAdmin()` 以 **DB 中的 `role` + `isActive`** 为准（不信任 JWT 内可能过期的 role）。
- **越权返回**：401 `UNAUTHORIZED`（未登录 / token 无效）、403 `FORBIDDEN`（角色不足）。

---

## 2. 状态机

```
                    ┌──────────── approve（人工补齐外键 + 年份/价格）────────────┐
                    │                                                          ▼
pending ──┐         │                                              converting ──► converted (Product=draft)
          ├─ sanity ┼─► needs_review ──approve──────────────────────────┘            │
auto_pass ┘         │        │                                        publish        │
（直接转换）          │        └─ reject ─► rejected                       │          ▼
                    └─► auto_rejected                                 published (Product=active)
                                                                              │
                                                              unpublish ──────┘
                                                              （回到 converted / draft）
```

- 状态字段：`RawListing.status`；产物状态：`Product.status`（转换一律先 `draft`，仅发布置 `active`）。
- `converting` 是**瞬态占位**（claim 阶段，防并发双建），不应长期停留。
- 转换类动作前提：`productId == null`（幂等，防重复建品）。
- `publish` / `unpublish` 前提：`productId != null`。

---

## 3. 自动判定（sanity）与决策口径

> 以下为**老板已拍板**的口径，运维按此执行，不要自行放宽。

| 命中规则 | 处理口径 | 人工可做的动作 |
| --- | --- | --- |
| `domain_blacklist`（YouTube / Facebook 等噪声域名） | **`needs_review`（不判死刑）** —— 可能仍是**有效信息渠道**，人工核实后再决定 | 核实无误 → 通过并转换；否则拒绝 |
| `no_price` | 谨慎填价或拒绝。（列表/详情提供价格输入框，**填错会导致成交价失真**） | 补录合理 CNY 价 → 通过；无价 → 拒绝 |
| `invalid_year` | 补全年份后通过 | 填入合理年份（1980 ~ 当前年+1）→ 通过 |
| `category_undetermined` | 人工选择「品类」补齐外键 | 选品类 → 通过 |
| `brand_unmatched` | 人工选择「品牌」补齐外键 | 选品牌 → 通过 |
| `price_hard_bound`（价格越硬边界） | 单价越界（< 3000 或 > 20000000）判死 | 确系真实 → 别无 override，拒绝并回溯采集源 |
| `price_outlier`（偏离同品牌中位价 > 8×） | `needs_review` | 核实真实 → 通过；异常 → 拒绝 |
| `duplicate_product` | **保持拒绝，不开放 override** | 不做通过 |
| `source_url_invalid`（URL 非法） | `auto_reject` | 需人工评估，一般拒绝 |
| `model_noise` | 型号噪声 | 拒绝或人工修正后重采 |

> 说明：**域名黑名单已由「auto_reject」改判为「needs_review」**——FB/YouTube 等不直接判死，转人工核实是否仍为有效渠道。

---

## 4. 三条审核通路

1. **单条 approve（详情页 / 列表行内）**
   - 列表页：行内选品牌▾ / 品类▾（部分命中 `invalid_year` / `no_price` 会显示补录框）→「通过并转换」。
   - 详情页：品牌/品类下拉**已服务端预选**（`resolveBrandForListing` / `inferCategory`），确认后「通过并转换」。
2. **勾选批量（`mode:"ids"`，≤ 100 条）**
   - 列表页勾选多行 → 顶部工具条设「品牌(不指定)/品类(不指定)」→「批量通过并转换」。
   - **上限 100**；超限返回 422 `TOO_MANY_IDS`。
3. **同型号批量套用（`mode:"by_model"`，≤ 200 条）**
   - 顶部工具条输入**精确型号名** + 至少选品牌或品类 →「同型号批量套用」。
   - **上限 200**；超限返回 422 `TOO_MANY_IDS`。

> 批量「通过并转换」的 overrides（品牌/品类）会套用到该批次所有行；年份/价格**不在批量**中补录（批量不开放填价，避免误填）。

---

## 5. `converting` 卡死恢复

`approve` 走「claim → convert → finalize」三步：

1. **claim**：`updateMany({ where:{ id, productId:null, status∈{pending,approved,needs_review} }, data:{ status:"converting" } })`；`count===0` → 409 `CLAIM_FAILED`。
2. **convert**：建 `draft` Product。
3. **finalize**：置 `converted` 并写回 `productId` / `convertedAt`。

若在 claim 之后、finalize 之前**进程崩溃**，该行会停在 `converting`。

- **惰性回收**：系统常量 `CONVERTING_STALE_MINUTES = 10`（见 `src/lib/raw-listing/review.ts`）。claim 的 `updateMany` 的 `OR` 子句包含
  `{ status:"converting", updatedAt:{ lt: now - 10min } }`，即**停留超过 10 分钟的 `converting` 行可被重新认领**。
- **紧急处理**：在详情页对该行点「重新评估」；或稍等 > 10 分钟后再次「通过并转换」。
- 无需人工改库；等待阈值即可自愈。

---

## 6. 错误码表

| 状态码 | `code` | 含义 / 处置 |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | 请求体非法（如 `action` 缺失、body 非 JSON） |
| 401 | `UNAUTHORIZED` | 未登录 / token 无效 → 重新登录 |
| 403 | `FORBIDDEN` | 角色不足（仅 admin/super_admin） |
| 404 | `NOT_FOUND` | 采集记录不存在（可能已被删除） |
| 409 | `ALREADY_CONVERTED` | 该记录已生成产品，不可重复转换 |
| 409 | `STATE_CONFLICT` | 状态冲突（如未生成产品却要发布；已生成产品却要拒绝） |
| 409 | `CLAIM_FAILED` | 并发抢占失败 → 刷新后重试 |
| 422 | `FK_UNRESOLVED` | 品牌/品类无法确定，请人工指定（`missing:["brandId"/"categoryId"]`） |
| 422 | `FIELD_REQUIRED` | 字段缺失或非法（`{field:"year"}`） |
| 422 | `TOO_MANY_IDS` | 批量超上限（ids ≤ 100 / by_model ≤ 200） |
| 500 | `INTERNAL_ERROR` | 服务器内部错误 → 记录 id/时间并上报 |

---

## 7. 常见问题（FAQ）

- **`FIELD_REQUIRED { field:"year" }`** → 年份缺失或非法。在列表行内 / 详情页**补全年份**（1980 ~ 当前年+1）后再「通过并转换」。
- **`FK_UNRESOLVED { missing:["brandId"] }`** → 品牌未匹配。用品牌▾ 人工选择后重试。
- **`FK_UNRESOLVED { missing:["categoryId"] }`** → 品类未推断出。用品类▾ 人工选择后重试。
- **点了「通过并转换」但状态回到 `needs_review`** → 转换被跳过（skip）。弹窗会提示原因（如价格越界、年份非法）。核对后修正再试。
- **详情页「品类走兜底」琥珀色警示** → `inferCategory` 使用了兜底品类（`usedFallback=true`），**必须人工确认**品类是否合理，必要时改选。
- **`no_price` 行要不要填价？** → 谨慎。填错会让成交价失真；无法确认真实价格时，**宁可拒绝**。
- **同一采集记录能否重复转换？** → 不能。已生成产品（`productId != null`）会返回 409 `ALREADY_CONVERTED`；如需下架请用「下线」。

---

## 8. 关键常量与文件索引（便于排障）

| 项 | 位置 |
| --- | --- |
| 审核服务层（列表/详情/动作/批量） | `src/lib/raw-listing/review.ts` |
| 转换核心（RawListing → Product） | `src/lib/raw-listing/convert.ts` |
| 自动判定（纯函数） | `src/lib/raw-listing/sanity.ts` |
| 类型与常量 | `src/lib/raw-listing/types.ts` |
| 鉴权守卫 | `src/lib/raw-listing/admin-auth.ts` |
| 列表页 / 详情页 | `src/app/[locale]/admin/raw-listings(/[id])/page.tsx` |
| API | `src/app/api/admin/raw-listings/**` |
| 列表表格 / 详情动作组件 | `src/components/admin/raw-listing-review-table.tsx`、`src/components/admin/raw-listing-fk-select.tsx` |
| 价格硬边界 | `PRICE_MIN_CNY=3000` / `PRICE_MAX_CNY=20000000`（`types.ts`） |
| 离群倍数 | `PRICE_OUTLIER_RATIO=8`（`types.ts`） |
| converting 惰性回收 | `CONVERTING_STALE_MINUTES=10`（`review.ts`） |
| 批量上限 | `MAX_BATCH_IDS=100` / `MAX_BY_MODEL=200`（`review.ts`） |
