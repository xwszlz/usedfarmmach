import { z } from "zod";

export const registerSchema = z
  .object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters").regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Password must contain uppercase, lowercase and number"),
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
  email: z.string().email("Invalid email address"),
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
  brand: z.string().optional(),
  category: z.string().optional(),
  yearMin: z.coerce.number().int().optional(),
  yearMax: z.coerce.number().int().optional(),
  priceMin: z.coerce.number().optional(),
  priceMax: z.coerce.number().optional(),
  location: z.string().optional(),
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
