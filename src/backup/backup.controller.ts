import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { BackupService } from './backup.service';
import { AdminGuard } from '../guards/admin.guard';

@Controller('admin/backups')
@UseGuards(AdminGuard)
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Post('trigger')
  async triggerManualBackup() {
    const result = await this.backupService.performBackup('manual');
    return result;
  }

  @Get()
  async listBackups() {
    return this.backupService.listBackups();
  }

  @Get(':s3Key/restore-url')
  async getRestoreUrl(@Param('s3Key') s3Key: string) {
    const url = await this.backupService.generateRestoreUrl(decodeURIComponent(s3Key));
    return { url, expiresIn: '1 hour' };
  }
}