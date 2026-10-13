# 积分 ×100 迁移上线执行手册

> 适用变更：`feat/credits-unit-100`（HEAD `fec8762`）—— 积分单位 1 元/1 美元 = 1 积分 → 100 积分
> 迁移脚本：`prisma/migrate-credits-x100.ts`（本轮已做安全加固，见文末「附录 C」）
> 数据风险等级：**P0 — 直接动用户资产**
>
> ⚠️ 本手册假设**新单位代码尚未上线**。上线后本文的「执行」章节即失效，请直接跳到
> 「§7 兜底：代码已经先上线了怎么办」。

---

## 0. 现状确认（动手前先核对这 3 条）

```bash
cd D:\神雕农机\wt-credits-100
git status -sb          # 期望：## feat/credits-unit-100...origin/main [ahead 1]
git log --oneline -1    # 期望：fec8762 feat(credits): 积分单位 1元/1美元 = 100积分 ...
git log --oneline origin/main -1   # 期望：e20616d（不是 fec8762）
```

| 项 | 值 | 含义 |
|---|---|---|
| 分支 | `feat/credits-unit-100` | 新单位代码在这里 |
| 与 origin/main 的关系 | **ahead 1，未推送** | 新单位代码**还没上线**，窗口还开着 |
| `origin/main` | `e20616d` | 线上跑的仍是旧单位代码 |

**如果 `origin/main` 已经包含 `fec8762`** → 立刻停手，转 §7。

---

## 1. 前置：备份两个库

两套库物理隔离，**必须各备份一次**。

### 1.1 .com 库（Neon）

Neon 推荐用**分支**（copy-on-write，秒级，可随时把项目切回去）——这是最快的回滚手段：

1. Neon Console → Project → Branches → **Create branch**
2. Name：`pre-credits-x100-<日期>`，Parent：`main`/`production`
3. 建好后**不要**动它，作为回滚基线

同时做一份 pg_dump 落盘（双保险）：

```bash
# 从 Neon Console → Connection string 复制（注意带 sslmode=require）
export NEON_URL="postgresql://<user>:<pwd>@<ep-xxx>.<region>.aws.neon.tech/<db>?sslmode=require"

pg_dump "$NEON_URL" -Fc -f ./backup-neon-com-$(date +%Y%m%d-%H%M).dump

# 校验备份可读（必须做，不校验的备份等于没备份）
pg_restore -l ./backup-neon-com-*.dump | head -20
```

> Neon serverless 会在无连接时挂起计算节点，第一次连可能要等 2~5 秒，属正常。

### 1.2 .cn 库（境内 PostgreSQL）

> ⚠️ **合规红线：数据不出境。** 备份文件只能落在境内（ECS 本地盘 / OSS 北京 / RDS 北京），
> 严禁拷到境外机器或境外对象存储。

**情况 A：库是 ECS 上的 `cn-postgres` 容器**（`docker-compose.yml:75`）

```bash
ssh root@101.200.125.199
cd /opt/cn
docker exec -t cn-postgres \
  pg_dump -U "$POSTGRES_USER" -d usedfarmmach_cn -Fc \
  -f /var/lib/postgresql/data/cn-pre-credits-x100-$(date +%Y%m%d-%H%M).dump
# 拷出容器，留在 ECS 本地盘
docker cp cn-postgres:/var/lib/postgresql/data/cn-pre-credits-x100-*.dump /opt/cn/backup/
ls -lh /opt/cn/backup/
```

**情况 B：库是阿里云 RDS**（见 `docs/cn-db-runbook.md` §5.2）

```bash
aliyun rds CreateBackup --DBInstanceId <instance-id> --BackupMethod Physical
# 记下返回的 BackupId，回滚时要用
```

**同时建一张迁移前快照表**（后面 §4 的验证全部依赖它，两个库都要建）：

```sql
-- 在目标库执行（迁移前）
CREATE TABLE IF NOT EXISTS credits_x100_snapshot AS
SELECT
  u.id                                        AS user_id,
  u.credits                                   AS credits_before,
  COALESCE(l.lot_remaining, 0)                AS lot_remaining_before,
  u.credits - COALESCE(l.lot_remaining, 0)    AS gap_before
FROM "User" u
LEFT JOIN (
  SELECT "userId", SUM("remainingAmount") AS lot_remaining
  FROM "CreditLot"
  WHERE "remainingAmount" > 0 AND "expiresAt" > now()
  GROUP BY "userId"
) l ON l."userId" = u.id
WHERE u.credits <> 0 OR COALESCE(l.lot_remaining, 0) <> 0;

-- 确认行数（应等于"有余额或有批次的用户数"）
SELECT COUNT(*) FROM credits_x100_snapshot;
```

---

## 2. ⚠️ 顺序矛盾：「先跑迁移、再上线代码」与 .com 自动部署冲突

