import { NextResponse } from "next/server";
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { db } from "@/lib/db";
import { r2 } from "@/lib/r2";
import { LISTING_IMAGE_PREFIX } from "@/lib/upload-constraints";
import {
  MAX_DELETIONS_PER_RUN,
  isCronAuthorized,
  selectOrphans,
  type StoredObject,
} from "@/lib/orphan-cleanup-rules";

/**
 * Deletes R2 objects that no listing references.
 *
 * This closes the second half of security audit finding S2. The browser
 * uploads a photo to R2 *before* `createListing` runs, so abandoning the form
 * leaves an object nothing points at, still publicly readable at its `r2.dev`
 * URL. Rate limiting caps how fast those accumulate; this removes them.
 *
 * Scheduled daily by `vercel.json`. Vercel Cron authenticates by sending
 * `Authorization: Bearer $CRON_SECRET`, which is checked before any work —
 * this route deletes data, so it must not be publicly invokable.
 */

// The route reads the database and the bucket on every call; there is nothing
// here to prerender, and a cached response would make the job a no-op.
export const dynamic = "force-dynamic";

// Listing a bucket and deleting in batches can outlast the default limit once
// there is a real backlog.
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Read what is referenced BEFORE listing the bucket. In this order, a
  // listing created while the job runs is either already in this set or its
  // object is not yet in the listing below — both safe. The reverse order has
  // a window where an object exists but its listing row does not yet, and the
  // job would delete a live image.
  const listings = await db.listing.findMany({
    where: { imageKeys: { isEmpty: false } },
    select: { imageKeys: true },
  });
  // Every key of every listing, not just the cover. Taking only the first
  // would delete photos two and three a day after they were uploaded, leaving
  // the listing showing a broken image with nothing to point at the cause.
  const referencedKeys = new Set(listings.flatMap((listing) => listing.imageKeys));

  const now = new Date();
  const objects: StoredObject[] = [];
  let continuationToken: string | undefined;

  do {
    const page = await r2.send(
      new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET_NAME,
        Prefix: LISTING_IMAGE_PREFIX,
        ContinuationToken: continuationToken,
      }),
    );

    for (const object of page.Contents ?? []) {
      if (object.Key) {
        objects.push({ key: object.Key, lastModified: object.LastModified });
      }
    }

    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    // Stop paginating once there is already more than one run may delete.
  } while (continuationToken && objects.length < MAX_DELETIONS_PER_RUN * 10);

  const orphans = selectOrphans(objects, referencedKeys, now);

  if (orphans.length > 0) {
    // DeleteObjects accepts up to 1000 keys per call; the per-run cap is
    // below that, but batching keeps the contract explicit.
    for (let i = 0; i < orphans.length; i += 1000) {
      await r2.send(
        new DeleteObjectsCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Delete: { Objects: orphans.slice(i, i + 1000).map((Key) => ({ Key })) },
        }),
      );
    }
  }

  return NextResponse.json(
    {
      scanned: objects.length,
      referenced: referencedKeys.size,
      deleted: orphans.length,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
