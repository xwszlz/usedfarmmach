#!/usr/bin/env python3
"""
#1 卖方采集 Agent — 国内全平台卖家爬虫 V3（ECS 境内 IP 版）
========================================================
采集国内平台上在售的二手国际品牌农机信息。本脚本由 cn-scout 容器
（node:22-alpine + python3 + py3-requests，DOMESTIC IP）每日 07:10 调用，
写入 scripts/domestic_sellers_data_v2.json，再由 import-seller-scout-domestic.js
入库 cn-postgres 的 RawListing 表（数据不出境红线）。

目标品牌（9大国际品牌）：
  John Deere / CLAAS / New Holland / Case IH / Massey Ferguson
  MTZ/Belarus / Kubota / Krone / McHale

目标国内平台（仅境内 IP 可达，必须在 ECS 跑）：
  1. 农机通 nongjitong.com — 服务端渲染(SSR)，/ershou/ 列表可直接 requests 抓 ✅
  2. 惠农网 cnhnb.com — B2B，best-effort（需境内IP+可能调选择器）
  3. 1005nd.com — 二手机械，best-effort
  4. 鱼泡机械 yupao.com — 机械交易，best-effort
  5. 公拍网 gpai.net — 司法/拍卖，best-effort
  6. 司法拍卖 sf.taobao.com — 淘宝司法，best-effort（通常需登录）
  （抖音/快手具体车源在直播间/私信，需App登录，requests 不可达，故不纳入）

注意：农机通旧版用 second-hand.html?keyword= 已 404；正确端点为
  /ershou/（SSR 混合流，按品牌在解析时过滤）与
  so.nongjitong.com/SecondHand/Search.aspx?brand=<编码>（按品牌搜索）。
本版以 /ershou/ SSR 为主，可靠且无浏览器依赖。

输出：标准 JSON，与 import-seller-scout-domestic.ts/js 兼容
      （字段：brand/modelName/year/engineHours/priceCny/priceEur/country/
       location/sellerName/sellerPhone/source/sourceUrl/sourceDate）
"""

import requests
import re
import json
import time
import hashlib
import os
import sys
import subprocess
from datetime import datetime
from urllib.parse import quote, urljoin, urlparse

# ── 配置 ──

# ⚠️ 关键：本脚本只在境内 ECS（北京 IP）运行。任何代理（含 CI/沙箱注入的
# HTTPS_PROXY→境外 IP）都会导致农机通等站点返回 403（地理封锁）。故此脚本
# 强制直连、绝不使用代理；curl 兜底也用 --noproxy '*'。
PROXY = {}  # 永远空：不读取/不使用任何代理

# 住宅代理（可选）：设了则所有请求走该代理，绕过"云IP被国内站点WAF/反爬封禁"。
# 例：RESIDENTIAL_PROXY = "http://user:pass@cn-residential-proxy:port"
# 留空=境内直连（当前阿里云ECS直连被各平台WAF及搜索引擎反爬软封禁，需配此代理才出数）。
RESIDENTIAL_PROXY = os.environ.get("RESIDENTIAL_PROXY", "")

BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
}

# 9大国际品牌 → 中文名 + 搜索关键词 + 别名
BRANDS = [
    {"id": "john-deere", "zh": "约翰迪尔", "en": "John Deere", "alias": ["迪尔"]},
    {"id": "claas", "zh": "克拉斯", "en": "CLAAS", "alias": ["科乐收"]},
    {"id": "new-holland", "zh": "纽荷兰", "en": "New Holland", "alias": []},
    {"id": "case-ih", "zh": "凯斯", "en": "Case IH", "alias": ["凯斯纽荷兰"]},
    {"id": "massey-ferguson", "zh": "麦赛福格森", "en": "Massey Ferguson", "alias": ["爱科"]},
    {"id": "mtz", "zh": "明斯克", "en": "MTZ", "alias": ["白俄罗斯", "Belarus"]},
    {"id": "kubota", "zh": "久保田", "en": "Kubota", "alias": []},
    {"id": "krone", "zh": "科罗尼", "en": "Krone", "alias": []},
    {"id": "mchale", "zh": "麦克海尔", "en": "McHale", "alias": []},
]

