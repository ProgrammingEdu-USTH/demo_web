import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { Throttle, hours } from '@nestjs/throttler';
import { ChatMessageDto } from './dto/chatbot.dto';
import { ChatbotService } from './chatbot.service';

@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly chatbot: ChatbotService) {}

  @Get('status')
  status() {
    return this.chatbot.status();
  }

  @Post('message')
  @HttpCode(HttpStatus.OK)
  // Mỗi lượt chat là một lần gọi API tính phí — siết chặt hơn tier chung.
  // Key throttle gồm controller.route nên quota này riêng, không đụng route khác.
  @Throttle({
    ip_hour: {
      limit: Number(process.env.GEMINI_HOUR_LIMIT ?? 60),
      ttl: hours(1),
    },
  })
  message(@Body() dto: ChatMessageDto) {
    return this.chatbot.chat(dto);
  }
}
