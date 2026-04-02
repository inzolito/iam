import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validate } from './config/env.validation';
import { SupabaseModule } from './supabase';
import { HealthModule } from './health';
import { AuthModule } from './auth';
import { UsersModule } from './users';
import { SpinModule } from './spin';
import { OnboardingModule } from './onboarding';
import { MatchingModule } from './matching';
import { ChatModule } from './chat';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    SupabaseModule,
    HealthModule,
    AuthModule,
    UsersModule,
    SpinModule,
    OnboardingModule,
    MatchingModule,
    ChatModule,
  ],
})
export class AppModule {}
