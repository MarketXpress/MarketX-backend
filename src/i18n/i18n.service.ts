import { Injectable } from '@nestjs/common';
import { I18nService as NestI18nService } from 'nestjs-i18n';

@Injectable()
export class I18nService {
  constructor(private readonly i18n: NestI18nService) {}

  async translate(key: string, options?: any): Promise<string> {
    return this.i18n.translate(key, options) as Promise<string>;
  }

  formatDate(date: Date, locale: string) {
    return new Intl.DateTimeFormat(locale).format(date);
  }

  formatCurrency(amount: number, locale: string, currency: string) {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).format(amount);
  }
}
