/**
 * 后台浏览量看板（product_view_stats）响应类型定义。
 * 对应 GET /api/admin/analytics/views 的返回结构。
 */

/** 网站总览（O(1) 读取 SiteStat 全局行） */
export interface Overview {
  totalPageViews: number; // 网站总 PV（仅 product + category 页面访问）
  totalProductViews: number; // 产品总浏览
  totalCategoryViews: number; // 栏目总浏览
  totalVideoPlays: number; // 视频总播放（video + fieldVideo 合计）
}

/** 栏目排行项 */
export interface CategoryRank {
  id: string;
  name: string;
  viewCount: number;
  /** 占栏目总浏览量的百分比（0–100，保留 1 位小数） */
  ratio: number;
}

/** 视频类型（产品视频 / 地头展现场作业视频） */
export type VideoRankType = "product" | "field";

/** 视频排行项（ProductVideo 与 FieldVideo 合并） */
export interface VideoRank {
  id: string;
  title: string;
  type: VideoRankType;
  playCount: number;
}

/** 视频排行类型过滤（看板 ?type= 参数） */
export type VideoRankingFilter = "all" | "product" | "field";

/** 视角标记：'all' 全站（admin） / 'mine' 仅自有（seller） */
export type AnalyticsScope = "all" | "mine";

/** 看板完整响应 data 段 */
export interface ViewsAnalyticsData {
  overview: Overview;
  categoryRanking: CategoryRank[];
  videoRanking: VideoRank[];
  scope: AnalyticsScope;
}

/** 看板成功响应 */
export interface ViewsAnalyticsResponse {
  success: boolean;
  data: ViewsAnalyticsData;
}
