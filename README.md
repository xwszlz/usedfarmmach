# 二手农机数据采集框架

## 项目简介

这是一个完整的、可扩展的数据采集框架，用于从多个在线平台采集二手农机信息。框架实现了ETL（提取-转换-加载）流程，包括数据爬虫、验证、清洗和存储等功能。

## 功能特性

### 核心功能
- ✅ **多数据源支持**：阿里巴巴、全球农机网、58同城、农机通等
- ✅ **完整的ETL流程**：提取→转换→验证→加载
- ✅ **数据验证**：价格、型号、年份等多维度验证
- ✅ **数据清洗**：自动清洗和规范化数据
- ✅ **数据库存储**：使用SQLAlchemy ORM支持PostgreSQL、MySQL、SQLite
- ✅ **错误跟踪**：详细的验证错误和爬虫日志记录
- ✅ **定时采集**：支持定时任务和批量采集
- ✅ **可扩展架构**：易于添加新数据源和处理逻辑

### 架构设计

```
┌─────────────────┐
│  数据源         │
│  (Alibaba/     │
│  QG Farm/58)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  爬虫框架        │  Extract
│  (BaseCrawler)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  数据转换        │  Transform
│  (DataCleaner)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  数据验证        │  Validate
│  (Validator)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  数据加载        │  Load
│  (Processor)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  数据库         │
│  (PostgreSQL)   │
└─────────────────┘
```

## 项目结构

```
data_collection/
├── __init__.py
├── config.py              # 配置文件
├── models.py              # SQLAlchemy ORM模型
├── database.py            # 数据库连接管理
├── crawler.py             # 爬虫框架
├── validator.py           # 数据验证工具
├── processor.py           # 数据处理模块
├── pipeline.py            # 完整的ETL管道
└── init_db.py             # 数据库初始化脚本

examples/
└── collection_examples.py # 使用示例

requirements.txt          # 项目依赖
README.md                 # 项目文档
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 配置数据库

编辑 `data_collection/config.py` 中的 `DATABASE_CONFIG`：

```python
DATABASE_CONFIG = {
    'type': 'postgresql',      # 数据库类型
    'host': 'localhost',
    'port': 5432,
    'database': 'usedfarmmach',
    'user': 'postgres',
    'password': 'your_password',
    'pool_size': 10,
}
```

### 3. 初始化数据库

```bash
python data_collection/init_db.py --init
```

### 4. 运行数据采集

```bash
# 运行基础示例
python examples/collection_examples.py --example 1

# 运行所有示例
python examples/collection_examples.py --all

# 初始化数据库并采集
python examples/collection_examples.py --init-db --example 1
```

## 详细使用指南

### 使用数据采集管道

```python
from data_collection.pipeline import CollectionPipeline
from data_collection.config import CRAWLER_CONFIG

# 创建管道
pipeline = CollectionPipeline({
    'sources': ['alibaba', 'quanguo_farm'],
    **CRAWLER_CONFIG
})

# 初始化
pipeline.initialize()

# 运行采集
result = pipeline.run(pages=1)

print(f"Status: {result['status']}")
print(f"Duration: {result['duration']:.2f}s")
print(f"Validation: {result['validation']}")
print(f"Loading: {result['loading']}")

# 关闭
pipeline.close()
```

### 自定义爬虫

```python
from data_collection.crawler import BaseCrawler

class MyCustomCrawler(BaseCrawler):
    def __init__(self, config=None):
        super().__init__('my_source', config)
        self.base_url = 'https://example.com'
    
    def extract_items(self, page=1):
        # 实现数据提取逻辑
        pass
    
    def extract_item_details(self, item_url):
        # 实现详细信息提取逻辑
        pass

# 注册爬虫
from data_collection.crawler import CrawlerFactory
CrawlerFactory.register_crawler('my_source', MyCustomCrawler)
```

### 数据查询示例

```python
from data_collection.database import get_db_session
from data_collection.models import Machine, Brand
from sqlalchemy import func

session = get_db_session()

# 查询所有农机
machines = session.query(Machine).all()

# 按品牌查询
brand = session.query(Brand).filter_by(cn_name='迪尔').first()
machines_by_brand = session.query(Machine).filter_by(brand_id=brand.id).all()

