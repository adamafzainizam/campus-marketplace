/**
 * The favicon has to be parseable XML, and nothing else checks that.
 *
 * `next build`, `tsc` and `eslint` all treat `icon.svg` as an opaque asset and
 * copy it through untouched, so a malformed one ships happily. The failure is
 * silent rather than loud: the browser gets no icon, keeps whatever it had
 * cached, and the tab looks merely stale instead of broken — which is how a
 * broken favicon survived a build and three code reviews.
 *
 * The specific trap is that a CSS custom property begins with two hyphens and
 * an XML comment may not contain them, so writing `--accent` in a comment
 * explaining which token a baked colour came from destroys the file. That is a
 * natural sentence to write in exactly the file where it is fatal.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ICON_PATH = "src/app/icon.svg";
const icon = readFileSync(ICON_PATH, "utf8");

describe("the favicon", () => {
  it("has balanced comment delimiters", () => {
    const opens = icon.match(/<!--/g)?.length ?? 0;
    const closes = icon.match(/-->/g)?.length ?? 0;
    assert.equal(opens, closes, `${ICON_PATH}: ${opens} <!-- but ${closes} -->`);
  });

  it("contains no double hyphen inside a comment", () => {
    // The rule XML actually enforces. Checked per comment rather than over the
    // whole file so that a hyphenated attribute value elsewhere can't trip it.
    for (const [, body] of icon.matchAll(/<!--([\s\S]*?)-->/g)) {
      assert.ok(
        !body.includes("--"),
        `${ICON_PATH}: "--" inside a comment makes the file unparseable, so ` +
          `the browser silently shows no icon. Offending comment: ${body.trim()}`,
      );
    }
  });

  it("bakes the accent colour the header mark uses", () => {
    // A favicon cannot read the page's CSS custom properties, so this value is
    // a copy and copies drift. If the accent token changes, this fails and
    // names the file that has to change with it.
    assert.match(icon, /fill="#7544cd"/);
  });
});
