import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalExecutor } from './local-executor';
import { PYTHON_EXECUTOR } from './python-executor';
import {
  PythonRunnerAccessGuard,
  isRunnerPublic,
} from './python-runner-access.guard';
import { PythonRunnerController } from './python-runner.controller';
import { PythonRunnerService } from './python-runner.service';
import { RemoteExecutor } from './remote-executor';

@Module({
  controllers: [PythonRunnerController],
  providers: [
    PythonRunnerService,
    PythonRunnerAccessGuard,
    {
      provide: PYTHON_EXECUTOR,
      inject: [ConfigService],
      // Chọn lúc khởi động theo PY_RUNNER_MODE (mặc định local).
      useFactory: (config: ConfigService) =>
        config.get<string>('PY_RUNNER_MODE') === 'remote'
          ? new RemoteExecutor(config)
          : new LocalExecutor(config),
    },
  ],
})
export class PythonRunnerModule implements OnModuleInit {
  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const logger = new Logger('PythonRunner');

    // Cố ý KHÔNG chặn khởi động ở production: chủ dự án bảo vệ route bằng lớp
    // mạng (giới hạn IP / basic auth ở reverse proxy). Chỉ nói thật là nó đang mở.
    if (isRunnerPublic(this.config)) {
      logger.warn(
        'PY_RUNNER_PUBLIC=true — POST /api/python/run đang CÔNG KHAI: ai tới được cổng này đều chạy được mã Python trên máy chủ. ' +
          'Hãy giới hạn bằng lớp mạng (IP allowlist / basic auth ở reverse proxy). ' +
          'Throttle tính theo IP: sau reverse proxy phải đặt TRUST_PROXY_HOPS, nếu không mọi người dùng chung một bộ đếm.',
      );
    }

    if (this.config.get<string>('PY_RUNNER_MODE') === 'remote') {
      const url = this.config.getOrThrow<string>('RUNNER_URL');
      logger.log(`Chạy mã qua runner từ xa: ${url}`);
      // RUNNER_SECRET đi trong header Authorization: qua http thuần trên mạng
      // công cộng là gửi khoá dạng rõ cho bất kỳ ai nghe được đường truyền.
      if (url.startsWith('http://') && !isLoopback(url)) {
        logger.warn(
          'RUNNER_URL dùng http:// tới máy không phải localhost — RUNNER_SECRET sẽ đi dạng rõ. Hãy dùng https:// (Caddy).',
        );
      }
    } else {
      logger.log(
        'Chạy mã bằng Docker trên chính máy này (PY_RUNNER_MODE=local)',
      );
    }
  }
}

function isLoopback(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  } catch {
    return false;
  }
}