# 品牌命中：构建 (zh或别名) → zh 的映射，用于混合流按品牌过滤
BRAND_HIT = {}
for _b in BRANDS:
    BRAND_HIT[_b["zh"]] = _b["zh"]
    for _a in _b["alias"]:
        BRAND_HIT[_a] = _b["zh"]

NJT_BASE = "https://www.nongjitong.com/ershou/"

# 输出文件：写在脚本同级（scripts/）目录下，与 import-seller-scout-domestic 的 __dirname 一致
OUTPUT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "domestic_sellers_data_v2.json")
TODAY = datetime.now().strftime("%Y%m%d")


# 进程级 cookie 文件（curl 兜底共享，模拟浏览器会话保持）
_CJ = "/tmp/njt_cookies.txt"


def get_session():
    """创建不走代理的 requests session（境内直连）"""
    sess = requests.Session()
    sess.headers.update(BROWSER_HEADERS)
    # 强制不使用任何代理（避免沙箱/CI 注入的境外 HTTPS_PROXY 触发地理封锁）
    sess.proxies = {"http": None, "https": None}
    sess.trust_env = False  # 不读取环境里的 http_proxy/https_proxy
    return sess


def _is_blocked(html: str) -> bool:
    """判断是否为 WAF 拦截页（而非真实内容）"""
    if not html:
        return True
    low = html.lower()
    return ("access denied" in low) or ("403 forbidden" in low) or ("<title>访问</title>" in low)


def fetch_html(url: str, sess=None, timeout: int = 25) -> str | None:
    """抓取。默认境内直连（无代理）；若设了 RESIDENTIAL_PROXY 则走住宅代理
    （绕过云IP被WAF/反爬封禁）。先试 requests，失败兜底 curl。返回文本或 None。"""
    get = sess.get if sess else requests.get
    # 住宅代理：解决"阿里云等云IP被国内站点WAF/反爬软封禁"问题
    proxies = {"http": RESIDENTIAL_PROXY, "https": RESIDENTIAL_PROXY} if RESIDENTIAL_PROXY else {"http": None, "https": None}
    try:
        r = get(url, headers=BROWSER_HEADERS, timeout=timeout, proxies=proxies, verify=True)
        if r.status_code == 200 and not _is_blocked(r.text) and len(r.text) > 800:
            return r.text
    except requests.exceptions.SSLError:
        try:
            r = get(url, headers=BROWSER_HEADERS, timeout=timeout, proxies=proxies, verify=False)
            if r.status_code == 200 and not _is_blocked(r.text) and len(r.text) > 800:
                return r.text
        except Exception:
            pass
    except Exception:
        pass
    # 2) curl 兜底
    try:
        ua = BROWSER_HEADERS["User-Agent"]
        cmd = ["curl", "-s", "--max-time", str(timeout)]
        if RESIDENTIAL_PROXY:
            cmd += ["-x", RESIDENTIAL_PROXY]          # 走住宅代理
        else:
            cmd += ["--noproxy", "*"]                 # 直连
        cmd += [
            "-A", ua,
            "-H", "Accept: " + BROWSER_HEADERS["Accept"],
            "-H", "Accept-Language: " + BROWSER_HEADERS["Accept-Language"],
            "-H", "Upgrade-Insecure-Requests: 1",
            "-c", _CJ, "-b", _CJ,
            url,
        ]
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout + 10)
        if out.returncode == 0 and out.stdout and not _is_blocked(out.stdout) and len(out.stdout) > 800:
            return out.stdout
    except Exception:
        pass
    return None


def extract_json_from_html(text: str):
    for m in re.finditer(r'<script[^>]*type="application/ld+json"[^>]*>(.*?)</script>', text, re.DOTALL):
        try:
            return json.loads(m.group(1))
        except Exception:
            continue
    return None


def normalize_price(text: str) -> float | None:
    """从文本中提取价格（万元→元）"""
    if not text:
        return None
    text = text.replace(",", "").replace("，", "").strip()
    # 万元（如 "5.8万" / "￥230万" / "价格4.6万"）
    m = re.search(r'([\d.]+)\s*万', text)
    if m:
        return round(float(m.group(1)) * 10000, 2)
    # 元（如 "58000元" / "￥58000"）
    m = re.search(r'([\d.]+)\s*元', text)
    if m:
        return float(m.group(1))
    m = re.search(r'￥\s*([\d.]+)', text)
    if m:
        return float(m.group(1))
    return None


