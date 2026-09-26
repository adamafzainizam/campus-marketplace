/**
 * The colour system has two layers, and this is what keeps it that way.
 *
 * Literal colours live only in `--brand-*` primitives. Every semantic token
 * (surface, text, line, action, highlight, focus...) is written in terms of
 * primitives. That is the property that makes swapping in another palette,
 * GMI's if the Institute approves, an edit to one block instead of a hunt
 * through the file. A semantic token with a literal in it would still render
 * correctly, which is exactly why nothing but a test would notice.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { rootTokens } from "./css-tokens.ts";

const CSS_PATH = "src/app/globals.css";
const css = readFileSync(CSS_PATH, "utf8");

const SEMANTIC_COLOURS = [
  "--surface",
  "--surface-sunken",
  "--surface-raised",
  "--text",
  "--text-secondary",
  "--text-tertiary",
  "--line",
  "--control-line",
  "--shadow-color",
  "--action",
  "--action-contrast",
  "--highlight",
  "--on-highlight",
  "--link",
  "--link-decoration",
  "--focus",
  "--success",
  "--success-subtle",
  "--danger",
  "--danger-subtle",
];

const LITERAL = /oklch\(|rgba?\(|hsla?\(|#[0-9a-fA-F]{3,8}\b/;

const tokens = rootTokens(css);

describe("the colour tokens", () => {
  it("declares every brand primitive as one plain oklch() literal", () => {
    const brand = [...tokens].filter(([name]) => name.startsWith("--brand-"));
    assert.ok(brand.length >= 10, `expected the primitives block, found ${brand.length}`);
    for (const [name, value] of brand) {
      assert.match(value, /^oklch\([^()]*\)$/, `${name} should be a single oklch() literal, got: ${value}`);
    }
  });

  it("declares every semantic colour token", () => {
    for (const name of SEMANTIC_COLOURS) {
      assert.ok(tokens.has(name), `${CSS_PATH} :root does not declare ${name}`);
    }
  });

  it("writes semantic tokens only in terms of brand primitives", () => {
    for (const name of SEMANTIC_COLOURS) {
      const value = tokens.get(name) ?? "";
      assert.ok(!LITERAL.test(value), `${name} contains a literal colour (${value}); move it into a --brand-* primitive`);
      assert.ok(value.includes("var(--brand-"), `${name} does not reference any --brand-* primitive: ${value}`);
    }
  });
});

describe("the retired vocabulary", () => {
  it("leaves no accent, border or material tokens in the stylesheet", () => {
    for (const retired of ["--accent", "--border", "--material-", "--color-line-strong", ".badge-accent"]) {
      assert.ok(!css.includes(retired), `${CSS_PATH} still mentions ${retired}`);
    }
  });

  it("leaves no accent utilities in any component", () => {
    const files = (readdirSync("src", { recursive: true }) as string[])
      .filter((f) => f.endsWith(".tsx"))
      .map((f) => join("src", f));
    const pattern = /\b(?:text|bg|border|badge|ring|outline|fill|stroke|from|to|via)-accent\b|var\(--accent/;
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      assert.ok(!pattern.test(source), `${file} still uses the retired accent vocabulary`);
    }
  });

  it("leaves no retired custom-property references in any component", () => {
    // Class-name utilities (bg-accent etc.) are caught above, but a retired
    // token can also be spelled directly, inside a Tailwind arbitrary value
    // (`border-[var(--border)]`) — that form skips the utility-name pattern
    // entirely, which is exactly how these survived the first migration pass.
    const files = (readdirSync("src", { recursive: true }) as string[])
      .filter((f) => f.endsWith(".tsx"))
      .map((f) => join("src", f));
    const pattern = /var\(--border\b|var\(--material-|var\(--accent\b/;
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      assert.ok(!pattern.test(source), `${file} still references a retired custom property`);
    }
  });
});
