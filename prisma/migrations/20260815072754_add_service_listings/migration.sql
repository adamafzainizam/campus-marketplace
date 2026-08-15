-- CreateEnum
CREATE TYPE "ServiceRate" AS ENUM ('HOUR', 'SESSION', 'ITEM', 'FIXED');

-- AlterEnum
ALTER TYPE "ListingType" ADD VALUE 'SERVICE';

-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "serviceRate" "ServiceRate",
ALTER COLUMN "condition" DROP NOT NULL;
