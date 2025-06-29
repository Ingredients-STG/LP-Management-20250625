import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configuration for AWS Amplify deployment with API routes
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  // Keep API routes functional
  experimental: {
    esmExternals: "loose"
  }
};

export default nextConfig;
