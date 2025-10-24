import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://cv-saas-phi.vercel.app'
  const lastModified = new Date()
  return [
    { url: `${base}/`, lastModified },
    { url: `${base}/start`, lastModified },
    { url: `${base}/career/dashboard`, lastModified },
    { url: `${base}/ai-builder`, lastModified },
    { url: `${base}/upload`, lastModified },
    { url: `${base}/privacy`, lastModified },
    { url: `${base}/terms`, lastModified },
  ]
}
