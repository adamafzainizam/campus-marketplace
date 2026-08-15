#!/usr/bin/env node
/**
 * Applies pending migrations — except on preview deployments.
 *
 * The problem this exists to stop:
 *
 * The build script used to open with a bare `prisma migrate deploy`, and Vercel
 * runs the build for *every* deployment, including the preview it creates for
 * each pull request. With one `DATABASE_URL` shared across environments, that
 * means **opening a PR applies its migration to the production database** —
 * before review, before merge, and before anyone has agreed the change is
 * right.
 *
 * This was not theoretical. Production was found carrying `otherCategory`,
 * `quantity` and `halalStatus` from two pull requests that were still open.
 * Nothing broke, because all three were additive and nullable-or-defaulted —
 * but a rename or a drop would have hit the live database the moment the
 * branch was pushed, and an abandoned PR leaves columns behind that nothing
 * will ever remove.
 *
 * So: preview deployments skip migrations entirely. Production still applies
 * them, which is the behaviour that made putting this in the build script
 * right in the first place (Known Gotchas #32: Vercel never applies migrations
 * on its own, and `prisma generate` succeeding is not evidence the database is
 * in sync).
 *
 * `VERCEL_ENV` is set by Vercel to "production", "preview", or "development".
 * It is unset when running locally, where `npm run build` against a
 * development database is harmless and occasionally useful.
 *
 * The complete fix has a second half that lives in the Vercel dashboard rather
 * than here: give the Preview environment its own `DATABASE_URL` pointing at
 * the Neon `development` branch, so previews cannot reach production at all.
 * This script makes that a defence in depth rather than the only thing
 * standing between a pull request and the live database.
 */

import { spawnSync } from "node:child_process";

const env = process.env.VERCEL_ENV;

if (env === "preview") {
  console.log(
    "Preview deployment — skipping `prisma migrate deploy`.\n" +
      "A pull request must not change the database it is being reviewed against.",
  );
  process.exit(0);
}

console.log(
  env
    ? `VERCEL_ENV=${env} — applying migrations.`
    : "No VERCEL_ENV (local build) — applying migrations.",
);

const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  shell: false,
});

if (result.error) {
  console.error("Could not run prisma migrate deploy:", result.error.message);
  process.exit(1);
}

// Propagate the real exit code. A failed migration must fail the build —
// deploying code against a database that lacks its columns is worse than not
// deploying at all.
process.exit(result.status ?? 1);
