#!/usr/bin/env python3
"""
#1 卖方采集 Agent — 国内全平台卖家爬虫 V2
============================================
采集国内平台上在售的二手国际品牌农机信息。

目标品牌（9大国际品牌）：
  John Deere / CLAAS / New Holland / Case IH / Massey Ferguson
  MTZ/Belarus / Kubota / Krone / McHale

目标国内平台：
  1. Mascus中国 (mascus.cn) — 国际品牌二手农机，结构化数据好
  2. traktorpool.cn — 德国平台中文版，欧洲在售农机
  3. 农机通 (nongjitong.com) — 卖家直发的二手信息
  4. 58同城 (58.com) — 二手农机分类，覆盖面广
  5. 百度爱采购 (b2b.baidu.com) — 企业卖家B2B

输出：标准 JSON 格式，与 import-seller-scout-domestic.ts 兼容
"""

import requests
import re
import json
import time
import hashlib
import os
import sys
from datetime import datetime
from urllib.parse import quote, urljoin

# ── 配置 ──

PROXY = os.environ.get("HTTPS_PROXY", "")
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}

# 9大国际品牌 → 中文名 + 搜索关键词
BRANDS = [
    {"id": "john-deere", "zh": "约翰迪尔", "en": "John Deere", "alias": ["迪尔"]},
    {"id": "claas", "zh": "克拉斯", "en": "CLAAS", "alias": []},
    {"id": "new-holland", "zh": "纽荷兰", "en": "New Holland", "alias": []},
    {"id": "case-ih", "zh": "凯斯", "en": "Case IH", "alias": ["凯斯纽荷兰"]},
    {"id": "massey-ferguson", "zh": "麦赛福格森", "en": "Massey Ferguson", "alias": ["爱科"]},
    {"id": "mtz", "zh": "明斯克", "en": "MTZ", "alias": ["白俄罗斯", "Belarus"]},
    {"id": "kubota", "zh": "久保田", "en": "Kubota", "alias": []},
    {"id": "krone", "zh": "科罗尼", "en": "Krone", "alias": []},
    {"id": "mchale", "zh": "麦克海尔", "en": "McHale", "alias": []},
]

# 输出文件
OUTPUT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "usedfarmmach", "scripts", "domestic_sellers_data_v2.json")


def get_session():
    """创建带代理的 requests session"""
    sess = requests.Session()
    sess.headers.update(HEADERS)
    if PROXY:
        sess.proxies = {"http": PROXY, "https": PROXY}
    return sess


def extract_json_from_html(text: str) -> dict | None:
    """从HTML中提取JSON-LD结构化数据"""
    # 搜索 application/ld+json
    for m in re.finditer(r'<script[^>]*type="application/ld+json"[^>]*>(.*?)</script>', text, re.DOTALL):
        try:
            return json.loads(m.group(1))
        except:
            continue
    return None


def normalize_price(text: str) -> float | None:
    """从文本中提取价格（万元→元）"""
    if not text:
        return None
    text = text.replace(",", "").replace("，", "").strip()
    # 万元 → 元（如 "5.8万"）
    m = re.search(r'([\d.]+)\s*万', text)
    if m:
        return round(float(m.group(1)) * 10000, 2)
    # 元（如 "58000元"）
    m = re.search(r'([\d.]+)\s*元', text)
    if m:
        return float(m.group(1))
    # 纯数字（万单位）
    m = re.search(r'^([\d.]+)万?$', text)
    if m:
        return float(m.group(1)) * 10000 if "万" in text else float(m.group(1))
    return None


def extract_year(text: str) -> int | None:
    """从文本中提取年份"""
    if not text:
        return None
    m = re.search(r'(19\d{2}|20[0-2]\d)', text)
    if m:
        return int(m.group(1))
    return None


def extract_hours(text: str) -> int | None:
    """从文本中提取工作小时数"""
    if not text:
        return None
    m = re.search(r'(\d+)\s*[小h时時鐘钟]', text)
    if m:
        return int(m.group(1))
    # 纯数字+小时/小时
    m = re.search(r'(\d{3,5})\s*h', text, re.IGNORECASE)
    if m:
        return int(m.group(1))
    return None


