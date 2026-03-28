import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@nestjs-modules/mailer';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { stringify } from 'csv-stringify/sync';

import { Order } from '../orders/entities/order.entity';
import { TaxExportRequestDto } from './dtos/tax-export-request.dto';

@Injectable()
export class AdminTaxExportService {
  private readonly logger = new Logger(AdminTaxExportService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly config: ConfigService,
    private readonly mailer: MailerService,
  ) {
    this.s3 = new S3Client({
      region: this.config.getOrThrow<string>('AWS_REGION'),
      credentials: {
        accessKeyId:     this.config.getOrThrow<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.config.getOrThrow<string>('AWS_SECRET_ACCESS_KEY'),
      },
    });
    this.bucket = this.config.getOrThrow<string>('TAX_EXPORT_S3_BUCKET');
  }

  /**
   * Enqueues the export job and returns a job ID immediately.
   * The heavy work runs in a detached async task so the HTTP
   * response is not blocked.
   */
  async queueExport(dto: TaxExportRequestDto): Promise<string> {
    const jobId = randomUUID();
    // Fire-and-forget — intentionally not awaited
    this.runExport(jobId, dto).catch((err) =>
      this.logger.error(`Tax export job ${jobId} failed`, err),
    );
    return jobId;
  }

  // ─────────────────────────────────────────────────────────
  // Private — background worker
  // ─────────────────────────────────────────────────────────

  private async runExport(
    jobId: string,
    dto: TaxExportRequestDto,
  ): Promise<void> {
    this.logger.log(`[${jobId}] Starting tax export for seller ${dto.sellerId}`);

    // 1. Fetch all matching orders in paginated chunks to avoid OOM
    const orders = await this.fetchOrdersInChunks(dto);
    this.logger.log(`[${jobId}] Fetched ${orders.length} orders`);

    // 2. Build CSV
    const csv = this.buildCsv(orders);

    // 3. Upload to S3 (cold-storage / Glacier-IA class)
    const s3Key = `tax-exports/${dto.sellerId}/${jobId}.csv`;
    await this.uploadToS3(s3Key, csv);
    this.logger.log(`[${jobId}] Uploaded to s3://${this.bucket}/${s3Key}`);

    // 4. Generate a 24-hour pre-signed download URL
    const signedUrl = await this.createSignedUrl(s3Key);

    // 5. Email the seller
    await this.emailSeller(dto.sellerEmail, signedUrl, jobId);
    this.logger.log(`[${jobId}] Email dispatched to ${dto.sellerEmail}`);
  }

  private async fetchOrdersInChunks(dto: TaxExportRequestDto): Promise<Order[]> {
    const CHUNK_SIZE = 1_000;
    const results: Order[] = [];
    let skip = 0;

    while (true) {
      const chunk = await this.orderRepo.find({
        where: {
          sellerId: dto.sellerId,
          createdAt: Between(new Date(dto.startDate), new Date(dto.endDate)),
        },
        order: { createdAt: 'ASC' },
        take: CHUNK_SIZE,
        skip,
      });

      results.push(...chunk);
      if (chunk.length < CHUNK_SIZE) break;
      skip += CHUNK_SIZE;
    }

    return results;
  }

  private buildCsv(orders: Order[]): Buffer {
    const rows = orders.map((o) => ({
      order_id:        o.id,
      created_at:      o.createdAt.toISOString(),
      seller_id:       o.sellerId,
      buyer_id:        o.buyerId,
      subtotal:        o.subtotal,
      tax_amount:      o.taxAmount,
      total:           o.total,
      currency:        o.currency,
      status:          o.status,
      payment_method:  o.paymentMethod,
    }));

    const csv = stringify(rows, { header: true });
    return Buffer.from(csv, 'utf-8');
  }

  private async uploadToS3(key: string, body: Buffer): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket:              this.bucket,
        Key:                 key,
        Body:                body,
        ContentType:         'text/csv',
        StorageClass:        'STANDARD_IA', // cold storage cost tier
        ServerSideEncryption: 'AES256',
      }),
    );
  }

  private async createSignedUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.s3, command, { expiresIn: 86_400 }); // 24 h
  }

  private async emailSeller(
    email: string,
    downloadUrl: string,
    jobId: string,
  ): Promise<void> {
    await this.mailer.sendMail({
      to:      email,
      subject: 'Your tax data export is ready',
      html: `
        <p>Your tax data export (Job ID: <strong>${jobId}</strong>) has been processed.</p>
        <p>
          <a href="${downloadUrl}">Download your CSV</a>
          — link expires in <strong>24 hours</strong>.
        </p>
        <p>If you did not request this export, please contact support immediately.</p>
      `,
    });
  }
}