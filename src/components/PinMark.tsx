/**
 * The site's mark: a pushpin in an accent-filled rounded square.
 *
 * It carries the product's argument in one shape — a pin is the thing a
 * group chat does not have — and it is the motif this project has used since
 * the README's first line about a noticeboard. It survives at 16px in one
 * colour, which an abstract four-square "board" mark also would have, but
 * that one reads as "an app" rather than as "a board".
 *
 * The same glyph is duplicated in `src/app/icon.svg` for the browser tab.
 * That file cannot import this one — it is a static asset with no access to
 * the page's tokens — so if the shape changes, change both.
 *
 * Two proportions have to agree with `icon.svg`, and only one of them
 * survives a fixed value: `icon.svg`'s corner is `rx="7"` on a 32-unit box,
 * i.e. 21.875% (rounded to `rounded-[22%]` below — the 0.035px difference at
 * this size is not worth an unrounded arbitrary value). A *token* radius
 * (`rounded-lg` = 1rem = 16px) does not scale with the box: CSS clamps a
 * corner radius at half the side length, so on this component's 28px default
 * it was clamping to exactly 14px — a perfect circle, not the rounded square
 * the favicon renders. Its glyph fill is `translate(4 4)` on a 24-unit glyph
 * in a 32-unit box, i.e. 24/32 = 75% — matched below.
 */
export function PinMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-[22%] bg-accent text-accent-contrast ${className}`}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-[75%] w-[75%]">
        {/* Cap, tapered body, needle — a pushpin seen side-on. Drawn from
            primitives rather than one clever path so it stays legible when
            somebody has to adjust it. */}
        <rect x="8" y="3" width="8" height="2.4" rx="1.2" />
        <path d="M10 5.4h4l1.7 6.5a1 1 0 0 1-.97 1.25H9.27a1 1 0 0 1-.97-1.25L10 5.4z" />
        <rect x="11.3" y="13.15" width="1.4" height="7.85" rx="0.7" />
      </svg>
    </span>
  );
}
