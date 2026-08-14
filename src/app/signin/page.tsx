import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { ALLOWED_DOMAIN_LABEL } from "@/lib/auth-domain";
import { safeInternalPath } from "@/lib/safe-redirect";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export const metadata: Metadata = {
  title: "Sign in",
};

/**
 * Custom sign-in page, replacing the Auth.js default.
 *
 * Two reasons it exists rather than the built-in page:
 *
 * 1. The domain restriction has to be stated *before* someone picks an
 *    account. The default page offers a bare "Sign in with Google", and a
 *    personal Gmail account gets silently rejected by the `signIn` callback
 *    with no explanation of why.
 * 2. The default page loads its provider logo from authjs.dev, which our CSP
 *    `img-src` blocks — so it renders a broken image. Dropping the external
 *    asset is better than widening the policy for a decoration.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const { callbackUrl, error } = await searchParams;

  // Already signed in — nothing to do here.
  if ((await auth())?.user) redirect(safeInternalPath(callbackUrl));

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-8 sm:px-6 sm:py-12">
      <Breadcrumbs items={[{ label: "Sign in" }]} />

      <h1 className="mb-3 text-2xl font-semibold">Sign in</h1>

      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        GMI Campus Marketplace is for the German-Malaysian Institute community. You&rsquo;ll need to sign in
        with your{" "}
        <strong className="font-medium text-foreground">
          {ALLOWED_DOMAIN_LABEL}
        </strong>{" "}
        Google account &mdash; including student addresses like{" "}
        <span className="whitespace-nowrap">@student{ALLOWED_DOMAIN_LABEL}</span>.
        Personal Gmail accounts can&rsquo;t be used.
      </p>

      {error && (
        <p
          role="alert"
          className="mb-6 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          {messageFor(error)}
        </p>
      )}

      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: safeInternalPath(callbackUrl) });
        }}
      >
        <button
          type="submit"
          className="w-full rounded bg-foreground px-4 py-3 text-sm font-medium text-background"
        >
          Continue with Google
        </button>
      </form>

      <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
        You can browse listings without signing in. An account is only needed to
        post a listing or message a seller.
      </p>
    </div>
  );
}

function messageFor(error: string): string {
  switch (error) {
    case "AccessDenied":
      // What the signIn callback returns for a non-institutional domain.
      return `That account isn't a ${ALLOWED_DOMAIN_LABEL} address, so it can't be used here. Sign in with your GMI account instead.`;
    case "OAuthAccountNotLinked":
      return "That email is already registered through a different sign-in method.";
    case "Verification":
      return "That sign-in link has expired. Please try again.";
    default:
      return "Something went wrong signing you in. Please try again.";
  }
}
