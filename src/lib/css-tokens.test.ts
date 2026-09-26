import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { declarations, lightDarkArms, rootBlock, rootTokens } from "./css-tokens.ts";

describe("rootBlock", () => {
  test("extracts a brace-matched :root block and stops at its own close", () => {
    const css = `:root {\n  --a: 1px;\n  --b: nested(1, 2);\n}\n.other { --a: 2px; }`;
    assert.equal(rootBlock(css), ":root {\n  --a: 1px;\n  --b: nested(1, 2);\n}");
  });

  test("throws when there is no :root block", () => {
    assert.throws(() => rootBlock(".x { color: red; }"));
  });
});

describe("declarations", () => {
  test("reads custom properties, ignoring comments and collapsing whitespace", () => {
    const block = `:root {\n  /* --old: dead; */\n  --a:   1px  ;\n  --b: light-dark(var(--x),\n    var(--y));\n}`;
    const decls = declarations(block);
    assert.equal(decls.get("--a"), "1px");
    assert.equal(decls.get("--b"), "light-dark(var(--x), var(--y))");
    assert.equal(decls.has("--old"), false);
  });
});

describe("rootTokens", () => {
  test("combines rootBlock and declarations", () => {
    const css = `:root {\n  --surface: light-dark(var(--brand-paper), var(--brand-night));\n}`;
    const tokens = rootTokens(css);
    assert.equal(tokens.get("--surface"), "light-dark(var(--brand-paper), var(--brand-night))");
  });
});

describe("lightDarkArms", () => {
  test("splits the two arms of a light-dark() value", () => {
    assert.deepEqual(lightDarkArms("light-dark(var(--brand-paper), var(--brand-night))"), {
      light: "var(--brand-paper)",
      dark: "var(--brand-night)",
    });
  });

  test("throws on a value that is not light-dark()", () => {
    assert.throws(() => lightDarkArms("var(--brand-paper)"));
  });

  test("throws when there is no top-level comma", () => {
    assert.throws(() => lightDarkArms("light-dark(var(--brand-paper))"));
  });
});
