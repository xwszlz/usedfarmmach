# .cn 站数据库运维手册（阿里云 RDS PostgreSQL）

> 维护方：石家庄神雕农机科技有限公司
> 合规红线：**数据不出境** — 本库所有备份/快照/容灾均限于国内地域

---

## 1. 概览

| 项目 | 值 |
|------|-----|
| 数据库引擎 | PostgreSQL 15+ |
| 云厂商 | 阿里云 |
| 地域 | **北京**（cn-beijing） |
| 实例规格 | 按实际负载选择（建议 2C4G 起步） |
| 存储类型 | ESSD PL1+（建议 100GB 起步） |
| 字符集 | UTF8MB4 |
| 时区 | Asia/Shanghai（UTC+8） |
| 连接数上限 | 按规格（默认 200+） |

## 2. 数据库连接

### 2.1 环境变量

```bash
# .cn 站连接串（由 GitHub Actions / Docker 注入）
DATABASE_URL_CN="postgresql://user:password@<rds-internal-endpoint>.rds.aliyuncs.com:5432/usedfarmmach_cn?schema=public&sslmode=require"
```

### 2.2 连接注意事项

- **内部地址**：应用部署在阿里云 ECS/FC 时，使用 RDS **内部 VPC 地址**（避免公网流量与延迟）
- **SSL 连接**：生产环境 `sslmode=require`（RDS 默认要求）
- **连接池**：Prisma 内置连接池，按需调整 `connection_limit`

## 3. 初始化流程

首次部署执行：

```bash
# 1. 设置数据库连接
export DATABASE_URL_CN="postgresql://..."

# 2. 执行 Schema 迁移（与 .com 同源）
npx prisma migrate deploy

# 3. 执行 Seed（ICP 备案号占位 + 国产农机基础数据 + 价格指数样本）
node scripts/db-init-cn.mjs
```

## 4. Schema 迁移管理

### 4.1 日常开发

```bash
# 在本地 dev 数据库创建新迁移
npx prisma migrate dev --name describe_change

# 提交 migration.sql 到 Git
git add prisma/migrations/
```

### 4.2 部署到 .cn 站

```bash
# 在生产 RDS 应用待处理迁移
DATABASE_URL="<cn-rds-url>" npx prisma migrate deploy
```

### 4.3 迁移文件原则

- 两站**共用同一套 `prisma/migrations/`** 文件
- `.com`（Neon）和 `.cn`（RDS）各自 `prisma migrate deploy` 到自己的库
- 严禁为两站创建不同的迁移分支

## 5. 备份策略

### 5.1 自动备份（阿里云 RDS）

| 项目 | 配置 |
|------|------|
| 备份类型 | **自动快照**（物理备份） |
| 备份周期 | 每日 03:00（北京时间） |
| 保留时长 | 7 天（全量）+ 24 小时（binlog） |
| 备份地域 | **仅限国内**（北京地域存储，**禁止复制到海外**） |
| 跨地域备份 | **禁用**（合规要求） |

### 5.2 手动备份（重要变更前）

```bash
# 通过阿里云 CLI
aliyun rds CreateBackup --DBInstanceId <instance-id> --BackupMethod Physical
```

### 5.3 数据导出（管理用，不含 PII）

```bash
# 导出 schema-only（不含用户数据）
pg_dump --schema-only -h <host> -U <user> -d usedfarmmach_cn > schema_cn.sql
```

**注意**：批量导出用户数据需经法务审批；导出的文件不得存储在境外服务器。

## 6. 恢复流程

### 6.1 按时间点恢复（PITR）

RDS 控制台 → 备份恢复 → 按时间点创建实例
- 可恢复到过去 7 天内的任意时间点
- 恢复后的实例会自动生成在新的可用区

### 6.2 恢复到新实例

```bash
# 从指定备份集
aliyun rds RestoreDBInstanceFromBackup \
  --DBInstanceId <new-instance-id> \
  --BackupId <backup-id>
```

### 6.3 回滚迁移

```bash
# 查看迁移历史
npx prisma migrate status

# 回滚到指定迁移（需手动编写 down migration）
# Prisma 不原生支持回滚，建议先备份再迁移！
# 回滚流程：
# 1. 从最近的自动快照恢复一个临时实例
# 2. 编写反向迁移 SQL
# 3. 手动执行 SQL 回滚
# 4. 确认数据一致后应用
```

## 7. 性能监控

| 指标 | 推荐阈值 | 告警行动 |
|------|----------|----------|
| CPU 使用率 | < 80% | 扩容/优化慢查询 |
| 连接数 | < 80% 上限 | 检查连接泄漏 |
| 磁盘使用率 | < 70% | 清理/扩容 |
| 慢查询 (>1s) | < 5/分钟 | 分析并优化 |
| 复制延迟 | N/A（单实例无复制） | — |

## 8. 合规注意事项

### ⛔ 严禁
1. **跨境复制** — 不得将 RDS 数据备份/复制到境外存储
2. **跨地域备份** — 备份地域限北京，不得启用跨地域备份
3. **公网明文传输** — 必须使用 VPC 内部地址 + SSL
4. **与 .com 库同步** — 两库物理隔离，禁止任何 ETL 同步

### ✅ 必须执行
1. 备份保留在**北京地域**（RDS 控制台 → 备份设置 → 跨地域备份：**关闭**）
2. 所有连接走 **VPC 内部地址**
3. 启用 **SSL 连接**
4. 自动快照保留至少 **7 天**
5. **binlog 保留至少 24 小时**（支持 PITR）

## 9. 常见问题

### Q: Prisma 迁移在 .cn RDS 执行失败怎么办？
A: 检查 DATABASE_URL 是否指向正确的 RDS 地址。RDS 需要允许 Prisma 访问（安全组放行）。如果 migration 状态不一致，可手动设置 `prisma_migrations` 表记录。

### Q: 如何确认数据未出境？
A: 阿里云 RDS 控制台 → 实例详情 → 查看地域 = `cn-beijing`；检查跨地域备份状态 = `disabled`；检查 binlog 同步目标无境外实例。

### Q: 连接数不够用怎么办？
A: RDS 控制台调整最大连接数（需重启）；或使用阿里云 RDS 连接池（Connection Pooling）功能。
