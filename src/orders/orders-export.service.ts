import { Injectable, BadRequestException } from '@nestjs/common';
import { AsyncParser } from 'json2csv';
import * as PDFDocument from 'pdfkit';

@Injectable()
export class OrdersExportService {
  /**
   * Generates a tabular CSV file stream from a user's order records
   */
  async exportToCsv(orders: any[]): Promise<string> {
    const fields = [
      { label: 'Order ID', value: 'id' },
      { label: 'Product Name', value: 'productName' },
      { label: 'Amount', value: 'amount' },
      { label: 'Status', value: 'status' },
      { label: 'Date', value: 'createdAt' },
    ];

    try {
      const json2csvParser = new AsyncParser({ fields });
      return await json2csvParser.parse(orders).promise();
    } catch (err) {
      throw new BadRequestException('Failed to compile CSV data matrix extraction payload.');
    }
  }

  /**
   * Compiles a professional PDF account statement layout returned as a raw streamable buffer
   */
  async exportToPdf(orders: any[], userEmail: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      // --- Header Design Blocks ---
      doc.fillColor('#1A202C').fontSize(20).text('ORDER HISTORY STATEMENT', { align: 'left' });
      doc.fontSize(10).fillColor('#718096').text(`Account Owner: ${userEmail}`);
      doc.text(`Statement Generated: ${new Date().toLocaleDateString()}`);
      doc.moveDown(2);

      // --- Simple Table Coordinates Configuration ---
      const tableTop = 150;
      const itemX = 50;
      const productX = 180;
      const amountX = 350;
      const statusX = 420;
      const dateX = 490;

      // Render Table Headers
      doc.fillColor('#2D3748').font('Helvetica-Bold').fontSize(10);
      doc.text('Order ID', itemX, tableTop);
      doc.text('Product Description', productX, tableTop);
      doc.text('Amount', amountX, tableTop);
      doc.text('Status', statusX, tableTop);
      doc.text('Date', dateX, tableTop);

      doc.moveTo(itemX, tableTop + 15).lineTo(550, tableTop + 15).strokeColor('#E2E8F0').stroke();

      // Render Dynamic Rows
      let currentY = tableTop + 25;
      doc.font('Helvetica').fillColor('#4A5568');

      for (const order of orders) {
        // Simple page expansion boundary protection check
        if (currentY > 750) {
          doc.addPage();
          currentY = 50;
        }

        const shortId = order.id.substring(0, 8) || 'N/A';
        const formattedDate = new Date(order.createdAt).toLocaleDateString();

        doc.text(shortId, itemX, currentY);
        doc.text(order.productName || 'Unregistered Product', productX, currentY, { width: 160, lineBreak: false });
        doc.text(`$${Number(order.amount).toFixed(2)}`, amountX, currentY);
        doc.text(order.status || 'PENDING', statusX, currentY);
        doc.text(formattedDate, dateX, currentY);

        currentY += 20;
      }

      // Conclude document building sequence
      doc.end();
    });
  }
}