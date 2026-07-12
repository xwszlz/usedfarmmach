/**
 * 产地结构化数据常量
 *
 * 维护中国省份/城市数据和国际常用国家中英文对照表。
 * 不依赖外部 npm 包，全部硬编码在项目内。
 */

// ═══════════════════════════════════════════════════════
// 中国省份及主要城市数据
// ═══════════════════════════════════════════════════════

export interface ProvinceData {
  /** 省份中文名（不含"省""市"后缀） */
  nameZh: string;
  /** 省份英文名 */
  nameEn: string;
  /** 省份俄文名 */
  nameRu: string;
  /** 该省主要城市列表 */
  cities: CityData[];
}

export interface CityData {
  /** 城市中文名（不含"市"后缀） */
  nameZh: string;
  /** 城市英文名 */
  nameEn: string;
  /** 城市俄文名 */
  nameRu: string;
}

/**
 * 中国 34 个省级行政区及主要农机产业城市
 * 数据来源：国家统计局行政区划 + 农机产业聚集地
 */
export const CHINA_PROVINCES: ProvinceData[] = [
  {
    nameZh: "河北",
    nameEn: "Hebei",
    nameRu: "Хэбэй",
    cities: [
      { nameZh: "石家庄", nameEn: "Shijiazhuang", nameRu: "Шицзячжуан" },
      { nameZh: "保定", nameEn: "Baoding", nameRu: "Баодин" },
      { nameZh: "邢台", nameEn: "Xingtai", nameRu: "Синтай" },
      { nameZh: "邯郸", nameEn: "Handan", nameRu: "Ханьдань" },
      { nameZh: "沧州", nameEn: "Cangzhou", nameRu: "Цанчжоу" },
      { nameZh: "衡水", nameEn: "Hengshui", nameRu: "Хэншуй" },
      { nameZh: "廊坊", nameEn: "Langfang", nameRu: "Ланфан" },
      { nameZh: "唐山", nameEn: "Tangshan", nameRu: "Таншань" },
      { nameZh: "秦皇岛", nameEn: "Qinhuangdao", nameRu: "Циньхуандао" },
      { nameZh: "张家口", nameEn: "Zhangjiakou", nameRu: "Чжанцзякоу" },
      { nameZh: "承德", nameEn: "Chengde", nameRu: "Чэндэ" },
    ],
  },
  {
    nameZh: "山东",
    nameEn: "Shandong",
    nameRu: "Шаньдун",
    cities: [
      { nameZh: "潍坊", nameEn: "Weifang", nameRu: "Вэйфан" },
      { nameZh: "济南", nameEn: "Jinan", nameRu: "Цзинань" },
      { nameZh: "青岛", nameEn: "Qingdao", nameRu: "Циндао" },
      { nameZh: "临沂", nameEn: "Linyi", nameRu: "Линьи" },
      { nameZh: "济宁", nameEn: "Jining", nameRu: "Цзинин" },
      { nameZh: "聊城", nameEn: "Liaocheng", nameRu: "Ляочэн" },
      { nameZh: "德州", nameEn: "Dezhou", nameRu: "Дэчжоу" },
      { nameZh: "淄博", nameEn: "Zibo", nameRu: "Цзыбо" },
      { nameZh: "烟台", nameEn: "Yantai", nameRu: "Яньтай" },
    ],
  },
  {
    nameZh: "河南",
    nameEn: "Henan",
    nameRu: "Хэнань",
    cities: [
      { nameZh: "洛阳", nameEn: "Luoyang", nameRu: "Лоян" },
      { nameZh: "郑州", nameEn: "Zhengzhou", nameRu: "Чжэнчжоу" },
      { nameZh: "开封", nameEn: "Kaifeng", nameRu: "Кайфэн" },
      { nameZh: "许昌", nameEn: "Xuchang", nameRu: "Сюйчан" },
      { nameZh: "新乡", nameEn: "Xinxiang", nameRu: "Синьсян" },
      { nameZh: "南阳", nameEn: "Nanyang", nameRu: "Наньян" },
      { nameZh: "驻马店", nameEn: "Zhumadian", nameRu: "Чжумадянь" },
      { nameZh: "周口", nameEn: "Zhoukou", nameRu: "Чжоукоу" },
    ],
  },
  {
    nameZh: "江苏",
    nameEn: "Jiangsu",
    nameRu: "Цзянсу",
    cities: [
      { nameZh: "徐州", nameEn: "Xuzhou", nameRu: "Сюйчжоу" },
      { nameZh: "南京", nameEn: "Nanjing", nameRu: "Нанкин" },
      { nameZh: "苏州", nameEn: "Suzhou", nameRu: "Сучжоу" },
      { nameZh: "无锡", nameEn: "Wuxi", nameRu: "Уси" },
      { nameZh: "常州", nameEn: "Changzhou", nameRu: "Чанчжоу" },
      { nameZh: "盐城", nameEn: "Yancheng", nameRu: "Яньчэн" },
      { nameZh: "连云港", nameEn: "Lianyungang", nameRu: "Ляньюньган" },
      { nameZh: "南通", nameEn: "Nantong", nameRu: "Наньтун" },
    ],
  },
  {
    nameZh: "安徽",
    nameEn: "Anhui",
    nameRu: "Аньхой",
    cities: [
      { nameZh: "合肥", nameEn: "Hefei", nameRu: "Хэфэй" },
      { nameZh: "芜湖", nameEn: "Wuhu", nameRu: "Уху" },
      { nameZh: "蚌埠", nameEn: "Bengbu", nameRu: "Бэнбу" },
      { nameZh: "阜阳", nameEn: "Fuyang", nameRu: "Фуян" },
      { nameZh: "亳州", nameEn: "Bozhou", nameRu: "Бочжоу" },
      { nameZh: "宿州", nameEn: "Suzhou", nameRu: "Сучжоу" },
      { nameZh: "六安", nameEn: "Lu'an", nameRu: "Луань" },
    ],
  },
  {
    nameZh: "黑龙江",
    nameEn: "Heilongjiang",
    nameRu: "Хэйлунцзян",
    cities: [
      { nameZh: "哈尔滨", nameEn: "Harbin", nameRu: "Харбин" },
      { nameZh: "齐齐哈尔", nameEn: "Qiqihar", nameRu: "Цицикар" },
      { nameZh: "佳木斯", nameEn: "Jiamusi", nameRu: "Цзямысы" },
      { nameZh: "牡丹江", nameEn: "Mudanjiang", nameRu: "Муданьцзян" },
      { nameZh: "绥化", nameEn: "Suihua", nameRu: "Суйхуа" },
    ],
  },
  {
    nameZh: "吉林",
    nameEn: "Jilin",
    nameRu: "Гирин",
    cities: [
      { nameZh: "长春", nameEn: "Changchun", nameRu: "Чанчунь" },
      { nameZh: "吉林", nameEn: "Jilin", nameRu: "Гирин" },
      { nameZh: "四平", nameEn: "Siping", nameRu: "Сыпин" },
      { nameZh: "松原", nameEn: "Songyuan", nameRu: "Сунъюань" },
    ],
  },
  {
    nameZh: "辽宁",
    nameEn: "Liaoning",
    nameRu: "Ляонин",
    cities: [
      { nameZh: "沈阳", nameEn: "Shenyang", nameRu: "Шэньян" },
      { nameZh: "大连", nameEn: "Dalian", nameRu: "Далянь" },
      { nameZh: "鞍山", nameEn: "Anshan", nameRu: "Аньшань" },
      { nameZh: "锦州", nameEn: "Jinzhou", nameRu: "Цзиньчжоу" },
      { nameZh: "铁岭", nameEn: "Tieling", nameRu: "Телин" },
    ],
  },
  {
    nameZh: "内蒙古",
    nameEn: "Inner Mongolia",
    nameRu: "Внутренняя Монголия",
    cities: [
      { nameZh: "呼和浩特", nameEn: "Hohhot", nameRu: "Хух-Хото" },
      { nameZh: "包头", nameEn: "Baotou", nameRu: "Баотоу" },
      { nameZh: "赤峰", nameEn: "Chifeng", nameRu: "Чифэн" },
      { nameZh: "通辽", nameEn: "Tongliao", nameRu: "Тунляо" },
    ],
  },
  {
    nameZh: "山西",
    nameEn: "Shanxi",
    nameRu: "Шаньси",
    cities: [
      { nameZh: "太原", nameEn: "Taiyuan", nameRu: "Тайюань" },
      { nameZh: "大同", nameEn: "Datong", nameRu: "Датун" },
      { nameZh: "运城", nameEn: "Yuncheng", nameRu: "Юньчэн" },
      { nameZh: "临汾", nameEn: "Linfen", nameRu: "Линьфэнь" },
    ],
  },
  {
    nameZh: "陕西",
    nameEn: "Shaanxi",
    nameRu: "Шэньси",
    cities: [
      { nameZh: "西安", nameEn: "Xi'an", nameRu: "Сиань" },
      { nameZh: "宝鸡", nameEn: "Baoji", nameRu: "Баоцзи" },
      { nameZh: "咸阳", nameEn: "Xianyang", nameRu: "Сяньян" },
      { nameZh: "渭南", nameEn: "Weinan", nameRu: "Вэйнань" },
    ],
  },
  {
    nameZh: "甘肃",
    nameEn: "Gansu",
    nameRu: "Ганьсу",
    cities: [
      { nameZh: "兰州", nameEn: "Lanzhou", nameRu: "Ланьчжоу" },
      { nameZh: "天水", nameEn: "Tianshui", nameRu: "Тяньшуй" },
      { nameZh: "酒泉", nameEn: "Jiuquan", nameRu: "Цзюцюань" },
    ],
  },
  {
    nameZh: "新疆",
    nameEn: "Xinjiang",
    nameRu: "Синьцзян",
    cities: [
      { nameZh: "乌鲁木齐", nameEn: "Urumqi", nameRu: "Урумчи" },
      { nameZh: "石河子", nameEn: "Shihezi", nameRu: "Шихэцзы" },
      { nameZh: "喀什", nameEn: "Kashgar", nameRu: "Кашгар" },
    ],
  },
  {
    nameZh: "北京",
    nameEn: "Beijing",
    nameRu: "Пекин",
    cities: [
      { nameZh: "北京", nameEn: "Beijing", nameRu: "Пекин" },
    ],
  },
  {
    nameZh: "天津",
    nameEn: "Tianjin",
    nameRu: "Тяньцзинь",
    cities: [
      { nameZh: "天津", nameEn: "Tianjin", nameRu: "Тяньцзинь" },
    ],
  },
  {
    nameZh: "上海",
    nameEn: "Shanghai",
    nameRu: "Шанхай",
    cities: [
      { nameZh: "上海", nameEn: "Shanghai", nameRu: "Шанхай" },
    ],
  },
  {
    nameZh: "浙江",
    nameEn: "Zhejiang",
    nameRu: "Чжэцзян",
    cities: [
      { nameZh: "杭州", nameEn: "Hangzhou", nameRu: "Ханчжоу" },
      { nameZh: "宁波", nameEn: "Ningbo", nameRu: "Нинбо" },
      { nameZh: "温州", nameEn: "Wenzhou", nameRu: "Вэньчжоу" },
      { nameZh: "金华", nameEn: "Jinhua", nameRu: "Цзиньхуа" },
    ],
  },
  {
    nameZh: "福建",
    nameEn: "Fujian",
    nameRu: "Фуцзянь",
    cities: [
      { nameZh: "福州", nameEn: "Fuzhou", nameRu: "Фучжоу" },
      { nameZh: "厦门", nameEn: "Xiamen", nameRu: "Сямынь" },
      { nameZh: "泉州", nameEn: "Quanzhou", nameRu: "Цюаньчжоу" },
    ],
  },
  {
    nameZh: "江西",
    nameEn: "Jiangxi",
    nameRu: "Цзянси",
    cities: [
      { nameZh: "南昌", nameEn: "Nanchang", nameRu: "Наньчан" },
      { nameZh: "九江", nameEn: "Jiujiang", nameRu: "Цзюцзян" },
      { nameZh: "赣州", nameEn: "Ganzhou", nameRu: "Ганьчжоу" },
    ],
  },
  {
    nameZh: "湖北",
    nameEn: "Hubei",
    nameRu: "Хубэй",
    cities: [
      { nameZh: "武汉", nameEn: "Wuhan", nameRu: "Ухань" },
      { nameZh: "襄阳", nameEn: "Xiangyang", nameRu: "Сянъян" },
      { nameZh: "宜昌", nameEn: "Yichang", nameRu: "Ичан" },
    ],
  },
  {
    nameZh: "湖南",
    nameEn: "Hunan",
    nameRu: "Хунань",
    cities: [
      { nameZh: "长沙", nameEn: "Changsha", nameRu: "Чанша" },
      { nameZh: "株洲", nameEn: "Zhuzhou", nameRu: "Чжучжоу" },
      { nameZh: "衡阳", nameEn: "Hengyang", nameRu: "Хэнъян" },
    ],
  },
  {
    nameZh: "广东",
    nameEn: "Guangdong",
    nameRu: "Гуандун",
    cities: [
      { nameZh: "广州", nameEn: "Guangzhou", nameRu: "Гуанчжоу" },
      { nameZh: "深圳", nameEn: "Shenzhen", nameRu: "Шэньчжэнь" },
      { nameZh: "佛山", nameEn: "Foshan", nameRu: "Фошань" },
      { nameZh: "东莞", nameEn: "Dongguan", nameRu: "Дунгуань" },
    ],
  },
  {
    nameZh: "广西",
    nameEn: "Guangxi",
    nameRu: "Гуанси",
    cities: [
      { nameZh: "南宁", nameEn: "Nanning", nameRu: "Наньнин" },
      { nameZh: "柳州", nameEn: "Liuzhou", nameRu: "Лючжоу" },
      { nameZh: "桂林", nameEn: "Guilin", nameRu: "Гуйлинь" },
    ],
  },
  {
    nameZh: "四川",
    nameEn: "Sichuan",
    nameRu: "Сычуань",
    cities: [
      { nameZh: "成都", nameEn: "Chengdu", nameRu: "Чэнду" },
      { nameZh: "绵阳", nameEn: "Mianyang", nameRu: "Мяньян" },
      { nameZh: "德阳", nameEn: "Deyang", nameRu: "Дэян" },
    ],
  },
  {
    nameZh: "重庆",
    nameEn: "Chongqing",
    nameRu: "Чунцин",
    cities: [
      { nameZh: "重庆", nameEn: "Chongqing", nameRu: "Чунцин" },
    ],
  },
  {
    nameZh: "云南",
    nameEn: "Yunnan",
    nameRu: "Юньнань",
    cities: [
      { nameZh: "昆明", nameEn: "Kunming", nameRu: "Куньмин" },
      { nameZh: "大理", nameEn: "Dali", nameRu: "Дали" },
    ],
  },
  {
    nameZh: "贵州",
    nameEn: "Guizhou",
    nameRu: "Гуйчжоу",
    cities: [
      { nameZh: "贵阳", nameEn: "Guiyang", nameRu: "Гуйян" },
    ],
  },
  {
    nameZh: "宁夏",
    nameEn: "Ningxia",
    nameRu: "Нинся",
    cities: [
      { nameZh: "银川", nameEn: "Yinchuan", nameRu: "Иньчуань" },
    ],
  },
  {
    nameZh: "青海",
    nameEn: "Qinghai",
    nameRu: "Цинхай",
    cities: [
      { nameZh: "西宁", nameEn: "Xining", nameRu: "Синин" },
    ],
  },
  {
    nameZh: "西藏",
    nameEn: "Tibet",
    nameRu: "Тибет",
    cities: [
      { nameZh: "拉萨", nameEn: "Lhasa", nameRu: "Лхаса" },
    ],
  },
  {
    nameZh: "海南",
    nameEn: "Hainan",
    nameRu: "Хайнань",
    cities: [
      { nameZh: "海口", nameEn: "Haikou", nameRu: "Хайкоу" },
      { nameZh: "三亚", nameEn: "Sanya", nameRu: "Санья" },
    ],
  },
];

