import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CurrencyService } from '../../currency/currency.service';

@Injectable()
export class CurrencyInterceptor implements NestInterceptor {
  constructor(private readonly currencyService: CurrencyService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const targetCurrency = request.headers['x-currency'] || 'USD';

    return next.handle().pipe(
      map((data) => this.convertPrices(data, targetCurrency)),
    );
  }

  private convertPrices(data: any, targetCurrency: string): any {
    if (!data) return data;

    if (Array.isArray(data)) {
      return data.map((item) => this.convertPrices(item, targetCurrency));
    }

    if (typeof data === 'object') {
      const converted = { ...data };

      if (converted.price !== undefined && converted.currency) {
        const result = this.currencyService.convert(
          converted.price,
          converted.currency,
          targetCurrency,
        );
        converted.price = result.amount;
        converted.currency = targetCurrency;
        converted.originalPrice = data.price;
        converted.originalCurrency = data.currency;
      }

      for (const key in converted) {
        if (typeof converted[key] === 'object') {
          converted[key] = this.convertPrices(converted[key], targetCurrency);
        }
      }

      return converted;
    }

    return data;
  }
}
