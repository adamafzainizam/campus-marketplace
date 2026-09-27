import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { CANONICAL_ORIGIN } from "@/lib/canonical-host";
import {
  HOME_HEADLINE_LEAD,
  HOME_HEADLINE_MARK,
  HOME_TAGLINE,
} from "@/lib/site-copy";

/**
 * The card shown when a link to the site is shared. Generated at build time.
 *
 * Colours are baked hex for the same reason as icon.svg: the renderer cannot
 * read CSS custom properties. #fde047 is the highlight primitive, #18181b the
 * ink, #fafaf9 the paper and #52525b the secondary ink, all in globals.css.
 *
 * The renderer cannot read woff2 or variable fonts, so static Archivo woff
 * files live in ./_og (OFL, licence alongside). The underscore keeps that
 * folder out of routing.
 *
 * The affiliation line is here on purpose. This card puts "GMI" in large type
 * into chats where the site's footer disclaimer never appears.
 */

export const alt =
  "GMI Campus Marketplace: buy, sell and rent around GMI. An independent student project.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#18181b";
const INK_2 = "#52525b";
const PAPER = "#fafaf9";
const HIGHLIGHT = "#fde047";

export default async function Image() {
  const [medium, heavy] = await Promise.all([
    readFile(join(process.cwd(), "src/app/_og/archivo-latin-500.woff")),
    readFile(join(process.cwd(), "src/app/_og/archivo-latin-800.woff")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          padding: 56,
          background: PAPER,
          fontFamily: "Archivo",
          color: INK,
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "44px 60px",
            background: "#ffffff",
            border: `3px solid ${INK}`,
            borderRadius: 3,
            boxShadow: `10px 10px 0 ${INK}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <svg width="64" height="64" viewBox="0 0 32 32">
              <rect width="32" height="32" rx="3" fill={HIGHLIGHT} />
              <g fill={INK} transform="translate(4 4)">
                <rect x="8" y="3" width="8" height="2.4" rx="1.2" />
                <path d="M10 5.4h4l1.7 6.5a1 1 0 0 1-.97 1.25H9.27a1 1 0 0 1-.97-1.25L10 5.4z" />
                <rect x="11.3" y="13.15" width="1.4" height="7.85" rx="0.7" />
              </g>
            </svg>
            <div style={{ fontSize: 34, fontWeight: 800 }}>Campus Marketplace</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* One span per word: a flex item wraps as a block, so a single
                span for the lead would break the line in the wrong place. */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                fontSize: 80,
                fontWeight: 800,
                lineHeight: 1.1,
                letterSpacing: -2,
              }}
            >
              {HOME_HEADLINE_LEAD.trim()
                .split(" ")
                .map((word) => (
                  <span key={word} style={{ marginRight: 22 }}>
                    {word}
                  </span>
                ))}
              <span style={{ background: HIGHLIGHT, padding: "0 10px", marginLeft: -10 }}>
                {HOME_HEADLINE_MARK}
              </span>
            </div>
            <div style={{ fontSize: 36, fontWeight: 500, color: INK_2 }}>
              {HOME_TAGLINE}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              fontSize: 26,
              fontWeight: 500,
              color: INK_2,
            }}
          >
            <span style={{ fontWeight: 800, color: INK }}>
              {new URL(CANONICAL_ORIGIN).host}
            </span>
            <span>Independent student project. Not run by GMI.</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Archivo", data: medium, weight: 500, style: "normal" },
        { name: "Archivo", data: heavy, weight: 800, style: "normal" },
      ],
    },
  );
}
