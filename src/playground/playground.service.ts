import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MAX_CODE_BYTES, SnippetDto } from './dto/snippet.dto';

export const MAX_SNIPPETS_PER_USER = 50;

const SELECT = {
  id: true,
  title: true,
  language: true,
  code: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class PlaygroundService {
  constructor(private readonly prisma: PrismaService) {}

  // Giới hạn 100KB tính theo BYTE (tiếng Việt có dấu > 1 byte/ký tự).
  private checkSize(code: string) {
    if (Buffer.byteLength(code, 'utf8') > MAX_CODE_BYTES) {
      throw new BadRequestException('Mã nguồn tối đa 100KB');
    }
  }

  async list(userId: number) {
    const snippets = await this.prisma.playgroundSnippet.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: SELECT,
    });
    return { ok: true, snippets };
  }

  async create(userId: number, dto: SnippetDto) {
    this.checkSize(dto.code);
    const count = await this.prisma.playgroundSnippet.count({
      where: { userId },
    });
    if (count >= MAX_SNIPPETS_PER_USER) {
      throw new BadRequestException(
        `Mỗi người chỉ lưu tối đa ${MAX_SNIPPETS_PER_USER} đoạn mã`,
      );
    }
    const snippet = await this.prisma.playgroundSnippet.create({
      data: {
        userId,
        title: dto.title,
        language: dto.language,
        code: dto.code,
      },
      select: SELECT,
    });
    return { ok: true, snippet };
  }

  async update(userId: number, id: number, dto: SnippetDto) {
    this.checkSize(dto.code);
    // updateMany kèm userId: không thể sửa đoạn mã của người khác.
    const { count } = await this.prisma.playgroundSnippet.updateMany({
      where: { id, userId },
      data: { title: dto.title, language: dto.language, code: dto.code },
    });
    if (!count) throw new NotFoundException('Không tìm thấy đoạn mã');
    const snippet = await this.prisma.playgroundSnippet.findFirstOrThrow({
      where: { id, userId },
      select: SELECT,
    });
    return { ok: true, snippet };
  }

  async remove(userId: number, id: number) {
    const { count } = await this.prisma.playgroundSnippet.deleteMany({
      where: { id, userId },
    });
    if (!count) throw new NotFoundException('Không tìm thấy đoạn mã');
    return { ok: true };
  }
}
