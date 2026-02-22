import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { EncryptionService } from '../common/services/encryption.service';

export interface DocumentMetadata {
  originalName: string;
  filename: string;
  path: string;
  size: number;
  mimetype: string;
  uploadedAt: Date;
  iv?: string;      // Added for encryption support
  authTag?: string; // Added for encryption support
}

@Injectable()
export class DocumentStorageService {
  private readonly logger = new Logger(DocumentStorageService.name);
  private readonly uploadDir: string;

  constructor(
    private configService: ConfigService,
    private encryptionService: EncryptionService, // Inject EncryptionService
  ) {
    this.uploadDir = this.configService.get<string>('UPLOAD_DIR') || './uploads/verification-docs';
    this.ensureUploadDirectory();
  }

  /**
   * Store uploaded document (Encrypted)
   */
  async storeDocument(file: Express.Multer.File): Promise<DocumentMetadata> {
    this.logger.log(`Storing encrypted document: ${file.originalname}`);

    const filename = this.generateFilename(file.originalname);
    const path = join(this.uploadDir, filename);

    // Encrypt the file buffer
    const { encryptedData, iv, authTag } = await this.encryptionService.encrypt(file.buffer);

    // Write encrypted data to disk
    writeFileSync(path, encryptedData);

    const metadata: DocumentMetadata = {
      originalName: file.originalname,
      filename,
      path,
      size: file.size,
      mimetype: file.mimetype,
      uploadedAt: new Date(),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };

    this.logger.log(`Encrypted document stored successfully: ${filename}`);
    return metadata;
  }

  /**
   * Get document URL
   */
  getDocumentUrl(filename: string): string {
    const baseUrl = this.configService.get<string>('BASE_URL') || 'http://localhost:3000';
    return `${baseUrl}/verification-docs/${filename}`;
  }

  /**
   * Retrieve and decrypt document
   */
  async getDecryptedDocument(filename: string, iv: string, authTag: string): Promise<Buffer> {
    this.logger.log(`Retrieving and decrypting document: ${filename}`);
    const path = join(this.uploadDir, filename);

    if (!existsSync(path)) {
      throw new Error(`File not found: ${filename}`);
    }

    const encryptedData = readFileSync(path);
    
    return this.encryptionService.decrypt(
      encryptedData,
      Buffer.from(iv, 'hex'),
      Buffer.from(authTag, 'hex'),
    );
  }

  /**
   * Delete document
   */
  async deleteDocument(filename: string): Promise<void> {
    const path = join(this.uploadDir, filename);
    
    try {
      const fs = require('fs').promises;
      await fs.unlink(path);
      this.logger.log(`Document deleted: ${filename}`);
    } catch (error) {
      this.logger.error(`Failed to delete document ${filename}: ${error.message}`);
    }
  }

  /**
   * Validate document type
   */
  validateDocumentType(file: Express.Multer.File): boolean {
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    return allowedTypes.includes(file.mimetype);
  }

  /**
   * Validate document size
   */
  validateDocumentSize(file: Express.Multer.File, maxSize: number = 10 * 1024 * 1024): boolean {
    return file.size <= maxSize; // Default 10MB
  }

  /**
   * Generate unique filename
   */
  private generateFilename(originalName: string): string {
    const extension = originalName.split('.').pop();
    return `${uuidv4()}.${extension}`;
  }

  /**
   * Ensure upload directory exists
   */
  private ensureUploadDirectory(): void {
    if (!existsSync(this.uploadDir)) {
      mkdirSync(this.uploadDir, { recursive: true });
      this.logger.log(`Created upload directory: ${this.uploadDir}`);
    }
  }
}
