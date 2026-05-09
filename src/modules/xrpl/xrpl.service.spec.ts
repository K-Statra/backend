import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import * as xrpl from "xrpl";
import { XrplService } from "./xrpl.service";
import {
  InsufficientXrpBalanceException,
  InsufficientRlusdBalanceException,
  XrplTransactionFailedException,
} from "../../common/exceptions";

// ── 공통 픽스처 ────────────────────────────────────────────────────────────────

const BUYER_ADDRESS = "rBuyerAddress123";
const SELLER_ADDRESS = "rSellerAddress456";
const TEST_ISSUER = "rIssuerAddress789";
const ENCRYPTION_KEY = "a".repeat(64); // 유효한 64자리 hex (테스트용)
const TEST_CURRENCY = "TISD";

function makeConfigService(overrides: Record<string, string> = {}) {
  const defaults: Record<string, string> = {
    "xrpl.wsUrl": "wss://s.altnet.rippletest.net:51233",
    "xrpl.destAddress": "rDestAddress",
    "xrpl.issuerAddress": TEST_ISSUER,
    "xrpl.issuedCurrencyCode": TEST_CURRENCY,
    "security.encryptionKey": ENCRYPTION_KEY,
    ...overrides,
  };
  return { get: (key: string) => defaults[key] };
}

