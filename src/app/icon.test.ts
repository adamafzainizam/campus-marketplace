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

import { oklchToLinearSrgb, parseOklch } from "../lib/color-contrast.ts";
import { rootTokens } from "../lib/css-tokens.ts";

const ICON_PATH = "src/app/icon.svg";
const icon = readFileSync(ICON_PATH, "utf8");

/**
 * Linear-light channel (0-1) to an encoded sRGB byte (0-255) — the gamma step
 * `oklchToLinearSrgb` deliberately stops short of, since WCAG's relative
 * luminance is defined on the linear values it already returns. A favicon's
 * `fill="#rrggbb"` is *encoded* sRGB, so this is the other half of the round
 * trip needed to compare the two.
 */
function toSrgbByte(linear: number): number {
  const clamped = Math.min(1, Math.max(0, linear));
  const encoded =
    clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055;
  return Math.round(encoded * 255);
}

function oklchToRgbBytes(value: string): { r: number; g: number; b: number } {
  const { r, g, b } = oklchToLinearSrgb(parseOklch(value));
  return { r: toSrgbByte(r), g: toSrgbByte(g), b: toSrgbByte(b) };
}

function hexToRgbBytes(hex: string): { r: number; g: number; b: number } {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  assert.ok(match, `not a #rrggbb colour: ${hex}`);
  const [, r, g, b] = match;
  return { r: parseInt(r, 16), g: parseInt(g, 16), b: parseInt(b, 16) };
}

const globalsCss = readFileSync("src/app/globals.css", "utf8");
const tokens = rootTokens(globalsCss);
const brand = (name: string): string => {
  const value = tokens.get(name);
  assert.ok(value, `src/app/globals.css :root does not declare ${name}`);
  return value;
};

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

  it("bakes the highlight and ink colours the header mark uses", () => {
    // A favicon cannot read the page's CSS custom properties, so these values
    // are copies and copies drift. Rather than asserting fixed hex literals
    // (which is exactly the kind of copy that can silently go stale), derive
    // the expected bytes from --brand-highlight and --brand-ink in
    // globals.css and require the SVG's fill to match within rounding.
    const fillMatch = /<rect width="32" height="32" rx="3" fill="(#[0-9a-fA-F]{6})"\/>/.exec(icon);
    assert.ok(fillMatch, `${ICON_PATH}: expected a 32x32 rx="3" background rect`);
    const glyphMatch = /<g fill="(#[0-9a-fA-F]{6})"/.exec(icon);
    assert.ok(glyphMatch, `${ICON_PATH}: expected a <g fill="#......">`);

    const expectedFill = oklchToRgbBytes(brand("--brand-highlight"));
    const expectedGlyph = oklchToRgbBytes(brand("--brand-ink"));
    const actualFill = hexToRgbBytes(fillMatch![1]);
    const actualGlyph = hexToRgbBytes(glyphMatch![1]);

    for (const channel of ["r", "g", "b"] as const) {
      assert.ok(
        Math.abs(actualFill[channel] - expectedFill[channel]) <= 1,
        `${ICON_PATH}: fill ${fillMatch![1]} channel ${channel}=${actualFill[channel]}, ` +
          `expected ~${expectedFill[channel]} from --brand-highlight`,
      );
      assert.ok(
        Math.abs(actualGlyph[channel] - expectedGlyph[channel]) <= 1,
        `${ICON_PATH}: glyph ${glyphMatch![1]} channel ${channel}=${actualGlyph[channel]}, ` +
          `expected ~${expectedGlyph[channel]} from --brand-ink`,
      );
    }
  });
});
