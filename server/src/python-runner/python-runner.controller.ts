import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle, seconds } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from 'src/common/decorators/public.decorators';
import { ThrottleMessage } from 'src/common/decorators/throttle-message.decorator';
import { PythonRunnerAccessGuard } from './python-runner-access.guard';
import { RunCodeDto } from './dto/run-code.dto';
import { TraceCodeDto } from './dto/trace-code.dto';
import { PythonRunnerService } from './python-runner.service';

// @Public() để JwtAuthGuard TOÀN CỤC bước sang bên; việc công khai hay đòi JWT do
// PythonRunnerAccessGuard quyết định theo PY_RUNNER_PUBLIC (mặc định tắt → vẫn
// đòi JWT). Chạy mã tuỳ ý trên máy chủ không được mở ngầm.
@Controller('python')
@Public()
@UseGuards(PythonRunnerAccessGuard)
export class PythonRunnerController {
  constructor(private readonly runner: PythonRunnerService) {}

  // Đè tier 'ip_hour' RIÊNG cho route này (cùng cách auth/login): 10 lượt/phút
  // mỗi IP (guard JWT cục bộ chạy SAU throttler toàn cục nên req.user chưa có,
  // CustomThrottlerGuard rơi về tracker theo IP — đúng ý khi route công khai). Giới hạn
  // đồng thời nằm ở service — throttle chỉ đếm số lần gọi, không đếm số
  // container đang sống.
  @Post('run')
  @HttpCode(HttpStatus.OK)
  // Ngưỡng đọc từ env như /auth/login, /auth/register, /auth/guest — và vì ĐÚNG
  // lý do đã gặp ở /auth/guest: cả một lớp học ngồi chung Wi-Fi là chung một IP
  // NAT. Route này @Public() nên JwtAuthGuard toàn cục bỏ qua, req.user chưa có
  // khi throttler chạy, nên CustomThrottlerGuard luôn đếm theo `ip:` — 10
  // lượt/phút nghĩa là CẢ PHÒNG 40 người chia nhau 10 lần bấm Chạy mỗi phút.
  // @Throttle là decorator nên giá trị phải tính được lúc nạp class: đọc thẳng
  // process.env, không qua ConfigService.
  @Throttle({
    ip_hour: {
      limit: Number(process.env.THROTTLE_PY_RUN_LIMIT ?? 10),
      ttl: seconds(Number(process.env.THROTTLE_PY_RUN_TTL_SECONDS ?? 60)),
    },
  })
  // Hai kiểu 429 khác nhau: câu này là "bạn bấm quá nhiều" (chờ ~1 phút); hàng đợi
  // đầy/chờ quá hạn do executor ném với câu "máy chủ đang quá tải" (chờ vài giây).
  @ThrottleMessage('Bạn chạy quá nhiều lần, đợi khoảng 1 phút rồi thử lại')
  run(@Body() dto: RunCodeDto, @Res({ passthrough: true }) res: Response) {
    // Client ngắt kết nối (đóng/tải lại tab, proxy hết giờ) trước khi trả lời xong
    // → huỷ: bài đang chờ thì rút khỏi hàng, đang chạy thì giết container để nhả
    // chỗ ngay. `writableFinished` phân biệt với lần đóng bình thường sau khi đã trả lời.
    const abort = new AbortController();
    res.on('close', () => {
      if (!res.writableFinished) abort.abort();
    });
    return this.runner.run(dto.code, abort.signal);
  }

  // Chạy MỘT lượt rồi trả về toàn bộ vết để `/ide` bước từng dòng cục bộ.
  //
  // Vì sao không có route "bước tiếp": mỗi lượt chạy là một container dùng một
  // lần (xem sandbox/docker-sandbox.ts) — không có tiến trình nào sống sót giữa
  // hai request để mà bước tiếp. Một request = cả vết.
  //
  // Ngưỡng throttle TÁCH RIÊNG khỏi /run dù mặc định bằng nhau: ghi vết tốn
  // nhiều CPU hơn chạy thường (callback Python mỗi dòng), nên người vận hành
  // phải siết được nó mà không siết nút Chạy. Bộ đếm cũng riêng vì
  // CustomThrottlerGuard.generateKey có tên handler trong key.
  @Post('trace')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    ip_hour: {
      limit: Number(process.env.THROTTLE_PY_TRACE_LIMIT ?? 10),
      ttl: seconds(Number(process.env.THROTTLE_PY_TRACE_TTL_SECONDS ?? 60)),
    },
  })
  @ThrottleMessage(
    'Bạn xem từng bước quá nhiều lần, đợi khoảng 1 phút rồi thử lại',
  )
  trace(@Body() dto: TraceCodeDto, @Res({ passthrough: true }) res: Response) {
    const abort = new AbortController();
    res.on('close', () => {
      if (!res.writableFinished) abort.abort();
    });
    return this.runner.trace(dto.code, abort.signal);
  }
}
