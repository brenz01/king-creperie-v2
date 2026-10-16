import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api', '/suivi', '/commande', '/serwist'] },
    sitemap: new URL('/sitemap.xml', process.env.NEXT_PUBLIC_SITE_URL || 'https://king-creperie-v2.vercel.app').toString(),
  };
}