def extract_year(text: str) -> int | None:
    if not text:
        return None
    m = re.search(r'(19\d{2}|20[0-2]\d)', text)
    return int(m.group(1)) if m else None


def extract_hours(text: str) -> int | None:
    if not text:
        return None
    m = re.search(r'(\d+)\s*[小h时時鐘钟]', text)
    if m:
        return int(m.group(1))
    m = re.search(r'(\d{3,5})\s*h', text, re.IGNORECASE)
    return int(m.group(1)) if m else None


def extract_phone(text: str) -> str | None:
    if not text:
        return None
    m = re.search(r'(1[3-9]\d{9})', text)
    return m.group(1) if m else None


def match_brand(title: str) -> str | None:
    for zh, hit in BRAND_HIT.items():
        if zh in title:
            return hit
    return None


def generate_content_hash(brand, model, year, location, price) -> str:
    key = f"{brand}|{model}|{year or ''}|{location}|{price or ''}"
    return hashlib.md5(key.encode()).hexdigest()


def _mk(brand, title, price_yuan, year, hours, loc, phone, source, url, model_override=None):
    model = model_override or title
    for b in BRANDS:
        model = model.replace(b["zh"], "").replace(" ".join(b["alias"]), "")
    model = model.strip()[:50] or title[:50]
    return {
        "brand": brand,
        "modelName": model,
        "year": year,
        "engineHours": hours,
        "priceCny": price_yuan,
        "country": "CN",
        "location": loc or "中国",
        "sellerName": "",
        "sellerPhone": phone or "",
        "source": source,
        "sourceUrl": url,
        "sourceDate": TODAY,
    }


# ═══════════════════════════════════════════════
# 平台 1: 农机通 (nongjitong.com) — SSR，requests 直抓
# ═══════════════════════════════════════════════

def scrape_nongjitong(sess) -> list:
    """采集农机通二手信息（SSR 混合流，按品牌过滤）。
    卡片结构：<li><a href><img alt><h4>标题</h4><p>价格</p>
              <div>年份 | 小时 | 地区</div><div>日期</div></a></li>
    """
    results = []
    try:
        # 先访问首页拿 cookie（部分 WAF 首次访问下发会话 cookie）
        fetch_html("https://www.nongjitong.com/", sess=sess, timeout=15)
        time.sleep(0.8)
        html = fetch_html(NJT_BASE, sess=sess, timeout=25)
        if not html:
            print("  ⚠️ 农机通 /ershou/ 未取到内容（可能被 WAF 拦截或境外 IP）。"
                  "请确认本脚本运行在境内 ECS。", file=sys.stderr)
            return results
        # 诊断日志（境内 IP 下应看到 h4>0、含品牌名）
        h4n = len(re.findall(r'<h4>', html))
        print(f"  🔎 农机通诊断: 字节={len(html)} <h4>卡片={h4n} "
              f"含'约翰迪尔'={'约翰迪尔' in html}", file=sys.stderr)
        # 抓所有 <li><a> 含 <h4> 的卡片
        cards = re.findall(
            r'<li>\s*<a[^>]*href="([^"]+)"[^>]*>.*?<h4>(.*?)</h4>.*?<p>(.*?)</p>(.*?)</a>',
            html, re.DOTALL)
        for href, title, price_txt, rest in cards:
            brand = match_brand(title)
            if not brand:
                continue
            price_yuan = normalize_price(price_txt)  # 价格X万/￥X万/价格面议→None
            # meta: "2017年 | 1小时 | 甘肃酒泉"
            meta_div = re.search(r'<div>(.*?)</div>', rest)
            meta = meta_div.group(1) if meta_div else ""
            year = extract_year(meta)
            hours = extract_hours(meta)
            parts = [p.strip() for p in meta.split("|")]
            loc = parts[2] if len(parts) >= 3 else (parts[1] if len(parts) == 2 else "")
            phone = extract_phone(rest) or extract_phone(title)
            results.append(_mk(brand, title, price_yuan, year, hours, loc, phone,
                               "nongjitong.com", href))
        # best-effort：按品牌搜索页（可能 JS 渲染，抓不到就 0 条，不报错）
        for b in BRANDS:
            try:
                u = "https://so.nongjitong.com/SecondHand/Search.aspx?brand=" + quote(b["zh"])
                h2 = fetch_html(u, sess=sess, timeout=20)
                if not h2:
                    continue
                c2 = re.findall(
                    r'<li>\s*<a[^>]*href="([^"]+)"[^>]*>.*?<h4>(.*?)</h4>.*?<p>(.*?)</p>(.*?)</a>',
                    h2, re.DOTALL)
                for href, title, price_txt, rest in c2:
                    if not match_brand(title):
                        continue
                    price_yuan = normalize_price(price_txt)
                    meta_div = re.search(r'<div>(.*?)</div>', rest)
                    meta = meta_div.group(1) if meta_div else ""
                    year = extract_year(meta)
                    hours = extract_hours(meta)
                    parts = [p.strip() for p in meta.split("|")]
                    loc = parts[2] if len(parts) >= 3 else (parts[1] if len(parts) == 2 else "")
                    phone = extract_phone(rest) or extract_phone(title)
                    results.append(_mk(match_brand(title), title, price_yuan, year, hours, loc, phone,
                                       "nongjitong.com", href))
                time.sleep(0.5)
            except Exception:
                continue
    except Exception:
        pass
    return results


