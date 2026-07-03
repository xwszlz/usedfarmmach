"""
通用爬虫框架
支持多个数据源的爬虫基类
"""

import logging
import time
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from datetime import datetime
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


class BaseCrawler(ABC):
    """爬虫基类"""
    
    def __init__(self, source_name: str, config: Dict[str, Any] = None):
        """初始化爬虫"""
        self.source_name = source_name
        self.config = config or {}
        self.session = self._create_session()
        self.items_count = 0
        self.errors_count = 0
    
    def _create_session(self) -> requests.Session:
        """创建请求会话"""
        session = requests.Session()
        
        # 配置重试策略
        retry_strategy = Retry(
            total=self.config.get('retry_times', 3),
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["GET", "POST"],
            backoff_factor=1
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("http://", adapter)
        session.mount("https://", adapter)
        
        # 设置请求头
        headers = {
            'User-Agent': self.config.get('user_agent', 
                         'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'),
            **self.config.get('headers', {})
        }
        session.headers.update(headers)
        
        return session
    
    def fetch(self, url: str, method: str = 'GET', **kwargs) -> Optional[requests.Response]:
        """获取页面内容"""
        try:
            timeout = self.config.get('timeout', 30)
            response = self.session.request(method, url, timeout=timeout, **kwargs)
            response.raise_for_status()
            return response
        except requests.RequestException as e:
            logger.error(f"Failed to fetch {url}: {e}")
            self.errors_count += 1
            return None
    
    def parse_html(self, html: str) -> BeautifulSoup:
        """解析HTML"""
        return BeautifulSoup(html, 'html.parser')
    
    @abstractmethod
    def extract_items(self, page: int = 1) -> List[Dict[str, Any]]:
        """提取数据项（必须由子类实现）"""
        pass
    
    @abstractmethod
    def extract_item_details(self, item_url: str) -> Dict[str, Any]:
        """提取单项详细信息（必须由子类实现）"""
        pass
    
    def crawl_page(self, page: int = 1) -> List[Dict[str, Any]]:
        """爬取单页数据"""
        logger.info(f"Crawling {self.source_name} page {page}")
        
        items = self.extract_items(page)
        self.items_count += len(items)
        
        # 添加延迟以避免被反爬
        time.sleep(self.config.get('retry_delay', 1))
        
        return items
    
    def crawl_pages(self, start_page: int = 1, end_page: int = 1) -> List[Dict[str, Any]]:
        """爬取多页数据"""
        all_items = []
        
        for page in range(start_page, end_page + 1):
            try:
                items = self.crawl_page(page)
                all_items.extend(items)
            except Exception as e:
                logger.error(f"Error crawling page {page}: {e}")
                self.errors_count += 1
                continue
        
        return all_items
    
    def close(self):
        """关闭会话"""
        self.session.close()
        logger.info(f"Crawler {self.source_name} closed. "
                   f"Items: {self.items_count}, Errors: {self.errors_count}")


class AlibabaCrawler(BaseCrawler):
    """阿里巴巴爬虫（示例实现）"""
    
    def __init__(self, config: Dict[str, Any] = None):
        super().__init__('alibaba', config)
        self.base_url = 'https://ershou.alibaba.com'
    
    def extract_items(self, page: int = 1) -> List[Dict[str, Any]]:
        """提取阿里巴巴商品列表"""
        # 这是示例实现，实际需要根据网站结构调整
        url = f"{self.base_url}/search?pageNum={page}"
        response = self.fetch(url)
        
        if not response:
            return []
        
        items = []
        soup = self.parse_html(response.text)
        
        # 根据网站结构提取数据
        # 这里需要根据实际网站结构调整选择器
        item_elements = soup.find_all('div', class_='item')
        
        for elem in item_elements:
            try:
                title = elem.find('h2')
                price = elem.find('span', class_='price')
                url = elem.find('a')
                
                if title and price and url:
                    items.append({
                        'title': title.text.strip(),
                        'price': price.text.strip(),
                        'url': url.get('href'),
                        'source': 'alibaba'
                    })
            except Exception as e:
                logger.error(f"Error parsing item: {e}")
                continue
        
        return items
    
    def extract_item_details(self, item_url: str) -> Dict[str, Any]:
        """提取商品详细信息"""
        response = self.fetch(item_url)
        
        if not response:
            return {}
        
        soup = self.parse_html(response.text)
        
        # 提取详细信息
        details = {
            'url': item_url,
            'source': 'alibaba'
        }
        
        # 根据网站结构提取数据
        # 这里需要根据实际网站结构调整选择器
        
        return details


class QuanguoCrawler(BaseCrawler):
    """全球农机网爬虫（示例实现）"""
    
    def __init__(self, config: Dict[str, Any] = None):
        super().__init__('quanguo_farm', config)
        self.base_url = 'https://www.nongjx.com'
    
    def extract_items(self, page: int = 1) -> List[Dict[str, Any]]:
        """提取全球农机网商品列表"""
        url = f"{self.base_url}/used-machines?page={page}"
        response = self.fetch(url)
        
        if not response:
            return []
        
        items = []
        soup = self.parse_html(response.text)
        
        # 根据网站结构提取数据
        item_elements = soup.find_all('div', class_='machine-item')
        
        for elem in item_elements:
            try:
                title = elem.find('h3')
                price = elem.find('span', class_='machine-price')
                url = elem.find('a')
                
                if title and price and url:
                    items.append({
                        'title': title.text.strip(),
                        'price': price.text.strip(),
                        'url': url.get('href'),
                        'source': 'quanguo_farm'
                    })
            except Exception as e:
                logger.error(f"Error parsing item: {e}")
                continue
        
        return items
    
    def extract_item_details(self, item_url: str) -> Dict[str, Any]:
        """提取商品详细信息"""
        response = self.fetch(item_url)
        
        if not response:
            return {}
        
        soup = self.parse_html(response.text)
        
        details = {
            'url': item_url,
            'source': 'quanguo_farm'
        }
        
        return details


class CrawlerFactory:
    """爬虫工厂"""
    
    _crawlers = {
        'alibaba': AlibabaCrawler,
        'quanguo_farm': QuanguoCrawler,
    }
    
    @classmethod
    def create_crawler(cls, source_name: str, config: Dict[str, Any] = None) -> BaseCrawler:
        """创建爬虫实例"""
        crawler_class = cls._crawlers.get(source_name)
        
        if not crawler_class:
            raise ValueError(f"Unknown crawler: {source_name}")
        
        return crawler_class(config)
    
    @classmethod
    def register_crawler(cls, source_name: str, crawler_class: type):
        """注册新的爬虫"""
        cls._crawlers[source_name] = crawler_class


class CrawlerPool:
    """爬虫池，管理多个爬虫"""
    
    def __init__(self):
        self.crawlers: Dict[str, BaseCrawler] = {}
    
    def add_crawler(self, source_name: str, crawler: BaseCrawler):
        """添加爬虫"""
        self.crawlers[source_name] = crawler
    
    def get_crawler(self, source_name: str) -> Optional[BaseCrawler]:
        """获取爬虫"""
        return self.crawlers.get(source_name)
    
    def crawl_all(self, pages: int = 1) -> Dict[str, List[Dict[str, Any]]]:
        """并行爬取所有数据源"""
        results = {}
        
        for source_name, crawler in self.crawlers.items():
            try:
                logger.info(f"Starting crawler: {source_name}")
                items = crawler.crawl_pages(1, pages)
                results[source_name] = items
                logger.info(f"Crawler {source_name} completed: {len(items)} items")
            except Exception as e:
                logger.error(f"Crawler {source_name} failed: {e}")
                results[source_name] = []
        
        return results
    
    def close_all(self):
        """关闭所有爬虫"""
        for crawler in self.crawlers.values():
            try:
                crawler.close()
            except Exception as e:
                logger.error(f"Error closing crawler: {e}")
