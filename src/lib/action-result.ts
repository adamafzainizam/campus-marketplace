/**
 * How server actions report expected failures.
 *
 * Actions must **return** validation failures, not throw them. Next.js masks
 * any error thrown out of a server action in a production build — the client
 * receives a generic "An error occurred in the Server Components render"
 * message with a digest, deliberately, so server internals can't leak. The
 * effect is that "Description must be at least 10 characters" and a genuine
 * crash become indistinguishable to the user.
 *
 * This is invisible in development, where the real message passes through,
 * which is exactly how it survived until the first production deploy.
 *
 * Throwing is reserved for the genuinely exceptional — a bug, a database that
 * is gone — where a generic message is the honest answer anyway.
 */

export type ActionFailure = { ok: false; error: string };
export type ActionSuccess<T = undefined> = { ok: true; value: T };
export type ActionResult<T = undefined> = ActionSuccess<T> | ActionFailure;

export const actionFailed = (error: string): ActionFailure => ({ ok: false, error });

export const actionOk = <T = undefined>(value?: T): ActionSuccess<T> =>
  ({ ok: true, value: value as T });
