import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';

async function bootstrap() {
  process.env.NODE_ENV ||= 'development';
  process.env.DATABASE_HOST ||= 'localhost';
  process.env.DATABASE_PORT ||= '5432';
  process.env.DATABASE_USER ||= 'test';
  process.env.DATABASE_PASSWORD ||= 'test';
  process.env.DATABASE_NAME ||= 'marketx_docs';
  process.env.REDIS_HOST ||= 'localhost';
  process.env.REDIS_PORT ||= '6379';

  const app = await NestFactory.create(AppModule, { logger: false });

  const config = new DocumentBuilder()
    .setTitle('MarketX API')
    .setDescription('MarketX backend API documentation')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'Authorization')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    deepScanRoutes: true,
  });

  const outputDir = join(process.cwd(), 'docs', 'api');
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(join(outputDir, 'openapi.json'), JSON.stringify(document, null, 2), 'utf-8');

  await app.close();
  console.log(`✅ OpenAPI schema generated at ${join(outputDir, 'openapi.json')}`);
}

bootstrap().catch((error) => {
  console.error('Failed to generate API documentation:', error);
  process.exit(1);
});
