import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getImageUrl } from "@/lib/r2";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ListingMeta } from "@/components/ListingMeta";
import { NoPhoto } from "@/components/NoPhoto";
import { CardPrice } from "@/components/CardPrice";
import { MINE_EMPTY } from "@/lib/site-copy";
import { statusLabel } from "@/lib/listing-status";
import { ListingStatusControl } from "./ListingStatusControl";

export const metadata: Metadata = { title: "My listings" };

export default async function MyListingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin?callbackUrl=/listings/mine");
  }

  const listings = await db.listing.findMany({
    where: { sellerId: session.user.id },
    select: {
      id: true,
      title: true,
      price: true,
      imageKeys: true,
      type: true,
      rentalPeriod: true,
      serviceRate: true,
      status: true,
      createdAt: true,
      // The shared meta line, same as the browse card.
      condition: true,
      category: { select: { name: true } },
      _count: { select: { conversations: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <Breadcrumbs items={[{ label: "My listings" }]} />

      <div className="mb-6 sm:mb-10 flex flex-wrap items-center justify-between gap-3">
        <h1>My listings</h1>
        <Link
          href="/listings/new"
          className="btn btn-primary"
        >
          Post a listing
        </Link>
      </div>

      {listings.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 px-6 py-10 text-center sm:py-16">
          <p className="text-display">{MINE_EMPTY.title}</p>
          <p className="max-w-sm text-fine text-secondary">{MINE_EMPTY.body}</p>
          <Link href="/listings/new" className="btn btn-primary btn-sm mt-1">
            Post a listing
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {listings.map((listing) => (
            <li
              key={listing.id}
              className="card flex flex-col gap-4 p-4 sm:flex-row"
            >
              {/* 4:3 and the same missing-photo state as every other page.
                  It was a bare 96px square that rendered nothing at all when
                  a listing had no photograph. */}
              <div className="aspect-[4/3] w-32 shrink-0 overflow-hidden rounded-lg border border-line bg-surface-sunken">
                {listing.imageKeys[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={getImageUrl(listing.imageKeys[0])}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <NoPhoto compact />
                )}
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link
                    href={`/listings/${listing.id}`}
                    className="truncate font-medium hover:underline"
                  >
                    {listing.title}
                  </Link>
                  <CardPrice listing={listing} />
                </div>

                <ListingMeta
                  category={listing.category.name}
                  condition={listing.condition}
                  postedAt={listing.createdAt}
                />

                <p className="text-sm text-secondary">
                  {statusLabel(listing.status, listing.type)}
                  {listing._count.conversations > 0 && (
                    <>
                      {" · "}
                      {listing._count.conversations}{" "}
                      {listing._count.conversations === 1
                        ? "conversation"
                        : "conversations"}
                    </>
                  )}
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  <ListingStatusControl
                    listingId={listing.id}
                    status={listing.status}
                    type={listing.type}
                  />
                  <Link
                    href={`/listings/${listing.id}/edit`}
                    className="btn btn-secondary btn-sm"
                  >
                    Edit
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
