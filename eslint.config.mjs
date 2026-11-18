import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Ảnh trong phòng là các lớp cắt đặt đúng pixel room-space (2752×1536), CSS nhắm theo id/class
    // và dùng làm mask; next/image (bọc, đổi src, lazy) không hợp ở đây.
    // (trang con: khung điện thoại vẽ tay là lớp phủ tuyệt đối theo đúng tỉ lệ ảnh, cùng lý do)
    files: ["src/features/goc-hoc/scene/**", "src/features/goc-hoc/pages/**"],
    rules: { "@next/next/no-img-element": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // báo cáo Playwright sinh ra (trace viewer đã minify)
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
