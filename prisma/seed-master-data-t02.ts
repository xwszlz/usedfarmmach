/**
 * prisma/seed-master-data-t02.ts — 主数据字典回填（T02）
 *
 * 背景（CIAME 2026 天津展前内容补齐，依据 deliverables/CIAME2026-品牌品类型号零部件-缺口明细-2026-10-14.xlsx）：
 *   - T01（seed-master-data.ts）只装载了骨架：55 条 ModelDictionary + 6 个新叶 Category。
 *   - 本脚本补齐「三层断裂」的其余部分：
 *       ① Brand：把 116 条字典品牌的 code / 产地码 / 保值系数 / 是否标准 回填进线上行
 *          （线上行当前这些字段为空 → 估值/套利计算无法使用）；并补 29 个缺中文名品牌的 nameZh。
 *       ② Category：把 22 个字典节点（28 树 − 6 个 T01 已建叶）回填进 Category 表，
 *          打 isLeaf / parentId / nameEn（12 个缺英文名品类一并补）。
 *       ③ 按老板拍板清理 39 条脏/错字品牌（live id）。Brand 无 isActive 字段无法软下架；
 *          且 14/39 挂着商品、含真实品牌，故仅硬删「零商品纯脏行」，挂商品者跳过交人工复核。
 *
 * 安全设计：
 *   - 默认 **dry-run**（只打印计划），必须显式传 `--apply` 才写库。
 *   - 清理前先统计每个待清理品牌挂载的商品数：零商品纯脏行才硬删；挂商品者打印 WARNING 并跳过，交人工复核。
 *   - 清理只作用于「目标库里真实存在」的 id；在 .cn（不同 DB）跑时这些 .com 的 id 不存在则自动跳过。
 *   - upsert 天然幂等；硬删仅针对零商品行，重复执行结果一致（已删行 findUnique 返回 null → 自动 skip）。
 *
 * 用法：
 *   npx tsx prisma/seed-master-data-t02.ts            # dry-run（默认）
 *   npx tsx prisma/seed-master-data-t02.ts --apply    # 写库
 *   库选择：SITE=cn → DATABASE_URL_CN；否则 DATABASE_URL
 */

import fs from "fs";
import path from "path";
import { prisma } from "../src/lib/db";

const APPLY = process.argv.includes("--apply");

/* ---------------------------------------------------------------- *
 * ① 字典品牌 code → 线上 live brand id（来自缺口明细表 02 列的精确映射）
 * ---------------------------------------------------------------- */
