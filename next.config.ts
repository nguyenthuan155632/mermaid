import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Turbopack configuration (Next.js 16 default)
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;

