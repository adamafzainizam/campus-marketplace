/**
 * Breadcrumb trail construction — no I/O, no JSX.
 *
 * Trails are declared per page rather than derived from the URL, because the
 * useful label for `/listings/<cuid>` is the listing's title, which the path
 * does not contain. Pages pass what they know; this normalises it.
 */

export type Crumb = {
  label: string;
  /** Omitted on the final crumb — you are already there. */
  href?: string;
};

/**
 * Longest label kept intact. Listing titles are user-supplied and can be long
 * enough to wrap the trail onto several lines or push it off a phone screen.
 */
export const MAX_CRUMB_LABEL = 40;

const HOME: Crumb = { label: "Home", href: "/" };

export function buildBreadcrumbTrail(items: readonly Crumb[]): Crumb[] {
  const trail: Crumb[] = [
    HOME,
    ...items
      .map((item) => ({ ...item, label: normaliseLabel(item.label) }))
      .filter((item) => item.label.length > 0),
  ];

  // The page you are on is not a link to itself.
  const last = trail[trail.length - 1];
  trail[trail.length - 1] = { label: last.label };

  return trail;
}

function normaliseLabel(label: string): string {
  const collapsed = label.trim().replace(/\s+/g, " ");
  return collapsed.length > MAX_CRUMB_LABEL
    ? `${collapsed.slice(0, MAX_CRUMB_LABEL).trimEnd()}…`
    : collapsed;
}
