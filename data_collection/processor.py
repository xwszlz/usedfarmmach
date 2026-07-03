"""
数据处理模块
负责数据清洗、转换、存储等操作
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from data_collection.models import (
    Machine, Brand, Seller, PriceHistory, DataSource, CrawlLog, ValidationError
)
from data_collection.validator import MachineDataValidator, ValidatorResult

logger = logging.getLogger(__name__)


class DataProcessor:
    """数据处理器"""
    
    def __init__(self, db_session: Session, validator: MachineDataValidator):
        """初始化数据处理器"""
        self.db = db_session
        self.validator = validator
    
    def get_or_create_brand(self, brand_name: str, en_name: str = None, 
                           country: str = None) -> Brand:
        """获取或创建品牌"""
        brand = self.db.query(Brand).filter_by(cn_name=brand_name).first()
        
        if not brand:
            brand = Brand(
                cn_name=brand_name,
                en_name=en_name or brand_name,
                country=country or 'Unknown'
            )
            self.db.add(brand)
            self.db.commit()
            logger.info(f"Created new brand: {brand_name}")
        
        return brand
    
    def get_or_create_seller(self, seller_data: Dict[str, Any], source: str) -> Optional[Seller]:
        """获取或创建卖家信息"""
        if not seller_data or not seller_data.get('name'):
            return None
        
        source_id = seller_data.get('source_id')
        
        if source_id:
            seller = self.db.query(Seller).filter_by(
                source=source, 
                source_id=source_id
            ).first()
            
            if seller:
                return seller
        
        seller = Seller(
            name=seller_data.get('name'),
            contact_person=seller_data.get('contact_person'),
            phone=seller_data.get('phone'),
            email=seller_data.get('email'),
            wechat=seller_data.get('wechat'),
            qq=seller_data.get('qq'),
            region=seller_data.get('region'),
            city=seller_data.get('city'),
            address=seller_data.get('address'),
            seller_type=seller_data.get('seller_type'),
            source=source,
            source_id=source_id
        )
        
        self.db.add(seller)
        self.db.commit()
        logger.info(f"Created new seller: {seller_data.get('name')}")
        
        return seller
    
    def process_machine_data(self, data: Dict[str, Any], 
                            source: str) -> Optional[Machine]:
        """处理单条农机数据"""
        try:
            # 获取或创建品牌
            brand = self.get_or_create_brand(
                data.get('brand'),
                en_name=data.get('brand_en'),
                country=data.get('country')
            )
            
            # 获取或创建卖家信息
            seller = None
            if data.get('seller_info'):
                seller = self.get_or_create_seller(data['seller_info'], source)
            
            # 查检是否已存在
            source_id = data.get('source_id')
            if source_id:
                existing = self.db.query(Machine).filter_by(
                    source=source,
                    source_id=source_id
                ).first()
                
                if existing:
                    # 更新现有机器信息
                    return self._update_machine(existing, data, brand, seller)
            
            # 创建新的农机记录
            machine = Machine(
                brand_id=brand.id,
                seller_id=seller.id if seller else None,
                model=data.get('model'),
                machine_type=data.get('machine_type', '拖拉机'),
                price=float(data.get('price', 0)),
                price_min=float(data.get('price_min')) if data.get('price_min') else None,
                price_max=float(data.get('price_max')) if data.get('price_max') else None,
                year=int(data.get('year')) if data.get('year') else None,
                working_hours=int(data.get('working_hours')) if data.get('working_hours') else None,
                new_rate=float(data.get('new_rate')) if data.get('new_rate') else None,
                color=data.get('color'),
                engine_power=float(data.get('engine_power')) if data.get('engine_power') else None,
                transmission_type=data.get('transmission_type'),
                fuel_type=data.get('fuel_type'),
                region=data.get('region'),
                city=data.get('city'),
                registration_status=data.get('registration_status'),
                source=source,
                source_url=data.get('source_url'),
                source_id=source_id,
                description=data.get('description'),
                notes=data.get('notes'),
                scraped_at=datetime.utcnow()
            )
            
            self.db.add(machine)
            self.db.commit()
            logger.info(f"Created new machine: {data.get('brand')} {data.get('model')}")
            
            return machine
        
        except Exception as e:
            logger.error(f"Error processing machine data: {e}")
            self.db.rollback()
            return None
    
    def _update_machine(self, machine: Machine, data: Dict[str, Any], 
                       brand: Brand, seller: Optional[Seller]) -> Machine:
        """更新现有农机信息"""
        try:
            machine.brand_id = brand.id
            machine.seller_id = seller.id if seller else machine.seller_id
            machine.model = data.get('model', machine.model)
            machine.price = float(data.get('price', machine.price))
            machine.year = int(data.get('year')) if data.get('year') else machine.year
            machine.working_hours = int(data.get('working_hours')) if data.get('working_hours') else machine.working_hours
            machine.new_rate = float(data.get('new_rate')) if data.get('new_rate') else machine.new_rate
            machine.description = data.get('description', machine.description)
            machine.updated_at = datetime.utcnow()
            
            self.db.commit()
            logger.info(f"Updated machine: {machine.brand.cn_name} {machine.model}")
            
            return machine
        except Exception as e:
            logger.error(f"Error updating machine: {e}")
            self.db.rollback()
            return machine
    
    def process_batch(self, data_list: List[Dict[str, Any]], 
                     source: str) -> Dict[str, int]:
        """批量处理数据"""
        results = {
            'total': len(data_list),
            'success': 0,
            'failed': 0,
            'errors': []
        }
        
        for idx, data in enumerate(data_list):
            try:
                machine = self.process_machine_data(data, source)
                if machine:
                    results['success'] += 1
                else:
                    results['failed'] += 1
            except Exception as e:
                results['failed'] += 1
                results['errors'].append({
                    'index': idx,
                    'error': str(e)
                })
                logger.error(f"Batch processing error at index {idx}: {e}")
        
        return results
    
    def record_crawl_log(self, source: str, status: str, 
                        total_items: int, new_items: int = 0, 
                        updated_items: int = 0, error_message: str = None,
                        duration: int = 0):
        """记录爬虫日志"""
        try:
            log = CrawlLog(
                source=source,
                status=status,
                total_items=total_items,
                new_items=new_items,
                updated_items=updated_items,
                error_message=error_message,
                duration=duration
            )
            
            self.db.add(log)
            self.db.commit()
            logger.info(f"Recorded crawl log for {source}: {status}")
        except Exception as e:
            logger.error(f"Error recording crawl log: {e}")
    
    def record_validation_error(self, source: str, source_id: str, 
                               error_type: str, error_message: str, 
                               raw_data: str = None):
        """记录验证错误"""
        try:
            error = ValidationError(
                source=source,
                source_id=source_id,
                error_type=error_type,
                error_message=error_message,
                raw_data=raw_data
            )
            
            self.db.add(error)
            self.db.commit()
            logger.info(f"Recorded validation error for {source_id}")
        except Exception as e:
            logger.error(f"Error recording validation error: {e}")


class DataCleaner:
    """数据清洗器"""
    
    @staticmethod
    def clean_price(price: Any) -> Optional[float]:
        """清洗价格数据"""
        if price is None:
            return None
        
        if isinstance(price, (int, float)):
            return float(price)
        
        if isinstance(price, str):
            # 移除货币符号和空格
            price = price.strip().replace('¥', '').replace('万元', '').strip()
            try:
                return float(price)
            except ValueError:
                return None
        
        return None
    
    @staticmethod
    def clean_model(model: str) -> Optional[str]:
        """清洗型号数据"""
        if not model:
            return None
        
        # 去掉前后空格
        model = model.strip()
        
        # 统一大小写格式
        return model
    
    @staticmethod
    def clean_year(year: Any) -> Optional[int]:
        """清洗生产年份"""
        if year is None:
            return None
        
        if isinstance(year, int):
            return year
        
        if isinstance(year, str):
            year = year.strip()
            try:
                return int(year)
            except ValueError:
                return None
        
        return None
    
    @staticmethod
    def clean_region(region: str) -> Optional[str]:
        """清洗地区信息"""
        if not region:
            return None
        
        region = region.strip()
        
        # 移除省/市等后缀
        region = region.replace('省', '').replace('市', '').strip()
        
        return region if region else None
    
    @staticmethod
    def normalize_brand_name(brand: str) -> str:
        """规范化品牌名称"""
        if not brand:
            return ''
        
        brand = brand.strip()
        
        # 品牌名称映射
        brand_mapping = {
            '迪尔': '迪尔',
            'john deere': '迪尔',
            'JD': '迪尔',
            '麦赛': '麦赛福格森',
            'massey': '麦赛福格森',
            '凯斯': '凯斯',
            'case': '凯斯',
            '纽荷兰': '纽荷兰',
            'new holland': '纽荷兰',
            '克拉斯': '克拉斯',
            'claas': '克拉斯',
            '久保田': '久保田',
            'kubota': '久保田',
        }
        
        return brand_mapping.get(brand.lower(), brand)


class DataEnricher:
    """数据增强器"""
    
    @staticmethod
    def enrich_with_market_data(machine: Machine, market_data: Dict[str, Any]):
        """用市场数据增强农机信息"""
        if not market_data:
            return machine
        
        # 添加价格历史记录
        price_history = PriceHistory(
            machine_id=machine.id,
            price=machine.price,
            avg_price=market_data.get('avg_price'),
            price_trend=market_data.get('price_trend')
        )
        
        return machine
    
    @staticmethod
    def calculate_price_trend(prices: List[float]) -> str:
        """计算价格趋势"""
        if not prices or len(prices) < 2:
            return '稳定'
        
        recent_avg = sum(prices[-3:]) / len(prices[-3:])
        older_avg = sum(prices[:3]) / len(prices[:3])
        
        change_rate = (recent_avg - older_avg) / older_avg
        
        if change_rate > 0.05:
            return '上升'
        elif change_rate < -0.05:
            return '下降'
        else:
            return '稳定'
