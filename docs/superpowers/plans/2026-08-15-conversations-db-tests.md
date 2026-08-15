# Conversation Authorization Database Tests — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `src/lib/conversations.ts` — the authorization layer for messaging, currently the only module in `src/lib/` with no test beside it — a database-backed test suite that exercises the real module, and prove the tests are not vacuous by mutation testing.

**Architecture:** A separate test command (`npm run test:db`) runs `node --test` with two flags that make the real module importable: `--conditions=react-server`, which resolves the `server-only` package to the no-op it already ships, and `--import ./scripts/test-db-hooks.mjs`, which registers a resolve hook mapping `@/*` to `src/*`. No production code changes. Fixtures create a run-scoped world (seller, buyer, **stranger**, listing, conversation) against a dedicated Neon `test` branch and tear it down in an `after()` hook.

**Tech Stack:** `node:test` (Node 24.19, native TypeScript type-stripping), Prisma 7.9.1 with `@prisma/adapter-pg`, Neon Postgres. **Zero new dependencies** — consistent with the 2026-08-12 decision to use `node:test` over Vitest/Jest.

**Spec:** `docs/superpowers/specs/2026-08-15-conversations-db-tests-design.md`

## Global Constraints

- **No new dependencies.** The standing no-spend / minimal-dependency constraint. Everything here uses Node built-ins and packages already installed.
- **No production code changes.** `src/lib/conversations.ts` and `src/lib/db.ts` must be byte-identical when this branch merges, except where Task 6 temporarily mutates them and reverts.
- **`npm test` must not change.** It stays at 330 tests, ~0.6s, offline, no `.env` required. Its script in `package.json` is not edited. The `.db-test.ts` suffix is what keeps the suites apart — the existing glob is `src/**/*.test.ts`, which does not match it.
- **Never fall back to `DATABASE_URL`.** The harness reads `TEST_DATABASE_URL` only. Unset means refuse. Identical to `DATABASE_URL` means refuse. These tests delete rows (Gotcha #39).
- **Only the database host is ever printed**, never the connection string — it contains a password. Mirrors `scripts/make-admin.ts`.
- **Test files use `@/` imports.** That is the point of the resolve hook; using relative imports here would defeat it. (Gotchas #21/#23 do not apply under this harness.)
- **Enum values are exact:** `ListingCondition` is `NEW | LIKE_NEW | GOOD | FAIR | WORN`. `ListingStatus` is `AVAILABLE | RESERVED | SOLD | ARCHIVED`.
- **Every task ends with `npx tsc --noEmit` and `npx eslint` clean** before its commit.

## Prerequisite (blocks Task 2 onward, not Task 1)

The Neon `test` branch must exist and `TEST_DATABASE_URL` must be in `.env`.
If the branch was created empty rather than off `development`, apply the schema first:

```bash
( set -a; . ./.env; set +a; DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate deploy )
```

Task 1 is testable without it — its own tests cover the refusal paths.

## File Structure

| File | Responsibility |
|---|---|
| `scripts/test-db-hooks.mjs` (create) | Harness. Loads dotenv, guards + selects the target database, registers the `@/*` resolve hook. Runs via `--import`, before any test module loads. |
| `package.json` (modify) | Adds the `test:db` script. The existing `test` script is untouched. |
| `src/lib/db-test-support.ts` (create) | Fixture builder and teardown. Reusable by the future `/api/upload` and `/api/ably/token` suites. |
| `src/lib/conversations.db-test.ts` (create) | The assertions, one `describe` per exported function. |
| `AGENTS.md` (modify) | Gotchas #21/#23/#24, a new gotcha, Decision Log, env vars, Next Steps. |
| `.env` (modify, gitignored) | `TEST_DATABASE_URL`. Done by the builder, not committed. |

---

### Task 1: The harness

**Files:**
- Create: `scripts/test-db-hooks.mjs`
- Create: `src/lib/harness.db-test.ts` (smoke test; deleted in Task 3 once real tests cover the same ground)
- Modify: `package.json` (scripts block)

**Interfaces:**
- Consumes: nothing.
- Produces: the `npm run test:db` command; a Node environment in which `@/...` specifiers resolve and `server-only` is a no-op; `process.env.DATABASE_URL` set to `TEST_DATABASE_URL` before any module loads.

- [ ] **Step 1: Write the failing smoke test**

Create `src/lib/harness.db-test.ts`. This asserts the two things the harness exists to provide: that a `server-only` module imports, and that `@/` resolves.

```ts
import { test } from "node:test";
import assert from "node:assert/strict";

test("the harness can import a server-only module through the @/ alias", async () => {
  const conversations = await import("@/lib/conversations");

  assert.equal(typeof conversations.getParticipantsIfMember, "function");
  assert.equal(typeof conversations.listInboxFor, "function");
  assert.equal(typeof conversations.getThreadFor, "function");
});

test("the harness points the Prisma client at the test database", () => {
  assert.equal(process.env.DATABASE_URL, process.env.TEST_DATABASE_URL);
  assert.notEqual(process.env.TEST_DATABASE_URL, undefined);
});
```

- [ ] **Step 2: Add the `test:db` script**

In `package.json`, add to `scripts` (leave `test` exactly as it is):

```json
"test:db": "node --conditions=react-server --import ./scripts/test-db-hooks.mjs --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test 'src/**/*.db-test.ts'"
```

`--disable-warning` is for the same reason the existing `test` script carries it (Gotcha #22).

- [ ] **Step 3: Run it to verify it fails**

Run: `npm run test:db`
Expected: FAIL — `Cannot find module './scripts/test-db-hooks.mjs'`.

- [ ] **Step 4: Write the harness**

Create `scripts/test-db-hooks.mjs`:

```js
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
```

- [ ] **Step 5: Verify the refusal paths fire**

Run: `TEST_DATABASE_URL= npm run test:db`
Expected: exits non-zero, prints "TEST_DATABASE_URL is not set."

Run: `TEST_DATABASE_URL="$DATABASE_URL" npm run test:db` — note this needs `DATABASE_URL` exported; if it isn't, source `.env` in a subshell first:
```bash
( set -a; . ./.env; set +a; TEST_DATABASE_URL="$DATABASE_URL" npm run test:db )
```
Expected: exits non-zero, prints "identical to DATABASE_URL".

These two refusals are the guard the whole suite's safety rests on. If either passes silently, stop and fix it before continuing.

- [ ] **Step 6: Run the smoke test for real**

Run: `npm run test:db`
Expected: PASS, 2 tests, and a first line reading `Database tests targeting: <neon-host>`. Confirm the host is the **test** branch, not development.

- [ ] **Step 7: Confirm `npm test` is unaffected**

Run: `npm test`
Expected: 330 tests, 0 fail. The `.db-test.ts` file must **not** appear in the output. If the count changed, the glob is wrong.

- [ ] **Step 8: Type-check and lint**

Run: `npx tsc --noEmit && npx eslint`
Expected: both clean.

- [ ] **Step 9: Commit**

```bash
git add scripts/test-db-hooks.mjs src/lib/harness.db-test.ts package.json
git commit -m "Add a database test harness that can import server-only modules

Runs node --test with --conditions=react-server, which resolves the
server-only package to the no-op it already ships, plus a resolve hook
mapping @/* to src/*. The real src/lib/conversations.ts is therefore
importable without editing it.

Targeting fails closed: TEST_DATABASE_URL only, never a fallback to
DATABASE_URL, and a refusal when the two match. These tests delete rows,
and Gotcha #39 is that scripts here silently target whatever .env says.

npm test is untouched and stays offline at 330 tests; the .db-test.ts
suffix keeps the two suites apart.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Fixtures

**Files:**
- Create: `src/lib/db-test-support.ts`
- Create: `src/lib/db-test-support.db-test.ts`

**Interfaces:**
- Consumes: the Task 1 harness (`@/` resolution, `DATABASE_URL` pointed at the test branch).
- Produces:
  - `createConversationWorld(): Promise<ConversationWorld>`
  - `type ConversationWorld = { prefix: string; sellerId: string; buyerId: string; strangerId: string; categoryId: string; listingId: string; conversationId: string; cleanup: () => Promise<void> }`
  - `addMessage(conversationId: string, senderId: string, body: string, createdAt?: Date): Promise<{ id: string; createdAt: Date }>`
  - `markRead(conversationId: string, userId: string, lastReadAt: Date): Promise<void>`
  - `addSecondConversation(world: ConversationWorld, updatedAt: Date): Promise<string>` — returns the new conversation id
  - `suspend(userId: string): Promise<void>`

- [ ] **Step 1: Write the failing test**

Create `src/lib/db-test-support.db-test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { db } from "@/lib/db";
import { createConversationWorld } from "@/lib/db-test-support";

test("createConversationWorld builds a world and cleanup removes all of it", async () => {
  const world = await createConversationWorld();

  const conversation = await db.conversation.findUnique({
    where: { id: world.conversationId },
    select: { buyerId: true, listing: { select: { sellerId: true } } },
  });

  assert.notEqual(conversation, null);
  assert.equal(conversation?.buyerId, world.buyerId);
  assert.equal(conversation?.listing.sellerId, world.sellerId);
  assert.notEqual(world.strangerId, world.buyerId);
  assert.notEqual(world.strangerId, world.sellerId);

  await world.cleanup();

  assert.equal(
    await db.conversation.findUnique({ where: { id: world.conversationId } }),
    null,
  );
  assert.equal(
    await db.listing.findUnique({ where: { id: world.listingId } }),
    null,
  );
  assert.equal(
    await db.category.findUnique({ where: { id: world.categoryId } }),
    null,
  );
  assert.equal(
    await db.user.count({
      where: { id: { in: [world.sellerId, world.buyerId, world.strangerId] } },
    }),
    0,
  );
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:db`
Expected: FAIL — cannot find module `@/lib/db-test-support`.

- [ ] **Step 3: Write the fixture module**

Create `src/lib/db-test-support.ts`:

```ts
/**
 * Fixtures for the database-backed test suites (`*.db-test.ts`).
 *
 * Not `server-only`: this is deliberately importable by the harness. It is
 * never imported by a route, so Next does not bundle it — the same reasoning
 * that lets `.test.ts` files sit beside the modules they test.
 *
 * Every row is created behind a `randomUUID()` prefix so that repeated or
 * concurrent runs cannot collide on unique columns (`User.email`,
 * `Category.name`, `Category.slug`).
 */

import { randomUUID } from "node:crypto";

import { db } from "@/lib/db";

export type ConversationWorld = {
  prefix: string;
  sellerId: string;
  buyerId: string;
  /** Signed in, participates in nothing, and must therefore see nothing. */
  strangerId: string;
  categoryId: string;
  listingId: string;
  conversationId: string;
  cleanup: () => Promise<void>;
};

export async function createConversationWorld(): Promise<ConversationWorld> {
  const prefix = `dbtest_${randomUUID().replace(/-/g, "")}`;

  const [seller, buyer, stranger] = await Promise.all([
    db.user.create({
      data: { email: `${prefix}.seller@test.invalid`, name: "Test Seller" },
    }),
    db.user.create({
      data: { email: `${prefix}.buyer@test.invalid`, name: "Test Buyer" },
    }),
    db.user.create({
      data: { email: `${prefix}.stranger@test.invalid`, name: "Test Stranger" },
    }),
  ]);

  const category = await db.category.create({
    data: { name: `${prefix} Category`, slug: `${prefix}-category` },
  });

  const listing = await db.listing.create({
    data: {
      title: "Test listing",
      description: "Created by the database test suite.",
      price: "10.00",
      condition: "GOOD",
      sellerId: seller.id,
      categoryId: category.id,
    },
  });

  const conversation = await db.conversation.create({
    data: { listingId: listing.id, buyerId: buyer.id },
  });

  /**
   * Teardown, in the order the schema forces. `Listing`'s relations are
   * `onDelete: Restrict` by deliberate choice, so nothing cascades from the
   * top and every level has to go explicitly. Messages and reads *do* cascade
   * from `Conversation`, so deleting conversations is enough for those.
   *
   * Scoped by `categoryId` rather than by the ids captured here, so that any
   * extra listing or conversation a test creates in this world is cleaned up
   * too without the test having to register it.
   */
  async function cleanup(): Promise<void> {
    await db.conversation.deleteMany({
      where: { listing: { categoryId: category.id } },
    });
    await db.listing.deleteMany({ where: { categoryId: category.id } });
    await db.category.deleteMany({ where: { id: category.id } });
    await db.user.deleteMany({
      where: { id: { in: [seller.id, buyer.id, stranger.id] } },
    });
  }

  return {
    prefix,
    sellerId: seller.id,
    buyerId: buyer.id,
    strangerId: stranger.id,
    categoryId: category.id,
    listingId: listing.id,
    conversationId: conversation.id,
    cleanup,
  };
}

export async function addMessage(
  conversationId: string,
  senderId: string,
  body: string,
  createdAt?: Date,
): Promise<{ id: string; createdAt: Date }> {
  return db.message.create({
    data: { conversationId, senderId, body, ...(createdAt ? { createdAt } : {}) },
    select: { id: true, createdAt: true },
  });
}

export async function markRead(
  conversationId: string,
  userId: string,
  lastReadAt: Date,
): Promise<void> {
  await db.conversationRead.upsert({
    where: { conversationId_userId: { conversationId, userId } },
    create: { conversationId, userId, lastReadAt },
    update: { lastReadAt },
  });
}

/**
 * A second listing and conversation in the same world, with an explicit
 * `updatedAt` so inbox ordering can be asserted deterministically rather than
 * relying on two `now()` values landing in a predictable order.
 */
export async function addSecondConversation(
  world: ConversationWorld,
  updatedAt: Date,
): Promise<string> {
  const listing = await db.listing.create({
    data: {
      title: "Second test listing",
      description: "Created by the database test suite.",
      price: "20.00",
      condition: "GOOD",
      sellerId: world.sellerId,
      categoryId: world.categoryId,
    },
  });

  const conversation = await db.conversation.create({
    data: { listingId: listing.id, buyerId: world.buyerId, updatedAt },
  });

  return conversation.id;
}

export async function suspend(userId: string): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { suspendedAt: new Date(), suspendedReason: "Database test fixture." },
  });
}
```

- [ ] **Step 4: Run the test**

Run: `npm run test:db`
Expected: PASS.

**If `updatedAt` in `addSecondConversation` is rejected by the type-checker** (Prisma may treat `@updatedAt` fields as write-forbidden on create), replace that `db.conversation.create` with a create followed by a raw update, which is unambiguous:

```ts
const conversation = await db.conversation.create({
  data: { listingId: listing.id, buyerId: world.buyerId },
});
await db.$executeRaw`UPDATE conversations SET "updatedAt" = ${updatedAt} WHERE id = ${conversation.id}`;
```

Decide this by running `npx tsc --noEmit` in Step 5, not by guessing.

- [ ] **Step 5: Type-check and lint**

Run: `npx tsc --noEmit && npx eslint`
Expected: both clean. Apply the `$executeRaw` fallback above if `updatedAt` is rejected, then re-run.

- [ ] **Step 6: Confirm the test branch is left clean**

Run:
```bash
( set -a; . ./.env; set +a; DATABASE_URL="$TEST_DATABASE_URL" npx tsx -e 'import "dotenv/config"; import { PrismaClient } from "./src/generated/prisma/client.ts"; import { PrismaPg } from "@prisma/adapter-pg"; const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) }); console.log("leftover users:", await db.user.count({ where: { email: { contains: "test.invalid" } } })); await db.$disconnect();' )
```
Expected: `leftover users: 0`. If not, `cleanup()` has a gap — fix it before building on it.

- [ ] **Step 7: Commit**

```bash
git add src/lib/db-test-support.ts src/lib/db-test-support.db-test.ts
git commit -m "Add self-cleaning fixtures for the conversation database tests

Builds a run-scoped world — seller, buyer, stranger, category, listing,
conversation — behind a randomUUID prefix so repeated runs cannot collide
on User.email or Category.slug.

Teardown is scoped by categoryId rather than by captured ids, so a test
that adds another listing to the world is cleaned up without registering
it. The order is forced by the schema: Listing's relations are Restrict
by deliberate choice, so nothing cascades from the top.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: `getParticipantsIfMember`

**Files:**
- Create: `src/lib/conversations.db-test.ts`
- Delete: `src/lib/harness.db-test.ts` (its coverage is subsumed — this file imports the same module and actually calls it)

**Interfaces:**
- Consumes: `createConversationWorld`, `ConversationWorld` from Task 2.
- Produces: the `describe("getParticipantsIfMember")` block; the `before`/`after` world lifecycle the later tasks add their blocks beside.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/conversations.db-test.ts`:

```ts
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";

import { getParticipantsIfMember } from "@/lib/conversations";
import {
  createConversationWorld,
  type ConversationWorld,
} from "@/lib/db-test-support";

let world: ConversationWorld;

before(async () => {
  world = await createConversationWorld();
});

// Runs even when an assertion above it fails, so a red suite still leaves the
// test branch clean.
after(async () => {
  await world?.cleanup();
});

describe("getParticipantsIfMember", () => {
  test("returns the participants to the buyer", async () => {
    const result = await getParticipantsIfMember(
      world.conversationId,
      world.buyerId,
    );

    assert.deepEqual(result, {
      conversationId: world.conversationId,
      listingId: world.listingId,
      buyerId: world.buyerId,
      sellerId: world.sellerId,
    });
  });

  test("returns the same participants to the seller", async () => {
    const result = await getParticipantsIfMember(
      world.conversationId,
      world.sellerId,
    );

    // The seller is derived from listing.sellerId, not stored on the
    // conversation — this is what proves that derivation is wired correctly.
    assert.equal(result?.sellerId, world.sellerId);
    assert.equal(result?.buyerId, world.buyerId);
  });

  test("returns null to a signed-in stranger", async () => {
    const result = await getParticipantsIfMember(
      world.conversationId,
      world.strangerId,
    );

    assert.equal(result, null);
  });

  test("returns null for a conversation that does not exist", async () => {
    const result = await getParticipantsIfMember(
      "clnonexistentconversation01",
      world.buyerId,
    );

    assert.equal(result, null);
  });

  test("a stranger cannot distinguish 'not yours' from 'does not exist'", async () => {
    // The module's own comment claims callers must not be able to tell these
    // apart, because "this conversation exists but isn't yours" is itself
    // information. Nothing held that claim to account until this test.
    const notMine = await getParticipantsIfMember(
      world.conversationId,
      world.strangerId,
    );
    const missing = await getParticipantsIfMember(
      "clnonexistentconversation01",
      world.strangerId,
    );

    assert.deepEqual(notMine, missing);
  });
});
```

- [ ] **Step 2: Delete the smoke test**

```bash
git rm src/lib/harness.db-test.ts
```

Its two assertions are subsumed: this file imports the same module through `@/`, and Task 1's Step 5 already proved the refusal guards.

- [ ] **Step 3: Run to verify they pass**

Run: `npm run test:db`
Expected: PASS, 6 tests (5 here + the fixture test from Task 2).

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit && npx eslint`
Expected: both clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/conversations.db-test.ts
git commit -m "Test getParticipantsIfMember against a real database

This is the primitive /api/ably/token uses to decide whether to mint a
realtime token for a channel, so it is the check the whole messaging
security model rests on, and nothing tested it automatically.

Includes the indistinguishability assertion the module's own comment
asks for: a stranger must not be able to tell 'not yours' from 'does not
exist', because the difference is itself information.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: `listInboxFor`

**Files:**
- Modify: `src/lib/conversations.db-test.ts` (add a `describe` block)

**Interfaces:**
- Consumes: `world` from Task 3; `addMessage`, `markRead`, `addSecondConversation` from Task 2.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/conversations.db-test.ts`. Extend the import from `@/lib/conversations` to `{ getParticipantsIfMember, listInboxFor }`, and the import from `@/lib/db-test-support` to include `addMessage`, `markRead`, `addSecondConversation`.

```ts
describe("listInboxFor", () => {
  test("returns the conversation to both participants and not to a stranger", async () => {
    const forBuyer = await listInboxFor(world.buyerId);
    const forSeller = await listInboxFor(world.sellerId);
    const forStranger = await listInboxFor(world.strangerId);

    assert.equal(
      forBuyer.some((entry) => entry.id === world.conversationId),
      true,
    );
    assert.equal(
      forSeller.some((entry) => entry.id === world.conversationId),
      true,
    );
    assert.deepEqual(forStranger, []);
  });

  test("names the counterparty from each viewer's perspective", async () => {
    const forBuyer = (await listInboxFor(world.buyerId)).find(
      (entry) => entry.id === world.conversationId,
    );
    const forSeller = (await listInboxFor(world.sellerId)).find(
      (entry) => entry.id === world.conversationId,
    );

    assert.equal(forBuyer?.counterpartyName, "Test Seller");
    assert.equal(forSeller?.counterpartyName, "Test Buyer");
  });

  test("marks a conversation unread when the viewer has never read it", async () => {
    await addMessage(world.conversationId, world.sellerId, "Still available?");

    const entry = (await listInboxFor(world.buyerId)).find(
      (candidate) => candidate.id === world.conversationId,
    );

    assert.equal(entry?.unread, true);
    assert.equal(entry?.lastMessage, "Still available?");
  });

  test("marks it read once lastReadAt is newer than the last message", async () => {
    await markRead(
      world.conversationId,
      world.buyerId,
      new Date(Date.now() + 60_000),
    );

    const entry = (await listInboxFor(world.buyerId)).find(
      (candidate) => candidate.id === world.conversationId,
    );

    assert.equal(entry?.unread, false);
  });

  test("orders conversations by most recent activity first", async () => {
    const newerId = await addSecondConversation(
      world,
      new Date(Date.now() + 120_000),
    );

    const inbox = await listInboxFor(world.buyerId);
    const ids = inbox.map((entry) => entry.id);

    assert.equal(ids[0], newerId);
    assert.ok(ids.indexOf(newerId) < ids.indexOf(world.conversationId));
  });
});
```

- [ ] **Step 2: Run to verify they pass**

Run: `npm run test:db`
Expected: PASS, 11 tests.

Note these tests share one `world` and run in order, so the read-state tests build on each other deliberately — `markRead` in the fourth test depends on the message added by the third.

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc --noEmit && npx eslint`
Expected: both clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/conversations.db-test.ts
git commit -m "Test listInboxFor: scoping, counterparty naming, unread, ordering

The scoping test is the load-bearing one. 'Mine' is buyerId = me OR
listing.sellerId = me, a predicate written once in a where clause with
nothing asserting it excluded anyone.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: `getThreadFor`

**Files:**
- Modify: `src/lib/conversations.db-test.ts` (add a `describe` block)

**Interfaces:**
- Consumes: `world` from Task 3; `addMessage`, `suspend` from Task 2.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Write the failing tests**

Extend the `@/lib/conversations` import to include `getThreadFor`, and the support import to include `suspend`. Add:

```ts
describe("getThreadFor", () => {
  test("returns null to a stranger", async () => {
    const thread = await getThreadFor(world.conversationId, world.strangerId);

    assert.equal(thread, null);
  });

  test("returns null for a conversation that does not exist", async () => {
    const thread = await getThreadFor(
      "clnonexistentconversation01",
      world.buyerId,
    );

    assert.equal(thread, null);
  });

  test("selects the counterparty from the viewer's perspective", async () => {
    const forBuyer = await getThreadFor(world.conversationId, world.buyerId);
    const forSeller = await getThreadFor(world.conversationId, world.sellerId);

    assert.equal(forBuyer?.counterpartyId, world.sellerId);
    assert.equal(forBuyer?.counterpartyName, "Test Seller");
    assert.equal(forSeller?.counterpartyId, world.buyerId);
    assert.equal(forSeller?.counterpartyName, "Test Buyer");
  });

  test("returns messages oldest first", async () => {
    const base = Date.now();
    await addMessage(
      world.conversationId,
      world.buyerId,
      "second",
      new Date(base + 2_000),
    );
    await addMessage(
      world.conversationId,
      world.sellerId,
      "third",
      new Date(base + 3_000),
    );

    const thread = await getThreadFor(world.conversationId, world.buyerId);
    const bodies = thread?.messages.map((message) => message.body) ?? [];

    assert.ok(bodies.indexOf("second") < bodies.indexOf("third"));
    assert.deepEqual(
      [...(thread?.messages ?? [])].map((m) => m.createdAt.getTime()),
      [...(thread?.messages ?? [])]
        .map((m) => m.createdAt.getTime())
        .sort((a, b) => a - b),
    );
  });

  test("reports a suspended counterparty as a boolean, never a timestamp", async () => {
    await suspend(world.sellerId);

    const thread = await getThreadFor(world.conversationId, world.buyerId);

    assert.equal(thread?.counterpartySuspended, true);
    // A timestamp reaching a Client Component is the thing the DTO mapping
    // exists to prevent.
    assert.equal(typeof thread?.counterpartySuspended, "boolean");
  });
});
```

- [ ] **Step 2: Run to verify they pass**

Run: `npm run test:db`
Expected: PASS, 16 tests.

The suspension test runs last within its block and mutates the seller; nothing after it depends on the seller being unsuspended. If a later task adds tests, they must account for that or suspend inside their own world.

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc --noEmit && npx eslint`
Expected: both clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/conversations.db-test.ts
git commit -m "Test getThreadFor: authorization, counterparty, ordering, suspension

Covers the DTO contract as well as the guard: counterpartySuspended must
be a boolean, because mapping suspendedAt to one is what stops a
moderation timestamp reaching a Client Component.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Mutation testing

**Files:**
- Temporarily modify then revert: `src/lib/conversations.ts`

**Interfaces:**
- Consumes: the full suite from Tasks 3–5.
- Produces: evidence. No committed code changes to `conversations.ts`.

A regression test that has never been observed failing is only an assumption that it works. This repeats what was done for the Ably channel guard, the participant check and the rate limiter.

**Before starting:** `git status` must be clean, so a stray mutation cannot be committed by accident.

- [ ] **Step 1: Mutation A — remove the participant guard**

In `src/lib/conversations.ts`, change the last line of `getParticipantsIfMember` from:
```ts
  return isParticipant(participants, viewerId) ? participants : null;
```
to:
```ts
  return participants;
```

Run: `npm run test:db`
Expected: **FAIL** — "returns null to a signed-in stranger" and the indistinguishability test.

Record the failing test names. Then revert:
```bash
git checkout src/lib/conversations.ts
```

- [ ] **Step 2: Mutation B — broaden the inbox scope**

In `listInboxFor`, change:
```ts
    where: {
      OR: [{ buyerId: viewerId }, { listing: { sellerId: viewerId } }],
    },
```
to:
```ts
    where: {},
```

Run: `npm run test:db`
Expected: **FAIL** — "returns the conversation to both participants and not to a stranger".

Revert: `git checkout src/lib/conversations.ts`

- [ ] **Step 3: Mutation C — remove the thread's early return**

In `getThreadFor`, change:
```ts
  const participants = await getParticipantsIfMember(conversationId, viewerId);
  if (!participants) return null;
```
to:
```ts
  await getParticipantsIfMember(conversationId, viewerId);
```

Run: `npm run test:db`
Expected: **FAIL** — "returns null to a stranger".

Revert: `git checkout src/lib/conversations.ts`

- [ ] **Step 4: Confirm the module is pristine and the suite is green**

Run: `git diff --exit-code src/lib/conversations.ts && npm run test:db`
Expected: no diff, and 16 tests passing.

- [ ] **Step 5: Report honestly**

If any mutation left the suite **green**, that test is decoration. Say so explicitly and either strengthen the test or state plainly that the control is unverified. Do not proceed to Task 7 having silently skipped a mutation.

---

### Task 7: Documentation

**Files:**
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: everything above.
- Produces: nothing.

- [ ] **Step 1: Correct Gotcha #24**

It currently says a `server-only` module can only be reached by testing the pure half or replicating the query. That is now false and will steer the next session away from the working approach. Append to that entry:

```markdown
    **Correction (2026-08-15): there is a third way, and it is now in use.**
    `server-only` ships a no-op `empty.js` behind a `react-server` export
    condition, so running Node with `--conditions=react-server` resolves it to
    nothing without mocking or removing it. Combined with a resolve hook for
    the `@/*` alias, the real module imports unchanged — see
    `scripts/test-db-hooks.mjs` and `npm run test:db`. The advice above still
    holds for `npx tsx -e` one-liners, which do not set the condition.
```

- [ ] **Step 2: Scope Gotchas #21 and #23**

Append to both entries:

```markdown
    **Scoped as of 2026-08-15:** this applies to the default `npm test` only.
    Files matching `*.db-test.ts` run through `scripts/test-db-hooks.mjs`,
    which registers a resolve hook, so `@/` imports work there — and are
    preferred, since using relative imports would defeat the hook.
```

- [ ] **Step 3: Add a new gotcha**

Append to the Known Gotchas list, numbered 43:

```markdown
43. **A resolve hook for a path alias must resolve the extension too, and the failure names a path that looks right.** Mapping `@/*` to `src/*` is the obvious half. Production code writes `@/lib/db` with no extension, so a hook that only rewrites the prefix produces `/…/src/lib/db` and Node reports `ERR_MODULE_NOT_FOUND` for a path that reads perfectly plausibly — the mistake is invisible in the error. The hook must try `<path>`, `<path>.ts`, `<path>.tsx` and `<path>/index.ts` in turn. Also note `registerHooks` from `node:module` is synchronous and in-thread, unlike the older `register()` loader API, which is what makes it usable for something this small.
```

- [ ] **Step 4: Add Decision Log entries**

```markdown
- **2026-08-15** — **The conversation authorization layer is tested against a real database, running the real module rather than a copy.** It was the only module in `src/lib/` with no test beside it, and `docs/case-study.md` named it as the one thing to do differently. Two alternatives were rejected. Rewriting its imports to be relative (the `listing-constraints.ts` precedent) edits production code for the test's benefit and fixes only that module, so the wart spreads. Replicating the queries inside the test — what the manual 2026-08-14 verification did — tests a copy that can drift from the original, which is the exact failure mode that motivated centralising `upload-constraints.ts`; a green test would prove nothing about the code that ships. Running Node with `--conditions=react-server` plus a resolve hook costs about fifteen lines and leaves production untouched, and it unblocks the `/api/upload` and `/api/ably/token` suites that were listed as the next gaps.
- **2026-08-15** — **Database tests target `TEST_DATABASE_URL` and never fall back to `DATABASE_URL`.** Unset means the suite refuses to run; identical to `DATABASE_URL` also means refuse, on the assumption a copy-paste has aimed the tests at the development database somebody browses in a real browser. These tests delete rows, and Gotcha #39 is that every standalone script here silently targets whatever `.env` says. Same reasoning as `CRON_SECRET` failing closed: a destructive operation with a silent default is strictly worse than one that refuses to run. The suite is also kept out of `npm test` by the `.db-test.ts` suffix rather than by editing the existing glob, so the fast offline suite keeps its properties unchanged.
```

- [ ] **Step 5: Document the environment variable**

In the Environment Variables section, after the `CRON_SECRET` block:

```markdown
TEST_DATABASE_URL      # Neon `test` branch. Read ONLY by `npm run test:db`,
                       # which refuses to run without it and never falls back
                       # to DATABASE_URL — those tests delete rows. Not needed
                       # for `npm test`, the app, or a deployment.
```

- [ ] **Step 6: Update Current State and Next Steps**

In Current State, update the test counts to `330 passing (npm test)` plus `16 passing (npm run test:db)`.

In Next Steps section 3, replace the "Untested code" bullet with:

```markdown
- **Untested code**: `src/lib/conversations.ts` is now covered — 16 database-backed tests, three controls mutation-tested (`npm run test:db`). Remaining: the `/api/upload` and `/api/ably/token` route handlers, which need request/session fixtures but no longer need harness work — `scripts/test-db-hooks.mjs` already makes `server-only` modules and `@/` imports resolve.
```

- [ ] **Step 7: Verify everything still passes**

Run: `npm test && npm run test:db && npx tsc --noEmit && npx eslint`
Expected: 330 pass, 16 pass, both clean.

- [ ] **Step 8: Commit and open a PR**

```bash
git add AGENTS.md
git commit -m "Record the database test harness in the bridge document

Corrects Gotcha #24, which ruled out the approach now in use: server-only
ships a no-op behind a react-server export condition, so the real module
imports unmodified. Scopes #21 and #23 to the default suite, adds #43 for
the extension-resolution trap, and logs both decisions.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"

git push -u origin feature/conversation-authz-tests
```

Then open a PR describing: what was untested and why it mattered, the harness, the three mutations and which test each turned red, and the fact that `npm test` is unchanged.

---

## Self-Review

**Spec coverage:** Harness → Task 1. Safety guards → Task 1 Steps 4–5. Fixtures → Task 2. Assertions 1–5 → Task 3; 6–9 → Task 4; 10–13 → Task 5. Mutation testing → Task 6. Documentation → Task 7. Prerequisite → its own section. No gaps.

**Placeholder scan:** No TBD/TODO. Every code step carries real code. The one conditional (`updatedAt` on create) states both branches and how to decide between them, rather than deferring.

**Type consistency:** `ConversationWorld` fields are used identically across Tasks 3–5. `addMessage`, `markRead`, `addSecondConversation`, `suspend` signatures match their definitions in Task 2. The `*.db-test.ts` glob is consistent everywhere. Test counts run 2 → 1 (smoke deleted, fixture test remains) + 5 → 11 → 16, consistent with each task's expectation.
