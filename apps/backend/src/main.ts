import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT ?? 3000;

  app.enableCors();
  app.setGlobalPrefix('v1');

  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`IAM API running on port ${String(port)}`);
}
bootstrap();
