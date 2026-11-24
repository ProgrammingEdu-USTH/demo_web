import { Global, Module } from '@nestjs/common';
import { EventsPrismaService } from './events-prisma.service';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService, EventsPrismaService],
  exports: [PrismaService, EventsPrismaService],
})
export class PrismaModule {}
