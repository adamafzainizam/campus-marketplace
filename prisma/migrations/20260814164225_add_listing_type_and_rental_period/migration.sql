-- CreateEnum
CREATE TYPE "ListingType" AS ENUM ('SALE', 'RENT');

-- CreateEnum
CREATE TYPE "RentalPeriod" AS ENUM ('DAY', 'WEEK', 'MONTH', 'SEMESTER');

-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "rentalPeriod" "RentalPeriod",
ADD COLUMN     "type" "ListingType" NOT NULL DEFAULT 'SALE';

-- CreateIndex
CREATE INDEX "listings_type_idx" ON "listings"("type");
