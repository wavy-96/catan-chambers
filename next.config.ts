import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/recap": [
      "./src/assets/fonts/*.ttf",
      "./public/colonist.png",
      "./public/icon-crown.png",
    ],
  },
};

export default nextConfig;
