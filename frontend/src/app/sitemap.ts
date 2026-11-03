import type { MetadataRoute } from 'next';

const SITE_URL = (process.env.SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/register`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/login`, changeFrequency: 'monthly', priority: 0.4 },
  ];
}
