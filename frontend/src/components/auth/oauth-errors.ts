// Thông báo lỗi OAuth backend gắn vào ?error=
export const OAUTH_ERRORS: Record<string, string> = {
  email_exists: 'Email này đã được đăng ký bằng mật khẩu. Vui lòng đăng nhập bằng mật khẩu.',
  google_failed: 'Đăng nhập Google thất bại. Vui lòng thử lại.',
  facebook_failed: 'Đăng nhập Facebook thất bại. Vui lòng thử lại.',
};
