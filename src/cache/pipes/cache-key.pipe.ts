import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class CacheKeyPipe implements PipeTransform {
  transform(value: any) {
    if (typeof value !== 'string' || value.length === 0) {
      throw new BadRequestException('Cache key must be a non-empty string');
    }

    if (value.includes(' ') || value.includes('\n') || value.includes('\r')) {
      throw new BadRequestException('Cache key cannot contain whitespace characters');
    }

    if (value.length > 250) {
      throw new BadRequestException('Cache key too long (max 250 characters)');
    }

    return value;
  }
}
