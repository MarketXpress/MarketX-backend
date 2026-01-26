import {
  BadRequestException,
  Injectable,
  ValidationError,
  ValidationPipe as NestValidationPipe,
} from '@nestjs/common';

function flattenValidationErrors(errors: ValidationError[]) {
  const result: Array<{ field: string; message: string }> = [];

  const walk = (errs: ValidationError[], parentPath = '') => {
    for (const err of errs) {
      const fieldPath = parentPath
        ? `${parentPath}.${err.property}`
        : err.property;

      if (err.constraints) {
        for (const message of Object.values(err.constraints)) {
          result.push({ field: fieldPath, message });
        }
      }

      // For nested validation (e.g. items[0].quantity)
      if (err.children && err.children.length) {
        walk(err.children, fieldPath);
      }
    }
  };

  walk(errors);
  return result;
}

@Injectable()
export class AppValidationPipe extends NestValidationPipe {
  constructor() {
    super({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      skipMissingProperties: false,

      exceptionFactory: (errors: ValidationError[]) => {
        const details = flattenValidationErrors(errors);
        return new BadRequestException({
          error: 'VALIDATION_ERROR',
          message: 'Input validation failed',
          details,
        });
      },
    });
  }
}
