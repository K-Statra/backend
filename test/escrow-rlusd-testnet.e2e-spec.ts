/**
 * RLUSD 에스크로 결제 테스트넷 통합 테스트
 *
 * 실제 XRPL testnet + MongoMemoryReplSet + 실제 Redis(Bull Queue) + OutboxWatcherService(Change Streams)
 * 로 RLUSD 토큰 에스크로 결제 플로우를 검증합니다.
 *
 * RLUSD faucet이 없으므로 테스트 전용 issuer 지갑을 직접 생성합니다:
 *   issuer 지갑 → buyer/seller에게 trust line 설정 → issuer가 buyer에게 토큰 전송
 *
 * 플로우:
 *   1. 결제 생성 (currency: RLUSD, buyer 자동 승인)
 *   2. seller 승인 → APPROVED
 *   3. 결제 개시 → trust line 자동 확인 + 잔고 검증 → PROCESSING + Outbox
 *   4. OutboxWatcher → EscrowCreateProcessor → XLS-85 EscrowCreate → ESCROWED → ACTIVE
 *   5. 이벤트 2개 양방향 승인 → EscrowFinish → RELEASED / COMPLETED
 *
 * 사전 조건:
 *   - Redis 로컬 실행 중 (localhost:6379)
 *   - XRPL testnet 접근 가능 (wss://s.altnet.rippletest.net:51233)
 *   - XLS-85(Token-Enabled Escrows) 활성화 필요
 *     미활성 시 EscrowCreate 단계에서 실패 (이전 단계인 trust line / 잔고 검증은 동작)
 *
 * 실행: npm run test:e2e:rlusd-testnet
 */

import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule, getModelToken } from "@nestjs/mongoose";
import { BullModule } from "@nestjs/bull";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { Model, Types } from "mongoose";
import { Wallet } from "xrpl";
import { EscrowPaymentsModule } from "../src/modules/escrow-payments/escrow-payments.module";
import { EscrowPaymentsService } from "../src/modules/escrow-payments/escrow-payments.service";
import { EscrowPaymentsCrudService } from "../src/modules/escrow-payments/escrow-payments-crud.service";
import { XrplService } from "../src/modules/xrpl/xrpl.service";
import { User } from "../src/modules/users/schemas/user.schema";

const TEST_ENCRYPTION_KEY = "a".repeat(64);
const TESTNET_WS = "wss://s.altnet.rippletest.net:51233";
// 테스트 전용 IOU currency code (3자리: XRPL 표준 형식)
const TEST_CURRENCY_CODE = "TST";

// ── issuer 지갑을 모듈 초기화 전에 생성 ───────────────────────────────────────
// Wallet.generate()는 동기 실행 → 생성된 주소를 ConfigModule에 바로 주입 가능
const issuerXrplWallet = Wallet.generate();

// ── 폴링 헬퍼 ─────────────────────────────────────────────────────────────────

async function waitForEscrowStatus(
  service: EscrowPaymentsService,
  paymentId: string,
  escrowId: string,
  expected: string,
  timeoutMs = 60_000,
) {
  const deadline = Date.now() + timeoutMs;
  let lastStatus = "(unknown)";
  while (Date.now() < deadline) {
    const item = await service.getEscrowStatus(paymentId, escrowId);
    lastStatus = item.status;
    if (item.status === expected) return item;
    // 비재시도 오류로 CANCELLED된 경우 즉시 실패 (더 기다려도 무의미)
    if (item.status === "CANCELLED") {
      throw new Error(
        `Escrow ${escrowId} was CANCELLED (XLS-85 미활성 또는 영구 오류). ` +
          `temDISABLED = XLS-85 amendment not active on testnet.`,
      );
    }
    await new Promise((r) => setTimeout(r, 1_000));
  }
  throw new Error(
    `Escrow ${escrowId} did not reach '${expected}' within ${timeoutMs}ms. ` +
      `Last status: ${lastStatus}`,
  );
}

async function waitForPaymentStatus(
  service: EscrowPaymentsCrudService,
  paymentId: string,
  userId: string,
  expected: string,
  timeoutMs = 60_000,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const payment = await service.findById(paymentId, userId);
    if (payment.status === expected) return payment;
    await new Promise((r) => setTimeout(r, 1_000));
  }
  throw new Error(
    `Payment ${paymentId} did not reach '${expected}' within ${timeoutMs}ms`,
  );
}

// ── 테스트 ─────────────────────────────────────────────────────────────────────

