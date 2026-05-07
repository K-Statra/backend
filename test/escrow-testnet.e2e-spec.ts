/**
 * XRPL 에스크로 테스트넷 통합 테스트 (풀스택)
 *
 * 실제 XRPL testnet + MongoMemoryReplSet + 실제 Redis(Bull Queue) + OutboxWatcherService(Change Streams)
 * 로 전체 에스크로 결제 플로우를 검증합니다:
 *
 *   1. 결제 내역 생성
 *   2. 양측(buyer / seller) 승인 → APPROVED
 *   3. 결제 개시 → PROCESSING + Outbox 이벤트 MongoDB 기록 (트랜잭션)
 *   4. OutboxWatcherService(Change Streams) → Bull Queue → EscrowCreateProcessor → XRPL EscrowCreate → ESCROWED → ACTIVE
 *   5. 이벤트1 buyer 승인 → ESCROWED 유지 (seller 미승인)
 *   6. 이벤트1 seller 승인 → 이벤트1 완료, 이벤트2 미완료 → ESCROWED 유지
 *   7. 이벤트2 buyer 승인 → ESCROWED 유지 (seller 미승인)
 *   8. 이벤트2 seller 승인 → 전체 완료 → 자동 EscrowFinish → RELEASED / COMPLETED
 *
 * 사전 조건:
 *   - Redis 로컬 실행 중 (localhost:6379)
 *   - XRPL testnet 접근 가능 (wss://s.altnet.rippletest.net:51233)
 * 실행: npm run test:e2e:testnet
 */

import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule, getModelToken } from "@nestjs/mongoose";
import { BullModule } from "@nestjs/bull";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { Model, Types } from "mongoose";
import { EscrowPaymentsModule } from "../src/modules/escrow-payments/escrow-payments.module";
import { EscrowPaymentsService } from "../src/modules/escrow-payments/escrow-payments.service";
import { XrplService } from "../src/modules/xrpl/xrpl.service";
import { User } from "../src/modules/users/schemas/user.schema";

const TEST_ENCRYPTION_KEY = "a".repeat(64);
const TESTNET_WS = "wss://s.altnet.rippletest.net:51233";

async function waitForEscrowStatus(
  service: EscrowPaymentsService,
  paymentId: string,
  escrowId: string,
  expected: string,
  timeoutMs = 60_000,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const item = await service.getEscrowStatus(paymentId, escrowId);
    if (item.status === expected) return item;
    await new Promise((r) => setTimeout(r, 1_000));
  }
  throw new Error(
    `Escrow ${escrowId} did not reach '${expected}' within ${timeoutMs}ms`,
  );
}

