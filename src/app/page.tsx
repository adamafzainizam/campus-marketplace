import Link from "next/link";
import { db } from "@/lib/db";
import { getImageUrl } from "@/lib/r2";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ListingType } from "@/generated/prisma/enums";
import { LISTING_TYPE_LABELS, formatPrice } from "@/lib/listing-labels";
import { browseHref, parseListingTypeFilter } from "@/lib/browse-filters";
import { ALLOWED_DOMAIN_LABEL } from "@/lib/auth-domain";
import { auth } from "@/auth";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    category?: string;
    q?: string;
    type?: string;
    created?: string;
  }>;
}) {
  const {
    category: categorySlug,
    q: rawQuery,
    type: rawType,
    created,
  } = await searchParams;

  // Search terms come straight off the URL. Prisma parameterizes the value so
  // there is no injection path, but the length is still worth bounding so a
  // multi-megabyte query string can't be turned into database work.
  const query = typeof rawQuery === "string" ? rawQuery.trim().slice(0, 100) : undefined;
  const typeFilter = parseListingTypeFilter(rawType);

  const [listings, categories, session] = await Promise.all([
    db.listing.findMany({
      where: {
        status: "AVAILABLE",
        ...(categorySlug ? { category: { slug: categorySlug } } : {}),
        ...(query ? { title: { contains: query, mode: "insensitive" } } : {}),
        ...(typeFilter ? { type: typeFilter } : {}),
      },
      select: {
        id: true,
        title: true,
        price: true,
        imageUrl: true,
        type: true,
        rentalPeriod: true,
      },
      orderBy: { createdAt: "desc" },
      // Bounded so the query can't grow without limit as listings accumulate.
      // Real pagination is still owed; this stops the unbounded case first.
      take: 60,
    }),
    db.category.findMany({ orderBy: { name: "asc" } }),
    auth(),
  ]);

  const active = { category: categorySlug, q: query, type: typeFilter ?? undefined };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      {created && (
        <p className="mb-6 rounded bg-green-100 px-4 py-2 text-sm text-green-800 dark:bg-green-950 dark:text-green-200">
          Listing posted successfully.
        </p>
      )}

      <Breadcrumbs items={[]} />

      <h1 className="text-2xl font-semibold sm:text-3xl">
        Buy, sell, and rent within GMI
      </h1>
      <p className="mt-2 mb-8 text-sm text-zinc-600 dark:text-zinc-400">
        A marketplace for the German-Malaysian Institute community.{" "}
        {session?.user ? (
          <>Browse freely, and post whenever you&rsquo;re ready.</>
        ) : (
          <>
            Anyone can browse. To post a listing or message a seller you&rsquo;ll
            need to{" "}
            <Link href="/signin" className="underline underline-offset-2">
              sign in with your {ALLOWED_DOMAIN_LABEL} account
            </Link>
            .
          </>
        )}
      </p>

      <form
        className="mb-6 flex flex-col gap-3 sm:flex-row"
        action="/"
        method="get"
      >
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="Search listings..."
          className="min-w-0 flex-1 rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {categorySlug && <input type="hidden" name="category" value={categorySlug} />}
        {typeFilter && <input type="hidden" name="type" value={typeFilter} />}
        <button
          type="submit"
          className="rounded border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
        >
          Search
        </button>
      </form>

      {/* Sale/rent, kept separate from categories: they are different questions
          and combining them into one row of chips would imply otherwise. */}
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <FilterChip href={browseHref(active, { type: undefined })} selected={!typeFilter}>
          Everything
        </FilterChip>
        {Object.values(ListingType).map((value) => (
          <FilterChip
            key={value}
            href={browseHref(active, { type: value })}
            selected={typeFilter === value}
          >
            {LISTING_TYPE_LABELS[value]}
          </FilterChip>
        ))}
      </div>

      {/* Horizontally scrollable rather than wrapping to five rows on a phone,
          now that there are seventeen categories. */}
      <div className="mb-8 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-2 text-sm sm:w-auto sm:flex-wrap">
          <FilterChip
            href={browseHref(active, { category: undefined })}
            selected={!categorySlug}
          >
            All
          </FilterChip>
          {categories.map((category) => (
            <FilterChip
              key={category.id}
              href={browseHref(active, { category: category.slug })}
              selected={categorySlug === category.slug}
            >
              {category.name}
            </FilterChip>
          ))}
        </div>
      </div>

      {listings.length === 0 ? (
        <p className="text-zinc-600 dark:text-zinc-400">No listings found.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 md:grid-cols-4">
          {listings.map((listing) => (
            <Link
              key={listing.id}
              href={`/listings/${listing.id}`}
              className="flex flex-col gap-2"
            >
              <div className="relative aspect-square w-full overflow-hidden rounded bg-zinc-100 dark:bg-zinc-900">
                {listing.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={getImageUrl(listing.imageUrl)}
                    alt={listing.title}
                    className="h-full w-full object-cover"
                  />
                )}
                {listing.type === "RENT" && (
                  <span className="absolute left-2 top-2 rounded bg-foreground px-2 py-0.5 text-xs font-medium text-background">
                    For rent
                  </span>
                )}
              </div>
              <p className="truncate text-sm font-medium">{listing.title}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {formatPrice(listing.price, listing.type, listing.rentalPeriod)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  href,
  selected,
  children,
}: {
  href: string;
  selected: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`whitespace-nowrap rounded-full border px-3 py-1 ${
        selected
          ? "border-foreground bg-foreground text-background"
          : "border-zinc-300 dark:border-zinc-700"
      }`}
    >
      {children}
    </Link>
  );
}
