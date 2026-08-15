-- Multiple photos per listing.
--
-- Hand-written rather than generated: a generated migration is free to drop
-- and recreate the column, which here would discard every existing photo
-- reference. The backfill must run between the add and the drop.

ALTER TABLE "listings" ADD COLUMN "imageKeys" TEXT[] NOT NULL DEFAULT '{}';

UPDATE "listings"
SET "imageKeys" = ARRAY["imageUrl"]
WHERE "imageUrl" IS NOT NULL;

ALTER TABLE "listings" DROP COLUMN "imageUrl";