async function waitForPaymentStatus(
  service: EscrowPaymentsService,
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

describe("XRPL Escrow Testnet (풀스택 통합 테스트)", () => {
  let module: TestingModule;
  let mongoServer: MongoMemoryReplSet;
  let xrplService: XrplService;
  let escrowPaymentsService: EscrowPaymentsService;
  let userModel: Model<User>;
  let buyerWalletAddress: string;

  const buyerObjectId = new Types.ObjectId();
  const sellerObjectId = new Types.ObjectId();

  beforeAll(async () => {
    // 단일 노드 레플리카셋: MongoDB 트랜잭션(initiatePayment) + Change Streams(OutboxWatcher) 모두 지원
    mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    const mongoUri = mongoServer.getUri();

    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              xrpl: { wsUrl: TESTNET_WS, destAddress: "" },
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

    // module.init() → OnApplicationBootstrap 실행
    //   OutboxWatcherService: processPendingEvents() → startWatcher() (Change Streams 시작)
    await module.init();

    xrplService = module.get<XrplService>(XrplService);
    escrowPaymentsService = module.get<EscrowPaymentsService>(
      EscrowPaymentsService,
    );
    userModel = module.get<Model<User>>(getModelToken(User.name));

    // 실제 지갑 생성 및 testnet faucet 펀딩
    const buyerWallet = xrplService.generateWallet();
    const sellerWallet = xrplService.generateWallet();
    buyerWalletAddress = buyerWallet.address;

    await Promise.all([
      xrplService.fundAccount(buyerWallet),
      xrplService.fundAccount(sellerWallet),
    ]);

    // MongoDB에 buyer / seller 저장 — seed는 AES-256-GCM 암호화
    const encryptedBuyerSeed = xrplService.encrypt(buyerWallet.seed);

    await (userModel as any).collection.insertMany([
      {
        _id: buyerObjectId,
        email: "buyer@testnet-e2e.com",
        password: "hashed",
        name: "Testnet Buyer Corp",
        contactName: "Buyer Contact",
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
        email: "seller@testnet-e2e.com",
        password: "hashed",
        name: "Testnet Seller Corp",
        contactName: "Seller Contact",
        phone: "010-0000-0002",
        type: "seller",
        exportItems: [],
        industries: [],
        status: "ACTIVE",
        wallet: {
          address: sellerWallet.address,
          seed: "not-needed",
          publicKey: sellerWallet.publicKey,
        },
      },
    ]);
  }, 120_000);

  afterAll(async () => {
    // OnApplicationShutdown → OutboxWatcherService: Change Stream 닫힘
    await module.close();
    await mongoServer.stop();
  });

  it("초기금 에스크로 생성 → 이벤트 2개 양방향 승인 완료 시 자동 EscrowFinish", async () => {
    // ── 1. 결제 내역 생성 ─────────────────────────────────────────────────
    const payment = await escrowPaymentsService.create(
      {
        buyerId: buyerObjectId.toString(),
        sellerId: sellerObjectId.toString(),
        memo: "테스트넷 초기금 에스크로",
        escrows: [
          {
            label: "초기금",
            amountXrp: 10,
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
    expect(payment.totalAmountXrp).toBe(10);
    expect(payment.escrows).toHaveLength(1);
    expect(payment.escrows[0].amountXrp).toBe(10);
    expect(payment.escrows[0].approvals).toHaveLength(2);
    expect(
      payment.escrows[0].approvals.every(
        (a) => !a.buyerApproved && !a.sellerApproved,
      ),
    ).toBe(true);

    // ── 2. 결제 양측 승인 → APPROVED (XRPL 미실행) ───────────────────────
    await escrowPaymentsService.approvePayment(paymentId, "buyer");
    const afterBothApprove = await escrowPaymentsService.approvePayment(
      paymentId,
      "seller",
    );

    expect(afterBothApprove.status).toBe("APPROVED");
    expect(afterBothApprove.buyerApproved).toBe(true);
    expect(afterBothApprove.sellerApproved).toBe(true);
    expect(afterBothApprove.escrows[0].status).toBe("PENDING_ESCROW");

    // ── 3. 잔고 검증 → 결제 개시 → PROCESSING + Outbox 이벤트 기록 ─────────
    // faucet이 지급한 ~1000 XRP는 10 XRP 에스크로 + reserve + 수수료를 충분히 커버
    await expect(
      xrplService.validateEscrowFunds(buyerWalletAddress, [{ amountXrp: 10 }]),
    ).resolves.not.toThrow();

    // MongoDB 트랜잭션: payment(PROCESSING) + outbox_event(PENDING) 원자적 저장
    const afterInitiate = await escrowPaymentsService.initiatePayment(
      paymentId,
      buyerObjectId.toString(),
    );

    expect(afterInitiate.status).toBe("PROCESSING");
    expect(afterInitiate.escrows[0].status).toBe("PENDING_ESCROW");

    // ── 4. 비동기 EscrowCreate 완료 대기 ──────────────────────────────────
    // OutboxWatcherService(Change Streams) → escrow_create_queue.add()
    // → EscrowCreateProcessor.handle() → XrplService.createEscrow()
    // → ESCROWED, payment → ACTIVE
    // XRPL testnet 확인까지 최대 60초 대기
    const escrowItem = await waitForEscrowStatus(
      escrowPaymentsService,
      paymentId,
      escrowItemId,
      "ESCROWED",
      60_000,
    );
    const activePayment = await waitForPaymentStatus(
      escrowPaymentsService,
      paymentId,
      buyerObjectId.toString(),
      "ACTIVE",
      5_000,
    );

    expect(escrowItem.status).toBe("ESCROWED");
    expect(escrowItem.amountXrp).toBe(10);
    expect(escrowItem.txHashCreate).toMatch(/^[A-F0-9]{64}$/);
    expect(escrowItem.xrplSequence).toBeGreaterThan(0);
    expect(escrowItem.condition).toBeTruthy();
    expect(activePayment.status).toBe("ACTIVE");

    // ── 5. 이벤트1 buyer 승인 → 아직 ESCROWED (seller 미승인) ─────────────
    const afterE1Buyer = await escrowPaymentsService.approveEvent(
      paymentId,
      escrowItemId,
      "SHIPMENT_CONFIRMED",
      "buyer",
    );
    const e1b = afterE1Buyer.escrows.find(
      (e) => e._id.toString() === escrowItemId,
    )!;
    const approval1b = e1b.approvals.find(
      (a) => a.eventType === "SHIPMENT_CONFIRMED",
    )!;

    expect(approval1b.buyerApproved).toBe(true);
    expect(approval1b.sellerApproved).toBe(false);
    expect(approval1b.completedAt).toBeUndefined();
    expect(e1b.status).toBe("ESCROWED");

    // ── 6. 이벤트1 seller 승인 → 이벤트1 완료, 이벤트2 미완료 → ESCROWED ─
    const afterE1Seller = await escrowPaymentsService.approveEvent(
      paymentId,
      escrowItemId,
      "SHIPMENT_CONFIRMED",
      "seller",
    );
    const e1s = afterE1Seller.escrows.find(
      (e) => e._id.toString() === escrowItemId,
    )!;
    const approval1s = e1s.approvals.find(
      (a) => a.eventType === "SHIPMENT_CONFIRMED",
    )!;
    const approval2s = e1s.approvals.find(
      (a) => a.eventType === "INSPECTION_PASSED",
    )!;

    expect(approval1s.buyerApproved).toBe(true);
    expect(approval1s.sellerApproved).toBe(true);
    expect(approval1s.completedAt).toBeDefined();
    expect(approval2s.completedAt).toBeUndefined();
    expect(e1s.status).toBe("ESCROWED");

    // ── 7. 이벤트2 buyer 승인 → 아직 ESCROWED (seller 미승인) ─────────────
    const afterE2Buyer = await escrowPaymentsService.approveEvent(
      paymentId,
      escrowItemId,
      "INSPECTION_PASSED",
      "buyer",
    );
    const e2b = afterE2Buyer.escrows.find(
      (e) => e._id.toString() === escrowItemId,
    )!;
    const approval2b = e2b.approvals.find(
      (a) => a.eventType === "INSPECTION_PASSED",
    )!;

    expect(approval2b.buyerApproved).toBe(true);
    expect(approval2b.sellerApproved).toBe(false);
    expect(e2b.status).toBe("ESCROWED");

    // ── 8. 이벤트2 seller 승인 → 전체 완료 → 자동 EscrowFinish ───────────
    const finalPayment = await escrowPaymentsService.approveEvent(
      paymentId,
      escrowItemId,
      "INSPECTION_PASSED",
      "seller",
    );
    const finalEscrow = finalPayment.escrows.find(
      (e) => e._id.toString() === escrowItemId,
    )!;
    const finalApproval2 = finalEscrow.approvals.find(
      (a) => a.eventType === "INSPECTION_PASSED",
    )!;

    expect(finalApproval2.buyerApproved).toBe(true);
    expect(finalApproval2.sellerApproved).toBe(true);
    expect(finalApproval2.completedAt).toBeDefined();
    expect(finalEscrow.amountXrp).toBe(10);
    expect(finalEscrow.status).toBe("RELEASED");
    expect(finalEscrow.txHashRelease).toMatch(/^[A-F0-9]{64}$/);
    expect(finalPayment.status).toBe("COMPLETED");
  }, 300_000);
});
