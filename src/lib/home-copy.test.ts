import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  EMPTY_NO_MATCHES,
  EMPTY_NOTHING_POSTED,
  HOME_HEADLINE,
  HOME_TAGLINE,
  SEARCH_PLACEHOLDER,
} from "./home-copy.ts";

const everything = [
  HOME_HEADLINE,
  HOME_TAGLINE,
  SEARCH_PLACEHOLDER,
  EMPTY_NOTHING_POSTED.title,
  EMPTY_NOTHING_POSTED.body,
  EMPTY_NO_MATCHES.title,
  EMPTY_NO_MATCHES.body,
];

describe("voice rules", () => {
  test("nothing shouts", () => {
    // Cheap enthusiasm is one of the clearest AI tells.
    for (const line of everything) {
      assert.ok(!line.includes("!"), `exclamation mark in: ${line}`);
    }
  });

  test("no string is empty or left as a placeholder", () => {
    for (const line of everything) {
      assert.ok(line.trim().length > 0);
      assert.ok(!/TODO|TBD|Lorem/i.test(line), `placeholder text in: ${line}`);
    }
  });
});

describe("the pitch", () => {
  test("the tagline names the thing the site is an alternative to", () => {
    // The product's whole argument. If this sentence stops mentioning the
    // group chat, the home page has stopped making the case.
    assert.match(HOME_TAGLINE, /group chat/i);
  });

  test("the headline says what you can do, not what the site is", () => {
    assert.match(HOME_HEADLINE, /buy/i);
    assert.match(HOME_HEADLINE, /sell/i);
    assert.match(HOME_HEADLINE, /rent/i);
  });
});

describe("the search placeholder", () => {
  test("suggests real things before the joke", () => {
    // Two real items first so it reads as a hint rather than a gag, and so
    // the joke still lands when it truncates on a narrow phone.
    assert.match(SEARCH_PLACEHOLDER, /^Books/);
    assert.match(SEARCH_PLACEHOLDER, /time machine/i);
  });

  test("stays short enough to survive a phone", () => {
    assert.ok(
      SEARCH_PLACEHOLDER.length <= 40,
      `placeholder is ${SEARCH_PLACEHOLDER.length} characters`,
    );
  });

  test("jokes about the impossible, never the prohibited", () => {
    // A gag about a banned item would undercut the Acceptable Use Policy.
    const forbidden = /exam|assignment|answer|weapon|drug|alcohol|vape/i;
    assert.ok(!forbidden.test(SEARCH_PLACEHOLDER));
  });
});

describe("empty states", () => {
  test("the two states say different things", () => {
    // "Nothing posted yet" and "nothing matches your filter" are different
    // problems and the same sentence for both helps neither.
    assert.notEqual(EMPTY_NOTHING_POSTED.body, EMPTY_NO_MATCHES.body);
  });

  test("possibility gets personality", () => {
    assert.match(EMPTY_NOTHING_POSTED.body, /group chat/i);
  });

  test("friction stays plain", () => {
    // Somebody whose search just failed is not the audience for a joke.
    assert.ok(!/group chat/i.test(EMPTY_NO_MATCHES.body));
    assert.match(EMPTY_NO_MATCHES.body, /broader|clear/i);
  });
});
