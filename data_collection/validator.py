"""
数据验证工具
用于验证采集的数据是否符合规范
"""

import re
from typing import Dict, List, Any, Tuple
from datetime import datetime
from enum import Enum


class ValidationLevel(Enum):
    """验证级别"""
    CRITICAL = 'critical'      # 必须通过
    WARNING = 'warning'        # 警告
    INFO = 'info'              # 信息


class ValidatorResult:
    """验证结果类"""
    def __init__(self):
        self.errors: List[Dict[str, Any]] = []
        self.warnings: List[Dict[str, Any]] = []
        self.is_valid = True
    
    def add_error(self, field: str, message: str, value: Any = None):
        """添加错误"""
        self.errors.append({
            'field': field,
            'message': message,
            'value': value,
            'level': ValidationLevel.CRITICAL.value
        })
        self.is_valid = False
    
    def add_warning(self, field: str, message: str, value: Any = None):
        """添加警告"""
        self.warnings.append({
            'field': field,
            'message': message,
            'value': value,
            'level': ValidationLevel.WARNING.value
        })
    
    def to_dict(self):
        """转换为字典"""
        return {
            'is_valid': self.is_valid,
            'errors': self.errors,
            'warnings': self.warnings,
            'error_count': len(self.errors),
            'warning_count': len(self.warnings)
        }


