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
    // Also exclude pdf-parse and sharp to avoid bundling their test files
    serverComponentsExternalPackages: [
      'jsonresume-theme-macchiato', 
      'jsonresume-theme-elegant', 
      '@sparticuz/chromium', 
      'puppeteer-core',
      'pdf-parse',
      'sharp'
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Ignore pdf-parse test files during build
      config.externals = config.externals || [];
      config.externals.push({
        'canvas': 'canvas',
        'sharp': 'commonjs sharp',
        'pdf-parse': 'commonjs pdf-parse'
      });
    }
    return config;
  },
};

export default nextConfig;
