import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AdminTaxExportService } from './admin-tax-export.service';
import { TaxExportRequestDto } from './dtos/tax-export-request.dto';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';

@Controller('admin')
@UseGuards(RolesGuard)
export class AdminTaxExportController {
  constructor(private readonly taxExportService: AdminTaxExportService) {}

  /**
   * POST /admin/export-tax-data
   * Accepts the request immediately (202) and queues a background job
   * that builds the CSV, uploads it to S3, and emails a signed URL.
   */
  @Post('export-tax-data')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.ACCEPTED)
  async exportTaxData(@Body() dto: TaxExportRequestDto) {
    const jobId = await this.taxExportService.queueExport(dto);
    return {
      message:
        'Export job accepted. You will receive an email with the download link once it is ready.',
      jobId,
    };
  }
}