### 2.1 矛盾在哪

老板要求**先跑迁移、再上线代码**。但仓库的 CI 是这样配的：

| 文件 | 触发条件 | 行为 |
|---|---|---|
| `.github/workflows/deploy-com.yml` | `on: push: branches: [main]` | 自动部署 .com（Vercel） |
| `.github/workflows/deploy-cn.yml` | `on: push: branches: [main]` | **也自动部署 .cn**（阿里云 ECS） |

> 📌 **纠正一个认知**：`.cn` 并不是"只有手动 `deploy-cn.sh`"。`deploy-cn.sh` 是 CI 通过
> `appleboy/ssh-action` 在 ECS 上远程执行的**脚本本体**，而 CI 同样由 push 到 main 触发。
> 也就是说：**merge 到 main = .com 和 .cn 同时自动部署**，没有"先上一边看看"的机会。

所以「先迁移后上线」在流程上有一个硬性前提：

> **迁移必须在 merge 之前完成，且 merge 之前不能有任何一次 push/merge 到 main。**

### 2.2 可操作的解法（照这个顺序做）

```
T0  确认 origin/main = e20616d（旧单位代码在线）          ← §0
T1  两个库各建快照表 + 备份                                ← §1
T2  两个库各跑一次 CREDITS_X100_DRY_RUN=1 体检            ← §3.2
T3  两个库各跑一次正式迁移（.com → .cn）                   ← §3.3
T4  两个库各跑验证 SQL，全绿                               ← §4
T5  才去 merge / push 到 main  → 两站自动部署              ← §5
T6  上线后观察                                            ← §6
```

**关键点：迁移脚本不需要 merge 就能跑。** 脚本是一个独立的 tsx 入口，没有任何业务代码
import 它。直接在本地 worktree 里指向生产库跑即可，**不触发任何部署**：

```bash
cd D:\神雕农机\wt-credits-100
DATABASE_URL="<生产库连接串>" CREDITS_X100_TARGET=com \
  CREDITS_X100_MIGRATION_CONFIRM=1 npx tsx prisma/migrate-credits-x100.ts
```

> ❌ 不要为了让"脚本出现在 main 上"而提前 merge 它。一旦 merge，两站立刻部署；
> 若当时代码分支还没合进去，部署的是旧代码 + 已 ×100 的数据 —— 见 §2.3 的资损窗口。

### 2.3 唯一无法消除的窗口：数据已 ×100、代码还是旧的

从「.com 库迁移完成」到「.com 代码部署完成」之间必然有几分钟（Vercel 构建通常 1~5 分钟，
.cn 的 docker build + 传 OSS 约 10 分钟）。这段窗口里**旧代码在读写已 ×100 的数据**：

| 窗口内发生的动作 | 后果 | 等级 |
|---|---|---|
| 用户充值 ¥100 | 旧代码按 1 元=1 积分，只发 **100** 积分（应为 10000） | 🔴 资损 |
| 建充值订单 | `ServiceOrder.credits` 按旧单位写入，且**不会再被迁移**（已过迁移时点） | 🔴 |
| AI 调用扣费 | 旧代码扣 0~1 积分，余额却已放大 100 倍 → 白嫖 | 🟡 |
| 签到 / 邀请奖励 | 按旧常量发放，数值偏小 | 🟡 |

**压缩与兜底措施：**

1. **挑低峰执行**（建议北京时间 02:00–05:00），把窗口内的真实交易量降到最低。
2. **窗口期内的充值必须事后对账补齐**，用这条 SQL 捞出来：
   ```sql
   -- 把两个时间点换成真实的迁移完成时间 / 部署完成时间
   SELECT id, "userId", type, amount, reason, "createdAt"
   FROM "CreditTransaction"
   WHERE "createdAt" BETWEEN '<迁移完成时刻>' AND '<部署完成时刻>'
     AND type IN ('recharge','register_gift','checkin','invite_reward','ai_deduct')
   ORDER BY "createdAt";
   ```
   对 `recharge` 行，按实付金额补差额：`应发 = 实付元数 × 100`，`需补 = 应发 - amount`。
   补发走后台 `POST /api/admin/credits { userId, amount }`（注意：该接口只加 `User.credits`、
   不建 lot，见 §6.5）。
3. **`ServiceOrder` 同样要捞**：
   ```sql
   SELECT id, "orderNo", sku, "amountCny", credits, status, "createdAt"
   FROM "ServiceOrder"
   WHERE "createdAt" BETWEEN '<迁移完成时刻>' AND '<部署完成时刻>';
   ```
   这些订单的 `credits` 是旧单位，若后续被人工确认发分，会少发 100 倍 —— **逐个人工改对**。

---

## 3. 执行

### 3.1 两套库是分开的，脚本一次只连一个

