import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ErrorLoggingInterceptor } from './common/interceptors/error-logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Global pipes
  app.useGlobalPipes(new ValidationPipe());
  
  // Global interceptors
  app.useGlobalInterceptors(new ErrorLoggingInterceptor());
  
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
