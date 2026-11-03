import type { NextConfig } from "next";

// CSP của TRANG (có nonce, đổi theo từng request) do src/proxy.ts sinh. Ở đây
// chỉ còn header tĩnh áp cho mọi phản hồi, kể cả file trong public/.

/** Header bảo mật chung cho mọi đường dẫn. */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Trang không dùng camera, micro, vị trí, thanh toán, USB… — tắt hẳn để
  // script lạ (nếu có) cũng không xin được quyền.
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), " +
      "magnetometer=(), gyroscope=(), accelerometer=(), browsing-topics=(), interest-cohort=()",
  },
  // Cô lập cửa sổ: trang khác mở trang này (window.open) không giữ được tham chiếu.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Tài nguyên của trang chỉ được nhúng bởi chính trang (chặn site khác hotlink/đọc chéo).
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  // Vercel tự gắn Access-Control-Allow-Origin: * cho nội dung tĩnh. Có SITE_URL
  // thì ghi đè bằng đúng origin của site (không site nào khác đọc được qua CORS).
  ...(process.env.SITE_URL
    ? [{ key: "Access-Control-Allow-Origin", value: process.env.SITE_URL.replace(/\/+$/, "") }]
    : []),
];

/**
 * CSP của worker chạy Python (Pyodide). Worker lấy CSP từ chính phản hồi của
 * file .worker.js, nên 'wasm-unsafe-eval' (bắt buộc để biên dịch WebAssembly)
 * chỉ nằm ở đây — CSP của trang không cần nó.
 */
const WORKER_CSP = [
  "default-src 'none'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "connect-src 'self'",
].join("; ");

const nextConfig: NextConfig = {
  turbopack: {
    // Ghim gốc dự án vào chính thư mục frontend/.
    // Turbopack tự dò gốc bằng cách đi ngược lên tìm lockfile; ở repo này thư
    // mục cha (backend NestJS) có package-lock.json nên nó có thể chọn nhầm
    // D:\EDU\PE_nest_next_js làm gốc. Khi đó id module thành
    // "[project]/frontend/src/app/..." lệch với React Client Manifest →
    // /dashboard trả 500 "Could not find the module ... in the React Client
    // Manifest". Ghim cứng ở đây thì id luôn là "[project]/src/app/...".
    root: __dirname,
  },
  // Không quảng cáo framework trong header X-Powered-By.
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/(.*)", headers: SECURITY_HEADERS },
      {
        source: "/static/js/:file(.*\\.worker\\.js)",
        headers: [{ key: "Content-Security-Policy", value: WORKER_CSP }],
      },
    ];
  },
};

export default nextConfig;
