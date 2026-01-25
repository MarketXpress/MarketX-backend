import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { StellarService } from './stellar.service';
import * as StellarSdk from '@stellar/stellar-sdk';

describe('StellarService', () => {
  let service: StellarService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: string) => {
      const config = {
        STELLAR_NETWORK: 'testnet',
        STELLAR_HORIZON_URL: 'https://horizon-testnet.stellar.org',
      };
      return config[key] || defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StellarService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<StellarService>(StellarService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createWallet', () => {
    it('should create a new wallet with public and secret keys', async () => {
      const wallet = await service.createWallet();

      expect(wallet).toHaveProperty('publicKey');
      expect(wallet).toHaveProperty('secretKey');
      expect(wallet).toHaveProperty('network');
      expect(wallet).toHaveProperty('message');
      expect(wallet.network).toBe('testnet');
      expect(wallet.publicKey).toMatch(/^G[A-Z2-7]{55}$/);
      expect(wallet.secretKey).toMatch(/^S[A-Z2-7]{55}$/);
    });

    it('should create unique wallets', async () => {
      const wallet1 = await service.createWallet();
      const wallet2 = await service.createWallet();

      expect(wallet1.publicKey).not.toBe(wallet2.publicKey);
      expect(wallet1.secretKey).not.toBe(wallet2.secretKey);
    });
  });

  describe('validateAddress', () => {
    it('should validate a correct Stellar address', () => {
      const keypair = StellarSdk.Keypair.random();
      const result = service.validateAddress({ address: keypair.publicKey() });

      expect(result.valid).toBe(true);
      expect(result.message).toBe('Valid Stellar address');
    });

    it('should invalidate an incorrect address', () => {
      const result = service.validateAddress({ address: 'INVALID_ADDRESS' });

      expect(result.valid).toBe(false);
      expect(result.message).toContain('Invalid');
    });

    it('should invalidate an empty address', () => {
      const result = service.validateAddress({ address: '' });

      expect(result.valid).toBe(false);
    });
  });

  describe('accountExists', () => {
    it('should return false for non-existent account', async () => {
      const keypair = StellarSdk.Keypair.random();
      const exists = await service.accountExists(keypair.publicKey());

      expect(exists).toBe(false);
    });

    it('should throw error for invalid public key', async () => {
      await expect(service.accountExists('INVALID_KEY')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getBalance', () => {
    it('should return exists:false for unfunded account', async () => {
      const keypair = StellarSdk.Keypair.random();
      const balance = await service.getBalance(keypair.publicKey());

      expect(balance.exists).toBe(false);
      expect(balance.balances).toEqual([]);
      expect(balance.message).toContain('does not exist');
    });

    it('should throw error for invalid address', async () => {
      await expect(service.getBalance('INVALID_ADDRESS')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getNetworkInfo', () => {
    it('should return current network configuration', () => {
      const info = service.getNetworkInfo();

      expect(info).toHaveProperty('network');
      expect(info).toHaveProperty('horizonUrl');
      expect(info.network).toBe('testnet');
      expect(info.horizonUrl).toBe('https://horizon-testnet.stellar.org');
    });
  });

  describe('fundTestnetAccount', () => {
    it('should throw error on mainnet', async () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'STELLAR_NETWORK') return 'mainnet';
        return 'https://horizon.stellar.org';
      });

      // Recreate service with mainnet config
      const module = await Test.createTestingModule({
        providers: [
          StellarService,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
        ],
      }).compile();

      const mainnetService = module.get<StellarService>(StellarService);
      const keypair = StellarSdk.Keypair.random();

      await expect(
        mainnetService.fundTestnetAccount(keypair.publicKey()),
      ).rejects.toThrow('Funding is only available on testnet');
    });
  });
});