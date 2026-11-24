import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Throttle, seconds } from '@nestjs/throttler';
import { ThrottleMessage } from 'src/common/decorators/throttle-message.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
// import type: JwtPayload là interface, dùng trong signature có decorator nên
// isolatedModules + emitDecoratorMetadata bắt buộc import dạng type-only.
import type { JwtPayload } from 'src/common/guards/jwt-auth/jwt.strategy';
import { ForumService } from './forum.service';
import {
  CreateCommentDto,
  CreatePostDto,
  ReactDto,
  UpdateCommentDto,
  UpdatePostDto,
} from './dto/forum.dto';

/**
 * Chuẩn hoá tham số ?page= từ query string.
 *
 * Number('abc') = NaN; NaN đi vào phép tính skip khiến Prisma nhận skip: NaN và
 * ném lỗi -> người dùng gõ nhầm URL là nhận 500. Số thập phân hay số âm cũng
 * không hợp lệ. Quy về số nguyên >= 1, và chặn trần để ?page=99999999 không
 * biến thành OFFSET khổng lồ bắt Postgres quét bảng vô ích.
 */
function parsePage(raw?: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 1;
  return Math.min(Math.max(1, Math.floor(n)), 10_000);
}

@Controller()
export class ForumController {
  constructor(private readonly forum: ForumService) {}

  private isAdmin(u: JwtPayload): boolean {
    return u?.role === 'admin';
  }

  // ---------- Task 183 ----------
  @Get('posts')
  list(
    @CurrentUser() user: JwtPayload,
    @Query('category') category?: string,
    @Query('mine') mine?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: string,
  ) {
    return this.forum.listPosts(user.sub, {
      category,
      mine,
      sort,
      page: parsePage(page),
    });
  }

  // ---------- Task 184 ----------
  //
  // Hạn mức RIÊNG cho việc ghi (đè tier 'ip_hour' chỉ cho route này): trước đây
  // tạo bài chỉ chịu quota chung 1 000 lượt/giờ của cả hệ thống, nên một tài
  // khoản — kể cả tài khoản khách tạo tự động — đăng được cả nghìn bài một giờ.
  // CustomThrottlerGuard đếm theo `user:<id>` khi đã đăng nhập, nên cả phòng máy
  // chung một NAT KHÔNG chia nhau quota này. Ngưỡng đọc thẳng process.env vì
  // @Throttle chạy lúc nạp class (xem env.validation.ts).
  @Post('posts')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    ip_hour: {
      limit: Number(process.env.THROTTLE_FORUM_POST_LIMIT ?? 10),
      ttl: seconds(Number(process.env.THROTTLE_FORUM_POST_TTL_SECONDS ?? 600)),
    },
  })
  @ThrottleMessage('Bạn đăng bài hơi nhanh, đợi vài phút rồi thử lại')
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreatePostDto) {
    return this.forum.createPost(user.sub, dto);
  }

  // ---------- Task 185 ----------
  @Get('posts/:id')
  detail(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.forum.getPostDetail(user.sub, id);
  }

  // ---------- Task 186 ----------
  @Put('posts/:id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePostDto,
  ) {
    return this.forum.updatePost(user.sub, this.isAdmin(user), id, dto);
  }

  // ---------- Task 187 ----------
  @Delete('posts/:id')
  @HttpCode(HttpStatus.OK)
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.forum.deletePost(user.sub, this.isAdmin(user), id);
  }

  // ---------- Task 188 ----------
  @Post('posts/:id/react')
  @HttpCode(HttpStatus.OK)
  reactPost(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReactDto,
  ) {
    return this.forum.togglePostReaction(
      user.sub,
      id,
      dto.reaction ?? dto.type ?? '',
    );
  }

  // ---------- Task 189 ----------
  @Get('posts/:id/comments')
  comments(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Query('page') page?: string,
  ) {
    return this.forum.listComments(user.sub, id, parsePage(page));
  }

  // ---------- Task 190 ----------
  // Cao hơn tạo bài vì một cuộc trao đổi thật cần nhiều lượt trả lời liên tiếp.
  @Post('posts/:id/comments')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    ip_hour: {
      limit: Number(process.env.THROTTLE_FORUM_COMMENT_LIMIT ?? 30),
      ttl: seconds(
        Number(process.env.THROTTLE_FORUM_COMMENT_TTL_SECONDS ?? 600),
      ),
    },
  })
  @ThrottleMessage('Bạn bình luận hơi nhanh, đợi vài phút rồi thử lại')
  addComment(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateCommentDto,
  ) {
    return this.forum.createComment(user.sub, id, dto);
  }

  // ---------- Task 191 ----------
  @Post('comments/:id/react')
  @HttpCode(HttpStatus.OK)
  reactComment(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReactDto,
  ) {
    return this.forum.toggleCommentReaction(
      user.sub,
      id,
      dto.reaction ?? dto.type ?? '',
    );
  }

  // ---------- Task 192 ----------
  @Put('comments/:id')
  editComment(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.forum.updateComment(
      user.sub,
      this.isAdmin(user),
      id,
      dto.content,
    );
  }

  // ---------- Task 193 ----------
  @Delete('comments/:id')
  @HttpCode(HttpStatus.OK)
  removeComment(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.forum.deleteComment(user.sub, this.isAdmin(user), id);
  }
}
