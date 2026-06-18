import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { stringify } from 'csv-stringify';
import * as PDFDocument from 'pdfkit';
import { Order } from './entities/order.entity';

@Injectable()
export class OrdersExportService {
  exportAsCsv(orders: Order[], res: Response) {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=orders.csv');

    const columns = [
      'Order ID',
      'Product Name',
      'Amount',
      'Status',
      'Date',
    ];

    const stringifier = stringify({ header: true, columns });
    stringifier.pipe(res);

    for (const order of orders) {
      if (order.items && order.items.length > 0) {
        for (const item of order.items) {
          stringifier.write([
            order.id,
            item.productName,
            item.subtotal.toString(),
            order.status,
            order.createdAt.toISOString(),
          ]);
        }
      } else {
        stringifier.write([
          order.id,
          'No Items',
          order.totalAmount.toString(),
          order.status,
          order.createdAt.toISOString(),
        ]);
      }
    }

    stringifier.end();
  }

  exportAsPdf(orders: Order[], res: Response) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=orders.pdf');

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    doc.fontSize(20).text('Order History Receipt', { align: 'center' });
    doc.moveDown(2);

    for (const order of orders) {
      doc.fontSize(14).text(`Order ID: ${order.id}`);
      doc.fontSize(12).text(`Date: ${order.createdAt.toISOString()}`);
      doc.text(`Status: ${order.status.toUpperCase()}`);
      doc.text(`Total Amount: ${order.totalAmount} ${order.currency}`);
      
      doc.moveDown(0.5);
      doc.text('Items:', { underline: true });
      if (order.items && order.items.length > 0) {
        for (const item of order.items) {
          doc.text(`- ${item.productName} (x${item.quantity}) - ${item.subtotal} ${item.priceCurrency}`);
        }
      } else {
        doc.text('- No Items');
      }

      doc.moveDown(1.5);
    }

    doc.end();
  }
}
