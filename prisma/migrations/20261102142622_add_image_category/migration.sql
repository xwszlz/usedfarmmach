-- CreateEnum
CREATE TYPE "ImageCategory" AS ENUM ('OVERALL', 'NAMEPLATE', 'DASHBOARD', 'CAB', 'ENGINE', 'WORKING_MECHANISM', 'CHASSIS', 'REAR', 'FRONT_ATTACHMENT', 'SIDE', 'DETAIL', 'DAMAGE');

-- AlterTable
ALTER TABLE "ProductImage" ADD COLUMN     "imageCategory" "ImageCategory";

