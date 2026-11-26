import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { validate } from './config/env.validation';
import { SupabaseModule } from './supabase';
import { HealthModule } from './health';
import { AuthModule } from './auth';
import { UsersModule } from './users';
import { SpinModule } from './spin';
import { OnboardingModule } from './onboarding';
import { MatchingModule } from './matching';
import { ChatModule } from './chat';
import { EsenciasModule } from './esencias';
import { VenuesModule } from './venues';
import { BodyDoublingModule } from './body-doubling';
import { MeetupsModule } from './meetups';
import { NotificationsModule } from './notifications';
import { AdminModule } from './admin';
import { PhotosModule } from './photos/photos.module';
import { StoriesModule } from './stories/stories.module';
import { FeatureFlagsModule } from './feature-flags/feature-flags.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,  // ventana de 1 minuto (ms)
        limit: 200,  // 200 requests por minuto por IP
      },
    ]),
    // Servir archivos estáticos desde uploads/ en desarrollo
    ...(process.env.NODE_ENV !== 'production'
      ? [
          ServeStaticModule.forRoot({
            rootPath: join(__dirname, '..', 'uploads'),
            serveRoot: '/uploads',
          }),
        ]
      : []),
    SupabaseModule,
    HealthModule,
    AuthModule,
    UsersModule,
    SpinModule,
    OnboardingModule,
    MatchingModule,
    ChatModule,
    EsenciasModule,
    VenuesModule,
    BodyDoublingModule,
    MeetupsModule,
    NotificationsModule,
    AdminModule,
    PhotosModule,
    StoriesModule,
    FeatureFlagsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