function makeAccountLines(
  lines: { currency: string; account: string; balance?: string }[],
) {
  return { result: { lines } };
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
    autofill: jest.Mock;
    submitAndWait: jest.Mock;
    isConnected: jest.Mock;
    connect: jest.Mock;
  };

  beforeEach(async () => {
    mockClient = {
      request: jest.fn(),
      autofill: jest.fn().mockResolvedValue({ TransactionType: "mock" }),
      submitAndWait: jest.fn().mockResolvedValue({
        result: { hash: "ABCD1234", meta: { TransactionResult: "tesSUCCESS" } },
      }),
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

  // ── ensureRlusdTrustLine ──────────────────────────────────────────────────

  describe("ensureRlusdTrustLine", () => {
    // decrypt는 실제 AES 키가 맞아야 동작하므로 spy로 대체
    // Wallet.fromSeed + sign도 네트워크 불필요하지만 서명 검증 없이 tx_blob만 필요하므로 mock
    let walletSignSpy: jest.SpyInstance;

    beforeEach(() => {
      jest
        .spyOn(service as any, "decrypt")
        .mockReturnValue("sEdSomeFakeSeedForTest");

      walletSignSpy = jest.spyOn(xrpl.Wallet, "fromSeed").mockReturnValue({
        sign: jest
          .fn()
          .mockReturnValue({ tx_blob: "MOCKTXBLOB", hash: "MOCKHASH" }),
      } as any);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("trust line이 이미 있으면 TrustSet 제출 안 함", async () => {
      mockClient.request.mockResolvedValue(
        makeAccountLines([
          { currency: TEST_CURRENCY, account: TEST_ISSUER, balance: "1000" },
        ]),
      );

      await service.ensureRlusdTrustLine(BUYER_ADDRESS, "encrypted-seed");

      expect(mockClient.submitAndWait).not.toHaveBeenCalled();
    });

    it("trust line 없으면 TrustSet 제출", async () => {
      mockClient.request.mockResolvedValue(makeAccountLines([]));

      await service.ensureRlusdTrustLine(BUYER_ADDRESS, "encrypted-seed");

      expect(mockClient.autofill).toHaveBeenCalledWith(
        expect.objectContaining({
          TransactionType: "TrustSet",
          Account: BUYER_ADDRESS,
          LimitAmount: expect.objectContaining({
            currency: TEST_CURRENCY,
            issuer: TEST_ISSUER,
          }),
        }),
      );
      expect(mockClient.submitAndWait).toHaveBeenCalledWith("MOCKTXBLOB");
    });

    it("다른 issuer의 동일 currency가 있어도 TrustSet 제출", async () => {
      mockClient.request.mockResolvedValue(
        makeAccountLines([
          { currency: TEST_CURRENCY, account: "rOtherIssuer", balance: "500" },
        ]),
      );

      await service.ensureRlusdTrustLine(BUYER_ADDRESS, "encrypted-seed");

      expect(mockClient.submitAndWait).toHaveBeenCalled();
    });

    it("TrustSet 실패(tesSUCCESS 아님) → XrplTransactionFailedException", async () => {
      mockClient.request.mockResolvedValue(makeAccountLines([]));
      mockClient.submitAndWait.mockResolvedValue({
        result: {
          hash: "FAIL",
          meta: { TransactionResult: "tecINSUFFICIENT_RESERVE" },
        },
      });

      await expect(
        service.ensureRlusdTrustLine(BUYER_ADDRESS, "encrypted-seed"),
      ).rejects.toThrow(XrplTransactionFailedException);

      expect(walletSignSpy).toHaveBeenCalled();
    });
  });

  // ── validateRlusdFunds ────────────────────────────────────────────────────

  describe("validateRlusdFunds", () => {
    it("잔고 충분 → 예외 없이 통과", async () => {
      mockClient.request.mockResolvedValue(
        makeAccountLines([
          { currency: TEST_CURRENCY, account: TEST_ISSUER, balance: "1000" },
        ]),
      );

      await expect(
        service.validateRlusdFunds(BUYER_ADDRESS, [
          { amountXrp: 500 },
          { amountXrp: 300 },
        ]),
      ).resolves.toBeUndefined();
    });

    it("잔고 부족 → InsufficientRlusdBalanceException", async () => {
      mockClient.request.mockResolvedValue(
        makeAccountLines([
          { currency: TEST_CURRENCY, account: TEST_ISSUER, balance: "200" },
        ]),
      );

      await expect(
        service.validateRlusdFunds(BUYER_ADDRESS, [{ amountXrp: 500 }]),
      ).rejects.toThrow(InsufficientRlusdBalanceException);
    });

    it("trust line 없으면 잔고 0으로 간주 → InsufficientRlusdBalanceException", async () => {
      mockClient.request.mockResolvedValue(makeAccountLines([]));

      await expect(
        service.validateRlusdFunds(BUYER_ADDRESS, [{ amountXrp: 1 }]),
      ).rejects.toThrow(InsufficientRlusdBalanceException);
    });

    it("다른 issuer의 잔고는 집계 안 함", async () => {
      mockClient.request.mockResolvedValue(
        makeAccountLines([
          { currency: TEST_CURRENCY, account: "rOtherIssuer", balance: "9999" },
        ]),
      );

      await expect(
        service.validateRlusdFunds(BUYER_ADDRESS, [{ amountXrp: 1 }]),
      ).rejects.toThrow(InsufficientRlusdBalanceException);
    });

    it("잔고와 required가 정확히 같으면 통과", async () => {
      mockClient.request.mockResolvedValue(
        makeAccountLines([
          { currency: TEST_CURRENCY, account: TEST_ISSUER, balance: "300" },
        ]),
      );

      await expect(
        service.validateRlusdFunds(BUYER_ADDRESS, [
          { amountXrp: 100 },
          { amountXrp: 200 },
        ]),
      ).resolves.toBeUndefined();
    });
  });

  // ── sendIssuedCurrencyPayment ─────────────────────────────────────────────

  describe("sendIssuedCurrencyPayment", () => {
    const senderWallet = {
      address: SELLER_ADDRESS,
      seed: "sEdSomeFakeSeedForTest",
      publicKey: "",
      privateKey: "",
    };

    beforeEach(() => {
      jest.spyOn(xrpl.Wallet, "fromSeed").mockReturnValue({
        sign: jest
          .fn()
          .mockReturnValue({ tx_blob: "MOCKTXBLOB", hash: "MOCKHASH" }),
      } as any);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("성공 → txHash 반환", async () => {
      const txHash = await service.sendIssuedCurrencyPayment(
        senderWallet,
        BUYER_ADDRESS,
        "500",
      );

      expect(txHash).toBe("ABCD1234");
      expect(mockClient.autofill).toHaveBeenCalledWith(
        expect.objectContaining({
          TransactionType: "Payment",
          Account: SELLER_ADDRESS,
          Destination: BUYER_ADDRESS,
          Amount: expect.objectContaining({
            currency: TEST_CURRENCY,
            issuer: TEST_ISSUER,
            value: "500",
          }),
        }),
      );
    });

    it("Payment 실패 → XrplTransactionFailedException", async () => {
      mockClient.submitAndWait.mockResolvedValue({
        result: {
          hash: "FAIL",
          meta: { TransactionResult: "tecPATH_DRY" },
        },
      });

      await expect(
        service.sendIssuedCurrencyPayment(senderWallet, BUYER_ADDRESS, "500"),
      ).rejects.toThrow(XrplTransactionFailedException);
    });
  });
});
