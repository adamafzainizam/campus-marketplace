/**
 * Every field the server validates must actually be sent by the form.
 *
 * This exists because services were unpostable from the day they shipped.
 * `serviceRate` was held in form state, rendered as a `<select>`, validated
 * carefully on the server — and never added to the object the form submits.
 * The server saw `undefined` and answered "Choose what the price is per." for
 * every attempt, which reads like a validation quirk rather than a field that
 * never left the browser.
 *
 * Nothing caught it, and the reason generalises (Known Gotchas #42): this
 * suite covers pure modules and never compiles a component, so
 * `validateServiceRate` had thorough unit tests while its only real caller
 * silently disagreed with it. Unit-testing both halves of a contract proves
 * nothing about whether they are wired together.
 *
 * So this test reads the two files as text and compares them. That is blunt,
 * and a renamed variable will fail it — which is the correct outcome, because
 * a renamed field is exactly when the two sides drift apart again. There is no
 * component-test framework here and adding one is out of scope (Decision Log
 * 2026-08-12), so a source-level check is what is available and it is worth
 * more than the nothing that preceded it.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SERVER = "src/lib/listing-input.ts";
const FORM = "src/app/listings/new/ListingForm.tsx";

const server = readFileSync(SERVER, "utf8");
const form = readFileSync(FORM, "utf8");

/** Field names the server reads off the submitted payload. */
function validatedFieldNames(source: string): string[] {
  return [...new Set(Array.from(source.matchAll(/raw\.(\w+)/g), (m) => m[1]))].sort();
}

/** The body of the form's `const fields = { … }` literal. */
function submittedFields(source: string): string {
  const start = source.indexOf("const fields = {");
  assert.notEqual(start, -1, `no "const fields = {" found in ${FORM}`);
  const end = source.indexOf("};", start);
  assert.notEqual(end, -1, `unterminated fields object in ${FORM}`);
  return source.slice(start, end);
}

describe("the form sends every field the server validates", () => {
  it("finds fields on both sides", () => {
    // Guards the test itself: if either pattern stops matching, the assertion
    // below would pass vacuously and this file would be worse than useless.
    assert.ok(validatedFieldNames(server).length >= 5);
    assert.ok(submittedFields(form).length > 0);
  });

  it("omits none of them", () => {
    const sent = submittedFields(form);
    const missing = validatedFieldNames(server).filter(
      (name) => !new RegExp(`\\b${name}\\b`).test(sent),
    );

    assert.deepEqual(
      missing,
      [],
      `${FORM} never sends ${missing.join(", ")}, so the server sees undefined ` +
        `and rejects the submission with a message about a field the person ` +
        `did fill in.`,
    );
  });
});
