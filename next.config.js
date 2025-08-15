/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  output: 'export',
  trailingSlash: true,
  basePath: process.env.NODE_ENV === 'production' ? '/dayone-blog-automation' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/dayone-blog-automation/' : '',
  images: {
    unoptimized: true, // Required for static export
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