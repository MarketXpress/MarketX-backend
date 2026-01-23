import {
  Controller,
  Get,
  Query,
  UseGuards,
  Param,
  ParseUUIDPipe,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AuditService } from './audit.service';
import { GetAuditLogsDto } from './dto/get-audit-logs.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AdminGuard } from 'src/guards/admin.guard';

@ApiTags('Audit')
@Controller('admin')
@UseGuards(AdminGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('audit-logs')
  @ApiOperation({ summary: 'Get paginated audit logs with filtering options' })
  @ApiResponse({ status: 200, description: 'Returns paginated audit logs' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async getAuditLogs(@Query() query: GetAuditLogsDto) {
    return this.auditService.getAuditLogs(query);
  }

  @Get('audit-logs/:id')
  @ApiOperation({ summary: 'Get a specific audit log by ID' })
  @ApiResponse({ status: 200, description: 'Returns the audit log' })
  @ApiResponse({ status: 404, description: 'Audit log not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async getAuditLogById(@Param('id', ParseUUIDPipe) id: string) {
    try {
      return await this.auditService.getAuditLogById(id);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.NOT_FOUND);
    }
  }

  @Get('audit-stats')
  @ApiOperation({ summary: 'Get audit statistics for a date range' })
  @ApiResponse({ status: 200, description: 'Returns audit statistics' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiQuery({ name: 'startDate', required: true, type: Date })
  @ApiQuery({ name: 'endDate', required: true, type: Date })
  async getAuditStats(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.auditService.getAuditStats(
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get('audit-logs/cleanup')
  @ApiOperation({ summary: 'Clean up expired audit logs' })
  @ApiResponse({ status: 200, description: 'Returns number of deleted logs' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiQuery({ name: 'retentionDays', required: false, type: Number })
  async cleanupExpiredLogs(@Query('retentionDays') retentionDays?: number) {
    return this.auditService.cleanupExpiredLogs(retentionDays);
  }
}
