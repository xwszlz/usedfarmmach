/**
 * Image import script placeholder.
 * In production, this would:
 * 1. Read images from a source directory
 * 2. Upload to Aliyun OSS
 * 3. Update product image URLs in the database
 *
 * MVP: Images are served from /public/images/placeholders/
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

async function main() {
  const placeholderDir = path.join(process.cwd(), "public", "images", "placeholders");

  // Ensure placeholder directory exists
  if (!fs.existsSync(placeholderDir)) {
    fs.mkdirSync(placeholderDir, { recursive: true });
  }

  // Create a simple SVG placeholder for tractor
  const tractorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <rect width="400" height="300" fill="#f0fdfa"/>
  <text x="200" y="140" text-anchor="middle" font-size="60">🚜</text>
  <text x="200" y="190" text-anchor="middle" font-size="14" fill="#14b8a6">Farm Equipment</text>
</svg>`;

  fs.writeFileSync(path.join(placeholderDir, "tractor.svg"), tractorSvg);

  // Create placeholder for combine
  const combineSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <rect width="400" height="300" fill="#f0fdfa"/>
  <text x="200" y="140" text-anchor="middle" font-size="60">🌾</text>
  <text x="200" y="190" text-anchor="middle" font-size="14" fill="#14b8a6">Combine Harvester</text>
</svg>`;

  fs.writeFileSync(path.join(placeholderDir, "combine.svg"), combineSvg);

  // Generic equipment placeholder
  const equipmentSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <rect width="400" height="300" fill="#f0fdfa"/>
  <text x="200" y="140" text-anchor="middle" font-size="60">⚙️</text>
  <text x="200" y="190" text-anchor="middle" font-size="14" fill="#14b8a6">Equipment</text>
</svg>`;

  fs.writeFileSync(path.join(placeholderDir, "equipment.svg"), equipmentSvg);

  console.log("Placeholder images created in public/images/placeholders/");
  console.log("In production, implement Aliyun OSS upload logic here.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
