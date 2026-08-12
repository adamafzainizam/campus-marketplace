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

const UPLOAD_URL_TTL_SECONDS = 60;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
