import type { NextConfig } from "next";

// Security headers (security audit 6 Nov 2026).
// - Every page: no MIME sniffing, no full URLs leaked to other sites, no
//   camera/mic/location.
// - Logged-in and money pages can't be shown inside another site's frame
//   (stops "clickjacking": a fake page over the dashboard tricking someone into
//   pressing Refund or Remove). Booking pages and /embed stay frameable because
//   academies put them on their own websites.
const everywhere = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];
const noFraming = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
];
const NO_FRAME_PATHS = [
  "/dashboard/:path*",
  "/platform/:path*",
  "/auth/:path*",
  "/onboard/:path*",
  "/pay/:path*",
  "/confirm-subscription/:path*",
  "/academy-payment-collection/:path*",
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/:path*", headers: everywhere },
      ...NO_FRAME_PATHS.flatMap((p) => [
        { source: p, headers: noFraming },
        { source: p.replace("/:path*", ""), headers: noFraming },
      ]),
    ];
  },
};

export default nextConfig;
