import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Flask Backend Proxy
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:5001/api/:path*',
      },
    ];
  },
};

export default nextConfig;
