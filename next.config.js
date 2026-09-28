/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: '2mb' }
  }
}

if (process.env.CLOUDFLARE_PAGES) {
  // Cloudflare Pages build - requires @cloudflare/next-on-pages
  module.exports = nextConfig
} else {
  module.exports = nextConfig
}
