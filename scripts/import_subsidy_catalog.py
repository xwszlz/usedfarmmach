# -*- coding: utf-8 -*-
# ─────────────────────────────────────────────────────────────────────────────
# 国内农机补贴库 —— 清洗聚合器（只产出中间 jsonl，绝不连库）
# ─────────────────────────────────────────────────────────────────────────────
#
# ⚠️ 运行环境约束（合规红线）：
#   - 本脚本【只在境内 ECS】运行（SITE=cn / 有 DATABASE_URL_CN）。
#   - 【禁止】在 GitHub Actions / 任何境外 runner 执行（境外处理境内 PII = 数据出境）。
#   - 【禁止】把产物（catalog.jsonl / raw.jsonl）上传到境外 / 公开桶。
#   - 本脚本【不连接数据库、不 import Prisma】，只把两个中间产物写到本地 OUT_DIR，
#     由配套的 import_subsidy_catalog.ts 在境内入库。
#
# 数据口径（对齐《建设方案》§3）：
#   - 按【表头名】取列（兼容 7 种表头变体），不用列序号；
#   - 只取「资金已兑付」；
#   - 剔除购机日期年份 <1980 或 > 当前年+1 的异常行；
#   - 机龄按「购机日期」字段算，不按文件名年份；
#   - 价格只算中位数 + p25/p75 + Tukey 截尾（禁均值）；
#   - 品牌保留厂家法人全称（禁 [:4] 截断；品牌归并映射表为后续人工步骤，P1 不实现）；
#   - 聚合键含 batchCode，contentHash 必须绑定 batchCode（否则按月重导被 skipDuplicates 全跳过）。
# ─────────────────────────────────────────────────────────────────────────────

import csv
import hashlib
import json
import os
import sys
from datetime import datetime

# ── 合规护栏：境内才允许跑（fail-closed，对齐 scripts/import-seller-scout-domestic.ts）──
SITE = os.environ.get("SITE")
HAS_CN_DB = bool(os.environ.get("DATABASE_URL_CN"))
if SITE != "cn" and not HAS_CN_DB:
    sys.stderr.write(
        "❌ 合规拦截：补贴数据聚合必须运行在境内（SITE=cn 或 设置 DATABASE_URL_CN）。\n"
        "   本脚本禁止在 GitHub Actions / 境外 runner 执行，以免中国购机者 PII 出境。\n"
    )
    sys.exit(2)

SOURCE_DIR = os.environ.get("SUBSIDY_SOURCE_DIR", r"D:\Desktop\补贴数据库")
# 产物只写到本地（境内）目录，不碰库、不对外
OUT_DIR = os.environ.get(
    "SUBSIDY_OUT_DIR", r"D:\神雕农机\tmp-hlj-removal\subsidy-out"
)
# 首批存量导入批次号；增量按月导入时改为如 domestic-2026-12
BATCH_CODE = os.environ.get("SUBSIDY_BATCH", "domestic-seed-2026-11")

# 表头别名（归一化后匹配；与 src/lib/subsidy/aggregate.ts 保持语义一致）
HEADER_ALIASES = {
    "province": ["省", "省份", "省别"],
    "county": ["县", "县市", "县市区", "县（市、区）"],
    "township": ["所在乡(镇)", "所在乡（镇）", "所在乡镇", "乡镇", "乡(镇)", "乡（镇）"],
    "buyername": ["购机者姓名", "购机者", "购机人", "购机人姓名", "受益人姓名", "受益人或组织名称"],
    "manufacturer": ["生产厂家", "生产企业", "厂家", "生产企业名称", "生产企业（组织）名称"],
    "category": ["机具品目", "品目", "机具类别", "机具类型", "补贴品目"],
    "productname": ["产品名称", "产品"],
    "modelname": ["购买机型", "机型", "型号", "购买型号", "机具型号"],
    "quantity": ["购买数量(台)", "购买数量（台）", "购买数量", "数量", "台数"],
    "dealer": ["经销商", "销售商", "经销商名称", "销售企业名称"],
    "purchasedate": ["购机日期", "购机时间", "购买日期", "购买时间"],
    "salepricecny": [
        "单台销售价格(元)", "单台销售价格（元）", "单台销售价格", "销售价格(元)",
        "销售价格（元）", "销售价格", "单台售价(元)", "单台售价", "售价(元)", "售价",
    ],
    "centralsubsidycny": [
        "单台中央补贴额(元)", "单台中央补贴额（元）", "单台中央补贴额", "中央补贴额(元)",
        "中央补贴额（元）", "中央补贴", "中央补贴额",
    ],
    "totalsubsidycny": [
        "总补贴额(元)", "总补贴额（元）", "总补贴", "总补贴额", "补贴总额(元)",
        "补贴总额（元）", "补贴总额", "补贴额(元)", "补贴额",
    ],
    "serialno": ["出厂编号", "出厂编号（底盘号）", "出厂编号(底盘号)", "底盘号", "机架号"],
    "status": ["状态", "补贴状态", "兑付状态", "资金状态"],
}


