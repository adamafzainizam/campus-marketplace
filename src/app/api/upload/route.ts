import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { auth } from "@/auth";
import { r2 } from "@/lib/r2";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const UPLOAD_URL_TTL_SECONDS = 60;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { contentType, fileSize } = await request.json();

  const extension = ALLOWED_TYPES[contentType];
  if (!extension) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }

  if (typeof fileSize !== "number" || fileSize <= 0 || fileSize > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Invalid file size" }, { status: 400 });
  }

  const key = `listings/${session.user.id}/${randomUUID()}.${extension}`;

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
    ContentLength: fileSize,
  });

  const uploadUrl = await getSignedUrl(r2, command, {
    expiresIn: UPLOAD_URL_TTL_SECONDS,
  });

  return NextResponse.json({ uploadUrl, key });
}
