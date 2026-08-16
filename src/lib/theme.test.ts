import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  THEME_ATTRIBUTE,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
  isTheme,
  nextTheme,
} from "./theme.ts";

describe("nextTheme", () => {
  it("alternates", () => {
    assert.equal(nextTheme("light"), "dark");
    assert.equal(nextTheme("dark"), "light");
  });

  it("returns to where it started after two presses", () => {
    assert.equal(nextTheme(nextTheme("light")), "light");
  });
});

describe("isTheme", () => {
  it("accepts the two themes", () => {
    assert.ok(isTheme("light"));
    assert.ok(isTheme("dark"));
  });

  // localStorage is user-writable and survives across deploys, so a value
  // from an older version of this site — or from a person editing it — must
  // not reach the attribute.
  it("rejects anything else", () => {
    for (const value of ["system", "", "DARK", null, undefined, 0, {}]) {
      assert.ok(!isTheme(value), `accepted ${JSON.stringify(value)}`);
    }
  });
});

describe("the init script", () => {
  // The script runs as text inside the document; nothing type-checks it, so
  // these assertions are the only thing keeping it agreeing with the module
  // the button imports.
  it("uses the same storage key the button writes", () => {
    assert.ok(THEME_INIT_SCRIPT.includes(JSON.stringify(THEME_STORAGE_KEY)));
  });

  it("sets the same attribute the stylesheet reads", () => {
    assert.ok(THEME_INIT_SCRIPT.includes(JSON.stringify(THEME_ATTRIBUTE)));
  });

  // A throwing script in <head> blocks rendering. Private-mode Safari has
  // historically thrown on localStorage access, and the cost of being wrong
  // about that is a blank page rather than a wrong colour.
  it("cannot throw its way into a blank page", () => {
    assert.match(THEME_INIT_SCRIPT, /try\s*\{/);
    assert.match(THEME_INIT_SCRIPT, /catch/);
  });

  // It ships inside <script dangerouslySetInnerHTML>. A literal </script>
  // would close the tag early; there is no reason for one to appear.
  it("contains nothing that would close its own tag", () => {
    assert.ok(!/<\/script/i.test(THEME_INIT_SCRIPT));
  });

  it("is one expression with no imports, since it runs before any bundle", () => {
    assert.ok(!THEME_INIT_SCRIPT.includes("import"));
    assert.ok(!THEME_INIT_SCRIPT.includes("require("));
  });
});

describe("THEME_ATTRIBUTE", () => {
  // The pair above proves the script and the button agree on the attribute
  // name. Neither of them is the thing that gives that name meaning: the
  // stylesheet is, since it's the only place `data-theme` is turned into a
  // `color-scheme` and, from there, into every token on the page. Renaming
  // this constant (or the CSS selectors, independently) would leave the
  // script and the button still agreeing with *each other* while the button
  // silently stops doing anything — tsc, eslint and the rest of this suite
  // all stay green, because nothing else reads the CSS as data. This is the
  // one check standing between that rename and a shipped no-op button.
  const css = readFileSync("src/app/globals.css", "utf8");

  it("is the attribute the stylesheet actually switches on", () => {
    const light = new RegExp(
      `:root\\[${THEME_ATTRIBUTE}="light"\\]\\s*\\{[^}]*color-scheme:\\s*light`,
    );
    const dark = new RegExp(
      `:root\\[${THEME_ATTRIBUTE}="dark"\\]\\s*\\{[^}]*color-scheme:\\s*dark`,
    );
    assert.match(
      css,
      light,
      `globals.css has no :root[${THEME_ATTRIBUTE}="light"] rule setting color-scheme — THEME_ATTRIBUTE and the stylesheet have drifted`,
    );
    assert.match(
      css,
      dark,
      `globals.css has no :root[${THEME_ATTRIBUTE}="dark"] rule setting color-scheme — THEME_ATTRIBUTE and the stylesheet have drifted`,
    );
  });
});
