import {
  Inject,
  Injectable,
  Logger,
  BadGatewayException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import geminiConfig from 'src/config/gemini.config';
import { ChatMessageDto, MAX_IMAGE_BASE64 } from './dto/chatbot.dto';

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; status?: string };
}

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);

  constructor(
    @Inject(geminiConfig.KEY)
    private readonly config: ConfigType<typeof geminiConfig>,
  ) {}

  get enabled(): boolean {
    return this.config.apiKey.length > 0;
  }

  status() {
    return { ok: true, enabled: this.enabled, model: this.config.model };
  }

  async chat(dto: ChatMessageDto) {
    const text = dto.message?.trim() ?? '';

    if (!text && !dto.image) {
      throw new BadRequestException('Hãy nhập câu hỏi hoặc đính kèm hình ảnh');
    }
    if (text.length > this.config.maxChars) {
      throw new BadRequestException(
        `Câu hỏi quá dài (tối đa ${this.config.maxChars} ký tự)`,
      );
    }
    if (dto.image) {
      if (dto.image.length > MAX_IMAGE_BASE64) {
        throw new BadRequestException('Ảnh quá lớn, hãy dùng ảnh dưới 500KB');
      }
      // Chuỗi base64 hỏng sẽ bị Google trả 400 kèm nội dung khó hiểu —
      // chặn tại đây cho thông báo rõ ràng.
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(dto.image)) {
        throw new BadRequestException('Dữ liệu ảnh không hợp lệ');
      }
    }

    // Chưa cấu hình key: 503 để frontend hiện "trợ lý tạm nghỉ" thay vì báo
    // lỗi chung chung. App vẫn boot bình thường khi thiếu key (xem
    // env.validation.ts) — chatbot chỉ là tính năng phụ.
    if (!this.enabled) {
      throw new ServiceUnavailableException(
        'Trợ lý AI chưa được cấu hình. Vui lòng liên hệ quản trị viên.',
      );
    }

    const parts: GeminiPart[] = [];
    if (text) parts.push({ text });
    if (dto.image) {
      parts.push({
        inlineData: {
          mimeType: dto.mimeType ?? 'image/jpeg',
          data: dto.image,
        },
      });
    }

    const contents = [
      ...(dto.history ?? []).map((turn) => ({
        role: turn.role,
        parts: [{ text: turn.text }],
      })),
      { role: 'user', parts },
    ];

    const body = {
      contents,
      systemInstruction: { parts: [{ text: this.config.systemPrompt }] },
      generationConfig: { maxOutputTokens: 2048, temperature: 0.7 },
    };

    let res: Response;
    try {
      res = await fetch(
        `${this.config.baseUrl}/${this.config.model}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Key đi trong header, KHÔNG nhét vào query string: URL bị ghi vào
            // access log / proxy log là key rò ra ngoài.
            'x-goog-api-key': this.config.apiKey,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(this.config.timeoutMs),
        },
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Gọi Gemini thất bại: ${msg}`);
      throw new BadGatewayException(
        'Không kết nối được trợ lý AI. Vui lòng thử lại sau.',
      );
    }

    const data = (await res.json().catch(() => null)) as GeminiResponse | null;

    if (!res.ok) {
      // Log chi tiết ở server; client chỉ nhận thông báo chung — thông điệp lỗi
      // của Google có thể lộ model/quota/cấu hình nội bộ.
      this.logger.error(
        `Gemini HTTP ${res.status}: ${data?.error?.message ?? 'không rõ'}`,
      );
      if (res.status === 429) {
        throw new BadGatewayException(
          'Trợ lý AI đang quá tải. Vui lòng thử lại sau ít phút.',
        );
      }
      throw new BadGatewayException('Trợ lý AI gặp sự cố. Vui lòng thử lại.');
    }

    if (data?.promptFeedback?.blockReason) {
      return {
        ok: true,
        reply:
          'Xin lỗi, mình không thể trả lời câu hỏi này. Bạn thử hỏi cách khác nhé.',
        blocked: true,
      };
    }

    // Gemini trả nhiều part khi câu trả lời dài — bản legacy chỉ lấy parts[0]
    // nên câu trả lời dài bị cụt. Ghép hết lại.
    const reply =
      data?.candidates?.[0]?.content?.parts
        ?.map((p) => p.text ?? '')
        .join('')
        .trim() ?? '';

    if (!reply) {
      return {
        ok: true,
        reply: 'Mình chưa nghĩ ra câu trả lời. Bạn thử hỏi lại nhé.',
        blocked: false,
      };
    }

    return { ok: true, reply, blocked: false };
  }
}
