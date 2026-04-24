import { Injectable, PipeTransform } from '@nestjs/common';
import { sanitizeInput } from '../utils/sanitize.util';

@Injectable()
export class SanitizePipe implements PipeTransform {
  transform(value: any) {
    return sanitizeInput(value);
  }
}