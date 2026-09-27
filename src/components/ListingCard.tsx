import { PendingLink } from "@/components/PendingLink";
import { ListingMeta } from "@/components/ListingMeta";
import { NoPhoto } from "@/components/NoPhoto";
import { CardPrice } from "@/components/CardPrice";
import { getImageUrl } from "@/lib/r2";
import { LISTING_TYPE_LABELS } from "@/lib/listing-labels";
import { statusLabel } from "@/lib/listing-status";
import type {
  ListingCondition,
  ListingStatus,
  ListingType,
  RentalPeriod,
  ServiceRate,
} from "@/generated/prisma/enums";

export type CardListing = {
  id: string;
  title: string;
  price: { toString(): string };
  imageKeys: string[];
  type: ListingType;
  rentalPeriod: RentalPeriod | null;
  serviceRate: ServiceRate | null;
  status: ListingStatus;
  condition: ListingCondition | null;
  createdAt: Date;
  category: { name: string };
  /** Present only where the page selected it (the owner's view). */
  quantity?: number;
};

/**
 * The listing card: browse, and (with `controls`) the seller's own list.
 *
 * One card design sitewide, so a seller sees their listings the way buyers
 * do, and the two cannot drift. `/listings/mine` used to be a second, wide
 * row design that buyers never saw.
 */
export function ListingCard({ listing }: { listing: CardListing }) {
  return (
    <PendingLink
      href={`/listings/${listing.id}`}
      className="card card-interactive block overflow-hidden"
      innerClassName="block"
      pendingClassName="card-pending"
    >
      <CardFace listing={listing} />
    </PendingLink>
  );
}

/** Photo well and the three lines of text; everything inside the link. */
function CardFace({ listing }: { listing: CardListing }) {
  return (
    <>
      {/* 4:3 rather than 1:1. A square crops phone photographs
          hardest, and it made a listing with no photo a large void
          instead of a small one. */}
      <div className="relative aspect-[4/3] w-full overflow-hidden border-b-[1.5px] border-line bg-surface-sunken">
        {listing.imageKeys[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={getImageUrl(listing.imageKeys[0])}
            alt=""
            loading="lazy"
            className={`h-full w-full object-cover${
              listing.status === "AVAILABLE" ? "" : " opacity-45"
            }`}
          />
        ) : (
          <NoPhoto bare={listing.status !== "AVAILABLE"} />
        )}

        {/* Tags say what kind of listing this is. A sale is the
            default and carries none, so a tag always means
            something. */}
        {listing.type === "RENT" && (
          <span className="badge badge-highlight absolute left-2 top-2 shadow-sm">
            {LISTING_TYPE_LABELS.RENT}
          </span>
        )}
        {listing.type === "SERVICE" && (
          <span className="badge badge-outline absolute left-2 top-2 border-content shadow-sm">
            {LISTING_TYPE_LABELS.SERVICE}
          </span>
        )}

        {/* Sold and reserved stay on the board, stamped: evidence
            the marketplace is used. The photo fades, in colour, so
            the stamp is what the eye lands on. */}
        {listing.status !== "AVAILABLE" && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="stamp">{statusLabel(listing.status, listing.type)}</span>
          </span>
        )}
      </div>

      {/* gap-1 is inside a component, where the spacing is a
          relationship between three lines of one block rather than
          a gap between page groups. */}
      <div className="flex flex-col gap-1 p-3">
        <p className="truncate text-sm leading-snug font-semibold sm:text-base">
          {listing.title}
        </p>
        <CardPrice listing={listing} />
        <ListingMeta
          layout="split"
          category={listing.category.name}
          condition={listing.condition}
          postedAt={listing.createdAt}
        />
      </div>
    </>
  );
}
