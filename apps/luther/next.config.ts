import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@euaggelion/ui", "@euaggelion/mdx", "@euaggelion/db"],
  cacheComponents: true,
  partialPrefetching: true,
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
