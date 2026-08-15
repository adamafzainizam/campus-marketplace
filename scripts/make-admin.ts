import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Grants or revokes the ADMIN role.
 *
 *   npm run make-admin -- someone@gmi.edu.my
 *   npm run make-admin -- someone@gmi.edu.my --revoke
 *
 * A script rather than a route, deliberately. Roles live in the database, so
 * something has to create the first administrator, and any in-app route that
 * could do it would be a privilege-escalation endpoint permanently exposed to
 * the internet for the sake of an operation that runs approximately twice in
 * the life of the project. This runs on a laptop, against whichever database
 * `DATABASE_URL` names, and cannot be reached by anyone who is not already
 * holding the credentials.
 *
 * `import "dotenv/config"` is required: standalone scripts do not inherit
 * Next's env loading, and without it `DATABASE_URL` is undefined and Postgres
 * silently falls back to localhost (Known Gotchas #1).
 *
 * Note this deliberately writes no `ModerationLog` row. That table records
 * actions taken *through the application* by an identified administrator
 * acting on someone else. A change made by whoever holds the database
 * credentials is a different kind of event, and recording it as though it came
 * from inside the app would misrepresent it.
 */

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

/**
 * Which database this is about to write to.
 *
 * Printed before anything happens, because this script is run against
 * *production* roughly once and against development the rest of the time, and
 * the two connection strings differ by a hostname nobody reads carefully. A
 * grant applied to the wrong branch fails silently in the most annoying
 * possible way: it reports success, and the role simply isn't there when you
 * go looking for it.
 *
 * Only the host is shown. The connection string contains a password.
 */
function targetDescription(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error(
      "DATABASE_URL is not set. Standalone scripts don't inherit Next's env " +
        "loading, and without it Postgres silently falls back to localhost.",
    );
  }

  try {
    return new URL(raw).host;
  } catch {
    // Never echo the string itself — it carries credentials.
    throw new Error("DATABASE_URL is set but is not a valid connection URL.");
  }
}

async function main() {
  const args = process.argv.slice(2);
  const revoke = args.includes("--revoke");
  const email = args.find((arg) => !arg.startsWith("--"));

  if (!email) {
    throw new Error(
      "Usage: npm run make-admin -- <email> [--revoke]",
    );
  }

  console.log(`Database: ${targetDescription()}`);

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, role: true },
  });

  if (!user) {
    throw new Error(
      `No account with the email ${email}. They have to sign in once before they can be made an administrator.`,
    );
  }

  const role = revoke ? "USER" : "ADMIN";

  if (user.role === role) {
    console.log(`${user.email} is already ${role}. Nothing to do.`);
    return;
  }

  await db.user.update({ where: { id: user.id }, data: { role } });
  console.log(`${user.email} (${user.name}) is now ${role}.`);

  if (!revoke) {
    console.log(
      "They can now reach /admin. The role is read from the database on every\n" +
        "privileged request, so it takes effect immediately — no sign-out needed.",
    );
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    // A non-zero exit code, so this fails loudly in a script or CI rather than
    // printing an error and reporting success.
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
