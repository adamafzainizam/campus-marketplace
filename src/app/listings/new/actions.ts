"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isValidListingImageKey } from "@/lib/upload-constraints";
import { consumeRateLimit } from "@/lib/rate-limit";
import {
  validateCondition,
  validateDescription,
  validateId,
  validatePrice,
  validateTitle,
} from "@/lib/listing-constraints";

/**
 * A server action is a public POST endpoint — rendering the form behind an
 * auth check is not a security boundary, because the request can be sent
 * without going through the UI. So the input type is `unknown`, and every
 * field is validated before use rather than trusted because the form produced
 * it.
 */
export async function createListing(input: unknown) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  const userId = session.user.id;

  const limit = await consumeRateLimit("listing", userId);
  if (!limit.allowed) {
    throw new Error(
      `Too many listings posted. Try again in ${limit.retryAfter} seconds.`,
    );
  }

  if (typeof input !== "object" || input === null) {
    throw new Error("Invalid request.");
  }
  const raw = input as Record<string, unknown>;

  const title = validateTitle(raw.title);
  if (!title.ok) throw new Error(title.error);

  const description = validateDescription(raw.description);
  if (!description.ok) throw new Error(description.error);

  const price = validatePrice(raw.price);
  if (!price.ok) throw new Error(price.error);

  const condition = validateCondition(raw.condition);
  if (!condition.ok) throw new Error(condition.error);

  const categoryId = validateId(raw.categoryId, "Category");
  if (!categoryId.ok) throw new Error(categoryId.error);

  // The browser reports this key back to us after uploading straight to R2, so
  // it's user input like everything else here — without this check a user could
  // attach any path they like, including another user's uploaded image.
  const imageKey = raw.imageKey ?? null;
  if (imageKey !== null && !isValidListingImageKey(imageKey, userId)) {
    throw new Error("Invalid image reference.");
  }

  const category = await db.category.findUnique({
    where: { id: categoryId.value },
    select: { id: true },
  });
  if (!category) {
    throw new Error("Invalid category.");
  }

  const listing = await db.listing.create({
    data: {
      title: title.value,
      description: description.value,
      price: price.value,
      condition: condition.value,
      categoryId: category.id,
      sellerId: userId,
      imageUrl: imageKey,
    },
    select: { id: true },
  });

  redirect(`/?created=${listing.id}`);
}
