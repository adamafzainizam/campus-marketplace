import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { safeInternalPath } from "./safe-redirect.ts";

describe("safeInternalPath", () => {
  it("keeps an ordinary site-relative path", () => {
    assert.equal(safeInternalPath("/listings/new"), "/listings/new");
    assert.equal(safeInternalPath("/messages/abc123"), "/messages/abc123");
    assert.equal(safeInternalPath("/"), "/");
  });

  it("preserves a query string and fragment", () => {
    assert.equal(safeInternalPath("/?category=textbooks"), "/?category=textbooks");
    assert.equal(safeInternalPath("/listings/x#photos"), "/listings/x#photos");
  });

  // The value arrives on the query string. Echoing it back unchecked would
  // make the sign-in page an open redirect: a link to
  // /signin?callbackUrl=https://evil.example bounces a user who has just
  // authenticated straight off-site, with the credibility of our domain.
  it("refuses an absolute URL to another site", () => {
    for (const value of [
      "https://evil.example",
      "http://evil.example/path",
      "HTTPS://EVIL.EXAMPLE",
    ]) {
      assert.equal(safeInternalPath(value), "/", `${value} must not be honoured`);
    }
  });

  // The subtle one: "//evil.example" is protocol-relative. It starts with "/",
  // so a naive startsWith("/") check lets it through, and the browser treats it
  // as an absolute URL to another host.
  it("refuses a protocol-relative URL", () => {
    assert.equal(safeInternalPath("//evil.example"), "/");
    assert.equal(safeInternalPath("//evil.example/path"), "/");
    assert.equal(safeInternalPath("/\\evil.example"), "/");
    assert.equal(safeInternalPath("//"), "/");
  });

  it("refuses a scheme-bearing value that is not http", () => {
    assert.equal(safeInternalPath("javascript:alert(1)"), "/");
    assert.equal(safeInternalPath("data:text/html,<script>"), "/");
  });

  it("refuses a bare or relative path with no leading slash", () => {
    assert.equal(safeInternalPath("listings/new"), "/");
    assert.equal(safeInternalPath("../admin"), "/");
  });

  it("falls back to the root for missing or non-string input", () => {
    for (const value of [undefined, null, "", 42, {}, []]) {
      assert.equal(safeInternalPath(value as never), "/");
    }
  });

  it("ignores leading or trailing whitespace used to smuggle a scheme", () => {
    assert.equal(safeInternalPath("  https://evil.example"), "/");
    assert.equal(safeInternalPath("\t//evil.example"), "/");
    assert.equal(safeInternalPath("\n/listings/new"), "/listings/new");
  });
});
