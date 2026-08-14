"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isValidListingImageKey } from "@/lib/upload-constraints";
import { consumeRateLimit } from "@/lib/rate-limit";
import { actionFailed, type ActionFailure } from "@/lib/action-result";
import {
  validateCondition,
  validateDescription,
  validateId,
  validateListingType,
  validatePrice,
  validateRentalPeriod,
  validateTitle,
} from "@/lib/listing-constraints";

/**
 * Returns an {@link ActionFailure} for anything the user can fix, and only
 * redirects on success — it never returns a success value. Failures are
 * returned rather than thrown because Next.js masks thrown errors in
 * production builds, which turned every validation message into an opaque
 * digest. See `src/lib/action-result.ts`.
 *
 * A server action is a public POST endpoint — rendering the form behind an
 * auth check is not a security boundary, because the request can be sent
 * without going through the UI. So the input type is `unknown`, and every
 * field is validated before use rather than trusted because the form produced
 * it.
 */
export async function createListing(input: unknown): Promise<ActionFailure> {
  const session = await auth();
  if (!session?.user?.id) {
    return actionFailed("You need to be signed in to post a listing.");
  }
  const userId = session.user.id;

  const limit = await consumeRateLimit("listing", userId);
  if (!limit.allowed) {
    return actionFailed(
      `Too many listings posted. Try again in ${limit.retryAfter} seconds.`,
    );
  }

  if (typeof input !== "object" || input === null) {
    return actionFailed("Invalid request.");
  }
  const raw = input as Record<string, unknown>;

  const title = validateTitle(raw.title);
  if (!title.ok) return actionFailed(title.error);

  const description = validateDescription(raw.description);
  if (!description.ok) return actionFailed(description.error);

  const price = validatePrice(raw.price);
  if (!price.ok) return actionFailed(price.error);

  const condition = validateCondition(raw.condition);
  if (!condition.ok) return actionFailed(condition.error);

  const categoryId = validateId(raw.categoryId, "Category");
  if (!categoryId.ok) return actionFailed(categoryId.error);

  const type = validateListingType(raw.type);
  if (!type.ok) return actionFailed(type.error);

  // Contextual on the type: required for a rental, discarded for a sale, so a
  // crafted payload can't leave a sale rendering as "RM 20.00 / week".
  const rentalPeriod = validateRentalPeriod(raw.rentalPeriod, type.value);
  if (!rentalPeriod.ok) return actionFailed(rentalPeriod.error);

  // The browser reports this key back to us after uploading straight to R2, so
  // it's user input like everything else here — without this check a user could
  // attach any path they like, including another user's uploaded image.
  const imageKey = raw.imageKey ?? null;
  if (imageKey !== null && !isValidListingImageKey(imageKey, userId)) {
    return actionFailed("Invalid image reference.");
  }

  const category = await db.category.findUnique({
    where: { id: categoryId.value },
    select: { id: true },
  });
  if (!category) {
    return actionFailed("Invalid category.");
  }

  const listing = await db.listing.create({
    data: {
      title: title.value,
      description: description.value,
      price: price.value,
      condition: condition.value,
      type: type.value,
      rentalPeriod: rentalPeriod.value,
      categoryId: category.id,
      sellerId: userId,
      imageUrl: imageKey,
    },
    select: { id: true },
  });

  redirect(`/?created=${listing.id}`);
}
