import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/", destination: "/display.html" },
      { source: "/display", destination: "/display.html" },
      { source: "/checkin", destination: "/checkin.html" },
      { source: "/operator", destination: "/operator.html" },
      { source: "/checkin/:code", destination: "/session.html" },
    ];
  },
};

export default nextConfig;
