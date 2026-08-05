export interface ArenaInput {
  crop: string;
  machineType: string;
  budget: number; // 万元
  fieldSize?: number; // 亩
  targetRegion?: string;
  maxAge?: number;
}

export interface SixDimScore {
  costPerformance: number; // 0-100
  performanceMatch: number;
  brandReputation: number;
  partsAvailability: number;
  residualValue: number;
  crossBorderFit: number;
  total: number; // 加权总分 0-100
}

export interface ArenaCandidate {
  product: any; // 归一化产品对象（来自Product或ShowcaseItem）
  scores: SixDimScore;
  rank: number;
  source: "used" | "showcase-new" | "showcase-used"; // 候选来源
}

export interface ArenaMatchResult {
  candidates: ArenaCandidate[];
  totalFound: number;
  returnedCount: number;
}