| 站点 | 库 | 环境变量 | 托管 |
|---|---|---|---|
| .com | Neon | `DATABASE_URL` | Neon |
| .cn | 境内（ECS `cn-postgres` 容器 或 RDS） | `DATABASE_URL_CN` | 阿里云 |

> ⚠️ **Prisma 只读 `DATABASE_URL`。** 而 `.env.cn.example:44` 明确把 `DATABASE_URL` 置空、
> 把连接串放在 `DATABASE_URL_CN`。所以在 .cn 上跑脚本时，**必须把 `DATABASE_URL_CN` 的值
> 赋给 `DATABASE_URL`**，否则会连不上或连错库。脚本已内置这条检查（pre-flight `[a]`）。

**要跑两次**（一次连一个库），两次命令只有 `DATABASE_URL` 和 `CREDITS_X100_TARGET` 不同。
两个库各有自己的 `SystemConfig` 表，因此幂等标记互不干扰，各自独立。

### 3.2 Step 1：体检（只读，不写库）—— 两个库各跑一次

```bash
# .com / Neon
cd D:\神雕农机\wt-credits-100
DATABASE_URL="<Neon 连接串>" CREDITS_X100_TARGET=com \
  CREDITS_X100_DRY_RUN=1 npx tsx prisma/migrate-credits-x100.ts

# .cn / 境内库
DATABASE_URL="<DATABASE_URL_CN 的值>" CREDITS_X100_TARGET=cn \
  CREDITS_X100_DRY_RUN=1 npx tsx prisma/migrate-credits-x100.ts
```

体检会打印 5 组信息，**逐条看**：

| 项 | 看什么 | 不通过的表现 |
|---|---|---|
| `[a] 目标库` | 打码后的 `postgres://user:***@host/db` | 不是你预期的库 → **立即停** |
| `[b] 新单位流水` | 必须为 **0** | >0 说明新代码已上线 → §7 |
| `[c] int4 溢出` | 所有列的绝对最大值 < 21474836 | 超了要先改列类型为 bigint |
| `[d] SystemConfig 配置` | `credit_packs` / `plans` / `reward_values` 是否存在 | 存在则脚本会一并 ×100（见 §3.4） |
| `[e] 规模` | 各表行数 + 迁移前 SUM | 记下来，§4 要用 |

> 💡 `.cn` 库若从本地不可达（`cn-postgres` 是 docker 内网服务），用 SSH 端口转发：
> ```bash
> ssh -L 5433:127.0.0.1:5432 root@101.200.125.199 -N &
> # 然后 DATABASE_URL="postgresql://<user>:<pwd>@127.0.0.1:5433/usedfarmmach_cn?sslmode=disable"
> ```
> 前提：ECS 上 `cn-postgres` 的 5432 已映射到宿主机，或转发到容器 IP。
> 更省事的做法：SSH 进 ECS 后 `docker exec cn-postgres psql` 直接跑 §4 的 SQL。

### 3.3 Step 2：正式执行

```bash
# —— .com（Neon）——
cd D:\神雕农机\wt-credits-100
DATABASE_URL="<Neon 连接串>" \
CREDITS_X100_TARGET=com \
CREDITS_X100_MIGRATION_CONFIRM=1 \
npx tsx prisma/migrate-credits-x100.ts 2>&1 | tee migration-com.log

# —— .cn（境内库）——
DATABASE_URL="<DATABASE_URL_CN 的值>" \
CREDITS_X100_TARGET=cn \
CREDITS_X100_MIGRATION_CONFIRM=1 \
npx tsx prisma/migrate-credits-x100.ts 2>&1 | tee migration-cn.log
```

脚本会依次跑 7 步并打印每步行数：

```
[1/7] User.credits
[2/7] CreditLot.initialAmount / remainingAmount
[3/7] CreditTransaction.amount / balance + breakdown
[4/7] ServiceOrder.credits（全部状态）
[5/7] CheckIn.credits
[6/7] Promotion.creditsCost
[7/7] SystemConfig 运营配置积数字段
```

**中途崩溃了怎么办**（网络断、Neon 挂起、超时）：

1. **不要慌，也不要直接重跑。** 脚本每批都把进度写进 `SystemConfig.credits_x100_migration`，
   已乘过的行不会重复乘。
2. 直接重跑会被**拒绝**（这是刻意的，防两个进程并跑）：
   ```
   ✗ pre-flight 未通过：检测到未完成的迁移进度（startedAt=...，已完成步骤：User.credits, ...）
   ```
3. 确认没有另一个进程在跑之后，加 `RESUME` 续跑：
   ```bash
   DATABASE_URL="..." CREDITS_X100_TARGET=com \
   CREDITS_X100_MIGRATION_RESUME=1 CREDITS_X100_MIGRATION_CONFIRM=1 \
   npx tsx prisma/migrate-credits-x100.ts
   ```
   续跑会从断点继续，**已完成步骤打印「跳过」**。

