import type { ListingType, RentalPeriod, ServiceRate } from "@/generated/prisma/enums";
import { priceParts } from "@/lib/listing-labels";

/**
 * The price, with its unit de-emphasised — `.text-price` full weight, the
 * "/ week" or "/ session" tail smaller and greyer.
 *
 * Shared by the browse card and `/listings/mine`: both render a grid of
 * prices, and before this was extracted only browse got the split treatment
 * while `/listings/mine` fell back to plain `text-sm text-secondary`, the
 * exact defect `.text-price` exists to fix.
 */
export function CardPrice({
  listing,
}: {
  listing: {
    price: { toString(): string };
    type: ListingType;
    rentalPeriod: RentalPeriod | null;
    serviceRate: ServiceRate | null;
  };
}) {
  const { amount, unit } = priceParts(
    listing.price,
    listing.type,
    listing.rentalPeriod,
    listing.serviceRate,
  );

  return (
    <p className="text-price">
      {amount}
      {unit && <span className="text-price-unit"> {unit}</span>}
    </p>
  );
}
