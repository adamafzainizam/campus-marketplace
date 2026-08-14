import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getImageUrl } from "@/lib/r2";
import {
  CONDITION_LABELS,
  LISTING_TYPE_LABELS,
  formatPrice,
} from "@/lib/listing-labels";
import { ContactSellerButton } from "./ContactSellerButton";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { statusLabel } from "@/lib/listing-status";

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  // `select`, not `include`. `include: { seller: true }` pulls every User
  // column, including email and emailVerified. Nothing leaks today because
  // this is a pure Server Component and only rendered output crosses to the
  // browser — but it becomes a real leak the moment this object is handed to a
  // Client Component, which is a one-line change someone will eventually make.
  const listing = await db.listing.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      price: true,
      condition: true,
      status: true,
      type: true,
      rentalPeriod: true,
      imageUrl: true,
      sellerId: true,
      category: { select: { name: true } },
      seller: { select: { id: true, name: true } },
    },
  });

  if (!listing) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Breadcrumbs items={[{ label: listing.title }]} />

      <div className="grid gap-8 sm:grid-cols-2">
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

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${
                listing.type === "RENT"
                  ? "bg-foreground text-background"
                  : "border border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
              }`}
            >
              {LISTING_TYPE_LABELS[listing.type]}
            </span>
            {listing.status !== "AVAILABLE" && (
              <span className="w-fit rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                {statusLabel(listing.status, listing.type)}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-semibold">{listing.title}</h1>
          <p className="text-xl">
            {formatPrice(listing.price, listing.type, listing.rentalPeriod)}
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {listing.category.name} &middot; {CONDITION_LABELS[listing.condition]}
          </p>
          <p className="whitespace-pre-wrap">{listing.description}</p>
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            Listed by {listing.seller.name}
          </p>
          {/* The badge above already names the state; this explains what it
              means for the reader. Previously this printed the raw enum. */}
          {listing.status !== "AVAILABLE" && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {listing.status === "RESERVED"
                ? "This item is reserved for someone else, but the deal may still fall through."
                : `This item is no longer available. It has been marked ${statusLabel(
                    listing.status,
                    listing.type,
                  ).toLowerCase()}.`}
            </p>
          )}

          {/* The seller gets management controls instead of a message button —
              they can't open a thread against themselves. */}
          {session?.user?.id === listing.sellerId ? (
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href={`/listings/${listing.id}/edit`}
                className="rounded border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
              >
                Edit listing
              </Link>
              <Link
                href="/listings/mine"
                className="rounded border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
              >
                My listings
              </Link>
            </div>
          ) : session?.user?.id ? (
            <ContactSellerButton listingId={listing.id} />
          ) : (
            <Link
              href={`/signin?callbackUrl=/listings/${listing.id}`}
              className="mt-4 inline-block rounded bg-foreground px-4 py-2 text-center text-sm text-background"
            >
              Sign in to message seller
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
