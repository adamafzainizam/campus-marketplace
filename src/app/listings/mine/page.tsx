import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ListingCard } from "@/components/ListingCard";
import { MINE_EMPTY } from "@/lib/site-copy";
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
      quantity: true,
      _count: { select: { conversations: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
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
          <h2 className="text-display">{MINE_EMPTY.title}</h2>
          <p className="max-w-sm text-fine text-secondary">{MINE_EMPTY.body}</p>
          <Link href="/listings/new" className="btn btn-primary btn-sm mt-1">
            Post a listing
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 sm:gap-x-5">
          {listings.map((listing) => (
            <li key={listing.id}>
              <ListingCard
                listing={listing}
                controls={
                  <>
                    <div className="min-w-0 max-w-full [&_select]:max-w-full">
                      <ListingStatusControl
                        listingId={listing.id}
                        status={listing.status}
                        type={listing.type}
                      />
                    </div>
                    <Link
                      href={`/listings/${listing.id}/edit`}
                      className="btn btn-secondary btn-sm"
                    >
                      Edit
                    </Link>
                    {listing._count.conversations > 0 && (
                      <span className="text-fine text-secondary">
                        {listing._count.conversations}{" "}
                        {listing._count.conversations === 1
                          ? "conversation"
                          : "conversations"}
                      </span>
                    )}
                  </>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
