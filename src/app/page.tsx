import Link from "next/link";
import { db } from "@/lib/db";
import { getCategories } from "@/lib/categories";
import { getImageUrl } from "@/lib/r2";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { PendingLink } from "@/components/PendingLink";
import { ListingType } from "@/generated/prisma/enums";
import { LISTING_TYPE_LABELS, formatPrice } from "@/lib/listing-labels";
import { browseHref, parseListingTypeFilter } from "@/lib/browse-filters";
import { PUBLIC_STATUSES, statusLabel } from "@/lib/listing-status";
import { ALLOWED_DOMAIN_LABEL } from "@/lib/auth-domain";
import {
  EMPTY_NO_MATCHES,
  EMPTY_NOTHING_POSTED,
  HOME_HEADLINE,
  HOME_TAGLINE,
  SEARCH_PLACEHOLDER,
} from "@/lib/site-copy";
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
        status: { in: PUBLIC_STATUSES },
        // A suspended seller's listings come off the board without touching
        // their status, so nothing has to be undone when a suspension is
        // lifted — reinstating the person restores their listings by itself.
        seller: { suspendedAt: null },
        ...(categorySlug ? { category: { slug: categorySlug } } : {}),
        ...(query ? { title: { contains: query, mode: "insensitive" } } : {}),
        ...(typeFilter ? { type: typeFilter } : {}),
      },
      select: {
        id: true,
        title: true,
        price: true,
        imageKeys: true,
        type: true,
        rentalPeriod: true,
        serviceRate: true,
        status: true,
      },
      orderBy: { createdAt: "desc" },
      // Bounded so the query can't grow without limit as listings accumulate.
      // Real pagination is still owed; this stops the unbounded case first.
      take: 60,
    }),
    getCategories(),
    auth(),
  ]);

  const active = { category: categorySlug, q: query, type: typeFilter ?? undefined };
  const filtered = Boolean(categorySlug || query || typeFilter);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      {created && (
        <p className="notice notice-success mb-6" role="status">
          Listing posted successfully.
        </p>
      )}

      <Breadcrumbs items={[]} />

      {/* Spacing carries the grouping: mt-1 because the headline and tagline
          are one thought, mt-3 because the sign-in line is a separate one. */}
      <section className="mb-6 sm:mb-10">
        <h1>{HOME_HEADLINE}</h1>
        <p className="mt-1 text-secondary">{HOME_TAGLINE}</p>
        {!session?.user && (
          <p className="mt-3 text-fine text-tertiary">
            Anyone can browse.{" "}
            <Link
              href="/signin"
              className="font-medium text-accent underline underline-offset-4"
            >
              Sign in with your {ALLOWED_DOMAIN_LABEL} account
            </Link>{" "}
            to post or message a seller.
          </p>
        )}
      </section>

      <form className="mb-6 flex flex-col gap-2.5 sm:flex-row" action="/" method="get">
        <label htmlFor="q" className="sr-only">
          Search listings
        </label>
        <input
          id="q"
          type="search"
          name="q"
          defaultValue={query}
          placeholder={SEARCH_PLACEHOLDER}
          className="field min-w-0 flex-1"
        />
        {categorySlug && <input type="hidden" name="category" value={categorySlug} />}
        {typeFilter && <input type="hidden" name="type" value={typeFilter} />}
        <button type="submit" className="btn btn-secondary">
          Search
        </button>
      </form>

      {/* Sale/rent is a different question from category, so it gets its own
          row rather than being mixed into one undifferentiated wall of chips. */}
      <div className="mb-3 flex flex-wrap gap-2">
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

      {/* Seventeen categories wrap to five rows on a phone, so this is a
          scrolling rail there and wraps only where there is room. */}
      {/* One scrolling row at every width. Wrapping seventeen chips put three
          rows of controls above the fold on desktop, which is most of why a
          page with four listings read as empty — chrome outweighing content.
          A mask-image fade was considered as a scroll affordance and dropped:
          it would dim the focus ring of a chip near the edge. */}
      <div className="rail -mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:mb-10 sm:px-0">
        <div className="flex w-max gap-2">
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
        <div className="card flex flex-col items-center gap-3 px-6 py-10 text-center sm:py-16">
          <p className="text-display">
            {filtered ? EMPTY_NO_MATCHES.title : EMPTY_NOTHING_POSTED.title}
          </p>
          <p className="max-w-sm text-fine text-secondary">
            {filtered ? EMPTY_NO_MATCHES.body : EMPTY_NOTHING_POSTED.body}
          </p>
          {filtered ? (
            <Link href="/" className="btn btn-secondary btn-sm mt-1">
              Clear filters
            </Link>
          ) : (
            <Link href="/listings/new" className="btn btn-primary btn-sm mt-1">
              Post a listing
            </Link>
          )}
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 sm:gap-x-5 md:grid-cols-4">
          {listings.map((listing) => (
            <li key={listing.id}>
              <PendingLink
                href={`/listings/${listing.id}`}
                className="card-interactive block"
                innerClassName="flex flex-col gap-2.5"
                pendingClassName="card-pending"
              >
                <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-line bg-surface-sunken shadow-sm">
                  {listing.imageKeys[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={getImageUrl(listing.imageKeys[0])}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-fine text-tertiary">
                      No photo
                    </span>
                  )}

                  {listing.type === "RENT" && (
                    <span className="badge badge-accent absolute left-2 top-2 shadow-sm">
                      For rent
                    </span>
                  )}

                  {/* Sold and reserved stay visible, marked — evidence the
                      marketplace is used. Dimmed rather than hidden. */}
                  {listing.status !== "AVAILABLE" && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <span className="badge bg-white text-neutral-900">
                        {statusLabel(listing.status, listing.type)}
                      </span>
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-0.5">
                  <p className="truncate text-[0.9375rem] leading-snug font-medium">
                    {listing.title}
                  </p>
                  <p className="text-price">
                    {formatPrice(
                      listing.price,
                      listing.type,
                      listing.rentalPeriod,
                      listing.serviceRate,
                    )}
                  </p>
                </div>
              </PendingLink>
            </li>
          ))}
        </ul>
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
    <PendingLink
      href={href}
      aria-current={selected ? "true" : undefined}
      className={`chip${selected ? " chip-selected" : ""}`}
    >
      {children}
    </PendingLink>
  );
}