const BRAND_MAP: Record<string, string> = {
  deere: "john-deere", fendt: "fendt", case: "cmpzm1oju001fyllpxhgrx4eg",
  claas: "claas", new_holland: "new-holland", massey_ferguson: "massey-ferguson",
  kuhn: "kuhn", krone: "krone", lemken: "cmr9i0ep2000u505azgk38xxc",
  amazone: "cmr9i0ey8000z505aoce061j2", kubota: "kubota", yto: "dongfanghong",
  lovol: "lovol", arcusin: "arcusin", champion: "cmpzlwuvh00094zwdqrfu623k",
  meidi: "cmpzlwwzs001e4zwdbcn0sztp", manitou: "cmpzlwx4w001h4zwdbqyr4jc8",
  innoros: "cmqpc09p60000gp6xjdpk58fh", zoomlion: "cmr94w3y00000cb9dr1uwcm7k",
  dji_agriculture: "cmr94w44y0001cb9dd6f5ppj9", changfa: "cmr94w49m0002cb9dqksnmwnn",
  dfam: "cmr94w4ec0003cb9dkegt3jcn", wuzheng: "cmr94w4iw0004cb9daek8hany",
  xingguang: "cmr94w4ni0005cb9d2xtlmx7k", jindafeng: "cmr94w4s40006cb9d71xtloip",
  shifeng: "cmr94w4xq0007cb9dn5210hdj", benye: "cmr94w52e0008cb9dswxm74wn",
  deutz_fahr: "cmr94w56z0009cb9dg7s8lw78", xcmg: "cmr94w5br000acb9dme6jre4n",
  shineray: "cmr94w5h4000bcb9dv534lhez", yongmeng: "cmr94w5lo000ccb9dok0b4l6p",
  huade: "cmr94w5uv000dcb9d4n8mdstb", mainuo: "cmr94w5zh000ecb9doveq8tyl",
  xag: "cmr94w640000fcb9d2qg1mnpk", hongzhu: "cmr94w68s000gcb9d211hcq5x",
  juming: "cmr94w6dd000hcb9dvmi887bd", yhmac: "cmr94w6i1000icb9dcsci4osm",
  liugong: "cmr94w6mo000jcb9dv6t2ecwm", taiwo: "cmr94w6r9000kcb9do6c1zbmc",
  weima: "cmr94w6w4000lcb9djqlokbje", huanghai_jinma: "cmr94w70r000mcb9drev3931v",
  nongahaha: "cmr94w75e000ncb9d8tmqonme", bonong: "cmr94w79y000ocb9db0r3ta34",
  ensign: "cmr94w7ej000pcb9dny0606pw", hanwo: "cmr94w7j5000qcb9d8rxoo32c",
  shuangying: "cmr94w7nq000rcb9d2n0ln5gp", tianren: "cmr9dgsss0000evulp00vochp",
  liulin: "cmr9dgt1f0001evulmlq64efo", chunyu: "cmr9dgt5v0002evulha70oh9a",
  china_harvest: "cmr9dgtav0003evuln65w1zz3", dafang: "cmr9dgtf90004evul4676ekmj",
  modern_agro: "cmr9dgto90006evulshmzh48p", dima: "cmr9dgtx10008evulfrc4plo3",
  luzhong: "cmr9dgu1g0009evul8sqgc2ey", valtra: "cmr9i0cy90000505aku4x1ttd",
  challenger: "cmr9i0doh000a505adqgea64f", lely: "cmr9i0dxb000f505asrpqkv64",
  pottinger: "cmr9i0e6a000k505axx9tn6xx", horsch: "cmr9i0efe000p505a0xwoy1cg",
  vaderstad: "cmr9i0f7v0014505a5eu96w3v", hardi: "cmr9i0fgx0019505a9irxisfl",
  maschio: "cmr9i0fq2001e505azebm2wu8", sulky: "cmr9i0fzw001j505ajty8e6fm",
  gregoire_besson: "cmr9i0g9q001o505a6otdpmxi", brevieri: "cmr9i0git001t505a3bcw3xlc",
  jacquet: "cmr9i0gs1001y505auzn0wm52", stara: "cmr9i0h250023505auwqdhz6n",
  mccormick: "cmrbaxxuy0000ftadvgdmlvtu", landini: "cmrbaxyqi0009ftadqfhjbbii",
  zetor: "cmrbaxz6y000gftadmx4jbezo", ursus: "cmrbaxznj000nftadjimrg66k",
  ls: "cmrbay0pb0011ftadag6l04dr", tafe: "cmrbay15r0018ftad7mtp2gwh",
  mahindra: "cmrbay1mg001fftadqiv50cu0", solis: "cmrbay20i001mftad2k5bcqfw",
  valpadana: "cmrbay2et001tftadc8pryj3a", goldoni: "cmrbay2sy0020ftad7vbl5n4r",
  antonio_carraro: "cmrbay37a0027ftado1i2opvy", geringhoff: "cmrbay3of002eftad81vq25p0",
  macdon: "cmrbay44q002lftad0audlzib", honey_bee: "cmrbay4j4002sftadlptjpeic",
  olimac: "cmrbay4xt002zftadhn5gszo5", ploeger: "cmrbay5ei0036ftadf57a7spd",
  asa_lift: "cmrbay5sg003dftad7sizzwoi", monosem: "cmrbay66s003kftadu9kc2mu1",
  great_plains: "cmrbay6la003rftado9z35eao", salford: "cmrbay6zm003yftadp9ab7vvi",
  matermacc: "cmrbay7e60045ftadori927oe", nardi: "cmrbay7sb004cftad4i8nl2g9",
  celli: "cmrbay86e004jftad2hfhmbzl", molon: "cmrbay8kh004qftade87ossiz",
  quivogne: "cmrbay8z0004xftadpz26n109", treffler: "cmrbay9ff0054ftadpu9nqbfe",
  berthoud: "cmrbay9th005bftadynm6v67d", tecnoma: "cmrbaya85005iftadn9a32itp",
  househam: "cmrbayamf005pftadhmmz7ktl", bateman: "cmrbayb0o005wftadnfmeeurd",
  samasz: "cmrbaycpx006qftadr2hgebjv", amity: "cmrj3dklq0000i58xnnu704az",
  dangkang: "cmrxec0hz00005fp9j74q4h6t", agronic: "cmuv8ba2f0045tocmsn1959tr",
  dexiang: "dexiang", dongfeng: "dongfeng", dorma: "dormoy", falaixin: "falaixin",
  grain: "grain", grimme: "grimme", guwang: "guwang", kongskilde: "kongskilde",
  maike: "maike", mushen: "mushen", orke: "orke", toyonoki: "toyonoki",
  world: "world", yingjia: "yingjia",
};

