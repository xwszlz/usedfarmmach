import { z } from "zod";

export const registerSchema = z
  .object({
    username: z
      .string()
      .min(3, "Username must be at least 3 characters")
      .max(30, "Username too long")
      .regex(/^[a-zA-Z0-9_\-\u4e00-\u9fa5]+$/, "Username can only contain letters, numbers, underscore, hyphen and Chinese"),
    email: z.string().email("Invalid email address").optional().or(z.literal("")),
    password: z
      .string()
      .min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
    phone: z.string().optional(),
    companyName: z.string().optional(),
    country: z.string().optional(),
    role: z.enum(["buyer", "seller"]).default("buyer"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  identifier: z.string().min(1, "Username or email is required"),
  password: z.string().min(1, "Password is required"),
});

export const inquirySchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  company: z.string().optional(),
  message: z.string().max(2000, "Message too long").optional(),
});

export const productQuerySchema = z.object({
  query: z.string().optional(),
  brand: z.string().optional(),
  category: z.string().optional(),
  yearMin: z.coerce.number().int().optional(),
  yearMax: z.coerce.number().int().optional(),
  priceMin: z.coerce.number().optional(),
  priceMax: z.coerce.number().optional(),
  location: z.string().optional(), // 兼容旧参数：位置文本筛选
  country: z.string().optional(), // 新参数：国家代码筛选，如 "CN" / "DE"
  province: z.string().optional(), // 新参数：省份筛选，如 "河北"
  city: z.string().optional(), // 新参数：城市筛选，如 "石家庄"
  condition: z.enum(["excellent", "good", "fair", "poor"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(12),
  sort: z
    .enum(["newest", "priceLow", "priceHigh", "yearNew", "hoursLow", "rank"])
    .default("newest"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type InquiryInput = z.infer<typeof inquirySchema>;
export type ProductQueryInput = z.infer<typeof productQuerySchema>;
