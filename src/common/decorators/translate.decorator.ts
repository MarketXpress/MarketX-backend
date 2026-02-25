import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { I18nContext } from 'nestjs-i18n';

export type TranslateFn = (
  key: string,
  args?: Record<string, unknown>,
) => Promise<string>;

export const Translate = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TranslateFn => {
    const request = ctx.switchToHttp().getRequest();

    return async (key: string, args?: Record<string, unknown>) => {
      const i18n = I18nContext.current(ctx);
      const lang = request?.user?.language || i18n?.lang || request?.locale || 'en';

      const translated = await i18n?.translate(key, {
        lang,
        args,
      });

      return (translated as string) || key;
    };
  },
);