def extract_phone(text: str) -> str | None:
    """从文本中提取手机号"""
    if not text:
        return None
    m = re.search(r'(1[3-9]\d{9})', text)
    if m:
        return m.group(1)
    return None


def generate_content_hash(brand: str, model: str, year: int | None, location: str, price: float | None) -> str:
    """生成去重哈希"""
    key = f"{brand}|{model}|{year or ''}|{location}|{price or ''}"
    return hashlib.md5(key.encode()).hexdigest()


# ═══════════════════════════════════════════════
# 平台 1: Mascus中国 (mascus.cn)
# ═══════════════════════════════════════════════

def scrape_mascus(sess, brand: dict) -> list[dict]:
    """采集 Mascus 中国站"""
    results = []
    search_terms = [brand["zh"], brand["en"]] + brand["alias"]

    for term in search_terms[:2]:  # 最多试2个搜索词
        url = f"https://www.mascus.cn/二手农机/used/search.html?searchText={quote(term)}"
        try:
            resp = sess.get(url, timeout=20)
            if resp.status_code != 200:
                continue
            html = resp.text

            # 提取listing卡片
            cards = re.findall(
                r'<div[^>]*class="[^"]*listing-card[^"]*"[^>]*>(.*?)</div>\s*</div>\s*</div>\s*</div>',
                html, re.DOTALL
            )
            if not cards:
                # 另一种结构
                cards = re.findall(
                    r'<article[^>]*class="[^"]*item[^"]*"[^>]*>(.*?)</article>',
                    html, re.DOTALL
                )

            for card in cards[:20]:  # 每页最多20条
                try:
                    title = ""
                    mt = re.search(r'<a[^>]*>(.*?)</a>', card, re.DOTALL)
                    if mt:
                        title = re.sub(r'<[^>]+>', '', mt.group(1)).strip()

                    price_text = ""
                    mp = re.search(r'价格[^<]*?([\d.,]+\s*万?元?)', card)
                    if mp:
                        price_text = mp.group(1)

                    year_text = ""
                    my = re.search(r'(\d{4})\s*年', card)
                    if my:
                        year_text = my.group(1)

                    loc = ""
                    ml = re.search(r'(?:所在地|位置|省份)[：:]\s*([^<\n]+)', card)
                    if ml:
                        loc = ml.group(1).strip()

                    hours_text = ""
                    mh = re.search(r'(\d+)\s*小时', card)
                    if mh:
                        hours_text = mh.group(1)

                    phone = extract_phone(card)

                    # 提取型号（品牌名后面的词）
                    model = title
                    for t in search_terms:
                        model = model.replace(t, "").strip()
                    model = model.split()[0] if model.split() else title

                    price_cny = normalize_price(price_text)
                    year = extract_year(year_text)
                    hours = int(hours_text) if hours_text else None

                    if title:
                        results.append({
                            "brand": brand["zh"],
                            "modelName": model or title[:30],
                            "year": year,
                            "engineHours": hours,
                            "priceCny": price_cny,
                            "country": "CN",
                            "location": loc or "中国",
                            "sellerName": "",
                            "sellerPhone": phone or "",
                            "source": "mascus.cn",
                            "sourceUrl": url,
                            "sourceDate": datetime.now().strftime("%Y%m%d"),
                        })
                except:
                    continue

            time.sleep(1)
        except:
            continue

    return results


# ═══════════════════════════════════════════════
# 平台 2: traktorpool.cn
# ═══════════════════════════════════════════════

