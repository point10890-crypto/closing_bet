import type { NextConfig } from "next";

// Local: BACKEND_URL=http://localhost:5001 → rewrites proxy to local Flask
// Vercel: BACKEND_URL not set + VERCEL=1 → static snapshots (/api/data/*)
const isVercel = process.env.VERCEL === '1';
const BACKEND_URL = isVercel ? '' : (process.env.BACKEND_URL || 'http://localhost:5001');

// API path prefixes that map to Flask endpoints
// NOTE: 'auth' is excluded — next-auth handles /api/auth/* via its own route handler
const API_PREFIXES = [
  'kr', 'us', 'crypto', 'econ', 'dividend',
  'admin', 'stripe',
  // 'stock-analyzer' — handled by Next.js API routes (no backend dependency)
  'scheduler', 'system', 'portfolio', 'stock',
];

const nextConfig: NextConfig = {
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
  async rewrites() {
    if (BACKEND_URL) {
      // ── LOCAL: Proxy everything to Flask backend ──
      return API_PREFIXES.map(prefix => ({
        source: `/api/${prefix}/:path*`,
        destination: `${BACKEND_URL}/api/${prefix}/:path*`,
      })).concat([
        { source: '/api/health', destination: `${BACKEND_URL}/api/health` },
        { source: '/api/realtime-prices', destination: `${BACKEND_URL}/api/realtime-prices` },
        { source: '/api/data-version', destination: `${BACKEND_URL}/api/data-version` },
        { source: '/api/portfolio-summary', destination: `${BACKEND_URL}/api/portfolio-summary` },
      ]);
    }

    // ── VERCEL: Redirect /api/{prefix}/* → /api/data/{prefix}/* (static snapshots) ──
    return API_PREFIXES.map(prefix => ({
      source: `/api/${prefix}/:path*`,
      destination: `/api/data/${prefix}/:path*`,
    })).concat([
      { source: '/api/health', destination: '/api/data/health' },
      { source: '/api/data-version', destination: '/api/data/data-version' },
      { source: '/api/realtime-prices', destination: '/api/data/realtime-prices' },
      { source: '/api/portfolio-summary', destination: '/api/data/portfolio-summary' },
    ]);
  },
};

export default nextConfig;
