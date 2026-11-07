import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["postgres", "nodemailer"],
  // PostHog goes through our own domain (/ingest) so ad blockers don't drop it.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      { source: "/ingest/static/:path*", destination: "https://eu-assets.i.posthog.com/static/:path*" },
      { source: "/ingest/:path*", destination: "https://eu.i.posthog.com/:path*" },
    ];
  },
  webpack(config) {
    config.resolve.alias["@"] = path.join(root, "src");
    return config;
  },
};
export default nextConfig;
