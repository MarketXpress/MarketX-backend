import { Module } from '@nestjs/common';
import {
  I18nModule,
  HeaderResolver,
  QueryResolver,
  AcceptLanguageResolver,
} from 'nestjs-i18n';
import { join } from 'path';
import { I18nService } from './i18n.service';

@Module({
  imports: [
    I18nModule.forRoot({
      fallbackLanguage: 'en',
      loaderOptions: {
        path: join(__dirname, 'translations/'),
        watch: true,
      },
      resolvers: [
        { use: QueryResolver, options: ['lang'] },
        { use: HeaderResolver, options: ['x-language', 'x-lang'] },
        AcceptLanguageResolver,
      ],
    }),
  ],
  providers: [I18nService],
  exports: [I18nService],
})
export class CustomI18nModule {}
