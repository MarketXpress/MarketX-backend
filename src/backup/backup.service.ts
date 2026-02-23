import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import * as AWS from 'aws-sdk';

const execAsync = promisify(exec);

export interface BackupResult {
  success: boolean;
  filename?: string;
  s3Key?: string;
  error?: string;
  timestamp: Date;
  sizeBytes?: number;
}

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly s3: AWS.S3;
  private readonly tmpDir = '/tmp/pg-backups';

  constructor(private readonly config: ConfigService) {
    this.s3 = new AWS.S3({
      accessKeyId: this.config.get('AWS_ACCESS_KEY_ID'),
      secretAccessKey: this.config.get('AWS_SECRET_ACCESS_KEY'),
      region: this.config.get('AWS_REGION', 'us-east-1'),
    });

    if (!fs.existsSync(this.tmpDir)) {
      fs.mkdirSync(this.tmpDir, { recursive: true });
    }
  }

  /**
   * Runs every day at 2:00 AM UTC
   */
  @Cron('0 2 * * *', { name: 'daily-backup', timeZone: 'UTC' })
  async runDailyBackup(): Promise<void> {
    this.logger.log('Starting scheduled daily backup...');
    const result = await this.performBackup();

    if (!result.success) {
      this.logger.error(`Daily backup FAILED: ${result.error}`);
      await this.sendAlertOnFailure(result);
    } else {
      this.logger.log(
        `Daily backup succeeded: ${result.s3Key} (${result.sizeBytes} bytes)`,
      );
    }
  }

  async performBackup(tag = 'scheduled'): Promise<BackupResult> {
    const timestamp = new Date();
    const dateStr = timestamp.toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${tag}-${dateStr}.dump`;
    const localPath = path.join(this.tmpDir, filename);

    try {
      // Step 1: pg_dump to local file
      await this.dumpDatabase(localPath);
      const stats = fs.statSync(localPath);

      // Step 2: Upload to S3
      const s3Key = await this.uploadToS3(localPath, filename);

      // Step 3: Cleanup local file
      fs.unlinkSync(localPath);

      return {
        success: true,
        filename,
        s3Key,
        timestamp,
        sizeBytes: stats.size,
      };
    } catch (error) {
      // Cleanup on failure
      if (fs.existsSync(localPath)) fs.unlinkSync(localPath);

      return {
        success: false,
        error: error.message,
        timestamp,
      };
    }
  }

  private async dumpDatabase(outputPath: string): Promise<void> {
    const host = this.config.get('DATABASE_HOST', 'localhost');
    const port = this.config.get('DATABASE_PORT', '5432');
    const user = this.config.get('DATABASE_USER');
    const db = this.config.get('DATABASE_NAME');
    const password = this.config.get('DATABASE_PASSWORD');

    const env = { ...process.env, PGPASSWORD: password };

    const cmd = [
      'pg_dump',
      `-h ${host}`,
      `-p ${port}`,
      `-U ${user}`,
      `-F c`, // custom format (compressed, supports selective restore)
      `-f ${outputPath}`,
      db,
    ].join(' ');

    const { stderr } = await execAsync(cmd, { env });
    if (stderr) this.logger.warn(`pg_dump stderr: ${stderr}`);
  }

  private async uploadToS3(localPath: string, filename: string): Promise<string> {
    const bucket = this.config.get('AWS_S3_BACKUP_BUCKET');
    const prefix = this.config.get('AWS_S3_BACKUP_PREFIX', 'postgres-backups');
    const s3Key = `${prefix}/${filename}`;

    const fileStream = fs.createReadStream(localPath);
    await this.s3
      .upload({
        Bucket: bucket,
        Key: s3Key,
        Body: fileStream,
        ServerSideEncryption: 'AES256',
        StorageClass: 'STANDARD_IA', // Cost-optimized for backups
      })
      .promise();

    return s3Key;
  }

  async listBackups(limit = 20): Promise<AWS.S3.Object[]> {
    const bucket = this.config.get('AWS_S3_BACKUP_BUCKET');
    const prefix = this.config.get('AWS_S3_BACKUP_PREFIX', 'postgres-backups');

    const result = await this.s3
      .listObjectsV2({ Bucket: bucket, Prefix: prefix, MaxKeys: limit })
      .promise();

    return (result.Contents || []).sort(
      (a, b) => (b.LastModified?.getTime() ?? 0) - (a.LastModified?.getTime() ?? 0),
    );
  }

  async generateRestoreUrl(s3Key: string): Promise<string> {
    const bucket = this.config.get('AWS_S3_BACKUP_BUCKET');
    return this.s3.getSignedUrlPromise('getObject', {
      Bucket: bucket,
      Key: s3Key,
      Expires: 3600, // 1 hour
    });
  }

  private async sendAlertOnFailure(result: BackupResult): Promise<void> {
    // Hook into your existing notification/email system here.
    // Example: post to a Slack webhook or emit an event for EmailModule.
    this.logger.error(
      JSON.stringify({
        alert: 'BACKUP_FAILURE',
        timestamp: result.timestamp,
        error: result.error,
      }),
    );
  }
}