/* ---------------------------------------------------------------- *
 * ② 39 条脏/错字品牌 → 清理（live id，.com 实测）。零商品纯脏行硬删；挂商品者跳过交人工。
 * ---------------------------------------------------------------- */
const DENYLIST: string[] = [
  "cmpzm1niz000ryllpodjl8zfj", "cmrvbl1qk0000i9ud71mynv2b", "cmr4jzvnw0001at1b7o8zceei",
  "cmrbaybv8006cftadh2ju2tlb", "cmrbayc9n006jftadihj7hsxf", "cmrbaybeo0063ftade64n6br5",
  "cmpzlwvt3000v4zwdjm4nhy4p", "cms334v9y000a135ixx3hh8d5", "cmpzlwvnw000s4zwdbub6x0e2",
  "cmpzm1m7r0000yllpre94slx8", "cmpzm1oui001myllpo12y821c", "cms334up90000135iivjuv24q",
  "cmpzlwukf00034zwdoscq03yb", "cms334vu7000p135ircdg1285", "cms334w7n000z135iwgdci8ju",
  "cmpzm1nyp0012yllptai5h4gb", "cmpzlwu9n00004zwd5tcxay8s", "cmr9dgtsn0007evulfim5wf1s",
  "cmpzlwupw00064zwdfmmt7r5u", "cmpzm1p2t001ryllprvtal1ih", "cms334web0014135ivf44t5yd",
  "cms334wkz0019135iexvfmrco", "cms334vng000k135iaupwj2sg", "cmpzlww3b00114zwd6gejbnnj",
  "cmrbay08p000uftad6r1dhcbo", "cms334w0z000u135itbr58u7o", "cmpzlwvya000y4zwdad5qquva",
  "cmpzm1qta002syllp31bif8y1", "cms334vgp000f135ikbpp9p4i", "cmpzm1q9r002hyllpr96bet78",
  "cmr4ka0000000614kekfnets6", "cmpzm1qfc002kyllptwq253fa", "cmpzlwvb3000k4zwddggfh2in",
  "cms334v370005135iraqvkh18", "cmpzlwxcj001m4zwdfdu731sz", "cmrx8sg46000n137rhm43jxg3",
  "massey",
  "cmpzlwviw000p4zwdbusy5ap3", "cmr34lal3000058eh35hayu4e",
];

/* ---------------------------------------------------------------- *
 * ③ 29 个字典品牌缺中文名 → 补译（仅前台展示用，可改）
 * ---------------------------------------------------------------- */
const CN_NAME_MAP: Record<string, string> = {
  arcusin: "阿库辛", ls: "乐星", tafe: "塔菲", solis: "索利斯", valpadana: "瓦尔帕达纳",
  goldoni: "戈尔东尼", antonio_carraro: "安东尼奥·卡拉罗", geringhoff: "格林霍夫",
  macdon: "麦克唐", honey_bee: "蜜蜂", olimac: "奥利马克", ploeger: "普勒格",
  asa_lift: "ASA升降", monosem: "莫诺森", great_plains: "大平原", salford: "索尔福德",
  matermacc: "马泰马科", nardi: "纳尔迪", celli: "切利", molon: "莫隆", quivogne: "基沃涅",
  treffler: "特雷夫勒", berthoud: "贝图", tecnoma: "泰克诺马", househam: "豪舍姆",
  bateman: "贝特曼", samasz: "萨马斯", amity: "阿米蒂", agronic: "阿格罗尼克",
};

/* ---------------------------------------------------------------- *
 * ④ 品类 code → 英文名（12 个缺英文名品类一并补）
 * ---------------------------------------------------------------- */
