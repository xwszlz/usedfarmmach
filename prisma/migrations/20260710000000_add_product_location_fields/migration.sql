-- AlterTable: Add structured location fields to Product model
-- country: ISO 3166-1 alpha-2 country code (e.g. "CN", "DE", "US")
-- province: Province/State name (e.g. "河北", "Bavaria")
-- city: City name (e.g. "石家庄", "Munich")
-- All fields are nullable for backward compatibility with existing data

ALTER TABLE "Product" ADD COLUMN "country" TEXT;
ALTER TABLE "Product" ADD COLUMN "province" TEXT;
ALTER TABLE "Product" ADD COLUMN "city" TEXT;

-- Create indexes for filtering by structured location fields
CREATE INDEX "Product_country_idx" ON "Product"("country");
CREATE INDEX "Product_province_idx" ON "Product"("province");
CREATE INDEX "Product_city_idx" ON "Product"("city");
