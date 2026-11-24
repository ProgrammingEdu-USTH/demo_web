import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from 'src/generated/prisma';
import { PrismaService } from 'src/prisma/prisma.service';
import { TX_OPTIONS } from 'src/common/prisma-tx.options';
import { NotificationsService } from 'src/notifications/notifications.service';
import { isNameMentioned } from './mention.helper';

const REACTION_TYPES = ['like', 'love', 'haha', 'wow', 'sad', 'angry'] as const;
const CATEGORIES = ['discuss', 'question', 'share', 'help'] as const;
const DEFAULT_CATEGORY = 'discuss';
const PAGE_SIZE = 20;
/** Trần số reply nạp kèm một trang bình luận — chặn bài viết bị spam làm cạn RAM. */
const MAX_REPLIES_PER_PAGE = 200;

/** Cảm xúc của MỘT bài/bình luận như response trả ra: số đếm theo loại + của người xem. */
type CamXuc = { reactions: Record<string, number>; my: string | null };
type TacGia = { id: number; name: string | null; avatar: string | null };

/**
 * Ghép kết quả `groupBy` (số đếm) và cảm xúc của người xem thành Map theo id.
 * Mọi id đều có mục — bài chưa ai thả cảm xúc vẫn ra `{ reactions: {}, my: null }`,
 * đúng như `countByType([])` trước đây; loại có 0 lượt KHÔNG xuất hiện (FE tự điền 0).
 */
function gopCamXuc(
  ids: number[],
  dem: Array<{ id: number; type: string; n: number }>,
  cuaToi: Array<{ id: number; type: string }>,
): Map<number, CamXuc> {
  const out = new Map<number, CamXuc>(
    ids.map((id) => [id, { reactions: {}, my: null }]),
  );
  for (const d of dem) {
    const cx = out.get(d.id);
    if (cx) cx.reactions[d.type] = d.n;
  }
  for (const m of cuaToi) {
    const cx = out.get(m.id);
    if (cx) cx.my = m.type;
  }
  return out;
}

