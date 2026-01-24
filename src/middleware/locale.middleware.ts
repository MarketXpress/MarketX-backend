import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
// import { I18nModule, I18nJsonParser } from 'nestjs-i18n';

@Injectable()
export class LocaleMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Priority: user preference > Accept-Language header > default
    let locale = 'en';
    if (req.user && (req.user as any).language) {
      locale = (req.user as any).language;
    } else if (req.headers['accept-language']) {
      locale = req.headers['accept-language'].split(',')[0];
    }
    req['locale'] = locale;
    next();
  }
}
