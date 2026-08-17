import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getCategories } from "@/lib/categories";
import { getImageUrl } from "@/lib/r2";
import { priceInputValue } from "@/lib/listing-labels";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ListingForm } from "@/app/listings/new/ListingForm";

export const metadata: Metadata = { title: "Edit listing" };

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=/listings/${id}/edit`);
  }

  const [listing, categories] = await Promise.all([
    db.listing.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        condition: true,
        type: true,
        rentalPeriod: true,
        serviceRate: true,
        categoryId: true,
        otherCategory: true,
        quantity: true,
        halalStatus: true,
        imageKeys: true,
        sellerId: true,
      },
    }),
    getCategories(),
  ]);

  // Deliberately the same 404 for "doesn't exist" and "isn't yours": telling
  // the two apart would confirm which listing ids exist. The server action
  // re-checks ownership regardless — this page is not the security boundary.
  if (!listing || listing.sellerId !== session.user.id) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-6 sm:px-6 sm:py-10">
      <Breadcrumbs
        items={[
          { label: "My listings", href: "/listings/mine" },
          { label: listing.title },
        ]}
      />
      <h1 className="mb-6">Edit listing</h1>

      <ListingForm
        categories={categories}
        listing={{
          id: listing.id,
          title: listing.title,
          description: listing.description,
          // Decimal to string: the value must never pass through a float,
          // which is why the column is Decimal(10,2) in the first place.
          // Not `.toString()` directly — that drops trailing zeros, so a
          // listing priced at ten cents opened its own edit form showing 0.1.
          price: priceInputValue(listing.price),
          condition: listing.condition,
          otherCategory: listing.otherCategory,
          quantity: listing.quantity,
          halalStatus: listing.halalStatus,
          type: listing.type,
          rentalPeriod: listing.rentalPeriod,
          serviceRate: listing.serviceRate,
          categoryId: listing.categoryId,
          imageKeys: listing.imageKeys,
        }}
        existingPhotos={listing.imageKeys.map((key) => ({
          key,
          url: getImageUrl(key),
        }))}
      />
    </div>
  );
}