// ═══════════════════════════════════════════════════════
// 国际常用国家数据（农机贸易相关）
// ═══════════════════════════════════════════════════════

export interface CountryData {
  /** ISO 3166-1 alpha-2 国家代码 */
  code: string;
  /** 中文国名 */
  nameZh: string;
  /** 英文国名 */
  nameEn: string;
  /** 俄文国名 */
  nameRu: string;
}

/**
 * 国际常用国家列表（农机进出口贸易相关，约 30 个主要国家）
 */
export const INTERNATIONAL_COUNTRIES: CountryData[] = [
  { code: "DE", nameZh: "德国", nameEn: "Germany", nameRu: "Германия" },
  { code: "US", nameZh: "美国", nameEn: "United States", nameRu: "США" },
  { code: "JP", nameZh: "日本", nameEn: "Japan", nameRu: "Япония" },
  { code: "KR", nameZh: "韩国", nameEn: "South Korea", nameRu: "Южная Корея" },
  { code: "FR", nameZh: "法国", nameEn: "France", nameRu: "Франция" },
  { code: "IT", nameZh: "意大利", nameEn: "Italy", nameRu: "Италия" },
  { code: "GB", nameZh: "英国", nameEn: "United Kingdom", nameRu: "Великобритания" },
  { code: "NL", nameZh: "荷兰", nameEn: "Netherlands", nameRu: "Нидерланды" },
  { code: "ES", nameZh: "西班牙", nameEn: "Spain", nameRu: "Испания" },
  { code: "RU", nameZh: "俄罗斯", nameEn: "Russia", nameRu: "Россия" },
  { code: "BY", nameZh: "白俄罗斯", nameEn: "Belarus", nameRu: "Беларусь" },
  { code: "CA", nameZh: "加拿大", nameEn: "Canada", nameRu: "Канада" },
  { code: "AU", nameZh: "澳大利亚", nameEn: "Australia", nameRu: "Австралия" },
  { code: "BR", nameZh: "巴西", nameEn: "Brazil", nameRu: "Бразилия" },
  { code: "AR", nameZh: "阿根廷", nameEn: "Argentina", nameRu: "Аргентина" },
  { code: "IN", nameZh: "印度", nameEn: "India", nameRu: "Индия" },
  { code: "TH", nameZh: "泰国", nameEn: "Thailand", nameRu: "Таиланд" },
  { code: "VN", nameZh: "越南", nameEn: "Vietnam", nameRu: "Вьетнам" },
  { code: "ID", nameZh: "印度尼西亚", nameEn: "Indonesia", nameRu: "Индонезия" },
  { code: "MY", nameZh: "马来西亚", nameEn: "Malaysia", nameRu: "Малайзия" },
  { code: "PH", nameZh: "菲律宾", nameEn: "Philippines", nameRu: "Филиппины" },
  { code: "TR", nameZh: "土耳其", nameEn: "Turkey", nameRu: "Турция" },
  { code: "PL", nameZh: "波兰", nameEn: "Poland", nameRu: "Польша" },
  { code: "UA", nameZh: "乌克兰", nameEn: "Ukraine", nameRu: "Украина" },
  { code: "MX", nameZh: "墨西哥", nameEn: "Mexico", nameRu: "Мексика" },
  { code: "ZA", nameZh: "南非", nameEn: "South Africa", nameRu: "ЮАР" },
  { code: "EG", nameZh: "埃及", nameEn: "Egypt", nameRu: "Египет" },
  { code: "SA", nameZh: "沙特阿拉伯", nameEn: "Saudi Arabia", nameRu: "Саудовская Аравия" },
  { code: "AE", nameZh: "阿联酋", nameEn: "UAE", nameRu: "ОАЭ" },
  { code: "KZ", nameZh: "哈萨克斯坦", nameEn: "Kazakhstan", nameRu: "Казахстан" },
  { code: "UZ", nameZh: "乌兹别克斯坦", nameEn: "Uzbekistan", nameRu: "Узбекистан" },
  { code: "PK", nameZh: "巴基斯坦", nameEn: "Pakistan", nameRu: "Пакистан" },
];

