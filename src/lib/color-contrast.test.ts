import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  contrastRatio,
  meetsAA,
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

describe("the accent tokens actually shipping", () => {
  // These are the values from the design spec. If somebody retunes the
  // accent later and breaks contrast, this fails rather than shipping.
  const lightSurface = "oklch(99.2% 0.002 265)";
  const darkSurface = "oklch(17.5% 0.007 265)";

  test("light: button label on the accent fill meets AA", () => {
    assert.ok(
      meetsAA("oklch(99% 0 0)", "oklch(52% 0.20 295)"),
      `ratio was ${contrastRatio("oklch(99% 0 0)", "oklch(52% 0.20 295)")}`,
    );
  });

  test("light: accent text on the page surface meets AA", () => {
    assert.ok(
      meetsAA("oklch(52% 0.20 295)", lightSurface),
      `ratio was ${contrastRatio("oklch(52% 0.20 295)", lightSurface)}`,
    );
  });

  test("dark: button label on the accent fill meets AA", () => {
    assert.ok(
      meetsAA("oklch(16% 0.01 295)", "oklch(72% 0.17 295)"),
      `ratio was ${contrastRatio("oklch(16% 0.01 295)", "oklch(72% 0.17 295)")}`,
    );
  });

  test("dark: accent text on the page surface meets AA", () => {
    assert.ok(
      meetsAA("oklch(72% 0.17 295)", darkSurface),
      `ratio was ${contrastRatio("oklch(72% 0.17 295)", darkSurface)}`,
    );
  });
});
