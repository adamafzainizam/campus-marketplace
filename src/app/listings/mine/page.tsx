import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getImageUrl } from "@/lib/r2";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { formatPrice } from "@/lib/listing-labels";
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
      imageUrl: true,
      type: true,
      rentalPeriod: true,
      status: true,
      createdAt: true,
      _count: { select: { conversations: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Breadcrumbs items={[{ label: "My listings" }]} />

      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">My listings</h1>
        <Link
          href="/listings/new"
          className="btn btn-primary"
        >
          Post a listing
        </Link>
      </div>

      {listings.length === 0 ? (
        <p className="text-secondary">
          You haven&rsquo;t posted anything yet.{" "}
          <Link href="/listings/new" className="underline underline-offset-2">
            Post your first listing
          </Link>
          .
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {listings.map((listing) => (
            <li
              key={listing.id}
              className="card flex flex-col gap-4 p-4 sm:flex-row"
            >
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-line bg-surface-sunken">
                {listing.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={getImageUrl(listing.imageUrl)}
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
                    {formatPrice(listing.price, listing.type, listing.rentalPeriod)}
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
