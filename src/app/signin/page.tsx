import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { ALLOWED_DOMAIN_LABEL, subdomainLabel } from "@/lib/auth-domain";
import { legalPath } from "@/lib/legal";
import { safeInternalPath } from "@/lib/safe-redirect";
import { SIGNIN_HEADLINE, SIGNIN_INTRO } from "@/lib/site-copy";
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
    <div className="mx-auto w-full max-w-lg px-4 py-6 sm:px-6 sm:py-10">
      <Breadcrumbs items={[{ label: "Sign in" }]} />

      <h1 className="mb-3">{SIGNIN_HEADLINE}</h1>

      <p className="mb-6 text-sm text-secondary">
        {SIGNIN_INTRO}{" "}
        You&rsquo;ll need to sign in with your{" "}
        <strong className="font-medium text-content">
          {ALLOWED_DOMAIN_LABEL}
        </strong>{" "}
        Google account &mdash; including student addresses like{" "}
        <span className="whitespace-nowrap">{subdomainLabel("student")}</span>.
        Personal Gmail accounts can&rsquo;t be used.
      </p>

      {error && (
        <p
          role="alert"
          className="notice notice-danger mb-6"
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
          className="btn btn-primary w-full"
        >
          Continue with Google
        </button>
      </form>

      {/*
        Stated before the account picker, not after it. Consent given after the
        fact is not consent, and this is also the last moment where somebody
        can decline without a row already existing in the database.
      */}
      <p className="mt-4 text-fine text-secondary">
        By signing in you agree to the{" "}
        <Link
          href={legalPath("terms")}
          className="text-accent underline underline-offset-2"
        >
          Terms of Service
        </Link>{" "}
        and the{" "}
        <Link
          href={legalPath("privacy")}
          className="text-accent underline underline-offset-2"
        >
          Privacy Policy
        </Link>
        . This is an independent student project, not a GMI service.
      </p>

      <p className="mt-6 text-sm text-secondary">
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