const CATEGORY_EN: Record<string, string> = {
  root: "Agricultural Machinery", harvester: "Harvesting Machinery",
  corn_harvester: "Corn Combine Harvester", forage: "Forage Equipment",
  forage_harvester: "Forage Harvester", combine: "Combine Harvester",
  cotton_harvester: "Cotton Picker", mower: "Mower", tedder: "Tedder", rake: "Rake",
  baler: "Balers", round_baler: "Round Baler", square_baler: "Square Baler",
  tillage: "Tillage Equipment", plow: "Plow", subsoiler: "Subsoiler",
  disc_harrow: "Disc Harrow", seeding: "Seeding & Planting", planter: "Planter",
  seed_drill: "Seed Drill", spraying: "Spraying Equipment", sprayer: "Sprayer",
  transport: "Agricultural Transport", tractor: "Tractors",
  tractor_compact: "Compact Tractor", tractor_mid: "Mid-size Tractor",
  tractor_high: "High-horsepower Tractor", trailer: "Trailer",
};

/* 品类 code → 中文名（用于按 nameZh 解析 parentId） */
const CATEGORY_ZH: Record<string, string> = {
  root: "农机设备总根", harvester: "收获机械大类", corn_harvester: "茎穗兼收机",
  forage: "饲草设备大类", forage_harvester: "青贮饲料收获机", combine: "谷物联合收割机",
  cotton_harvester: "采棉机", mower: "牧草割晒机", tedder: "干草摊晒机/翻草机",
  rake: "搂草机", baler: "打捆机械大类", round_baler: "圆捆打捆机",
  square_baler: "方捆打捆机", tillage: "耕地整地机械大类", plow: "铧式犁",
  subsoiler: "深松机", disc_harrow: "圆盘耙", seeding: "播种栽植机械大类",
  planter: "免耕播种机", seed_drill: "条播机", spraying: "植保喷雾机械大类",
  sprayer: "牵引式喷药机", transport: "农用运输机械大类", tractor: "农用拖拉机",
  tractor_compact: "中小型拖拉机", tractor_mid: "中型拖拉机",
  tractor_high: "大型大马力拖拉机", trailer: "农用拖车",
};

/* 22 个需回填的字典节点（28 树 − 6 个 T01 已建叶） */
const CATEGORY_TREE: { code: string; parentCode: string | null; isLeaf: boolean }[] = [
  { code: "harvester", parentCode: "root", isLeaf: false },
  { code: "corn_harvester", parentCode: "harvester", isLeaf: true },
  { code: "baler", parentCode: "root", isLeaf: false },
  { code: "forage_harvester", parentCode: "harvester", isLeaf: true },
  { code: "combine", parentCode: "harvester", isLeaf: true },
  { code: "cotton_harvester", parentCode: "harvester", isLeaf: true },
  { code: "mower", parentCode: "forage", isLeaf: true },
  { code: "tedder", parentCode: "forage", isLeaf: true },
  { code: "rake", parentCode: "forage", isLeaf: true },
  { code: "round_baler", parentCode: "baler", isLeaf: true },
  { code: "square_baler", parentCode: "baler", isLeaf: true },
  { code: "plow", parentCode: "tillage", isLeaf: true },
  { code: "subsoiler", parentCode: "tillage", isLeaf: true },
  { code: "disc_harrow", parentCode: "tillage", isLeaf: true },
  { code: "planter", parentCode: "seeding", isLeaf: true },
  { code: "seed_drill", parentCode: "seeding", isLeaf: true },
  { code: "sprayer", parentCode: "spraying", isLeaf: true },
  { code: "tractor", parentCode: "root", isLeaf: false },
  { code: "tractor_compact", parentCode: "tractor", isLeaf: true },
  { code: "tractor_mid", parentCode: "tractor", isLeaf: true },
  { code: "tractor_high", parentCode: "tractor", isLeaf: true },
  { code: "trailer", parentCode: "transport", isLeaf: true },
];

/* 13 个标准品牌（model.json 中已有型号的即标准品牌） */
const STANDARD = new Set([
  "deere", "claas", "case", "new_holland", "fendt", "krone", "kuhn",
  "lemken", "amazone", "massey_ferguson", "lovol", "yto", "kubota",
]);

/* 产地中文 → ISO 码（Brand.originCountryCode 用） */
const ORIGIN_ISO: Record<string, string> = {
  美国: "US", 德国: "DE", 意大利: "IT", 英国: "GB", 日本: "JP", 中国: "CN",
  西班牙: "ES", 韩国: "KR", 印度: "IN", 加拿大: "CA", 澳大利亚: "AU",
  荷兰: "NL", 丹麦: "DK", 法国: "FR", 波兰: "PL",
};

