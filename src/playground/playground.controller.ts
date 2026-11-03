import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { CurrentUserId } from 'src/common/decorators/current-user.decorator';
import { SnippetDto } from './dto/snippet.dto';
import { PlaygroundService } from './playground.service';

// Không @Public(): JwtAuthGuard toàn cục bắt buộc đăng nhập.
@Controller('playground')
export class PlaygroundController {
  constructor(private readonly playground: PlaygroundService) {}

  @Get('snippets')
  list(@CurrentUserId() userId: number) {
    return this.playground.list(userId);
  }

  @Post('snippets')
  create(@CurrentUserId() userId: number, @Body() dto: SnippetDto) {
    return this.playground.create(userId, dto);
  }

  @Put('snippets/:id')
  update(
    @CurrentUserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SnippetDto,
  ) {
    return this.playground.update(userId, id, dto);
  }

  @Delete('snippets/:id')
  remove(
    @CurrentUserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.playground.remove(userId, id);
  }
}
