/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'assets.aceternity.com',
      },
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
    ],
  },
  // Allow redirects to Vercel Blob storage URLs
  async headers() {
    return [
      {
        source: '/api/:org/admin/cv/original/:id',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
        ],
      },
    ];
  },
  experimental: {
    // Ensure CJS theme package is included server-side for route handlers
    serverComponentsExternalPackages: ['jsonresume-theme-macchiato', 'jsonresume-theme-elegant', '@sparticuz/chromium', 'puppeteer-core'],
  },
  // Ensure route handlers also bundle the CJS package (webpack side)
  serverExternalPackages: ['jsonresume-theme-macchiato', 'jsonresume-theme-elegant', '@sparticuz/chromium', 'puppeteer-core'],
};

export default nextConfig;
