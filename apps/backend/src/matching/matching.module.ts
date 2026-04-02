import { Module } from '@nestjs/common';
import { MatchingService } from './matching.service';
import { MatchingController, SwipeController, BlockController, ReportController } from './matching.controller';
import { EsenciasModule } from '../esencias/esencias.module';

@Module({
  imports: [EsenciasModule],
  controllers: [MatchingController, SwipeController, BlockController, ReportController],
  providers: [MatchingService],
  exports: [MatchingService],
})
export class MatchingModule {}