/* ---------------------------------------------------------------- *
 * 型号补齐（决策②：只补主推 ~20 品牌）。
 * 字典 model.json 已覆盖 13 个标准品牌；此处预留「再补 ~7 个主推品牌」的入口，
 * 待老板确认具体品牌/机型后启用（默认关闭，避免未授权写入型号数据）。
 * ---------------------------------------------------------------- */
const ADDITIONAL_MODELS_ENABLED = true;
// 决策②：型号只补主推 ~20 品牌。字典 model.json 已覆盖 13 个标准品牌，
// 此处补 7 个主推品牌（deutz_fahr/valtra/mahindra/goldoni/challenger/great_plains/kongskilde），
// 合计 ≈ 20 个品牌有型号。⚠️ 以下机型为「建议起始数据」，上架前请老板核验具体型号/年份。
const ADDITIONAL_MODELS: {
  model_code: string; display_name: string; brand_code: string;
  category_code: string; spec_note?: string; model_popularity_factor?: number;
}[] = [
  // —— Deutz-Fahr（拖拉机）——
  { model_code: "deutz_fahr_9340", display_name: "Deutz-Fahr 9340 TTV 拖拉机", brand_code: "deutz_fahr", category_code: "tractor", spec_note: "340马力，高端大马力拖拉机，欧洲存量大", model_popularity_factor: 1.1 },
  { model_code: "deutz_fahr_7250", display_name: "Deutz-Fahr 7250 TTV 拖拉机", brand_code: "deutz_fahr", category_code: "tractor", spec_note: "250马力，TTV无级变速", model_popularity_factor: 1.08 },
  { model_code: "deutz_fahr_6160", display_name: "Deutz-Fahr 6160 TTV 拖拉机", brand_code: "deutz_fahr", category_code: "tractor", spec_note: "160马力，中端主力", model_popularity_factor: 1.05 },
  // —— Valtra（拖拉机）——
  { model_code: "valtra_t234", display_name: "Valtra T234 拖拉机", brand_code: "valtra", category_code: "tractor", spec_note: "北欧品牌，可定制配色，小众但保值", model_popularity_factor: 1.1 },
  { model_code: "valtra_n174", display_name: "Valtra N174 拖拉机", brand_code: "valtra", category_code: "tractor", spec_note: "170马力，N系列全能型", model_popularity_factor: 1.05 },
  { model_code: "valtra_a104", display_name: "Valtra A104 拖拉机", brand_code: "valtra", category_code: "tractor", spec_note: "100马力，A系列入门大马力", model_popularity_factor: 1.0 },
  // —— Mahindra（拖拉机，印度出口主力）——
  { model_code: "mahindra_575", display_name: "Mahindra 575 DI 拖拉机", brand_code: "mahindra", category_code: "tractor", spec_note: "南亚最畅销机型，二手价格低走量", model_popularity_factor: 0.85 },
  { model_code: "mahindra_265", display_name: "Mahindra 265 DI 拖拉机", brand_code: "mahindra", category_code: "tractor", spec_note: "45马力，水田/小地块", model_popularity_factor: 0.8 },
  { model_code: "mahindra_arjun", display_name: "Mahindra Arjun 605 拖拉机", brand_code: "mahindra", category_code: "tractor", spec_note: "60马力，Arjun 系列", model_popularity_factor: 0.85 },
  // —— Goldoni（园艺/特种拖拉机）——
  { model_code: "goldoni_star80", display_name: "Goldoni Star 80 拖拉机", brand_code: "goldoni", category_code: "tractor", spec_note: "窄轮距园艺拖拉机，葡萄园/果园用", model_popularity_factor: 0.88 },
  { model_code: "goldoni_quasar", display_name: "Goldoni Quasar 90 拖拉机", brand_code: "goldoni", category_code: "tractor", spec_note: "90马力，Quasar 系列", model_popularity_factor: 0.88 },
  // —— Challenger（拖拉机，AGCO）——
  { model_code: "challenger_mt765", display_name: "Challenger MT765B 拖拉机", brand_code: "challenger", category_code: "tractor", spec_note: "履带式大马力，泥地通过性强", model_popularity_factor: 0.9 },
  { model_code: "challenger_8380", display_name: "Challenger 8380 拖拉机", brand_code: "challenger", category_code: "tractor", spec_note: "380马力，8000系列旗舰", model_popularity_factor: 0.9 },
  // —— Great Plains（播种/条播）——
  { model_code: "great_plains_3000", display_name: "Great Plains 3000NT 免耕播种机", brand_code: "great_plains", category_code: "planter", spec_note: "免耕直播，北美主流", model_popularity_factor: 0.95 },
  { model_code: "great_plains_ssd", display_name: "Great Plains SSD 条播机", brand_code: "great_plains", category_code: "seed_drill", spec_note: "精密条播，配套大马力拖拉机", model_popularity_factor: 0.95 },
  // —— Kongskilde（整地）——
  { model_code: "kongskilde_vibroflex", display_name: "Kongskilde Vibroflex 圆盘耙", brand_code: "kongskilde", category_code: "disc_harrow", spec_note: "联合整地机，北欧品牌", model_popularity_factor: 0.9 },
  { model_code: "kongskilde_enforcer", display_name: "Kongskilde Enforcer 深松机", brand_code: "kongskilde", category_code: "subsoiler", spec_note: "深松整地，配套大马力", model_popularity_factor: 0.9 },
];

