"""
数据模型定义
使用SQLAlchemy ORM定义农机数据的数据库模型
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, Index, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()


class Brand(Base):
    """品牌模型"""
    __tablename__ = 'brands'
    
    id = Column(Integer, primary_key=True)
    cn_name = Column(String(100), nullable=False, unique=True, comment='中文名称')
    en_name = Column(String(100), nullable=False, unique=True, comment='英文名称')
    country = Column(String(50), nullable=False, comment='原产国')
    description = Column(Text, comment='品牌描述')
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关系
    machines = relationship('Machine', back_populates='brand')
    
    __table_args__ = (
        Index('idx_brand_name', 'cn_name', 'en_name'),
    )


class Machine(Base):
    """农机信息模型"""
    __tablename__ = 'machines'
    
    id = Column(Integer, primary_key=True)
    brand_id = Column(Integer, ForeignKey('brands.id'), nullable=False, comment='品牌ID')
    model = Column(String(100), nullable=False, comment='型号')
    machine_type = Column(String(50), nullable=False, comment='类型：拖拉机/收割机/其他')
    
    # 基础价格信息
    price = Column(Float, nullable=False, comment='价格(万元)')
    price_min = Column(Float, comment='最低价格(万元)')
    price_max = Column(Float, comment='最高价格(万元)')
    price_currency = Column(String(10), default='CNY', comment='货币单位')
    
    # 车辆信息
    year = Column(Integer, comment='生产年份')
    working_hours = Column(Integer, comment='工作小时数')
    new_rate = Column(Float, comment='成新度(%)')
    color = Column(String(50), comment='颜色')
    
    # 性能参数
    engine_power = Column(Float, comment='发动机功率(KW)')
    transmission_type = Column(String(50), comment='变速箱类型')
    fuel_type = Column(String(50), comment='燃料类型')
    
    # 交易信息
    seller_id = Column(Integer, ForeignKey('sellers.id'), comment='卖家ID')
    region = Column(String(50), comment='所在地区')
    city = Column(String(50), comment='城市')
    registration_status = Column(String(20), comment='登记状态：已登记/未登记')
    
    # 数据来源信息
    source = Column(String(50), nullable=False, comment='数据源')
    source_url = Column(Text, comment='来源链接')
    source_id = Column(String(100), unique=True, comment='来源ID')
    
    # 数据状态
    is_active = Column(Boolean, default=True, comment='是否活跃')
    is_verified = Column(Boolean, default=False, comment='是否验证通过')
    
    # 描述和备注
    description = Column(Text, comment='机器描述')
    notes = Column(Text, comment='备注信息')
    
    # 时间戳
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    scraped_at = Column(DateTime, default=datetime.utcnow, comment='爬取时间')
    
    # 关系
    brand = relationship('Brand', back_populates='machines')
    seller = relationship('Seller', back_populates='machines')
    price_history = relationship('PriceHistory', back_populates='machine')
    images = relationship('MachineImage', back_populates='machine')
    
    __table_args__ = (
        Index('idx_machine_brand_model', 'brand_id', 'model'),
        Index('idx_machine_source', 'source', 'source_id'),
        Index('idx_machine_region', 'region', 'city'),
        Index('idx_machine_created', 'created_at'),
    )


class Seller(Base):
    """卖家信息模型"""
    __tablename__ = 'sellers'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False, comment='卖家名称')
    contact_person = Column(String(100), comment='联系人')
    phone = Column(String(20), comment='电话')
    email = Column(String(100), comment='邮箱')
    wechat = Column(String(100), comment='微信')
    qq = Column(String(50), comment='QQ')
    
    # 地址信息
    region = Column(String(50), comment='地区')
    city = Column(String(50), comment='城市')
    address = Column(Text, comment='详细地址')
    
    # 卖家信息
    seller_type = Column(String(20), comment='卖家类型：个人/商家/经销商')
    rating = Column(Float, comment='评分')
    transaction_count = Column(Integer, default=0, comment='交易次数')
    
    # 数据来源
    source = Column(String(50), comment='数据源')
    source_id = Column(String(100), unique=True, comment='来源ID')
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关系
    machines = relationship('Machine', back_populates='seller')
    
    __table_args__ = (
        Index('idx_seller_source', 'source', 'source_id'),
    )


class PriceHistory(Base):
    """价格历史记录模型"""
    __tablename__ = 'price_history'
    
    id = Column(Integer, primary_key=True)
    machine_id = Column(Integer, ForeignKey('machines.id'), nullable=False, comment='农机ID')
    price = Column(Float, nullable=False, comment='价格(万元)')
    price_min = Column(Float, comment='最低价格(万元)')
    price_max = Column(Float, comment='最高价格(万元)')
    
    # 市场数据
    avg_price = Column(Float, comment='同类平均价格(万元)')
    price_trend = Column(String(20), comment='价格趋势：上升/下降/稳定')
    
    recorded_at = Column(DateTime, default=datetime.utcnow, comment='记录时间')
    source = Column(String(50), comment='数据源')
    
    # 关系
    machine = relationship('Machine', back_populates='price_history')
    
    __table_args__ = (
        Index('idx_price_machine_date', 'machine_id', 'recorded_at'),
    )


class MachineImage(Base):
    """农机图片模型"""
    __tablename__ = 'machine_images'
    
    id = Column(Integer, primary_key=True)
    machine_id = Column(Integer, ForeignKey('machines.id'), nullable=False, comment='农机ID')
    image_url = Column(Text, nullable=False, comment='图片URL')
    image_path = Column(String(255), comment='本地存储路径')
    order = Column(Integer, default=0, comment='显示顺序')
    is_primary = Column(Boolean, default=False, comment='是否主图')
    
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    
    # 关系
    machine = relationship('Machine', back_populates='images')


class DataSource(Base):
    """数据源信息模型"""
    __tablename__ = 'data_sources'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False, unique=True, comment='数据源名称')
    url = Column(String(255), comment='数据源URL')
    description = Column(Text, comment='描述')
    
    # 采集配置
    is_enabled = Column(Boolean, default=True, comment='是否启用')
    crawl_frequency = Column(String(50), comment='采集频率')
    last_crawl_time = Column(DateTime, comment='最后采集时间')
    
    # 统计信息
    total_items = Column(Integer, default=0, comment='总采集数')
    success_count = Column(Integer, default=0, comment='成功数')
    failed_count = Column(Integer, default=0, comment='失败数')
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CrawlLog(Base):
    """爬虫日志模型"""
    __tablename__ = 'crawl_logs'
    
    id = Column(Integer, primary_key=True)
    source = Column(String(50), nullable=False, comment='数据源')
    status = Column(String(20), comment='状态：success/failed/partial')
    total_items = Column(Integer, comment='总数')
    new_items = Column(Integer, default=0, comment='新增数')
    updated_items = Column(Integer, default=0, comment='更新数')
    
    error_message = Column(Text, comment='错误信息')
    start_time = Column(DateTime, default=datetime.utcnow)
    end_time = Column(DateTime)
    duration = Column(Integer, comment='耗时(秒)')
    
    __table_args__ = (
        Index('idx_crawl_source_time', 'source', 'start_time'),
    )


class ValidationError(Base):
    """数据验证错误日志模型"""
    __tablename__ = 'validation_errors'
    
    id = Column(Integer, primary_key=True)
    source = Column(String(50), comment='数据源')
    source_id = Column(String(100), comment='源数据ID')
    error_type = Column(String(50), comment='错误类型')
    error_message = Column(Text, comment='错误信息')
    raw_data = Column(Text, comment='原始数据')
    
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved = Column(Boolean, default=False, comment='是否已解决')
    
    __table_args__ = (
        Index('idx_validation_source', 'source', 'created_at'),
    )
