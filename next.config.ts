import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // lean, self-contained build for Docker
};

export default nextConfig;