// ═══════════════════════════════════════════════════════
// 辅助查找函数
// ═══════════════════════════════════════════════════════

/**
 * 构建省份名称快速查找映射（含简写和全称）
 * @returns Map<省份名(多种写法), ProvinceData>
 */
const _provinceLookupMap: Map<string, ProvinceData> = (() => {
  const map = new Map<string, ProvinceData>();
  for (const province of CHINA_PROVINCES) {
    map.set(province.nameZh, province);
    map.set(province.nameEn.toLowerCase(), province);
  }
  return map;
})();

/**
 * 通过省份中文名查找省份数据
 */
export function findProvinceByName(nameZh: string): ProvinceData | undefined {
  return _provinceLookupMap.get(nameZh);
}

/**
 * 通过省份名在文本中查找匹配的省份
 * @param text 位置文本，如 "河北石家庄"、"山东省潍坊市"
 * @returns 匹配到的省份数据，未匹配返回 undefined
 */
export function findProvinceInText(text: string): ProvinceData | undefined {
  if (!text) return undefined;
  for (const province of CHINA_PROVINCES) {
    if (text.includes(province.nameZh)) {
      return province;
    }
    // 英文名匹配（大小写不敏感）
    if (text.toLowerCase().includes(province.nameEn.toLowerCase())) {
      return province;
    }
  }
  return undefined;
}

