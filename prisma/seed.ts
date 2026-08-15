import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

/**
 * A fixed, curated category list — category management was deliberately left
 * out of the build plan (Decision Log 2026-08-11).
 *
 * Deliberately broad. "Books" rather than "Textbooks" because people sell
 * novels and revision guides too, and a category nobody's item fits pushes
 * everything into "Other". Several exist mainly because they are things
 * students *rent* rather than buy — academic dress, event wear, tools,
 * instruments — which the site supports as of the ListingType migration.
 */
const categories = [
  { name: "Books", slug: "books" },
  { name: "Electronics", slug: "electronics" },
  { name: "Computers & Accessories", slug: "computers" },
  { name: "Phones & Tablets", slug: "phones-tablets" },
  { name: "Furniture", slug: "furniture" },
  { name: "Appliances", slug: "appliances" },
  { name: "Kitchen & Dining", slug: "kitchen-dining" },
  { name: "Clothing & Accessories", slug: "clothing" },
  { name: "Formal & Event Wear", slug: "formal-event-wear" },
  { name: "Sports & Outdoors", slug: "sports-outdoors" },
  { name: "Bicycles & Transport", slug: "bicycles-transport" },
  { name: "Tools & Equipment", slug: "tools-equipment" },
  { name: "Musical Instruments", slug: "musical-instruments" },
  { name: "Stationery & Supplies", slug: "stationery-supplies" },
  { name: "Lab & Workshop Gear", slug: "lab-workshop-gear" },
  { name: "Hobbies & Games", slug: "hobbies-games" },
  // Added 2026-08-15 after a live testing session: people were going to sell
  // food regardless, and an unlabelled "Other" is worse than a category with
  // rules attached. Selecting it requires a halal statement — see src/lib/halal.ts.
  { name: "Food & Drink", slug: "food-drink" },
  { name: "Other", slug: "other" },
];

/**
 * Categories that were renamed rather than added.
 *
 * Without this the seed would upsert a *new* row on the new slug and orphan
 * the old one, leaving both in the picker and stranding every listing already
 * filed under the old name. Renaming in place keeps those listings attached.
 */
const renames = [{ from: "textbooks", to: "books", name: "Books" }];

async function main() {
  for (const { from, to, name } of renames) {
    const existing = await db.category.findUnique({ where: { slug: from } });
    if (!existing) continue;

    // If the destination already exists, the rename has happened before.
    const destination = await db.category.findUnique({ where: { slug: to } });
    if (destination) continue;

    await db.category.update({ where: { slug: from }, data: { slug: to, name } });
    console.log(`Renamed category "${from}" to "${to}".`);
  }

  for (const category of categories) {
    await db.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name },
      create: category,
    });
  }

  console.log(`Seeded ${categories.length} categories.`);
}

main()
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
