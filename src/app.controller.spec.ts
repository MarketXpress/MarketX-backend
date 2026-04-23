import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { I18nService } from './i18n/i18n.service';
import { Request } from 'express';

describe('AppController', () => {
  let appController: AppController;
  let i18nService: I18nService;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: I18nService,
          useValue: {
            translate: jest.fn().mockResolvedValue('Hello World!'),
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
    i18nService = app.get<I18nService>(I18nService);
  });

  describe('root', () => {
    it('should return "Hello World!"', async () => {
      const mockRequest = {
        ['locale']: 'en',
      } as unknown as Request;
      expect(await appController.getHello(mockRequest)).toBe('Hello World!');
    });
  });
});
