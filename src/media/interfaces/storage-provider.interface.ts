import { Readable } from 'stream';

export interface UploadResult {
  url: string;
  key: string;
  size: number;
  etag?: string;
}

export interface StorageProvider {
  upload(
    buffer: Buffer,
    key: string,
    mimeType: string,
    metadata?: Record<string, string>,
  ): Promise<UploadResult>;

  uploadStream(
    stream: Readable,
    key: string,
    mimeType: string,
    metadata?: Record<string, string>,
  ): Promise<UploadResult>;

  delete(key: string): Promise<void>;

  deleteMany(keys: string[]): Promise<void>;

  getUrl(key: string): string;

  getSignedUrl(key: string, expiresIn?: number): Promise<string>;
}

export interface ImageProcessingOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
}

export interface ProcessedImage {
  buffer: Buffer;
  width: number;
  height: number;
  size: number;
  format: string;
}
