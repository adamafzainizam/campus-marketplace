import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Relative import with an explicit extension: `node --test` resolves at
// runtime and reads neither tsconfig `paths` nor extensionless specifiers.
// See Known Gotchas #21 and #23.
import {
  AFFILIATION_DISCLAIMER,
  formatEffectiveDate,
  findLegalDocument,
  LEGAL_CONTACT_EMAIL,
  LEGAL_DOCUMENTS,
  LEGAL_EFFECTIVE_DATE,
  legalPath,
} from "./legal.ts";

describe("LEGAL_DOCUMENTS", () => {
  it("lists every document the footer promises", () => {
    const slugs = LEGAL_DOCUMENTS.map((doc) => doc.slug);
    assert.deepEqual(slugs, [
      "terms",
      "privacy",
      "acceptable-use",
      "disclaimer",
    ]);
  });

  it("has no duplicate slugs", () => {
    const slugs = LEGAL_DOCUMENTS.map((doc) => doc.slug);
    assert.equal(new Set(slugs).size, slugs.length);
  });

  it("gives every document a title and a summary", () => {
    for (const doc of LEGAL_DOCUMENTS) {
      assert.ok(doc.title.length > 0, `${doc.slug} has no title`);
      assert.ok(doc.summary.length > 0, `${doc.slug} has no summary`);
    }
  });

  it("uses url-safe slugs, since they become routes", () => {
    for (const doc of LEGAL_DOCUMENTS) {
      assert.match(doc.slug, /^[a-z][a-z-]*[a-z]$/, `${doc.slug} is not url-safe`);
    }
  });
});

describe("legalPath", () => {
  it("builds a route under /legal", () => {
    assert.equal(legalPath("terms"), "/legal/terms");
    assert.equal(legalPath("acceptable-use"), "/legal/acceptable-use");
  });

  it("builds a path for every declared document", () => {
    // If a document is ever added without a corresponding page, this at least
    // guarantees the link shape is right; the page's existence is checked by
    // the build, which fails on a missing route only when something links to it.
    for (const doc of LEGAL_DOCUMENTS) {
      assert.equal(legalPath(doc.slug), `/legal/${doc.slug}`);
    }
  });
});

describe("findLegalDocument", () => {
  it("finds a real document", () => {
    assert.equal(findLegalDocument("privacy")?.title, "Privacy Policy");
  });

  it("returns undefined for an unknown slug", () => {
    assert.equal(findLegalDocument("cookies"), undefined);
  });

  it("returns undefined for non-string input", () => {
    // A route parameter is user input whatever the type signature claims.
    for (const input of [null, undefined, 42, {}, [], true]) {
      assert.equal(findLegalDocument(input), undefined);
    }
  });

  it("is not fooled by inherited object properties", () => {
    // The prototype-chain bypass from Known Gotchas #15, checked here too
    // because this lookup also takes an arbitrary string from a URL.
    for (const key of ["constructor", "toString", "valueOf", "hasOwnProperty"]) {
      assert.equal(findLegalDocument(key), undefined);
    }
  });
});

describe("formatEffectiveDate", () => {
  it("renders day, spelled-out month, then year", () => {
    assert.equal(formatEffectiveDate("2026-08-15"), "15 August 2026");
  });

  it("does not vary with the server's locale or timezone", () => {
    // Rendered on a server whose locale is whatever the platform gives it. A
    // date in a legal document should not read differently per region, and an
    // ambiguous 08/09/2026 is two different dates depending on the reader.
    assert.equal(formatEffectiveDate("2026-01-01"), "1 January 2026");
    assert.equal(formatEffectiveDate("2026-12-31"), "31 December 2026");
  });

  it("does not slip a day across the date line", () => {
    // Parsed and formatted as UTC. Without that, a bare `new Date("2026-08-15")`
    // formatted in a negative-offset timezone renders as the 14th.
    assert.equal(formatEffectiveDate("2026-08-15"), "15 August 2026");
    assert.equal(formatEffectiveDate("2026-03-01"), "1 March 2026");
  });

  it("falls back to the raw value rather than rendering 'Invalid Date'", () => {
    assert.equal(formatEffectiveDate("not-a-date"), "not-a-date");
  });

  it("defaults to the declared effective date", () => {
    assert.equal(formatEffectiveDate(), formatEffectiveDate(LEGAL_EFFECTIVE_DATE));
  });
});

describe("constants", () => {
  it("declares the effective date in ISO form", () => {
    assert.match(LEGAL_EFFECTIVE_DATE, /^\d{4}-\d{2}-\d{2}$/);
    assert.notEqual(formatEffectiveDate(LEGAL_EFFECTIVE_DATE), LEGAL_EFFECTIVE_DATE);
  });

  it("provides a contact address, since the PDPA requires a route to one", () => {
    assert.match(LEGAL_CONTACT_EMAIL, /^[^@\s]+@[^@\s]+\.[^@\s]+$/);
  });

  it("states the disclaimer in the negative, naming the institute", () => {
    // The sentence has one job: correcting the impression created by the site's
    // own name. Both halves are load-bearing, so both are asserted.
    assert.match(AFFILIATION_DISCLAIMER, /not affiliated with/i);
    assert.match(AFFILIATION_DISCLAIMER, /German-Malaysian Institute/);
  });
});
