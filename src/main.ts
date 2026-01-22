import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

import { ValidationPipe, Logger } from '@nestjs/common';
import { LocaleMiddleware } from './middleware/locale.middleware';
import * as compression from 'compression';
import { REQUEST_SIZE_LIMITS, CORS_CONFIG } from './common/config/rate-limit.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Enable CORS with security configuration
  app.enableCors({
    origin: CORS_CONFIG.origin,
    methods: CORS_CONFIG.methods,
    allowedHeaders: CORS_CONFIG.allowedHeaders,
    credentials: CORS_CONFIG.credentials,
    maxAge: CORS_CONFIG.maxAge,
  });

  // Parse request size limits
  const parseSize = (size: string): string | number => {
    const units = {
      b: 1,
      kb: 1024,
      mb: 1024 * 1024,
      gb: 1024 * 1024 * 1024,
    };

    const match = size.match(/^(\d+)(kb|mb|gb|b)?$/i);
    if (!match) return '10mb';

    const amount = parseInt(match[1], 10);
    const unit = (match[2] || 'b').toLowerCase();

    return amount * (units[unit as keyof typeof units] || 1);
  };

  // Apply JSON request size limit
  app.use(
    express.json({
      limit: REQUEST_SIZE_LIMITS.JSON,
    }) as any,
  );

  // Apply URL-encoded request size limit
  app.use(
    express.urlencoded({
      limit: REQUEST_SIZE_LIMITS.URLENCODED,
      extended: true,
    }) as any,
  );

  // Enable compression for responses
  app.use(compression());

  // Global validation pipe

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Apply locale middleware
  app.use(LocaleMiddleware.prototype.use);

  // Start the application
  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  logger.log(`Application started on port ${port}`);
  logger.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.log(`CORS origins: ${CORS_CONFIG.origin.join(', ')}`);
  logger.log(`Max JSON payload: ${REQUEST_SIZE_LIMITS.JSON}`);
  logger.log(`Max file upload: ${REQUEST_SIZE_LIMITS.FILE}`);
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});

// Import express for middleware
import * as express from 'express';
