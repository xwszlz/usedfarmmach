# .cn 国内站内容同步方案

> 问题：`.com` 国际站每日文章、日报、市场情报正常推送，`.cn` 国内站文章/情报空白。  
> 日期：2026-08-12  
> 配套文档：`docs/cn-deploy-architecture.md`、`docs/cn-deploy-runbook.md`

---

## 一、根因定位

| 站点     | 数据库                      | 当前状态                                                           |
| ------ | ------------------------ | -------------------------------------------------------------- |
| `.com` | Neon PostgreSQL（境外）      | 每日运行 `import-articles.js`、`import-intelligence-*.js`，文章与情报正常入库 |
| `.cn`  | ECS 本地 `cn-postgres`（境内） | **没有任何文章/情报数据**，因为现有自动化从未向 .cn DB 写入                           |

`.cn` 的 `/blog`、`/api/articles`、`/api/intelligence` 等路由全部直接查询 Prisma DB。只要 .cn DB 没有记录，页面上就一条内容都没有。

> 日报 MD / 竞争力 JSON / 策略 JSON 等**静态文件**：`public/daily-reports/` 下的内容会随 `.com` 每日同步提交进入 `main` 分支，`.cn` CI 构建镜像时会 `COPY` 进去，因此这部分理论上 .cn 已有。但文章列表页不走这些静态文件。

---

## 二、目标

1. `.cn` 站点每天更新后，文章库、市场情报库与 `.com` 保持一致（去除境外敏感字段/业务后）。
2. 不破坏“数据不出境”红线：.cn 运行时只连 `cn-postgres`，不连 Neon。
3. 不改动现有前端/SSR 逻辑（/blog、/intelligence 等页面无需改造）。
4. 过程幂等：重复部署不重复生成文章/情报。

---

## 三、推荐方案：镜像内 JSON + 部署后自动导入

核心思路：

- `.com` 每日自动化除了把文章/情报写入 Neon，还要把**同一份内容导出为 JSON 静态文件**提交到 `public/daily-reports/`。
- `.cn` 部署后，在 `cn-app` 容器内读取镜像里的 JSON 文件，批量导入 .cn DB。

### 3.1 数据流

```
┌─────────────────┐     import-articles.js      ┌──────────────────┐
│  generate_articles│ ───────────────────────────→│  .com Neon DB    │
│  articles_*.json  │                             └──────────────────┘
└─────────────────┘                                          ↑
         │                                                   │
         │  新增：提交到 public/daily-reports/                │
         │  articles_YYYY-MM-DD.json                         │
         │  intelligence_YYYY-MM-DD.json                     │
         └───────────────────────────────────────────────────┘
                              ↓
                    main 分支（GitHub）
                              ↓
         ┌────────────────────┼────────────────────┐
         │                    │                    │
    Vercel (.com)      ECS .cn CI build       小程序/静态CDN
         │                    │
         │              docker build -f Dockerfile.cn
         │                    │
         │              public/daily-reports/*.json 被打包进镜像
         │                    │
         │              deploy-cn.sh 拉起 cn-app
         │                    │
         │              docker exec cn-app node scripts/import-cn.js
         │                    │
         │              写入 cn-postgres
         └────────────────────┘
```

### 3.2 需要新增/修改的文件

| 文件                                     | 作用                                                                             | 备注 |
| -------------------------------------- | ------------------------------------------------------------------------------ | -- |
| `scripts/export-intelligence-json.js`  | 在 .com 跑完 `import-intelligence-*.js` 后，把当日情报导出为 `intelligence_YYYY-MM-DD.json` | 新增 |
| `scripts/import-articles-to-cn.js`     | .cn 容器内读取 `public/daily-reports/articles_*.json`，幂等写入 .cn DB                   | 新增 |
| `scripts/import-intelligence-to-cn.js` | .cn 容器内读取 `public/daily-reports/intelligence_*.json`，幂等写入 .cn DB               | 新增 |
| `Dockerfile.cn`                        | runner 阶段把上述 2 个导入脚本复制进镜像                                                      | 修改 |
| `deploy/deploy-cn.sh`                  | app healthy 后执行两个导入脚本                                                          | 修改 |
| 每日自动化 Phase 6                          | 把 `intelligence_YYYY-MM-DD.json` 也加入 `public/daily-reports/` 并随 PR 提交          | 修改 |

### 3.3 关键设计细节

#### 1）幂等去重

- 文章按 `slug` 唯一；导入前 `deleteMany({ slug: { in: [...] } })` 或 `upsert`。
- 情报按 `date + sortOrder` 唯一；导入前删除当日记录再写入。

