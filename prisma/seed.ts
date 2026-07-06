import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Create admin user
  const adminHash = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { email: "admin@agritrade.com" },
    update: {},
    create: {
      email: "admin@agritrade.com",
      passwordHash: adminHash,
      role: "admin",
      companyName: "AgriTrade",
      country: "CN",
      preferredLanguage: "zh",
    },
  });

  // Create demo seller
  const sellerHash = await bcrypt.hash("seller123", 10);
  await prisma.user.upsert({
    where: { email: "seller@agritrade.com" },
    update: {},
    create: {
      email: "seller@agritrade.com",
      passwordHash: sellerHash,
      role: "seller",
      companyName: "神雕农机科技有限公司",
      country: "CN",
      preferredLanguage: "zh",
    },
  });

  // Create brands
  const brands = [
    { nameZh: "约翰迪尔", nameEn: "John Deere", originCountry: "US", isImported: true },
    { nameZh: "久保田", nameEn: "Kubota", originCountry: "JP", isImported: true },
    { nameZh: "凯斯", nameEn: "Case IH", originCountry: "US", isImported: true },
    { nameZh: "纽荷兰", nameEn: "New Holland", originCountry: "US", isImported: true },
    { nameZh: "雷沃", nameEn: "Lovol", originCountry: "CN", isImported: false },
    { nameZh: "东风", nameEn: "Dongfeng", originCountry: "CN", isImported: false },
    { nameZh: "沃得", nameEn: "World", originCountry: "CN", isImported: false },
    { nameZh: "谷王", nameEn: "Guwang", originCountry: "CN", isImported: false },
  ];

  for (const brand of brands) {
    await prisma.brand.upsert({
      where: { id: brand.nameEn.toLowerCase().replace(/\s+/g, "-") },
      update: {},
      create: { id: brand.nameEn.toLowerCase().replace(/\s+/g, "-"), ...brand },
    });
  }

  // Create categories
  const categories = [
    { id: "tractor", nameZh: "拖拉机", nameEn: "Tractor" },
    { id: "combine", nameZh: "收割机", nameEn: "Combine Harvester" },
    { id: "planter", nameZh: "播种机", nameEn: "Planter" },
    { id: "sprayer", nameZh: "喷洒机", nameEn: "Sprayer" },
    { id: "baler", nameZh: "打捆机", nameEn: "Baler" },
    { id: "excavator", nameZh: "挖掘机", nameEn: "Excavator" },
    { id: "loader", nameZh: "装载机", nameEn: "Loader" },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { id: cat.id },
      update: {},
      create: cat,
    });
  }

  console.log("Seed data created successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
