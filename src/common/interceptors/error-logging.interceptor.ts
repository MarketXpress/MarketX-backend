import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import * as fs from 'fs';
import * as path from 'path';
import { captureException } from '../../config/sentry.config';

@Injectable()
export class ErrorLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ErrorLoggingInterceptor.name);
  private readonly logFilePath: string;

  constructor() {
    // Create logs directory if it doesn't exist
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    this.logFilePath = path.join(logsDir, 'error.log');
  }

  private formatError(error: any): any {
    if (error instanceof HttpException) {
      return {
        statusCode: error.getStatus(),
        message: error.message,
        error: error.name,
        stack: error.stack,
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: error.message || 'Internal server error',
      error: error.name || 'Error',
      stack: error.stack,
    };
  }

  private async writeToLogFile(logEntry: string): Promise<void> {
    try {
      await fs.promises.appendFile(this.logFilePath, logEntry);
    } catch (writeError) {
      this.logger.error('Failed to write to error log file:', writeError);
    }
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, params, query, headers, ip } = request;
    const timestamp = new Date().toISOString();
    const requestId = headers['x-request-id'] || Math.random().toString(36).substring(7);

    return next.handle().pipe(
      catchError(async (error) => {
        const formattedError = this.formatError(error);
        
        // Prepare error log entry
        const errorLog = {
          timestamp,
          requestId,
          method,
          url,
          ip,
          headers: {
            userAgent: headers['user-agent'],
            referer: headers.referer,
          },
          body: this.sanitizeBody(body),
          params,
          query,
          error: formattedError,
        };

        // Convert to formatted string
        const logEntry = JSON.stringify(errorLog, null, 2) + '\n---\n';

        // Log to file asynchronously
        await this.writeToLogFile(logEntry);

        // Log to console for development
        this.logger.error(
          `[${requestId}] Error occurred at ${timestamp}`,
          `Method: ${method}`,
          `URL: ${url}`,
          `Status: ${formattedError.statusCode}`,
          formattedError.stack,
        );

        // Send to Sentry with context
        captureException(error, {
          requestId,
          method,
          url,
          params,
          query,
        });

        // Re-throw the error to be handled by NestJS
        return throwError(() => error);
      }),
    );
  }

  private sanitizeBody(body: any): any {
    if (!body) return body;
    
    // Create a copy of the body
    const sanitized = { ...body };
    
    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'secret', 'authorization'];
    sensitiveFields.forEach(field => {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    });
    
    return sanitized;
  }
} 