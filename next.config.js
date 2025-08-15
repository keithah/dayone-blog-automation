/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: [],
    formats: ['image/webp', 'image/avif'],
  },
  async rewrites() {
    return [
      {
        source: '/blog/:category/:slug',
        destination: '/blog/[category]/[slug]',
      },
      {
        source: '/blog/tag/:tag',
        destination: '/blog/tag/[tag]',
      },
    ];
  },
  async redirects() {
    return [];
  },
}

module.exports = nextConfig