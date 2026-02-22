import type { NextConfig } from "next";

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

const nextConfig: NextConfig = {
  // Allow external access (ngrok, mobile devices on same network)
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ];
  },
  // Flask Backend Proxy (exclude NextAuth routes which are handled by Next.js)
  async rewrites() {
    return [
      { source: '/api/auth/register', destination: `${BACKEND_URL}/api/auth/register` },
      { source: '/api/auth/login', destination: `${BACKEND_URL}/api/auth/login` },
      { source: '/api/auth/me', destination: `${BACKEND_URL}/api/auth/me` },
      { source: '/api/auth/admin/:path*', destination: `${BACKEND_URL}/api/auth/admin/:path*` },
      { source: '/api/stripe/:path*', destination: `${BACKEND_URL}/api/stripe/:path*` },
      { source: '/api/kr/:path*', destination: `${BACKEND_URL}/api/kr/:path*` },
      { source: '/api/us/:path*', destination: `${BACKEND_URL}/api/us/:path*` },
      { source: '/api/crypto/:path*', destination: `${BACKEND_URL}/api/crypto/:path*` },
      { source: '/api/econ/:path*', destination: `${BACKEND_URL}/api/econ/:path*` },
      { source: '/api/dividend/:path*', destination: `${BACKEND_URL}/api/dividend/:path*` },
      { source: '/api/admin/:path*', destination: `${BACKEND_URL}/api/admin/:path*` },
      { source: '/api/subscription/:path*', destination: `${BACKEND_URL}/api/subscription/:path*` },
      { source: '/api/health', destination: `${BACKEND_URL}/api/health` },
      { source: '/api/system/:path*', destination: `${BACKEND_URL}/api/system/:path*` },
      { source: '/api/portfolio/:path*', destination: `${BACKEND_URL}/api/portfolio/:path*` },
      { source: '/api/portfolio-summary', destination: `${BACKEND_URL}/api/portfolio-summary` },
      { source: '/api/stock/:path*', destination: `${BACKEND_URL}/api/stock/:path*` },
      { source: '/api/realtime-prices', destination: `${BACKEND_URL}/api/realtime-prices` },
      { source: '/api/data-version', destination: `${BACKEND_URL}/api/data-version` },
      { source: '/api/stock-analyzer/:path*', destination: `${BACKEND_URL}/api/stock-analyzer/:path*` },
    ];
  },
};

export default nextConfig;
