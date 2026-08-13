import Link from "next/link";
import { db } from "@/lib/db";
import { getImageUrl } from "@/lib/r2";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; created?: string }>;
}) {
  const { category: categorySlug, q: rawQuery, created } = await searchParams;

  // Search terms come straight off the URL. Prisma parameterizes the value so
  // there is no injection path, but the length is still worth bounding so a
  // multi-megabyte query string can't be turned into database work.
  const query = typeof rawQuery === "string" ? rawQuery.trim().slice(0, 100) : undefined;

  const [listings, categories] = await Promise.all([
    db.listing.findMany({
      where: {
        status: "AVAILABLE",
        ...(categorySlug ? { category: { slug: categorySlug } } : {}),
        ...(query ? { title: { contains: query, mode: "insensitive" } } : {}),
      },
      select: {
        id: true,
        title: true,
        price: true,
        imageUrl: true,
      },
      orderBy: { createdAt: "desc" },
      // Bounded so the query can't grow without limit as listings accumulate.
      // Real pagination is still owed; this stops the unbounded case first.
      take: 60,
    }),
    db.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      {created && (
        <p className="mb-6 rounded bg-green-100 px-4 py-2 text-sm text-green-800 dark:bg-green-950 dark:text-green-200">
          Listing posted successfully.
        </p>
      )}

      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Campus Marketplace</h1>
        <div className="flex items-center gap-3">
          <Link
            href="/messages"
            className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700"
          >
            Messages
          </Link>
          <Link
            href="/listings/new"
            className="rounded bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            Post a listing
          </Link>
        </div>
      </div>

      <form className="mb-6 flex flex-wrap gap-3" action="/" method="get">
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="Search listings..."
          className="flex-1 rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {categorySlug && <input type="hidden" name="category" value={categorySlug} />}
        <button
          type="submit"
          className="rounded border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
        >
          Search
        </button>
      </form>

      <div className="mb-8 flex flex-wrap gap-2 text-sm">
        <Link
          href={query ? `/?q=${encodeURIComponent(query)}` : "/"}
          className={`rounded-full border px-3 py-1 ${
            !categorySlug
              ? "border-foreground bg-foreground text-background"
              : "border-zinc-300 dark:border-zinc-700"
          }`}
        >
          All
        </Link>
        {categories.map((category) => {
          const href = query
            ? `/?category=${category.slug}&q=${encodeURIComponent(query)}`
            : `/?category=${category.slug}`;
          return (
            <Link
              key={category.id}
              href={href}
              className={`rounded-full border px-3 py-1 ${
                categorySlug === category.slug
                  ? "border-foreground bg-foreground text-background"
                  : "border-zinc-300 dark:border-zinc-700"
              }`}
            >
              {category.name}
            </Link>
          );
        })}
      </div>

      {listings.length === 0 ? (
        <p className="text-zinc-600 dark:text-zinc-400">No listings found.</p>
      ) : (
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4">
          {listings.map((listing) => (
            <Link
              key={listing.id}
              href={`/listings/${listing.id}`}
              className="flex flex-col gap-2"
            >
              <div className="aspect-square w-full overflow-hidden rounded bg-zinc-100 dark:bg-zinc-900">
                {listing.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={getImageUrl(listing.imageUrl)}
                    alt={listing.title}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <p className="truncate text-sm font-medium">{listing.title}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                RM {listing.price.toString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
