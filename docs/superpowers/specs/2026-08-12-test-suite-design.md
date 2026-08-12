# Design: First automated test suite

**Date:** 2026-08-12
**Status:** Approved
**Scope:** Test harness + unit tests for `src/lib/upload-constraints.ts`

## Problem

The project names automated tests as a professional habit it exists to demonstrate, but has none. The validation rules in `src/lib/upload-constraints.ts` were verified once with a throwaway script that was then deleted — the exact work a test suite is supposed to preserve.

Two of those rules are security fixes for bugs that were live and shipped (Known Gotchas #15, #17). Nothing currently stops them regressing.

## Constraints

- **No new dependencies.** The project carries a standing no-spend constraint, and every added dependency is also added supply-chain surface. Node 24 runs TypeScript natively, so `node:test` costs nothing.
- **Don't disturb what works.** Prisma wiring in this project is already fragile (Known Gotchas #1, #2). The test setup must not change how any existing file is interpreted.

## Verified facts

Probed against this project on Node v24.19.0 before designing — not assumed:

| Question | Result |
|---|---|
| Does `node --test` type-strip `.ts` here? | Yes, works with zero configuration |
| Does the `@/*` tsconfig alias resolve? | **No** — `ERR_MODULE_NOT_FOUND`. Node ignores tsconfig `paths` |
| Do extensionless imports resolve? | **No** — explicit `.ts` extension required |
| Does glob discovery (`'src/**/*.test.ts'`) work? | Yes |
| Does `--disable-warning=MODULE_TYPELESS_PACKAGE_JSON` silence the typeless-package warning? | Yes, cleanly |

The alias finding is the one that will trip up future work: `@/lib/...` is correct everywhere else in this codebase but fails inside test files.

### Discovered during implementation

Node and TypeScript disagree outright about the `.ts` extension: Node's test runner **requires** it, and `tsc` **rejects** it with `TS5097` unless `allowImportingTsExtensions` is enabled. Satisfying one breaks the other.

Resolved by enabling `allowImportingTsExtensions: true` in `tsconfig.json`. The flag requires `noEmit` or `emitDeclarationOnly`; this project already sets `"noEmit": true`, so it is legal here with no other change. Verified afterwards that `next build` still succeeds and does not strip the flag when it rewrites `tsconfig.json`.

## Design

### Harness

One script in `package.json`:

```json
"test": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test 'src/**/*.test.ts'"
```

The glob means future suites are discovered automatically with no script change.

`--disable-warning` targets exactly one warning code rather than silencing warnings broadly. The alternative — adding `"type": "module"` to `package.json` — was rejected: it removes the warning at its source but re-interprets module resolution for `next.config.ts`, `prisma.config.ts`, `prisma/seed.ts` (under `tsx`), and the Next build, which is real blast radius for a cosmetic gain.

### Test file

`src/lib/upload-constraints.test.ts`, co-located with its subject. Imports via `./upload-constraints.ts` — relative, explicit extension.

Co-location was chosen over a separate `tests/` tree because Next.js only bundles what routes import, so a co-located `.test.ts` is inert in the build; the isolation a separate tree buys is isolation this project doesn't need.

### Coverage

Four `describe` blocks, one per exported function.

**`imageExtensionFor`**
- Three allowed types map to correct extensions
- Prototype-chain bypass returns `null` for `constructor`, `toString`, `valueOf`, `hasOwnProperty`, `__proto__` — regression test for Known Gotchas #15
- Non-string inputs return `null`
- Unlisted types (`image/gif`, `application/pdf`, `text/html`) return `null`
- Casing is significant: `IMAGE/JPEG` returns `null` (documents actual behavior)

**`isValidFileSize`**
- Boundary pair: exactly `MAX_FILE_SIZE` passes, `MAX_FILE_SIZE + 1` fails
- Zero and negatives fail
- Non-integers fail
- `NaN` and `Infinity` fail — both are `typeof "number"` and would pass a naive guard
- Non-number inputs fail

**`isValidListingImageKey`** — the security core, Known Gotchas #17
- Accepts a freshly minted key for the same user
- Rejects another user's key
- Rejects path traversal
- Rejects disallowed extensions
- Rejects malformed UUIDs
- Rejects non-strings
- Regex anchoring: rejects both prefix (`x/listings/...`) and suffix (`.../evil`) injection
- Metacharacter safety: a `userId` of `a.c` must not validate a key built for `abc` — this is what the module-private `escapeRegExp` exists to prevent, and is currently untested

**`buildListingImageKey` × `isValidListingImageKey`**
- Round-trip invariant: any key the minting function produces validates for that same user
- Successive calls produce distinct keys

The round-trip test is the important one. Decision Log 2026-08-12 records that these two rules "must agree exactly, and duplicating the format in two files is how they silently drift." This test makes that guarantee mechanical instead of aspirational.

## Out of scope

Deliberately not covered by this pass, in scope order for future suites:

1. `createListing` validation in `src/app/listings/new/actions.ts` — currently inline in a server action; would need extraction into a pure module first
2. `/api/upload` route handler — needs request/session fixtures
3. `src/lib/listing-labels.ts` — a static lookup map with near-zero logic

## Verification

- `npm test` passes
- `npx tsc --noEmit` clean
- `npx eslint` clean

The test file sits under `src/`, so `tsconfig.json`'s `**/*.ts` include and the ESLint config already cover it without changes.
