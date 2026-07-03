"""
数据采集框架单元测试
"""

import pytest
from datetime import datetime
from data_collection.validator import MachineDataValidator, ValidatorResult
from data_collection.processor import DataCleaner


class TestDataCleaner:
    """测试数据清洗器"""
    
    def test_clean_price_float(self):
        """测试清洗浮点数价格"""
        assert DataCleaner.clean_price(25.5) == 25.5
    
    def test_clean_price_int(self):
        """测试清洗整数价格"""
        assert DataCleaner.clean_price(25) == 25.0
    
    def test_clean_price_string(self):
        """测试清洗字符串价格"""
        assert DataCleaner.clean_price("¥25万元") == 25.0
        assert DataCleaner.clean_price("25") == 25.0
    
    def test_clean_price_invalid(self):
        """测试清洗无效价格"""
        assert DataCleaner.clean_price("invalid") is None
        assert DataCleaner.clean_price(None) is None
    
    def test_clean_model(self):
        """测试清洗型号"""
        assert DataCleaner.clean_model("  TY2000  ") == "TY2000"
        assert DataCleaner.clean_model("") is None
        assert DataCleaner.clean_model(None) is None
    
    def test_clean_year(self):
        """测试清洗年份"""
        assert DataCleaner.clean_year(2020) == 2020
        assert DataCleaner.clean_year("2020") == 2020
        assert DataCleaner.clean_year("invalid") is None
        assert DataCleaner.clean_year(None) is None
    
    def test_clean_region(self):
        """测试清洗地区"""
        assert DataCleaner.clean_region("河北省") == "河北"
        assert DataCleaner.clean_region("北京市") == "北京"
        assert DataCleaner.clean_region("  山西省  ") == "山西"
    
    def test_normalize_brand_name(self):
        """测试规范化品牌名称"""
        assert DataCleaner.normalize_brand_name("john deere") == "迪尔"
        assert DataCleaner.normalize_brand_name("JD") == "迪尔"
        assert DataCleaner.normalize_brand_name("kubota") == "久保田"


class TestMachineDataValidator:
    """测试农机数据验证器"""
    
    def setup_method(self):
        """测试前的初始化"""
        self.validator = MachineDataValidator({
            'price': {'min': 0.5, 'max': 100},
            'model': {'min_length': 2, 'max_length': 50},
            'year': {'min': 1990, 'max': 2024},
            'working_hours': {'max': 50000},
            'new_rate': {'min': 0, 'max': 100},
        })
    
    def test_validate_price_valid(self):
        """测试有效价格验证"""
        valid, msg = self.validator.validate_price(25.0)
        assert valid is True
        assert msg == ""
    
    def test_validate_price_too_low(self):
        """测试过低价格验证"""
        valid, msg = self.validator.validate_price(0.1)
        assert valid is False
        assert "过低" in msg
    
    def test_validate_price_too_high(self):
        """测试过高价格验证"""
        valid, msg = self.validator.validate_price(150.0)
        assert valid is False
        assert "过高" in msg
    
    def test_validate_model_valid(self):
        """测试有效型号验证"""
        valid, msg = self.validator.validate_model("TY2000")
        assert valid is True
    
    def test_validate_model_too_short(self):
        """测试过短型号验证"""
        valid, msg = self.validator.validate_model("A")
        assert valid is False
    
    def test_validate_year_valid(self):
        """测试有效年份验证"""
        valid, msg = self.validator.validate_year(2020)
        assert valid is True
    
    def test_validate_year_invalid(self):
        """测试无效年份验证"""
        valid, msg = self.validator.validate_year(1980)
        assert valid is False
    
    def test_validate_working_hours_valid(self):
        """测试有效工作小时数验证"""
        valid, msg = self.validator.validate_working_hours(5000)
        assert valid is True
    
    def test_validate_working_hours_negative(self):
        """测试负数工作小时数验证"""
        valid, msg = self.validator.validate_working_hours(-100)
        assert valid is False
    
    def test_validate_new_rate_valid(self):
        """测试有效成新度验证"""
        valid, msg = self.validator.validate_new_rate(85)
        assert valid is True
    
    def test_validate_new_rate_invalid(self):
        """测试无效成新度验证"""
        valid, msg = self.validator.validate_new_rate(150)
        assert valid is False
    
    def test_validate_machine_data_valid(self):
        """测试有效农机数据验证"""
        data = {
            'brand': '迪尔',
            'model': 'TY2000',
            'price': 25.0,
            'year': 2020,
            'working_hours': 5000,
            'new_rate': 85,
            'region': '河北'
        }
        
        valid_brands = ['迪尔', '麦赛福格森', '克拉斯']
        valid_regions = {'华北': ['河北', '北京'], '华东': ['江苏', '浙江']}
        
        result = self.validator.validate_machine_data(data, valid_brands, valid_regions)
        assert result.is_valid is True
        assert len(result.errors) == 0
    
    def test_validate_machine_data_missing_required(self):
        """测试缺少必填字段的验证"""
        data = {
            'model': 'TY2000',
            'price': 25.0,
        }
        
        valid_brands = ['迪尔']
        valid_regions = {'华北': ['河北']}
        
        result = self.validator.validate_machine_data(data, valid_brands, valid_regions)
        assert result.is_valid is False
        assert len(result.errors) > 0
    
    def test_validate_machine_data_invalid_brand(self):
        """测试无效品牌验证"""
        data = {
            'brand': '未知品牌',
            'model': 'TY2000',
            'price': 25.0,
        }
        
        valid_brands = ['迪尔', '麦赛福格森']
        valid_regions = {'华北': ['河北']}
        
        result = self.validator.validate_machine_data(data, valid_brands, valid_regions)
        assert result.is_valid is False


