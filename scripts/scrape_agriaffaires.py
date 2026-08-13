#!/usr/bin/env python3
"""
#1 卖方采集 Agent — 国际卖家爬虫 (Agriaffaires)
============================================
采集法国/欧洲二手国际品牌农机在国际平台 Agriaffaires 上的挂牌信息，
与国内爬虫 seller_scout_domestic_scraper.py 输出同一套 JSON 契约，
由 import-seller-scout.ts 统一导入 RawListing 表。

目标品牌（9大国际品牌，沿用国内爬虫定义）：
  John Deere / CLAAS / New Holland / Case IH / Massey Ferguson
  MTZ/Belarus / Kubota / Krone / McHale

输出契约（execute.ts 国际分支读取）：
  {
    "source": "agriaffaires_scraper_v1",
    "scrapedAt": ISO,
    "totalListings": int,
    "withPrice": int,
    "priceOnRequest": int,
    "platformStats": {"agriaffaires": int},
    "listings": [ {brand, modelName, year, engineHours, priceCny,
                   priceEur, country, location, sellerName, sellerPhone,
                   source, sourceDate, sourceUrl} ]
  }

⚠️ 反爬说明：
  Agriaffaires 对裸 HTTP 客户端返回 403。在本机/Vercel 直连时很可能命中 0 条。
  两种解法：
    1) 配置住宅代理：设置环境变量 HTTPS_PROXY=http://user:pass@host:port
       （EU 出口最优），脚本会自动走代理。
    2) 改由 EU 区域的服务器运行（Vercel 的法兰克福/巴黎区域也可）。
  命中 0 条属"诚实空跑"，会清晰打印日志，不会伪造数据。
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

PROXY = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy") or ""
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
    "Referer": "https://www.agriaffaires.com/",
}

EUR_CNY_RATE = 7.91  # 与国内导入脚本保持一致

# 9大国际品牌 → 中文名 + 英文名 + 搜索别名
BRANDS = [
    {"id": "john-deere", "zh": "约翰迪尔", "en": "John Deere", "alias": ["JD", "Deere"]},
    {"id": "claas", "zh": "克拉斯", "en": "Claas", "alias": ["CLAAS"]},
    {"id": "new-holland", "zh": "纽荷兰", "en": "New Holland", "alias": []},
    {"id": "case-ih", "zh": "凯斯", "en": "Case IH", "alias": ["Caseih", "凯斯"]},
    {"id": "massey-ferguson", "zh": "麦赛福格森", "en": "Massey Ferguson", "alias": ["MF"]},
    {"id": "mtz", "zh": "明斯克", "en": "MTZ", "alias": ["Belarus", "白俄罗斯"]},
    {"id": "kubota", "zh": "久保田", "en": "Kubota", "alias": []},
    {"id": "krone", "zh": "科罗尼", "en": "Krone", "alias": []},
    {"id": "mchale", "zh": "麦克海尔", "en": "McHale", "alias": []},
]

# 输出文件：写在脚本同级（scripts/）目录下，与 import-seller-scout.ts 的 __dirname 一致
OUTPUT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "agriaffaires_data.json")

# 搜索页 URL 候选（按顺序尝试，命中 200 即用）
def build_search_urls(term: str) -> list[str]:
    return [
        f"https://www.agriaffaires.com/recherche?query={quote(term)}",
        f"https://www.agriaffaires.com/occasion/{quote(term)}",
        f"https://www.agriaffaires.com/recherche?encheres=0&query={quote(term)}",
    ]


def get_session():
    """创建带代理的 requests session"""
    sess = requests.Session()
    sess.headers.update(HEADERS)
    if PROXY:
        sess.proxies = {"http": PROXY, "https": PROXY}
    return sess


def normalize_fr_price(text: str) -> float | None:
    """法语价格解析：'1 234,56 €' / '1 234 €' / '1.234 €' / 'Prix sur demande'"""
    if not text:
        return None
    t = text.strip()
    # 价格待询（无价）
    if re.search(r"sur\s*demande|price\s*on\s*request|contact", t, re.IGNORECASE):
        return None
    # 提取欧元数值片段
    m = re.search(r"([\d\s\.]+,[?\d{0,2}]?)\s*€|€\s*([\d\s\.]+,[?\d{0,2}]?)", t)
    if not m:
        # 退一步：纯数字 + €
        m = re.search(r"([\d\s\.\,]+)", t)
        if not m:
            return None
        num = m.group(1)
    else:
        num = (m.group(1) or m.group(2) or "").strip()
    if not num:
        return None
    # 法语：空格=千分位，逗号=小数位
    num = num.replace("\u202f", "").replace("\xa0", "").strip()
    # 若同时含空格和逗号，空格是千分位、逗号是小数
    has_comma = "," in num
    has_dot = "." in num
    if has_comma and has_dot:
        # 形如 1.234,56 → 去掉点(千分位)，逗号变点(小数)
        num = num.replace(".", "").replace(",", ".")
    elif has_comma and not has_dot:
        # 1 234,56 或 1234,56
        num = num.replace(" ", "").replace(",", ".")
    else:
        # 只有点（可能是千分位或小数）→ 法语场景下点多为千分位
        if re.search(r"\d\.\d{3}\b", num):
            num = num.replace(".", "")
        num = num.replace(" ", "")
    try:
        return round(float(num), 2)
    except ValueError:
        return None


def extract_year(text: str) -> int | None:
    if not text:
        return None
    m = re.search(r"(19\d{2}|20[0-2]\d)", text)
    return int(m.group(1)) if m else None


def extract_hours(text: str) -> int | None:
    if not text:
        return None
    m = re.search(r"(\d{1,3}[\s\u202f\xa0]?\d{3}|\d{3,6})\s*(?:h|heures?|hrs?)", text, re.IGNORECASE)
    if m:
        return int(re.sub(r"[^\d]", "", m.group(1)))
    return None


def extract_phone(text: str) -> str | None:
    if not text:
        return None
    # 法国手机号：+33 6/7 xx xx xx xx 或 06/07 ...
    m = re.search(r"(?:\+33|0)\s?[67](?:[\s\.\-]?\d{2}){4}", text)
    if m:
        return m.group(0).replace(" ", "").replace(".", "").replace("-", "")
    return None


def generate_content_hash(brand: str, model: str, year: int | None, location: str, price: float | None) -> str:
    key = f"{brand}|{model}|{year or ''}|{location}|{price or ''}"
    return hashlib.md5(key.encode()).hexdigest()


def parse_listings(html: str, brand: dict, url: str) -> list[dict]:
    """
    解析 Agriaffaires 搜索结果页。
    由于站点可能改版/反爬，这里用多组候选选择器 + 通用回退，
    命中 0 条时由调用方如实记录（不伪造）。
    """
    results = []

    # 候选：被 <article class="... ann ... / card ..."> 包裹的卡片
    card_patterns = [
        r'<article[^>]*class="[^"]*(?:ann|card|listing|bloc)[^"]*"[^>]*>(.*?)</article>',
        r'<div[^>]*class="[^"]*(?:ann|card|listing|bloc|result)[^"]*"[^>]*>(.*?)</div>\s*</div>\s*</div>',
        r'<li[^>]*class="[^"]*(?:ann|card|listing|result)[^"]*"[^>]*>(.*?)</li>',
    ]
    cards: list[str] = []
    for pat in card_patterns:
        cards = re.findall(pat, html, re.DOTALL | re.IGNORECASE)
        if cards:
            break

    # 通用回退：找所有含欧元价格的 <a ...> 块
    if not cards:
        for m in re.finditer(r"<a[^>]+href=\"([^\"]+)\"[^>]*>(.*?)</a>", html, re.DOTALL):
            block = m.group(2)
            if re.search(r"€|euro", block, re.IGNORECASE) and re.search(brand["en"], block, re.IGNORECASE):
                cards.append(block)

    for card in cards[:25]:
        try:
            # 标题
            mt = re.search(r'<a[^>]*>(.*?)</a>', card, re.DOTALL)
            title = re.sub(r"<[^>]+>", " ", mt.group(1)).strip() if mt else ""
            if not title:
                title = re.sub(r"<[^>]+>", " ", card)
            title = re.sub(r"\s+", " ", title).strip()
            if not title:
                continue

            # 价格（欧元）
            price_block = card
            mp = re.search(r"(?:[\d\s\.,]+\s*€|€\s*[\d\s\.,]+|Prix sur demande)", price_block, re.IGNORECASE)
            price_eur = normalize_fr_price(mp.group(0)) if mp else None

            # 年份 / 工时 / 地区
            year = extract_year(price_block) or extract_year(title)
            hours = extract_hours(price_block)
            loc = ""
            ml = re.search(r"(?:Localisation|Lieu|Ville|Région|Pays)[：:\s]*([^<\n,]+)", price_block, re.IGNORECASE)
            if ml:
                loc = ml.group(1).strip().strip(",")
            phone = extract_phone(price_block)

            # 型号：去掉品牌词后的剩余
            model = title
            for t in [brand["en"]] + brand["alias"] + [brand["zh"]]:
                model = re.sub(re.escape(t), "", model, flags=re.IGNORECASE).strip()
            model = model.split("  ")[0].strip() or title[:50]

            results.append({
                "brand": brand["zh"],
                "modelName": model[:80] or title[:50],
                "year": year,
                "engineHours": hours,
                "priceCny": round(price_eur * EUR_CNY_RATE, 2) if price_eur else None,
                "priceEur": price_eur,
                "country": "FR",
                "location": loc or "France",
                "sellerName": "",
                "sellerPhone": phone or "",
                "source": "agriaffaires",
                "sourceUrl": url,
                "sourceDate": datetime.now().strftime("%Y%m%d"),
            })
        except Exception:
            continue

    return results


def scrape_brand(sess, brand: dict) -> list[dict]:
    results = []
    search_terms = [brand["en"]] + brand["alias"] + [brand["zh"]]
    for term in search_terms[:3]:
        for url in build_search_urls(term):
            try:
                resp = sess.get(url, timeout=25, allow_redirects=True)
                if resp.status_code != 200:
                    continue
                html = resp.text
                found = parse_listings(html, brand, url)
                results.extend(found)
                if found:
                    return results  # 该品牌首个命中的搜索词/URL 即采用
                time.sleep(1.2)
            except Exception:
                continue
        if results:
            break
    return results


def main():
    print("=" * 60)
    print(f"🌍 #1 卖方采集 — 国际爬虫 (Agriaffaires)")
    print(f"📅 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"🔧 代理: {'已配置' if PROXY else '未配置（直连，可能被 403）'}")
    print("=" * 60)

    sess = get_session()
    all_listings = []

    for brand in BRANDS:
        print(f"\n▶ 品牌: {brand['zh']} ({brand['en']})")
        try:
            listings = scrape_brand(sess, brand)
            all_listings.extend(listings)
            print(f"  └─ {len(listings)} 条")
        except Exception as e:
            print(f"  └─ 失败: {e}")

    # ── 去重（按 contentHash） ──
    seen = set()
    unique = []
    for item in all_listings:
        h = generate_content_hash(item["brand"], item["modelName"], item.get("year"),
                                  item.get("location", ""), item.get("priceEur") or item.get("priceCny"))
        if h not in seen:
            seen.add(h)
            unique.append(item)

    with_price = sum(1 for l in unique if l.get("priceEur") or l.get("priceCny"))
    on_request = sum(1 for l in unique if not l.get("priceEur") and not l.get("priceCny"))

    output = {
        "source": "agriaffaires_scraper_v1",
        "scrapedAt": datetime.now().isoformat(),
        "totalListings": len(unique),
        "withPrice": with_price,
        "priceOnRequest": on_request,
        "platformStats": {"agriaffaires": len(unique)},
        "listings": unique,
    }

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 60)
    print(f"✅ 采集完成（Agriaffaires）")
    print(f"📊 总条数: {output['totalListings']}")
    print(f"💶 有价(€): {with_price} ｜ 待询: {on_request}")
    if output["totalListings"] == 0:
        print("⚠️  0 条：站点可能 403 反爬或结构变更。配置 HTTPS_PROXY(EU 出口) 或改 EU 区域运行后重试。")
    print(f"📁 输出文件: {OUTPUT_FILE}")
    print("=" * 60)


if __name__ == "__main__":
    main()
