import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  ALLOWED_DOMAIN,
  ALLOWED_DOMAIN_LABEL,
  isAllowedEmail,
} from "./auth-domain.ts";

describe("isAllowedEmail", () => {
  it("accepts the bare institutional domain", () => {
    assert.equal(isAllowedEmail("someone@gmi.edu.my"), true);
  });

  // GMI accounts are @student.gmi.edu.my — a subdomain, not the bare domain.
  // An exact-match-only check would lock out every student.
  it("accepts subdomains, which is what student accounts actually use", () => {
    assert.equal(isAllowedEmail("someone@student.gmi.edu.my"), true);
    assert.equal(isAllowedEmail("someone@staff.gmi.edu.my"), true);
  });

  // Known Gotchas #4. A `.includes()` check would match all of these, handing
  // an attacker-controlled domain a valid account.
  it("rejects domains that merely contain the allowed one", () => {
    for (const email of [
      "attacker@notgmi.edu.my",
      "attacker@gmi.edu.my.attacker.com",
      "attacker@evil-gmi.edu.my.co",
      "attacker@xgmi.edu.my",
    ]) {
      assert.equal(isAllowedEmail(email), false, `${email} must be rejected`);
    }
  });

  it("rejects an unrelated domain", () => {
    assert.equal(isAllowedEmail("someone@gmail.com"), false);
    assert.equal(isAllowedEmail("someone@example.edu.my"), false);
  });

  // The signIn callback receives whatever the provider sends; a missing or
  // malformed email must not throw, and must not be admitted.
  it("rejects missing, malformed, or non-string input", () => {
    for (const value of [undefined, null, "", "no-at-sign", "@gmi.edu.my", 42, {}]) {
      assert.equal(isAllowedEmail(value as never), false, `${String(value)} must be rejected`);
    }
  });

  it("is case-insensitive, since email domains are", () => {
    assert.equal(isAllowedEmail("someone@GMI.EDU.MY"), true);
    assert.equal(isAllowedEmail("someone@Student.Gmi.Edu.My"), true);
  });

  it("rejects an address with more than one @", () => {
    assert.equal(isAllowedEmail("a@b@gmi.edu.my"), false);
  });
});

describe("ALLOWED_DOMAIN_LABEL", () => {
  // The sign-in page tells the user which account to use. Deriving that copy
  // from the same constant the callback enforces means the UI cannot drift
  // from the rule and promise something that will be rejected.
  it("is the allowed domain, presented as an email suffix", () => {
    assert.equal(ALLOWED_DOMAIN_LABEL, `@${ALLOWED_DOMAIN}`);
  });

  it("describes an address the checker actually accepts", () => {
    assert.equal(isAllowedEmail(`student${ALLOWED_DOMAIN_LABEL}`), true);
  });
});