# ═══════════════════════════════════════════════
# 平台 2..N: best-effort 通用采集（需境内 IP，选择器可能需微调）
# ═══════════════════════════════════════════════

def _generic_collect(sess, url: str, source_name: str, max_items: int = 25) -> list:
    """通用 best-effort 采集：在所有 <a> 文本中找含国际品牌 + 价格的条目。
    对未知站点鲁棒：抓不到/被反爬均静默返回空，不影响整体。"""
    results = []
    try:
        html = fetch_html(url, sess=sess, timeout=25)
        if not html:
            return results
        seen = set()
        for m in re.finditer(r'<a[^>]*href="([^"]+)"[^>]*>(.*?)</a>', html, re.DOTALL):
            href, inner = m.group(1), m.group(2)
            txt = re.sub(r'<[^>]+>', ' ', inner)
            txt = re.sub(r'\s+', ' ', txt).strip()
            if len(txt) < 6 or len(txt) > 200:
                continue
            brand = match_brand(txt)
            if not brand:
                continue
            price_yuan = normalize_price(txt)
            if price_yuan is None and "面议" not in txt:
                continue  # 无价格且无"面议"的噪音链接跳过
            year = extract_year(txt)
            hours = extract_hours(txt)
            loc = ""
            lm = re.search(r'(?:所在地|地区|省份|城市|地点)[：: ]*([^\s|,]+)', txt)
            if lm:
                loc = lm.group(1)
            phone = extract_phone(txt)
            key = (brand, txt[:40])
            if key in seen:
                continue
            seen.add(key)
            results.append(_mk(brand, txt, price_yuan, year, hours, loc, phone,
                               source_name, urljoin(url, href)))
            if len(results) >= max_items:
                break
    except Exception:
        pass
    return results


def scrape_huiminnong(sess) -> list:
    """惠农网 cnhnb.com — B2B，按品牌搜索（best-effort）"""
    out = []
    for b in BRANDS[:4]:  # 取前几个主力品牌避免过慢
        out += _generic_collect(sess, f"https://www.cnhnb.com/search?keyword={quote(b['zh'])}", "cnhnb.com")
        time.sleep(0.6)
    return out


def scrape_1005nd(sess) -> list:
    """1005nd.com — 二手机械（best-effort）"""
    return _generic_collect(sess, "https://www.1005nd.com/ershou/", "1005nd.com")


def scrape_yupao(sess) -> list:
    """鱼泡机械 yupao.com — 机械交易（best-effort）"""
    return _generic_collect(sess, "https://www.yupao.com/", "yupao.com")


def scrape_gongpai(sess) -> list:
    """公拍网 gpai.net — 司法/拍卖（best-effort）"""
    return _generic_collect(sess, "https://www.gpai.net/", "gpai.net")


