import {
  BadRequestException,
  Injectable,
  ValidationError,
  ValidationPipe as NestValidationPipe,
} from '@nestjs/common';
import { I18nContext } from 'nestjs-i18n';

function flattenValidationErrors(errors: ValidationError[], lang = 'en') {
  const result: Array<{ field: string; message: string }> = [];
  const i18n = I18nContext.current();

  const walk = (errs: ValidationError[], parentPath = '') => {
    for (const err of errs) {
      const fieldPath = parentPath
        ? `${parentPath}.${err.property}`
        : err.property;

      if (err.constraints) {
        for (const [constraint, fallbackMessage] of Object.entries(
          err.constraints,
        )) {
          const message =
            (i18n?.t(`validation.${constraint}`, {
              lang,
              args: {
                property: fieldPath,
                value: err.value,
                constraints: err.constraints,
              },
            }) as string) || fallbackMessage;

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
        const lang = I18nContext.current()?.lang || 'en';
        const details = flattenValidationErrors(errors, lang);

        return new BadRequestException({
          error: 'VALIDATION_ERROR',
          message:
            (I18nContext.current()?.t('common.validation_failed', {
              lang,
            }) as string) || 'Input validation failed',
          details,
        });
      },
    });
  }
}
