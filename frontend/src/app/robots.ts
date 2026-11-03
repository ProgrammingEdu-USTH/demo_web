import type { MetadataRoute } from 'next';

const SITE_URL = (process.env.SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');

// Chỉ trang giới thiệu, đăng nhập, đăng ký là công khai; phần còn lại cần
// đăng nhập nên không có gì để máy tìm kiếm lập chỉ mục.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/login', '/register'],
      disallow: [
        '/backend/',
        '/auth/',
        '/dashboard',
        '/courses/',
        '/lesson/',
        '/practice',
        '/questionaire',
        '/admin',
        '/card/',
        '/interface',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
