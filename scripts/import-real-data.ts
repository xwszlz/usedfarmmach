/**
 * 导入真实库存数据到网站
 * 数据源：出口农机库存表.xlsx + 出口农机/ 图片文件夹
 * 
 * 执行：tsx scripts/import-real-data.ts
 * 前置：npm run db:seed 已执行
 */
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

const IMAGE_BASE = "D:/神雕农机/出口农机";
const PUBLIC_UPLOADS = "D:/神雕农机/usedfarmmach/public/uploads/products";

interface InventoryRow {
  序号: number;
  档案号: string | null;
  类型: string | null;
  进口国产: string | null;
  品牌: string | null;
  机型: string | null;
  年限: number | null;
  描述: string | null;
  报价: number | null;
  备注: string | null;
  重要程度: number | null;
  国内数量: number | null;
}

// 品牌映射：中文 → {id, nameZh, nameEn, originCountry, isImported}
const BRAND_MAP: Record<string, { id: string; nameZh: string; nameEn: string; originCountry: string; isImported: boolean }> = {
  "克拉斯":    { id: "claas",          nameZh: "克拉斯",  nameEn: "CLAAS",             originCountry: "DE", isImported: true },
  "克罗尼":    { id: "krone",          nameZh: "克罗尼",  nameEn: "Krone",             originCountry: "DE", isImported: true },
  "纽荷兰":    { id: "new-holland",     nameZh: "纽荷兰",  nameEn: "New Holland",       originCountry: "US", isImported: true },
  "迪尔":      { id: "john-deere",     nameZh: "约翰迪尔", nameEn: "John Deere",       originCountry: "US", isImported: true },
  "凯斯":      { id: "case-ih",        nameZh: "凯斯",    nameEn: "Case IH",           originCountry: "US", isImported: true },
  "库恩":      { id: "kuhn",           nameZh: "库恩",    nameEn: "Kuhn",              originCountry: "FR", isImported: true },
  "格兰":      { id: "grain",          nameZh: "格兰",    nameEn: "Grain",             originCountry: "NO", isImported: true },
  "奥库":      { id: "orke",           nameZh: "奥库",    nameEn: "Orkel",             originCountry: "NO", isImported: true },
  "格立莫":    { id: "grimme",         nameZh: "格立莫",  nameEn: "Grimme",            originCountry: "DE", isImported: true },
  "康斯凯尔":  { id: "kongskilde",     nameZh: "康斯凯尔", nameEn: "Kongskilde",       originCountry: "DK", isImported: true },
  "Kongskilde\n康斯凯尔": { id: "kongskilde", nameZh: "康斯凯尔", nameEn: "Kongskilde", originCountry: "DK", isImported: true },
  "都麦":      { id: "dormoy",         nameZh: "都麦",    nameEn: "Dormoy",            originCountry: "FR", isImported: true },
  "arcusln":   { id: "arcusin",        nameZh: "Arcusin", nameEn: "Arcusin",           originCountry: "FR", isImported: true },
  "爱科\n麦赛弗格森": { id: "massey-ferguson", nameZh: "麦赛弗格森", nameEn: "Massey Ferguson", originCountry: "US", isImported: true },
  "东洋":      { id: "toyo",           nameZh: "东洋",    nameEn: "Toyo",              originCountry: "JP", isImported: true },
  "马赛":      { id: "massey",         nameZh: "马赛",    nameEn: "Massey",            originCountry: "FR", isImported: true },
  "牧神":      { id: "mushen",         nameZh: "牧神",    nameEn: "Mushen",            originCountry: "CN", isImported: false },
  "东方红":    { id: "dongfanghong",   nameZh: "东方红",  nameEn: "Dongfanghong",      originCountry: "CN", isImported: false },
  "盈嘉":      { id: "yingjia",        nameZh: "盈嘉",    nameEn: "Yingjia",           originCountry: "CN", isImported: false },
  "德翔":      { id: "dexiang",        nameZh: "德翔",    nameEn: "Dexiang",           originCountry: "CN", isImported: false },
  "法兰信":    { id: "falaixin",       nameZh: "法兰信",  nameEn: "Falaxin",           originCountry: "CN", isImported: false },
  "迈科农机":  { id: "maike",          nameZh: "迈科农机", nameEn: "Maike",            originCountry: "CN", isImported: false },
  "芬特":      { id: "fendt",          nameZh: "芬特",    nameEn: "Fendt",             originCountry: "DE", isImported: true },
};