/**
 * 通过城市名在文本中查找匹配的城市
 * @param text 位置文本，如 "石家庄"、"河北石家庄"
 * @returns 匹配到的城市数据及其所属省份，未匹配返回 undefined
 */
export function findCityInText(text: string): { city: CityData; province: ProvinceData } | undefined {
  if (!text) return undefined;
  for (const province of CHINA_PROVINCES) {
    for (const city of province.cities) {
      if (text.includes(city.nameZh)) {
        return { city, province };
      }
      if (text.toLowerCase().includes(city.nameEn.toLowerCase())) {
        return { city, province };
      }
    }
  }
  return undefined;
}

/**
 * 通过国家代码查找国家数据
 */
export function findCountryByCode(code: string): CountryData | undefined {
  return INTERNATIONAL_COUNTRIES.find((c) => c.code === code);
}

/**
 * 通过国家名（中文/英文）在文本中查找匹配的国家
 * @param text 位置文本，如 "德国"、"Germany"
 * @returns 匹配到的国家数据，未匹配返回 undefined
 */
export function findCountryInText(text: string): CountryData | undefined {
  if (!text) return undefined;
  const lowerText = text.toLowerCase();
  for (const country of INTERNATIONAL_COUNTRIES) {
    if (text.includes(country.nameZh)) {
      return country;
    }
    if (lowerText.includes(country.nameEn.toLowerCase())) {
      return country;
    }
    if (text.includes(country.code)) {
      return country;
    }
  }
  return undefined;
}

/**
 * 获取省份的俄文翻译（用于 filters API 返回）
 */
export function getProvinceTranslations(nameZh: string): { labelEn: string; labelRu: string } {
  const province = findProvinceByName(nameZh);
  if (province) {
    return { labelEn: province.nameEn, labelRu: province.nameRu };
  }
  return { labelEn: nameZh, labelRu: nameZh };
}

/**
 * 获取国家的多语言翻译
 */
export function getCountryTranslations(code: string): { labelZh: string; labelEn: string; labelRu: string } {
  const country = findCountryByCode(code);
  if (country) {
    return { labelZh: country.nameZh, labelEn: country.nameEn, labelRu: country.nameRu };
  }
  return { labelZh: code, labelEn: code, labelRu: code };
}
