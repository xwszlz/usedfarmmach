#!/usr/bin/env python3
"""
#1 卖方采集 Agent — Mascus (mascus.co.uk) 爬虫
=================================================
替代已上 DataDome 商业反爬、首页/sitemap/详情页全部 403 的 Agriaffaires。

Mascus 为 Next.js 服务端渲染，列表页 HTML 内直接含品牌型号、年份、工时、
地区、卖家、GBP 价格，纯 HTTP 即可抓取（实测 2026-10 HTTP 200，约 730KB/页）。

## 数据来源结构（实测抓取的稳定锚点；类名的 hash 后缀会随构建变化，故只用前缀匹配）
  列表项容器 : <div class=" ... SearchResultItem_searchResultItemWrapper__<hash> ..."? data-index="N">
  标题       : <a class="SearchResultItem_assetHeaderUrl__<hash>" href="/agriculture/tractors/<slug>">
                 <h3 class="SearchResultItem_brandmodel__<hash>">John Deere 6155R</h3>
  元信息行   : <p class="basicText2Style">Tractors • 2017 • 8052h • Green Ore,  UK ...</p>
  价格       : <div class="SearchResultItem_priceWrapper__<hash>"><div class="heading5">92,945 GBP</div>
               无价时显示 "POA"（Price On Application）
  卖家       : <div class="SearchResultItem_companyLink__<hash>"><a ...>Hunt Forest Group</a>
  分页       : 第 N 页 URL = "<category>,<N>,relevance,search.html"（第 1 页即类别 URL 本身）
  注：正文夹带 Next.js 水合注释 "<!-- -->"，解析前需先剔除。

## 输出契约（与 scripts/import-seller-scout.ts 的 IntlOutput 完全对齐）
  { scrapedAt, source:"mascus", totalListings, withPrice, priceOnRequest,
    platformStats:{"mascus":N}, listings:[ {brand, modelName, year, engineHours,
    priceCny, priceEur, country, location, sellerName, sellerPhone, source,
    sourceDate, sourceUrl} ] }

## 币种
  站点报价为 GBP（不含税）。价格换算：priceCny = GBP × GBP_CNY_RATE。

用法:
  python scripts/scrape_mascus.py
环境变量（可选）:
  HTTPS_PROXY       代理地址（默认直连）
  MASCUS_MAX_PAGES  最多抓取页数（默认 2）
  MASCUS_CATEGORY   自定义类别 URL（默认 https://www.mascus.co.uk/agriculture/tractors）
"""

import json
import os
import re
import sys
import time
import html as html_lib
import hashlib
from datetime import datetime

import requests

# ── 配置 ──

# ⚠️ GBP→CNY 汇率：按 2026-10 市场价约 9.2 取值（1 GBP ≈ 9.2 CNY）。
#    该值为可调常量；如需精确对账，请以成交当日中国人民银行的英镑中间价替换。
GBP_CNY_RATE = 9.2

PROXY = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy") or ""
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
)
HEADERS = {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-GB,en;q=0.9,zh-CN;q=0.8",
    "Referer": "https://www.mascus.co.uk/",
}

BASE_URL = "https://www.mascus.co.uk"
DEFAULT_CATEGORY = "https://www.mascus.co.uk/agriculture/tractors"
MAX_PAGES = int(os.environ.get("MASCUS_MAX_PAGES", "2") or "2")

# 9 大国际品牌（沿用国内爬虫定义）→ 中文名 + 英文名 + 别名
BRANDS = [
    {"zh": "约翰迪尔", "en": "John Deere", "alias": ["JD", "Deere"]},
    {"zh": "克拉斯", "en": "Claas", "alias": ["CLAAS"]},
    {"zh": "纽荷兰", "en": "New Holland", "alias": []},
    {"zh": "凯斯", "en": "Case IH", "alias": ["Caseih", "Case"]},
    {"zh": "麦赛福格森", "en": "Massey Ferguson", "alias": ["MF"]},
    {"zh": "明斯克", "en": "MTZ", "alias": ["Belarus", "白俄罗斯"]},
    {"zh": "久保田", "en": "Kubota", "alias": []},
    {"zh": "科罗尼", "en": "Krone", "alias": []},
    {"zh": "麦克海尔", "en": "McHale", "alias": []},
]

OUTPUT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mascus_data.json")


# ── 文本 / 数值工具 ──

def clean_text(fragment: str) -> str:
    """去标签、还原 HTML 实体、压缩空白。"""
    if not fragment:
        return ""
    txt = re.sub(r"<[^>]+>", " ", fragment)
    txt = html_lib.unescape(txt)
    return re.sub(r"\s+", " ", txt).strip()


