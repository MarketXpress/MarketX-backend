import { DocumentBuilder } from '@nestjs/swagger';

export function buildSwaggerConfig() {
  return new DocumentBuilder()
    .setTitle('MarketX API')
    .setDescription('MarketX backend API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
}
