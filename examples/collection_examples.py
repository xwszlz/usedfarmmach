"""
数据采集框架使用示例
演示如何使用完整的数据采集管道
"""

import logging
import json
from data_collection.pipeline import CollectionPipeline, ScheduledCollector
from data_collection.config import CRAWLER_CONFIG, DATABASE_CONFIG
from data_collection.database import init_database

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/collection.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


def example_basic_collection():
    """示例1：基础数据采集"""
    logger.info("=" * 50)
    logger.info("Example 1: Basic Data Collection")
    logger.info("=" * 50)
    
    # 创建采集管道
    pipeline = CollectionPipeline({
        'sources': ['alibaba', 'quanguo_farm'],
        **CRAWLER_CONFIG
    })
    
    # 初始化管道
    pipeline.initialize()
    
    try:
        # 运行管道（采集1页数据）
        result = pipeline.run(pages=1)
        
        # 打印结果
        logger.info(f"Collection Status: {result['status']}")
        logger.info(f"Duration: {result['duration']:.2f} seconds")
        
        if result['status'] == 'success':
            logger.info("Validation Results:")
            for source, validation in result['validation'].items():
                logger.info(f"  {source}:")
                logger.info(f"    Total: {validation['total']}")
                logger.info(f"    Valid: {validation['valid']}")
                logger.info(f"    Invalid: {validation['invalid']}")
                logger.info(f"    Warnings: {validation['warning_count']}")
            
            logger.info("Loading Results:")
            for source, loading in result['loading'].items():
                logger.info(f"  {source}:")
                logger.info(f"    Total: {loading['total']}")
                logger.info(f"    Success: {loading['success']}")
                logger.info(f"    Failed: {loading['failed']}")
    
    finally:
        pipeline.close()


def example_specific_source_collection():
    """示例2：采集特定数据源"""
    logger.info("=" * 50)
    logger.info("Example 2: Specific Source Collection")
    logger.info("=" * 50)
    
    pipeline = CollectionPipeline({
        'sources': ['alibaba'],
        **CRAWLER_CONFIG
    })
    
    pipeline.initialize()
    
    try:
        # 只采集阿里巴巴的数据
        result = pipeline.run(sources=['alibaba'], pages=1)
        
        logger.info(f"Collection Status: {result['status']}")
        logger.info(f"Duration: {result['duration']:.2f} seconds")
        
        # 保存结果到文件
        with open('collection_result.json', 'w', encoding='utf-8') as f:
            # 转换为可序列化的格式
            result_copy = result.copy()
            if 'extraction' in result_copy:
                result_copy['extraction'] = {k: len(v) for k, v in result_copy['extraction'].items()}
            json.dump(result_copy, f, ensure_ascii=False, indent=2)
        
        logger.info("Results saved to collection_result.json")
    
    finally:
        pipeline.close()


def example_multi_page_collection():
    """示例3：多页数据采集"""
    logger.info("=" * 50)
    logger.info("Example 3: Multi-Page Collection")
    logger.info("=" * 50)
    
    pipeline = CollectionPipeline({
        'sources': ['alibaba', 'quanguo_farm'],
        **CRAWLER_CONFIG
    })
    
    pipeline.initialize()
    
    try:
        # 采集多页数据
        result = pipeline.run(pages=3)
        
        logger.info(f"Collection Status: {result['status']}")
        logger.info(f"Total Duration: {result['duration']:.2f} seconds")
        
        # 统计信息
        total_extracted = sum(len(items) for items in result['extraction'].values())
        total_valid = sum(v['valid'] for v in result['validation'].values())
        total_loaded = sum(l['success'] for l in result['loading'].values())
        
        logger.info(f"Total Extracted: {total_extracted}")
        logger.info(f"Total Valid: {total_valid}")
        logger.info(f"Total Loaded: {total_loaded}")
    
    finally:
        pipeline.close()