@Injectable()
export class ForumService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // ---------- Task 165-167 ----------
  async listPosts(
    userId: number,
    opts: { category?: string; mine?: string; sort?: string; page?: number },
  ) {
    const page = Math.max(1, opts.page ?? 1);
    const skip = (page - 1) * PAGE_SIZE;

    const where: Prisma.PostWhereInput = {};
    if (
      opts.category &&
      (CATEGORIES as readonly string[]).includes(opts.category)
    ) {
      where.category = opts.category;
    }
    if (opts.mine === '1' || opts.mine === 'true') where.userId = userId;

    const orderBy: Prisma.PostOrderByWithRelationInput =
      opts.sort === 'oldest'
        ? { createdAt: 'asc' }
        : opts.sort === 'likes'
          ? { likeCount: 'desc' }
          : { createdAt: 'desc' };

    const [total, posts] = await Promise.all([
      this.prisma.post.count({ where }),
      this.prisma.post.findMany({
        where,
        orderBy,
        skip,
        take: PAGE_SIZE,
        include: { _count: { select: { comments: true } } },
      }),
    ]);

    // Tác giả nạp TỰ TAY thay vì `include: { user }`, để chạy SONG SONG với hai
    // truy vấn đếm cảm xúc. Để Prisma include thì nó nạp user thành một vòng riêng
    // NGAY SAU posts, và việc đếm chỉ bắt đầu sau vòng đó — đo được: thêm một vòng
    // tuần tự so với bản cũ.
    const [tacGia, camXuc] = await Promise.all([
      this.layTacGia(posts.map((p) => p.userId)),
      this.demCamXucBai(
        posts.map((p) => p.id),
        userId,
      ),
    ]);

    return {
      ok: true,
      total,
      page,
      page_size: PAGE_SIZE,
      posts: posts.map((p) =>
        this.mapPost(p, tacGia.get(p.userId), camXuc.get(p.id)),
      ),
    };
  }

  // ---------- Task 168 ----------
  async createPost(
    userId: number,
    dto: { content?: string; title?: string; category?: string },
  ) {
    if (!dto.content?.trim()) {
      throw new BadRequestException('Nội dung bài viết không được để trống');
    }

    const category =
      dto.category && (CATEGORIES as readonly string[]).includes(dto.category)
        ? dto.category
        : DEFAULT_CATEGORY;

    const post = await this.prisma.post.create({
      data: {
        userId,
        title: dto.title ?? null,
        content: dto.content.trim(),
        category,
        likeCount: 0,
      },
    });
    return { ok: true, post };
  }

  // ---------- Task 169 ----------
  async getPostDetail(userId: number, postId: number) {
    // id đã biết từ URL nên đếm cảm xúc chạy song song với chính truy vấn bài.
    // Bài không tồn tại thì lượt đếm đó phí, nhưng nó chỉ là một groupBy rỗng.
    const [post, camXuc] = await Promise.all([
      this.prisma.post.findUnique({
        where: { id: postId },
        include: {
          user: { select: { id: true, name: true, avatar: true } },
          _count: { select: { comments: true } },
        },
      }),
      this.demCamXucBai([postId], userId),
    ]);
    if (!post) throw new NotFoundException('Không tìm thấy bài viết');

    return {
      ok: true,
      post: this.mapPost(post, post.user, camXuc.get(post.id)),
    };
  }

  // ---------- Task 170 ----------
  async updatePost(
    userId: number,
    isAdmin: boolean,
    postId: number,
    dto: { content?: string; title?: string; category?: string },
  ) {
    const post = await this.requirePostOwnership(userId, isAdmin, postId);

    const data: Prisma.PostUpdateInput = {};
    if (dto.content !== undefined) {
      if (!dto.content.trim()) {
        throw new BadRequestException('Nội dung bài viết không được để trống');
      }
      data.content = dto.content.trim();
    }
    if (dto.title !== undefined) data.title = dto.title;
    if (
      dto.category &&
      (CATEGORIES as readonly string[]).includes(dto.category)
    ) {
      data.category = dto.category;
    }

    const updated = await this.prisma.post.update({
      where: { id: post.id },
      data,
    });
    return { ok: true, post: updated };
  }

  async deletePost(userId: number, isAdmin: boolean, postId: number) {
    const post = await this.requirePostOwnership(userId, isAdmin, postId);

    await this.prisma.$transaction(async (tx) => {
      await tx.commentReaction.deleteMany({
        where: { comment: { postId: post.id } },
      });
      await tx.comment.deleteMany({ where: { postId: post.id } });
      await tx.postReaction.deleteMany({ where: { postId: post.id } });
      await tx.post.delete({ where: { id: post.id } });
    }, TX_OPTIONS);

    return { ok: true };
  }

  // ---------- Task 171-173 ----------
  async togglePostReaction(userId: number, postId: number, type: string) {
    // Bước 1: chỉ chấp nhận 6 loại hợp lệ.
    if (!(REACTION_TYPES as readonly string[]).includes(type)) {
      throw new BadRequestException('Loại cảm xúc không hợp lệ');
    }

    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Không tìm thấy bài viết');

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.postReaction.findUnique({
        where: { userId_postId: { userId, postId } },
      });

      // Bước 2: cùng loại -> gỡ; khác loại -> đổi; chưa có -> thêm.
      let myReaction: string | null = type;
      if (existing?.type === type) {
        await tx.postReaction.delete({
          where: { userId_postId: { userId, postId } },
        });
        myReaction = null;
      } else if (existing) {
        await tx.postReaction.update({
          where: { userId_postId: { userId, postId } },
          data: { type },
        });
      } else {
        await tx.postReaction.create({ data: { userId, postId, type } });
      }

      // Bước 3: đồng bộ lại like_count = COUNT(*) thực tế (CHỈ áp cho post).
      const likeCount = await tx.postReaction.count({ where: { postId } });
      await tx.post.update({ where: { id: postId }, data: { likeCount } });

      const reactions = await tx.postReaction.groupBy({
        by: ['type'],
        where: { postId },
        _count: { type: true },
      });

      return {
        ok: true,
        my_reaction: myReaction,
        like_count: likeCount,
        reactions: Object.fromEntries(
          reactions.map((r) => [r.type, r._count.type]),
        ),
      };
    }, TX_OPTIONS);
  }

  async toggleCommentReaction(userId: number, commentId: number, type: string) {
    if (!(REACTION_TYPES as readonly string[]).includes(type)) {
      throw new BadRequestException('Loại cảm xúc không hợp lệ');
    }

    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!comment) throw new NotFoundException('Không tìm thấy bình luận');

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.commentReaction.findUnique({
        where: { commentId_userId: { commentId, userId } },
      });

      let myReaction: string | null = type;
      if (existing?.type === type) {
        await tx.commentReaction.delete({
          where: { commentId_userId: { commentId, userId } },
        });
        myReaction = null;
      } else if (existing) {
        await tx.commentReaction.update({
          where: { commentId_userId: { commentId, userId } },
          data: { type },
        });
      } else {
        await tx.commentReaction.create({ data: { userId, commentId, type } });
      }

      // KHÔNG đồng bộ like_count ở đây — comment không có cột đếm riêng (task 173).
      const reactions = await tx.commentReaction.groupBy({
        by: ['type'],
        where: { commentId },
        _count: { type: true },
      });

      return {
        ok: true,
        my_reaction: myReaction,
        reactions: Object.fromEntries(
          reactions.map((r) => [r.type, r._count.type]),
        ),
      };
    }, TX_OPTIONS);
  }

  // ---------- Task 174-175 ----------
  async listComments(userId: number, postId: number, page = 1) {
    const skip = (Math.max(1, page) - 1) * PAGE_SIZE;

    // Bước 1+2 chạy SONG SONG (trước đây 3 await tuần tự = 3 round-trip nối đuôi
    // tới Neon): total đếm theo comment GỐC; roots lấy comment gốc theo trang.
    const [total, roots] = await Promise.all([
      this.prisma.comment.count({
        where: { postId, parentCommentId: null },
      }),
      this.prisma.comment.findMany({
        where: { postId, parentCommentId: null },
        orderBy: { createdAt: 'asc' },
        skip,
        take: PAGE_SIZE,
      }),
    ]);

    // Bước 3: reply của các comment gốc — reply đi kèm cha, không phân trang riêng.
    //
    // CÓ TRẦN (take): trước đây truy vấn này không giới hạn số dòng. Một bài
    // viết bị spam vài chục nghìn reply sẽ kéo toàn bộ về kèm quan hệ user +
    // reactions cho từng dòng — đủ để làm cạn RAM và treo tiến trình chỉ bằng
    // một lần mở bài viết đó. Trần này giữ nguyên hình dạng response (không phá
    // frontend) nhưng chặn được trường hợp cực đoan.
    const replies = roots.length
      ? await this.prisma.comment.findMany({
          where: { parentCommentId: { in: roots.map((r) => r.id) } },
          orderBy: { createdAt: 'asc' },
          take: MAX_REPLIES_PER_PAGE,
        })
      : [];

    // MỘT lượt cho cả gốc lẫn reply: tác giả và cảm xúc nạp song song, thay vì
    // Prisma include nạp user + reactions thành vòng riêng sau MỖI truy vấn
    // bình luận (gốc, rồi reply).
    const tatCa = [...roots, ...replies];
    const [tacGia, camXuc] = await Promise.all([
      this.layTacGia(tatCa.map((c) => c.userId)),
      this.demCamXucBinhLuan(
        tatCa.map((c) => c.id),
        userId,
      ),
    ]);

    return {
      ok: true,
      total,
      page: Math.max(1, page),
      // Báo cho client biết danh sách reply đã bị cắt bớt để còn hiển thị
      // "xem thêm" thay vì âm thầm giấu nội dung.
      replies_truncated: replies.length >= MAX_REPLIES_PER_PAGE,
      comments: roots.map((r) => ({
        ...this.mapComment(r, tacGia.get(r.userId), camXuc.get(r.id)),
        replies: replies
          .filter((x) => x.parentCommentId === r.id)
          .map((x) =>
            this.mapComment(x, tacGia.get(x.userId), camXuc.get(x.id)),
          ),
      })),
    };
  }

  // ---------- Task 176-177 ----------
  async createComment(
    userId: number,
    postId: number,
    dto: { content?: string; parent_comment_id?: number },
  ) {
    if (!dto.content?.trim()) {
      throw new BadRequestException('Nội dung bình luận không được để trống');
    }

    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Không tìm thấy bài viết');

    let parent: {
      id: number;
      userId: number;
      parentCommentId: number | null;
      postId: number;
    } | null = null;
    if (dto.parent_comment_id) {
      parent = await this.prisma.comment.findUnique({
        where: { id: dto.parent_comment_id },
        select: { id: true, userId: true, parentCommentId: true, postId: true },
      });
      if (!parent || parent.id === undefined) {
        throw new NotFoundException('Không tìm thấy bình luận cha');
      }
      // Bình luận cha PHẢI thuộc đúng bài viết trong URL.
      //
      // Trước đây chỉ tra theo id nên gửi POST /api/posts/<bài A>/comments với
      // parent_comment_id của một bình luận thuộc bài B sẽ tạo ra bình luận có
      // postId = A nhưng parentCommentId trỏ sang thread của B: nội dung hiện
      // sai chỗ, số đếm bình luận của cả hai bài đều lệch, và chủ bình luận bên
      // B nhận thông báo về một bài họ chưa từng tham gia.
      if (parent.postId !== postId) {
        throw new BadRequestException('Bình luận cha không thuộc bài viết này');
      }
      // CHỈ cho lồng 1 cấp — reply của reply bị chặn.
      if (parent.parentCommentId !== null) {
        throw new BadRequestException('Chỉ hỗ trợ trả lời 1 cấp');
      }
    }

    const comment = await this.prisma.$transaction(async (tx) => {
      return tx.comment.create({
        data: {
          userId,
          postId,
          parentCommentId: parent?.id ?? null,
          content: dto.content!.trim(),
        },
      });
    }, TX_OPTIONS);

    // Gửi thông báo NGOÀI transaction: thông báo lỗi không được phép rollback
    // bình luận đã tạo thành công.
    await this.notifyMentions({
      actorId: userId,
      postId,
      postOwnerId: post.userId,
      commentId: comment.id,
      content: comment.content ?? '',
      parentOwnerId: parent?.userId ?? null,
    });

    return { ok: true, comment };
  }

  // ---------- Task 178 ----------
  async updateComment(
    userId: number,
    isAdmin: boolean,
    commentId: number,
    content?: string,
  ) {
    const comment = await this.requireCommentOwnership(
      userId,
      isAdmin,
      commentId,
    );
    if (!content?.trim()) {
      throw new BadRequestException('Nội dung bình luận không được để trống');
    }

    const updated = await this.prisma.comment.update({
      where: { id: comment.id },
      data: { content: content.trim() },
    });
    return { ok: true, comment: updated };
  }

  async deleteComment(userId: number, isAdmin: boolean, commentId: number) {
    const comment = await this.requireCommentOwnership(
      userId,
      isAdmin,
      commentId,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.commentReaction.deleteMany({
        where: {
          comment: {
            OR: [{ id: comment.id }, { parentCommentId: comment.id }],
          },
        },
      });
      await tx.comment.deleteMany({ where: { parentCommentId: comment.id } });
      await tx.comment.delete({ where: { id: comment.id } });
    }, TX_OPTIONS);

    return { ok: true };
  }

  // ---------- Task 180-182 ----------
  private async notifyMentions(ctx: {
    actorId: number;
    postId: number;
    postOwnerId: number;
    commentId: number;
    content: string;
    parentOwnerId: number | null;
  }) {
    const notified = new Set<number>([ctx.actorId]); // không tự thông báo cho mình

    // Bước 1: nếu là reply -> báo cho chủ comment cha.
    if (ctx.parentOwnerId && !notified.has(ctx.parentOwnerId)) {
      await this.notifications.notify({
        userId: ctx.parentOwnerId,
        type: 'comment_reply',
        title: '1 trả lời mới cho bình luận của bạn',
        refType: 'post',
        refId: ctx.postId,
      });
      notified.add(ctx.parentOwnerId);
    }

    // Bước 2: quét người tham gia thread, tìm @mention theo ranh giới từ.
    const participants = await this.prisma.comment.findMany({
      where: { postId: ctx.postId },
      select: { user: { select: { id: true, name: true } } },
      distinct: ['userId'],
    });

    for (const p of participants) {
      const u = p.user;
      if (notified.has(u.id) || !u.name) continue;
      if (!isNameMentioned(ctx.content, u.name)) continue;

      await this.notifications.notify({
        userId: u.id,
        type: 'mention',
        title: '1 lượt nhắc đến bạn',
        refType: 'post',
        refId: ctx.postId,
      });
      notified.add(u.id);
    }

    // Bước 3: báo chủ bài viết NẾU chưa nhận thông báo nào ở trên.
    if (!notified.has(ctx.postOwnerId)) {
      await this.notifications.notify({
        userId: ctx.postOwnerId,
        type: 'post_comment',
        title: '1 bình luận mới trong bài viết của bạn',
        refType: 'post',
        refId: ctx.postId,
      });
    }
  }

  // ---------- helpers ----------

  private async requirePostOwnership(
    userId: number,
    isAdmin: boolean,
    postId: number,
  ) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Không tìm thấy bài viết');
    if (post.userId !== userId && !isAdmin) {
      throw new ForbiddenException('Không có quyền thao tác với bài viết này');
    }
    return post;
  }

  private async requireCommentOwnership(
    userId: number,
    isAdmin: boolean,
    commentId: number,
  ) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!comment) throw new NotFoundException('Không tìm thấy bình luận');
    if (comment.userId !== userId && !isAdmin) {
      throw new ForbiddenException('Không có quyền thao tác với bình luận này');
    }
    return comment;
  }

  /**
   * Số cảm xúc theo loại + cảm xúc của người xem cho một loạt bài, đếm Ở DB.
   *
   * Trước đây danh sách/chi tiết `include` MỌI hàng `post_likes` của từng bài rồi
   * đếm trong Node: số hàng kéo về tỉ lệ với số CẢM XÚC chứ không với số bài, nên
   * một bài 1 000 cảm xúc là 1 000 hàng cho một thẻ trong danh sách. `groupBy` trả
   * tối đa 6 hàng mỗi bài (6 loại), còn cảm xúc của người xem tối đa 1 hàng mỗi bài
   * (khoá chính `(user_id, post_id)`). Hai truy vấn chạy song song nên chỉ tốn MỘT
   * vòng — đúng bằng vòng mà `include` cũ vẫn tốn riêng.
   */
  private async demCamXucBai(
    ids: number[],
    userId: number,
  ): Promise<Map<number, CamXuc>> {
    if (!ids.length) return new Map();
    const [dem, cuaToi] = await Promise.all([
      this.prisma.postReaction.groupBy({
        by: ['postId', 'type'],
        where: { postId: { in: ids } },
        _count: { _all: true },
      }),
      this.prisma.postReaction.findMany({
        where: { userId, postId: { in: ids } },
        select: { postId: true, type: true },
      }),
    ]);
    return gopCamXuc(
      ids,
      dem.map((d) => ({ id: d.postId, type: d.type, n: d._count._all })),
      cuaToi.map((m) => ({ id: m.postId, type: m.type })),
    );
  }

  /** Tên + ảnh của các tác giả, theo id — đúng các cột `include: { user }` cũ chọn. */
  private async layTacGia(ids: number[]): Promise<Map<number, TacGia>> {
    if (!ids.length) return new Map();
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(ids)] } },
      select: { id: true, name: true, avatar: true },
    });
    return new Map(users.map((u) => [u.id, u]));
  }

  /** Như `demCamXucBai`, cho bình luận (`comment_likes`). */
  private async demCamXucBinhLuan(
    ids: number[],
    userId: number,
  ): Promise<Map<number, CamXuc>> {
    if (!ids.length) return new Map();
    const [dem, cuaToi] = await Promise.all([
      this.prisma.commentReaction.groupBy({
        by: ['commentId', 'type'],
        where: { commentId: { in: ids } },
        _count: { _all: true },
      }),
      this.prisma.commentReaction.findMany({
        where: { userId, commentId: { in: ids } },
        select: { commentId: true, type: true },
      }),
    ]);
    return gopCamXuc(
      ids,
      dem.map((d) => ({ id: d.commentId, type: d.type, n: d._count._all })),
      cuaToi.map((m) => ({ id: m.commentId, type: m.type })),
    );
  }

  private mapPost(
    p: {
      id: number;
      title: string | null;
      content: string | null;
      category: string | null;
      likeCount: number;
      createdAt: Date;
      _count: { comments: number };
    },
    author: TacGia | undefined,
    cx: CamXuc | undefined,
  ) {
    return {
      id: p.id,
      title: p.title,
      content: p.content,
      category: p.category,
      likeCount: p.likeCount,
      createdAt: p.createdAt,
      // `posts.user_id` là khoá ngoại tới users nên tác giả luôn có; `?? null`
      // chỉ để kiểu khỏi nói dối khi không có.
      author: author ?? null,
      reactions: cx?.reactions ?? {},
      my_reaction: cx?.my ?? null,
      comment_count: p._count.comments,
    };
  }

  private mapComment(
    c: {
      id: number;
      parentCommentId: number | null;
      content: string | null;
      createdAt: Date;
    },
    author: TacGia | undefined,
    cx: CamXuc | undefined,
  ) {
    return {
      id: c.id,
      content: c.content,
      createdAt: c.createdAt,
      parentCommentId: c.parentCommentId,
      author: author ?? null,
      reactions: cx?.reactions ?? {},
      my_reaction: cx?.my ?? null,
    };
  }
}
