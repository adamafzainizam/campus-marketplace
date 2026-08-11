import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getImageUrl } from "@/lib/r2";
import { CONDITION_LABELS } from "@/lib/listing-labels";

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const listing = await db.listing.findUnique({
    where: { id },
    include: { category: true, seller: true },
  });

  if (!listing) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <Link href="/" className="mb-6 inline-block text-sm text-zinc-600 dark:text-zinc-400">
        &larr; Back to listings
      </Link>

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
          <h1 className="text-2xl font-semibold">{listing.title}</h1>
          <p className="text-xl">RM {listing.price.toString()}</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {listing.category.name} &middot; {CONDITION_LABELS[listing.condition]}
          </p>
          <p className="whitespace-pre-wrap">{listing.description}</p>
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            Listed by {listing.seller.name}
          </p>
          {listing.status !== "AVAILABLE" && (
            <p className="text-sm font-medium text-red-600">{listing.status}</p>
          )}
        </div>
      </div>
    </div>
  );
}
