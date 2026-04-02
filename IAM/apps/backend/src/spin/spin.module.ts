import { Module } from '@nestjs/common';
import { SpinService } from './spin.service';
import { SpinController } from './spin.controller';

@Module({
  controllers: [SpinController],
  providers: [SpinService],
  exports: [SpinService],
})
export class SpinModule {}
