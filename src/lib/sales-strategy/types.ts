/**
 * AI 销售策略 · 经销商分区公共类型（T4）
 *
 * 本文件仅含类型定义，零运行时依赖（不 import prisma / pii / db），
 * 因此可同时被「服务端路由 / 服务层」与「客户端组件」安全引用。
 */

/** 双站分区标识：cn=境内、intl=境外 */
export type DealerPartition = "cn" | "intl";

/** 分区查询入参 */
export type DealerPartitionQuery = "all" | "cn" | "intl";

/**
 * 脱敏后的经销商公开信息（渠道候选）。
 * 联系方式默认脱敏（唯一出口见 src/lib/pii.ts 的 maskPhone / maskEmail）。
 */
export interface DealerPublic {
  id: string;
  name: string | null;
  brands: string[];
  models: string[];
  regions: string[];
  nature: string | null;
  /** A/B/C 分级（T5 实时算兜底；seed 时按规则预填） */
  grade: string | null;
  sourceUrl: string | null;
  partition: DealerPartition;
  phoneMasked: string;
  wechatMasked: string;
  emailMasked: string;
  /**
   * 备注解析标签（补全 / 来源 / 同号关联 / 自家·禁外呼 / 电话占位）。
   * T5 分级用（含「电话占位」「自家·禁外呼」→ C 级）。**可选**：旧数据与既有测试字面量无需提供。
   */
  tags?: string[];
}

/** 双站分区返回结构（dealers 路由契约） */
export interface DealerPartitions {
  /** 当前站点：cn | com */
  site: "cn" | "com";
  /** 境内分区（.com 站恒为 []） */
  domestic: DealerPublic[];
  /** 跨境候选（.cn 为 intl 快照；.com 为原生） */
  international: DealerPublic[];
}