### 3.4 关于 SystemConfig 运营配置（第 7 步）

`src/lib/credits/config.ts` 的 `getCreditPacks()` / `getPlans()` / `getRewardValues()`
**优先读 `SystemConfig`**（key = `credit_packs` / `plans` / `reward_values`），
读不到才回退 `constants.ts` 的默认值（那些已经 ×100 了）。

所以如果库里存着旧单位的运营配置，迁移后用户付 ¥199 只会拿到 150 积分（应为 15000）。
第 7 步会：

- `credit_packs[].credits`、`plans[].credits` ×100
- `reward_values.*` 除 `checkinStreakCycle`（天数，非积分）外全部 ×100
- 内置"已是新单位"保护：`credits / priceCny > 10` 或 `registerGift >= 1000` 时跳过并告警

**体检时一定要看 `[d]` 的输出**，确认这几个 key 的值符合预期。

---

## 4. 验证（跑完必做，两个库各做一遍）

> 以下 SQL 用 `psql` 或任何 PG 客户端直接执行。`.cn` 可
> `docker exec -it cn-postgres psql -U <user> -d usedfarmmach_cn`。

### V1. 总量是否恰好 ×100

和体检时记下的 `[e]` 数字对比，应**完全相等 ×100**（不是"差不多"）：

```sql
SELECT 'User.credits'            AS 项, SUM("credits")::bigint         AS 迁移后 FROM "User"
UNION ALL SELECT 'CreditLot.remainingAmount', SUM("remainingAmount")::bigint FROM "CreditLot"
UNION ALL SELECT 'CreditLot.initialAmount',   SUM("initialAmount")::bigint   FROM "CreditLot"
UNION ALL SELECT 'CreditTransaction.amount',  SUM("amount")::bigint          FROM "CreditTransaction"
UNION ALL SELECT 'ServiceOrder.credits',      SUM("credits")::bigint         FROM "ServiceOrder"
UNION ALL SELECT 'CheckIn.credits',           SUM("credits")::bigint         FROM "CheckIn"
UNION ALL SELECT 'Promotion.creditsCost',     SUM("creditsCost")::bigint     FROM "Promotion";
```

### V2. 抽查：是否等于迁移前 ×100（依赖 §1.2 的快照表）

```sql
-- 期望返回 0 行
SELECT s.user_id, s.credits_before, u.credits AS credits_after
FROM credits_x100_snapshot s
JOIN "User" u ON u.id = s.user_id
WHERE u.credits <> s.credits_before * 100;

-- 同样期望 0 行：批次也必须是 100 倍
SELECT s.user_id, s.lot_remaining_before, SUM(l."remainingAmount") AS after
FROM credits_x100_snapshot s
JOIN "CreditLot" l ON l."userId" = s.user_id
GROUP BY s.user_id, s.lot_remaining_before
HAVING SUM(l."remainingAmount") <> s.lot_remaining_before * 100;
```

### V3. 不变式：`User.credits` vs `SUM(CreditLot.remainingAmount)`

`spend.ts` 的 FIFO 扣减依赖它（`src/lib/credits/spend.ts:177-193`）。

```sql
-- 逐用户核对（只看"未过期且还有余额"的批次，与 spend.ts 的取数条件一致）
SELECT u.id,
       u.credits,
       COALESCE(SUM(l."remainingAmount"), 0) AS lot_remaining,
       u.credits - COALESCE(SUM(l."remainingAmount"), 0) AS gap
FROM "User" u
LEFT JOIN "CreditLot" l
       ON l."userId" = u.id
      AND l."remainingAmount" > 0
      AND l."expiresAt" > now()
GROUP BY u.id, u.credits
HAVING u.credits <> COALESCE(SUM(l."remainingAmount"), 0)
ORDER BY ABS(u.credits - COALESCE(SUM(l."remainingAmount"), 0)) DESC
LIMIT 50;
```

**怎么读这条结果：**

- 期望：`gap` 与迁移前 `gap_before` 的比值恰好是 **100**（脏数据等比放大，说明没改坏）。
- 对照快照表确认：
  ```sql
  -- 期望 0 行：缺口只是等比放大，没有新增缺口
  SELECT s.user_id, s.gap_before,
         u.credits - COALESCE(t.lot_remaining,0) AS gap_after
  FROM credits_x100_snapshot s
  JOIN "User" u ON u.id = s.user_id
  LEFT JOIN (
    SELECT "userId", SUM("remainingAmount") AS lot_remaining
    FROM "CreditLot" WHERE "remainingAmount" > 0 AND "expiresAt" > now()
    GROUP BY "userId"
  ) t ON t."userId" = s.user_id
  WHERE (u.credits - COALESCE(t.lot_remaining,0)) <> s.gap_before * 100;
  ```
