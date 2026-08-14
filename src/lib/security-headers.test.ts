import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  GOOGLE_AUTH_ORIGIN,
  buildContentSecurityPolicy,
  buildSecurityHeaders,
} from "./security-headers.ts";

const R2 = "https://pub-5b71e404511d4106af3652de10bcf5da.r2.dev";
const R2_API = "https://ab46c96ecc631434c9ccfd75862cd83c.r2.cloudflarestorage.com";

function directive(csp: string, name: string): string {
  const found = csp
    .split(";")
    .map((part) => part.trim())
    .find((part) => part === name || part.startsWith(`${name} `));
  assert.ok(found !== undefined, `CSP has no "${name}" directive: ${csp}`);
  return found;
}

describe("form-action and the Google sign-in redirect", () => {
  // THE regression test.
  //
  // Auth.js posts the sign-in form to our own origin, and the server answers
  // with a 302 to accounts.google.com. Browsers apply `form-action` to the
  // *redirect target* of a form submission, not just its initial action — so
  // `form-action 'self'` blocks the hop to Google and the button silently does
  // nothing. Introduced by the 2026-08-13 security audit (finding S4) and only
  // noticed at deployment, because an existing session cookie skips the form.
  it("allows the browser to follow the sign-in redirect to Google", () => {
    for (const isDev of [true, false]) {
      const csp = buildContentSecurityPolicy({ isDev, r2ImageOrigin: R2, r2ApiOrigin: R2_API });
      assert.match(
        directive(csp, "form-action"),
        new RegExp(GOOGLE_AUTH_ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
        `form-action must allow ${GOOGLE_AUTH_ORIGIN} (isDev=${isDev})`,
      );
    }
  });

  it("still restricts form submissions to self plus Google, nothing wider", () => {
    const formAction = directive(
      buildContentSecurityPolicy({ isDev: false, r2ImageOrigin: R2, r2ApiOrigin: R2_API }),
      "form-action",
    );
    assert.ok(formAction.includes("'self'"));
    assert.ok(!formAction.includes("*"), "form-action must not use a wildcard");
  });

  it("points at Google's real OAuth origin", () => {
    assert.equal(GOOGLE_AUTH_ORIGIN, "https://accounts.google.com");
  });
});

describe("img-src", () => {
  it("includes the R2 origin when one is configured", () => {
    const csp = buildContentSecurityPolicy({ isDev: false, r2ImageOrigin: R2, r2ApiOrigin: R2_API });
    assert.ok(directive(csp, "img-src").includes(R2));
  });

  // Fails closed: a missing R2_PUBLIC_URL at build time must not become a
  // wildcard that allows images from anywhere.
  it("blocks remote images rather than allowing all when R2 is unset", () => {
    const imgSrc = directive(
      buildContentSecurityPolicy({ isDev: false, r2ImageOrigin: "", r2ApiOrigin: R2_API }),
      "img-src",
    );
    assert.ok(!imgSrc.includes("*"), "img-src must never fall back to a wildcard");
    assert.ok(!imgSrc.includes("http"), `img-src should have no remote origin: ${imgSrc}`);
  });
});

describe("development-only relaxations stay out of production", () => {
  const prod = buildContentSecurityPolicy({ isDev: false, r2ImageOrigin: R2, r2ApiOrigin: R2_API });
  const dev = buildContentSecurityPolicy({ isDev: true, r2ImageOrigin: R2, r2ApiOrigin: R2_API });

  it("keeps unsafe-eval in dev only", () => {
    assert.ok(dev.includes("'unsafe-eval'"), "React Fast Refresh needs it in dev");
    assert.ok(!prod.includes("'unsafe-eval'"));
  });

  it("keeps localhost websockets in dev only", () => {
    assert.ok(dev.includes("ws://localhost:*"));
    assert.ok(!prod.includes("localhost"));
  });

  it("adds upgrade-insecure-requests in production only", () => {
    assert.ok(prod.includes("upgrade-insecure-requests"));
    assert.ok(!dev.includes("upgrade-insecure-requests"));
  });
});

describe("connect-src", () => {
  it("allows Ably over https and wss in both environments", () => {
    for (const isDev of [true, false]) {
      const connect = directive(
        buildContentSecurityPolicy({ isDev, r2ImageOrigin: R2, r2ApiOrigin: R2_API }),
        "connect-src",
      );
      for (const origin of [
        "https://*.ably.io",
        "wss://*.ably.io",
        "https://*.ably-realtime.com",
        "wss://*.ably-realtime.com",
      ]) {
        assert.ok(connect.includes(origin), `connect-src missing ${origin} (isDev=${isDev})`);
      }
    }
  });
});

describe("buildSecurityHeaders", () => {
  const keysOf = (isDev: boolean) =>
    buildSecurityHeaders({ isDev, r2ImageOrigin: R2, r2ApiOrigin: R2_API }).map((h) => h.key);

  it("sets the five always-on headers", () => {
    const keys = keysOf(false);
    for (const key of [
      "Content-Security-Policy",
      "X-Frame-Options",
      "X-Content-Type-Options",
      "Referrer-Policy",
      "Permissions-Policy",
    ]) {
      assert.ok(keys.includes(key), `missing ${key}`);
    }
  });

  // Sending HSTS from a local http:// dev server would pin localhost to https
  // in the browser and break every other project on the machine.
  it("sends HSTS in production only", () => {
    assert.ok(keysOf(false).includes("Strict-Transport-Security"));
    assert.ok(!keysOf(true).includes("Strict-Transport-Security"));
  });

  it("gives every header a non-empty value", () => {
    for (const header of buildSecurityHeaders({ isDev: false, r2ImageOrigin: R2, r2ApiOrigin: R2_API })) {
      assert.ok(header.value.length > 0, `${header.key} has an empty value`);
    }
  });
});

describe("connect-src and the browser upload to R2", () => {
  // THE regression test for the second CSP outage.
  //
  // The browser PUTs the photo straight to R2's S3 API endpoint, which is a
  // different host from the r2.dev origin that serves images. connect-src
  // listed only 'self' and Ably, so the request was blocked before it left the
  // browser — surfacing as "Could not reach image storage", which reads like a
  // network problem and sent debugging to CORS instead. Same origin as the
  // form-action outage: the 2026-08-13 audit added the CSP, and nothing
  // re-exercised the upload path for two days.
  it("allows the upload endpoint, which is not the image-serving origin", () => {
    for (const isDev of [true, false]) {
      const connect = directive(
        buildContentSecurityPolicy({ isDev, r2ImageOrigin: R2, r2ApiOrigin: R2_API }),
        "connect-src",
      );
      assert.ok(
        connect.includes(R2_API),
        `connect-src must allow the R2 API origin (isDev=${isDev}): ${connect}`,
      );
    }
  });

  it("does not confuse the two R2 origins", () => {
    assert.notEqual(R2, R2_API, "the serving and upload origins are different hosts");
    const csp = buildContentSecurityPolicy({
      isDev: false,
      r2ImageOrigin: R2,
      r2ApiOrigin: R2_API,
    });
    // The upload host has no business serving images, and vice versa.
    assert.ok(!directive(csp, "img-src").includes(R2_API));
    assert.ok(!directive(csp, "connect-src").includes(R2));
  });

  // Same fail-closed rule as img-src: a missing R2_ACCOUNT_ID at build time
  // must not widen the policy.
  it("omits the origin rather than widening when R2 is unconfigured", () => {
    const connect = directive(
      buildContentSecurityPolicy({ isDev: false, r2ImageOrigin: "", r2ApiOrigin: "" }),
      "connect-src",
    );
    assert.ok(!connect.includes("cloudflarestorage"), connect);
    assert.ok(!connect.includes(" *"), `connect-src must not fall back to a wildcard: ${connect}`);
  });
});