describe("RLUSD 에스크로 결제 테스트넷 통합 테스트", () => {
  let module: TestingModule;
  let mongoServer: MongoMemoryReplSet;
  let xrplService: XrplService;
  let escrowPaymentsService: EscrowPaymentsService;
  let crudService: EscrowPaymentsCrudService;
  let userModel: Model<User>;

  const buyerObjectId = new Types.ObjectId();
  const sellerObjectId = new Types.ObjectId();
  let sellerWalletAddress: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    const mongoUri = mongoServer.getUri();

    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              xrpl: {
                wsUrl: TESTNET_WS,
                destAddress: "",
                // 모듈 초기화 전에 생성한 issuer 지갑 주소 주입
                issuerAddress: issuerXrplWallet.address,
                issuedCurrencyCode: TEST_CURRENCY_CODE,
              },
              security: { encryptionKey: TEST_ENCRYPTION_KEY },
              REDIS_HOST: process.env.REDIS_HOST || "localhost",
              REDIS_PORT: Number(process.env.REDIS_PORT) || 6379,
            }),
          ],
        }),
        BullModule.forRoot({
          redis: {
            host: process.env.REDIS_HOST || "localhost",
            port: Number(process.env.REDIS_PORT) || 6379,
            password: process.env.REDIS_PASSWORD || undefined,
          },
        }),
        MongooseModule.forRoot(mongoUri),
        EscrowPaymentsModule,
      ],
    }).compile();

    await module.init();

    xrplService = module.get<XrplService>(XrplService);
    escrowPaymentsService = module.get<EscrowPaymentsService>(
      EscrowPaymentsService,
    );
    crudService = module.get<EscrowPaymentsCrudService>(
      EscrowPaymentsCrudService,
    );
    userModel = module.get<Model<User>>(getModelToken(User.name));

    // ── 지갑 생성 및 XRP faucet 펀딩 ────────────────────────────────────────
    // issuer: TrustSet/Payment 수수료용 XRP 필요
    // buyer: Trust Line reserve(2 XRP) + 수수료 필요
    // seller: Trust Line reserve(2 XRP) + 수수료 필요
    const buyerWallet = xrplService.generateWallet();
    const sellerWallet = xrplService.generateWallet();
    sellerWalletAddress = sellerWallet.address;

    const issuerWallet = {
      address: issuerXrplWallet.address,
      seed: issuerXrplWallet.seed!,
      publicKey: issuerXrplWallet.publicKey,
      privateKey: issuerXrplWallet.privateKey,
    };

    await Promise.all([
      xrplService.fundAccount(issuerWallet),
      xrplService.fundAccount(buyerWallet),
      xrplService.fundAccount(sellerWallet),
    ]);

    // issuer 계정에 AllowTrustLineLocking 설정 (asfAllowTrustLineLocking = 17)
    // XLS-85: issuer가 이 플래그 없으면 EscrowCreate 시 tecNO_PERMISSION
    await xrplService.enableTrustLineLocking(issuerWallet);

    // ── trust line 설정: buyer/seller → issuer ───────────────────────────────
    // initiatePayment에서도 ensureRlusdTrustLine을 호출하지만,
    // 그 전에 buyer에게 토큰을 전송해야 하므로 여기서 미리 설정
    const encryptedBuyerSeed = xrplService.encrypt(buyerWallet.seed);
    const encryptedSellerSeed = xrplService.encrypt(sellerWallet.seed);

    await Promise.all([
      xrplService.ensureRlusdTrustLine(buyerWallet.address, encryptedBuyerSeed),
      xrplService.ensureRlusdTrustLine(
        sellerWallet.address,
        encryptedSellerSeed,
      ),
    ]);

    // ── issuer → buyer 토큰 전송 (에스크로 금액 이상) ────────────────────────
    await xrplService.sendIssuedCurrencyPayment(
      issuerWallet,
      buyerWallet.address,
      "10000", // 10,000 TST — 테스트 에스크로(10 TST) 충분히 커버
    );

    // ── MongoDB에 buyer / seller 저장 ────────────────────────────────────────
    await (userModel as any).collection.insertMany([
      {
        _id: buyerObjectId,
        email: "buyer@rlusd-testnet.com",
        password: "hashed",
        name: "RLUSD Testnet Buyer",
        contactName: "Buyer",
        phone: "010-0000-0001",
        type: "buyer",
        needs: [],
        industries: [],
        status: "ACTIVE",
        wallet: {
          address: buyerWallet.address,
          seed: encryptedBuyerSeed,
          publicKey: buyerWallet.publicKey,
        },
      },
      {
        _id: sellerObjectId,
        email: "seller@rlusd-testnet.com",
        password: "hashed",
        name: "RLUSD Testnet Seller",
        contactName: "Seller",
        phone: "010-0000-0002",
        type: "seller",
        exportItems: [],
        industries: [],
        status: "ACTIVE",
        wallet: {
          address: sellerWallet.address,
          seed: encryptedSellerSeed,
          publicKey: sellerWallet.publicKey,
        },
      },
    ]);
  }, 180_000); // faucet 펀딩 × 3 + trust line × 2 + token send

  afterAll(async () => {
    await module.close();
    await mongoServer.stop();
  });

  it("TST 토큰 에스크로: 생성 → 이벤트 2개 양방향 승인 → EscrowFinish", async () => {
    // ── 1. 결제 생성 ─────────────────────────────────────────────────────
    const payment = await crudService.create(
      {
        counterpartyWalletAddress: sellerWalletAddress,
        memo: "테스트넷 TST 토큰 에스크로",
        currency: "RLUSD", // 서비스 분기 기준: RLUSD 코드 경로 사용
        escrows: [
          {
            label: "초기금",
            amountXrp: 10, // TST 단위 (amountXrp 필드를 amount로 재사용)
            order: 0,
            requiredEventTypes: ["SHIPMENT_CONFIRMED", "INSPECTION_PASSED"],
          },
        ],
      },
      buyerObjectId.toString(),
    );

    const paymentId = payment._id.toString();
    const escrowItemId = payment.escrows[0]._id.toString();

    expect(payment.status).toBe("DRAFT");
    expect(payment.buyerApproved).toBe(true);
    expect(payment.buyerApprovedAt).toBeDefined();
    expect(payment.currency).toBe("RLUSD");

    // ── 2. seller 승인 → APPROVED (buyer는 생성 시 자동 승인) ─────────────
    const afterApprove = await escrowPaymentsService.approvePayment(
      paymentId,
      sellerObjectId.toString(),
    );

    expect(afterApprove.status).toBe("APPROVED");

    // ── 3. 결제 개시 → PROCESSING ────────────────────────────────────────
    // initiatePayment:
    //   ensureRlusdTrustLine(buyer) → 이미 설정됨, skip
    //   ensureRlusdTrustLine(seller) → 이미 설정됨, skip
    //   validateRlusdFunds → buyer 잔고 10,000 TST ≥ 10 TST → 통과
    const afterInitiate = await escrowPaymentsService.initiatePayment(
      paymentId,
      buyerObjectId.toString(),
    );

    expect(afterInitiate.status).toBe("PROCESSING");

    // ── 4. 비동기 XLS-85 EscrowCreate 완료 대기 ─────────────────────────
    // OutboxWatcher → escrow_create_queue → EscrowCreateProcessor
    //   → xrplService.createEscrow(..., 'RLUSD')
    //   → Amount: { currency: 'TST', issuer: issuerAddress, value: '10' }
    //
    // ⚠️  XLS-85가 testnet에서 미활성화 상태이면 이 단계에서 실패합니다.
    //    (trust line 설정 및 잔고 검증은 정상 동작)
    const escrowItem = await waitForEscrowStatus(
      escrowPaymentsService,
      paymentId,
      escrowItemId,
      "ESCROWED",
      60_000,
    );
    const activePayment = await waitForPaymentStatus(
      crudService,
      paymentId,
      buyerObjectId.toString(),
      "ACTIVE",
      30_000,
    );

    expect(escrowItem.status).toBe("ESCROWED");
    expect(escrowItem.amountXrp).toBe(10);
    expect(escrowItem.txHashCreate).toMatch(/^[A-F0-9]{64}$/);
    expect(escrowItem.xrplSequence).toBeGreaterThan(0);
    expect(activePayment.status).toBe("ACTIVE");

    // ── 5. 이벤트1 buyer 승인 ────────────────────────────────────────────
    const afterE1Buyer = await escrowPaymentsService.approveEvent(
      paymentId,
      escrowItemId,
      "SHIPMENT_CONFIRMED",
      buyerObjectId.toString(),
    );
    const e1b = afterE1Buyer.escrows.find(
      (e) => e._id.toString() === escrowItemId,
    )!;
    expect(
      e1b.approvals.find((a) => a.eventType === "SHIPMENT_CONFIRMED")!
        .buyerApproved,
    ).toBe(true);
    expect(e1b.status).toBe("ESCROWED");

    // ── 6. 이벤트1 seller 승인 ───────────────────────────────────────────
    const afterE1Seller = await escrowPaymentsService.approveEvent(
      paymentId,
      escrowItemId,
      "SHIPMENT_CONFIRMED",
      sellerObjectId.toString(),
    );
    const e1s = afterE1Seller.escrows.find(
      (e) => e._id.toString() === escrowItemId,
    )!;
    expect(
      e1s.approvals.find((a) => a.eventType === "SHIPMENT_CONFIRMED")!
        .completedAt,
    ).toBeDefined();
    expect(e1s.status).toBe("ESCROWED");

    // ── 7. 이벤트2 buyer 승인 ────────────────────────────────────────────
    await escrowPaymentsService.approveEvent(
      paymentId,
      escrowItemId,
      "INSPECTION_PASSED",
      buyerObjectId.toString(),
    );

    // ── 8. 이벤트2 seller 승인 → 전체 완료 → 자동 EscrowFinish ──────────
    const finalPayment = await escrowPaymentsService.approveEvent(
      paymentId,
      escrowItemId,
      "INSPECTION_PASSED",
      sellerObjectId.toString(),
    );
    const finalEscrow = finalPayment.escrows.find(
      (e) => e._id.toString() === escrowItemId,
    )!;

    expect(finalEscrow.status).toBe("RELEASED");
    expect(finalEscrow.txHashRelease).toMatch(/^[A-F0-9]{64}$/);
    expect(finalPayment.status).toBe("COMPLETED");
  }, 300_000);
});
