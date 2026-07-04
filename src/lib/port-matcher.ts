/**
 * 港口自动匹配模块
 *
 * 根据卖家所在省份/位置，自动匹配最近的出口港口。
 * 用于网站发布页、小程序API、AI识别结果填充。
 */

// 省份 -> 最近港口映射表
const PROVINCE_PORT_MAP: Record<string, { primary: string; fallback: string }> = {
  // 华北
  "北京": { primary: "天津", fallback: "青岛" },
  "天津": { primary: "天津", fallback: "青岛" },
  "河北": { primary: "天津", fallback: "青岛" }, // 石家庄 -> 天津(240km)
  "山西": { primary: "天津", fallback: "青岛" }, // 太原 -> 天津(550km)
  "内蒙古": { primary: "天津", fallback: "连云港" },

  // 华东
  "山东": { primary: "青岛", fallback: "日照" }, // 济南 -> 青岛(380km)
  "江苏": { primary: "上海", fallback: "连云港" }, // 南京 -> 上海(300km)
  "上海": { primary: "上海", fallback: "宁波" },
  "浙江": { primary: "宁波", fallback: "上海" },
  "安徽": { primary: "上海", fallback: "南京" },
  "福建": { primary: "厦门", fallback: "宁波" }, // 映射到"其他"

  // 东北
  "辽宁": { primary: "大连", fallback: "天津" }, // 映射到"其他"
  "吉林": { primary: "大连", fallback: "天津" }, // 映射到"其他"
  "黑龙江": { primary: "大连", fallback: "天津" }, // 映射到"其他"

  // 华中
  "河南": { primary: "青岛", fallback: "连云港" }, // 郑州 -> 青岛(680km)
  "湖北": { primary: "上海", fallback: "武汉" }, // 映射到"其他"
  "湖南": { primary: "广州", fallback: "上海" },

  // 华南
  "广东": { primary: "广州", fallback: "深圳" }, // 映射到"其他"
  "广西": { primary: "广州", fallback: "防城港" }, // 映射到"其他"
  "海南": { primary: "海口", fallback: "广州" }, // 映射到"其他"

  // 西部
  "四川": { primary: "重庆", fallback: "成都" }, // 映射到"其他"
  "重庆": { primary: "重庆", fallback: "成都" }, // 映射到"其他"
  "陕西": { primary: "青岛", fallback: "天津" }, // 西安 -> 青岛(1200km)
  "甘肃": { primary: "天津", fallback: "青岛" },
  "新疆": { primary: "连云港", fallback: "青岛" }, // 霍尔果斯 -> 连云港(铁路)
};

// 网站/小程序港口下拉选项中的标准港口
const STANDARD_PORTS = new Set(["青岛", "上海", "天津", "广州", "连云港", "宁波"]);

/**
 * 根据位置字符串匹配最近的港口
 *
 * @param location 位置字符串，如 "河北石家庄"、"山东潍坊"、"河北"
 * @returns 港口名称（中文）。如果映射到的港口不在标准选项中，返回"其他"。
 *          如果无法匹配任何省份，返回默认"青岛"。
 */
export function matchPortByLocation(location: string): string {
  if (!location || typeof location !== "string") return "青岛";

  for (const [province, ports] of Object.entries(PROVINCE_PORT_MAP)) {
    if (location.includes(province)) {
      // 如果映射到的港口在标准选项中，直接返回
      if (STANDARD_PORTS.has(ports.primary)) {
        return ports.primary;
      }
      // 否则返回"其他"（如大连、厦门等不在标准选项中的港口）
      return "其他";
    }
  }

  return "青岛"; // 兜底默认值
}

/**
 * 获取港口的英文名称（用于数据库兼容）
 *
 * @param portName 中文港口名
 * @returns 英文港口名
 */
export function getPortEnglish(portName: string): string {
  const portMap: Record<string, string> = {
    "青岛": "Qingdao",
    "上海": "Shanghai",
    "天津": "Tianjin",
    "广州": "Guangzhou",
    "连云港": "Lianyungang",
    "宁波": "Ningbo",
    "其他": "Other",
  };
  return portMap[portName] || portName;
}
