import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';
import { UserVerification } from './user-verification.entity';
import { Users } from '../users/users.entity';
import { DocumentProcessorService } from '../documents/document-processor.service';
import { DocumentStorageService } from '../documents/document-storage.service';
import { CommonModule } from '../common/common.module';
import { VerifiedSellerGuard } from './guards/verified-seller.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserVerification, Users]),
    ConfigModule,
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
