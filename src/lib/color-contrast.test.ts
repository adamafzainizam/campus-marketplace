import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  contrastRatio,
  parseOklch,
  relativeLuminance,
} from "./color-contrast.ts";
import { lightDarkArms, rootTokens } from "./css-tokens.ts";

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
  //
  // Pairs are expressed as *semantic* tokens (--text on --surface), not as
  // hand-named primitives (ink on paper) — the old version named the
  // primitives directly, which meant it could stay green even if a semantic
  // token were repointed at the wrong primitive, since nothing tied the pair
  // being tested back to what a component actually uses. Resolving each
  // semantic token through its light-dark() arm to a primitive, the same way
  // the browser does, closes that gap.
  const css = readFileSync("src/app/globals.css", "utf8");
  const tokens = rootTokens(css);

  type Theme = "light" | "dark";

  /** A semantic token's value for one theme, resolved down to its literal
   * oklch() primitive. */
  const resolve = (token: string, theme: Theme): string => {
    const value = tokens.get(token);
    assert.ok(value, `globals.css :root does not declare ${token}`);
    const arm = lightDarkArms(value)[theme];
    const match = /^var\((--[\w-]+)\)$/.exec(arm);
    assert.ok(match, `${token}'s ${theme} arm is not a bare var(--brand-*) reference: ${arm}`);
    const primitiveName = match[1];
    const primitive = tokens.get(primitiveName);
    assert.ok(primitive, `globals.css :root does not declare ${primitiveName}`);
    return primitive;
  };

  // [what it is, theme, foreground token, background token, minimum ratio]
  // 4.5 is WCAG AA for text; 3 is AA for non-text UI boundaries (1.4.11).
  const pairs: Array<[string, Theme, string, string, number]> = [
    ["text on page", "light", "--text", "--surface", 4.5],
    ["text on a card", "light", "--text", "--surface-raised", 4.5],
    ["text on a sunken well", "light", "--text", "--surface-sunken", 4.5],
    ["secondary text on page", "light", "--text-secondary", "--surface", 4.5],
    ["secondary text on a card", "light", "--text-secondary", "--surface-raised", 4.5],
    ["secondary text on a sunken well", "light", "--text-secondary", "--surface-sunken", 4.5],
    ["tertiary text on page", "light", "--text-tertiary", "--surface", 4.5],
    ["tertiary text on a card", "light", "--text-tertiary", "--surface-raised", 4.5],
    ["tertiary text on a sunken well", "light", "--text-tertiary", "--surface-sunken", 4.5],
    ["on-highlight text on the highlight fill", "light", "--on-highlight", "--highlight", 4.5],
    ["primary button label", "light", "--action-contrast", "--action", 4.5],
    ["link text on page", "light", "--link", "--surface", 4.5],
    ["link text on a card", "light", "--link", "--surface-raised", 4.5],
    ["focus ring against the page", "light", "--focus", "--surface", 3],
    ["control border against the page", "light", "--control-line", "--surface", 3],
    ["control border against a card", "light", "--control-line", "--surface-raised", 3],
    ["control border against a sunken well", "light", "--control-line", "--surface-sunken", 3],
    ["success text on its notice", "light", "--success", "--success-subtle", 4.5],
    ["danger text on its notice", "light", "--danger", "--danger-subtle", 4.5],
    ["danger text on a card", "light", "--danger", "--surface-raised", 4.5],

    ["text on page", "dark", "--text", "--surface", 4.5],
    ["text on a card", "dark", "--text", "--surface-raised", 4.5],
    ["text on a sunken well", "dark", "--text", "--surface-sunken", 4.5],
    ["secondary text on page", "dark", "--text-secondary", "--surface", 4.5],
    ["secondary text on a card", "dark", "--text-secondary", "--surface-raised", 4.5],
    ["secondary text on a sunken well", "dark", "--text-secondary", "--surface-sunken", 4.5],
    ["tertiary text on page", "dark", "--text-tertiary", "--surface", 4.5],
    ["tertiary text on a card", "dark", "--text-tertiary", "--surface-raised", 4.5],
    ["tertiary text on a sunken well", "dark", "--text-tertiary", "--surface-sunken", 4.5],
    ["on-highlight text on the highlight fill", "dark", "--on-highlight", "--highlight", 4.5],
    ["primary button label", "dark", "--action-contrast", "--action", 4.5],
    ["link text on page", "dark", "--link", "--surface", 4.5],
    ["link text on a card", "dark", "--link", "--surface-raised", 4.5],
    ["focus ring against the page", "dark", "--focus", "--surface", 3],
    ["control border against the page", "dark", "--control-line", "--surface", 3],
    ["control border against a card", "dark", "--control-line", "--surface-raised", 3],
    ["control border against a sunken well", "dark", "--control-line", "--surface-sunken", 3],
    ["success text on its notice", "dark", "--success", "--success-subtle", 4.5],
    ["danger text on its notice", "dark", "--danger", "--danger-subtle", 4.5],
    ["danger text on a card", "dark", "--danger", "--surface-raised", 4.5],
  ];

  for (const [label, theme, fg, bg, min] of pairs) {
    test(`${theme}: ${label}`, () => {
      const ratio = contrastRatio(resolve(fg, theme), resolve(bg, theme));
      assert.ok(ratio >= min, `${theme}: ${label}: ${ratio.toFixed(2)}:1, needs ${min}:1`);
    });
  }

  test("yellow on the light page fails, which is why it is never text in light mode", () => {
    // Documents the rule in the spec. If this ever passes, the highlight has
    // been darkened enough to read as text, and the rule can be revisited.
    assert.ok(contrastRatio(resolve("--highlight", "light"), resolve("--surface", "light")) < 3);
  });
});
