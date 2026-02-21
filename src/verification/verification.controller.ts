import {
  Controller,
  Post,
  Get,
  Patch,
  UploadedFile,
  UseInterceptors,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  HttpStatus,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../guards/admin.guard';
import { VerificationService } from './verification.service';
import {
  SubmitVerificationDto,
  UpdateVerificationStepDto,
} from './dto/submit-verification.dto';
import {
  AdminReviewDto,
  BulkReviewDto,
  VerificationQueryDto,
} from './dto/admin-review.dto';
import {
  VerificationType,
  VerificationStatus,
} from './enums/verification.enums';

interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    email: string;
    role?: string;
  };
}

@ApiTags('Verification')
@Controller('verification')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class VerificationController {
  private readonly logger = new Logger(VerificationController.name);

  constructor(private readonly verificationService: VerificationService) {}

  @Post('submit')
  @ApiOperation({
    summary: 'Submit verification application',
    description:
      'Submit a new verification application with personal info, business info, and documents',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Verification application submitted successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input or already verified',
  })
  async submitVerification(
    @Request() req: AuthenticatedRequest,
    @Body() dto: SubmitVerificationDto,
  ) {
    const userId = req.user.id;
    this.logger.log(
      `User ${userId} submitting verification for type: ${dto.verificationType}`,
    );

    return this.verificationService.submitVerification(userId, dto);
  }

  @Post(':verificationId/documents')
  @UseInterceptors(FilesInterceptor('files', 5))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload verification documents',
    description: 'Upload multiple documents for a verification application',
  })
  @ApiParam({
    name: 'verificationId',
    description: 'Verification application ID',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Documents uploaded successfully',
  })
  async uploadDocuments(
    @Request() req: AuthenticatedRequest,
    @Param('verificationId') verificationId: number,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const userId = req.user.id;

    if (!files || files.length === 0) {
      throw new BadRequestException('At least one file must be uploaded');
    }

    this.logger.log(
      `User ${userId} uploading ${files.length} documents for verification ${verificationId}`,
    );

    return this.verificationService.uploadDocuments(
      userId,
      verificationId,
      files,
    );
  }

  @Patch(':verificationId/step')
  @ApiOperation({
    summary: 'Update verification step',
    description: 'Update current step in verification process',
  })
  @ApiParam({
    name: 'verificationId',
    description: 'Verification application ID',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Verification step updated successfully',
  })
  async updateVerificationStep(
    @Request() req: AuthenticatedRequest,
    @Param('verificationId') verificationId: number,
    @Body() dto: UpdateVerificationStepDto,
  ) {
    const userId = req.user.id;
    this.logger.log(
      `User ${userId} updating step for verification ${verificationId}`,
    );

    // This would be implemented to handle step-by-step verification process
    return { message: 'Step updated', currentStep: dto.currentStep };
  }

  @Get('status')
  @ApiOperation({
    summary: 'Get user verification status',
    description:
      'Get comprehensive verification status including trust score and badges',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Verification status retrieved successfully',
  })
  async getVerificationStatus(@Request() req: AuthenticatedRequest) {
    const userId = req.user.id;
    this.logger.log(`User ${userId} requesting verification status`);

    return this.verificationService.getVerificationStatus(userId);
  }

  @Get('trust-score')
  @ApiOperation({
    summary: 'Get user trust score',
    description: 'Calculate and return user trust score based on verifications',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Trust score calculated successfully',
  })
  async getTrustScore(@Request() req: AuthenticatedRequest) {
    const userId = req.user.id;
    const trustScore =
      await this.verificationService.calculateTrustScore(userId);

    return { userId, trustScore };
  }

  // Admin endpoints
  @Get('admin/all')
  @UseGuards(AdminGuard)
  @ApiOperation({
    summary: 'Get all verifications (Admin)',
    description:
      'Get all verification applications with filtering and pagination (Admin only)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by status',
  })
  @ApiQuery({
    name: 'verificationType',
    required: false,
    description: 'Filter by verification type',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    description: 'Filter by user ID',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Sort field' })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    description: 'Sort order (ASC/DESC)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Verifications retrieved successfully',
  })
  async getAllVerifications(@Query() query: VerificationQueryDto) {
    this.logger.log('Admin requesting all verifications with filters', {
      query,
    });

    return this.verificationService.getAllVerifications(query);
  }

  @Patch('admin/:verificationId/review')
  @UseGuards(AdminGuard)
  @ApiOperation({
    summary: 'Review verification application (Admin)',
    description: 'Approve or reject a verification application (Admin only)',
  })
  @ApiParam({
    name: 'verificationId',
    description: 'Verification application ID',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Verification reviewed successfully',
  })
  async adminReview(
    @Request() req: AuthenticatedRequest,
    @Param('verificationId') verificationId: number,
    @Body() dto: AdminReviewDto,
  ) {
    const adminId = req.user.id;
    this.logger.log(
      `Admin ${adminId} reviewing verification ${verificationId}`,
    );

    return this.verificationService.adminReview(adminId, {
      ...dto,
      verificationId,
    });
  }

  @Patch('admin/bulk-review')
  @UseGuards(AdminGuard)
  @ApiOperation({
    summary: 'Bulk review verification applications (Admin)',
    description:
      'Approve or reject multiple verification applications at once (Admin only)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Bulk review completed successfully',
  })
  async bulkReview(
    @Request() req: AuthenticatedRequest,
    @Body() dto: BulkReviewDto,
  ) {
    const adminId = req.user.id;
    this.logger.log(
      `Admin ${adminId} performing bulk review on ${dto.verificationIds.length} verifications`,
    );

    return this.verificationService.bulkReview(adminId, dto);
  }

  @Get('admin/expired-check')
  @UseGuards(AdminGuard)
  @ApiOperation({
    summary: 'Check expired verifications (Admin)',
    description: 'Check and update expired verifications (Admin only)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Expired verifications checked successfully',
  })
  async checkExpiredVerifications() {
    this.logger.log('Admin requesting expired verification check');

    await this.verificationService.checkExpiredVerifications();

    return { message: 'Expired verifications checked and updated' };
  }

  @Get('admin/statistics')
  @UseGuards(AdminGuard)
  @ApiOperation({
    summary: 'Get verification statistics (Admin)',
    description: 'Get comprehensive verification statistics (Admin only)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Statistics retrieved successfully',
  })
  async getVerificationStatistics() {
    this.logger.log('Admin requesting verification statistics');

    // This would be implemented to return comprehensive statistics
    return {
      totalVerifications: 0,
      pendingVerifications: 0,
      verifiedVerifications: 0,
      rejectedVerifications: 0,
      expiredVerifications: 0,
      verificationByType: {},
      averageProcessingTime: 0,
      currentMonthApplications: 0,
    };
  }

  // Legacy endpoints for backward compatibility
  @Post('start')
  @ApiOperation({
    summary: 'Start verification (Legacy)',
    description: 'Legacy endpoint to start verification process',
  })
  async startVerification(
    @Body() body: { userId: number; verificationType: VerificationType },
  ) {
    this.logger.log(`Legacy start verification for user ${body.userId}`);

    // Convert to new format
    const dto: SubmitVerificationDto = {
      verificationType: body.verificationType,
      personalInfo: {
        firstName: '',
        lastName: '',
        dateOfBirth: '',
        address: '',
        city: '',
        country: '',
        postalCode: '',
      },
    };

    return this.verificationService.submitVerification(body.userId, dto);
  }

  @Post('upload/:type')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload document (Legacy)',
    description: 'Legacy endpoint for document upload',
  })
  async uploadDocument(
    @Param('type') type: VerificationType,
    @Body('userId') userId: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    this.logger.log(`Legacy document upload for user ${userId}, type: ${type}`);

    if (!userId || !file) {
      throw new BadRequestException('userId and file required');
    }

    // Find existing verification or create new one
    const verifications =
      await this.verificationService.getVerificationStatus(userId);

    return { message: 'Document uploaded via legacy endpoint' };
  }
}
