import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        // If already formatted, return as is
        if (data && data.data) {
          return data;
        }

        // Handle arrays
        if (Array.isArray(data)) {
          return {
            data: data.map((item) => ({
              type: item?.type || 'resource',
              id: item?.id || null,
              attributes: item,
            })),
          };
        }

        // Handle single object
        return {
          data: {
            type: data?.type || 'resource',
            id: data?.id || null,
            attributes: data,
          },
        };
      }),
    );
  }
}