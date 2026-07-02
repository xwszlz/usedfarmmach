export type UserRole = "buyer" | "seller" | "admin";

export type ProductCondition = "excellent" | "good" | "fair" | "poor";

export type ProductStatus = "active" | "sold" | "draft" | "archived";

export type InquiryStatus = "pending" | "replied" | "closed";

export type DemandStatus = "active" | "fulfilled" | "closed";

export interface User {
  id: string;
  email: string;
  phone: string | null;
  role: UserRole;
  companyName: string | null;
  country: string | null;
  preferredLanguage: string;
  credits: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface Brand {
  id: string;
  nameZh: string;
  nameEn: string;
  originCountry: string;
  isImported: boolean;
}

export interface Category {
  id: string;
  nameZh: string;
  nameEn: string;
  parentId: string | null;
}

export interface Product {
  id: string;
  sellerId: string;
  brandId: string;
  categoryId: string;
  modelName: string;
  year: number;
  workingHours: number | null;
  condition: ProductCondition;
  priceCny: number;
  priceUsd: number | null;
  location: string;
  descriptionZh: string | null;
  descriptionEn: string | null;
  descriptionRu: string | null;
  descriptionEs: string | null;
  descriptionPt: string | null;
  descriptionAr: string | null;
  descriptionFr: string | null;
  descriptionHi: string | null;
  aiGenerated: boolean;
  status: ProductStatus;
  enginePower?: number | null;
  engineType?: string | null;
  driveSystem?: string | null;
  overallLength?: number | null;
  overallWidth?: number | null;
  overallHeight?: number | null;
  netWeight?: number | null;
  mainConfig?: string | null;
  priceMode?: string;
  tradeTerm?: string;
  tradePort?: string | null;
  standardDescriptionEn?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  brand?: Brand;
  category?: Category;
  images?: ProductImage[];
  videos?: ProductVideo[];
  seller?: Pick<User, "id" | "companyName" | "country">;
}

export interface ProductImage {
  id: string;
  productId: string;
  url: string;
  sortOrder: number;
  isPrimary: boolean;
  angleLabel?: string | null;
}

export interface ProductVideo {
  id: string;
  productId: string;
  url: string;
  sortOrder: number;
  title?: string | null;
}

export interface Inquiry {
  id: string;
  productId: string;
  buyerId: string | null;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  message: string | null;
  status: InquiryStatus;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface Demand {
  id: string;
  buyerId: string;
  targetCountry: string;
  categoryId: string | null;
  brandId: string | null;
  budgetMinUsd: number | null;
  budgetMaxUsd: number | null;
  quantity: number;
  deadlineMonths: number | null;
  description: string | null;
  status: DemandStatus;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface Valuation {
  id: string;
  productId: string | null;
  brandId: string;
  modelName: string;
  year: number;
  workingHours: number | null;
  estimatedPriceCny: number;
  estimatedPriceUsd: number;
  confidenceScore: number;
  factors: Record<string, unknown> | null;
}

export interface ProductFilters {
  query?: string;
  brand?: string;
  category?: string;
  yearMin?: number;
  yearMax?: number;
  priceMin?: number;
  priceMax?: number;
  location?: string;
  condition?: ProductCondition;
  page?: number;
  pageSize?: number;
  sort?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// 带完整关联数据的Product类型
export interface ProductWithDetails extends Product {
  brand?: Brand;
  category?: Category;
  images?: ProductImage[];
  seller?: Pick<User, "id" | "companyName" | "country">;
  internationalPrices?: InternationalPrice[];
}

// 国际价格类型
export interface InternationalPrice {
  id: string;
  productId: string;
  priceForeignCny: number;
  priceForeignRaw: number | null;
  currency: string;
  exchangeRate: number | null;
  source: string;
  sourceUrl: string | null;
  sourceDate: string | null;
  country: string | null;
  notes: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  isActive: boolean;
  confidenceScore: number;
  lastVerified: Date | string | null;
}

// 套利相关类型导出
export * from './arbitrage';
export * from './exchange-rates';
