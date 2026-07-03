"""
数据库初始化和连接模块
"""

import logging
from sqlalchemy import create_engine, event, Engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import QueuePool
from typing import Optional
from data_collection.config import DATABASE_CONFIG
from data_collection.models import Base

logger = logging.getLogger(__name__)


class DatabaseManager:
    """数据库管理器"""
    
    def __init__(self, config: dict = None):
        """初始化数据库管理器"""
        self.config = config or DATABASE_CONFIG
        self.engine: Optional[Engine] = None
        self.SessionLocal = None
    
    def build_connection_string(self) -> str:
        """构建连接字符串"""
        db_type = self.config.get('type', 'postgresql')
        user = self.config.get('user')
        password = self.config.get('password')
        host = self.config.get('host', 'localhost')
        port = self.config.get('port', 5432)
        database = self.config.get('database')
        
        if db_type == 'postgresql':
            return f"postgresql://{user}:{password}@{host}:{port}/{database}"
        elif db_type == 'mysql':
            return f"mysql+pymysql://{user}:{password}@{host}:{port}/{database}"
        elif db_type == 'sqlite':
            return f"sqlite:///{database}.db"
        else:
            raise ValueError(f"Unsupported database type: {db_type}")
    
    def connect(self) -> Engine:
        """连接数据库"""
        connection_string = self.build_connection_string()
        
        self.engine = create_engine(
            connection_string,
            poolclass=QueuePool,
            pool_size=self.config.get('pool_size', 10),
            max_overflow=20,
            echo=self.config.get('echo', False),
            pool_pre_ping=True,  # 测试连接有效性
        )
        
        # 添加事件监听
        @event.listens_for(Engine, "connect")
        def set_sqlite_pragma(dbapi_conn, connection_record):
            if self.config.get('type') == 'sqlite':
                cursor = dbapi_conn.cursor()
                cursor.execute("PRAGMA foreign_keys=ON")
                cursor.close()
        
        logger.info(f"Connected to database: {self.config.get('database')}")
        return self.engine
    
    def init_db(self):
        """初始化数据库表"""
        if not self.engine:
            self.connect()
        
        Base.metadata.create_all(bind=self.engine)
        logger.info("Database tables created successfully")
    
    def create_session(self) -> Session:
        """创建会话"""
        if not self.engine:
            self.connect()
        
        if not self.SessionLocal:
            self.SessionLocal = sessionmaker(bind=self.engine)
        
        return self.SessionLocal()
    
    def drop_all_tables(self):
        """删除所有表（仅用于测试）"""
        if not self.engine:
            self.connect()
        
        Base.metadata.drop_all(bind=self.engine)
        logger.warning("All database tables dropped")
    
    def close(self):
        """关闭数据库连接"""
        if self.engine:
            self.engine.dispose()
            logger.info("Database connection closed")


# 全局数据库管理器实例
db_manager = DatabaseManager()


def get_db_session() -> Session:
    """获取数据库会话"""
    return db_manager.create_session()


def init_database():
    """初始化数据库"""
    db_manager.connect()
    db_manager.init_db()