// 品类映射
const CATEGORY_MAP: Record<string, { id: string; nameZh: string; nameEn: string }> = {
  "青储机":           { id: "forage-harvester", nameZh: "青储机", nameEn: "Forage Harvester" },
  "打捆机":           { id: "baler",           nameZh: "打捆机", nameEn: "Baler" },
  "圆捆打捆机":       { id: "baler",           nameZh: "打捆机", nameEn: "Baler" },
  "圆捆打包缠膜机":  { id: "baler",           nameZh: "打捆机", nameEn: "Baler" },
  "圆捆机（铝滚式）": { id: "baler",           nameZh: "打捆机", nameEn: "Baler" },
  "圆捆机（皮带）":   { id: "baler",           nameZh: "打捆机", nameEn: "Baler" },
  "拖拉机":           { id: "tractor",         nameZh: "拖拉机", nameEn: "Tractor" },
  "割草机":           { id: "mower",           nameZh: "割草机", nameEn: "Mower" },
  "裹包机":           { id: "wrapper",         nameZh: "裹包机", nameEn: "Bale Wrapper" },
  "割台-直收":        { id: "header",          nameZh: "割台",   nameEn: "Header" },
  "捡拾台":           { id: "pickup",          nameZh: "捡拾台", nameEn: "Pickup Header" },
  "捡石机":           { id: "stone-picker",    nameZh: "捡石机", nameEn: "Stone Picker" },
  "码垛机":           { id: "stacker",         nameZh: "码垛机", nameEn: "Stacker" },
  "搂草机":           { id: "rake",            nameZh: "搂草机", nameEn: "Rake" },
  "茎穗双收":         { id: "corn-harvester",  nameZh: "茎穗兼收机", nameEn: "Stalk & Ear Harvester" },
  "精播机（气吸）":   { id: "planter",         nameZh: "播种机", nameEn: "Planter" },
  "条播机（气吹式）": { id: "planter",         nameZh: "播种机", nameEn: "Planter" },
  "伸缩臂夹包机":     { id: "telehandler",     nameZh: "伸缩臂夹包机", nameEn: "Telehandler" },
  "胡萝卜\n采收机":   { id: "harvester",       nameZh: "收获机", nameEn: "Harvester" },
};

