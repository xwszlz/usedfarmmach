#!/usr/bin/env python3
"""
#1 卖方采集 Agent — agroline.cn（中文站）爬虫
=================================================
替代已上 DataDome 商业反爬、首页/sitemap/详情页全部 403 的 Agriaffaires。

agroline.cn 属 linemedia 系农机平台的中文站，**服务端渲染**：
列表页 HTML 内直接含 ¥/€ 双价、年份、运转时数、品牌、型号、地区，
纯 HTTP 即可抓取，无需代理（实测 2026-10 HTTP 200，约 600KB/页）。

## 数据来源结构（实测抓取的稳定锚点，勿凭猜改）
  列表项容器 : <div class="item sales-list-item ..." data-code data-name data-brand data-category>
  data-code  : 广告唯一 ID
  data-name  : 标题（含「新/二手」前缀 + 品牌 + 型号，如 "新Dongfeng 111"）
  data-brand : 品牌英文名（如 "Dongfeng"）
  详情链接   : <a ... href="https://agroline.cn/-/sale/{cat}/{brand}/{model}--{id}">
  标题       : <a class="sales-item-title-link" title="Dongfeng 111">
  ¥ 价       : <span class="price-value ...">¥100,700</span>          → priceCny
  € 价       : <span class="price-in-other-currencies">≈ €13,180</span> → priceEur
  年份       : <div class="sl-main-props__item" title="年"><span class="value">2026</span>
  运转时数   : <div class="sl-main-props__item" title="运转时数"><span class="value">5 摩托小时</span>
  地区       : <div class="location sl-item__location" title="中国, Shanghai">
  分页       : 列表页 URL 追加 "?page=N"（paginator 的 data-total-pages-num 给出总页数）

## 输出契约（与 scripts/import-seller-scout.ts 的 IntlOutput 完全对齐）
  {
    "scrapedAt": ISO, "source": "agroline",
    "totalListings": int, "withPrice": int, "priceOnRequest": int,
    "platformStats": {"agroline": int},
    "listings": [ {brand, modelName, year, engineHours, priceCny, priceEur,
                   country, location, sellerName, sellerPhone,
                   source, sourceDate, sourceUrl} ]
  }

## 反爬 / 网络
  - 默认直连；如需走代理，设置 HTTPS_PROXY（与 scrape_agriaffaires.py 一致）。
  - 命中 0 条 → 如实打印 HTTP 状态与原因，**绝不伪造数据**。

用法:
  python scripts/scrape_agroline.py
环境变量（可选）:
  HTTPS_PROXY          代理地址（默认直连）
  AGROLINE_MAX_PAGES   每个类别最多抓取页数（默认 2）
  AGROLINE_MAX_DETAIL  最多抓取多少个详情页做卖家信息补全（默认 12，设 0 关闭）
  AGROLINE_CATEGORIES  自定义类别，形如 "tractors:c228,round-balers:c279"
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

PROXY = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy") or ""
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
)
HEADERS = {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Referer": "https://agroline.cn/",
}

BASE_URL = "https://agroline.cn"
# 默认抓取「拖拉机 / 圆捆打捆机 / 方捆打捆机」三大类（可被 AGROLINE_CATEGORIES 覆盖）
DEFAULT_CATEGORIES = [
    ("tractors", "https://agroline.cn/-/tractors--c228"),
    ("round-balers", "https://agroline.cn/-/round-balers--c279"),
    ("square-balers", "https://agroline.cn/-/square-balers--c277"),
]

MAX_PAGES = int(os.environ.get("AGROLINE_MAX_PAGES", "2") or "2")
MAX_DETAIL = int(os.environ.get("AGROLINE_MAX_DETAIL", "12") or "12")

# 与国内导入脚本 / scrape_agriaffaires.py 保持一致（用于从 ¥ 反推 € 的展示值）
EUR_CNY_RATE = 7.91

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

OUTPUT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "agroline_data.json")


# ── 品牌映射 ──

def brand_to_zh(raw: str) -> str:
    """把站点给出的品牌名映射为中文品牌名；未收录的如实保留原值（不伪造）。"""
    t = (raw or "").strip()
    if not t:
        return ""
    low = t.lower()
    # 精确匹配（英文名或别名）
    for b in BRANDS:
        for name in [b["en"]] + b["alias"]:
            if name.lower() == low:
                return b["zh"]
    # 子串匹配（如 "John Deere 6155R" 这类标题残片）
    for b in BRANDS:
        for name in [b["en"]] + b["alias"]:
            n = name.lower()
            if n and n in low:
                return b["zh"]
    return t


def strip_brand_from_title(title: str, brand_raw: str) -> str:
    """从标题中去掉品牌词与「新/二手」前缀，留下型号名。"""
    model = title or ""
    words = [brand_raw, brand_to_zh(brand_raw)]
    for b in BRANDS:
        words.extend([b["en"]] + b["alias"] + [b["zh"]])
    for w in words:
        if w:
            model = re.sub(re.escape(w), " ", model, flags=re.IGNORECASE)
    # 去掉「新 / 二手 / 全新」等状况词
    model = re.sub(r"^(?:\s*(?:二手|全新|新))+\s*", "", model.strip())
    model = re.sub(r"\s+", " ", model).strip()
    return model


# ── 价格 / 数值解析 ──

def _to_number(raw: str):
    """把 '100,700' / '13 180' / '100700' 这类片段转为 float。"""
    if not raw:
        return None
    num = raw.replace("\u202f", "").replace("\xa0", "").replace(" ", "")
    # 含逗号且逗号后为 3 位 → 千分位；否则视作小数点
    if "," in num and "." in num:
        num = num.replace(",", "")
    elif "," in num:
        if re.search(r",\d{1,2}$", num):
            num = num.replace(",", ".")
        else:
            num = num.replace(",", "")
    try:
        return round(float(num), 2)
    except ValueError:
        return None


def parse_cny(text: str):
    """从含 ¥/CNY 的片段解析人民币价格。"""
    if not text:
        return None
    m = re.search(r"[¥￥]\s*([\d][\d,\.\s]*)", text) or re.search(
        r"(?:CNY|RMB)\s*([\d][\d,\.\s]*)", text, re.IGNORECASE
    )
    return _to_number(m.group(1)) if m else None


def parse_eur(text: str):
    """从含 €/EUR 的片段解析欧元价格。"""
    if not text:
        return None
    m = re.search(r"€\s*([\d][\d,\.\s]*)", text) or re.search(
        r"([\d][\d,\.\s]*)\s*€", text
    )
    if not m:
        m = re.search(r"(?:EUR)\s*([\d][\d,\.\s]*)", text, re.IGNORECASE)
    return _to_number(m.group(1)) if m else None


def first_int(text: str):
    """取片段中的第一个整数（用于年份 / 工时）。"""
    if not text:
        return None
    m = re.search(r"(\d[\d]*)", text.replace(" ", ""))
    return int(m.group(1)) if m else None


def clean_text(fragment: str) -> str:
    """去掉标签并把 HTML 实体还原为纯文本。"""
    if not fragment:
        return ""
    txt = re.sub(r"<[^>]+>", " ", fragment)
    txt = html_lib.unescape(txt)
    return re.sub(r"\s+", " ", txt).strip()


# ── HTTP ──

def get_session() -> requests.Session:
    """创建带（可选）代理的 requests session。"""
    sess = requests.Session()
    sess.headers.update(HEADERS)
    if PROXY:
        sess.proxies = {"http": PROXY, "https": PROXY}
    return sess


def fetch_html(sess: requests.Session, url: str):
    """抓取页面，返回 (status_code, html_text)。异常时 status_code 为 0。"""
    try:
        resp = sess.get(url, timeout=30, allow_redirects=True)
        # agroline.cn 全程 UTF-8，直接按 utf-8 解码，避免 requests 误判编码
        html = resp.content.decode("utf-8", errors="replace")
        return resp.status_code, html
    except Exception as e:  # 网络异常：交由调用方记录原因
        print(f"    ⚠️ 请求异常 {url}: {e}")
        return 0, ""


# ── 列表解析 ──

def parse_list_page(html: str, category: str) -> list[dict]:
    """解析 agroline.cn 列表页中的一个类别页，返回原始条目列表。"""
    items: list[dict] = []
    # 每个列表项以该容器开头（实测稳定锚点）
    blocks = html.split('<div class="item sales-list-item')
    today = datetime.now().strftime("%Y%m%d")

    for blk in blocks[1:]:
        try:
            m_code = re.search(r'data-code="([^"]*)"', blk)
            if not m_code:
                continue
            m_brand = re.search(r'data-brand="([^"]*)"', blk)
            m_name = re.search(r'data-name="([^"]*)"', blk)
            m_href = re.search(r'href="(https://agroline\.cn/-/sale/[^"]+)"', blk)
            # 无详情链接的条目来自「经销商其他库存」等侧栏小组件（无价、无法回链），
            # 质量低，直接跳过，保证入库数据均可溯源。
            if not m_href:
                continue
            # 标题链接的 title 属性最干净（"Dongfeng 111"）
            m_title_attr = re.search(
                r'<a[^>]*class="sales-item-title-link"[^>]*>(.*?)</a>', blk, re.DOTALL
            )

            brand_raw = html_lib.unescape(m_brand.group(1)) if m_brand else ""
            data_name = html_lib.unescape(m_name.group(1)) if m_name else ""
            title = clean_text(m_title_attr.group(1)) if m_title_attr else data_name
            if not title:
                title = data_name
            if not brand_raw:
                brand_raw = title

            # 价格（列表项内取第一个 ¥ 与第一个 €）
            price_cny = parse_cny(blk)
            price_eur = parse_eur(blk)
            if price_eur is None and price_cny is not None:
                # 站点未给 € 时，按固定汇率反推出展示用 €（属真实换算，非伪造）
                price_eur = round(price_cny / EUR_CNY_RATE, 2)

            # 属性项（年 / 运转时数 / 英里里程 / 情况）
            props = dict()
            for mt, mv in re.findall(
                r'sl-main-props__item" title="([^"]*)">(.*?)</div>', blk, re.DOTALL
            ):
                props[mt] = clean_text(mv)

            year = first_int(props.get("年", ""))
            hours = first_int(props.get("运转时数", ""))

            # 地区
            m_loc = re.search(
                r'class="location sl-item__location"[^>]*title="([^"]*)"', blk
            )
            location = html_lib.unescape(m_loc.group(1)).strip() if m_loc else ""
            country = location.split(",")[0].strip() if location else ""

            model = strip_brand_from_title(title, brand_raw) or title

            items.append({
                "brand": brand_to_zh(brand_raw),
                "modelName": model[:80],
                "year": year,
                "engineHours": hours,
                "priceCny": price_cny,
                "priceEur": price_eur,
                "country": country,
                "location": location,
                "sellerName": "",
                "sellerPhone": "",
                "source": "agroline",
                "sourceDate": today,
                "sourceUrl": m_href.group(1) if m_href else "",
                "_category": category,
                "_code": m_code.group(1),
            })
        except Exception as e:  # 单条解析失败不应中断整页
            print(f"    ⚠️ 条目解析跳过: {e}")
            continue

    return items


def total_pages(html: str) -> int:
    """从 paginator 读取总页数（读不到时返回 1）。"""
    m = re.search(r'data-total-pages-num="([\d,]+)"', html)
    if not m:
        return 1
    try:
        return max(1, int(m.group(1).replace(",", "")))
    except ValueError:
        return 1


# ── 详情补全 ──

def enrich_from_detail(sess: requests.Session, item: dict) -> None:
    """抓取详情页，补全卖家名称 / 电话 / 精确地区（失败则静默保留原值）。"""
    url = item.get("sourceUrl")
    if not url:
        return
    status, html = fetch_html(sess, url)
    if status != 200 or not html:
        return
    # 电话：<a href="tel:+8618701954897">
    m_tel = re.search(r'href="tel:([^"]+)"', html)
    if m_tel:
        item["sellerPhone"] = m_tel.group(1).strip()
    # 卖家 / 精确地区：优先从 JSON-LD 取
    for block in re.findall(
        r'<script type="application/ld\+json">(.*?)</script>', html, re.DOTALL
    ):
        try:
            data = json.loads(block)
        except Exception:
            continue
        if not isinstance(data, dict):
            continue
        if data.get("@type") == "ImageObject" and data.get("author"):
            item["sellerName"] = str(data["author"]).strip()
        types = data.get("@type")
        is_product = types == "Product" or (
            isinstance(types, list) and "Product" in types
        )
        if is_product:
            offers = data.get("offers") or {}
            place = offers.get("availableAtOrFrom") if isinstance(offers, dict) else None
            if isinstance(place, dict) and place.get("name"):
                item["location"] = str(place["name"]).strip()
                item["country"] = item["location"].split(",")[0].strip()
    time.sleep(0.4)


# ── 采集主流程 ──

def parse_categories_env() -> list[tuple[str, str]]:
    """解析 AGROLINE_CATEGORIES（形如 "tractors:c228,round-balers:c279"）。"""
    raw = os.environ.get("AGROLINE_CATEGORIES", "").strip()
    if not raw:
        return DEFAULT_CATEGORIES
    cats: list[tuple[str, str]] = []
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        if ":" in part:
            name, code = part.split(":", 1)
            cats.append((name.strip(), f"{BASE_URL}/-/{name.strip()}--{code.strip()}"))
        else:
            cats.append((part, f"{BASE_URL}/-/{part}"))
    return cats or DEFAULT_CATEGORIES


def scrape_category(sess: requests.Session, name: str, url: str) -> tuple[list[dict], list[str]]:
    """抓取单个类别的多页，返回 (条目, 失败原因列表)。"""
    collected: list[dict] = []
    reasons: list[str] = []
    for page in range(1, MAX_PAGES + 1):
        page_url = url if page == 1 else f"{url}?page={page}"
        status, html = fetch_html(sess, page_url)
        print(f"    [{name}] page {page}: HTTP {status}, {len(html)} bytes")
        if status != 200 or not html:
            reasons.append(f"{name} page {page} HTTP {status}")
            continue
        page_items = parse_list_page(html, name)
        print(f"    [{name}] page {page}: 命中 {len(page_items)} 条")
        collected.extend(page_items)
        # 已到最后一页则停止
        if page >= total_pages(html):
            break
        time.sleep(1.0)
    return collected, reasons


def dedupe(items: list[dict]) -> list[dict]:
    """按 (品牌, 型号, 年份, 地区, 价格) 去重，保留首次出现。"""
    seen = set()
    unique: list[dict] = []
    for it in items:
        key = "|".join([
            str(it.get("brand", "")),
            str(it.get("modelName", "")),
            str(it.get("year") or ""),
            str(it.get("location", "")),
            str(it.get("priceCny") or it.get("priceEur") or ""),
        ])
        h = hashlib.md5(key.encode("utf-8")).hexdigest()
        if h in seen:
            continue
        seen.add(h)
        unique.append(it)
    return unique


def main() -> int:
    print("=" * 60)
    print("🚜 #1 卖方采集 — agroline.cn（中文站）")
    print(f"📅 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"🔧 代理: {'已配置' if PROXY else '未配置（直连）'}")
    print(f"🔧 每类最多页数: {MAX_PAGES}｜详情补全上限: {MAX_DETAIL}")
    print("=" * 60)

    sess = get_session()
    categories = parse_categories_env()
    all_items: list[dict] = []
    fail_reasons: list[str] = []

    for name, url in categories:
        print(f"\n▶ 类别: {name} ({url})")
        try:
            items, reasons = scrape_category(sess, name, url)
            all_items.extend(items)
            fail_reasons.extend(reasons)
            print(f"  └─ {name}: 累计 {len(items)} 条")
        except Exception as e:
            print(f"  └─ 失败: {e}")
            fail_reasons.append(f"{name} 异常: {e}")

    unique = dedupe(all_items)

    # ── 详情补全（卖家名称 / 电话 / 精确地区）──
    if MAX_DETAIL > 0:
        print(f"\n▶ 详情补全（最多 {MAX_DETAIL} 条）...")
        enriched = 0
        for it in unique[:MAX_DETAIL]:
            try:
                enrich_from_detail(sess, it)
                enriched += 1
            except Exception:
                continue
        print(f"  └─ 已尝试补全 {enriched} 条")

    # ── 清理内部字段 ──
    for it in unique:
        it.pop("_category", None)
        it.pop("_code", None)
        it.setdefault("sellerName", "")
        it.setdefault("sellerPhone", "")

    with_price = sum(1 for x in unique if x.get("priceCny") or x.get("priceEur"))
    on_request = sum(1 for x in unique if not x.get("priceCny") and not x.get("priceEur"))

    output = {
        "scrapedAt": datetime.now().isoformat(),
        "source": "agroline",
        "totalListings": len(unique),
        "withPrice": with_price,
        "priceOnRequest": on_request,
        "platformStats": {"agroline": len(unique)},
        "listings": unique,
    }

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 60)
    print("✅ 采集完成（agroline.cn）")
    print(f"📊 总条数: {output['totalListings']}")
    print(f"💰 有价(¥): {with_price} ｜ 待询: {on_request}")
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
