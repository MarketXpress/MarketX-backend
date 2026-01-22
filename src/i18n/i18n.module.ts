import { Module } from '@nestjs/common';
import { I18nModule, HeaderResolver } from 'nestjs-i18n';
import { join } from 'path';
import { I18nService } from './i18n.service';

@Module({
  imports: [
    I18nModule.forRoot({
      fallbackLanguage: 'en',
      loaderOptions: {
        path: join(__dirname, '../../locales/'),
        watch: true,
      },
      resolvers: [{ use: HeaderResolver, options: ['accept-language'] }],
    }),
  ],
  providers: [I18nService],
  exports: [I18nService],
})
export class CustomI18nModule {}
