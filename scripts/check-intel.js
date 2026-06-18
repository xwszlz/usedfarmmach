const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.marketIntel.count();
  console.log("Total records:", count);

  const all = await prisma.marketIntel.findMany({
    orderBy: { date: "desc" },
    select: { id: true, date: true, text: true, region: true, icon: true, sortOrder: true, isActive: true }
  });

  console.log("\nAll records:");
  all.forEach((r) => {
    const d = r.date.toISOString().split("T")[0];
    const txt = r.text ? r.text.substring(0, 80) : "(no text)";
    console.log(`[${d}] active=${r.isActive} ${r.icon} ${r.region} sort=${r.sortOrder} | ${txt}`);
  });

  // Check for 5070
  const with5070 = await prisma.marketIntel.findMany({
    where: { text: { contains: "5070" } }
  });
  console.log("\nRecords with 5070:", with5070.length);
  
  // Get date distribution
  const dates = await prisma.marketIntel.groupBy({
    by: ["date"],
    _count: { id: true },
    orderBy: { date: "desc" },
    take: 10
  });
  console.log("\nDate distribution:");
  dates.forEach((d) => {
    const dd = d.date.toISOString().split("T")[0];
    console.log(dd + ": " + d._count.id + " records");
  });

  await prisma.$disconnect();
}

main();