def parse_gbp(text: str):
    """从含 GBP 的片段解析价格；POA / 议价返回 None。"""
    if not text:
        return None
    if re.search(r"\bPOA\b|price on application|on request|call for price", text, re.IGNORECASE):
        return None
    m = re.search(r"([\d][\d,\.]*)\s*(?:GBP|£|Pounds?)", text, re.IGNORECASE)
    if not m:
        m = re.search(r"(?:GBP|£)\s*([\d][\d,\.]*)", text, re.IGNORECASE)
    if not m:
        return None
    num = m.group(1).replace(",", "")
    try:
        return round(float(num), 2)
    except ValueError:
        return None


def split_brand_model(title: str) -> tuple[str, str]:
    """把 'John Deere 6155R' 拆为（中文品牌名, 型号）。未收录品牌保留原英文名。"""
    t = (title or "").strip()
    best_name = ""
    best_zh = ""
    for b in BRANDS:
        for name in [b["en"]] + b["alias"] + [b["zh"]]:
            if name and t.lower().startswith(name.lower()) and len(name) > len(best_name):
                best_name, best_zh = name, b["zh"]
    if best_name:
        return best_zh, t[len(best_name):].strip()
    # 未收录品牌：取标题首个字母词作为品牌名（保留原站英文名，不伪造中文名）
    m = re.match(r"^([A-Za-z][A-Za-z\-]*)", t)
    if m:
        return m.group(1), t[m.end():].strip().lstrip("-.,")
    return "", t


def parse_meta(meta: str) -> tuple[int | None, int | None, str]:
    """解析 'Tractors • 2017 • 8052h • Green Ore,  UK • Hunt Forest Group'。

    返回 (年份, 工时, 地区)。
    """
    parts = [p.strip() for p in re.split(r"•", meta or "") if p.strip()]
    year = None
    hours = None
    location = ""
    for p in parts:
        if re.fullmatch(r"(?:19|20)\d{2}", p):
            year = int(p)
        elif re.fullmatch(r"[\d,\.]+\s*h(?:rs?|ours?)?", p, re.IGNORECASE):
            hours = int(re.sub(r"[^\d]", "", p))
    # 地区：优先取含逗号（城市, 国家）的片段，其次取工时后一段
    for i, p in enumerate(parts):
        if "," in p and not re.fullmatch(r"[\d,\.\s]*", p):
            location = p
            break
    if not location:
        for i, p in enumerate(parts):
            if re.fullmatch(r"[\d,\.]+\s*h(?:rs?|ours?)?", p, re.IGNORECASE):
                if i + 1 < len(parts):
                    location = parts[i + 1]
                break
    return year, hours, location


def country_from_location(location: str) -> str:
    """从 'Green Ore,  UK' 提取国家（取最后一段）。"""
    if not location or "," not in location:
        return location.strip()
    return location.rsplit(",", 1)[-1].strip()


# ── HTTP ──

def get_session() -> requests.Session:
    sess = requests.Session()
    sess.headers.update(HEADERS)
    if PROXY:
        sess.proxies = {"http": PROXY, "https": PROXY}
    return sess


def fetch_html(sess: requests.Session, url: str):
    """抓取页面，返回 (status_code, html_text)。异常时 status_code 为 0。"""
    try:
        resp = sess.get(url, timeout=35, allow_redirects=True)
        html = resp.content.decode("utf-8", errors="replace")
        return resp.status_code, html
    except Exception as e:
        print(f"    ⚠️ 请求异常 {url}: {e}")
        return 0, ""


def page_url(category: str, page: int) -> str:
    """构造第 N 页 URL（第 1 页即类别 URL）。"""
    if page <= 1:
        return category
    return f"{category},{page},relevance,search.html"


# ── 列表解析 ──

# 仅用「类名前缀」定位（hash 后缀随构建变化，不能写死）
RE_WRAPPER = "SearchResultItem_searchResultItemWrapper__"
RE_TITLE = r'class="SearchResultItem_brandmodel__[^"]*"[^>]*>(.*?)</h3>'
RE_HREF = r'class="SearchResultItem_assetHeaderUrl__[^"]*"\s+href="([^"]+)"'
RE_META = r'<p class="basicText2Style"[^>]*>(.*?)</p>'
RE_PRICE = r'class="SearchResultItem_priceWrapper__[^"]*".*?<div class="heading5"[^>]*>(.*?)</div>'
RE_COMPANY = r'class="SearchResultItem_companyLink__[^"]*"><a[^>]*>(.*?)</a>'


