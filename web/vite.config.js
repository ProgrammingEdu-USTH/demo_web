import { resolve } from 'node:path';
import { defineConfig, searchForWorkspaceRoot } from 'vite';

// index.html: the original 2D page, with 3D pick-up animations (src/pick3d.js)
// room3d.html: the full 3D room built earlier
//
// Backend (../server, NestJS, cổng 5100 — PORT trong server/.env): /api/* và /auth/* được proxy sang đó cho cả `vite`
// lẫn `vite preview`, nên trình duyệt gọi cùng origin (cookie refresh `pe_refresh` path=/auth dùng được).
// Đổi đích bằng biến môi trường PE_API_TARGET; build để chạy tách rời thì đặt VITE_API_URL.
const target = process.env.PE_API_TARGET || 'http://localhost:5100';
const proxy = {
  '/api': { target, changeOrigin: false },
  '/auth': { target, changeOrigin: false },
  '/health': { target, changeOrigin: false },
};

// Ngân hàng câu "Đoán output" dùng chung với backend: chỉ mở đúng file đó ngoài thư mục web/ (không mở cả ../server, có .env).
const QUIZ_BANK = resolve(__dirname, '../server/src/arena-quiz/quiz-bank.json');

export default defineConfig({
  server: { proxy, fs: { allow: [searchForWorkspaceRoot(process.cwd()), QUIZ_BANK] } },
  preview: { proxy },
  build: {
    rollupOptions: {
      input: { main: resolve(__dirname, 'index.html'), room3d: resolve(__dirname, 'room3d.html') },
    },
  },
});
