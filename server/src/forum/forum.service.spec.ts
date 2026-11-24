import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { NotificationsService } from 'src/notifications/notifications.service';
import type { NotifyInput } from 'src/notifications/notifications.service';
import type { PrismaService } from 'src/prisma/prisma.service';
import { ForumService } from './forum.service';

/**
 * Trước bộ này, diễn đàn chỉ có 8 ca cho `mention.helper` — toàn bộ
 * `forum.service.ts` (quyền sửa/xoá, bình luận lồng, thông báo, cảm xúc) chạy
 * mà không ca nào giữ hành vi. Khuôn mock giống `courses.service.spec.ts`:
 * kiểu thật ở phần ĐỐI SỐ vì `mock.calls` là bằng chứng, giá trị trả về để
 * `Promise<unknown>` vì mỗi ca tự `mockResolvedValue()`.
 */
type AsyncMock<A extends unknown[] = unknown[]> = jest.Mock<
  Promise<unknown>,
  A
>;
const asyncMock = <A extends unknown[] = unknown[]>(): AsyncMock<A> =>
  jest.fn<Promise<unknown>, A>();

type TruyVan = {
  where?: Record<string, unknown>;
  select?: Record<string, unknown>;
  include?: Record<string, unknown>;
  data?: Record<string, unknown>;
  by?: string[];
  take?: number;
};

type Bang = {
  count: AsyncMock<[TruyVan]>;
  findMany: AsyncMock<[TruyVan]>;
  findUnique: AsyncMock<[TruyVan]>;
  create: AsyncMock<[TruyVan]>;
  update: AsyncMock<[TruyVan]>;
  delete: AsyncMock<[TruyVan]>;
  deleteMany: AsyncMock<[TruyVan]>;
  groupBy: AsyncMock<[TruyVan]>;
};

type PrismaMock = {
  post: Bang;
  comment: Bang;
  postReaction: Bang;
  commentReaction: Bang;
  user: { findMany: AsyncMock<[TruyVan]> };
  $transaction: jest.Mock<Promise<unknown>, [(tx: PrismaMock) => unknown]>;
};

const bang = (): Bang => ({
  count: asyncMock<[TruyVan]>(),
  findMany: asyncMock<[TruyVan]>(),
  findUnique: asyncMock<[TruyVan]>(),
  create: asyncMock<[TruyVan]>(),
  update: asyncMock<[TruyVan]>(),
  delete: asyncMock<[TruyVan]>(),
  deleteMany: asyncMock<[TruyVan]>(),
  groupBy: asyncMock<[TruyVan]>(),
});

const TAC_GIA = { id: 7, name: 'An', avatar: null };
const NGUOI = [TAC_GIA, { id: 8, name: 'Bình', avatar: '/a/8.png' }];
const NGAY = new Date('2026-11-15T00:00:00Z');

const baiViet = (id: number, userId = 7) => ({
  id,
  userId,
  title: `Bài ${id}`,
  content: 'nội dung',
  category: 'discuss',
  likeCount: 0,
  createdAt: NGAY,
  user: TAC_GIA,
  _count: { comments: 0 },
});

const binhLuan = (id: number, parentCommentId: number | null = null) => ({
  id,
  userId: 7,
  postId: 1,
  parentCommentId,
  content: `bình luận ${id}`,
  createdAt: NGAY,
  user: TAC_GIA,
});

/** Hàng `groupBy` của Prisma: `{ postId|commentId, type, _count: { _all } }`. */
const demBai = (postId: number, type: string, n: number) => ({
  postId,
  type,
  _count: { _all: n },
});
const demBl = (commentId: number, type: string, n: number) => ({
  commentId,
  type,
  _count: { _all: n },
});

