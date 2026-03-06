import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['highs'],
  outputFileTracingIncludes: {
    '/api/schedule': ['./node_modules/highs/build/**/*'],
  },
};

export default nextConfig;