def scrape_traktorpool(sess, brand: dict) -> list[dict]:
    """采集 traktorpool 中文站"""
    results = []
    # traktorpool.cn 搜索URL模式
    search_name = brand["en"].lower().replace(" ", "-")
    url = f"https://www.traktorpool.cn/{search_name}/"

    try:
        resp = sess.get(url, timeout=20)
        if resp.status_code != 200:
            # 尝试搜索页
            url = f"https://www.traktorpool.cn/suche/?q={quote(brand['en'])}"
            resp = sess.get(url, timeout=20)
            if resp.status_code != 200:
                return results

        html = resp.text
        # 提取列表项
        items = re.findall(r'<div[^>]*class="[^"]*machine-item[^"]*"[^>]*>(.*?)</div>\s*</div>\s*</div>', html, re.DOTALL)
        if not items:
            items = re.findall(r'<div[^>]*class="[^"]*list-item[^"]*"[^>]*>(.*?)</article>', html, re.DOTALL)
        if not items:
            items = re.findall(r'<tr[^>]*class="[^"]*machine[^"]*"[^>]*>(.*?)</tr>', html, re.DOTALL)

        for item in items[:15]:
            try:
                title = ""
                mt = re.search(r'<a[^>]*>(.*?)</a>', item, re.DOTALL)
                if mt:
                    title = re.sub(r'<[^>]+>', '', mt.group(1)).strip()

                price_text = ""
                mp = re.search(r'(?:EUR|€)\s*([\d.,]+)', item)
                if mp:
                    price_text = f"{mp.group(1)} EUR"

                location = ""
                ml = re.search(r'(?:Standort|Location)[：:]\s*([^<\n]+)', item, re.IGNORECASE)
                if ml:
                    location = ml.group(1).strip()

                year = extract_year(item)

                if title:
                    results.append({
                        "brand": brand["zh"],
                        "modelName": title[:50],
                        "year": year,
                        "engineHours": None,
                        "priceCny": None,
                        "priceEur": float(re.sub(r'[^\d.]', '', price_text)) if price_text and re.search(r'[\d.]+', price_text) else None,
                        "country": "CN",
                        "location": location or "欧洲",
                        "sellerName": "",
                        "sellerPhone": "",
                        "source": "traktorpool.cn",
                        "sourceUrl": url,
                        "sourceDate": datetime.now().strftime("%Y%m%d"),
                    })
            except:
                continue

        time.sleep(1)
    except:
        pass

    return results


# ═══════════════════════════════════════════════
# 平台 3: 农机通 (nongjitong.com)
# ═══════════════════════════════════════════════

def scrape_nongjitong(sess, brand: dict) -> list[dict]:
    """采集农机通二手信息"""
    results = []
    url = f"https://www.nongjitong.com/second-hand.html?keyword={quote(brand['zh'])}"

    try:
        resp = sess.get(url, timeout=20)
        if resp.status_code != 200:
            return results

        html = resp.text
        # 提取信息列表
        items = re.findall(r'<li[^>]*class="[^"]*list-item[^"]*"[^>]*>(.*?)</li>', html, re.DOTALL)
        if not items:
            items = re.findall(r'<div[^>]*class="[^"]*info[^"]*"[^>]*>(.*?)</div>\s*</div>\s*</div>', html, re.DOTALL)

        for item in items[:20]:
            try:
                title = ""
                mt = re.search(r'<a[^>]*>(.*?)</a>', item, re.DOTALL)
                if mt:
                    title = re.sub(r'<[^>]+>', '', mt.group(1)).strip()

                price_text = ""
                mp = re.search(r'([\d.]+\s*万)', item)
                if mp:
                    price_text = mp.group(1)

                phone = extract_phone(item)
                year = extract_year(item)
                price_cny = normalize_price(price_text)

                if title:
                    results.append({
                        "brand": brand["zh"],
                        "modelName": title[:50],
                        "year": year,
                        "engineHours": None,
                        "priceCny": price_cny,
                        "country": "CN",
                        "location": "中国",
                        "sellerName": "",
                        "sellerPhone": phone or "",
                        "source": "nongjitong.com",
                        "sourceUrl": url,
                        "sourceDate": datetime.now().strftime("%Y%m%d"),
                    })
            except:
                continue

        time.sleep(1)
    except:
        pass

    return results


# ═══════════════════════════════════════════════
# 平台 4: 58同城 (58.com)
# ═══════════════════════════════════════════════

