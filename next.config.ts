import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configuration for AWS Amplify deployment with API routes
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  // Disable strict linting for build
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Ensure API routes are properly handled
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: '/api/:path*',
      },
    ];
  },
};

export default nextConfig;
