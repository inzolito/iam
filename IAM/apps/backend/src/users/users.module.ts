import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { EsenciasModule } from '../esencias/esencias.module';

@Module({
  imports: [EsenciasModule],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
