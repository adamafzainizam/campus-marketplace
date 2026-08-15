-- CreateEnum
CREATE TYPE "HalalStatus" AS ENUM ('HALAL', 'NON_HALAL', 'UNSPECIFIED');

-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "halalStatus" "HalalStatus",
ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 1;