class TestValidatorResult:
    """测试验证结果类"""
    
    def test_validator_result_valid(self):
        """测试有效的验证结果"""
        result = ValidatorResult()
        assert result.is_valid is True
        assert len(result.errors) == 0
        assert len(result.warnings) == 0
    
    def test_add_error(self):
        """测试添加错误"""
        result = ValidatorResult()
        result.add_error('price', 'Price too low', 1.0)
        
        assert result.is_valid is False
        assert len(result.errors) == 1
        assert result.errors[0]['field'] == 'price'
    
    def test_add_warning(self):
        """测试添加警告"""
        result = ValidatorResult()
        result.add_warning('year', 'Year is old', 2000)
        
        assert result.is_valid is True
        assert len(result.warnings) == 1
        assert result.warnings[0]['field'] == 'year'
    
    def test_to_dict(self):
        """测试转换为字典"""
        result = ValidatorResult()
        result.add_error('price', 'Invalid price')
        result.add_warning('year', 'Old year')
        
        result_dict = result.to_dict()
        
        assert result_dict['is_valid'] is False
        assert result_dict['error_count'] == 1
        assert result_dict['warning_count'] == 1
        assert len(result_dict['errors']) == 1
        assert len(result_dict['warnings']) == 1


class TestIntegration:
    """集成测试"""
    
    def test_data_cleaning_and_validation(self):
        """测试数据清洗和验证集成"""
        # 原始数据
        raw_data = {
            'brand': 'john deere',
            'model': '  TY2000  ',
            'price': '¥25万元',
            'year': '2020',
            'region': '河北省'
        }
        
        # 清洗数据
        cleaned_data = {
            'brand': DataCleaner.normalize_brand_name(raw_data['brand']),
            'model': DataCleaner.clean_model(raw_data['model']),
            'price': DataCleaner.clean_price(raw_data['price']),
            'year': DataCleaner.clean_year(raw_data['year']),
            'region': DataCleaner.clean_region(raw_data['region']),
        }
        
        # 验证清洗后的数据
        validator = MachineDataValidator()
        valid_brands = ['迪尔']
        valid_regions = {'华北': ['河北']}
        
        assert cleaned_data['brand'] == '迪尔'
        assert cleaned_data['model'] == 'TY2000'
        assert cleaned_data['price'] == 25.0
        assert cleaned_data['year'] == 2020
        assert cleaned_data['region'] == '河北'


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
