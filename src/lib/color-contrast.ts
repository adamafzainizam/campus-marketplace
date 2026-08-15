/**
 * OKLCH → sRGB → WCAG contrast, as pure functions.
 *
 * The design tokens are authored in OKLCH because equal numeric lightness
 * steps look equal to the eye (Decision Log 2026-08-15). The cost is that you
 * cannot eyeball whether a pair meets contrast requirements, so this converts
 * properly and measures.
 *
 * The conversion is the standard one: OKLCH → OKLab → LMS → linear sRGB.
 * WCAG's relative luminance is defined on *linearised* sRGB, which is exactly
 * what the last step produces, so no gamma round-trip is needed.
 *
 * Deliberately no DOM and no I/O, so it runs in the fast offline suite.
 */

export type Oklch = { l: number; c: number; h: number };

const OKLCH = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\s*\)$/i;

/** Lightness comes back as a 0–1 fraction whether it was written `52%` or `0.52`. */
export function parseOklch(value: string): Oklch {
  const match = OKLCH.exec(value.trim());
  if (!match) {
    throw new Error(`Not an oklch() colour: ${value}`);
  }

  const [, rawL, percent, rawC, rawH] = match;
  const l = Number(rawL) / (percent === "%" ? 100 : 1);

  return { l, c: Number(rawC), h: Number(rawH) };
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

export function oklchToLinearSrgb(color: Oklch): {
  r: number;
  g: number;
  b: number;
} {
  const hRad = (color.h * Math.PI) / 180;
  const a = color.c * Math.cos(hRad);
  const b = color.c * Math.sin(hRad);

  const lCube = color.l + 0.3963377774 * a + 0.2158037573 * b;
  const mCube = color.l - 0.1055613458 * a - 0.0638541728 * b;
  const sCube = color.l - 0.0894841775 * a - 1.291485548 * b;

  const long = lCube ** 3;
  const medium = mCube ** 3;
  const short = sCube ** 3;

  return {
    r: clamp01(
      4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short,
    ),
    g: clamp01(
      -1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short,
    ),
    b: clamp01(
      -0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short,
    ),
  };
}

export function relativeLuminance(value: string): number {
  const { r, g, b } = oklchToLinearSrgb(parseOklch(value));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);

  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG 2 AA: 4.5:1 for body text, 3:1 for large text. */
export function meetsAA(a: string, b: string, large = false): boolean {
  return contrastRatio(a, b) >= (large ? 3 : 4.5);
}
