/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  trailingSlash: true,
  basePath: process.env.NODE_ENV === 'production' ? '/dayone-blog-automation' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/dayone-blog-automation/' : '',
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig