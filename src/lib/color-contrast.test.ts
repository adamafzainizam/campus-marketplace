import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  contrastRatio,
  parseOklch,
  relativeLuminance,
} from "./color-contrast.ts";

describe("parseOklch", () => {
  test("reads lightness as a fraction, chroma and hue as given", () => {
    assert.deepEqual(parseOklch("oklch(52% 0.20 295)"), {
      l: 0.52,
      c: 0.2,
      h: 295,
    });
  });

  test("accepts a unitless lightness", () => {
    assert.deepEqual(parseOklch("oklch(0.52 0.20 295)"), {
      l: 0.52,
      c: 0.2,
      h: 295,
    });
  });

  test("rejects anything that is not an oklch colour", () => {
    assert.throws(() => parseOklch("#ffffff"));
    assert.throws(() => parseOklch("rgb(0,0,0)"));
  });
});

describe("relativeLuminance", () => {
  // Anchors the whole conversion chain. If these two are right, the OKLab
  // matrices are wired correctly; if they drift, everything downstream lies.
  test("white is 1 and black is 0", () => {
    assert.ok(Math.abs(relativeLuminance("oklch(100% 0 0)") - 1) < 0.01);
    assert.ok(Math.abs(relativeLuminance("oklch(0% 0 0)") - 0) < 0.01);
  });

  test("mid grey sits between them", () => {
    const mid = relativeLuminance("oklch(50% 0 0)");
    assert.ok(mid > 0.1 && mid < 0.35, `mid grey luminance was ${mid}`);
  });
});

describe("contrastRatio", () => {
  test("black on white is 21:1", () => {
    const ratio = contrastRatio("oklch(0% 0 0)", "oklch(100% 0 0)");
    assert.ok(Math.abs(ratio - 21) < 0.5, `expected ~21, got ${ratio}`);
  });

  test("a colour against itself is 1:1", () => {
    assert.ok(
      Math.abs(contrastRatio("oklch(52% 0.20 295)", "oklch(52% 0.20 295)") - 1) <
        0.01,
    );
  });

  test("is symmetric", () => {
    const a = contrastRatio("oklch(20% 0 0)", "oklch(95% 0 0)");
    const b = contrastRatio("oklch(95% 0 0)", "oklch(20% 0 0)");
    assert.ok(Math.abs(a - b) < 0.001);
  });
});

describe("the palette actually shipping", () => {
  // Read from globals.css rather than copied here. A copy was used before and
  // it can drift: retune a primitive, forget the test, and the test keeps
  // certifying the old colour. Reading the file means the numbers checked are
  // the numbers shipped.
  const css = readFileSync("src/app/globals.css", "utf8");
  const brand = new Map<string, string>();
  for (const [, name, value] of css.matchAll(/(--brand-[\w-]+)\s*:\s*(oklch\([^)]*\))\s*;/g)) {
    brand.set(name, value);
  }
  const colour = (name: string): string => {
    const value = brand.get(`--brand-${name}`);
    assert.ok(value, `globals.css declares no --brand-${name}`);
    return value;
  };

  // [what it is, foreground primitive, background primitive, minimum ratio]
  // 4.5 is WCAG AA for text; 3 is AA for non-text UI boundaries (1.4.11).
  const pairs: Array<[string, string, string, number]> = [
    ["light: text on the page", "ink", "paper", 4.5],
    ["light: text on a card", "ink", "card", 4.5],
    ["light: text on a sunken well", "ink", "paper-sunken", 4.5],
    ["light: secondary text on the page", "ink-2", "paper", 4.5],
    ["light: secondary text on a sunken well", "ink-2", "paper-sunken", 4.5],
    ["light: tertiary text on the page", "ink-3", "paper", 4.5],
    ["light: tertiary text on a card", "ink-3", "card", 4.5],
    ["light: tertiary text on a sunken well", "ink-3", "paper-sunken", 4.5],
    ["light: ink on a highlight fill", "ink", "highlight", 4.5],
    ["light: primary button label (yellow on ink)", "highlight", "ink", 4.5],
    ["light: focus ring against the page", "ink", "paper", 3],
    ["light: control border against a card", "ink", "card", 3],
    ["light: success text on its notice", "success-day", "success-subtle-day", 4.5],
    ["light: danger text on its notice", "danger-day", "danger-subtle-day", 4.5],
    ["light: danger text on a card", "danger-day", "card", 4.5],
    ["dark: text on the page", "snow", "night", 4.5],
    ["dark: text on a card", "snow", "night-card", 4.5],
    ["dark: text on a sunken well", "snow", "night-sunken", 4.5],
    ["dark: secondary text on a card", "snow-2", "night-card", 4.5],
    ["dark: tertiary text on the page", "snow-3", "night", 4.5],
    ["dark: tertiary text on a card", "snow-3", "night-card", 4.5],
    ["dark: tertiary text on a sunken well", "snow-3", "night-sunken", 4.5],
    ["dark: primary button label (ink on yellow)", "ink", "highlight", 4.5],
    ["dark: link text on the page", "highlight", "night", 4.5],
    ["dark: link text on a card", "highlight", "night-card", 4.5],
    ["dark: focus ring against the page", "highlight", "night", 3],
    ["dark: control border against a card", "night-control", "night-card", 3],
    ["dark: success text on its notice", "success-night", "success-subtle-night", 4.5],
    ["dark: danger text on its notice", "danger-night", "danger-subtle-night", 4.5],
    ["dark: danger text on a card", "danger-night", "night-card", 4.5],
  ];

  for (const [label, fg, bg, min] of pairs) {
    test(label, () => {
      const ratio = contrastRatio(colour(fg), colour(bg));
      assert.ok(ratio >= min, `${label}: ${ratio.toFixed(2)}:1, needs ${min}:1`);
    });
  }

  test("yellow on the light page fails, which is why it is never text in light mode", () => {
    // Documents the rule in the spec. If this ever passes, the highlight has
    // been darkened enough to read as text, and the rule can be revisited.
    assert.ok(contrastRatio(colour("highlight"), colour("paper")) < 3);
  });
});
