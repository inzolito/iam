import { Module } from '@nestjs/common';
import { MatchingService } from './matching.service';
import { MatchingController, SwipeController, BlockController, ReportController } from './matching.controller';

@Module({
  controllers: [MatchingController, SwipeController, BlockController, ReportController],
  providers: [MatchingService],
  exports: [MatchingService],
})
export class MatchingModule {}
