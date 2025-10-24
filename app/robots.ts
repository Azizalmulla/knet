import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://cv-saas-phi.vercel.app'
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/start',
          '/career/*',
          '/ai-builder',
          '/career/ai-builder',
          '/upload',
          '/privacy',
          '/terms'
        ],
        disallow: [
          '/careerly',
          '/careerly/*',
          '/api/*',
          '/super-admin/*',
          '/admin/*',
          '/_next/*'
        ]
      }
    ],
    sitemap: `${site}/sitemap.xml`,
  }
}