#### 2）字段合规

- 文章表 `article` 不含资金/个人信息，可直接原样导入。
- 若未来文章表新增境外来源字段，可在导入脚本里做字段白名单过滤。

#### 3）日期推导

- 导入脚本不需要 `--date` 参数，直接扫描 `public/daily-reports/articles_*.json` 和 `intelligence_*.json`，取文件名中的日期；如需要“只导入今天”，再过滤。

#### 4）错误处理

- 导入失败不阻塞部署：用 `|| echo "WARN: import-cn failed"` 记录日志，避免健康检查已通过但导入脚本报错导致部署脚本退出。
- 同时触发告警（企微机器人或日志），方便次日排查。

---

## 四、替代方案（不做首选）

| 方案                                | 说明                                                          | 优缺点                                              |
| --------------------------------- | ----------------------------------------------------------- | ------------------------------------------------ |
| **A. 改 /blog、/insights 读静态 JSON** | 让文章列表页优先读 `public/daily-reports/articles_*.json`，不走 DB      | 优点：不改 DB；缺点：破坏现有 SSR/分页/搜索/SEO 结构化数据，改动面大        |
| **B. .cn 构建期拉取 .com API**         | CI build 时访问 `https://usedfarmmach.com/api/articles` 生成静态页面 | 优点：一次构建即可；缺点：CI 访问境外 Vercel 不稳定，且构建期写临时 DB 再导出繁琐 |
| **C. 数据库级双向同步**                   | 用逻辑复制/pg_dump 把 Neon 的 article/marketIntel 表同步到 cn-postgres | 优点：实时；缺点：违反“数据不出境”红线（运行时），且 Neon 为境外，合规风险高       |
| **D. 统一内容中台（OSS + API Gateway）**  | 文章/情报全部存 OSS，两边运行时从 OSS 读取                                  | 优点：架构最干净；缺点：改造量大，需要改前端所有查 DB 的地方                 |

> 推荐 **3.2 方案**，因为它只增加“镜像内 JSON + 部署后导入”，对现有页面、API、数据库模型零侵入。

---

## 五、实施步骤（可直接执行）

### Step 0：一次性补齐 .cn 历史文章/情报

在 .cn ECS 上执行（需先确认 `/opt/cn` 有当前源码）：

```bash
# 把今天的文章 JSON 导入 cn DB
cd /opt/cn
DATE=2026-08-12
DB_URL_CN=$(grep -E '^DATABASE_URL_CN=' .env.cn | head -1 | cut -d= -f2-)

docker exec -e DATABASE_URL_CN="$DB_URL_CN" cn-app \
  node -e "
const fs=require('fs');
const {PrismaClient}=require('@prisma/client');
const prisma=new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL_CN } } });
const file='/app/public/daily-reports/articles_${DATE}.json';
const items=JSON.parse(fs.readFileSync(file,'utf-8'));
(async()=>{
  await prisma.article.deleteMany({ where:{ slug:{ in: items.map(i=>i.slug) } } });
  for(const it of items){
    await prisma.article.create({ data:{
      ...it,
      tags: typeof it.tags==='object'? JSON.stringify(it.tags): it.tags,
      publishedAt: it.publishedAt? new Date(it.publishedAt): new Date(),
      status: 'published'
    }});
  }
  console.log('articles imported:', items.length);
  await prisma.\$disconnect();
})();
"
```

> 若需补齐更早历史，把 `DATE` 换成对应日期或循环 `public/daily-reports/articles_*.json`。

### Step 1：新增 `scripts/export-intelligence-json.js`

在每日任务 6 成功后执行，输出 `public/daily-reports/intelligence_YYYY-MM-DD.json`。

```js
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const dateStr = process.argv[2] || new Date().toISOString().split('T')[0];
const prisma = new PrismaClient();

(async () => {
  const dayStart = new Date(dateStr); dayStart.setHours(0,0,0,0);
  const dayEnd = new Date(dateStr); dayEnd.setHours(23,59,59,999);
  const items = await prisma.marketIntel.findMany({
    where: { date: { gte: dayStart, lte: dayEnd } },
    orderBy: { sortOrder: 'asc' },
  });
  const out = path.join(process.cwd(), 'public', 'daily-reports', `intelligence_${dateStr}.json`);
  fs.writeFileSync(out, JSON.stringify(items, null, 2));
  console.log(`Exported ${items.length} intelligence items to ${out}`);
  await prisma.$disconnect();
})();
```

### Step 2：新增 `scripts/import-articles-to-cn.js`