- ⚠️ **已知脏数据**：`src/app/api/admin/credits/route.ts:27-31` 后台手工加积分时
  **只 `increment` `User.credits`，既不建 lot 也不写流水**。这部分余额没有批次支撑，
  迁移后缺口被同比放大 100 倍。`spend.ts` 扣减时只从 lot 里扣
  （`spend.ts:187`），却按 `need` 全额 decrement `User.credits`（`spend.ts:207-209`），
  结果是无批次支撑的部分被"凭空扣掉"。**这是迁移前就存在的问题，但 ×100 后绝对金额
  放大 100 倍**，建议迁移后按 §6.5 补 lot。

### V4. 流水 `balance` 是否连续

```sql
-- 期望 0 行（balance 应恒等于按时间序的 amount 累计和）
WITH t AS (
  SELECT id, "userId", amount, balance,
         SUM(amount) OVER (PARTITION BY "userId"
                           ORDER BY "createdAt", id
                           ROWS UNBOUNDED PRECEDING) AS running
  FROM "CreditTransaction"
)
SELECT "userId", id, amount, balance, running
FROM t
WHERE balance <> running
LIMIT 50;
```

> 说明：若存在"后台手工加积分"（`admin/credits` 接口不写流水），对应用户会出现
> `balance` 与 `running` 的常数偏差 —— 属已知脏数据，不是本次迁移造成的。
> 判断标准：**偏差应与迁移前一致（×100）**，而不是新出现。

### V5. breakdown 标记是否补齐

```sql
-- 被迁移的旧流水都应带上 pointsPerUnit 标记；期望：只剩"原本 breakdown 为 NULL"的行
SELECT COUNT(*) FILTER (WHERE breakdown IS NULL)     AS breakdown_为空,
       COUNT(*) FILTER (WHERE breakdown IS NOT NULL
                          AND breakdown NOT LIKE '%pointsPerUnit%') AS 未打标记的
FROM "CreditTransaction";
```

`未打标记的` 应为 **0**（除非有 JSON 解析失败的行，脚本会打印"解析失败跳过 N 行"）。

### V6. 幂等标记与运营配置

```sql
SELECT key, value, "updatedAt" FROM "SystemConfig" WHERE key = 'credits_x100_migration';
-- 期望：status = "done"，steps 里 7 个步骤全部 done

SELECT key, value FROM "SystemConfig"
WHERE key IN ('credit_packs','plans','reward_values');
-- 期望：credits 类数值已是新单位（如 pack10 → 1000；registerGift → 2000）
```

### V7. 订单/签到/推广位抽样

```sql
SELECT status, COUNT(*) AS 订单数,
       MIN(credits) AS 最小, MAX(credits) AS 最大, AVG(credits)::bigint AS 均值
FROM "ServiceOrder" GROUP BY status ORDER BY status;

SELECT MIN(credits), MAX(credits), AVG(credits)::bigint FROM "CheckIn";
SELECT type, MIN("creditsCost"), MAX("creditsCost") FROM "Promotion" GROUP BY type;
```

> 判据：`ServiceOrder.credits / amountCny` 应在 **50~80** 区间（新单位），
> 若出现 0.5~0.8 说明那一批没乘到。

### V8. 再跑一次脚本，确认幂等

```bash
DATABASE_URL="..." CREDITS_X100_TARGET=com CREDITS_X100_MIGRATION_CONFIRM=1 \
  npx tsx prisma/migrate-credits-x100.ts
# 期望输出：✓ 检测到已完成的迁移标记 credits_x100_migration，本次跳过
```

**8 项全绿才能进 §5。任何一项不绿 → 转 §8 回滚。**

---

## 5. 上线（merge）

确认两个库都验证通过后：

1. 把 `feat/credits-unit-100` 合入 `main`（PR merge 或 push）。
2. merge 触发：
   - `.github/workflows/deploy-com.yml` → .com（Vercel）
   - `.github/workflows/deploy-cn.yml` → .cn（ECS，约 10 分钟，含 docker build + 传 OSS）
   - `.github/workflows/deploy-cn.yml` 有 `concurrency: group: deploy-cn, cancel-in-progress: false`，
     连续推送会排队，不要重复 push。
3. 部署完成后**立刻**做 §6 的冒烟检查。
4. 别忘了 §2.3 的窗口期对账（充值 / ServiceOrder）。

---

## 6. 上线后的观察项

### 6.1 余额是否被异常扣减（最高优先级）