def scrape_sifa(sess) -> list:
    """司法拍卖 sf.taobao.com — 淘宝司法（best-effort，通常需登录）"""
    out = []
    for b in BRANDS[:4]:
        out += _generic_collect(sess, f"https://sf.taobao.com/item_list.htm?keyword={quote(b['zh'])}", "sf.taobao.com")
        time.sleep(0.6)
    return out


# ═══════════════════════════════════════════════
# 搜索引擎中介采集（绕开直连 WAF：只打 Bing/Baidu，解析结果摘要）
# ═══════════════════════════════════════════════

BING_SEARCH = "https://www.bing.com/search?q="
BAIDU_SEARCH = "https://www.baidu.com/s?wd="

_PROVINCES = ["北京", "天津", "上海", "重庆", "河北", "山西", "辽宁", "吉林", "黑龙江", "江苏",
              "浙江", "安徽", "福建", "江西", "山东", "河南", "湖北", "湖南", "广东", "海南",
              "四川", "贵州", "云南", "陕西", "甘肃", "青海", "台湾", "内蒙古", "广西", "西藏",
              "宁夏", "新疆", "香港", "澳门"]


def _clean(s):
    if not s:
        return ""
    s = re.sub(r"<[^>]+>", " ", s)
    s = re.sub(r"&[a-z]+;", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def _parse_search_blocks(html: str):
    """从搜索结果页解析 (title, snippet, url) 三元组，兼容 Bing/Baidu。"""
    blocks = []
    for b in re.findall(r'<li class="b_algo".*?</li>', html, re.DOTALL):
        href = re.search(r'<h2[^>]*>\s*<a[^>]*href="([^"]+)"', b)
        title = re.search(r'<h2[^>]*>\s*<a[^>]*>(.*?)</a>', b, re.DOTALL)
        snip = re.search(r'<p[^>]*>(.*?)</p>', b, re.DOTALL)
        if href and title:
            blocks.append((_clean(title.group(1)), _clean(snip.group(1)) if snip else "", href.group(1)))
    if blocks:
        return blocks, "bing"
    for b in re.findall(r'<div class="result[^"]*c-container[^"]*".*?</div>\s*</div>\s*</div>', html, re.DOTALL):
        href = re.search(r'<h3[^>]*>\s*<a[^>]*href="([^"]+)"', b)
        title = re.search(r'<h3[^>]*>\s*<a[^>]*>(.*?)</a>', b, re.DOTALL)
        snip = re.search(r'class="c-abstract[^"]*">(.*?)</div>', b, re.DOTALL)
        if href and title:
            blocks.append((_clean(title.group(1)), _clean(snip.group(1)) if snip else "", href.group(1)))
    if blocks:
        return blocks, "baidu"
    return [], "none"


def extract_location(text: str) -> str:
    """从文本提取省份/城市（best-effort）。"""
    if not text:
        return ""
    for p in _PROVINCES:
        if p in text:
            m = re.search(re.escape(p) + r"(?:省|市|自治区)?\s*([\u4e00-\u9fa5]{2,6}?(?:市|区|县))?", text)
            if m:
                return (p + (m.group(1) or "")).strip()
            return p
    return ""


def scrape_via_search(sess, brands=None, max_per_brand=10) -> list:
    """搜索引擎中介采集：用 Bing/Baidu 搜 '二手农机 <品牌> 价格 出售 现货'，
    解析结果摘要（标题+摘要+URL），从中提取品牌/价格/地区，绕开直连 WAF（只打搜索引擎，
    不直连被封的平台域名）。返回记录列表（source=结果域名, sourceUrl=结果URL）。"""
    results = []
    brands = brands or BRANDS
    seen_urls = set()
    for b in brands:
        q = f"二手农机 {b['zh']} 价格 出售 现货"
        for base in (BING_SEARCH, BAIDU_SEARCH):
            try:
                html = fetch_html(base + quote(q), sess=sess, timeout=20)
            except Exception:
                html = None
            if not html:
                continue
            blocks, engine = _parse_search_blocks(html)
            for title, snip, url in blocks[:max_per_brand]:
                if url in seen_urls:
                    continue
                seen_urls.add(url)
                text = title + " " + snip
                brand_zh = match_brand(text)
                if not brand_zh:
                    continue
                price = normalize_price(title) or normalize_price(snip)
                loc = extract_location(snip) or extract_location(title)
                dom = urlparse(url).netloc
                results.append(_mk(brand_zh, _clean(title), price, None, None, loc, None,
                                   dom or "search", url))
            if blocks:
                break
        time.sleep(0.5)
    return results


# ═══════════════════════════════════════════════
# 主流程
# ═══════════════════════════════════════════════

def main():
    # ── 命令行：--test 仅跑连通性诊断（农机通直连 + 搜索引擎中介），不写文件 ──
    test_mode = "--test" in sys.argv

    print("=" * 60)
    print(f"🚜 #1 卖方采集 — 国内卖家全平台爬虫 V3.2（搜索引擎中介版）")
    print(f"📅 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    if test_mode:
        print("🧪 TEST 模式：仅验证连通性，不写文件")
    print("=" * 60)

    if RESIDENTIAL_PROXY:
        print(f"🌐 住宅代理: 已启用 ({RESIDENTIAL_PROXY[:24]}...)")
    else:
        print("🌐 住宅代理: 未配置（阿里云直连，各平台WAF/反爬软封禁，预期 0 条）")

    sess = get_session()
    all_listings = []
    platform_stats = {}

    if test_mode:
        # 农机通直连诊断（云IP被WAF封时应为0，已知现象）
        print("▶ 农机通（直连诊断）...", end=" ", flush=True)
        nj = scrape_nongjitong(sess)
        print(f"{len(nj)} 条")
        # 搜索引擎中介（约翰迪尔 样例）
        print("▶ 搜索引擎中介（约翰迪尔 样例）...", end=" ", flush=True)
        jd = [b for b in BRANDS if b["id"] == "john-deere"]
        sr = scrape_via_search(sess, brands=jd)
        print(f"{len(sr)} 条")
        print("\n" + "=" * 60)
        print("🧪 TEST 结果")
        print(f"   农机通直连命中: {len(nj)}（云IP被WAF封时为0，已知现象）")
        print(f"   搜索引擎(约翰迪尔)命中: {len(sr)}")
        if sr:
            print("   样例:")
            for r in sr[:3]:
                print(f"     - [{r['brand']}] {r['modelName'][:40]} | 价={r['priceCny']} | {r['location']} | {r['source']}")
            print("   ✅ 搜索引擎中介方案可行，去掉 --test 正式运行即可。")
        else:
            print("   ⚠️ 搜索引擎也 0 条：Bing/Baidu 可能也封了云IP，需上住宅代理(RESIDENTIAL_PROXY)。")
        print("=" * 60)
        return {"source": "domestic_scraper_v3_2_test", "nj": len(nj), "search": len(sr)}

    # ── 正式采集：直连平台(best-effort) + 搜索引擎中介 ──
    brand_agnostic = [
        ("农机通", scrape_nongjitong),
        ("惠农网", scrape_huiminnong),
        ("1005nd", scrape_1005nd),
        ("鱼泡机械", scrape_yupao),
        ("公拍网", scrape_gongpai),
        ("司法拍卖", scrape_sifa),
        ("搜索引擎中介", scrape_via_search),
    ]
    for label, fn in brand_agnostic:
        print(f"▶ {label}...", end=" ", flush=True)
        try:
            lst = fn(sess)
            all_listings.extend(lst)
            platform_stats[label] = platform_stats.get(label, 0) + len(lst)
            print(f"{len(lst)} 条")
        except Exception as e:
            print(f"失败: {e}")
        time.sleep(0.5)

    # ── 去重（按 contentHash）──
    seen = set()
    unique = []
    for item in all_listings:
        h = generate_content_hash(item["brand"], item["modelName"], item.get("year"),
                                  item.get("location", ""), item.get("priceCny") or item.get("priceEur"))
        if h not in seen:
            seen.add(h)
            unique.append(item)

    output = {
        "source": "domestic_scraper_v3_2",
        "scrapedAt": datetime.now().isoformat(),
        "totalListings": len(unique),
        "withPrice": sum(1 for l in unique if l.get("priceCny") or l.get("priceEur")),
        "priceOnRequest": sum(1 for l in unique if not l.get("priceCny") and not l.get("priceEur")),
        "platformStats": platform_stats,
        "listings": unique,
    }

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
