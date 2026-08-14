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

/**
 * Where the browser uploads to. Derived from the same account id `src/lib/r2.ts`
 * builds its S3 endpoint from, so the policy cannot drift from the real target.
 * This is a different host from `r2ImageOrigin` above: images are *served* from
 * the r2.dev domain and *uploaded* to the S3 API domain.
 */
const r2ApiOrigin = process.env.R2_ACCOUNT_ID
  ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
  : "";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: buildSecurityHeaders({ isDev, r2ImageOrigin, r2ApiOrigin }),
      },
    ];
  },
};

export default nextConfig;
