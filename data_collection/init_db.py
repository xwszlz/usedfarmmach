"""
数据库初始化脚本
创建所有必要的表和初始数据
"""

import logging
from data_collection.database import DatabaseManager
from data_collection.models import Base, Brand
from data_collection.config import BRANDS

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def init_database():
    """初始化数据库"""
    logger.info("Starting database initialization")
    
    # 创建数据库管理器
    db_manager = DatabaseManager()
    
    # 连接数据库
    logger.info("Connecting to database")
    db_manager.connect()
    
    # 创建所有表
    logger.info("Creating database tables")
    db_manager.init_db()
    
    # 初始化品牌数据
    logger.info("Initializing brand data")
    init_brands(db_manager)
    
    logger.info("Database initialization completed successfully")
    db_manager.close()


def init_brands(db_manager: DatabaseManager):
    """初始化品牌数据"""
    session = db_manager.create_session()
    
    try:
        # 检查是否已有数据
        existing_brands = session.query(Brand).count()
        if existing_brands > 0:
            logger.info(f"Found {existing_brands} existing brands, skipping initialization")
            return
        
        # 添加品牌数据
        for brand_key, brand_info in BRANDS.items():
            brand = Brand(
                cn_name=brand_info['cn_name'],
                en_name=brand_info['en_name'],
                country=brand_info['country']
            )
            session.add(brand)
            logger.info(f"Added brand: {brand_info['cn_name']}")
        
        session.commit()
        logger.info(f"Successfully initialized {len(BRANDS)} brands")
    
    except Exception as e:
        logger.error(f"Error initializing brands: {e}")
        session.rollback()
    
    finally:
        session.close()


def drop_all_tables():
    """删除所有表（用于测试）"""
    logger.warning("Dropping all database tables")
    
    db_manager = DatabaseManager()
    db_manager.connect()
    db_manager.drop_all_tables()
    db_manager.close()
    
    logger.warning("All tables dropped")


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Database initialization script')
    parser.add_argument('--drop', action='store_true', help='Drop all tables')
    parser.add_argument('--init', action='store_true', default=True, help='Initialize database')
    
    args = parser.parse_args()
    
    if args.drop:
        drop_all_tables()
    
    if args.init:
        init_database()
