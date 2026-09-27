/**
 * Which part of the site a path belongs to — no I/O, no JSX.
 *
 * The mobile header's menu button names the page you are on, and both the
 * menu and the desktop nav mark the current section. That needs the path,
 * which is why the header's nav is a client component; the rule itself lives
 * here so it can be tested.
 *
 * Unlike breadcrumbs (src/lib/breadcrumbs.ts), which are declared per page
 * because `/listings/<id>` does not contain the listing's title, sections are
 * a fixed handful of path prefixes, so deriving them from the URL is safe.
 */

export type SectionKey =
  | "browse"
  | "mine"
  | "messages"
  | "post"
  | "signin"
  | "legal"
  | "admin";

export const SECTION_LABELS: Readonly<Record<SectionKey, string>> = {
  browse: "Browse",
  mine: "My listings",
  messages: "Messages",
  post: "Post a listing",
  signin: "Sign in",
  legal: "Legal",
  admin: "Admin",
};

/** The mobile menu's navigation, in display order. */
export const MENU_ITEMS: ReadonlyArray<{
  key: SectionKey;
  href: string;
  signedInOnly: boolean;
}> = [
  { key: "browse", href: "/", signedInOnly: false },
  { key: "mine", href: "/listings/mine", signedInOnly: true },
  { key: "messages", href: "/messages", signedInOnly: false },
];

/** True when `path` is `prefix` itself or a path beneath it. */
function under(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function currentSection(pathname: string): SectionKey | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

  if (path === "/") return "browse";
  if (under(path, "/listings/mine")) return "mine";
  if (path === "/listings/new") return "post";
  // A listing's edit page belongs to the seller's own listings.
  if (/^\/listings\/[^/]+\/edit$/.test(path)) return "mine";
  if (under(path, "/listings")) return "browse";
  if (under(path, "/messages")) return "messages";
  if (path === "/signin") return "signin";
  if (under(path, "/legal")) return "legal";
  if (under(path, "/admin")) return "admin";
  return null;
}

/**
 * What the mobile menu button says. "Menu" on the post page, where the
 * primary button beside it already says "Post a listing", and anywhere the
 * section is unknown.
 */
export function menuButtonLabel(section: SectionKey | null): string {
  if (section === null || section === "post") return "Menu";
  return SECTION_LABELS[section];
}
