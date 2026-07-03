"""
数据采集框架配置文件
定义数据源、爬虫参数、数据库连接等配置
"""

# 数据源配置
DATA_SOURCES = {
    'alibaba': {
        'name': '阿里巴巴二手农机',
        'base_url': 'https://ershou.alibaba.com',
        'category': 'agriculture-machinery',
        'enabled': True
    },
    'quanguo_farm': {
        'name': '全球农机网',
        'base_url': 'https://www.nongjx.com',
        'category': 'used-machines',
        'enabled': True
    },
    '58': {
        'name': '58同城',
        'base_url': 'https://bj.58.com/nongji',
        'category': 'machinery',
        'enabled': True
    },
    'farm_machinery_network': {
        'name': '农机通',
        'base_url': 'https://www.nongjitong.com',
        'category': 'trading',
        'enabled': True
    }
}

# 爬虫配置
CRAWLER_CONFIG = {
    'timeout': 30,
    'retry_times': 3,
    'retry_delay': 5,
    'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'headers': {
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
    },
    'proxy_enabled': False,
    'proxy_list': [],
}

# 数据库配置
DATABASE_CONFIG = {
    'type': 'postgresql',
    'host': 'localhost',
    'port': 5432,
    'database': 'usedfarmmach',
    'user': 'postgres',
    'password': 'password',
    'pool_size': 10,
    'echo': False,
}

# 日志配置
LOGGING_CONFIG = {
    'log_level': 'INFO',
    'log_file': 'logs/data_collection.log',
    'max_bytes': 10485760,  # 10MB
    'backup_count': 5,
}

# 品牌配置
BRANDS = {
    'john_deere': {'cn_name': '迪尔', 'en_name': 'John Deere', 'country': 'USA'},
    'massey_ferguson': {'cn_name': '麦赛福格森', 'en_name': 'Massey Ferguson', 'country': 'UK'},
    'case_ih': {'cn_name': '凯斯', 'en_name': 'Case IH', 'country': 'USA'},
    'new_holland': {'cn_name': '纽荷兰', 'en_name': 'New Holland', 'country': 'USA'},
    'claas': {'cn_name': '克拉斯', 'en_name': 'CLAAS', 'country': 'Germany'},
    'kubota': {'cn_name': '久保田', 'en_name': 'Kubota', 'country': 'Japan'},
    'minsk': {'cn_name': '明斯克', 'en_name': 'Minsk', 'country': 'Belarus'},
    'coroni': {'cn_name': '科罗尼', 'en_name': 'CORONI', 'country': 'Italy'},
    'mccormick': {'cn_name': '麦克海尔', 'en_name': 'McCormick', 'country': 'USA'},
}

# 验证规则配置
VALIDATION_RULES = {
    'price': {
        'min': 0.5,  # 万元
        'max': 100,
        'required': True
    },
    'model': {
        'min_length': 2,
        'max_length': 50,
        'required': True
    },
    'working_hours': {
        'min': 0,
        'max': 50000,
        'required': False
    },
    'year': {
        'min': 1990,
        'max': 2024,
        'required': False
    },
    'new_rate': {
        'min': 0,
        'max': 100,
        'required': False
    }
}

# 采集频率配置
SCHEDULE_CONFIG = {
    'alibaba': {'frequency': 'daily', 'time': '02:00'},
    'quanguo_farm': {'frequency': 'daily', 'time': '03:00'},
    '58': {'frequency': 'daily', 'time': '04:00'},
    'farm_machinery_network': {'frequency': 'daily', 'time': '05:00'},
}

# 地区配置
REGIONS = {
    'northeast': ['黑龙江', '吉林', '辽宁'],
    'north': ['北京', '天津', '河北', '山西', '内蒙古'],
    'east': ['上海', '江苏', '浙江', '安徽', '福建'],
    'central': ['河南', '湖北', '湖南', '江西'],
    'south': ['广东', '广西', '海南'],
    'southwest': ['重庆', '四川', '贵州', '云南', '西藏'],
    'northwest': ['陕西', '甘肃', '青海', '宁夏', '新疆'],
}