def example_scheduled_collection():
    """示例4：定时采集"""
    logger.info("=" * 50)
    logger.info("Example 4: Scheduled Collection")
    logger.info("=" * 50)
    
    collector = ScheduledCollector({
        'sources': ['alibaba'],
        **CRAWLER_CONFIG
    })
    
    try:
        # 执行一次采集
        result = collector.collect_once(pages=1)
        
        logger.info(f"Collection Status: {result['status']}")
        
        # 实际应用中可以使用APScheduler等库实现定时任务
        # from apscheduler.schedulers.background import BackgroundScheduler
        # scheduler = BackgroundScheduler()
        # scheduler.add_job(collector.collect_once, 'cron', hour=2, minute=0)
        # scheduler.start()
    
    finally:
        collector.close()


def example_error_handling():
    """示例5：错误处理"""
    logger.info("=" * 50)
    logger.info("Example 5: Error Handling")
    logger.info("=" * 50)
    
    pipeline = CollectionPipeline({
        'sources': ['alibaba', 'nonexistent_source'],
        **CRAWLER_CONFIG
    })
    
    pipeline.initialize()
    
    try:
        result = pipeline.run(pages=1)
        
        if result['status'] == 'failed':
            logger.error(f"Pipeline Error: {result.get('error')}")
        elif result['status'] == 'success':
            logger.info("Collection completed with some errors")
            
            # 检查验证错误
            for source, validation in result['validation'].items():
                if validation['invalid'] > 0:
                    logger.warning(f"Source {source} has {validation['invalid']} invalid items")
    
    finally:
        pipeline.close()


def example_data_analysis():
    """示例6：数据分析"""
    logger.info("=" * 50)
    logger.info("Example 6: Data Analysis")
    logger.info("=" * 50)
    
    from data_collection.database import get_db_session
    from data_collection.models import Machine
    from sqlalchemy import func
    
    session = get_db_session()
    
    try:
        # 查询统计信息
        total_machines = session.query(func.count(Machine.id)).scalar()
        logger.info(f"Total Machines: {total_machines}")
        
        # 按品牌统计
        by_brand = session.query(
            Machine.brand_id,
            func.count(Machine.id).label('count')
        ).group_by(Machine.brand_id).all()
        
        logger.info("Machines by Brand:")
        for brand_id, count in by_brand:
            logger.info(f"  Brand {brand_id}: {count} machines")
        
        # 按数据源统计
        by_source = session.query(
            Machine.source,
            func.count(Machine.id).label('count')
        ).group_by(Machine.source).all()
        
        logger.info("Machines by Source:")
        for source, count in by_source:
            logger.info(f"  {source}: {count} machines")
        
        # 价格统计
        price_stats = session.query(
            func.min(Machine.price).label('min'),
            func.avg(Machine.price).label('avg'),
            func.max(Machine.price).label('max')
        ).first()
        
        logger.info("Price Statistics (万元):")
        logger.info(f"  Min: {price_stats.min}")
        logger.info(f"  Avg: {price_stats.avg}")
        logger.info(f"  Max: {price_stats.max}")
    
    finally:
        session.close()


def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Data collection framework examples')
    parser.add_argument('--init-db', action='store_true', help='Initialize database')
    parser.add_argument('--example', type=int, default=1, 
                       choices=[1, 2, 3, 4, 5, 6],
                       help='Run specific example (1-6)')
    parser.add_argument('--all', action='store_true', help='Run all examples')
    
    args = parser.parse_args()
    
    # 初始化数据库
    if args.init_db:
        logger.info("Initializing database...")
        init_database()
        logger.info("Database initialized")
    
    # 运行示例
    examples = {
        1: example_basic_collection,
        2: example_specific_source_collection,
        3: example_multi_page_collection,
        4: example_scheduled_collection,
        5: example_error_handling,
        6: example_data_analysis,
    }
    
    if args.all:
        for example_func in examples.values():
            try:
                example_func()
            except Exception as e:
                logger.error(f"Example error: {e}", exc_info=True)
    else:
        example_func = examples.get(args.example)
        if example_func:
            try:
                example_func()
            except Exception as e:
                logger.error(f"Example error: {e}", exc_info=True)


if __name__ == '__main__':
    main()