def parse_list_page(html: str) -> list[dict]:
    """解析 Mascus 列表页，返回原始条目列表。"""
    items: list[dict] = []
    # 剔除 Next.js 水合注释，避免污染文本
    html = html.replace("<!-- -->", "")
    blocks = html.split(RE_WRAPPER)
    today = datetime.now().strftime("%Y%m%d")

    for blk in blocks[1:]:
        try:
            m_title = re.search(RE_TITLE, blk, re.DOTALL)
            m_href = re.search(RE_HREF, blk)
            if not m_title:
                continue
            title = clean_text(m_title.group(1))
            if not title:
                continue

            m_meta = re.search(RE_META, blk, re.DOTALL)
            meta = clean_text(m_meta.group(1)) if m_meta else ""
            year, hours, location = parse_meta(meta)

            m_price = re.search(RE_PRICE, blk, re.DOTALL)
            price_block = clean_text(m_price.group(1)) if m_price else ""
            price_gbp = parse_gbp(price_block)

            m_company = re.search(RE_COMPANY, blk, re.DOTALL)
            seller = clean_text(m_company.group(1)) if m_company else ""

            brand_zh, model = split_brand_model(title)
            price_cny = round(price_gbp * GBP_CNY_RATE, 2) if price_gbp is not None else None

            items.append({
                "brand": brand_zh,
                "modelName": (model or title)[:80],
                "year": year,
                "engineHours": hours,
                # priceCny 由 GBP 按 GBP_CNY_RATE 换算；priceEur 无欧元报价，留空
                "priceCny": price_cny,
                "priceEur": None,
                "country": country_from_location(location),
                "location": location,
                "sellerName": seller,
                "sellerPhone": "",
                "source": "mascus",
                "sourceDate": today,
                "sourceUrl": (BASE_URL + m_href.group(1)) if m_href else "",
            })
        except Exception as e:
            print(f"    ⚠️ 条目解析跳过: {e}")
            continue

    return items


def dedupe(items: list[dict]) -> list[dict]:
    """按 (品牌, 型号, 年份, 地区, 价格, 链接) 去重。"""
    seen = set()
    unique: list[dict] = []
    for it in items:
        key = "|".join([
            str(it.get("brand", "")),
            str(it.get("modelName", "")),
            str(it.get("year") or ""),
            str(it.get("location", "")),
            str(it.get("priceCny") or ""),
            str(it.get("sourceUrl", "")),
        ])
        h = hashlib.md5(key.encode("utf-8")).hexdigest()
        if h in seen:
            continue
        seen.add(h)
        unique.append(it)
    return unique


def main() -> int:
    category = os.environ.get("MASCUS_CATEGORY", DEFAULT_CATEGORY).strip() or DEFAULT_CATEGORY
    print("=" * 60)
    print("🚜 #1 卖方采集 — Mascus (mascus.co.uk)")
    print(f"📅 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"🔧 代理: {'已配置' if PROXY else '未配置（直连）'}")
    print(f"🔧 类别: {category}｜最多页数: {MAX_PAGES}｜汇率 GBP→CNY={GBP_CNY_RATE}")
    print("=" * 60)

    sess = get_session()
    all_items: list[dict] = []
    fail_reasons: list[str] = []

    for page in range(1, MAX_PAGES + 1):
        url = page_url(category, page)
        status, html = fetch_html(sess, url)
        print(f"  page {page}: HTTP {status}, {len(html)} bytes")
        if status != 200 or not html:
            fail_reasons.append(f"page {page} HTTP {status}")
            continue
        page_items = parse_list_page(html)
        print(f"  page {page}: 命中 {len(page_items)} 条")
        if not page_items:
            # 空页说明已到末页，停止翻页
            break
        all_items.extend(page_items)
        if page < MAX_PAGES:
            time.sleep(1.0)

    unique = dedupe(all_items)

    with_price = sum(1 for x in unique if x.get("priceCny"))
    on_request = sum(1 for x in unique if not x.get("priceCny"))

    output = {
        "scrapedAt": datetime.now().isoformat(),
        "source": "mascus",
        "totalListings": len(unique),
        "withPrice": with_price,
        "priceOnRequest": on_request,
        "platformStats": {"mascus": len(unique)},
        "listings": unique,
    }

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 60)
    print("✅ 采集完成（Mascus）")
    print(f"📊 总条数: {output['totalListings']}")
    print(f"💷 有价(GBP): {with_price} ｜ 待询(POA): {on_request}")
    if output["totalListings"] == 0:
        print("⚠️  0 条：可能触发反爬、结构变更或网络不可达。原因：")
        if fail_reasons:
            for r in fail_reasons:
                print(f"     - {r}")
        else:
            print("     - 页面可访问但未解析到任何列表项（选择器可能已失效）")
    print(f"📁 输出文件: {OUTPUT_FILE}")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