// 产品数据（手动精选 + 从库存表提取的推荐产品）
const PRODUCTS: {
  folderName: string;
  brandKey: string;
  categoryId: string;
  modelName: string;
  year: number;
  workingHours: number | null;
  condition: string;
  priceCny: number;
  priceUsd: number | null;
  location: string;
  descZh: string;
  descEn: string;
  isFeatured: boolean;
}[] = [
  // ===== 青储机（核心品类）=====
  {
    folderName: "24年克拉斯860",
    brandKey: "克拉斯", categoryId: "forage-harvester",
    modelName: "860", year: 2024, workingHours: null,
    condition: "excellent", priceCny: 0, priceUsd: null,
    location: "河北",
    descZh: "克拉斯860青储机，2024年新款，CLAAS旗舰青储机型",
    descEn: "CLAAS 860 forage harvester, 2024 model, flagship forage harvester",
    isFeatured: true,
  },
  {
    folderName: "21年克拉斯970",
    brandKey: "克拉斯", categoryId: "forage-harvester",
    modelName: "970", year: 2021, workingHours: 2965,
    condition: "good", priceCny: 1630000, priceUsd: 225000,
    location: "河北",
    descZh: "克拉斯970欧版青储机，2017年出厂，四驱775马力，奥贝斯750割台7.5米，24刀片不烧尿素，单发曼恩V8发动机，揉丝辊",
    descEn: "CLAAS 970 EU spec forage harvester, 2017, 4WD 775HP, Orbis 750 header 7.5m, 24 knives no DEF, MAN V8 engine, corn cracker",
    isFeatured: true,
  },
  {
    folderName: "18年的克拉斯850青储机",
    brandKey: "克拉斯", categoryId: "forage-harvester",
    modelName: "850", year: 2018, workingHours: 2896,
    condition: "good", priceCny: 880000, priceUsd: 121000,
    location: "河北",
    descZh: "克拉斯850青储机2018年，二驱轧辊2896小时，发动机3746小时，428马力，自动对刀，中央润滑，金属探测，冠军445割台4.5米，柔丝辊，不烧尿素，20刀片，奔驰6缸发动机",
    descEn: "CLAAS 850 forage harvester 2018, 2WD, roller 2896h, engine 3746h, 428HP, auto-sharpen, central lube, metal detection, Champion 445 header 4.5m, corn cracker, no DEF, 20 knives, Mercedes 6-cyl",
    isFeatured: true,
  },
  {
    folderName: "2016克拉斯 980",
    brandKey: "克拉斯", categoryId: "forage-harvester",
    modelName: "980", year: 2016, workingHours: 3679,
    condition: "good", priceCny: 1430000, priceUsd: 197000,
    location: "河北",
    descZh: "克拉斯980美版青储机2016年，二驱884马力，单发曼恩V12发动机，轧辊3679小时，发动机5013小时，奥贝斯割台600 6米宽，24刀片不烧尿素",
    descEn: "CLAAS 980 US spec forage harvester 2016, 2WD 884HP, MAN V12 engine, roller 3679h, engine 5013h, Orbis 600 header 6m, 24 knives no DEF",
    isFeatured: true,
  },
  {
    folderName: "2015克拉斯青储机980",
    brandKey: "克拉斯", categoryId: "forage-harvester",
    modelName: "980", year: 2015, workingHours: 3574,
    condition: "good", priceCny: 1300000, priceUsd: 179000,
    location: "河北",
    descZh: "克拉斯980青储机2015年，二驱，冠军割台445 4.5米，轧辊3574小时，发动机4864小时，510马力",
    descEn: "CLAAS 980 forage harvester 2015, 2WD, Champion 445 header 4.5m, roller 3574h, engine 4864h, 510HP",
    isFeatured: false,
  },
  {
    folderName: "2003年克拉斯900",
    brandKey: "克拉斯", categoryId: "forage-harvester",
    modelName: "900", year: 2003, workingHours: 4230,
    condition: "fair", priceCny: 290000, priceUsd: 40000,
    location: "河北",
    descZh: "克拉斯900青储机2003年，四驱605马力，奔驰V8发动机，冠军割台360 6米宽，柔丝辊，轧辊4230小时，发动机5849小时",
    descEn: "CLAAS 900 forage harvester 2003, 4WD 605HP, Mercedes V8, Champion 360 header 6m, corn cracker, roller 4230h, engine 5849h",
    isFeatured: false,
  },
  {
    folderName: "克拉斯    695",
    brandKey: "克拉斯", categoryId: "forage-harvester",
    modelName: "695", year: 1995, workingHours: null,
    condition: "fair", priceCny: 80000, priceUsd: 11000,
    location: "河北",
    descZh: "克拉斯695青储机，420马力，金属探测，籽粒破碎自动磨刀，仅主机（割台已售）",
    descEn: "CLAAS 695 forage harvester, 420HP, metal detection, auto-sharpen corn cracker, base unit only (header sold)",
    isFeatured: false,
  },
  {
    folderName: "2013迪尔青储机7250",
    brandKey: "迪尔", categoryId: "forage-harvester",
    modelName: "7250", year: 2013, workingHours: 4405,
    condition: "fair", priceCny: 0, priceUsd: null,
    location: "新疆石河子",
    descZh: "约翰迪尔7250青储机2013年，扎辊4405小时，380马力两驱，发动机5744小时，冠军445割台4.5米，普通辊籽粒破碎，迪尔六缸发动机",
    descEn: "John Deere 7250 forage harvester 2013, roller 4405h, 380HP 2WD, engine 5744h, Champion 445 header 4.5m, standard cracker, JD 6-cyl engine",
    isFeatured: true,
  },
  {
    folderName: "2009纽荷兰青储机9080",
    brandKey: "纽荷兰", categoryId: "forage-harvester",
    modelName: "9080", year: 2009, workingHours: null,
    condition: "good", priceCny: 690000, priceUsd: 95000,
    location: "河北",
    descZh: "纽荷兰9080青储机2009年，28片刀，740马力卡特发动机，四驱25km/h，中央润滑系统，金属探测，可收割柠条",
    descEn: "New Holland 9080 forage harvester 2009, 28 knives, 740HP Caterpillar engine, 4WD 25km/h, central lube, metal detection, capable of harvesting caragana",
    isFeatured: true,
  },
  {
    folderName: "2014纽荷兰青储机FR500（9040）",
    brandKey: "纽荷兰", categoryId: "forage-harvester",
    modelName: "FR500", year: 2014, workingHours: 4056,
    condition: "good", priceCny: 380000, priceUsd: 52000,
    location: "河北",
    descZh: "纽荷兰FR500青储机2014年，500马力二驱，轧辊4056小时，发动机5783小时，冠军割台445 4.5米，柔丝辊，菲亚特发动机，24片刀",
    descEn: "New Holland FR500 forage harvester 2014, 500HP 2WD, roller 4056h, engine 5783h, Champion 445 header 4.5m, corn cracker, Fiat engine, 24 knives",
    isFeatured: true,
  },
  {
    folderName: "18克罗尼600",
    brandKey: "克罗尼", categoryId: "forage-harvester",
    modelName: "600", year: 2018, workingHours: null,
    condition: "good", priceCny: 0, priceUsd: null,
    location: "河北",
    descZh: "克罗尼600青储机2018年，曼恩V8发动机775马力",
    descEn: "Krone 600 forage harvester 2018, MAN V8 engine 775HP",
    isFeatured: false,
  },
  {
    folderName: "克罗尼青储机700",
    brandKey: "克罗尼", categoryId: "forage-harvester",
    modelName: "700", year: 2020, workingHours: null,
    condition: "good", priceCny: 0, priceUsd: null,
    location: "河北",
    descZh: "克罗尼700青储机",
    descEn: "Krone 700 forage harvester",
    isFeatured: false,
  },
  {
    folderName: "2016芬特青储机",
    brandKey: "芬特", categoryId: "forage-harvester",
    modelName: "Katana 65", year: 2016, workingHours: null,
    condition: "good", priceCny: 0, priceUsd: null,
    location: "河北",
    descZh: "芬特Katana 65青储机2016年，德国制造高端青储机",
    descEn: "Fendt Katana 65 forage harvester 2016, premium German-made forage harvester",
    isFeatured: false,
  },
  {
    folderName: "克拉斯950",
    brandKey: "克拉斯", categoryId: "forage-harvester",
    modelName: "950", year: 2015, workingHours: null,
    condition: "good", priceCny: 0, priceUsd: null,
    location: "河北",
    descZh: "克拉斯950青储机",
    descEn: "CLAAS 950 forage harvester",
    isFeatured: false,
  },
  // ===== 打捆机 =====
  {
    folderName: "2022克拉斯打捆机5300RC大方捆",
    brandKey: "克拉斯", categoryId: "baler",
    modelName: "5300RC", year: 2022, workingHours: null,
    condition: "excellent", priceCny: 950000, priceUsd: 131000,
    location: "河北",
    descZh: "克拉斯5300RC大方捆打捆机2022年全新，打包尺寸120×90cm，双桥6个打结器6道绳，带售后服务一年质保，进口拖拉机2404/2504可带",
    descEn: "CLAAS 5300RC large square baler 2022, brand new, bale size 120×90cm, tandem axle 6 knotters 6 ropes, 1-year warranty, requires 240/250HP tractor",
    isFeatured: true,
  },
  {
    folderName: "2020年克拉斯5300",
    brandKey: "克拉斯", categoryId: "baler",
    modelName: "5300RC", year: 2020, workingHours: null,
    condition: "good", priceCny: 180000, priceUsd: 25000,
    location: "河北",
    descZh: "克拉斯5300大方捆打捆机2020年，29617包双桥",
    descEn: "CLAAS 5300 large square baler 2020, 29617 bales tandem axle",
    isFeatured: true,
  },
  {
    folderName: "2014年克罗尼1290",
    brandKey: "克罗尼", categoryId: "baler",
    modelName: "1290XC", year: 2014, workingHours: null,
    condition: "good", priceCny: 138000, priceUsd: 19000,
    location: "河北",
    descZh: "克罗尼1290XC大方捆打捆机2014年，128794包，随车赠送2万多配件",
    descEn: "Krone 1290XC large square baler 2014, 128794 bales, includes accessories worth 20K+ RMB",
    isFeatured: false,
  },
  {
    folderName: "14年克罗尼 cf155xc圆捆打包缠膜机",
    brandKey: "克罗尼", categoryId: "baler",
    modelName: "CF155XC", year: 2014, workingHours: null,
    condition: "good", priceCny: 150000, priceUsd: 21000,
    location: "河北",
    descZh: "克罗尼CF155XC圆捆打包缠膜一体机2014年，草捆重量50-130kg",
    descEn: "Krone CF155XC round baler-wrapper 2014, bale weight 50-130kg",
    isFeatured: false,
  },
  {
    folderName: "2025盈嘉圆捆打捆机",
    brandKey: "盈嘉", categoryId: "baler",
    modelName: "9YG-1.25", year: 2025, workingHours: null,
    condition: "excellent", priceCny: 96000, priceUsd: null,
    location: "河北",
    descZh: "盈嘉9YG-1.25圆捆打捆机2025年全新，捡拾宽度2.24米，草捆直径1.3米宽1.25米，每小时40-100捆，配套动力75-120kw",
    descEn: "Yingjia 9YG-1.25 round baler 2025, pickup width 2.24m, bale diameter 1.3m width 1.25m, 40-100 bales/hour, 75-120kw required",
    isFeatured: false,
  },
  // ===== 裹包机 =====
  {
    folderName: "2019奥库DENS-X裹包机",
    brandKey: "奥库", categoryId: "wrapper",
    modelName: "DENS-X", year: 2019, workingHours: null,
    condition: "good", priceCny: 1050000, priceUsd: 145000,
    location: "河北",
    descZh: "奥库DENS-X裹包机2019年，裹包3万包吨包，尺寸1.15×1.2",
    descEn: "Orkel DENS-X bale wrapper 2019, 30K bales, tonnage bale size 1.15×1.2",
    isFeatured: true,
  },
  // ===== 割草机 =====
  {
    folderName: "凯斯割草机",
    brandKey: "凯斯", categoryId: "mower",
    modelName: "Disc Mower", year: 2007, workingHours: 3670,
    condition: "fair", priceCny: 490000, priceUsd: 68000,
    location: "河北",
    descZh: "凯斯割草机，3折40迈，3670小时",
    descEn: "Case IH disc mower, 3-fold 40mph, 3670 hours",
    isFeatured: false,
  },
  // ===== 捡拾台 =====
  {
    folderName: "2017年Kongskilde 康斯捡拾机",
    brandKey: "康斯凯尔", categoryId: "stone-picker",
    modelName: "Stone Picker", year: 2017, workingHours: null,
    condition: "good", priceCny: 260000, priceUsd: 36000,
    location: "河北",
    descZh: "康斯凯尔捡石机2017年，捡拾5-40公分石头，展开4.5-5米，1204拖拉机可带",
    descEn: "Kongskilde stone picker 2017, picks 5-40cm stones, working width 4.5-5m, 120HP tractor compatible",
    isFeatured: false,
  },
  // ===== 搂草机 =====
  {
    folderName: "迈科农机搂草机",
    brandKey: "迈科农机", categoryId: "rake",
    modelName: "9GL-950", year: 2024, workingHours: null,
    condition: "excellent", priceCny: 0, priceUsd: null,
    location: "河北",
    descZh: "迈科农机9GL-950滚筒式搂草机，90马力以上，9.5米宽",
    descEn: "Maike 9GL-950 rotary rake, 90HP+, 9.5m width",
    isFeatured: false,
  },
  // ===== 茎穗双收 =====
  {
    folderName: "2022全新牧神双收",
    brandKey: "牧神", categoryId: "corn-harvester",
    modelName: "4YZB-4E", year: 2022, workingHours: 297,
    condition: "excellent", priceCny: 115000, priceUsd: null,
    location: "河北",
    descZh: "牧神4YZB-4E茎穗兼收机2022年，玉柴发动机，二驱260马力，液压行走，割台四行",
    descEn: "Mushen 4YZB-4E corn harvester 2022, Yuchai engine, 2WD 260HP, hydraulic drive, 4-row header",
    isFeatured: true,
  },
  // ===== 收获机 =====
  {
    folderName: "东洋甜菜机",
    brandKey: "东洋", categoryId: "harvester",
    modelName: "Beet Harvester", year: 2018, workingHours: null,
    condition: "good", priceCny: 0, priceUsd: null,
    location: "河北",
    descZh: "东洋甜菜收获机",
    descEn: "Toyo sugar beet harvester",
    isFeatured: false,
  },
  {
    folderName: "马赛甜菜收获机",
    brandKey: "马赛", categoryId: "harvester",
    modelName: "Beet Harvester", year: 2016, workingHours: null,
    condition: "good", priceCny: 0, priceUsd: null,
    location: "河北",
    descZh: "马赛甜菜收获机",
    descEn: "Massey sugar beet harvester",
    isFeatured: false,
  },
  // ===== 打捆机 克拉斯3300rc =====
  {
    folderName: "克拉斯3300rc",
    brandKey: "克拉斯", categoryId: "baler",
    modelName: "3300RC", year: 2022, workingHours: null,
    condition: "excellent", priceCny: 0, priceUsd: null,
    location: "河北",
    descZh: "克拉斯3300RC圆捆打捆机",
    descEn: "CLAAS 3300RC round baler",
    isFeatured: false,
  },
  // ===== 2007克罗尼青储机500 =====
  {
    folderName: "2007克罗尼青储机500",
    brandKey: "克罗尼", categoryId: "forage-harvester",
    modelName: "500", year: 2007, workingHours: null,
    condition: "fair", priceCny: 0, priceUsd: null,
    location: "河北",
    descZh: "克罗尼500青储机2007年",
    descEn: "Krone 500 forage harvester 2007",
    isFeatured: false,
  },
];

