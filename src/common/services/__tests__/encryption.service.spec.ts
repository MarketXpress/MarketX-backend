import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from '../encryption.service';

describe('EncryptionService', () => {
  let service: EncryptionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncryptionService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-secret-key-32-chars-long-!!!'),
          },
        },
      ],
    }).compile();

    service = module.get<EncryptionService>(EncryptionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should encrypt and decrypt a buffer', async () => {
    const data = Buffer.from('Sensitive Information');
    const { encryptedData, iv, authTag } = await service.encrypt(data);

    expect(encryptedData).toBeDefined();
    expect(encryptedData).not.toEqual(data);
    expect(iv).toBeDefined();
    expect(authTag).toBeDefined();

    const decrypted = await service.decrypt(encryptedData, iv, authTag);
    expect(decrypted).toEqual(data);
    expect(decrypted.toString()).toEqual('Sensitive Information');
  });

  it('should encrypt and decrypt a string', async () => {
    const text = 'Hello, World!';
    const encryptedJson = await service.encryptString(text);
    
    expect(typeof encryptedJson).toBe('string');
    const parsed = JSON.parse(encryptedJson);
    expect(parsed.data).toBeDefined();
    expect(parsed.iv).toBeDefined();
    expect(parsed.tag).toBeDefined();

    const decrypted = await service.decryptString(encryptedJson);
    expect(decrypted).toEqual(text);
  });
});
