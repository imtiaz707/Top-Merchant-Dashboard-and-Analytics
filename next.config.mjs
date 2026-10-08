/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // enables `node .next/standalone/server.js` for on-prem/PM2 (harmless on Vercel)
  poweredByHeader: false,
  webpack: (config) => {
    // Import the dashboard HTML template as a raw string.
    config.module.rules.push({ test: /\.html$/, type: 'asset/source' });
    return config;
  },
};
export default nextConfig;
