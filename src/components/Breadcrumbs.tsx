import Link from "next/link";
import { buildBreadcrumbTrail, type Crumb } from "@/lib/breadcrumbs";

/**
 * "Home › Listings › Mini fridge" — shows where in the site the current page
 * sits.
 *
 * Pages pass the trail explicitly rather than it being derived from the URL,
 * because the useful label for `/listings/<cuid>` is the listing's title,
 * which the path doesn't contain.
 */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const trail = buildBreadcrumbTrail(items);

  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-secondary">
        {trail.map((crumb, index) => {
          const isLast = index === trail.length - 1;
          return (
            <li key={`${crumb.label}-${index}`} className="flex items-center gap-x-2">
              {index > 0 && (
                <span aria-hidden="true" className="text-tertiary">
                  ›
                </span>
              )}
              {crumb.href ? (
                <Link href={crumb.href} className="hover:underline">
                  {crumb.label}
                </Link>
              ) : (
                // The page you are on: not a link, and announced as the
                // current location for screen readers.
                <span
                  aria-current={isLast ? "page" : undefined}
                  className="font-medium text-foreground"
                >
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
