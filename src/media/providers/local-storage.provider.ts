import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  StorageProvider,
  UploadResult,
} from '../interfaces/storage-provider.interface';

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private readonly logger = new Logger(LocalStorageProvider.name);
  private readonly uploadDir: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.uploadDir =
      this.configService.get<string>('UPLOAD_DIR') || './uploads';
    this.baseUrl =
      this.configService.get<string>('BASE_URL') || 'http://localhost:3000';
    this.ensureUploadDir();
  }

  private async ensureUploadDir(): Promise<void> {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create upload directory', error);
      throw error;
    }
  }

  async upload(
    buffer: Buffer,
    key: string,
    mimeType: string,
    metadata?: Record<string, string>,
  ): Promise<UploadResult> {
    const filePath = path.join(this.uploadDir, key);
    const dir = path.dirname(filePath);

    try {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(filePath, buffer);

      this.logger.debug(`File uploaded locally: ${filePath}`);

      return {
        url: this.getUrl(key),
        key,
        size: buffer.length,
      };
    } catch (error) {
      this.logger.error(`Failed to upload file: ${filePath}`, error);
      throw error;
    }
  }

  async uploadStream(
    stream: Readable,
    key: string,
    mimeType: string,
    metadata?: Record<string, string>,
  ): Promise<UploadResult> {
    const filePath = path.join(this.uploadDir, key);
    const dir = path.dirname(filePath);

    try {
      await fs.mkdir(dir, { recursive: true });

      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const buffer = Buffer.concat(chunks);

      await fs.writeFile(filePath, buffer);

      this.logger.debug(`File uploaded via stream: ${filePath}`);

      return {
        url: this.getUrl(key),
        key,
        size: buffer.length,
      };
    } catch (error) {
      this.logger.error(`Failed to upload stream: ${filePath}`, error);
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(this.uploadDir, key);

    try {
      await fs.unlink(filePath);
      this.logger.debug(`File deleted: ${filePath}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.error(`Failed to delete file: ${filePath}`, error);
        throw error;
      }
    }
  }

  async deleteMany(keys: string[]): Promise<void> {
    await Promise.all(keys.map((key) => this.delete(key)));
  }

  getUrl(key: string): string {
    return `${this.baseUrl}/uploads/${key}`;
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    // For local storage, we return the regular URL
    // In production, you might want to implement time-limited tokens
    return this.getUrl(key);
  }
}