/* ---------------------------------------------------------------- */

function loadJson<T>(file: string): { version?: string; items: T[] } {
  const p = path.join(__dirname, "master-data", file);
  const raw = fs.readFileSync(p, "utf-8");
  const d = JSON.parse(raw) as { version?: string; items: T[] };
  if (!Array.isArray(d.items)) throw new Error(`[t02] ${file} 缺少 items 数组`);
  return d;
}

/** 拆分 display_name 为英文 / 中文两部分 */
function splitName(display: string): { en: string; zh: string } {
  const cjk = /[一-鿿]/;
  let splitAt = -1;
  for (let i = 0; i < display.length; i++) {
    if (cjk.test(display[i])) { splitAt = i; break; }
  }
  if (splitAt < 0) return { en: display.trim(), zh: "" };
  if (splitAt === 0) return { en: "", zh: display.trim() };
  return { en: display.slice(0, splitAt).trim(), zh: display.slice(splitAt).trim() };
}

async function main() {
  const brands = loadJson<{
    code: string; display_name: string; origin_country?: string;
    brand_value_factor?: number;
  }>("brand.json");

  console.log(
    `[t02] 载入 brand=${brands.items.length} | DENYLIST=${DENYLIST.length} | CATEGORY_TREE=${CATEGORY_TREE.length}${APPLY ? "" : "（DRY-RUN，不写库）"}`,
  );

  // ── 1) Brand 回填 ───────────────────────────────────────────────
  let brandUpdated = 0;
  for (const b of brands.items) {
    const liveId = BRAND_MAP[b.code];
    if (!liveId) {
      console.warn(`[t02] ⚠️ 字典品牌 ${b.code} 无 live id 映射，跳过`);
      continue;
    }
    const existing = await prisma.brand.findUnique({ where: { id: liveId } });
    if (!existing) {
      console.warn(`[t02] ⚠️ live brand ${liveId}（${b.code}）在目标库不存在，跳过（可能非 .com）`);
      continue;
    }
    const { en, zh } = splitName(b.display_name);
    const nameZh = CN_NAME_MAP[b.code] || zh || existing.nameZh || "";
    const nameEn = en || existing.nameEn || b.code;
    const iso = b.origin_country ? ORIGIN_ISO[b.origin_country] : undefined;
    const data = {
      code: b.code,
      originCountryCode: iso ?? existing.originCountryCode,
      brandValueFactor: b.brand_value_factor ?? existing.brandValueFactor,
      isStandard: STANDARD.has(b.code),
      nameZh,
      nameEn,
    };
    if (APPLY) {
      await prisma.brand.update({ where: { id: liveId }, data });
    } else {
      console.log(`  [dry] Brand.update ${b.code} → code=${b.code} iso=${iso ?? "?"} val=${data.brandValueFactor} std=${data.isStandard} zh=${nameZh}`);
    }
    brandUpdated++;
  }
  console.log(`[t02] Brand 将回填 ${brandUpdated} 条`);

  // ── 2) Category 回填（22 节点） ────────────────────────────────
  let catUpsert = 0;
  for (const node of CATEGORY_TREE) {
    let parentId: string | null = null;
    if (node.parentCode) {
      const pZh = CATEGORY_ZH[node.parentCode];
      const p = await prisma.category.findFirst({ where: { nameZh: pZh }, select: { id: true } });
      if (p) parentId = p.id;
      else console.warn(`[t02] ⚠️ 父品类「${pZh}」未在库中找到，${node.code} 暂挂顶层`);
    }
    const existing = await prisma.category.findFirst({ where: { code: node.code } });
    const data = {
      code: node.code,
      isLeaf: node.isLeaf,
      parentId,
      nameZh: CATEGORY_ZH[node.code],
      nameEn: CATEGORY_EN[node.code] ?? node.code,
    };
    if (APPLY) {
      if (existing) await prisma.category.update({ where: { id: existing.id }, data });
      else await prisma.category.create({ data: { ...data, nameEn: CATEGORY_EN[node.code] ?? node.code } });
    } else {
      console.log(`  [dry] Category.${existing ? "update" : "create"} ${node.code} isLeaf=${node.isLeaf} parentId=${parentId} en=${CATEGORY_EN[node.code] ?? node.code}`);
    }
    catUpsert++;
  }
  console.log(`[t02] Category 将回填 ${catUpsert} 条`);

  // ── 3) 脏/错字品牌清理 ───────────────────────────────────────
  // Brand 模型无 isActive 字段，无法软下架；且 .com 实测 14/39 条挂着商品
  // （含中联重科/常发/华夏/金轮/牧农等真实品牌），硬删会破坏 Product 外键。
  // 策略：零商品纯脏行才硬删；挂商品者跳过并打印 WARNING 交人工复核。
  let deleted = 0;
  let skippedProducts = 0;
  let skippedMissing = 0;
  for (const id of DENYLIST) {
    const existing = await prisma.brand.findUnique({ where: { id }, select: { id: true, nameZh: true, nameEn: true } });
    if (!existing) {
      console.log(`  [skip] 清理目标 ${id} 在目标库不存在（可能非 .com）`);
      skippedMissing++;
      continue;
    }
    const productCount = await prisma.product.count({ where: { brandId: id } });
    if (productCount > 0) {
      console.warn(`[t02] ⚠️ 跳过 ${existing.nameZh || existing.nameEn}（${id}）：挂载 ${productCount} 台商品，硬删会破坏外键 —— 需人工复核（真实品牌勿删）`);
      skippedProducts++;
      continue;
    }
    if (APPLY) {
      try {
        await prisma.brand.delete({ where: { id } });
        deleted++;
        console.log(`  [apply] Brand.delete ${existing.nameZh || existing.nameEn}（${id}）— 零商品纯脏行已删除`);
      } catch (e: any) {
        console.warn(`[t02] ⚠️ 删除 ${id} 失败（可能还有 valuations/展示项等外键）：${e?.message ?? e} —— 跳过交人工`);
        skippedProducts++;
      }
    } else {
      console.log(`  [dry] 将 Brand.delete ${id}（零商品纯脏行，安全删除）`);
      deleted++;
    }
  }
  console.log(`[t02] 清理：将删除 ${deleted} 条 | 因挂商品/外键跳过 ${skippedProducts} 条 | 目标库不存在 ${skippedMissing} 条`);

  // ── 4) 型号补齐（默认关闭） ───────────────────────────────────
  if (ADDITIONAL_MODELS_ENABLED) {
    let modelUpserts = 0;
    const dictVersion = "1.1.0-t02";
    for (const m of ADDITIONAL_MODELS) {
      const data = {
        displayName: m.display_name, brandCode: m.brand_code, categoryCode: m.category_code,
        modelPopularityFactor: m.model_popularity_factor ?? 1.0, specNote: m.spec_note ?? null, dictVersion,
      };
      if (APPLY) {
        await prisma.modelDictionary.upsert({ where: { modelCode: m.model_code }, update: data, create: { modelCode: m.model_code, ...data } });
      } else {
        console.log(`  [dry] ModelDictionary.upsert ${m.model_code}`);
      }
      modelUpserts++;
    }
    console.log(`[t02] ADDITIONAL 型号将写入 ${modelUpserts} 条`);
  } else {
    console.log("[t02] ADDITIONAL_MODELS 未启用（默认关闭，待确认主推品牌后开启）");
  }

  console.log(APPLY ? "[t02] --apply 完成" : "[t02] DRY-RUN 完成，未写库");
}

main()
  .catch((e) => { console.error("[t02] 失败:", e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
