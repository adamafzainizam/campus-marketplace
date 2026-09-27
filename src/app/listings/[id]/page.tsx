import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getImageUrl } from "@/lib/r2";
import { ListingGallery } from "./ListingGallery";
import {
  LISTING_TYPE_LABELS,
  formatPrice,
} from "@/lib/listing-labels";
import { ContactSellerButton } from "./ContactSellerButton";
import { ModeratorAction } from "@/app/admin/ModeratorAction";
import { ReportButton } from "@/components/ReportButton";
import { currentAdmin } from "@/lib/moderation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { statusLabel } from "@/lib/listing-status";
import { categoryDisplayName } from "@/lib/category-order";
import { halalDisplayLabel, HALAL_NOT_VERIFIED } from "@/lib/halal";
import { quantityLabel } from "@/lib/listing-quantity";
import { ListingMeta } from "@/components/ListingMeta";
import { NoPhoto } from "@/components/NoPhoto";

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
      serviceRate: true,
      imageKeys: true,
      createdAt: true,
      sellerId: true,
      category: { select: { name: true, slug: true } },
      otherCategory: true,
      quantity: true,
      halalStatus: true,
      seller: { select: { id: true, name: true } },
    },
  });

  if (!listing) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      {updated && (
        <p className="notice notice-success mb-6" role="status">
          Changes saved.
        </p>
      )}

      <Breadcrumbs items={[{ label: listing.title }]} />

      <div className="grid gap-6 md:grid-cols-2 md:gap-10">
        {listing.imageKeys.length > 0 ? (
          <ListingGallery
            urls={listing.imageKeys.map((key) => getImageUrl(key))}
            title={listing.title}
          />
        ) : (
          // Square rather than 4:3, matching the gallery it stands in for on
          // this page — the two states of the same slot should be the same
          // shape. It was an empty grey box that read as a broken image.
          <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded border-[1.5px] border-line bg-surface-sunken shadow-md">
            <NoPhoto />
          </div>
        )}

        <div className="flex flex-col gap-3">
          <h1>{listing.title}</h1>
          <p className="text-price-lg">
            {formatPrice(
              listing.price,
              listing.type,
              listing.rentalPeriod,
              listing.serviceRate,
            )}
          </p>
          {/* The same split line as the card: category and condition on the
              left, recency right. Condition lives here only, not as a tag
              too. It wraps here instead of truncating, so the full "Other"
              description shows rather than clipping to an ellipsis. */}
          <ListingMeta
            layout="split"
            wrap
            category={categoryDisplayName(
              listing.category.name,
              listing.category.slug,
              listing.otherCategory,
            )}
            condition={listing.condition}
            postedAt={listing.createdAt}
          />

          {/* Status leads, because it overrides everything else about the
              listing. The photo stays at full strength: on this page it is
              what the reader came to see. */}
          <div className="flex flex-wrap items-center gap-2">
            {listing.status !== "AVAILABLE" && (
              <span className="badge badge-ink">
                {statusLabel(listing.status, listing.type)}
              </span>
            )}
            <span
              className={`badge ${
                listing.type === "RENT" ? "badge-highlight" : "badge-outline border-content"
              }`}
            >
              {LISTING_TYPE_LABELS[listing.type]}
            </span>
            {quantityLabel(listing.quantity) && (
              <span className="badge badge-outline border-content">
                {quantityLabel(listing.quantity)}
              </span>
            )}
          </div>

          {listing.status !== "AVAILABLE" && (
            <p className="notice notice-neutral">
              {listing.status === "RESERVED"
                ? "This item is reserved for someone else, but the deal may still fall through."
                : `This item is no longer available. It has been marked ${statusLabel(
                    listing.status,
                    listing.type,
                  ).toLowerCase()}.`}
            </p>
          )}

          {/* Attributed to the seller, always. This site certifies nothing,
              and a bare "Halal" badge would present a stranger's unverified
              claim about a religious dietary restriction as established fact. */}
          {halalDisplayLabel(listing.halalStatus) && (
            <div className="notice notice-neutral flex-col items-start">
              <p className="font-medium">
                {halalDisplayLabel(listing.halalStatus)}
              </p>
              <p className="mt-1 text-fine">{HALAL_NOT_VERIFIED}</p>
            </div>
          )}

          <p className="max-w-[65ch] whitespace-pre-wrap leading-relaxed text-secondary">
            {listing.description}
          </p>

          {/* One row of actions that wraps rather than letting a label wrap.
              The seller gets management controls instead of a message button:
              they cannot open a thread against themselves, and reporting your
              own listing is refused server-side anyway. */}
          <div className="mt-2 flex flex-wrap items-start gap-3">
            {session?.user?.id === listing.sellerId ? (
              <>
                <Link href={`/listings/${listing.id}/edit`} className="btn btn-secondary">
                  Edit listing
                </Link>
                <Link href="/listings/mine" className="btn btn-secondary">
                  My listings
                </Link>
              </>
            ) : session?.user?.id ? (
              <>
                <ContactSellerButton listingId={listing.id} />
                <ReportButton
                  targetType="LISTING"
                  targetId={listing.id}
                  label="Report this listing"
                  buttonClassName="btn btn-secondary"
                />
              </>
            ) : (
              <Link
                href={`/signin?callbackUrl=/listings/${listing.id}`}
                className="btn btn-primary"
              >
                Sign in to message seller
              </Link>
            )}
          </div>

          <p className="mt-2 border-t-[1.5px] border-dashed border-line pt-3 text-fine text-secondary">
            Listed by {listing.seller.name}
          </p>

          {/* Moderation lives on the listing itself rather than behind a
              search box in /admin: you should be looking at the thing you are
              taking down. Renders for administrators only, and the action
              re-checks the role server-side regardless — this is a control,
              not a permission. */}
          {admin && listing.status !== "ARCHIVED" && (
            <div className="mt-6 border-t-[1.5px] border-line pt-4">
              <p className="hint mb-1">Moderation</p>
              <ModeratorAction kind="remove-listing" targetId={listing.id} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
