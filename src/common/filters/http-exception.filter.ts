import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { LoggerService } from '../logger/logger.service';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private customLogger: LoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal Server Error';
    let errorDetails: any = {};

    // Handle HttpException
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object') {
        errorDetails = exceptionResponse;
        message =
          (exceptionResponse as any).message || exception.message || message;
      } else {
        message = exceptionResponse as string;
      }
    } else if (exception instanceof Error) {
      // Handle generic Error
      message = exception.message;
      errorDetails = {
        name: exception.name,
        stack:
          process.env.NODE_ENV !== 'production' ? exception.stack : undefined,
      };
    }

    // Log the error
    const errorLog = {
      timestamp: new Date().toISOString(),
      method: request.method,
      url: request.url,
      ip: request.ip,
      statusCode: status,
      message,
      exception: exception instanceof Error ? exception.name : typeof exception,
      details: errorDetails,
    };

    // Log based on status code
    if (status >= 500) {
      this.customLogger.error(
        `${status} - ${request.method} ${request.url}`,
        errorLog,
        exception instanceof Error ? exception : new Error(message),
      );
    } else if (status >= 400) {
      this.customLogger.warn(
        `${status} - ${request.method} ${request.url}`,
        errorLog,
      );
    } else {
      this.customLogger.info(
        `${status} - ${request.method} ${request.url}`,
        errorLog,
      );
    }

    // Send response
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message:
        process.env.NODE_ENV === 'production' && status === 500
          ? 'Internal Server Error'
          : message,
      ...(process.env.NODE_ENV !== 'production' && {
        details: errorDetails,
      }),
    });
  }
}
