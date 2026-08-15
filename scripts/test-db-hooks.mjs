/**
 * Test harness for the database-backed suites (`*.db-test.ts`).
 *
 * Registered with `--import`, so this runs before any test module is loaded.
 * That ordering is load-bearing twice over: `src/lib/db.ts` reads
 * `process.env.DATABASE_URL` at module scope when it constructs the Prisma
 * adapter, and the resolve hook has to exist before anything imports `@/...`.
 *
 * Two things make the real `src/lib/conversations.ts` importable here without
 * changing it:
 *
 *   1. `--conditions=react-server` (set in the npm script) makes Node resolve
 *      the `server-only` package to the no-op `empty.js` it already ships
 *      behind that export condition. Nothing is mocked or stripped — Node is
 *      simply told to resolve it the way a server runtime would.
 *   2. The resolve hook below maps `@/*` to `src/*`. Extension resolution is
 *      the part that is easy to get wrong: production code writes `@/lib/db`
 *      with no extension, so a hook that only rewrites the prefix resolves to
 *      a path that does not exist.
 */

import "dotenv/config";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

function refuse(reason) {
  console.error(`\nRefusing to run database tests.\n\n${reason}\n`);
  process.exit(1);
}

// --- Which database may these tests touch? -------------------------------
//
// These tests create and delete rows, so this never falls back to
// DATABASE_URL. Gotcha #39: every standalone script here silently targets
// whatever `.env` says, and a silent default for a destructive operation is
// strictly worse than refusing to run.

const testUrl = process.env.TEST_DATABASE_URL;

if (!testUrl) {
  refuse(
    "TEST_DATABASE_URL is not set.\n" +
      "Point it at the Neon `test` branch. It deliberately does not fall\n" +
      "back to DATABASE_URL, because these tests delete rows.",
  );
}

if (testUrl === process.env.DATABASE_URL) {
  refuse(
    "TEST_DATABASE_URL is identical to DATABASE_URL.\n" +
      "That is the development database, which you browse in a real\n" +
      "browser. Create a separate Neon `test` branch.",
  );
}

// Only the host is shown; the connection string contains a password. The two
// strings differ by a hostname nobody reads carefully, which is why
// scripts/make-admin.ts prints this too.
let host;
try {
  host = new URL(testUrl).host;
} catch {
  refuse("TEST_DATABASE_URL is set but is not a valid connection URL.");
}

process.env.DATABASE_URL = testUrl;
console.log(`Database tests targeting: ${host}`);

// --- Resolve `@/*` to `src/*` --------------------------------------------
//
// npm always runs scripts from the package root, so cwd is the repo root.

const SRC = `${process.cwd()}/src/`;

registerHooks({
  resolve(specifier, context, nextResolve) {
    // Next ships no `exports` field at all, so `next/server` relies on the
    // CommonJS extension resolution that ESM does not do — it fails with
    // ERR_MODULE_NOT_FOUND and a "did you mean next/server.js?" hint. This is
    // why no route handler in this project was testable before. Nothing to do
    // with the react-server condition.
    if (specifier === "next/server") {
      return nextResolve("next/server.js", context);
    }

    if (!specifier.startsWith("@/")) {
      return nextResolve(specifier, context);
    }

    const base = SRC + specifier.slice(2);
    const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`];

    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        return nextResolve(pathToFileURL(candidate).href, context);
      }
    }

    // Fall through to Node's own error, which names the path.
    return nextResolve(pathToFileURL(base).href, context);
  },
});