def normalize_header(s):
    out = []
    for ch in s:
        if ch in "（）() \t":
            continue
        if ch in "／/":
            continue
        out.append(ch.lower())
    return "".join(out)


# 预构建归一化别名 → 字段
ALIAS_TO_FIELD = {}
for _field, _aliases in HEADER_ALIASES.items():
    for _a in _aliases:
        ALIAS_TO_FIELD[normalize_header(_a)] = _field


def build_header_map(header):
    m = {}
    for idx, h in enumerate(header):
        f = ALIAS_TO_FIELD.get(normalize_header(h))
        if f and f not in m:
            m[f] = idx
    return m


def parse_date(s):
    s = (s or "").strip()
    if not s:
        return None
    s = s.replace("/", "-").replace(" ", "")
    for fmt in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            pass
    # yyyyMMdd
    if len(s) == 8 and s.isdigit():
        try:
            return datetime.strptime(s, "%Y%m%d")
        except ValueError:
            return None
    return None


def parse_number(s):
    if s is None:
        return None
    s = (s or "").strip().replace(",", "").replace("¥", "").replace("￥", "")
    if s == "":
        return None
    try:
        return float(s)
    except ValueError:
        return None


def percentile(sorted_vals, p):
    m = len(sorted_vals)
    if m == 0:
        return 0.0
    if m == 1:
        return sorted_vals[0]
    idx = p * (m - 1)
    lo = int(idx // 1)
    hi = lo + 1 if lo + 1 < m else lo
    if lo == hi:
        return sorted_vals[lo]
    return sorted_vals[lo] + (sorted_vals[hi] - sorted_vals[lo]) * (idx - lo)


def robust_stats(values):
    if not values:
        return 0.0, None, None
    sorted_vals = sorted(values)
    q1 = percentile(sorted_vals, 0.25)
    q3 = percentile(sorted_vals, 0.75)
    iqr = q3 - q1
    lower = q1 - 1.5 * iqr
    upper = q3 + 1.5 * iqr
    trimmed = [v for v in sorted_vals if lower <= v <= upper]
    base = trimmed if len(trimmed) >= 2 else sorted_vals
    return percentile(base, 0.5), percentile(base, 0.25), percentile(base, 0.75)


def round2(n):
    return round(n * 100) / 100


def md5(text):
    return hashlib.md5(text.encode("utf-8")).hexdigest()


def collect_csv_files(root):
    out = []
    for dirpath, _dirnames, filenames in os.walk(root):
        for fn in filenames:
            if fn.lower().endswith(".csv"):
                out.append(os.path.join(dirpath, fn))
    return out


def parse_rows_from_file(path, province, source_file):
    rows = []
    now_year = datetime.now().year
    with open(path, "r", encoding="utf-8", newline="") as fh:
        reader = csv.reader(fh)
        try:
            header = next(reader)
        except StopIteration:
            return rows
        hmap = build_header_map(header)
        data_rows = 0
        for r in reader:
            if not any((c or "").strip() for c in r):
                continue  # 空行
            data_rows += 1
            status = (r[hmap["status"]] if "status" in hmap else "").strip() if "status" in hmap else ""
            if status != "资金已兑付":
                continue
            date = parse_date(r[hmap["purchasedate"]] if "purchasedate" in hmap else "")
            if not date:
                continue
            year = date.year
            if year < 1980 or year > now_year + 1:
                continue
            sale = parse_number(r[hmap["salepricecny"]] if "salepricecny" in hmap else "")
            if sale is None:
                continue
            prov = (r[hmap["province"]] if "province" in hmap else province or "").strip()
            manufacturer = (r[hmap["manufacturer"]] if "manufacturer" in hmap else "").strip()
            category = (r[hmap["category"]] if "category" in hmap else "").strip()
            model = (r[hmap["modelname"]] if "modelname" in hmap else "").strip()
            if not (prov and manufacturer and category and model):
                continue  # 维度缺失（含省列缺失）→ 跳过
            rows.append({
                "province": prov,
                "county": (r[hmap["county"]] if "county" in hmap else "").strip(),
                "township": (r[hmap["township"]] if "township" in hmap else "").strip(),
                "buyerName": (r[hmap["buyername"]] if "buyername" in hmap else "").strip(),
                "manufacturer": manufacturer,
                "category": category,
                "productName": (r[hmap["productname"]] if "productname" in hmap else "").strip(),
                "modelName": model,
                "quantity": int(parse_number(r[hmap["quantity"]] if "quantity" in hmap else "") or 1),
                "dealer": (r[hmap["dealer"]] if "dealer" in hmap else "").strip(),
                "purchaseDate": date,
                "salePriceCny": sale,
                "centralSubsidyCny": parse_number(r[hmap["centralsubsidycny"]] if "centralsubsidycny" in hmap else ""),
                "totalSubsidyCny": parse_number(r[hmap["totalsubsidycny"]] if "totalsubsidycny" in hmap else ""),
                "serialNo": (r[hmap["serialno"]] if "serialno" in hmap else "").strip(),
                "status": status,
                "sourceFile": source_file,
            })
        # 空壳文件（无有效数据行）直接返回空
        if data_rows == 0:
            return []
    return rows


def main():
    csv_files = collect_csv_files(SOURCE_DIR)
    print("📂 发现 CSV 文件：%d 个（来源目录：%s）" % (len(csv_files), SOURCE_DIR))
    if not csv_files:
        sys.stderr.write("❌ 未找到任何 CSV，检查 SUBSIDY_SOURCE_DIR。\n")
        sys.exit(2)

    # 聚合分组
    groups = {}
    raw_records = []
    total_valid = 0
    total_skipped_empty = 0

    for path in csv_files:
        province = os.path.basename(os.path.dirname(path))  # 父目录名 = 省份
        source_file = os.path.relpath(path, SOURCE_DIR)
        rows = parse_rows_from_file(path, province, source_file)
        if not rows:
            total_skipped_empty += 1
            continue
        total_valid += len(rows)
        for row in rows:
            py = row["purchaseDate"].year
            key = "|".join([
                row["manufacturer"], row["category"], row["modelName"],
                row["province"], str(py), BATCH_CODE,
            ])
            groups.setdefault(key, []).append(row)
            # 内层 PII 明细（只落 .cn，绝不公开）
            raw_records.append({
                "batchCode": BATCH_CODE,
                "sourceFile": row["sourceFile"],
                "province": row["province"],
                "county": row["county"],
                "township": row["township"],
                "buyerName": row["buyerName"],
                "manufacturer": row["manufacturer"],
                "category": row["category"],
                "productName": row["productName"],
                "modelName": row["modelName"],
                "quantity": row["quantity"],
                "dealer": row["dealer"],
                "purchaseDate": row["purchaseDate"].strftime("%Y-%m-%d"),
                "salePriceCny": row["salePriceCny"],
                "centralSubsidyCny": row["centralSubsidyCny"],
                "totalSubsidyCny": row["totalSubsidyCny"],
                "serialNo": row["serialNo"],
                "status": row["status"],
                "goodsRegion": "cn",  # 强制境内
                "contentHash": md5("|".join([
                    BATCH_CODE, row["province"], row["county"], row["township"],
                    row["buyerName"], row["manufacturer"], row["modelName"],
                    row["serialNo"], row["purchaseDate"].strftime("%Y-%m-%d"),
                    str(row["salePriceCny"]),
                ])),
            })

    # 聚合 → catalog 种子
    catalog_records = []
    for key, grp in groups.items():
        first = grp[0]
        py = first["purchaseDate"].year
        prices = [r["salePriceCny"] for r in grp]
        central = [r["centralSubsidyCny"] for r in grp if r["centralSubsidyCny"] is not None]
        total = [r["totalSubsidyCny"] for r in grp if r["totalSubsidyCny"] is not None]
        med, p25, p75 = robust_stats(prices)
        med_c = robust_stats(central)[0] if central else None
        med_t = robust_stats(total)[0] if total else None
        catalog_records.append({
            "batchCode": BATCH_CODE,
            "policyYear": py,
            "province": first["province"],
            "category": first["category"],
            "brandName": first["manufacturer"],  # 厂家法人全称，禁止 [:4] 截断
            "modelName": first["modelName"],
            "machineryType": None,
            "manufacturer": first["manufacturer"],
            "medianPriceCny": round2(med),
            "p25PriceCny": round2(p25) if p25 is not None else None,
            "p75PriceCny": round2(p75) if p75 is not None else None,
            "medianCentralSubsidy": round2(med_c) if med_c is not None else None,
            "medianTotalSubsidy": round2(med_t) if med_t is not None else None,
            "sampleSize": len(grp),
            "contentHash": md5("|".join([
                BATCH_CODE, first["manufacturer"], first["category"],
                first["modelName"], first["province"], str(py),
            ])),
            # 注：品牌归并（4664 法人 → ~1000 真品牌）为后续人工步骤，P1 保留全称。
        })

    # 写出中间产物（只落地本地，不连库）
    os.makedirs(OUT_DIR, exist_ok=True)
    catalog_path = os.path.join(OUT_DIR, "catalog.jsonl")
    raw_path = os.path.join(OUT_DIR, "raw.jsonl")
    with open(catalog_path, "w", encoding="utf-8") as fh:
        for rec in catalog_records:
            fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
    with open(raw_path, "w", encoding="utf-8") as fh:
        for rec in raw_records:
            fh.write(json.dumps(rec, ensure_ascii=False) + "\n")

    print("─" * 60)
    print("✅ 有效原始行（已兑付/年份正常/维度齐全）：%d" % total_valid)
    print("⏭️  空壳/无效文件跳过：%d" % total_skipped_empty)
    print("📊 聚合目录条目（SubsidyCatalog 种子）：%d" % len(catalog_records))
    print("🔒 内层 PII 明细（SubsidyRecordRaw 种子）：%d" % len(raw_records))
    print("📝 写出：%s" % catalog_path)
    print("📝 写出：%s" % raw_path)
    print("⚠️  本脚本不连库、不 import Prisma；入库请用 import_subsidy_catalog.ts（境内）。")


if __name__ == "__main__":
    main()