```sql
-- 负余额 = E7 红线，任何一行都要立刻处理
SELECT id, email, credits FROM "User" WHERE credits < 0;

-- AI 扣费的分布：单次应在 10~60 积分量级（成本 0.05~0.3 元 × 100 × 2）
SELECT COUNT(*) AS 笔数,
       MIN(-amount) AS 最小扣减, MAX(-amount) AS 最大扣减,
       AVG(-amount)::numeric(10,2) AS 平均扣减
FROM "CreditTransaction"
WHERE type = 'ai_deduct' AND "createdAt" > now() - interval '2 hours';
```

期望：不再出现 `amount = 0` 的 ai_deduct（旧单位下四舍五入恒为 0，正是本次改造要解决的问题）。

### 6.2 支付回调是否正常加积分

```sql
-- 充值到账（近 6 小时）
SELECT type, COUNT(*), SUM(amount) FROM "CreditTransaction"
WHERE type IN ('recharge') AND "createdAt" > now() - interval '6 hours'
GROUP BY type;
```

同时盯日志（.cn 在 ECS：`docker logs -f cn-app`；.com 在 Vercel Functions 日志）：

- `[Recharge/WechatNotify] 金额不符` ← **重点**
- `[需人工补单]`
- `[Recharge/WechatNotify] 充值成功`
- `[credits/spend] deductCredits 失败`

### 6.3 ⚠️ 在途充值订单：这是本次上线最容易踩的坑

`src/app/api/membership/wechat/notify/route.ts:98-104`：

```ts
// 单位变更后：订单号里的 credits 数值上就等于「分」，与微信 amount.total 同单位直接比
const paidCents = Number(data.amount.total);
if (!Number.isFinite(paidCents) || paidCents !== pc.credits) {
  return fail("amount mismatch");   // ← 用户已付款，但积分不到账
}
```

新代码假定 `out_trade_no` 里的 `credits` 是**新单位**（= 实付分）。
而**迁移前用旧代码下的单**，订单号里是旧单位（¥20 → `R…_20_XXXX`）。
这类单在新代码上线后回调时：`paidCents=2000` vs `pc.credits=20` → 判为金额不符 →
**用户付了钱、积分不到账，微信还会持续重发通知直到彻底失败。**

处理办法：

1. 上线前尽量清空在途单（微信 Native 二维码有效期 2 小时，挑低峰可把在途量压到很小）。
2. 上线后立刻 grep 日志里的 `金额不符`，拿到 `out_trade_no` 与实付金额，
   按 `实付元数 × 100` 人工补单（`POST /api/admin/credits`）。
3. 支付宝链路同理（`src/app/api/membership/alipay/notify/route.ts:94`）。

### 6.4 充值页 / 展示口径

- 积分中心档位显示：pack10 = 1000 积分 / ¥20，pack150 = 15000 / ¥199。
- 若显示成 10 / 150 → `SystemConfig.credit_packs` 没乘到，回 §3.4。
- 多语文案里写死的"1 元 = X 积分"是否已改（本次 commit 已含，抽查一下）。

### 6.5 后台手工加积分的脏数据（建议尽快治理）

上线后统计一次缺口，按 `seed-credit-migration.ts:48-81` 的做法给缺口补
`sourceType='migration'` 的 lot：

```sql
-- 需要补 lot 的用户清单（按缺口降序）
SELECT u.id, u.credits, COALESCE(t.lot_remaining,0) AS lot_remaining,
       u.credits - COALESCE(t.lot_remaining,0) AS 待补
FROM "User" u
LEFT JOIN (
  SELECT "userId", SUM("remainingAmount") AS lot_remaining
  FROM "CreditLot" WHERE "remainingAmount" > 0 AND "expiresAt" > now()
  GROUP BY "userId"
) t ON t."userId" = u.id
WHERE u.credits > COALESCE(t.lot_remaining,0)
ORDER BY 待补 DESC
LIMIT 50;
```

### 6.6 观察窗口

| 时段 | 盯什么 |
|---|---|
| 上线后 0~30 min | 充值回调日志、负余额、AI 扣费分布 |
| 上线后 24 h | 签到 / 邀请奖励发放是否按新值、过期批次任务是否正常 |
| 上线后 7 天 | 用户客诉（"我充的钱少了/多了"）、`ServiceOrder` 人工确认链路 |

---

## 7. 兜底：如果代码已经先上线了怎么办

如果 §0 的核对发现 `origin/main` 已含 `fec8762`（或线上已跑新单位代码），
**立刻停止执行 §3**。此时库里是"新旧单位混合"状态，整体 ×100 会把新单位数据再放大 100 倍。

脚本的 pre-flight `[b]` 会在这种情况下**自动拒绝执行**：

```
✗ pre-flight 未通过：检测到 N 行新单位流水（最早一条 id=... createdAt=...）
```

可行路径（按推荐度排序）：

