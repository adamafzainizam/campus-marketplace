/**
 * Tests for the image-upload rules.
 *
 * Run with `npm test`. Note the import below uses a relative path with an
 * explicit `.ts` extension rather than the `@/lib/...` alias used everywhere
 * else in this codebase: `node --test` does not read tsconfig `paths`, so the
 * alias fails at runtime with ERR_MODULE_NOT_FOUND. Same reason extensions
 * can't be omitted.
 *
 * Several cases here are regression tests for bugs that were live and shipped
 * before being caught in review — they are marked inline, and should not be
 * "tidied away" as redundant.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  MAX_FILE_SIZE,
  MAX_LISTING_PHOTOS,
  buildListingImageKey,
  imageExtensionFor,
  isValidFileSize,
  isValidListingImageKey,
  validateImageKeys,
} from "./upload-constraints.ts";

describe("imageExtensionFor", () => {
  it("maps each allowed content type to its extension", () => {
    assert.equal(imageExtensionFor("image/jpeg"), "jpg");
    assert.equal(imageExtensionFor("image/png"), "png");
    assert.equal(imageExtensionFor("image/webp"), "webp");
  });

  // Regression test for Known Gotchas #15. A bare `ALLOWED[contentType]`
  // truthiness check let every one of these through, because they resolve to
  // functions inherited from Object.prototype — which defeated the image-type
  // restriction entirely. Object.hasOwn is what closes it.
  it("rejects keys inherited from Object.prototype", () => {
    for (const inherited of [
      "constructor",
      "toString",
      "valueOf",
      "hasOwnProperty",
      "isPrototypeOf",
      "propertyIsEnumerable",
      "__proto__",
    ]) {
      assert.equal(
        imageExtensionFor(inherited),
        null,
        `expected "${inherited}" to be rejected`,
      );
    }
  });

  it("rejects content types that are not on the allowlist", () => {
    assert.equal(imageExtensionFor("image/gif"), null);
    assert.equal(imageExtensionFor("image/svg+xml"), null);
    assert.equal(imageExtensionFor("application/pdf"), null);
    assert.equal(imageExtensionFor("text/html"), null);
    assert.equal(imageExtensionFor(""), null);
  });

  it("rejects non-string input", () => {
    assert.equal(imageExtensionFor(undefined), null);
    assert.equal(imageExtensionFor(null), null);
    assert.equal(imageExtensionFor(123), null);
    assert.equal(imageExtensionFor({}), null);
    assert.equal(imageExtensionFor(["image/jpeg"]), null);
  });

  // Documents actual behavior rather than prescribing it: HTTP content types
  // are case-insensitive per RFC 9110, so a client sending "IMAGE/JPEG" is
  // technically within spec and would be turned away. Acceptable today because
  // the only caller is our own browser code, which sends `File.type` (always
  // lowercase) — but this test is where to start if that ever stops being true.
  it("treats content types as case-sensitive", () => {
    assert.equal(imageExtensionFor("IMAGE/JPEG"), null);
    assert.equal(imageExtensionFor("Image/Png"), null);
  });
});

describe("isValidFileSize", () => {
  it("accepts sizes from one byte up to the cap", () => {
    assert.equal(isValidFileSize(1), true);
    assert.equal(isValidFileSize(992 * 1024), true);
    assert.equal(isValidFileSize(MAX_FILE_SIZE), true);
  });

  it("rejects anything over the cap", () => {
    assert.equal(isValidFileSize(MAX_FILE_SIZE + 1), false);
    assert.equal(isValidFileSize(MAX_FILE_SIZE * 2), false);
  });

  it("rejects zero and negative sizes", () => {
    assert.equal(isValidFileSize(0), false);
    assert.equal(isValidFileSize(-1), false);
    assert.equal(isValidFileSize(-MAX_FILE_SIZE), false);
  });

  it("rejects non-integer sizes", () => {
    assert.equal(isValidFileSize(1.5), false);
    assert.equal(isValidFileSize(0.1), false);
  });

  // NaN and Infinity are both `typeof "number"`, so a guard that only checked
  // the type and an upper bound would let Infinity through as "not > MAX"
  // depending on how it was written. Number.isInteger excludes both.
  it("rejects NaN and Infinity", () => {
    assert.equal(isValidFileSize(NaN), false);
    assert.equal(isValidFileSize(Infinity), false);
    assert.equal(isValidFileSize(-Infinity), false);
  });

  it("rejects non-number input", () => {
    assert.equal(isValidFileSize("1000"), false);
    assert.equal(isValidFileSize(undefined), false);
    assert.equal(isValidFileSize(null), false);
    assert.equal(isValidFileSize({}), false);
  });
});

describe("isValidListingImageKey", () => {
  const userId = "clx1234567890abcdefghijkl";

  it("accepts a key it just minted for the same user", () => {
    for (const extension of ["jpg", "png", "webp"]) {
      const key = buildListingImageKey(userId, extension);
      assert.equal(isValidListingImageKey(key, userId), true, key);
    }
  });

  // Regression test for Known Gotchas #17, and the whole reason this function
  // exists: the browser uploads straight to R2 and then reports the key back,
  // so the server never observes the upload. Without this check a user could
  // claim another user's image by simply naming its path.
  it("rejects a key belonging to a different user", () => {
    const key = buildListingImageKey("some-other-user", "jpg");
    assert.equal(isValidListingImageKey(key, userId), false);
  });

  it("rejects path traversal", () => {
    assert.equal(
      isValidListingImageKey(`listings/${userId}/../../etc/passwd`, userId),
      false,
    );
    assert.equal(
      isValidListingImageKey(`listings/${userId}/..%2F..%2Fsecret.jpg`, userId),
      false,
    );
  });

  it("rejects disallowed extensions", () => {
    const uuid = "0ce4a5d2-6a2f-4b13-9f77-5c2e8a1b3d40";
    for (const extension of ["gif", "exe", "sh", "svg", "js", ""]) {
      assert.equal(
        isValidListingImageKey(`listings/${userId}/${uuid}.${extension}`, userId),
        false,
        `expected ".${extension}" to be rejected`,
      );
    }
  });

  it("rejects malformed UUIDs", () => {
    assert.equal(isValidListingImageKey(`listings/${userId}/notauuid.jpg`, userId), false);
    assert.equal(isValidListingImageKey(`listings/${userId}/.jpg`, userId), false);
    // Uppercase hex: crypto.randomUUID() only ever emits lowercase, and the
    // pattern is written to match.
    assert.equal(
      isValidListingImageKey(`listings/${userId}/0CE4A5D2-6A2F-4B13-9F77-5C2E8A1B3D40.jpg`, userId),
      false,
    );
  });

  // The pattern is anchored with ^ and $. Without both, an attacker could wrap
  // a legitimate-looking key in a path of their choosing.
  it("rejects prefix and suffix injection around a valid key", () => {
    const key = buildListingImageKey(userId, "jpg");
    assert.equal(isValidListingImageKey(`evil/${key}`, userId), false);
    assert.equal(isValidListingImageKey(`${key}/evil.sh`, userId), false);
    assert.equal(isValidListingImageKey(`${key}?x=1`, userId), false);
  });

  // In JavaScript a `$` anchor without the `m` flag matches only the very end
  // of input — unlike Python, where `$` also matches before a trailing newline.
  // Worth pinning down, because getting this wrong is a classic way to smuggle
  // a second line past an anchored pattern.
  it("rejects a trailing newline after an otherwise valid key", () => {
    const key = buildListingImageKey(userId, "jpg");
    assert.equal(isValidListingImageKey(`${key}\n`, userId), false);
    assert.equal(isValidListingImageKey(`${key}\nevil`, userId), false);
  });

  it("rejects non-string input", () => {
    assert.equal(isValidListingImageKey(undefined, userId), false);
    assert.equal(isValidListingImageKey(null, userId), false);
    assert.equal(isValidListingImageKey(42, userId), false);
    assert.equal(isValidListingImageKey({}, userId), false);
  });

  // Exercises the module-private escapeRegExp. If the userId were interpolated
  // into the pattern raw, "." would match any character and one user could
  // validate another's key by guessing a userId that differs only where a
  // metacharacter sits.
  it("treats regex metacharacters in the userId literally", () => {
    const key = buildListingImageKey("abc", "jpg");
    assert.equal(isValidListingImageKey(key, "a.c"), false);
    assert.equal(isValidListingImageKey(key, "a+c"), false);
    assert.equal(isValidListingImageKey(key, "a(b)c"), false);
  });

  it("still works for a userId that legitimately contains a metacharacter", () => {
    const key = buildListingImageKey("a.c", "jpg");
    assert.equal(isValidListingImageKey(key, "a.c"), true);
  });
});

describe("buildListingImageKey and isValidListingImageKey agree", () => {
  const userId = "clx1234567890abcdefghijkl";

  // The load-bearing test of this file. The upload route mints keys and the
  // createListing action validates them; Decision Log 2026-08-12 records that
  // these two rules must agree exactly and that duplicating the format is how
  // they silently drift. This makes that guarantee mechanical.
  it("round-trips every allowed extension", () => {
    for (const contentType of ["image/jpeg", "image/png", "image/webp"]) {
      const extension = imageExtensionFor(contentType);
      assert.notEqual(extension, null, `${contentType} should be allowed`);

      const key = buildListingImageKey(userId, extension as string);
      assert.equal(
        isValidListingImageKey(key, userId),
        true,
        `${contentType} produced a key its own validator rejects: ${key}`,
      );
    }
  });

  it("produces the documented key shape", () => {
    const key = buildListingImageKey(userId, "jpg");
    assert.match(key, /^listings\/clx1234567890abcdefghijkl\/[0-9a-f-]{36}\.jpg$/);
  });

  it("produces a distinct key on every call", () => {
    const keys = new Set(
      Array.from({ length: 100 }, () => buildListingImageKey(userId, "jpg")),
    );
    assert.equal(keys.size, 100);
  });
});

describe("validateImageKeys", () => {
  const userId = "user123";
  const key = (n: number) =>
    `listings/${userId}/0000000${n}-0000-4000-8000-000000000000.jpg`;

  it("accepts an empty array — a listing may have no photos", () => {
    assert.deepEqual(validateImageKeys([], userId), { ok: true, value: [] });
  });

  it("accepts up to the cap, preserving order", () => {
    const keys = [key(1), key(2), key(3)];
    assert.deepEqual(validateImageKeys(keys, userId), { ok: true, value: keys });
  });

  it("rejects more than the cap", () => {
    const keys = [key(1), key(2), key(3), key(4)];
    const result = validateImageKeys(keys, userId);

    assert.equal(result.ok, false);
    assert.match(
      result.ok === false ? result.error : "",
      new RegExp(String(MAX_LISTING_PHOTOS)),
    );
  });

  it("rejects anything that is not an array", () => {
    for (const value of [null, undefined, "a", {}, 5]) {
      assert.equal(validateImageKeys(value, userId).ok, false);
    }
  });

  it("rejects a key belonging to another user", () => {
    // Gotcha #17: the browser uploads straight to R2 and then reports the key,
    // so the server never observes the upload and must re-check ownership.
    const theirs =
      "listings/someone-else/00000001-0000-4000-8000-000000000000.jpg";

    assert.equal(validateImageKeys([key(1), theirs], userId).ok, false);
  });

  it("de-duplicates rather than storing the same photo twice", () => {
    const result = validateImageKeys([key(1), key(1), key(2)], userId);

    assert.deepEqual(result.ok === true ? result.value : null, [key(1), key(2)]);
  });

  it("counts duplicates after de-duplication, not before", () => {
    // Four entries, three distinct — this is legal.
    assert.equal(
      validateImageKeys([key(1), key(1), key(2), key(3)], userId).ok,
      true,
    );
  });
});
