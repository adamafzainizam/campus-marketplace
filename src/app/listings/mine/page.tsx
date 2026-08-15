import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getImageUrl } from "@/lib/r2";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { formatPrice } from "@/lib/listing-labels";
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
      _count: { select: { conversations: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <Breadcrumbs items={[{ label: "My listings" }]} />

      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <h1>My listings</h1>
        <Link
          href="/listings/new"
          className="btn btn-primary"
        >
          Post a listing
        </Link>
      </div>

      {listings.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center sm:py-20">
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
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-line bg-surface-sunken">
                {listing.imageKeys[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={getImageUrl(listing.imageKeys[0])}
                    alt=""
                    className="h-full w-full object-cover"
                  />
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
                  <span className="text-sm text-secondary">
                    {formatPrice(
                      listing.price,
                      listing.type,
                      listing.rentalPeriod,
                      listing.serviceRate,
                    )}
                  </span>
                </div>

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
