import { Controller, Get, Req, Query } from '@nestjs/common';
import { AppService } from './app.service';
import { I18nService } from './i18n/i18n.service';
import { Request } from 'express';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly i18nService: I18nService,
  ) {}

  @Get()
  async getHello(
    @Req() req: Request,
    @Query('name') name: string = 'User',
  ): Promise<string> {
    const locale = req['locale'] || 'en';
    return await this.i18nService.translate('greeting', {
      lang: locale,
      args: { name },
    });
  }
}
