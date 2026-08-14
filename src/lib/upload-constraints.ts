/**
 * Single source of truth for image-upload rules.
 *
 * Both `/api/upload` (which mints object keys) and the `createListing` server
 * action (which has to trust a key the browser hands back) read from here, so
 * the two can't drift apart on what counts as a valid upload.
 */

const ALLOWED_IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type AllowedImageType = keyof typeof ALLOWED_IMAGE_TYPES;

export const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Every object this app writes to R2 lives under this prefix. The orphan
 * cleanup job reads it from here so the job can never be pointed at a wider
 * part of the bucket than the part this app owns.
 */
export const LISTING_IMAGE_PREFIX = "listings/";

/**
 * Resolves a content type to its file extension, or null if it isn't allowed.
 *
 * Uses `Object.hasOwn` rather than a plain `ALLOWED_IMAGE_TYPES[contentType]`
 * lookup: inherited keys like "constructor" and "toString" resolve to truthy
 * functions off Object.prototype, which would sail through a bare truthiness
 * check and defeat the allowlist entirely.
 */
export function imageExtensionFor(contentType: unknown): string | null {
  if (typeof contentType !== "string") return null;
  if (!Object.hasOwn(ALLOWED_IMAGE_TYPES, contentType)) return null;
  return ALLOWED_IMAGE_TYPES[contentType as AllowedImageType];
}

export function isValidFileSize(fileSize: unknown): fileSize is number {
  return (
    typeof fileSize === "number" &&
    Number.isInteger(fileSize) &&
    fileSize > 0 &&
    fileSize <= MAX_FILE_SIZE
  );
}

export function buildListingImageKey(userId: string, extension: string): string {
  return `listings/${userId}/${crypto.randomUUID()}.${extension}`;
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const EXTENSIONS = Object.values(ALLOWED_IMAGE_TYPES).join("|");

/**
 * Confirms an object key is one this user could actually have been issued.
 *
 * The upload route scopes every key to the uploader's id, but the browser is
 * what reports the key back at listing-creation time — so without this check a
 * user could claim any path they like, including another user's image.
 */
export function isValidListingImageKey(key: unknown, userId: string): key is string {
  if (typeof key !== "string") return false;
  const pattern = new RegExp(`^listings/${escapeRegExp(userId)}/${UUID}\\.(${EXTENSIONS})$`);
  return pattern.test(key);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
