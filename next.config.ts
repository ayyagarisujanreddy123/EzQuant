import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workaround for a Next.js 16.2 prerender regression where the internal
  // /_global-error page throws "Cannot read properties of null (reading
  // 'useContext')" during build. Disabling prerenderEarlyExit lets the
  // rest of the build complete even when that synthetic page fails.
  experimental: {
    prerenderEarlyExit: false,
    turbopackMinify: false,
  },
};

export default nextConfig;
