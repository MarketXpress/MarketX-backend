import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { LocaleMiddleware } from './middleware/locale.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe());
  app.use(LocaleMiddleware.prototype.use);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
