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
import { ModeratorAction } from "@/app/admin/ModeratorAction";
import { ReportButton } from "@/components/ReportButton";
import { currentAdmin } from "@/lib/moderation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { statusLabel } from "@/lib/listing-status";

export default async function ListingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ updated?: string }>;
}) {
  const { id } = await params;
  const { updated } = await searchParams;
  const [session, admin] = await Promise.all([auth(), currentAdmin()]);

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
      {updated && (
        <p className="notice notice-success mb-6" role="status">
          Changes saved.
        </p>
      )}

      <Breadcrumbs items={[{ label: listing.title }]} />

      <div className="grid gap-6 sm:grid-cols-2 sm:gap-8">
        <div className="aspect-square w-full overflow-hidden rounded-lg border border-line bg-surface-sunken shadow-sm">
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
              className={`badge ${
                listing.type === "RENT" ? "badge-accent" : "badge-outline"
              }`}
            >
              {LISTING_TYPE_LABELS[listing.type]}
            </span>
            {listing.status !== "AVAILABLE" && (
              <span className="badge badge-outline">
                {statusLabel(listing.status, listing.type)}
              </span>
            )}
          </div>
          <h1>{listing.title}</h1>
          <p className="tabular text-xl font-medium">
            {formatPrice(listing.price, listing.type, listing.rentalPeriod)}
          </p>
          <p className="text-fine text-secondary">
            {listing.category.name} &middot; {CONDITION_LABELS[listing.condition]}
          </p>
          <p className="whitespace-pre-wrap leading-relaxed">{listing.description}</p>
          <p className="mt-2 text-fine text-secondary">
            Listed by {listing.seller.name}
          </p>
          {/* The badge above already names the state; this explains what it
              means for the reader. Previously this printed the raw enum. */}
          {listing.status !== "AVAILABLE" && (
            <p className="text-sm text-secondary">
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
                className="btn btn-secondary"
              >
                Edit listing
              </Link>
              <Link
                href="/listings/mine"
                className="btn btn-secondary"
              >
                My listings
              </Link>
            </div>
          ) : session?.user?.id ? (
            <ContactSellerButton listingId={listing.id} />
          ) : (
            <Link
              href={`/signin?callbackUrl=/listings/${listing.id}`}
              className="btn btn-primary mt-5"
            >
              Sign in to message seller
            </Link>
          )}

          {/* Reporting is for everyone except the seller, who has no reason to
              report their own listing and is refused server-side anyway. */}
          {session?.user?.id && session.user.id !== listing.sellerId && (
            <div className="mt-6">
              <ReportButton
                targetType="LISTING"
                targetId={listing.id}
                label="Report this listing"
              />
            </div>
          )}

          {/* Moderation lives on the listing itself rather than behind a
              search box in /admin: you should be looking at the thing you are
              taking down. Renders for administrators only, and the action
              re-checks the role server-side regardless — this is a control,
              not a permission. */}
          {admin && listing.status !== "ARCHIVED" && (
            <div className="mt-6 border-t border-[var(--border)] pt-4">
              <p className="hint mb-1">Moderation</p>
              <ModeratorAction kind="remove-listing" targetId={listing.id} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
