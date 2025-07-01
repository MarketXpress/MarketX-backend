import { Injectable } from '@nestjs/common';
import { Parser as Json2csvParser } from 'json2csv';
import PDFDocument from 'pdfkit';
import { Writable } from 'stream';

@Injectable()
export class ReportsService {
  async generateReport(type: 'csv' | 'pdf', data: any) {
    if (type === 'csv') {
      const parser = new Json2csvParser();
      const csv = parser.parse(data);
      return { type: 'csv', content: csv };
    } else if (type === 'pdf') {
      const doc = new PDFDocument();
      let buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {});
      doc.text(JSON.stringify(data, null, 2));
      doc.end();
      await new Promise((resolve) => doc.on('end', resolve));
      const pdfBuffer = Buffer.concat(buffers);
      return { type: 'pdf', content: pdfBuffer };
    } else {
      return { message: `Unsupported report type: ${type}` };
    }
  }
}