# 统计查询
total = session.query(func.count(Machine.id)).scalar()
avg_price = session.query(func.avg(Machine.price)).scalar()

session.close()
```

## 数据模型

### Machine（农机）
- id: 主键
- brand_id: 品牌ID
- model: 型号
- machine_type: 类型（拖拉机/收割机等）
- price: 价格（万元）
- year: 生产年份
- working_hours: 工作小时数
- new_rate: 成新度（%）
- source: 数据源
- source_id: 源数据ID
- source_url: 源链接
- description: 描述

### Brand（品牌）
- id: 主键
- cn_name: 中文名称
- en_name: 英文名称
- country: 原产国

### Seller（卖家）
- id: 主键
- name: 卖家名称
- contact_person: 联系人
- phone: 电话
- email: 邮箱
- region: 地区
- seller_type: 卖家类型

### PriceHistory（价格历史）
- id: 主键
- machine_id: 农机ID
- price: 价格
- avg_price: 平均价格
- price_trend: 价格趋势
- recorded_at: 记录时间

### CrawlLog（爬虫日志）
- id: 主键
- source: 数据源
- status: 状态（success/failed/partial）
- total_items: 总数
- new_items: 新增数
- error_message: 错误信息

## 配置说明

### 爬虫配置（CRAWLER_CONFIG）
```python
CRAWLER_CONFIG = {
    'timeout': 30,                           # 请求超时时间（秒）
    'retry_times': 3,                        # 重试次数
    'retry_delay': 5,                        # 重试延迟（秒）
    'user_agent': '...',                     # 用户代理
    'headers': {...},                        # 自定义请求头
    'proxy_enabled': False,                  # 是否启用代理
}
```

### 验证规则（VALIDATION_RULES）
```python
VALIDATION_RULES = {
    'price': {'min': 0.5, 'max': 100, 'required': True},
    'model': {'min_length': 2, 'max_length': 50, 'required': True},
    'year': {'min': 1990, 'max': 2024, 'required': False},
}
```

## 支持的数据源

| 数据源 | URL | 状态 | 备注 |
|------|-----|------|------|
| 阿里巴巴 | https://ershou.alibaba.com | ✅ | 需配置选择器 |
| 全球农机网 | https://www.nongjx.com | ✅ | 需配置选择器 |
| 58同城 | https://bj.58.com/nongji | ⏳ | 待实现 |
| 农机通 | https://www.nongjitong.com | ⏳ | 待实现 |

## 常见问题

### Q: 如何添加新的数据源？
A: 继承 `BaseCrawler` 类并实现 `extract_items` 和 `extract_item_details` 方法，然后通过 `CrawlerFactory.register_crawler()` 注册。

### Q: 如何修改验证规则？
A: 编辑 `config.py` 中的 `VALIDATION_RULES` 字典。

### Q: 如何使用代理？
A: 在 `CRAWLER_CONFIG` 中设置 `proxy_enabled=True` 并配置 `proxy_list`。

### Q: 如何定时运行采集？
A: 使用 `ScheduledCollector` 和 APScheduler 库。

## 性能优化

- 使用数据库连接池（pool_size=10）
- 实现请求重试和延迟策略
- 批量数据处理
- 索引优化（已在模型中添加）
- 异步爬虫支持（可扩展）

## 错误处理

- ✅ 网络错误自动重试
- ✅ 验证错误详细记录
- ✅ 数据库事务管理
- ✅ 异常日志记录
- ✅ 部分失败不中断管道

## 日志记录

所有日志输出到 `logs/data_collection.log`，包括：
- 爬虫执行情况
- 数据验证结果
- 数据库操作
- 错误和异常

## 扩展和二次开发

### 添加新的数据源
1. 继承 `BaseCrawler` 类
2. 实现 `extract_items()` 和 `extract_item_details()` 方法
3. 通过 `CrawlerFactory` 注册

### 自定义验证规则
编辑 `config.py` 中的 `VALIDATION_RULES` 或创建自定义验证器。

### 添加数据处理逻辑
在 `processor.py` 中继承 `DataProcessor` 或创建新的处理器。

## 许可证

MIT License

## 联系方式

如有问题或建议，请提交 Issue 或 Pull Request。

---

**最后更新**: 2026-07-03
