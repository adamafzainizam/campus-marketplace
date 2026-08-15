"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isValidListingImageKey } from "@/lib/upload-constraints";
import { consumeRateLimit } from "@/lib/rate-limit";
import { suspensionBlock } from "@/lib/moderation";
import { validateListingInput } from "@/lib/listing-input";
import { validateId } from "@/lib/listing-constraints";
import { validateListingStatus } from "@/lib/listing-status";
import { actionFailed, actionOk, type ActionFailure, type ActionResult } from "@/lib/action-result";

/**
 * Listing creation and seller management.
 *
 * Each is a public POST endpoint, so each independently authenticates,
 * authorizes, rate limits, and validates. Rendering a form behind an auth
 * check is not a security boundary — the request can be sent without going
 * through the UI at all.
 *
 * Failures are returned rather than thrown: Next.js masks thrown errors in
 * production builds, which turns every validation message into an opaque
 * digest. See `src/lib/action-result.ts` and Known Gotchas #35.
 */

/** Only ever returns on failure; a successful create redirects. */
export async function createListing(input: unknown): Promise<ActionFailure> {
  const session = await auth();
  if (!session?.user?.id) {
    return actionFailed("You need to be signed in to post a listing.");
  }
  const userId = session.user.id;

  // Checked on the server, not by hiding the form: this action is a public
  // POST endpoint and can be called without ever loading the page.
  const blocked = await suspensionBlock(userId);
  if (blocked) return blocked;

  const limit = await consumeRateLimit("listing", userId);
  if (!limit.allowed) {
    return actionFailed(
      `Too many listings posted. Try again in ${limit.retryAfter} seconds.`,
    );
  }

  const fields = validateListingInput(input);
  if (!fields.ok) return actionFailed(fields.error);

  // The browser reports this key back to us after uploading straight to R2, so
  // it's user input like everything else here — without this check a user could
  // attach any path they like, including another user's uploaded image.
  const imageKey = (input as Record<string, unknown>).imageKey ?? null;
  if (imageKey !== null && !isValidListingImageKey(imageKey, userId)) {
    return actionFailed("Invalid image reference.");
  }

  const category = await db.category.findUnique({
    where: { id: fields.value.categoryId },
    select: { id: true },
  });
  if (!category) return actionFailed("Invalid category.");

  const listing = await db.listing.create({
    data: {
      ...fields.value,
      sellerId: userId,
      imageUrl: imageKey as string | null,
    },
    select: { id: true },
  });

  redirect(`/?created=${listing.id}`);
}

/**
 * Edits a listing the caller owns.
 *
 * Ownership is enforced by scoping the update itself to `sellerId`, not by a
 * separate read-then-write check — a check that passes and an update that
 * follows are two statements another request can interleave with. `updateMany`
 * with both conditions makes "is it theirs" and "change it" one statement.
 */
export async function updateListing(
  rawListingId: unknown,
  input: unknown,
): Promise<ActionFailure> {
  const session = await auth();
  if (!session?.user?.id) {
    return actionFailed("You need to be signed in to edit a listing.");
  }
  const userId = session.user.id;

  const listingId = validateId(rawListingId, "Listing");
  if (!listingId.ok) return actionFailed(listingId.error);

  const blocked = await suspensionBlock(userId);
  if (blocked) return blocked;

  const limit = await consumeRateLimit("listing", userId);
  if (!limit.allowed) {
    return actionFailed(
      `Too many changes. Try again in ${limit.retryAfter} seconds.`,
    );
  }

  const fields = validateListingInput(input);
  if (!fields.ok) return actionFailed(fields.error);

  const raw = input as Record<string, unknown>;
  // `undefined` means "leave the existing photo alone"; null means remove it.
  // Distinguishing them matters: an edit that doesn't touch the photo must not
  // silently clear it.
  const hasNewImage = Object.hasOwn(raw, "imageKey");
  const imageKey = hasNewImage ? (raw.imageKey ?? null) : undefined;
  if (imageKey != null && !isValidListingImageKey(imageKey, userId)) {
    return actionFailed("Invalid image reference.");
  }

  const category = await db.category.findUnique({
    where: { id: fields.value.categoryId },
    select: { id: true },
  });
  if (!category) return actionFailed("Invalid category.");

  const updated = await db.listing.updateMany({
    where: { id: listingId.value, sellerId: userId },
    data: {
      ...fields.value,
      ...(imageKey === undefined ? {} : { imageUrl: imageKey as string | null }),
    },
  });

  // Zero rows means it doesn't exist or isn't theirs. Deliberately one message
  // for both, so this can't be used to discover other people's listing ids.
  if (updated.count === 0) return actionFailed("Listing not found.");

  revalidatePath("/");
  revalidatePath("/listings/mine");
  revalidatePath(`/listings/${listingId.value}`);

  redirect(`/listings/${listingId.value}?updated=1`);
}

/** Marks a listing available, reserved, sold, or archived. */
export async function setListingStatus(
  rawListingId: unknown,
  rawStatus: unknown,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return actionFailed("You need to be signed in.");
  }
  const userId = session.user.id;

  const listingId = validateId(rawListingId, "Listing");
  if (!listingId.ok) return actionFailed(listingId.error);

  const status = validateListingStatus(rawStatus);
  if (!status.ok) return actionFailed(status.error);

  const blocked = await suspensionBlock(userId);
  if (blocked) return blocked;

  // Same single-statement ownership scoping as updateListing.
  const updated = await db.listing.updateMany({
    where: { id: listingId.value, sellerId: userId },
    data: { status: status.value },
  });
  if (updated.count === 0) return actionFailed("Listing not found.");

  revalidatePath("/");
  revalidatePath("/listings/mine");
  revalidatePath(`/listings/${listingId.value}`);

  return actionOk();
}
