import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Ghép class có điều kiện + gộp class Tailwind xung đột (class truyền sau thắng).
 * Vì sao cần twMerge: component nhận `className` từ ngoài; không gộp thì
 * `px-4` mặc định và `px-6` truyền vào cùng tồn tại, kết quả phụ thuộc thứ tự CSS.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
