/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  async rewrites() {
    return [
      { source: "/collector", destination: "/collector/index.html" },
    ];
  },
}

module.exports = nextConfig
