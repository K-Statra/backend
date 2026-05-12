/**
 * RLUSD 에스크로 결제 mock e2e 테스트
 *
 * XRP 플로우와 동일한 인프라 위에서 RLUSD 고유 동작만 검증:
 *   - initiatePayment 시 ensureRlusdTrustLine(buyer), ensureRlusdTrustLine(seller) 양측 호출
 *   - validateRlusdFunds 호출 (validateEscrowFunds 미호출)
 *   - createEscrow 호출 시 currency: 'RLUSD' 전달
 *   - RLUSD 잔고 부족 시 400 반환
 *   - 이벤트 양방향 승인 → EscrowFinish → COMPLETED 전체 플로우
 *
 * 실행: npm run test:e2e -- --testPathPatterns=escrow-rlusd-mock
 */

import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { MongooseModule, getModelToken } from "@nestjs/mongoose";
import { BullModule, getQueueToken } from "@nestjs/bull";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { Model, Types } from "mongoose";
import session from "express-session";
import { EscrowPaymentsModule } from "../src/modules/escrow-payments/escrow-payments.module";
import { EscrowCreateProcessor } from "../src/modules/escrow-payments/escrow-create.processor";
import { ESCROW_CREATE_QUEUE } from "../src/modules/escrow-payments/escrow-create.constants";
import { XrplService } from "../src/modules/xrpl/xrpl.service";
import { OutboxService } from "../src/modules/outbox/outbox.service";
import { OutboxWatcherService } from "../src/modules/outbox/outbox-watcher.service";
import { User } from "../src/modules/users/schemas/user.schema";
import { HttpExceptionFilter } from "../src/common/filters/http-exception.filter";
import { InsufficientRlusdBalanceException } from "../src/common/exceptions";

const BUYER_ADDRESS = "rPXachbQorqFQBPTRKU5FvujGrG56wMyGB";
const SELLER_ADDRESS = "rL4Mp1CJWr3q534m5V4RG8fC3E6wBQifFJ";

