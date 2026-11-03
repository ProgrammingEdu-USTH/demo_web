// Next tự chạy PostCSS khi có file này. Chỉ cần Tailwind 3 (đã có trong
// devDependencies); không thêm autoprefixer vì trình duyệt mục tiêu đều hiện đại.
const config = {
  plugins: {
    tailwindcss: {},
  },
};

export default config;
