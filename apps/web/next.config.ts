import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@storefront/core",
    "@storefront/treasury",
    "@storefront/market",
    "@storefront/optimizer",
    "@storefront/agent",
  ],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
