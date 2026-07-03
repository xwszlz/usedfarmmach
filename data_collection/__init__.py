"""
数据采集框架包
提供简化的接口和快速启动方式
"""

from data_collection.pipeline import CollectionPipeline, ScheduledCollector
from data_collection.crawler import BaseCrawler, CrawlerFactory, CrawlerPool
from data_collection.validator import MachineDataValidator, BatchValidator, ValidatorResult
from data_collection.processor import DataProcessor, DataCleaner, DataEnricher
from data_collection.database import DatabaseManager, get_db_session, init_database
from data_collection.config import (
    CRAWLER_CONFIG,
    DATABASE_CONFIG,
    BRANDS,
    REGIONS,
    VALIDATION_RULES,
)

__version__ = '1.0.0'
__author__ = 'xwszlz'
__all__ = [
    # Pipeline
    'CollectionPipeline',
    'ScheduledCollector',
    
    # Crawlers
    'BaseCrawler',
    'CrawlerFactory',
    'CrawlerPool',
    
    # Validators
    'MachineDataValidator',
    'BatchValidator',
    'ValidatorResult',
    
    # Processors
    'DataProcessor',
    'DataCleaner',
    'DataEnricher',
    
    # Database
    'DatabaseManager',
    'get_db_session',
    'init_database',
    
    # Config
    'CRAWLER_CONFIG',
    'DATABASE_CONFIG',
    'BRANDS',
    'REGIONS',
    'VALIDATION_RULES',
]


def quick_start(pages: int = 1, sources: list = None) -> dict:
    """快速启动数据采集
    
    Args:
        pages: 采集页数
        sources: 采集的数据源列表，为None时采集所有源
    
    Returns:
        采集结果字典
    """
    pipeline = CollectionPipeline({
        'sources': sources or ['alibaba', 'quanguo_farm'],
        **CRAWLER_CONFIG
    })
    
    try:
        pipeline.initialize()
        result = pipeline.run(sources=sources, pages=pages)
        return result
    finally:
        pipeline.close()
