import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";

/**
 * Categories, cached across requests.
 *
 * The list is a fixed, curated set seeded by `prisma/seed.ts` — it changes
 * roughly never, but was being re-queried on every browse render and every
 * time a listing form opened. That is a database round trip to Singapore for
 * data that is effectively constant, and on a free tier where the database
 * auto-suspends, an avoidable query is an avoidable cold-start risk.
 *
 * Tagged so a future admin UI can invalidate it explicitly with
 * `revalidateTag("categories")` rather than waiting out the TTL.
 */
export const getCategories = unstable_cache(
  async () => db.category.findMany({ orderBy: { name: "asc" } }),
  ["categories"],
  { tags: ["categories"], revalidate: 3600 },
);
