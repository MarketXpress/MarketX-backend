import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor(private configService: ConfigService) {
    const secret =
      this.configService.get<string>('ENCRYPTION_SECRET') ||
      'default-secret-key-32-chars-long-!!';
    // Ensure the key is 32 bytes for aes-256
    this.key = crypto.createHash('sha256').update(String(secret)).digest();
  }

  /**
   * Encrypt a buffer
   */
  encrypt(data: Buffer): {
    encryptedData: Buffer;
    iv: Buffer;
    authTag: Buffer;
  } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    const encryptedData = Buffer.concat([cipher.update(data), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
      encryptedData,
      iv,
      authTag,
    };
  }

  /**
   * Decrypt a buffer
   */
  decrypt(encryptedData: Buffer, iv: Buffer, authTag: Buffer): Buffer {
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
  }

  /**
   * Encrypt a string (helper)
   */
  encryptString(text: string): string {
    const { encryptedData, iv, authTag } = this.encrypt(Buffer.from(text));
    return JSON.stringify({
      data: encryptedData.toString('hex'),
      iv: iv.toString('hex'),
      tag: authTag.toString('hex'),
    });
  }

  /**
   * Decrypt to a string (helper)
   */
  decryptString(encryptedJson: string): string {
    const { data, iv, tag } = JSON.parse(encryptedJson);
    const decrypted = this.decrypt(
      Buffer.from(data, 'hex'),
      Buffer.from(iv, 'hex'),
      Buffer.from(tag, 'hex'),
    );
    return decrypted.toString();
  }
}
