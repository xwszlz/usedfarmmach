"""
数据采集管道
整合爬虫、验证器和处理器，实现完整的数据采集流程
"""

import logging
import time
from typing import Dict, List, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from data_collection.crawler import CrawlerPool, CrawlerFactory
from data_collection.validator import MachineDataValidator, BatchValidator
from data_collection.processor import DataProcessor, DataCleaner, DataEnricher
from data_collection.database import get_db_session
from data_collection.config import BRANDS, REGIONS, VALIDATION_RULES

logger = logging.getLogger(__name__)


class CollectionPipeline:
    """数据采集管道"""
    
    def __init__(self, config: Dict[str, Any] = None):
        """初始化管道"""
        self.config = config or {}
        self.crawler_pool = CrawlerPool()
        self.validator = MachineDataValidator(VALIDATION_RULES)
        self.batch_validator = BatchValidator(self.validator)
        self.db_session: Optional[Session] = None
        self.processor: Optional[DataProcessor] = None
    
    def initialize(self):
        """初始化管道"""
        logger.info("Initializing collection pipeline")
        
        # 初始化数据库连接
        self.db_session = get_db_session()
        self.processor = DataProcessor(self.db_session, self.validator)
        
        # 注册爬虫
        self._register_crawlers()
        
        logger.info("Pipeline initialized successfully")
    
    def _register_crawlers(self):
        """注册爬虫"""
        crawler_sources = self.config.get('sources', ['alibaba', 'quanguo_farm'])
        
        for source in crawler_sources:
            try:
                crawler = CrawlerFactory.create_crawler(source, self.config)
                self.crawler_pool.add_crawler(source, crawler)
                logger.info(f"Registered crawler: {source}")
            except Exception as e:
                logger.error(f"Failed to register crawler {source}: {e}")
    
    def extract(self, sources: List[str] = None, pages: int = 1) -> Dict[str, List[Dict[str, Any]]]:
        """数据提取阶段"""
        logger.info("Starting extraction phase")
        start_time = time.time()
        
        if sources:
            # 只爬取指定的数据源
            results = {}
            for source in sources:
                crawler = self.crawler_pool.get_crawler(source)
                if crawler:
                    try:
                        items = crawler.crawl_pages(1, pages)
                        results[source] = items
                        logger.info(f"Extracted {len(items)} items from {source}")
                    except Exception as e:
                        logger.error(f"Error extracting from {source}: {e}")
                        results[source] = []
        else:
            # 爬取所有数据源
            results = self.crawler_pool.crawl_all(pages)
        
        duration = time.time() - start_time
        logger.info(f"Extraction phase completed in {duration:.2f} seconds")
        
        return results
    
    def transform(self, raw_data: Dict[str, List[Dict[str, Any]]]) -> Dict[str, List[Dict[str, Any]]]:
        """数据转换阶段"""
        logger.info("Starting transformation phase")
        
        transformed_data = {}
        cleaner = DataCleaner()
        
        for source, items in raw_data.items():
            transformed_items = []
            
            for item in items:
                try:
                    # 清洗数据
                    cleaned_item = {
                        'brand': cleaner.normalize_brand_name(item.get('brand', '')),
                        'model': cleaner.clean_model(item.get('model', '')),
                        'price': cleaner.clean_price(item.get('price')),
                        'year': cleaner.clean_year(item.get('year')),
                        'working_hours': item.get('working_hours'),
                        'new_rate': item.get('new_rate'),
                        'region': cleaner.clean_region(item.get('region', '')),
                        'source': source,
                        'source_id': item.get('source_id'),
                        'source_url': item.get('url'),
                    }
                    
                    # 添加可选字段
                    for key in ['machine_type', 'color', 'engine_power', 'transmission_type', 
                               'fuel_type', 'city', 'description', 'seller_info']:
                        if key in item:
                            cleaned_item[key] = item[key]
                    
                    transformed_items.append(cleaned_item)
                except Exception as e:
                    logger.error(f"Error transforming item from {source}: {e}")
                    continue
            
            transformed_data[source] = transformed_items
            logger.info(f"Transformed {len(transformed_items)} items from {source}")
        
        return transformed_data
    
    def validate(self, transformed_data: Dict[str, List[Dict[str, Any]]]) -> Dict[str, Any]:
        """数据验证阶段"""
        logger.info("Starting validation phase")
        
        # 获取有效的品牌列表
        valid_brands = [brand['cn_name'] for brand in BRANDS.values()]
        
        validation_results = {}
        
        for source, items in transformed_data.items():
            logger.info(f"Validating {len(items)} items from {source}")
            
            batch_result = self.batch_validator.validate_batch(items, valid_brands, REGIONS)
            validation_results[source] = batch_result
            
            # 记录验证错误
            for detail in batch_result['details']:
                if not detail['validation']['is_valid']:
                    for error in detail['validation']['errors']:
                        self.processor.record_validation_error(
                            source=source,
                            source_id=f"{source}_{detail['index']}",
                            error_type=error['field'],
                            error_message=error['message']
                        )
        
        logger.info("Validation phase completed")
        return validation_results
    
    def load(self, transformed_data: Dict[str, List[Dict[str, Any]]], 
            validation_results: Dict[str, Any]) -> Dict[str, int]:
        """数据加载阶段"""
        logger.info("Starting load phase")
        start_time = time.time()
        
        load_results = {}
        
        for source, items in transformed_data.items():
            validation = validation_results.get(source, {})
            valid_count = validation.get('valid', 0)
            
            # 只加载验证通过的数据
            valid_items = []
            for idx, item in enumerate(items):
                detail = next((d for d in validation['details'] if d['index'] == idx), None)
                if detail and detail['validation']['is_valid']:
                    valid_items.append(item)
            
            logger.info(f"Loading {len(valid_items)} valid items from {source}")
            
            # 处理数据
            result = self.processor.process_batch(valid_items, source)
            load_results[source] = result
            
            # 记录爬虫日志
            self.processor.record_crawl_log(
                source=source,
                status='success' if result['failed'] == 0 else 'partial',
                total_items=len(items),
                new_items=result['success'],
                updated_items=0,
                error_message=None if result['failed'] == 0 else f"{result['failed']} items failed",
                duration=int(time.time() - start_time)
            )
        
        duration = time.time() - start_time
        logger.info(f"Load phase completed in {duration:.2f} seconds")
        
        return load_results
    
    def run(self, sources: List[str] = None, pages: int = 1) -> Dict[str, Any]:
        """运行完整的采集管道"""
        logger.info("Starting data collection pipeline")
        pipeline_start = time.time()
        
        try:
            # 初始化
            if not self.processor:
                self.initialize()
            
            # ETL流程
            raw_data = self.extract(sources, pages)
            transformed_data = self.transform(raw_data)
            validation_results = self.validate(transformed_data)
            load_results = self.load(transformed_data, validation_results)
            
            pipeline_duration = time.time() - pipeline_start
            
            summary = {
                'status': 'success',
                'duration': pipeline_duration,
                'extraction': raw_data,
                'validation': validation_results,
                'loading': load_results,
                'timestamp': datetime.utcnow().isoformat()
            }
            
            logger.info(f"Pipeline completed successfully in {pipeline_duration:.2f} seconds")
            return summary
        
        except Exception as e:
            logger.error(f"Pipeline error: {e}", exc_info=True)
            return {
                'status': 'failed',
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat()
            }
    
    def close(self):
        """关闭管道"""
        logger.info("Closing pipeline")
        
        # 关闭爬虫
        self.crawler_pool.close_all()
        
        # 关闭数据库连接
        if self.db_session:
            self.db_session.close()
        
        logger.info("Pipeline closed")


class ScheduledCollector:
    """定时采集器"""
    
    def __init__(self, config: Dict[str, Any] = None):
        """初始化定时采集器"""
        self.config = config or {}
        self.pipeline = CollectionPipeline(config)
        self.pipeline.initialize()
    
    def collect_once(self, sources: List[str] = None, pages: int = 1) -> Dict[str, Any]:
        """执行一次采集"""
        try:
            logger.info("Starting scheduled collection")
            result = self.pipeline.run(sources, pages)
            logger.info(f"Collection result: {result['status']}")
            return result
        except Exception as e:
            logger.error(f"Scheduled collection error: {e}")
            return {
                'status': 'error',
                'error': str(e)
            }
    
    def close(self):
        """关闭采集器"""
        self.pipeline.close()
