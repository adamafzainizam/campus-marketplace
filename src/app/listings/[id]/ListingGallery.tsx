"use client";

import { useState } from "react";

/**
 * The cover plus a strip of thumbnails, for listings with more than one photo.
 *
 * Deliberately not a carousel: no library, no swipe handling, no autoplay.
 * This app has no drag interactions anywhere (Decision Log 2026-08-15), and a
 * marketplace with at most three photos does not need gesture machinery to
 * show them.
 *
 * The thumbnails are real `<button>`s rather than clickable divs, so the strip
 * is reachable by keyboard and the selected one is announced. `aria-current`
 * carries which is showing; the images themselves are decorative because the
 * listing title above already names the thing.
 */
export function ListingGallery({
  urls,
  title,
}: {
  urls: string[];
  title: string;
}) {
  const [shown, setShown] = useState(0);
  const active = urls[shown] ?? urls[0];

  return (
    <div className="flex flex-col gap-3">
      <div className="aspect-square w-full overflow-hidden rounded-lg border border-line bg-surface-sunken shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={active} alt={title} className="h-full w-full object-cover" />
      </div>

      {urls.length > 1 && (
        <ul className="grid grid-cols-3 gap-2">
          {urls.map((url, index) => (
            <li key={url}>
              <button
                type="button"
                onClick={() => setShown(index)}
                aria-current={index === shown}
                aria-label={`Photo ${index + 1} of ${urls.length}`}
                className={`block w-full overflow-hidden rounded-md border transition-[border-color,opacity] ${
                  index === shown
                    ? "border-accent"
                    : "border-line opacity-70 hover:opacity-100"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  loading="lazy"
                  className="aspect-square w-full object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
