import type { NextConfig } from "next";
import { buildSecurityHeaders } from "./src/lib/security-headers";

const isDev = process.env.NODE_ENV !== "production";

/**
 * The R2 public host that serves listing images. Read from the same env var
 * the app uses at runtime so the CSP can't drift from where images actually
 * come from.
 *
 * Note this is read at BUILD time as well as runtime — if it is absent when
 * the production build runs, the CSP silently blocks every listing image.
 */
const r2ImageOrigin = process.env.R2_PUBLIC_URL ?? "";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: buildSecurityHeaders({ isDev, r2ImageOrigin }),
      },
    ];
  },
};

export default nextConfig;
