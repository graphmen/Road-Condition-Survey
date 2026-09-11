/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  async rewrites() {
    return [
      { source: "/collector", destination: "/collector/index.html" },
    ];
  },
  async headers() {
    return [
      {
        source: "/downloads/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
          { key: "Pragma", value: "no-cache" },
        ],
      },
    ];
  },
}

module.exports = nextConfig
