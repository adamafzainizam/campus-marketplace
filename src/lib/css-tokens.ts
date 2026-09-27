/**
 * Shared CSS custom-property parsing for the tests that read globals.css
 * directly, so there is one parser rather than design-tokens.test.ts and
 * color-contrast.test.ts each growing their own copy that can drift apart.
 *
 * No DOM, no I/O beyond what the caller passes in — these take a stylesheet
 * string and hand back plain data, same reasoning as color-contrast.ts.
 */

/** The first `:root { ... }` block in a stylesheet, brace-matched so a
 * media query or another rule elsewhere in the file can't be mistaken for
 * the end of it. */
export function rootBlock(source: string): string {
  const start = source.indexOf(":root {");
  if (start < 0) {
    throw new Error('stylesheet has no ":root {" block');
  }
  let depth = 0;
  for (let i = source.indexOf("{", start); i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error("stylesheet: unterminated :root block");
}

/** Custom-property declarations in a block, comments stripped first. */
export function declarations(block: string): Map<string, string> {
  const code = block.replace(/\/\*[\s\S]*?\*\//g, "");
  const out = new Map<string, string>();
  for (const [, name, value] of code.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    out.set(name, value.replace(/\s+/g, " ").trim());
  }
  return out;
}

/** The custom-property declarations in a stylesheet's first :root block. */
export function rootTokens(css: string): Map<string, string> {
  return declarations(rootBlock(css));
}

/**
 * Splits `light-dark(<light>, <dark>)` into its two arms. Matches
 * parenthesis depth rather than the first comma, since an arm is itself a
 * function call (`var(--brand-x)`) that contains no comma here but could in
 * principle.
 */
export function lightDarkArms(value: string): { light: string; dark: string } {
  const match = /^light-dark\((.*)\)$/.exec(value.trim());
  if (!match) {
    throw new Error(`not a light-dark() value: ${value}`);
  }
  const inner = match[1];
  let depth = 0;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) {
      return { light: inner.slice(0, i).trim(), dark: inner.slice(i + 1).trim() };
    }
  }
  throw new Error(`light-dark() value has no top-level comma: ${value}`);
}
