import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { XrplService } from "./xrpl.service";
import { InsufficientXrpBalanceException } from "../../common/exceptions";

// ── 공통 픽스처 ────────────────────────────────────────────────────────────────

const BUYER_ADDRESS = "rBuyerAddress123";
const ENCRYPTION_KEY = "a".repeat(64); // 유효한 64자리 hex (테스트용)

function makeConfigService(overrides: Record<string, string> = {}) {
  const defaults: Record<string, string> = {
    "xrpl.wsUrl": "wss://s.altnet.rippletest.net:51233",
    "xrpl.destAddress": "rDestAddress",
    "security.encryptionKey": ENCRYPTION_KEY,
    ...overrides,
  };
  return { get: (key: string) => defaults[key] };
}

// account_info + server_info 응답 픽스처
function makeAccountInfo(balanceDrops: string, ownerCount: number) {
  return {
    result: {
      account_data: {
        Balance: balanceDrops,
        OwnerCount: ownerCount,
      },
    },
  };
}

function makeServerInfo(baseReserve: number, ownerReserve: number) {
  return {
    result: {
      info: {
        validated_ledger: {
          reserve_base_xrp: baseReserve,
          reserve_inc_xrp: ownerReserve,
        },
      },
    },
  };
}

// ── 테스트 ────────────────────────────────────────────────────────────────────

describe("XrplService", () => {
  let service: XrplService;
  let mockClient: {
    request: jest.Mock;
    isConnected: jest.Mock;
    connect: jest.Mock;
  };

  beforeEach(async () => {
    mockClient = {
      request: jest.fn(),
      isConnected: jest.fn().mockReturnValue(true),
      connect: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        XrplService,
        { provide: ConfigService, useValue: makeConfigService() },
      ],
    }).compile();

    service = module.get<XrplService>(XrplService);
    // XRPL Client를 mock으로 교체 (실제 WebSocket 연결 없이 테스트)
    (service as any).client = mockClient;
  });

  // ── validateEscrowFunds ───────────────────────────────────────────────────

  describe("validateEscrowFunds", () => {
    // 공통 헬퍼: account_info → server_info 순서로 mock 응답 설정
    function setupMocks(
      balanceDrops: string,
      ownerCount: number,
      baseReserve = 10,
      ownerReserve = 2,
    ) {
      mockClient.request
        .mockResolvedValueOnce(makeAccountInfo(balanceDrops, ownerCount))
        .mockResolvedValueOnce(makeServerInfo(baseReserve, ownerReserve));
    }

    it("잔고 충분 → 예외 없이 통과", async () => {
      // balance: 325 XRP, ownerCount: 0
      // required: 10(base) + 0*2(existing owners) + 1*2(new escrow) + 300(escrow) + 0.001(fee) = 312.001
      setupMocks("325000000", 0);

      await expect(
        service.validateEscrowFunds(BUYER_ADDRESS, [{ amountXrp: 300 }]),
      ).resolves.toBeUndefined();
    });

    it("잔고 부족 → InsufficientXrpBalanceException", async () => {
      // balance: 5 XRP
      // required: 10 + 0 + 2 + 300 + 0.001 = 312.001
      setupMocks("5000000", 0);

      await expect(
        service.validateEscrowFunds(BUYER_ADDRESS, [{ amountXrp: 300 }]),
      ).rejects.toThrow(InsufficientXrpBalanceException);
    });

    it("에스크로 1개: required drops = 10_000_000(base) + 2_000_000(newEscrow) + 300_000_000(amount) + 1_000(fee) = 312_001_000", async () => {
      setupMocks("5000000", 0); // 잔고 부족으로 예외 던짐 → 메시지에서 required 값 확인

      const err = await service
        .validateEscrowFunds(BUYER_ADDRESS, [{ amountXrp: 300 }])
        .catch((e) => e);

      expect(err).toBeInstanceOf(InsufficientXrpBalanceException);
      expect(err.message).toContain("required 312.001000 XRP");
      expect(err.message).toContain("available 5.000000 XRP");
    });

    it("에스크로 3개: required drops = 10_000_000 + 6_000_000 + 600_000_000 + 3_000 = 616_003_000", async () => {
      setupMocks("5000000", 0);

      const err = await service
        .validateEscrowFunds(BUYER_ADDRESS, [
          { amountXrp: 100 },
          { amountXrp: 200 },
          { amountXrp: 300 },
        ])
        .catch((e) => e);

      expect(err).toBeInstanceOf(InsufficientXrpBalanceException);
      expect(err.message).toContain("required 616.003000 XRP");
    });

    it("기존 ownerCount가 있으면 현재 reserve도 포함", async () => {
      // ownerCount: 3 → currentReserve = 10_000_000 + 3*2_000_000 = 16_000_000 drops
      // additionalReserve: 2_000_000, escrow: 300_000_000, fee: 1_000
      // required: 318_001_000 drops = 318.001 XRP
      setupMocks("5000000", 3);

      const err = await service
        .validateEscrowFunds(BUYER_ADDRESS, [{ amountXrp: 300 }])
        .catch((e) => e);

      expect(err).toBeInstanceOf(InsufficientXrpBalanceException);
      expect(err.message).toContain("required 318.001000 XRP");
    });

    it("reserve 값이 서버마다 다를 때 서버 응답값 사용 (base=20, owner=5)", async () => {
      // baseReserve: 20_000_000 drops, ownerReserve: 5_000_000 drops
      // required: 20_000_000 + 5_000_000 + 300_000_000 + 1_000 = 325_001_000 drops = 325.001 XRP
      setupMocks("5000000", 0, 20, 5);

      const err = await service
        .validateEscrowFunds(BUYER_ADDRESS, [{ amountXrp: 300 }])
        .catch((e) => e);

      expect(err).toBeInstanceOf(InsufficientXrpBalanceException);
      expect(err.message).toContain("required 325.001000 XRP");
    });

    it("소수점 XRP 금액 → drops 변환 정밀도 검증 (1.5 XRP × 2 = 3_000_000 drops)", async () => {
      // 각 에스크로를 xrpToDrops로 개별 변환하므로 float 누적 오차 없음
      // required: 10_000_000 + 4_000_000 + 3_000_000 + 2_000 = 17_002_000 drops = 17.002 XRP
      setupMocks("5000000", 0);

      const err = await service
        .validateEscrowFunds(BUYER_ADDRESS, [
          { amountXrp: 1.5 },
          { amountXrp: 1.5 },
        ])
        .catch((e) => e);

      expect(err).toBeInstanceOf(InsufficientXrpBalanceException);
      expect(err.message).toContain("required 17.002000 XRP");
    });

    it("잔고가 required와 정확히 같으면 통과", async () => {
      // required: 10 + 0 + 2 + 300 + 0.001 = 312.001 XRP = 312001000 drops
      setupMocks("312001000", 0);

      await expect(
        service.validateEscrowFunds(BUYER_ADDRESS, [{ amountXrp: 300 }]),
      ).resolves.toBeUndefined();
    });

    it("잔고가 required보다 1 drop 부족하면 예외", async () => {
      // 312.001 XRP = 312001000 drops → 1 drop 부족: 312000999
      setupMocks("312000999", 0);

      await expect(
        service.validateEscrowFunds(BUYER_ADDRESS, [{ amountXrp: 300 }]),
      ).rejects.toThrow(InsufficientXrpBalanceException);
    });
  });
});
