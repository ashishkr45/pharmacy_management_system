import type { NextConfig } from "next";

// Docker builds set NEXT_OUTPUT=standalone to produce the self-contained server
// copied into the small runtime image. Vercel does not set it, so the hosted
// build keeps its normal Next.js output.
const nextConfig: NextConfig = {
  ...(process.env.NEXT_OUTPUT === "standalone"
    ? { output: "standalone" as const }
    : {}),
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
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