```js
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const REPORTS_DIR = path.join(process.cwd(), 'public', 'daily-reports');

function getTodayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}

(async () => {
  const today = getTodayStr();
  const file = path.join(REPORTS_DIR, `articles_${today}.json`);
  if (!fs.existsSync(file)) {
    console.warn(`Article JSON not found: ${file}`);
    process.exit(0);
  }
  const items = JSON.parse(fs.readFileSync(file, 'utf-8'));
  if (!Array.isArray(items) || items.length === 0) {
    console.log('No articles to import');
    process.exit(0);
  }
  await prisma.article.deleteMany({ where: { slug: { in: items.map(i => i.slug) } } });
  for (const it of items) {
    await prisma.article.create({ data: {
      ...it,
      tags: typeof it.tags === 'object' ? JSON.stringify(it.tags) : it.tags,
      publishedAt: it.publishedAt ? new Date(it.publishedAt) : new Date(),
      status: it.status || 'published',
    }});
  }
  console.log(`Imported ${items.length} articles into .cn DB for ${today}`);
  await prisma.$disconnect();
})();
```

### Step 3：新增 `scripts/import-intelligence-to-cn.js`

结构与上面类似，读取 `intelligence_${today}.json`，按 `date` 区间删除后写入。

### Step 4：修改 `Dockerfile.cn`

在 runner 阶段增加：

```dockerfile
# 把 .cn 部署后导入脚本复制进镜像
COPY --from=builder --chown=nextjs:nodejs /app/scripts/import-articles-to-cn.js ./scripts/import-articles-to-cn.js
COPY --from=builder --chown=nextjs:nodejs /app/scripts/import-intelligence-to-cn.js ./scripts/import-intelligence-to-cn.js
```

> 放 `COPY --from=builder ... /app/prisma ./prisma` 之后即可。

### Step 5：修改 `deploy/deploy-cn.sh`

在“等待 app 健康检查通过”之后、`reload nginx` 之前插入：

```bash
# 从 .env.cn 读取 DATABASE_URL_CN
echo "==> 导入今日文章与市场情报到 cn-postgres"
DB_URL_CN="$(grep -E '^DATABASE_URL_CN=' "$ENV_FILE" | head -1 | cut -d= -f2-)"

docker exec -e DATABASE_URL_CN="$DB_URL_CN" cn-app node scripts/import-articles-to-cn.js || \
  echo "WARN: articles import failed"

docker exec -e DATABASE_URL_CN="$DB_URL_CN" cn-app node scripts/import-intelligence-to-cn.js || \
  echo "WARN: intelligence import failed"
```

### Step 6：修改每日自动化 Phase 6

在任务 6（市场情报提取+入库）成功后，追加：

```bash
cd D:/神雕农机/usedfarmmach && DATABASE_URL="...neon..." node scripts/export-intelligence-json.js 2026-08-12
```

并把生成的 `public/daily-reports/intelligence_YYYY-MM-DD.json` 一起 `git add`、提交、合并到 `main`。

---

## 六、验证清单

部署并导入后，在 .cn 站点验证：

1. 访问 `https://usedfarmmach.cn/zh/blog` 能看到当天 3 篇文章。
2. 访问 `https://usedfarmmach.cn/api/daily-reports` 返回 `articles` 数组非空。
3. 访问 `https://usedfarmmach.cn/api/intelligence` 返回 8-12 条情报。
4. 容器日志无 Prisma 报错：
   ```bash
   docker logs cn-app | tail -50
   ```

---

## 七、风险与红线

| 风险               | 规避方式                                          |   |                          |
| ---------------- | --------------------------------------------- | - | ------------------------ |
| .cn 运行时访问境外 Neon | 不访问；导入脚本只连接 `DATABASE_URL_CN`（境内 cn-postgres） |   |                          |
| 重复导入导致数据重复       | `deleteMany` 当日/同 slug 后再写入，保证幂等              |   |                          |
| 导入失败阻塞部署         | 用 \`                                          |   | echo WARN\` 容错，失败记录日志并告警 |
| 历史文章封面图无法显示      | coverImage 已使用 OSS URL（北京 bucket），.cn/.com 通用 |   |                          |
| 敏感境外字段进入 .cn     | article/marketIntel 表当前无敏感字段；未来新增字段时白名单过滤     |   |                          |



---

## 八、建议的下一步动作

1. **今天就执行 Step 0**，把 2026-08-12 的文章先手工导入 .cn DB，让 .cn 立刻有内容。
2. 我随后按 Step 1-6 改代码、提 PR，合并后 .cn 的每日部署会自动同步。
3. 若需要，我也可以把历史所有 `articles_*.json`、`intelligence_*.json` 一次性补齐到 .cn。
