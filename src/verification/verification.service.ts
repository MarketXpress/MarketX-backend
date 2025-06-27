import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VerificationType, VerificationStatus, VerificationLevel } from './enums/verification.enums';
import { UserVerification } from './entities/user-verification.entity';
import { DocumentProcessorService } from '../documents/document-processor.service';
import { File as MulterFile } from 'multer';

@Injectable()
export class VerificationService {
  constructor(
    @InjectRepository(UserVerification)
    private readonly verificationRepo: Repository<UserVerification>,
    private readonly documentProcessor: DocumentProcessorService,
  ) {}

  async startVerification(userId: number, type: VerificationType) {
    // Check if already verified
    const existing = await this.verificationRepo.findOne({ where: { userId, verificationType: type } });
    if (existing && existing.status === VerificationStatus.VERIFIED) {
      throw new BadRequestException('Already verified');
    }
    // Create or update verification record
    const verification = this.verificationRepo.create({
      userId,
      verificationType: type,
      status: VerificationStatus.PENDING,
      level: VerificationLevel.BASIC,
    });
    return this.verificationRepo.save(verification);
  }

  async uploadDocument(userId: number, type: VerificationType, file: MulterFile) {
    const verification = await this.verificationRepo.findOne({ where: { userId, verificationType: type } });
    if (!verification) throw new NotFoundException('Verification not started');
    // Process and store document
    const docUrl = await this.documentProcessor.processDocument(file);
    verification.documents = { ...verification.documents, [type]: docUrl };
    verification.status = VerificationStatus.PENDING;
    await this.verificationRepo.save(verification);
    return { message: 'Document uploaded', docUrl };
  }

  async getVerificationStatus(userId: number) {
    const verifications = await this.verificationRepo.find({ where: { userId } });
    if (!verifications.length) throw new NotFoundException('No verifications found');
    // Determine highest level
    let level = VerificationLevel.BASIC;
    let badges: VerificationType[] = [];
    for (const v of verifications) {
      if (v.status === VerificationStatus.VERIFIED) {
        badges.push(v.verificationType);
        if (v.verificationType === VerificationType.IDENTITY) level = VerificationLevel.PREMIUM;
        else if (v.verificationType === VerificationType.PHONE) level = VerificationLevel.STANDARD;
      }
    }
    return { level, badges, verifications };
  }

  async calculateTrustScore(userId: number): Promise<number> {
    const verifications = await this.verificationRepo.find({ where: { userId } });
    let score = 0;
    for (const v of verifications) {
      if (v.status === VerificationStatus.VERIFIED) {
        if (v.verificationType === VerificationType.EMAIL) score += 20;
        if (v.verificationType === VerificationType.PHONE) score += 30;
        if (v.verificationType === VerificationType.IDENTITY) score += 50;
      }
    }
    return score;
  }
}