1. **先回滚代码**到 `e20616d`（`git revert` 或 Vercel/ECS 回滚镜像），让线上回到旧单位，
   库恢复成"纯旧单位"，再走本文流程。混合数据里"新单位增量"部分需要人工按
   `createdAt >= 上线时刻` 捞出来单独 ÷100：
   ```sql
   -- 仅供参考，执行前必须先备份 + 人工核对行数
   SELECT COUNT(*) FROM "CreditTransaction"
   WHERE "createdAt" >= '<新代码上线时刻>';
   ```
2. **按切点重建**（复杂，需逐用户重算）：
   `User.credits_new = (credits_now - Σ(amount WHERE createdAt >= 切点)) × 100 + Σ(amount WHERE createdAt >= 切点)`。
   前提是 `credits == Σ(amount)` 严格成立 —— 但已知存在"后台手工加积分不写流水"
   的脏数据（`admin/credits/route.ts`），该等式**不成立**，所以这条路必须由人逐户核对，
   不要脚本化。

> 结论：**不要试图用脚本自动修复混合单位数据。** 回滚代码 + 人工处理增量是唯一稳妥解。

---

## 8. 回滚

### 8.1 首选：从备份恢复

| 站点 | 操作 |
|---|---|
| .com（Neon） | Console → Branches → 切到 `pre-credits-x100-<日期>` 分支，或把项目指向该分支；也可用 `pg_restore` 回灌 |
| .cn（ECS 容器） | `docker exec -i cn-postgres pg_restore -U <user> -d usedfarmmach_cn --clean /var/lib/postgresql/data/cn-pre-credits-x100-*.dump` |
| .cn（RDS） | 控制台按备份集 / PITR 恢复到新实例，再切连接串（见 `docs/cn-db-runbook.md` §6） |

> ⚠️ 恢复会**丢掉迁移之后产生的所有业务数据**（新订单、新流水、新注册）。
> 只有在"迁移跑错了"且尚未上线代码时才划算。

### 8.2 反向 ÷100：只在极窄窗口内可行

**可行条件（必须全部满足）：**

1. 迁移已完成，但**新代码还没上线**（或已立刻回滚）；
2. 迁移后到回滚前**没有任何写入**（没有充值、没有 AI 扣费、没有签到）；
3. 所有值都是 100 的整数倍。

先做可行性检查（**必须全为 0**）：

```sql
SELECT 'User' AS 表, COUNT(*) AS 非100整数倍的行 FROM "User" WHERE "credits" % 100 <> 0
UNION ALL SELECT 'CreditLot.initial',   COUNT(*) FROM "CreditLot" WHERE "initialAmount" % 100 <> 0
UNION ALL SELECT 'CreditLot.remaining', COUNT(*) FROM "CreditLot" WHERE "remainingAmount" % 100 <> 0
UNION ALL SELECT 'CreditTransaction.amount', COUNT(*) FROM "CreditTransaction" WHERE "amount" % 100 <> 0
UNION ALL SELECT 'CreditTransaction.balance',COUNT(*) FROM "CreditTransaction" WHERE "balance" % 100 <> 0
UNION ALL SELECT 'ServiceOrder',  COUNT(*) FROM "ServiceOrder" WHERE "credits" % 100 <> 0
UNION ALL SELECT 'CheckIn',       COUNT(*) FROM "CheckIn" WHERE "credits" % 100 <> 0
UNION ALL SELECT 'Promotion',     COUNT(*) FROM "Promotion" WHERE "creditsCost" % 100 <> 0;
```

全 0 才执行反向（整数除法，对 100 的整数倍是精确还原）：

```sql
BEGIN;
UPDATE "User"             SET "credits"         = "credits" / 100;
UPDATE "CreditLot"        SET "initialAmount"   = "initialAmount" / 100,
                              "remainingAmount" = "remainingAmount" / 100;
UPDATE "CreditTransaction" SET amount = amount / 100, balance = balance / 100;
UPDATE "ServiceOrder"     SET "credits"     = "credits" / 100;
UPDATE "CheckIn"          SET "credits"     = "credits" / 100;
UPDATE "Promotion"        SET "creditsCost" = "creditsCost" / 100;
-- 清掉幂等标记，否则下次真要迁移时会被跳过
DELETE FROM "SystemConfig" WHERE key = 'credits_x100_migration';
-- 先跑一遍 §4 的 V1/V2 对一眼，对得上再 COMMIT
COMMIT;
```

**不可行的情况：** 只要有一行不是 100 的整数倍（说明迁移后已有新写入，
或迁移跑了不止一次），**必须走 §8.1 备份恢复**，不要硬除（会丢小数、造成新的资损）。

> 反向脚本不处理 `breakdown` 里的 `pointsPerUnit` 标记与 `SystemConfig` 运营配置 ——
> 这两块需人工改回。

---

## 附录 A：本次审查发现并已修进脚本的问题

