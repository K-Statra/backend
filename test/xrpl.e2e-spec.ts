/**
 * XRPL Testnet 통합 테스트
 *
 * 실제 testnet에 연결해 지갑 생성 및 펀딩을 검증합니다.
 * 네트워크 상태에 따라 20~40초 소요될 수 있습니다.
 *
 * 실행: npm run test:e2e -- --testPathPattern=xrpl
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Client, Wallet } from 'xrpl';
import { XrplService } from '../src/modules/payments/xrpl.service';

// 테스트용 32바이트 AES 키 (hex 64자리)
const TEST_ENCRYPTION_KEY = 'a'.repeat(64);
const TESTNET_WS = 'wss://s.altnet.rippletest.net:51233';

describe('XrplService (testnet integration)', () => {
  let service: XrplService;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              xrpl: { wsUrl: TESTNET_WS, destAddress: '' },
              security: { encryptionKey: TEST_ENCRYPTION_KEY },
            }),
          ],
        }),
      ],
      providers: [XrplService],
    }).compile();

    // onModuleInit 호출 → testnet 연결
    await module.init();
    service = module.get<XrplService>(XrplService);
  });

  afterAll(async () => {
    await module.close();
  });

  // ── generateWallet ──────────────────────────────────────────────────────────

  describe('generateWallet', () => {
    it('address, seed, publicKey, privateKey 포함된 지갑 반환', () => {
      const wallet = service.generateWallet();

      expect(wallet.address).toMatch(/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/);
      expect(wallet.seed).toMatch(/^s/); // XRPL seed는 's'로 시작
      expect(wallet.publicKey).toBeTruthy();
      expect(wallet.privateKey).toBeTruthy();
    });

    it('호출마다 다른 지갑 생성', () => {
      const w1 = service.generateWallet();
      const w2 = service.generateWallet();

      expect(w1.address).not.toBe(w2.address);
      expect(w1.seed).not.toBe(w2.seed);
    });
  });

  // ── encrypt / decrypt ───────────────────────────────────────────────────────

  describe('encrypt / decrypt', () => {
    it('암호화 후 복호화하면 원본과 동일', () => {
      const original = 'sTestSeedValue123';
      const encrypted = service.encrypt(original);

      expect(encrypted).not.toBe(original);
      expect(encrypted.split(':')).toHaveLength(3); // iv:tag:cipher 형식

      expect(service.decrypt(encrypted)).toBe(original);
    });

    it('같은 값을 두 번 암호화해도 결과가 다름 (랜덤 IV)', () => {
      const encrypted1 = service.encrypt('same-seed');
      const encrypted2 = service.encrypt('same-seed');

      expect(encrypted1).not.toBe(encrypted2);
    });
  });

  // ── fundAccount (testnet faucet) ────────────────────────────────────────────

  describe('fundAccount', () => {
    it('신규 지갑을 testnet에서 활성화 (faucet)', async () => {
      const wallet = service.generateWallet();

      await expect(service.fundAccount(wallet)).resolves.not.toThrow();

      // 실제 ledger에서 계정 잔액 확인
      const client = new Client(TESTNET_WS);
      await client.connect();

      try {
        const response = await client.request({
          command: 'account_info',
          account: wallet.address,
          ledger_index: 'validated',
        });

        const balanceDrops = Number(response.result.account_data.Balance);
        expect(balanceDrops).toBeGreaterThan(0);
      } finally {
        await client.disconnect();
      }
    });

    it('이미 활성화된 지갑에 재시도해도 에러 없음', async () => {
      const wallet = service.generateWallet();
      await service.fundAccount(wallet); // 최초 활성화

      // 두 번째 호출 (스케줄러 재시도 시나리오)
      await expect(service.fundAccount(wallet)).resolves.not.toThrow();
    });
  });
});
