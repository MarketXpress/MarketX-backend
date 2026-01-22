import { Controller, Post, Body, Query, Res } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { Response } from 'express';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post('export')
  async exportReport(
    @Query('type') type: 'csv' | 'pdf',
    @Body() data: any,
    @Res() res: Response,
  ) {
    const result = await this.reportsService.generateReport(type, data);
    if (type === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="report.csv"');
      return res.send(result.content);
    } else if (type === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="report.pdf"');
      return res.send(result.content);
    } else {
      return res.status(400).json({ message: 'Invalid report type' });
    }
  }
} 