import { WerkzeugScryptHasher } from './werkzeug-scrypt-hasher';
import { WerkzeugPBKDF2Hasher } from './werkzeug-pbkdf2-hasher';

/**
 * Chỉ chấp nhận mật khẩu đã hash (scrypt:/pbkdf2:). Nhánh so sánh plaintext
 * legacy đã bị gỡ sau khi scripts/migrate-legacy-passwords.ts xác nhận DB
 * không còn dòng nào chưa hash. Mật khẩu rỗng (tài khoản OAuth) hay định dạng
 * lạ đều trả false.
 */
export async function checkPassword(
  stored: string,
  raw: string,
): Promise<boolean> {
  if (stored.startsWith('scrypt:')) {
    return WerkzeugScryptHasher.verify(raw, stored);
  }
  if (stored.startsWith('pbkdf2:')) {
    return WerkzeugPBKDF2Hasher.verify(raw, stored);
  }
  return false;
}