def scrape_58(sess, brand: dict) -> list[dict]:
    """采集58同城二手农机"""
    results = []
    term = quote(brand["zh"])
    # 尝试移动版（更容易解析）
    url = f"https://m.58.com/ershou_nongyejixie/?keyword={term}"

    try:
        resp = sess.get(url, timeout=20, allow_redirects=True)
        if resp.status_code != 200:
            return results

        html = resp.text
        items = re.findall(r'<li[^>]*link[^>]*>(.*?)</li>', html, re.DOTALL)
        if not items:
            items = re.findall(r'<li[^>]*class="[^"]*item[^"]*"[^>]*>(.*?)</li>', html, re.DOTALL)

        for item in items[:15]:
            try:
                title = ""
                mt = re.search(r'<a[^>]*>(.*?)</a>', item, re.DOTALL)
                if mt:
                    title = re.sub(r'<[^>]+>', '', mt.group(1)).strip()

                price_text = ""
                mp = re.search(r'(?:¥|价格)?\s*([\d.]+)\s*(?:万|元)?', item)
                if mp:
                    price_text = mp.group(0)

                phone = extract_phone(item)
                price_cny = normalize_price(price_text)
                year = extract_year(item)

                if title:
                    results.append({
                        "brand": brand["zh"],
                        "modelName": title[:50],
                        "year": year,
                        "engineHours": None,
                        "priceCny": price_cny,
                        "country": "CN",
                        "location": "",
                        "sellerName": "",
                        "sellerPhone": phone or "",
                        "source": "58.com",
                        "sourceUrl": url,
                        "sourceDate": datetime.now().strftime("%Y%m%d"),
                    })
            except:
                continue

        time.sleep(1.5)
    except:
        pass

    return results


# ═══════════════════════════════════════════════
# 主流程
# ═══════════════════════════════════════════════

def main():
    print("=" * 60)
    print(f"🚜 #1 卖方采集 — 国内卖家全平台爬虫 V2")
    print(f"📅 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    sess = get_session()
    all_listings = []
    platform_stats = {}

    for brand in BRANDS:
        print(f"\n▶ 品牌: {brand['zh']} ({brand['en']})")

        # Mascus中国
        print(f"  ├─ Mascus中国...", end=" ")
        try:
            listings = scrape_mascus(sess, brand)
            all_listings.extend(listings)
            platform_stats["mascus.cn"] = platform_stats.get("mascus.cn", 0) + len(listings)
            print(f"{len(listings)} 条")
        except Exception as e:
            print(f"失败: {e}")

        # traktorpool.cn
        print(f"  ├─ traktorpool.cn...", end=" ")
        try:
            listings = scrape_traktorpool(sess, brand)
            all_listings.extend(listings)
            platform_stats["traktorpool.cn"] = platform_stats.get("traktorpool.cn", 0) + len(listings)
            print(f"{len(listings)} 条")
        except Exception as e:
            print(f"失败: {e}")

        # 农机通
        print(f"  ├─ 农机通...", end=" ")
        try:
            listings = scrape_nongjitong(sess, brand)
            all_listings.extend(listings)
            platform_stats["nongjitong.com"] = platform_stats.get("nongjitong.com", 0) + len(listings)
            print(f"{len(listings)} 条")
        except Exception as e:
            print(f"失败: {e}")

        # 58同城
        print(f"  ├─ 58同城...", end=" ")
        try:
            listings = scrape_58(sess, brand)
            all_listings.extend(listings)
            platform_stats["58.com"] = platform_stats.get("58.com", 0) + len(listings)
            print(f"{len(listings)} 条")
        except Exception as e:
            print(f"失败: {e}")

    # ── 去重（按 contentHash） ──
    seen = set()
    unique_listings = []
    for item in all_listings:
        h = generate_content_hash(item["brand"], item["modelName"], item.get("year"), item.get("location", ""), item.get("priceCny") or item.get("priceEur"))
        if h not in seen:
            seen.add(h)
            unique_listings.append(item)

    # ── 构建输出 ──
    output = {
        "source": "domestic_scraper_v2",
        "scrapedAt": datetime.now().isoformat(),
        "totalListings": len(unique_listings),
        "withPrice": sum(1 for l in unique_listings if l.get("priceCny") or l.get("priceEur")),
        "priceOnRequest": sum(1 for l in unique_listings if not l.get("priceCny") and not l.get("priceEur")),
        "platformStats": platform_stats,
        "listings": unique_listings,
    }

    # ── 写入文件 ──
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 60)
    print(f"✅ 采集完成")
    print(f"📊 总条数: {output['totalListings']}")
    print(f"💰 有价格: {output['withPrice']}")
    print(f"📋 各平台: {json.dumps(platform_stats, ensure_ascii=False)}")
    print(f"📁 输出文件: {OUTPUT_FILE}")
    print("=" * 60)

    return output


if __name__ == "__main__":
    main()