class MachineDataValidator:
    """农机数据验证器"""
    
    def __init__(self, rules: Dict[str, Dict[str, Any]] = None):
        """初始化验证器"""
        self.rules = rules or {}
        self.price_range = self.rules.get('price', {})
        self.model_rules = self.rules.get('model', {})
        self.working_hours_rules = self.rules.get('working_hours', {})
        self.year_rules = self.rules.get('year', {})
        self.new_rate_rules = self.rules.get('new_rate', {})
    
    def validate_price(self, price: Any) -> Tuple[bool, str]:
        """验证价格"""
        try:
            price = float(price)
        except (ValueError, TypeError):
            return False, f"价格必须是数字，收到: {price}"
        
        min_price = self.price_range.get('min', 0.5)
        max_price = self.price_range.get('max', 100)
        
        if price < min_price:
            return False, f"价格过低({price}万元)，最小值: {min_price}万元"
        
        if price > max_price:
            return False, f"价格过高({price}万元)，最大值: {max_price}万元"
        
        return True, ""
    
    def validate_model(self, model: str) -> Tuple[bool, str]:
        """验证型号"""
        if not model or not isinstance(model, str):
            return False, "型号不能为空且必须是字符串"
        
        model = model.strip()
        min_len = self.model_rules.get('min_length', 2)
        max_len = self.model_rules.get('max_length', 50)
        
        if len(model) < min_len:
            return False, f"型号过短，最少{min_len}个字符"
        
        if len(model) > max_len:
            return False, f"型号过长，最多{max_len}个字符"
        
        # 检查特殊字符
        if not re.match(r'^[\w\-\s/]+$', model):
            return False, f"型号包含不允许的特殊字符: {model}"
        
        return True, ""
    
    def validate_brand(self, brand: str, valid_brands: List[str]) -> Tuple[bool, str]:
        """验证品牌"""
        if not brand or not isinstance(brand, str):
            return False, "品牌不能为空且必须是字符串"
        
        brand = brand.strip()
        if brand not in valid_brands:
            return False, f"品牌'{brand}'不在认可的品牌列表中"
        
        return True, ""
    
    def validate_year(self, year: Any) -> Tuple[bool, str]:
        """验证生产年份"""
        if year is None:
            return True, ""  # 年份是可选的
        
        try:
            year = int(year)
        except (ValueError, TypeError):
            return False, f"年份必须是整数，收到: {year}"
        
        min_year = self.year_rules.get('min', 1990)
        max_year = self.year_rules.get('max', datetime.now().year)
        
        if year < min_year or year > max_year:
            return False, f"年份必须在{min_year}到{max_year}之间"
        
        return True, ""
    
    def validate_working_hours(self, hours: Any) -> Tuple[bool, str]:
        """验证工作小时数"""
        if hours is None:
            return True, ""  # 工作小时数是可选的
        
        try:
            hours = float(hours)
        except (ValueError, TypeError):
            return False, f"工作小时数必须是数字，收到: {hours}"
        
        if hours < 0:
            return False, "工作小时数不能为负数"
        
        max_hours = self.working_hours_rules.get('max', 50000)
        if hours > max_hours:
            return False, f"工作小时数超过合理范围({max_hours}小时)"
        
        return True, ""
    
    def validate_new_rate(self, rate: Any) -> Tuple[bool, str]:
        """验证成新度"""
        if rate is None:
            return True, ""  # 成新度是可选的
        
        try:
            rate = float(rate)
        except (ValueError, TypeError):
            return False, f"成新度必须是数字，收到: {rate}"
        
        if rate < 0 or rate > 100:
            return False, f"成新度必须在0到100之间，收到: {rate}"
        
        return True, ""
    
    def validate_region(self, region: str, valid_regions: Dict[str, List[str]]) -> Tuple[bool, str]:
        """验证地区"""
        if not region or not isinstance(region, str):
            return False, "地区不能为空且必须是字符串"
        
        # 展平所有有效地区
        all_regions = []
        for regions_list in valid_regions.values():
            all_regions.extend(regions_list)
        
        if region not in all_regions:
            return False, f"地区'{region}'不在认可的地区列表中"
        
        return True, ""
    
    def validate_machine_data(self, data: Dict[str, Any], 
                            valid_brands: List[str], 
                            valid_regions: Dict[str, List[str]]) -> ValidatorResult:
        """验证完整的农机数据"""
        result = ValidatorResult()
        
        # 必填字段验证
        required_fields = ['brand', 'model', 'price', 'source']
        for field in required_fields:
            if field not in data or not data[field]:
                result.add_error(field, f"必填字段不能为空")
                continue
        
        # 品牌验证
        if 'brand' in data:
            valid, msg = self.validate_brand(data['brand'], valid_brands)
            if not valid:
                result.add_error('brand', msg, data['brand'])
        
        # 型号验证
        if 'model' in data:
            valid, msg = self.validate_model(data['model'])
            if not valid:
                result.add_error('model', msg, data['model'])
        
        # 价格验证
        if 'price' in data:
            valid, msg = self.validate_price(data['price'])
            if not valid:
                result.add_error('price', msg, data['price'])
        
        # 年份验证
        if 'year' in data and data['year']:
            valid, msg = self.validate_year(data['year'])
            if not valid:
                result.add_warning('year', msg, data['year'])
        
        # 工作小时数验证
        if 'working_hours' in data and data['working_hours']:
            valid, msg = self.validate_working_hours(data['working_hours'])
            if not valid:
                result.add_warning('working_hours', msg, data['working_hours'])
        
        # 成新度验证
        if 'new_rate' in data and data['new_rate']:
            valid, msg = self.validate_new_rate(data['new_rate'])
            if not valid:
                result.add_warning('new_rate', msg, data['new_rate'])
        
        # 地区验证
        if 'region' in data and data['region']:
            valid, msg = self.validate_region(data['region'], valid_regions)
            if not valid:
                result.add_warning('region', msg, data['region'])
        
        return result


class BatchValidator:
    """批量数据验证器"""
    
    def __init__(self, validator: MachineDataValidator):
        self.validator = validator
    
    def validate_batch(self, data_list: List[Dict[str, Any]], 
                      valid_brands: List[str], 
                      valid_regions: Dict[str, List[str]]) -> Dict[str, Any]:
        """批量验证数据"""
        results = {
            'total': len(data_list),
            'valid': 0,
            'invalid': 0,
            'warnings': 0,
            'details': []
        }
        
        for idx, data in enumerate(data_list):
            result = self.validator.validate_machine_data(data, valid_brands, valid_regions)
            
            if result.is_valid:
                results['valid'] += 1
            else:
                results['invalid'] += 1
            
            if result.warnings:
                results['warnings'] += len(result.warnings)
            
            results['details'].append({
                'index': idx,
                'validation': result.to_dict()
            })
        
        return results


def create_validator(rules: Dict[str, Dict[str, Any]] = None) -> MachineDataValidator:
    """工厂函数：创建验证器"""
    return MachineDataValidator(rules)
