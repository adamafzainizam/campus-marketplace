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
