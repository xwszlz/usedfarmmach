import { NextRequest } from "next/server";

/**
 * 服务端埋点扩展点（P2 防刷去重 / 爬虫过滤）。
 *
 * 当前恒返回 false：表示不跳过任何埋点请求，所有 track 均正常计数。
 *
 * 后续迭代（P2）可在此统一接入：
 *   - 同 IP / 登录用户短时间窗口（如 10–30min）去重；
 *   - 常见搜索引擎爬虫 UA 黑名单过滤；
 *   - 匿名用户是否计入的开关。
 *
 * 设计约定（见架构文档 §7.7）：仅保留入口与函数签名，本期不实现具体逻辑，
 * 避免影响主流程；任何扩展都应在本函数内统一决策。
 *
 * @param _req 当前请求（预留用于读取 IP / UA / 鉴权上下文）
 * @returns true 表示应跳过本次埋点（不计）；false 表示正常计数
 */
export function shouldSkipTracking(_req: NextRequest): boolean {
  return false;
}
