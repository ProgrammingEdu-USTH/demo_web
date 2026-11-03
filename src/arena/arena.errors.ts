import { HttpException, HttpStatus } from '@nestjs/common';

export type ArenaErrorCode =
  | 'ALREADY_IN_MATCH'
  | 'CANNOT_JOIN_OWN_ROOM'
  | 'ROOM_NOT_FOUND'
  | 'MATCH_NOT_FOUND'
  | 'MATCH_NOT_WAITING'
  | 'MATCH_NOT_ACTIVE'
  | 'SUBMIT_TOO_FAST'
  | 'SUBMIT_LIMIT'
  | 'GRADER_BUSY'
  | 'GRADER_DISABLED'
  | 'INVALID_PROBLEM'
  | 'INVALID_CODE';

/** Lỗi Arena: body { statusCode, message, code } theo contracts/openapi.yaml. */
export class ArenaHttpError extends HttpException {
  constructor(
    status: HttpStatus,
    public readonly arenaCode: ArenaErrorCode,
    message: string,
    public readonly retryAfterSec?: number,
  ) {
    super({ statusCode: status, message, code: arenaCode }, status);
  }
}
