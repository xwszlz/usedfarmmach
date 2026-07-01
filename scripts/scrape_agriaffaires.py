#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
#1 卖方采集 Agent — Agriaffaires 采集脚本
=========================================
目标：采集 Agriaffaires.co.uk 上 CLAAS 品牌的二手农机在售列表
输出：scripts/agriaffaires_data.json（供 import-seller-scout.ts 导入）

采集品类：
  1. Forage harvesters (青储机) — JAGUAR 系列
  2. Balers (打捆机) — QUADRANT 系列
  3. Combine harvesters (联合收割机) — LEXION 系列
  4. Tractors (拖拉机) — ARION/XERION 系列

用法：
  python scripts/scrape_agriaffaires.py [--pages N] [--dry-run]

环境变量（可选）：
  AGRIAFF_USER_AGENT — 自定义 UA（默认随机）
"""

import json
import os
import re
import sys
import time
import random
import logging
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

import urllib3

# ── 日志 ──────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("agriaff-scraper")

# ── 配置 ──────────────────────────────────────────────────
BASE_URL = "https://www.agriaffaires.co.uk"

# CLAAS 品牌在各品类的 URL slug
CATEGORIES = [
    {"name": "forage-harvester", "label": "Forage harvester", "category": "forage_harvester"},
    {"name": "baler", "label": "Baler", "category": "baler"},
    {"name": "combine-harvester", "label": "Combine harvester", "category": "combine_harvester"},
    {"name": "farm-tractor", "label": "Tractor", "category": "tractor"},
]

DEFAULT_PAGES = 3  # 每个品类默认采集页数
DELAY_MIN, DELAY_MAX = 2.0, 4.0  # 请求间隔（秒）

UA_POOL = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
]

# ── HTTP 客户端 ───────────────────────────────────────────
http = urllib3.PoolManager(
    retries=urllib3.Retry(total=2, backoff_factor=1.5),
    timeout=urllib3.Timeout(connect=15, read=30),
)


def fetch_page(url: str) -> str | None:
    """获取页面 HTML，带重试和随机 UA"""
    headers = {
        "User-Agent": os.environ.get("AGRIAFF_USER_AGENT") or random.choice(UA_POOL),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-GB,en;q=0.9",
        "Accept-Encoding": "gzip, deflate",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
    }
    try:
        resp = http.request("GET", url, headers=headers)
        if resp.status == 200:
            return resp.data.decode("utf-8", errors="replace")
        elif resp.status in (403, 429):
            log.warning(f"  被反爬限制 (HTTP {resp.status})，跳过: {url}")
            return None
        else:
            log.warning(f"  HTTP {resp.status}: {url}")
            return None
    except Exception as e:
        log.warning(f"  请求失败: {e}")
        return None


# ── HTML 解析（正则，不依赖 bs4） ─────────────────────────
def extract_listings(html: str, category_label: str, category_key: str) -> list[dict]:
    """
    从 Agriaffaires 搜索结果页 HTML 中提取农机列表
    Agriaffaires 的列表项通常在 <li class="regular-listing"> 或类似容器中
    """
    listings = []

    # 策略1：查找包含价格信息的列表项块
    # Agriaffaires 的 listing 块通常包含品牌、型号、年份、价格
    # 尝试匹配 <li ...> ... <a ...>brand model year</a> ... price ... </li>
    listing_blocks = re.findall(
        r'<li[^>]*class="[^"]*(?:regular-listing|listing-item|search-result)[^"]*"[^>]*>(.*?)</li>',
        html,
        re.DOTALL | re.IGNORECASE,
    )

    if not listing_blocks:
        # 策略2：查找 article 标签
        listing_blocks = re.findall(
            r'<article[^>]*>(.*?)</article>',
            html,
            re.DOTALL | re.IGNORECASE,
        )

    if not listing_blocks:
        # 策略3：查找包含价格的模式块
        listing_blocks = re.findall(
            r'(<div[^>]*class="[^"]*listing[^"]*"[^>]*>.*?</div>)',
            html,
            re.DOTALL | re.IGNORECASE,
        )

    log.info(f"  找到 {len(listing_blocks)} 个列表块")

    for block in listing_blocks:
        listing = parse_listing_block(block, category_label, category_key)
        if listing:
            listings.append(listing)

    return listings


def parse_listing_block(block: str, category_label: str, category_key: str) -> dict | None:
    """解析单个列表项块，提取品牌、型号、年份、价格等"""

    # 提取详情链接
    link_match = re.search(r'<a[^>]*href="(/[^"]*?) "[^>]*>', block, re.IGNORECASE)
    if not link_match:
        link_match = re.search(r'href="(/used/[^"]+)"', block, re.IGNORECASE)
    detail_url = urljoin(BASE_URL, link_match.group(1)) if link_match else ""

    # 提取标题（通常在 <a> 标签文本或 <h2>/<h3> 中）
    title = ""
    title_match = re.search(r'<(?:a|h2|h3)[^>]*>([^<]+(?:CLAAS|Claas)[^<]*)</', block, re.IGNORECASE)
    if title_match:
        title = title_match.group(1).strip()
    else:
        # 尝试提取品牌+型号
        title_match = re.search(r'title="([^"]*(?:CLAAS|Claas)[^"]*)"', block, re.IGNORECASE)
        if title_match:
            title = title_match.group(1).strip()

    if not title:
        return None

    # 解析品牌和型号
    brand = "CLAAS"
    model_name = title.replace("CLAAS", "").replace("Claas", "").strip()
    # 清理型号
    model_name = re.sub(r'\s+', ' ', model_name).strip()
    if not model_name:
        model_name = "Unknown"

    # 提取年份
    year = None
    year_match = re.search(r'\b(19[89]\d|20[0-4]\d)\b', title + " " + block)
    if year_match:
        year = int(year_match.group(1))

    # 提取工作小时数
    engine_hours = None
    hours_match = re.search(r'(\d[\d,]+)\s*(?:h\b|hours?\b|工时)', block, re.IGNORECASE)
    if hours_match:
        try:
            engine_hours = int(hours_match.group(1).replace(",", ""))
        except ValueError:
            pass

    # 提取价格
    price_eur = None
    is_on_request = False

    # 匹配 EUR 价格
    price_match = re.search(r'[€]\s*([\d.,]+)', block)
    if price_match:
        price_str = price_match.group(1).replace(".", "").replace(",", "")
        try:
            price_eur = float(price_str)
        except ValueError:
            pass
    else:
        # 尝试 "EUR 123,456" 格式
        price_match = re.search(r'EUR\s*([\d.,]+)', block, re.IGNORECASE)
        if price_match:
            price_str = price_match.group(1).replace(".", "").replace(",", "")
            try:
                price_eur = float(price_str)
            except ValueError:
                pass

    if price_eur is None:
        if re.search(r'(price on request|on request|sur devis|prix sur demande)', block, re.IGNORECASE):
            is_on_request = True

    # 提取位置/国家
    location = ""
    country = ""
    loc_match = re.search(r'class="[^"]*(?:location|country|region)[^"]*"[^>]*>([^<]+)<', block, re.IGNORECASE)
    if loc_match:
        location = loc_match.group(1).strip()
        country = location

    # 如果没找到位置，尝试从文本中提取国家名
    if not country:
        for c in ["France", "Germany", "Spain", "Italy", "Netherlands", "Belgium",
                   "Poland", "United Kingdom", "Denmark", "Austria", "Switzerland"]:
            if c.lower() in block.lower():
                country = c
                location = c
                break

    return {
        "brand": brand,
        "modelName": model_name,
        "category": category_key,
        "modelDetail": title,
        "year": year,
        "engineHours": engine_hours,
        "priceEur": price_eur,
        "isOnRequest": is_on_request,
        "country": country or "Unknown",
        "location": location or "Unknown",
        "source": "agriaffaires",
        "sourceDate": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "sourceUrl": detail_url,
    }


# ── 主流程 ────────────────────────────────────────────────
def scrape_category(cat: dict, max_pages: int) -> list[dict]:
    """采集某个品类的所有页面"""
    all_listings = []

    for page_num in range(1, max_pages + 1):
        if page_num == 1:
            url = f"{BASE_URL}/second-hand/{cat['name']}/claas/1.html"
        else:
            url = f"{BASE_URL}/second-hand/{cat['name']}/claas/{page_num}.html"

        log.info(f"  [{cat['label']}] 第 {page_num}/{max_pages} 页: {url}")
        html = fetch_page(url)

        if not html:
            log.warning(f"  第 {page_num} 页获取失败，跳过后续页")
            break

        listings = extract_listings(html, cat["label"], cat["category"])
        if not listings:
            log.info(f"  第 {page_num} 页无列表数据，可能已到末尾")
            break

        all_listings.extend(listings)
        log.info(f"  第 {page_num} 页: {len(listings)} 条")

        if page_num < max_pages:
            delay = random.uniform(DELAY_MIN, DELAY_MAX)
            time.sleep(delay)

    return all_listings


def main():
    # 解析参数
    args = sys.argv[1:]
    dry_run = "--dry-run" in args
    max_pages = DEFAULT_PAGES

    for i, arg in enumerate(args):
        if arg == "--pages" and i + 1 < len(args):
            try:
                max_pages = int(args[i + 1])
            except ValueError:
                pass

    log.info("=" * 60)
    log.info("Agriaffaires CLAAS 采集器")
    log.info(f"品类: {len(CATEGORIES)} | 每品类页数: {max_pages} | Dry run: {dry_run}")
    log.info("=" * 60)

    all_listings = []
    category_stats = []

    for cat in CATEGORIES:
        log.info(f"\n--- 采集: {cat['label']} ---")
        listings = scrape_category(cat, max_pages)
        all_listings.extend(listings)
        category_stats.append({
            "category": cat["label"],
            "count": len(listings),
        })

    # 去重（按 sourceUrl）
    seen_urls = set()
    unique_listings = []
    for l in all_listings:
        key = l.get("sourceUrl") or f"{l['brand']}|{l['modelName']}|{l.get('year','')}"
        if key not in seen_urls:
            seen_urls.add(key)
            unique_listings.append(l)

    with_price = sum(1 for l in unique_listings if l["priceEur"] is not None)
    on_request = sum(1 for l in unique_listings if l["isOnRequest"])

    output = {
        "scrapedAt": datetime.now(timezone.utc).isoformat(),
        "source": "agriaffaires",
        "categoryStats": category_stats,
        "totalListings": len(unique_listings),
        "withPrice": with_price,
        "priceOnRequest": on_request,
        "listings": unique_listings,
    }

    log.info("\n" + "=" * 60)
    log.info(f"采集完成:")
    log.info(f"  总计: {len(unique_listings)} 条 (去重前 {len(all_listings)})")
    log.info(f"  有价格: {with_price} | 面议: {on_request}")
    for s in category_stats:
        log.info(f"  {s['category']}: {s['count']} 条")

    if dry_run:
        log.info("\n--dry-run 模式，不写入文件")
        print(json.dumps(output, indent=2, ensure_ascii=False)[:2000])
        return

    # 写入 JSON
    output_path = Path(__file__).parent / "agriaffaires_data.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    log.info(f"\n已写入: {output_path}")
    log.info("=" * 60)


if __name__ == "__main__":
    main()
