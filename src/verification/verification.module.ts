import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from '../common/common.module';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';
import { DocumentProcessorService } from '../documents/document-processor.service';
import { DocumentStorageService } from '../documents/document-storage.service';
import { VerifiedSellerGuard } from './guards/verified-seller.guard';
import { UserVerification } from './entities/user-verification.entity';
import { Users } from '../users/users.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserVerification, Users]),
    CommonModule,
  ],
  controllers: [VerificationController],
  providers: [
    VerificationService,
    DocumentProcessorService,
    DocumentStorageService,
    VerifiedSellerGuard,
  ],
  exports: [VerificationService, VerifiedSellerGuard],
})
export class VerificationModule {}