describe("RLUSD 에스크로 결제 (mock e2e)", () => {
  let app: INestApplication;
  let mongoServer: MongoMemoryReplSet;
  let userModel: Model<User>;

  const buyerObjectId = new Types.ObjectId();
  const sellerObjectId = new Types.ObjectId();

  const mockXrplService = {
    generateCryptoCondition: jest.fn(),
    encrypt: jest.fn(),
    decrypt: jest.fn(),
    createEscrow: jest.fn(),
    finishEscrow: jest.fn(),
    cancelEscrow: jest.fn(),
    validateEscrowFunds: jest.fn(),
    ensureRlusdTrustLine: jest.fn(),
    validateRlusdFunds: jest.fn(),
  };

  const mockOutboxService = { createPendingEvent: jest.fn() };
  const mockOutboxWatcherService = {
    onApplicationBootstrap: jest.fn().mockResolvedValue(undefined),
    onApplicationShutdown: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    const mongoUri = mongoServer.getUri();

    const mockQueue = {
      add: jest.fn(),
      process: jest.fn(),
      on: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      close: jest.fn(),
      isReady: jest.fn().mockResolvedValue(true),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        BullModule.forRoot({ redis: { host: "localhost", port: 6379 } }),
        MongooseModule.forRoot(mongoUri),
        EscrowPaymentsModule,
      ],
    })
      .overrideProvider(XrplService)
      .useValue(mockXrplService)
      .overrideProvider(getQueueToken(ESCROW_CREATE_QUEUE))
      .useValue(mockQueue)
      .overrideProvider(OutboxService)
      .useValue(mockOutboxService)
      .overrideProvider(OutboxWatcherService)
      .useValue(mockOutboxWatcherService)
      .compile();

    const processor = moduleFixture.get(EscrowCreateProcessor);

    mockQueue.add.mockImplementation(
      async ({
        paymentId,
        escrowIds,
      }: {
        paymentId: string;
        escrowIds: string[];
      }) => {
        for (const id of escrowIds) {
          await processor.createXrplEscrow(paymentId, id);
        }
      },
    );

    mockOutboxService.createPendingEvent.mockImplementation(
      (_session: any, _eventType: string, payload: any) => {
        setTimeout(() => void mockQueue.add(payload), 50);
      },
    );

    app = moduleFixture.createNestApplication();
    app.use(
      session({
        secret: "ci-test-secret",
        resave: false,
        saveUninitialized: true,
        cookie: { secure: false },
      }),
    );
    app.use((req: any, _res: any, next: any) => {
      const userId = req.headers["x-test-user-id"] as string | undefined;
      const userType = req.headers["x-test-user-type"] as string | undefined;
      if (userId && userType) {
        req.session.userId = userId;
        req.session.type = userType;
      }
      next();
    });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    userModel = moduleFixture.get<Model<User>>(getModelToken(User.name));

    await (userModel as any).collection.insertMany([
      {
        _id: buyerObjectId,
        email: "buyer@rlusd-e2e.com",
        password: "hashed",
        name: "RLUSD Buyer Corp",
        contactName: "Buyer",
        phone: "010-0000-0001",
        type: "buyer",
        needs: [],
        industries: [],
        status: "ACTIVE",
        wallet: {
          address: BUYER_ADDRESS,
          seed: "enc:buyer_seed",
          publicKey: "buyer_pub",
        },
      },
      {
        _id: sellerObjectId,
        email: "seller@rlusd-e2e.com",
        password: "hashed",
        name: "RLUSD Seller Corp",
        contactName: "Seller",
        phone: "010-0000-0002",
        type: "seller",
        exportItems: [],
        industries: [],
        status: "ACTIVE",
        wallet: {
          address: SELLER_ADDRESS,
          seed: "enc:seller_seed",
          publicKey: "seller_pub",
        },
      },
    ]);
  }, 60_000);

  afterAll(async () => {
    await app.close();
    await mongoServer.stop();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockXrplService.generateCryptoCondition.mockReturnValue({
      condition: "A02580204ABCDEF",
      fulfillment: "A022802012345678",
    });
    mockXrplService.encrypt.mockImplementation((v: string) => `enc:${v}`);
    mockXrplService.decrypt.mockImplementation((v: string) =>
      v.replace(/^enc:/, ""),
    );
    mockXrplService.ensureRlusdTrustLine.mockResolvedValue(undefined);
    mockXrplService.validateRlusdFunds.mockResolvedValue(undefined);
    mockXrplService.createEscrow.mockResolvedValue({
      txHash: "RLUSD_CREATE_TX_HASH",
      sequence: 12345,
    });
    mockXrplService.finishEscrow.mockResolvedValue("RLUSD_FINISH_TX_HASH");
  });

  const asBuyer = () => ({
    "x-test-user-id": buyerObjectId.toString(),
    "x-test-user-type": "buyer",
  });
  const asSeller = () => ({
    "x-test-user-id": sellerObjectId.toString(),
    "x-test-user-type": "seller",
  });

  async function waitForEscrowStatus(
    paymentId: string,
    escrowId: string,
    expected: string,
    timeoutMs = 5_000,
  ) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const res = await request(app.getHttpServer())
        .get(`/escrow-payments/${paymentId}/escrows/${escrowId}/status`)
        .set(asBuyer());
      if (res.body.status === expected) return;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error(
      `Escrow ${escrowId} did not reach '${expected}' within ${timeoutMs}ms`,
    );
  }

  const rlusdCreatePayload = (overrides: object = {}) => ({
    counterpartyWalletAddress: SELLER_ADDRESS,
    memo: "RLUSD 테스트 결제",
    currency: "RLUSD",
    escrows: [
      {
        label: "초기금",
        amountXrp: 1000,
        order: 0,
        requiredEventTypes: ["SHIPMENT_CONFIRMED", "INSPECTION_PASSED"],
      },
    ],
    ...overrides,
  });

  /** 결제 생성 → 양측 승인 → 개시 → ESCROWED 까지 진행하는 헬퍼 */
  async function createRlusdEscrowedPayment() {
    const createRes = await request(app.getHttpServer())
      .post("/escrow-payments")
      .set(asBuyer())
      .send(rlusdCreatePayload())
      .expect(201);

    const paymentId: string = createRes.body._id;
    const escrowItemId: string = createRes.body.escrows[0]._id;

    // buyer는 생성 시 자동 승인되므로 seller만 승인하면 APPROVED
    await request(app.getHttpServer())
      .post(`/escrow-payments/${paymentId}/approve`)
      .set(asSeller());
    await request(app.getHttpServer())
      .post(`/escrow-payments/${paymentId}/pay`)
      .set(asBuyer())
      .expect(201);

    await waitForEscrowStatus(paymentId, escrowItemId, "ESCROWED");
    return { paymentId, escrowItemId };
  }

  // ── 결제 생성 ────────────────────────────────────────────────────────────────

  describe("POST /escrow-payments (RLUSD)", () => {
    it("currency: RLUSD → 201, currency 필드 RLUSD로 저장", async () => {
      const res = await request(app.getHttpServer())
        .post("/escrow-payments")
        .set(asBuyer())
        .send(rlusdCreatePayload())
        .expect(201);

      expect(res.body.currency).toBe("RLUSD");
      expect(res.body.status).toBe("PENDING_APPROVAL");
    });

    it("currency 미전달 → XRP 기본값", async () => {
      const res = await request(app.getHttpServer())
        .post("/escrow-payments")
        .set(asBuyer())
        .send({
          counterpartyWalletAddress: SELLER_ADDRESS,
          escrows: [
            {
              label: "초기금",
              amountXrp: 100,
              order: 0,
              requiredEventTypes: [],
            },
          ],
        })
        .expect(201);

      expect(res.body.currency).toBe("XRP");
    });

    it("currency 잘못된 값 → 400", async () => {
      await request(app.getHttpServer())
        .post("/escrow-payments")
        .set(asBuyer())
        .send(rlusdCreatePayload({ currency: "BTC" }))
        .expect(400);
    });
  });

  // ── 결제 개시 pre-flight ──────────────────────────────────────────────────────

  describe("POST /pay — RLUSD pre-flight", () => {
    it("initiatePayment 시 buyer/seller 양측에 ensureRlusdTrustLine 호출", async () => {
      const createRes = await request(app.getHttpServer())
        .post("/escrow-payments")
        .set(asBuyer())
        .send(rlusdCreatePayload())
        .expect(201);
      const paymentId = createRes.body._id;

      // buyer는 생성 시 자동 승인되므로 seller만 승인하면 APPROVED
      await request(app.getHttpServer())
        .post(`/escrow-payments/${paymentId}/approve`)
        .set(asSeller());
      await request(app.getHttpServer())
        .post(`/escrow-payments/${paymentId}/pay`)
        .set(asBuyer())
        .expect(201);

      expect(mockXrplService.ensureRlusdTrustLine).toHaveBeenCalledWith(
        BUYER_ADDRESS,
        "enc:buyer_seed",
      );
      expect(mockXrplService.ensureRlusdTrustLine).toHaveBeenCalledWith(
        SELLER_ADDRESS,
        "enc:seller_seed",
      );
      expect(mockXrplService.ensureRlusdTrustLine).toHaveBeenCalledTimes(2);
    });

    it("validateRlusdFunds 호출, validateEscrowFunds 미호출", async () => {
      const createRes = await request(app.getHttpServer())
        .post("/escrow-payments")
        .set(asBuyer())
        .send(rlusdCreatePayload())
        .expect(201);
      const paymentId = createRes.body._id;

      // buyer는 생성 시 자동 승인되므로 seller만 승인하면 APPROVED
      await request(app.getHttpServer())
        .post(`/escrow-payments/${paymentId}/approve`)
        .set(asSeller());
      await request(app.getHttpServer())
        .post(`/escrow-payments/${paymentId}/pay`)
        .set(asBuyer())
        .expect(201);

      expect(mockXrplService.validateRlusdFunds).toHaveBeenCalledTimes(1);
      expect(mockXrplService.validateEscrowFunds).not.toHaveBeenCalled();
    });

    it("RLUSD 잔고 부족 → 400", async () => {
      mockXrplService.validateRlusdFunds.mockRejectedValue(
        new InsufficientRlusdBalanceException(200, 1000),
      );

      const createRes = await request(app.getHttpServer())
        .post("/escrow-payments")
        .set(asBuyer())
        .send(rlusdCreatePayload())
        .expect(201);
      const paymentId = createRes.body._id;

      // buyer는 생성 시 자동 승인되므로 seller만 승인하면 APPROVED
      await request(app.getHttpServer())
        .post(`/escrow-payments/${paymentId}/approve`)
        .set(asSeller());

      await request(app.getHttpServer())
        .post(`/escrow-payments/${paymentId}/pay`)
        .set(asBuyer())
        .expect(400);
    });
  });

  // ── EscrowCreate currency 전달 ────────────────────────────────────────────────

  describe("createXrplEscrow — RLUSD currency 전달", () => {
    it("createEscrow 호출 시 5번째 인자로 'RLUSD' 전달", async () => {
      const { paymentId, escrowItemId } = await createRlusdEscrowedPayment();

      // ESCROWED 상태 확인
      const statusRes = await request(app.getHttpServer())
        .get(`/escrow-payments/${paymentId}/escrows/${escrowItemId}/status`)
        .set(asBuyer());
      expect(statusRes.body.status).toBe("ESCROWED");

      expect(mockXrplService.createEscrow).toHaveBeenCalledWith(
        expect.anything(), // buyerWallet
        SELLER_ADDRESS, // sellerAddress
        1000, // amount
        "A02580204ABCDEF", // condition
        "RLUSD", // currency
      );
    });
  });

  // ── 전체 플로우 ───────────────────────────────────────────────────────────────

  describe("RLUSD 전체 플로우: 생성 → 승인 → 개시 → 이벤트 완료 → COMPLETED", () => {
    it("이벤트 2개 양방향 승인 완료 → RELEASED / COMPLETED", async () => {
      const { paymentId, escrowItemId } = await createRlusdEscrowedPayment();

      // 이벤트1 buyer 승인
      await request(app.getHttpServer())
        .post(
          `/escrow-payments/${paymentId}/escrows/${escrowItemId}/events/SHIPMENT_CONFIRMED/approve`,
        )
        .set(asBuyer())
        .expect(201);

      // 이벤트1 seller 승인
      await request(app.getHttpServer())
        .post(
          `/escrow-payments/${paymentId}/escrows/${escrowItemId}/events/SHIPMENT_CONFIRMED/approve`,
        )
        .set(asSeller())
        .expect(201);

      // 이벤트2 buyer 승인
      await request(app.getHttpServer())
        .post(
          `/escrow-payments/${paymentId}/escrows/${escrowItemId}/events/INSPECTION_PASSED/approve`,
        )
        .set(asBuyer())
        .expect(201);

      // 이벤트2 seller 승인 → 전체 완료 → EscrowFinish
      const finalRes = await request(app.getHttpServer())
        .post(
          `/escrow-payments/${paymentId}/escrows/${escrowItemId}/events/INSPECTION_PASSED/approve`,
        )
        .set(asSeller())
        .expect(201);

      const finalEscrow = finalRes.body.escrows.find(
        (e: any) => e._id === escrowItemId,
      );

      expect(finalEscrow.status).toBe("RELEASED");
      expect(finalEscrow.txHashRelease).toBe("RLUSD_FINISH_TX_HASH");
      expect(finalRes.body.status).toBe("COMPLETED");
    });
  });
});
