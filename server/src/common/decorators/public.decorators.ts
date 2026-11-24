import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
/** `@Public(false)` trên method đè `@Public()` của class (JwtAuthGuard dùng getAllAndOverride). */
export const Public = (isPublic = true) => SetMetadata(IS_PUBLIC_KEY, isPublic);
