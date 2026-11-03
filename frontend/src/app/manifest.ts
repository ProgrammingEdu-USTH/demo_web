import type { MetadataRoute } from 'next';

// Manifest PWA tối thiểu (không service worker): cho phép "Thêm vào màn hình chính".
// Icon nằm ở /static/icons (proxy.ts bỏ qua /static/) và do đội tự vẽ.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Programming EDU',
    short_name: 'EDU',
    description: 'Học lập trình bằng tiếng Việt: khoá học, bài thực hành, ôn tập và Python Studio.',
    start_url: '/dashboard',
    display: 'standalone',
    lang: 'vi',
    background_color: '#FAF8F5',
    theme_color: '#5B3FD1',
    icons: [
      { src: '/static/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/static/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}