// 汇率：粗略按 1 USD = 7.25 CNY
const USD_TO_CNY = 7.25;

async function main() {
  console.log("🚀 开始导入真实库存数据...\n");

  // Step 1: 确保所有品牌和品类存在
  console.log("📋 同步品牌数据...");
  for (const [key, brand] of Object.entries(BRAND_MAP)) {
    await prisma.brand.upsert({
      where: { id: brand.id },
      update: {},
      create: {
        id: brand.id,
        nameZh: brand.nameZh,
        nameEn: brand.nameEn,
        originCountry: brand.originCountry,
        isImported: brand.isImported,
      },
    });
  }
  console.log(`  ✅ ${Object.keys(BRAND_MAP).length} 个品牌就绪`);

  console.log("📋 同步品类数据...");
  const uniqueCategories = new Map<string, { id: string; nameZh: string; nameEn: string }>();
  for (const cat of Object.values(CATEGORY_MAP)) {
    uniqueCategories.set(cat.id, cat);
  }
  for (const cat of uniqueCategories.values()) {
    await prisma.category.upsert({
      where: { id: cat.id },
      update: {},
      create: cat,
    });
  }
  console.log(`  ✅ ${uniqueCategories.size} 个品类就绪`);

  // Step 2: 清除旧的样例产品（仅清除 import-data 导入的，保留真实数据）
  console.log("\n🗑️ 清除旧样例产品...");
  const oldProducts = await prisma.product.findMany({
    where: { aiGenerated: false },
    include: { images: true },
  });
  for (const p of oldProducts) {
    await prisma.productImage.deleteMany({ where: { productId: p.id } });
  }
  await prisma.product.deleteMany({ where: { aiGenerated: false } });
  console.log(`  ✅ 清除 ${oldProducts.length} 条旧产品`);

  // Step 3: 获取 seller
  const seller = await prisma.user.findFirst({ where: { role: "seller" } });
  if (!seller) {
    console.error("❌ 未找到 seller 用户，请先运行 npm run db:seed");
    process.exit(1);
  }

  // Step 4: 创建上传目录
  fs.mkdirSync(PUBLIC_UPLOADS, { recursive: true });

  // Step 5: 导入产品
  console.log("\n📦 开始导入产品...\n");
  let imported = 0;
  let skipped = 0;

  for (const item of PRODUCTS) {
    const brandInfo = BRAND_MAP[item.brandKey];
    if (!brandInfo) {
      console.warn(`  ⚠️ 品牌未找到: ${item.brandKey}, 跳过`);
      skipped++;
      continue;
    }

    const categoryInfo = await prisma.category.findUnique({ where: { id: item.categoryId } });
    if (!categoryInfo) {
      console.warn(`  ⚠️ 品类未找到: ${item.categoryId}, 跳过`);
      skipped++;
      continue;
    }

    // 确定价格
    let priceCny = item.priceCny;
    let priceUsd = item.priceUsd;
    if (priceCny > 0 && !priceUsd) {
      priceUsd = Math.round(priceCny / USD_TO_CNY);
    }
    if (!priceCny && priceUsd && priceUsd > 0) {
      priceCny = Math.round(priceUsd * USD_TO_CNY);
    }
    if (!priceCny && !priceUsd) {
      priceCny = 0;
      priceUsd = 0;
    }

    // 创建产品
    const product = await prisma.product.create({
      data: {
        sellerId: seller.id,
        brandId: brandInfo.id,
        categoryId: item.categoryId,
        modelName: item.modelName,
        year: item.year,
        workingHours: item.workingHours,
        condition: item.condition,
        priceCny,
        priceUsd,
        location: item.location,
        descriptionZh: item.descZh,
        descriptionEn: item.descEn,
        aiGenerated: false,
        status: priceCny > 0 ? "active" : "active",
      },
    });

    // 复制图片
    const imgFolder = path.join(IMAGE_BASE, item.folderName);
    let imageFiles: string[] = [];
    if (fs.existsSync(imgFolder)) {
      const allFiles = fs.readdirSync(imgFolder);
      imageFiles = allFiles
        .filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))
        .sort();
    }

    // 智能排序：优先选择展示完整机器的图片作为封面
    // 策略：文件名包含"完整"、"整体"、"全景"或数字较小的(通常先拍整体)
    const sortedImages = [...imageFiles].sort((a, b) => {
      const aLower = a.toLowerCase();
      const bLower = b.toLowerCase();
      // 包含完整/整体/全景关键词的优先
      const aHasFull = /(完整|整体|全景|full|whole)/i.test(aLower);
      const bHasFull = /(完整|整体|全景|full|whole)/i.test(bLower);
      if (aHasFull && !bHasFull) return -1;
      if (!aHasFull && bHasFull) return 1;
      // 都不含关键词时，按文件名自然排序（通常先拍整体图）
      return a.localeCompare(b, undefined, { numeric: true });
    });

    let primarySet = false;
    const productDir = path.join(PUBLIC_UPLOADS, product.id);
    fs.mkdirSync(productDir, { recursive: true });

    for (let i = 0; i < Math.min(sortedImages.length, 10); i++) {
      const srcFile = path.join(imgFolder, sortedImages[i]);
      const ext = path.extname(sortedImages[i]);
      const destName = `${i + 1}${ext}`;
      const destFile = path.join(productDir, destName);

      try {
        fs.copyFileSync(srcFile, destFile);
        const isPrimary = !primarySet;
        if (isPrimary) primarySet = true;

        await prisma.productImage.create({
          data: {
            productId: product.id,
            url: `/uploads/products/${product.id}/${destName}`,
            sortOrder: i,
            isPrimary,
          },
        });
      } catch (err) {
        console.warn(`    ⚠️ 图片复制失败: ${sortedImages[i]}`);
      }
    }

    const imgCount = Math.min(imageFiles.length, 10);
    const priceStr = priceCny > 0 ? `¥${priceCny.toLocaleString()}` : "面议";
    console.log(`  ✅ ${brandInfo.nameEn} ${item.modelName} (${item.year}) — ${priceStr} — ${imgCount}张图${item.isFeatured ? " ⭐" : ""}`);
    imported++;
  }

  // Step 6: 统计
  console.log("\n" + "=".repeat(60));
  console.log(`📊 导入完成！`);
  console.log(`  成功: ${imported} 条`);
  console.log(`  跳过: ${skipped} 条`);

  const total = await prisma.product.count();
  const withImages = await prisma.productImage.groupBy({ by: ["productId"] });
  console.log(`  数据库产品总数: ${total}`);
  console.log(`  有图片的产品: ${withImages.length}`);

  // 品类分布
  const cats = await prisma.product.findMany({
    select: { category: { select: { nameZh: true } } },
  });
  const catDist: Record<string, number> = {};
  for (const c of cats) {
    catDist[c.category.nameZh] = (catDist[c.category.nameZh] || 0) + 1;
  }
  console.log("\n  品类分布:");
  for (const [name, count] of Object.entries(catDist).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${name}: ${count}台`);
  }
}

main()
  .catch((e) => {
    console.error("❌ 导入失败:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