| # | 等级 | 问题 | 修法 |
|---|---|---|---|
| 1 | 🔴 | 幂等标记只在全部跑完后写，中途崩溃重跑会 **二次 ×100**（User.credits 变 ×10000） | 改为**进度标记**：每批「数据更新 + 进度落库」在同一事务内；重跑按步骤/游标续跑 |
| 2 | 🔴 | `CreditTransaction` 的自我保护只靠 `breakdown.pointsPerUnit`，而 recharge/gift/checkin 等 `breakdown` 为 **NULL**，绝大多数行没有自我保护 | 同上，由游标兜底；并在 pre-flight 明确说明 |
| 3 | 🔴 | 混合单位（新代码已上线）时盲目 ×100 → 新数据再放大 100 倍 | 新增 pre-flight `[b]`，检出新单位流水即拒绝执行 |
| 4 | 🔴 | `SystemConfig` 的 `credit_packs` / `plans` / `reward_values` 漏乘 → 用户付 ¥199 只拿 150 积分 | 新增第 7 步 ×100，并带"已是新单位"保护 |
| 5 | 🟡 | 全表 `UPDATE` 单事务锁表（User / CreditLot / CheckIn / Promotion 都是整表一条 UPDATE） | 全部改为 id 游标分批（500 行/批） |
| 6 | 🟡 | int4 溢出（积分列均为 PG `integer`，×100 后可能超 2147483647 导致 UPDATE 报 `integer out of range`） | 新增 pre-flight `[c]` 绝对值体检 |
| 7 | 🟡 | `ServiceOrder` 只改 pending/paid，closed/rejected/refunded 维持旧单位 → 后台订单列表新旧单位并列 | 改为全状态 ×100（单位一致性优先） |
| 8 | 🟡 | `breakdown` 数组元素里的 `amount` 未同步 ×100 → 同条流水内两个数字差 100 倍 | `stampBreakdown` 一并 ×100 |
| 9 | 🟡 | 跑错库（Prisma 只读 `DATABASE_URL`，而 .cn 连接串在 `DATABASE_URL_CN`） | 新增 pre-flight `[a]`：打印打码连接串 + 强制 `CREDITS_X100_TARGET=com\|cn` |
| 10 | 🟢 | 没有体检模式 | 新增 `CREDITS_X100_DRY_RUN=1` |
| 11 | 🟢 | 迁移前后总量未打印，不利于验证 | pre-flight `[e]` + 完成后各打印 SUM |

`breakdown` 解析失败跳过的逻辑**本身是安全的**（`migrate-credits-x100.ts` 中
`parseOk=false` 时只乘 `amount/balance`、不动 JSON，不破坏数据）；真正的问题在于
这些行**没有自我保护标记**，已由 #1 的进度游标解决。

## 附录 B：应急等价 SQL（仅在没有 tsx 环境的机器上使用）

```sql
-- 前提：已完成备份；执行后必须手工补写 SystemConfig 标记，否则重复执行会二次 ×100
UPDATE "User"              SET "credits"         = "credits" * 100;
UPDATE "CreditLot"         SET "initialAmount"   = "initialAmount" * 100,
                               "remainingAmount" = "remainingAmount" * 100;
UPDATE "CreditTransaction" SET amount = amount * 100, balance = balance * 100;
UPDATE "ServiceOrder"      SET "credits"     = "credits" * 100;
UPDATE "CheckIn"           SET "credits"     = "credits" * 100;
UPDATE "Promotion"         SET "creditsCost" = "creditsCost" * 100;

INSERT INTO "SystemConfig" (key, value, "createdAt", "updatedAt")
VALUES ('credits_x100_migration',
        '{"status":"done","multiplier":100,"target":"MANUAL-SQL","steps":{}}',
        now(), now())
ON CONFLICT (key) DO NOTHING;
```

> 这份 SQL **不处理** `breakdown` 标记、`SystemConfig` 运营配置、分批、溢出体检，
> 也不做任何"混合单位"检查。**优先用脚本，这只是断网/无 Node 环境时的最后手段。**

## 附录 C：脚本改动后的运行参数速查

| 环境变量 | 必填 | 作用 |
|---|---|---|
| `DATABASE_URL` | ✅ | 目标库连接串（.cn 请填 `DATABASE_URL_CN` 的值） |
| `CREDITS_X100_TARGET` | ✅ | `com` 或 `cn`，留痕 + 防跑错库 |
| `CREDITS_X100_MIGRATION_CONFIRM` | ✅（正式执行） | 置 `1` 才写库 |
| `CREDITS_X100_DRY_RUN` | — | 置 `1` 只体检不写库 |
| `CREDITS_X100_MIGRATION_RESUME` | — | 崩溃续跑（确认无并发进程时） |
| `CREDITS_X100_ALLOW_MIXED_UNIT` | — | 强行在混合单位数据上跑（**除非人工核对过，别开**） |
