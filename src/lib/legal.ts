/**
 * The legal documents, described in one place.
 *
 * Four separate things need to agree about these: the footer that links them,
 * the pages that render them, the sign-in page that asks people to accept two
 * of them, and the `/legal` index. Naming the same four documents in four
 * files is how they drift — one gets renamed, another keeps the old label, and
 * a link quietly 404s. Same reasoning as `upload-constraints.ts`, which exists
 * because the route that mints object keys and the action that validates them
 * must agree exactly.
 *
 * Pure: no I/O, no imports from the app. That is what lets it be tested
 * directly, and it is why the affiliation disclaimer sentence lives here as a
 * string rather than being typed out on each page that shows it.
 */

/**
 * Where takedown requests, privacy questions, and PDPA access or correction
 * requests go.
 *
 * The Personal Data Protection Act 2010 requires a route for a data subject to
 * reach whoever holds their data. An address nobody reads is not that route, so
 * this is a real inbox rather than a `noreply@`.
 */
export const LEGAL_CONTACT_EMAIL = "m.adamafzainizam@gmail.com";

/**
 * When the current text took effect.
 *
 * ISO 8601 because it sorts, parses, and is unambiguous about which number is
 * the month — `08/09/2026` means two different dates depending on where the
 * reader is, and this site has an international audience by construction.
 *
 * Bump this whenever the wording changes materially.
 */
export const LEGAL_EFFECTIVE_DATE = "2026-08-15";

/**
 * The affiliation disclaimer, in the exact words used everywhere it appears.
 *
 * This is the load-bearing sentence of the whole set. The site is called "GMI
 * Campus Marketplace" and restricts sign-in to institutional accounts, so a
 * reasonable person could conclude it is run *by* the institute. Nothing else
 * on the site corrects that impression, which is why this appears in the
 * footer of every page rather than only on the page that explains it.
 */
export const AFFILIATION_DISCLAIMER =
  "GMI Campus Marketplace is an independent student project. It is not affiliated with, endorsed by, or operated by the German-Malaysian Institute.";

export type LegalDocumentSlug =
  | "terms"
  | "privacy"
  | "acceptable-use"
  | "disclaimer";

export type LegalDocument = {
  readonly slug: LegalDocumentSlug;
  /** Link label, in the footer and the index. Kept short enough to sit in a row. */
  readonly title: string;
  /** One sentence, used as the page's meta description and on the index. */
  readonly summary: string;
};

export const LEGAL_DOCUMENTS: readonly LegalDocument[] = [
  {
    slug: "terms",
    title: "Terms of Service",
    summary:
      "The rules for using the marketplace, and the limits of what this service is responsible for.",
  },
  {
    slug: "privacy",
    title: "Privacy Policy",
    summary:
      "What personal data is collected, why, who it is shared with, and how to have it corrected or deleted.",
  },
  {
    slug: "acceptable-use",
    title: "Acceptable Use Policy",
    summary:
      "What may not be listed or done here, and what happens when someone does it anyway.",
  },
  {
    slug: "disclaimer",
    title: "Disclaimer",
    summary:
      "This is an independent student project, not an official service of the German-Malaysian Institute.",
  },
] as const;

/** The route a document is served at. One definition, so links cannot drift from pages. */
export function legalPath(slug: LegalDocumentSlug): string {
  return `/legal/${slug}`;
}

/**
 * Look up a document, returning `undefined` for anything unrecognised.
 *
 * Takes `unknown` rather than `LegalDocumentSlug` because callers may hand it a
 * route parameter, and a route parameter is user input regardless of what the
 * type signature would like to believe — the same reasoning as
 * `listing-constraints.ts`.
 */
export function findLegalDocument(slug: unknown): LegalDocument | undefined {
  if (typeof slug !== "string") return undefined;
  return LEGAL_DOCUMENTS.find((doc) => doc.slug === slug);
}

/**
 * Render the effective date for display, e.g. "15 August 2026".
 *
 * Day-month-year, matching Malaysian convention, and the month is spelled out
 * so it cannot be misread. Explicitly `en-GB` rather than the runtime default:
 * a server renders in whatever locale it happens to have, and this string is
 * part of a legal document, so it should not vary by deployment region.
 */
export function formatEffectiveDate(iso: string = LEGAL_EFFECTIVE_DATE): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