describe('ForumService', () => {
  let service: ForumService;
  let prisma: PrismaMock;
  let notify: AsyncMock<[NotifyInput]>;

  beforeEach(() => {
    prisma = {
      post: bang(),
      comment: bang(),
      postReaction: bang(),
      commentReaction: bang(),
      user: { findMany: asyncMock<[TruyVan]>() },
      $transaction: jest.fn<Promise<unknown>, [(tx: PrismaMock) => unknown]>(
        (cb) => Promise.resolve(cb(prisma)),
      ),
    };
    for (const b of [
      prisma.post,
      prisma.comment,
      prisma.postReaction,
      prisma.commentReaction,
    ]) {
      b.groupBy.mockResolvedValue([]);
      b.findMany.mockResolvedValue([]);
    }
    // Trả đúng những người được hỏi theo `where.id.in`, như DB thật.
    prisma.user.findMany.mockImplementation((q: TruyVan) => {
      const can = (q.where?.id as { in: number[] }).in;
      return Promise.resolve(NGUOI.filter((u) => can.includes(u.id)));
    });
    notify = asyncMock<[NotifyInput]>();
    notify.mockResolvedValue(undefined);
    service = new ForumService(
      prisma as unknown as PrismaService,
      { notify } as unknown as NotificationsService,
    );
  });

  // ------------------------------------------------------------------------
  describe('BE7: cảm xúc được ĐẾM ở DB, không tải từng hàng', () => {
    it('listPosts KHÔNG include reactions — số hàng không còn tỉ lệ với số cảm xúc', async () => {
      prisma.post.count.mockResolvedValue(1);
      prisma.post.findMany.mockResolvedValue([baiViet(1)]);

      await service.listPosts(7, {});

      const include = prisma.post.findMany.mock.calls[0][0].include;
      expect(include).toBeDefined();
      expect(include).not.toHaveProperty('reactions');
    });

    it('listPosts trả số đếm theo loại và cảm xúc của NGƯỜI XEM, loại 0 không xuất hiện', async () => {
      prisma.post.count.mockResolvedValue(2);
      prisma.post.findMany.mockResolvedValue([baiViet(1), baiViet(2)]);
      prisma.postReaction.groupBy.mockResolvedValue([
        demBai(1, 'like', 120),
        demBai(1, 'love', 3),
        demBai(2, 'haha', 1),
      ]);
      prisma.postReaction.findMany.mockResolvedValue([
        { postId: 1, type: 'love' },
      ]);

      const res = await service.listPosts(7, {});

      expect(res.posts[0].reactions).toEqual({ like: 120, love: 3 });
      expect(res.posts[0].my_reaction).toBe('love');
      expect(res.posts[1].reactions).toEqual({ haha: 1 });
      expect(res.posts[1].my_reaction).toBeNull();
    });

    it('đếm theo (postId, type) cho ĐÚNG các bài của trang, cảm xúc riêng lọc theo người xem', async () => {
      prisma.post.count.mockResolvedValue(2);
      prisma.post.findMany.mockResolvedValue([baiViet(4), baiViet(9)]);

      await service.listPosts(42, {});

      const g = prisma.postReaction.groupBy.mock.calls[0][0];
      expect(g.by).toEqual(['postId', 'type']);
      expect(g.where).toEqual({ postId: { in: [4, 9] } });
      const m = prisma.postReaction.findMany.mock.calls[0][0];
      expect(m.where).toEqual({ userId: 42, postId: { in: [4, 9] } });
    });

    it('tác giả nạp theo userId của từng bài (mỗi người MỘT lần), đúng cột cũ', async () => {
      prisma.post.count.mockResolvedValue(3);
      prisma.post.findMany.mockResolvedValue([
        baiViet(1, 8),
        baiViet(2, 7),
        baiViet(3, 8),
      ]);

      const res = await service.listPosts(7, {});

      expect(res.posts.map((p) => p.author?.name)).toEqual([
        'Bình',
        'An',
        'Bình',
      ]);
      const q = prisma.user.findMany.mock.calls[0][0];
      expect(q.where).toEqual({ id: { in: [8, 7] } });
      expect(q.select).toEqual({ id: true, name: true, avatar: true });
    });

    it('tác giả và số đếm chạy SONG SONG — đếm không chờ nạp tác giả xong', async () => {
      prisma.post.count.mockResolvedValue(1);
      prisma.post.findMany.mockResolvedValue([baiViet(1)]);
      let tra: (v: unknown) => void = () => {};
      prisma.user.findMany.mockReturnValue(
        new Promise((r) => {
          tra = r;
        }),
      );

      const p = service.listPosts(7, {});
      // Nhường vòng sự kiện cho count/findMany xong; nạp tác giả vẫn đang treo.
      for (let i = 0; i < 10; i++) await Promise.resolve();
      expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.postReaction.groupBy).toHaveBeenCalledTimes(1);
      expect(prisma.postReaction.findMany).toHaveBeenCalledTimes(1);
      tra([TAC_GIA]);
      await p;
    });

    it('trang rỗng -> KHÔNG gọi đếm cảm xúc', async () => {
      prisma.post.count.mockResolvedValue(0);
      prisma.post.findMany.mockResolvedValue([]);

      const res = await service.listPosts(7, {});

      expect(res.posts).toEqual([]);
      expect(prisma.postReaction.groupBy).not.toHaveBeenCalled();
      expect(prisma.postReaction.findMany).not.toHaveBeenCalled();
    });

    it('getPostDetail không include reactions và vẫn trả đúng số đếm', async () => {
      prisma.post.findUnique.mockResolvedValue(baiViet(5));
      prisma.postReaction.groupBy.mockResolvedValue([demBai(5, 'wow', 2)]);
      prisma.postReaction.findMany.mockResolvedValue([
        { postId: 5, type: 'wow' },
      ]);

      const res = await service.getPostDetail(7, 5);

      expect(
        prisma.post.findUnique.mock.calls[0][0].include,
      ).not.toHaveProperty('reactions');
      expect(res.post.reactions).toEqual({ wow: 2 });
      expect(res.post.my_reaction).toBe('wow');
    });

    it('listComments: không include reactions, đếm MỘT lần cho cả gốc lẫn reply', async () => {
      prisma.comment.count.mockResolvedValue(1);
      prisma.comment.findMany
        .mockResolvedValueOnce([binhLuan(10)])
        .mockResolvedValueOnce([binhLuan(11, 10), binhLuan(12, 10)]);
      prisma.commentReaction.groupBy.mockResolvedValue([
        demBl(10, 'like', 4),
        demBl(12, 'sad', 1),
      ]);
      prisma.commentReaction.findMany.mockResolvedValue([
        { commentId: 12, type: 'sad' },
      ]);

      const res = await service.listComments(7, 1);

      for (const [q] of prisma.comment.findMany.mock.calls) {
        expect(q.include?.reactions).toBeUndefined();
      }
      expect(prisma.commentReaction.groupBy).toHaveBeenCalledTimes(1);
      expect(prisma.commentReaction.groupBy.mock.calls[0][0].where).toEqual({
        commentId: { in: [10, 11, 12] },
      });
      expect(res.comments[0].reactions).toEqual({ like: 4 });
      expect(res.comments[0].my_reaction).toBeNull();
      expect(res.comments[0].replies.map((r) => r.reactions)).toEqual([
        {},
        { sad: 1 },
      ]);
      expect(res.comments[0].replies[1].my_reaction).toBe('sad');
    });

    it('listComments báo replies_truncated khi chạm trần reply', async () => {
      prisma.comment.count.mockResolvedValue(1);
      const nhieu = Array.from({ length: 200 }, (_, i) =>
        binhLuan(100 + i, 10),
      );
      prisma.comment.findMany
        .mockResolvedValueOnce([binhLuan(10)])
        .mockResolvedValueOnce(nhieu);

      const res = await service.listComments(7, 1);

      expect(prisma.comment.findMany.mock.calls[1][0].take).toBe(200);
      expect(res.replies_truncated).toBe(true);
    });
  });

  // ------------------------------------------------------------------------
  describe('tạo / sửa / xoá bài', () => {
    it('nội dung rỗng -> 400, không ghi DB', async () => {
      await expect(
        service.createPost(7, { content: '   ' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.post.create).not.toHaveBeenCalled();
    });

    it('chuyên mục lạ -> rơi về discuss; nội dung được trim', async () => {
      prisma.post.create.mockResolvedValue({ id: 1 });
      await service.createPost(7, { content: '  xin chào ', category: 'spam' });
      expect(prisma.post.create.mock.calls[0][0].data).toMatchObject({
        userId: 7,
        content: 'xin chào',
        category: 'discuss',
        likeCount: 0,
      });
    });

    it('sửa bài của người khác -> 403', async () => {
      prisma.post.findUnique.mockResolvedValue(baiViet(1, 99));
      await expect(
        service.updatePost(7, false, 1, { content: 'x' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.post.update).not.toHaveBeenCalled();
    });

    it('admin sửa được bài của người khác', async () => {
      prisma.post.findUnique.mockResolvedValue(baiViet(1, 99));
      prisma.post.update.mockResolvedValue({ id: 1 });
      await service.updatePost(7, true, 1, { content: 'sửa' });
      expect(prisma.post.update).toHaveBeenCalledTimes(1);
    });

    it('bài không tồn tại -> 404', async () => {
      prisma.post.findUnique.mockResolvedValue(null);
      await expect(service.deletePost(7, false, 1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('xoá bài: xoá con trước cha (cảm xúc bình luận -> bình luận -> cảm xúc bài -> bài)', async () => {
      prisma.post.findUnique.mockResolvedValue(baiViet(1));
      const thuTu: string[] = [];
      prisma.commentReaction.deleteMany.mockImplementation(() => {
        thuTu.push('commentReaction');
        return Promise.resolve({ count: 0 });
      });
      prisma.comment.deleteMany.mockImplementation(() => {
        thuTu.push('comment');
        return Promise.resolve({ count: 0 });
      });
      prisma.postReaction.deleteMany.mockImplementation(() => {
        thuTu.push('postReaction');
        return Promise.resolve({ count: 0 });
      });
      prisma.post.delete.mockImplementation(() => {
        thuTu.push('post');
        return Promise.resolve({});
      });

      await service.deletePost(7, false, 1);

      expect(thuTu).toEqual([
        'commentReaction',
        'comment',
        'postReaction',
        'post',
      ]);
    });
  });

  // ------------------------------------------------------------------------
  describe('thả cảm xúc cho bài', () => {
    beforeEach(() => {
      prisma.post.findUnique.mockResolvedValue(baiViet(1));
      prisma.postReaction.count.mockResolvedValue(3);
      prisma.postReaction.groupBy.mockResolvedValue([
        { type: 'like', _count: { type: 3 } },
      ]);
    });

    it('loại lạ -> 400, không chạm DB', async () => {
      await expect(
        service.togglePostReaction(7, 1, 'hug'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.post.findUnique).not.toHaveBeenCalled();
    });

    it('chưa có -> thêm, rồi đồng bộ like_count bằng COUNT thật', async () => {
      prisma.postReaction.findUnique.mockResolvedValue(null);
      const res = await service.togglePostReaction(7, 1, 'like');
      expect(prisma.postReaction.create).toHaveBeenCalledTimes(1);
      expect(prisma.post.update.mock.calls[0][0].data).toEqual({
        likeCount: 3,
      });
      expect(res.my_reaction).toBe('like');
    });

    it('cùng loại -> gỡ, my_reaction = null', async () => {
      prisma.postReaction.findUnique.mockResolvedValue({ type: 'like' });
      const res = await service.togglePostReaction(7, 1, 'like');
      expect(prisma.postReaction.delete).toHaveBeenCalledTimes(1);
      expect(res.my_reaction).toBeNull();
    });

    it('khác loại -> đổi loại, không thêm hàng mới', async () => {
      prisma.postReaction.findUnique.mockResolvedValue({ type: 'like' });
      await service.togglePostReaction(7, 1, 'love');
      expect(prisma.postReaction.update.mock.calls[0][0].data).toEqual({
        type: 'love',
      });
      expect(prisma.postReaction.create).not.toHaveBeenCalled();
    });
  });

  // ------------------------------------------------------------------------
  describe('bình luận lồng và thông báo', () => {
    beforeEach(() => {
      prisma.post.findUnique.mockResolvedValue(baiViet(1, 50));
      prisma.comment.create.mockImplementation((q: TruyVan) =>
        Promise.resolve({ id: 900, ...q.data }),
      );
    });

    it('bình luận cha thuộc bài KHÁC -> 400, không tạo bình luận', async () => {
      prisma.comment.findUnique.mockResolvedValue({
        id: 3,
        userId: 8,
        parentCommentId: null,
        postId: 2,
      });
      await expect(
        service.createComment(7, 1, { content: 'hi', parent_comment_id: 3 }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.comment.create).not.toHaveBeenCalled();
    });

    it('trả lời một reply (lồng 2 cấp) -> 400', async () => {
      prisma.comment.findUnique.mockResolvedValue({
        id: 3,
        userId: 8,
        parentCommentId: 2,
        postId: 1,
      });
      await expect(
        service.createComment(7, 1, { content: 'hi', parent_comment_id: 3 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('bình luận cha không tồn tại -> 404', async () => {
      prisma.comment.findUnique.mockResolvedValue(null);
      await expect(
        service.createComment(7, 1, { content: 'hi', parent_comment_id: 3 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('reply: báo chủ bình luận cha, người được @, rồi chủ bài — mỗi người MỘT lần, không tự báo mình', async () => {
      prisma.comment.findUnique.mockResolvedValue({
        id: 3,
        userId: 8,
        parentCommentId: null,
        postId: 1,
      });
      prisma.comment.findMany.mockResolvedValue([
        { user: { id: 7, name: 'An' } },
        { user: { id: 8, name: 'Bình' } },
        { user: { id: 9, name: 'Chi' } },
        { user: { id: 10, name: 'Dũng' } },
      ]);

      await service.createComment(7, 1, {
        content: '@Bình @Chi @An cảm ơn',
        parent_comment_id: 3,
      });

      expect(notify.mock.calls.map(([n]) => [n.userId, n.type])).toEqual([
        [8, 'comment_reply'],
        [9, 'mention'],
        [50, 'post_comment'],
      ]);
    });

    it('chủ bài tự bình luận bài mình -> không nhận thông báo nào', async () => {
      prisma.post.findUnique.mockResolvedValue(baiViet(1, 7));
      await service.createComment(7, 1, { content: 'tự bình' });
      expect(notify).not.toHaveBeenCalled();
    });

    it('chủ bài đã được @ thì KHÔNG nhận thêm post_comment', async () => {
      prisma.comment.findMany.mockResolvedValue([
        { user: { id: 50, name: 'Chủ' } },
      ]);
      await service.createComment(7, 1, { content: 'hỏi @Chủ' });
      expect(notify.mock.calls.map(([n]) => [n.userId, n.type])).toEqual([
        [50, 'mention'],
      ]);
    });

    it('sửa bình luận người khác -> 403', async () => {
      prisma.comment.findUnique.mockResolvedValue({
        ...binhLuan(3),
        userId: 8,
      });
      await expect(
        service.updateComment(7, false, 3, 'x'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
