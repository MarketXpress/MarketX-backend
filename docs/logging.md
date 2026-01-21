# Logging Documentation

## Overview
This application uses Winston for structured logging across all services. Logs are output to console and files, with support for integration with log aggregation tools.

## Log Levels
- `error`: Critical errors that need immediate attention
- `warn`: Warnings that should be reviewed
- `info`: General information about application flow
- `debug`: Detailed debugging information

## Log Format
All logs are in JSON format with the following structure:
```json
{
  "level": "info",
  "message": "Request",
  "timestamp": "2023-01-01T00:00:00.000Z",
  "method": "GET",
  "url": "/api/users",
  "ip": "127.0.0.1",
  "userAgent": "Mozilla/5.0...",
  "statusCode": 200,
  "duration": "150ms"
}
```

## Transports
- **Console**: Colored output for development
- **File (error.log)**: Only error level logs
- **File (combined.log)**: All logs

## Features
- API request/response logging with response times
- Exception tracking and logging
- Database query logging in development mode (when TypeORM is configured)

## Database Query Logging
To enable database query logging in development, configure TypeORM with a custom logger:

```typescript
// In your database module or app.module.ts
TypeOrmModule.forRoot({
  // ... other config
  logger: new DatabaseLogger(loggerService),
  logging: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
})
```

Where `DatabaseLogger` implements TypeORM's Logger interface and uses `loggerService.logQuery()`.

## Configuration
Set `LOG_LEVEL` environment variable to control the minimum log level (default: 'info').

## Integration with Log Aggregation Tools
Winston supports various transports. To integrate with tools like ELK Stack, DataDog, or CloudWatch, add the appropriate transport to the logger configuration.