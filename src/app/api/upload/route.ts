import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { auth } from "@/auth";
import { r2 } from "@/lib/r2";
import {
  buildListingImageKey,
  imageExtensionFor,
  isValidFileSize,
} from "@/lib/upload-constraints";
import { consumeRateLimit } from "@/lib/rate-limit";

// Long enough that a 5MB photo on a slow mobile connection can finish before
// the link expires — a mid-upload expiry surfaces as an opaque 403. The window
// is still short, and the URL is locked to one exact key, size and content type,
// so a longer TTL doesn't widen what it can be used for.
const UPLOAD_URL_TTL_SECONDS = 300;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limited before any work is done. R2's free tier is 10GB and
  // Cloudflare has no hard spending cap (Known Gotchas #8), so an unbounded
  // mint endpoint is a direct route to a bill: this caps a single account at
  // roughly 100MB/hour instead of unlimited.
  const limit = await consumeRateLimit("upload", session.user.id);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many uploads. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body" }, { status: 400 });
  }

  const { contentType, fileSize } = (body ?? {}) as {
    contentType?: unknown;
    fileSize?: unknown;
  };

  const extension = imageExtensionFor(contentType);
  if (!extension) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }

  if (!isValidFileSize(fileSize)) {
    return NextResponse.json({ error: "Invalid file size" }, { status: 400 });
  }

  const key = buildListingImageKey(session.user.id, extension);

  // ContentLength is signed into the URL, so R2 rejects (403) any upload whose
  // body size doesn't match what we approved here — verified against the live
  // bucket, see AGENTS.md Known Gotchas.
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType as string,
    ContentLength: fileSize,
  });

  const uploadUrl = await getSignedUrl(r2, command, {
    expiresIn: UPLOAD_URL_TTL_SECONDS,
  });

  return NextResponse.json({ uploadUrl, key });
}
