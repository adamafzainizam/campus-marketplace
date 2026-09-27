import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  currentSection,
  menuButtonLabel,
  MENU_ITEMS,
  SECTION_LABELS,
  type SectionKey,
} from "./site-sections.ts";

describe("currentSection", () => {
  const cases: Array<[string, SectionKey | null]> = [
    ["/", "browse"],
    ["/listings/cmsvs9e7s0000sj9yo835p86h", "browse"],
    ["/listings/mine", "mine"],
    ["/listings/cmsvs9e7s0000sj9yo835p86h/edit", "mine"],
    ["/listings/new", "post"],
    ["/messages", "messages"],
    ["/messages/cmabc123", "messages"],
    ["/signin", "signin"],
    ["/legal", "legal"],
    ["/legal/terms", "legal"],
    ["/admin", "admin"],
    ["/admin/reports/abc", "admin"],
    ["/somewhere-unknown", null],
  ];
  for (const [path, expected] of cases) {
    it(`maps ${path} to ${expected}`, () => {
      assert.equal(currentSection(path), expected);
    });
  }

  it("ignores a trailing slash", () => {
    assert.equal(currentSection("/messages/"), "messages");
    assert.equal(currentSection("/listings/mine/"), "mine");
  });

  it("does not treat a prefix of a word as the section", () => {
    // "/messagesx" is not the messages section; nor is "/legalese".
    assert.equal(currentSection("/messagesx"), null);
    assert.equal(currentSection("/legalese"), null);
  });
});

describe("the menu", () => {
  it("lists Browse, My listings and Messages, in that order", () => {
    assert.deepEqual(
      MENU_ITEMS.map((item) => item.key),
      ["browse", "mine", "messages"],
    );
  });

  it("only offers My listings to someone signed in", () => {
    const mine = MENU_ITEMS.find((item) => item.key === "mine");
    assert.equal(mine?.signedInOnly, true);
    for (const item of MENU_ITEMS.filter((i) => i.key !== "mine")) {
      assert.equal(item.signedInOnly, false, `${item.key} should be public`);
    }
  });

  it("marks each item as current on its own page", () => {
    // Ties the hrefs to the section rules: a renamed route that the rules
    // no longer recognise would leave the menu unable to mark itself.
    for (const item of MENU_ITEMS) {
      assert.equal(currentSection(item.href), item.key, `${item.href}`);
    }
  });
});

describe("menuButtonLabel", () => {
  it("names the section you are in", () => {
    assert.equal(menuButtonLabel("mine"), SECTION_LABELS.mine);
    assert.equal(menuButtonLabel("messages"), SECTION_LABELS.messages);
  });

  it("says Menu on the post page and on unknown pages", () => {
    // On /listings/new the primary button already reads "Post a listing";
    // a second copy in the menu button would overflow a 360px header.
    assert.equal(menuButtonLabel("post"), "Menu");
    assert.equal(menuButtonLabel(null), "Menu");
  });

  it("uses no dash characters in any label", () => {
    for (const label of [...Object.values(SECTION_LABELS), menuButtonLabel(null)]) {
      assert.ok(!/[—–]/.test(label), label);
    }
  });
});
