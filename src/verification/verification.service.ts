import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThan } from 'typeorm';
import {
  VerificationType,
  VerificationStatus,
  VerificationLevel,
  VerificationStep,
  DocumentType,
} from './enums/verification.enums';
import { UserVerification } from './user-verification.entity';
import { Users } from '../users/users.entity';
import { DocumentProcessorService } from '../documents/document-processor.service';
import { ConfigService } from '@nestjs/config';
import {
  SubmitVerificationDto,
  PersonalInfoDto,
  BusinessInfoDto,
  DocumentUploadDto,
} from './dto/submit-verification.dto';
import {
  AdminReviewDto,
  BulkReviewDto,
  VerificationQueryDto,
} from './dto/admin-review.dto';

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    @InjectRepository(UserVerification)
    private readonly verificationRepo: Repository<UserVerification>,
    @InjectRepository(Users)
    private readonly usersRepo: Repository<Users>,
    private readonly documentProcessor: DocumentProcessorService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Start or update verification process
   */
  async submitVerification(
    userId: number,
    dto: SubmitVerificationDto,
  ): Promise<UserVerification> {
    this.logger.log(
      `User ${userId} submitting verification for type: ${dto.verificationType}`,
    );

    // Check if user already has a pending verification of this type
    const existing = await this.verificationRepo.findOne({
      where: { userId, verificationType: dto.verificationType },
    });

    if (existing && existing.status === VerificationStatus.VERIFIED) {
      throw new BadRequestException('User is already verified for this type');
    }

    // Create or update verification record
    const verification =
      existing ||
      this.verificationRepo.create({
        userId,
        verificationType: dto.verificationType,
        status: VerificationStatus.PENDING,
        currentStep: VerificationStep.PERSONAL_INFO,
        level: VerificationLevel.BASIC,
      });

    // Update personal information
    verification.personalInfo = dto.personalInfo;

    // Update business information for seller verification
    if (dto.verificationType === VerificationType.SELLER && dto.businessInfo) {
      verification.businessInfo = dto.businessInfo;
      verification.currentStep = VerificationStep.BUSINESS_VERIFICATION;
    } else {
      verification.currentStep = VerificationStep.DOCUMENT_UPLOAD;
    }

    // Process documents if provided
    if (dto.documents && dto.documents.length > 0) {
      verification.documents = {};
      for (const doc of dto.documents) {
        const processedDoc = await this.processDocument(doc);
        verification.documents[doc.documentType] = processedDoc;
      }
      verification.currentStep = VerificationStep.ADMIN_REVIEW;
    }

    const savedVerification = await this.verificationRepo.save(verification);

    // Update user verification status
    await this.updateUserVerificationStatus(userId);

    return savedVerification;
  }

  /**
   * Upload documents for verification
   */
  async uploadDocuments(
    userId: number,
    verificationId: number,
    files: Express.Multer.File[],
  ): Promise<UserVerification> {
    this.logger.log(
      `User ${userId} uploading documents for verification ${verificationId}`,
    );

    const verification = await this.verificationRepo.findOne({
      where: { id: verificationId, userId },
    });

    if (!verification) {
      throw new NotFoundException('Verification not found');
    }

    if (verification.status === VerificationStatus.VERIFIED) {
      throw new BadRequestException(
        'Cannot upload documents for verified verification',
      );
    }

    // Process uploaded files
    const documents = verification.documents || {};
    for (const file of files) {
      const documentType = this.getDocumentTypeFromFilename(file.originalname);
      const processedDoc = await this.documentProcessor.processDocument(file);
      documents[documentType] = {
        url: processedDoc,
        type: documentType,
        uploadedAt: new Date(),
        verified: false,
      };
    }

    verification.documents = documents;
    verification.currentStep = VerificationStep.ADMIN_REVIEW;
    verification.status = VerificationStatus.UNDER_REVIEW;

    const savedVerification = await this.verificationRepo.save(verification);
    await this.updateUserVerificationStatus(userId);

    return savedVerification;
  }

  /**
   * Admin review of verification
   */
  async adminReview(
    adminId: number,
    dto: AdminReviewDto,
  ): Promise<UserVerification> {
    this.logger.log(
      `Admin ${adminId} reviewing verification ${dto.verificationId}`,
    );

    const verification = await this.verificationRepo.findOne({
      where: { id: dto.verificationId },
      relations: ['user'],
    });

    if (!verification) {
      throw new NotFoundException('Verification not found');
    }

    verification.status = dto.action;
    verification.reviewedBy = adminId;
    verification.adminNotes = dto.adminNotes;

    if (dto.action === VerificationStatus.REJECTED) {
      verification.rejectionReason = dto.rejectionReason;
      verification.retryCount += 1;
    } else if (dto.action === VerificationStatus.VERIFIED) {
      verification.verifiedAt = new Date();
      verification.level =
        dto.verificationLevel || VerificationLevel.VERIFIED_SELLER;

      // Set expiry date
      const expiryDays = dto.expiresInSeconds || 365 * 24 * 60 * 60; // 1 year default
      verification.expiresAt = new Date(Date.now() + expiryDays * 1000);
    }

    if (dto.metadata) {
      verification.metadata = { ...verification.metadata, ...dto.metadata };
    }

    const savedVerification = await this.verificationRepo.save(verification);
    await this.updateUserVerificationStatus(verification.userId);

    return savedVerification;
  }

  /**
   * Bulk admin review
   */
  async bulkReview(
    adminId: number,
    dto: BulkReviewDto,
  ): Promise<UserVerification[]> {
    this.logger.log(
      `Admin ${adminId} performing bulk review on ${dto.verificationIds.length} verifications`,
    );

    const verifications = await this.verificationRepo.findByIds(
      dto.verificationIds,
    );

    const updatedVerifications = [];
    for (const verification of verifications) {
      verification.status = dto.action;
      verification.reviewedBy = adminId;
      verification.adminNotes = dto.adminNotes;

      if (dto.action === VerificationStatus.REJECTED) {
        verification.rejectionReason = dto.rejectionReason;
        verification.retryCount += 1;
      } else if (dto.action === VerificationStatus.VERIFIED) {
        verification.verifiedAt = new Date();
        verification.level = VerificationLevel.VERIFIED_SELLER;
        verification.expiresAt = new Date(
          Date.now() + 365 * 24 * 60 * 60 * 1000,
        ); // 1 year
      }

      updatedVerifications.push(await this.verificationRepo.save(verification));
      await this.updateUserVerificationStatus(verification.userId);
    }

    return updatedVerifications;
  }

  /**
   * Get verification status for user
   */
  async getVerificationStatus(userId: number): Promise<any> {
    const verifications = await this.verificationRepo.find({
      where: { userId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });

    if (!verifications.length) {
      return {
        hasVerification: false,
        verifications: [],
        trustScore: 0,
      };
    }

    const trustScore = await this.calculateTrustScore(userId);
    const isVerifiedSeller = verifications.some(
      (v) =>
        v.verificationType === VerificationType.SELLER &&
        v.status === VerificationStatus.VERIFIED &&
        (!v.expiresAt || v.expiresAt > new Date()),
    );

    return {
      hasVerification: true,
      isVerifiedSeller,
      trustScore,
      verifications,
      currentVerifications: verifications.filter(
        (v) =>
          v.status === VerificationStatus.PENDING ||
          v.status === VerificationStatus.UNDER_REVIEW,
      ),
    };
  }

  /**
   * Get all verifications for admin (with filtering)
   */
  async getAllVerifications(
    query: VerificationQueryDto,
  ): Promise<{ verifications: UserVerification[]; total: number }> {
    const {
      status,
      verificationType,
      userId,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = query;

    const where: any = {};
    if (status) where.status = status;
    if (verificationType) where.verificationType = verificationType;
    if (userId) where.userId = userId;

    const [verifications, total] = await this.verificationRepo.findAndCount({
      where,
      relations: ['user', 'reviewer'],
      order: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { verifications, total };
  }

  /**
   * Calculate user trust score based on verifications
   */
  async calculateTrustScore(userId: number): Promise<number> {
    const verifications = await this.verificationRepo.find({
      where: { userId },
    });
    let score = 0;

    for (const verification of verifications) {
      if (
        verification.status === VerificationStatus.VERIFIED &&
        (!verification.expiresAt || verification.expiresAt > new Date())
      ) {
        switch (verification.verificationType) {
          case VerificationType.EMAIL:
            score += 10;
            break;
          case VerificationType.PHONE:
            score += 20;
            break;
          case VerificationType.IDENTITY:
            score += 40;
            break;
          case VerificationType.SELLER:
            score += 60;
            break;
          case VerificationType.BUSINESS:
            score += 50;
            break;
        }
      }
    }

    // Update user trust score
    await this.usersRepo.update(userId, { trustScore: score });

    return score;
  }

  /**
   * Check and update expired verifications
   */
  async checkExpiredVerifications(): Promise<void> {
    this.logger.log('Checking for expired verifications');

    const expiredVerifications = await this.verificationRepo.find({
      where: {
        status: VerificationStatus.VERIFIED,
        expiresAt: LessThan(new Date()),
      },
    });

    for (const verification of expiredVerifications) {
      verification.status = VerificationStatus.EXPIRED;
      await this.verificationRepo.save(verification);
      await this.updateUserVerificationStatus(verification.userId);
    }

    this.logger.log(
      `Updated ${expiredVerifications.length} expired verifications`,
    );
  }

  /**
   * Update user verification status based on verifications
   */
  private async updateUserVerificationStatus(userId: number): Promise<void> {
    const verifications = await this.verificationRepo.find({
      where: { userId },
    });

    const hasValidVerification = verifications.some(
      (v) =>
        v.status === VerificationStatus.VERIFIED &&
        (!v.expiresAt || v.expiresAt > new Date()),
    );

    const isVerifiedSeller = verifications.some(
      (v) =>
        v.verificationType === VerificationType.SELLER &&
        v.status === VerificationStatus.VERIFIED &&
        (!v.expiresAt || v.expiresAt > new Date()),
    );

    const highestLevel = this.getHighestVerificationLevel(verifications);
    const trustScore = await this.calculateTrustScore(userId);

    await this.usersRepo.update(userId, {
      verificationStatus: hasValidVerification
        ? VerificationStatus.VERIFIED
        : VerificationStatus.PENDING,
      verificationLevel: highestLevel,
      isVerifiedSeller,
      trustScore,
      verificationExpiryAt: this.getEarliestExpiryDate(verifications),
    });
  }

  /**
   * Process document upload
   */
  private async processDocument(doc: DocumentUploadDto): Promise<any> {
    // This would integrate with your document storage service
    return {
      url: doc.documentUrl,
      type: doc.documentType,
      uploadedAt: new Date(),
      verified: false,
    };
  }

  /**
   * Get document type from filename
   */
  private getDocumentTypeFromFilename(filename: string): DocumentType {
    const lowerFilename = filename.toLowerCase();

    if (lowerFilename.includes('passport')) return DocumentType.PASSPORT;
    if (lowerFilename.includes('driver') || lowerFilename.includes('license'))
      return DocumentType.DRIVERS_LICENSE;
    if (lowerFilename.includes('business') || lowerFilename.includes('license'))
      return DocumentType.BUSINESS_LICENSE;
    if (lowerFilename.includes('tax')) return DocumentType.TAX_DOCUMENT;
    if (lowerFilename.includes('bank')) return DocumentType.BANK_STATEMENT;
    if (lowerFilename.includes('address')) return DocumentType.ADDRESS_PROOF;

    return DocumentType.ID_CARD;
  }

  /**
   * Get highest verification level from user verifications
   */
  private getHighestVerificationLevel(
    verifications: UserVerification[],
  ): VerificationLevel {
    const validVerifications = verifications.filter(
      (v) =>
        v.status === VerificationStatus.VERIFIED &&
        (!v.expiresAt || v.expiresAt > new Date()),
    );

    if (
      validVerifications.some(
        (v) => v.verificationType === VerificationType.SELLER,
      )
    ) {
      return VerificationLevel.VERIFIED_SELLER;
    }
    if (
      validVerifications.some(
        (v) => v.verificationType === VerificationType.IDENTITY,
      )
    ) {
      return VerificationLevel.PREMIUM;
    }
    if (
      validVerifications.some(
        (v) => v.verificationType === VerificationType.PHONE,
      )
    ) {
      return VerificationLevel.STANDARD;
    }

    return VerificationLevel.BASIC;
  }

  /**
   * Get earliest expiry date from verifications
   */
  private getEarliestExpiryDate(
    verifications: UserVerification[],
  ): Date | null {
    const validVerifications = verifications
      .filter((v) => v.status === VerificationStatus.VERIFIED && v.expiresAt)
      .map((v) => v.expiresAt);

    return validVerifications.length > 0
      ? new Date(Math.min(...validVerifications.map((d) => d.getTime())))
      : null;
  }
}
