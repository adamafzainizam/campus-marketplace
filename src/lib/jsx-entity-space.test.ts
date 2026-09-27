import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Guards against a compiler quirk that silently deleted words' spacing on the
 * live legal pages (Known Gotchas #54).
 *
 * Next's SWC compiler drops the leading space of a JSX text run when that run
 * contains an HTML entity (`&mdash;`, `&rsquo;`, …), even one several lines
 * later. So `<strong>payment</strong> of any kind &mdash; there` rendered as
 * "paymentof any kind", while the same line without an entity kept its space.
 * Nothing warns; the source looks right; only the served HTML is wrong.
 *
 * The rule: text that follows a closing tag or a `}` and contains an entity
 * must start with an explicit `{" "}` rather than a literal space.
 */
const HAZARD =
  /(<\/[A-Za-z][\w.]*>|\})[ \t]+[^\s<{][^<{]*?&[a-zA-Z#0-9]+;[^<{]*?(?=[<{])/g;

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((path) => path.endsWith(".tsx"))
    .map((path) => join(dir, path));
}

describe("JSX text with an HTML entity keeps its leading space", () => {
  const files = tsxFiles(join(import.meta.dirname, ".."));

  it("scans a real set of files", () => {
    // Guards the guard: a wrong root directory would scan nothing and pass.
    assert.ok(files.length > 30, `only ${files.length} .tsx files found`);
  });

  it("never relies on a literal space before entity-bearing text", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(HAZARD)) {
        const line = source.slice(0, match.index).split("\n").length;
        offenders.push(`${file}:${line}: ${match[0].split("\n")[0]}`);
      }
    }
    assert.deepEqual(
      offenders,
      [],
      `use {" "} instead of a literal space here:\n${offenders.join("\n")}`,
    );
  });

  it("recognises the pattern it guards against", () => {
    const broken = `<strong>x</strong> of any kind &mdash; there<br/>`;
    const fixed = `<strong>x</strong>{" "}of any kind &mdash; there<br/>`;
    assert.equal([...broken.matchAll(HAZARD)].length, 1);
    assert.equal([...fixed.matchAll(HAZARD)].length, 0);
  });
});
