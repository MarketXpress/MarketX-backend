import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';
import { buildSwaggerConfig } from '../src/swagger.config';

async function bootstrap() {
  process.env.NODE_ENV ||= 'development';
  process.env.DATABASE_HOST ||= 'localhost';
  process.env.DATABASE_PORT ||= '5432';
  process.env.DATABASE_USER ||= 'test';
  process.env.DATABASE_PASSWORD ||= 'test';
  process.env.DATABASE_NAME ||= 'marketx_docs';
  process.env.REDIS_HOST ||= 'localhost';
  process.env.REDIS_PORT ||= '6379';
  // ConfigValidationService requires these to be set and >= 32 chars; only
  // used to satisfy startup validation while generating docs, never to sign
  // real tokens.
  process.env.JWT_ACCESS_SECRET ||=
    'docs-generation-placeholder-access-secret-32chars';
  process.env.JWT_REFRESH_SECRET ||=
    'docs-generation-placeholder-refresh-secret-32chars';

  const app = await NestFactory.create(AppModule);

  const document = SwaggerModule.createDocument(app, buildSwaggerConfig(), {
    deepScanRoutes: true,
  });

  const outputDir = join(process.cwd(), 'docs', 'api');
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(join(outputDir, 'openapi.json'), JSON.stringify(document, null, 2), 'utf-8');

  await app.close();
  console.log(`✅ OpenAPI schema generated at ${join(outputDir, 'openapi.json')}`);

  // Some providers (Bull/ioredis queues, cron schedulers) keep handles open
  // after app.close() resolves, which would otherwise hang this one-shot
  // script indefinitely. This is a one-shot CLI tool, not a long-running
  // process, so forcing exit here is intentional.
  process.exit(0);
}

bootstrap().catch((error) => {
  console.error('Failed to generate API documentation:', error);
  process.exit(1);
});
