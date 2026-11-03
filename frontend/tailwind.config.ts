import type { Config } from 'tailwindcss';

// Token thiết kế (design/SYSTEM.md). Màu đọc từ biến CSS `--ui-*` trong
// src/app/globals.css dạng "R G B" để dùng được độ trong (bg-primary/10) và để
// chế độ tối chỉ cần đổi biến, không cần viết `dark:` ở từng component.
const tokenColor = (name: string) => `rgb(var(--ui-${name}) / <alpha-value>)`;

const config: Config = {
  content: ['./src/**/*.{ts,tsx,js,jsx,mdx}'],
  // Cơ chế sáng/tối có sẵn gắn class `dark` lên <body> (script chống nháy ở
  // layout.tsx + main.js) → dùng đúng class đó để `dark:` khớp với trang cũ.
  darkMode: ['selector', 'body.dark'],
  corePlugins: {
    // TẮT preflight: CSS legacy (/static/css/*) dựa vào style mặc định của trình
    // duyệt; preflight toàn cục sẽ xoá margin/viền nút… và làm vỡ các trang chưa
    // chuyển. Thay bằng reset có phạm vi `.ui-scope` trong globals.css.
    preflight: false,
    // Legacy có class `.container` riêng → không sinh utility trùng tên.
    container: false,
  },
  theme: {
    extend: {
      colors: {
        // Giữ nguyên bảng màu mặc định (gray/blue…) vì nội dung bài học cũ đang
        // dùng; component mới CHỈ dùng các tên token dưới đây.
        bg: tokenColor('bg'),
        surface: {
          DEFAULT: tokenColor('surface'),
          2: tokenColor('surface-2'),
          3: tokenColor('surface-3'),
        },
        border: {
          DEFAULT: tokenColor('border'),
          strong: tokenColor('border-strong'),
        },
        fg: {
          DEFAULT: tokenColor('fg'),
          muted: tokenColor('fg-muted'),
        },
        primary: {
          DEFAULT: tokenColor('primary'),
          hover: tokenColor('primary-hover'),
          fg: tokenColor('primary-fg'),
          soft: tokenColor('primary-soft'),
          'soft-fg': tokenColor('primary-soft-fg'),
        },
        accent: {
          DEFAULT: tokenColor('accent'),
          soft: tokenColor('accent-soft'),
          'soft-fg': tokenColor('accent-soft-fg'),
        },
        success: {
          DEFAULT: tokenColor('success'),
          soft: tokenColor('success-soft'),
          'soft-fg': tokenColor('success-soft-fg'),
        },
        danger: {
          DEFAULT: tokenColor('danger'),
          hover: tokenColor('danger-hover'),
          fg: tokenColor('danger-fg'),
          soft: tokenColor('danger-soft'),
          'soft-fg': tokenColor('danger-soft-fg'),
        },
        warning: {
          DEFAULT: tokenColor('warning'),
          soft: tokenColor('warning-soft'),
          'soft-fg': tokenColor('warning-soft-fg'),
        },
        info: {
          DEFAULT: tokenColor('info'),
          soft: tokenColor('info-soft'),
          'soft-fg': tokenColor('info-soft-fg'),
        },
        ring: tokenColor('ring'),
        overlay: tokenColor('overlay'),
      },
      fontFamily: {
        // Biến do next/font tạo (src/components/ui/fonts.ts); chuỗi dự phòng có
        // font hệ thống hiển thị tốt dấu tiếng Việt.
        sans: ['var(--font-ui)', 'system-ui', '"Segoe UI"', 'Roboto', 'Arial', 'sans-serif'],
        mono: ['var(--font-code)', 'ui-monospace', '"Cascadia Code"', 'Consolas', 'monospace'],
      },
      fontSize: {
        // Thang ít bậc; line-height rộng hơn mặc định vì dấu tiếng Việt chồng tầng.
        xs: ['0.75rem', { lineHeight: '1.125rem' }],
        sm: ['0.875rem', { lineHeight: '1.375rem' }],
        base: ['1rem', { lineHeight: '1.625rem' }],
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.375rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.75rem' }],
      },
      borderRadius: {
        // sm 6: input/badge · md 10: nút/thẻ nhỏ · lg 16: thẻ lớn/hộp thoại.
        sm: '6px',
        md: '10px',
        lg: '16px',
      },
      boxShadow: {
        // Bóng ấm, nhẹ; chế độ tối gần như vô hình nên component dùng thêm viền.
        xs: '0 1px 2px rgb(var(--ui-shadow) / 0.06)',
        sm: '0 1px 3px rgb(var(--ui-shadow) / 0.08), 0 1px 2px rgb(var(--ui-shadow) / 0.04)',
        md: '0 4px 12px rgb(var(--ui-shadow) / 0.10), 0 2px 4px rgb(var(--ui-shadow) / 0.05)',
        lg: '0 12px 32px rgb(var(--ui-shadow) / 0.16), 0 4px 8px rgb(var(--ui-shadow) / 0.06)',
      },
      maxWidth: {
        prose: '72ch',
        page: '1200px',
      },
      spacing: {
        // Chiều cao thanh điều hướng — để nội dung/toast chừa chỗ.
        topbar: '3.5rem',
        bottomnav: '4rem',
        sidebar: '15rem',
      },
      transitionDuration: {
        fast: '120ms',
        base: '180ms',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
      keyframes: {
        'ui-fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'ui-pop-in': {
          from: { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
          to: { opacity: '1', transform: 'none' },
        },
        'ui-slide-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'none' } },
        'ui-slide-left': { from: { transform: 'translateX(100%)' }, to: { transform: 'none' } },
        'ui-slide-right': { from: { transform: 'translateX(-100%)' }, to: { transform: 'none' } },
        'ui-caret':{ '0%,49%': { opacity: '1' }, '50%,100%': { opacity: '0' } },
      },
      animation: {
        'fade-in': 'ui-fade-in 180ms cubic-bezier(0.2,0.8,0.2,1)',
        'pop-in': 'ui-pop-in 180ms cubic-bezier(0.2,0.8,0.2,1)',
        'slide-up': 'ui-slide-up 220ms cubic-bezier(0.2,0.8,0.2,1)',
        'slide-left': 'ui-slide-left 220ms cubic-bezier(0.2,0.8,0.2,1)',
        'slide-right': 'ui-slide-right 220ms cubic-bezier(0.2,0.8,0.2,1)',
        caret:'ui-caret 1.1s steps(1) infinite',
      },
    },
  },
  plugins: [],
};

export default config;
