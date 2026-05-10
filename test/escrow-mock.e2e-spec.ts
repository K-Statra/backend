/**
 * EscrowPayments HTTP e2e 테스트
 *
 * - mongodb-memory-server (MongoMemoryReplSet) 로 단일 노드 레플리카셋 구동
 *   → MongoDB 트랜잭션(initiatePayment)과 Change Streams 모두 지원
 * - XrplService, OutboxService, OutboxWatcherService는 jest 모의로 대체
 * - OutboxService.createPendingEvent: setImmediate로 mockQueue.add 비동기 호출
 *   → POST /pay 응답 직후 에스크로 처리, waitForEscrowStatus 폴링으로 완료 대기
 * - express-session MemoryStore + 헤더 기반 세션 주입으로 인증 시뮬레이션
 *
 * 실행: npm run test:e2e -- --testPathPatterns=escrow-mock.e2e
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
import { InsufficientXrpBalanceException } from "../src/common/exceptions";

describe("EscrowPayments (e2e)", () => {
  let app: INestApplication;
  let mongoServer: MongoMemoryReplSet;
  let userModel: Model<User>;

  const buyerObjectId = new Types.ObjectId();
  const sellerObjectId = new Types.ObjectId();
  const nonParticipantId = new Types.ObjectId();

  const BUYER_WALLET_ADDR = "rBuyerE2ETestAddress12345";
  const SELLER_WALLET_ADDR = "rSe11erE2ETestAddress5678";

  // XrplService 전체를 모의 객체로 대체 (실제 XRPL 네트워크 호출 없음)
  const mockXrplService = {
    generateCryptoCondition: jest.fn(),
    encrypt: jest.fn(),
    decrypt: jest.fn(),
    createEscrow: jest.fn(),
    finishEscrow: jest.fn(),
    generateWallet: jest.fn(),
    fundAccount: jest.fn(),
    cancelEscrow: jest.fn(),
    validateEscrowFunds: jest.fn(),
  };

  // OutboxService 모의: createPendingEvent가 setImmediate로 큐 처리를 예약
  const mockOutboxService = {
    createPendingEvent: jest.fn(),
  };

  // OutboxWatcherService 모의: Change Streams 시작하지 않음
  const mockOutboxWatcherService = {
    onApplicationBootstrap: jest.fn().mockResolvedValue(undefined),
    onApplicationShutdown: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    // 단일 노드 레플리카셋: MongoDB 트랜잭션 + Change Streams 지원
    mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    const mongoUri = mongoServer.getUri();

    // Queue mock: add()가 호출되면 즉시 createXrplEscrow를 동기 실행
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

    // compile() 후 서비스 참조를 얻어 mock 구현 완성
    const processor = moduleFixture.get(EscrowCreateProcessor);

    // 큐 add → 에스크로 항목별로 createXrplEscrow 인라인 실행
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

    // Outbox createPendingEvent → 트랜잭션 커밋 후 setTimeout으로 큐 예약
    // setImmediate는 트랜잭션 커밋 I/O 완료 전에 실행되는 race condition이 있어 setTimeout 사용
    mockOutboxService.createPendingEvent.mockImplementation(
      (_session: any, _eventType: string, payload: any) => {
        setTimeout(() => {
          void mockQueue.add(payload);
        }, 50);
      },
    );

    app = moduleFixture.createNestApplication();

    // 1) 세션 미들웨어 (MemoryStore — Redis 불필요)
    app.use(
      session({
        secret: "ci-test-secret",
        resave: false,
        saveUninitialized: true,
        cookie: { secure: false },
      }),
    );

    // 2) 테스트 헤더로 세션 주입 (SessionGuard / CurrentUser 통과)
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

    // 테스트용 buyer / seller 사용자 생성 (지갑 포함)
    await (userModel as any).collection.insertMany([
      {
        _id: buyerObjectId,
        email: "buyer@e2e-test.com",
        password: "hashed",
        name: "Test Buyer Corp",
        contactName: "Buyer Contact",
        phone: "010-0000-0001",
        type: "buyer",
        needs: [],
        industries: [],
        status: "ACTIVE",
        wallet: {
          address: BUYER_WALLET_ADDR,
          seed: "enc:buyer_seed_plain",
          publicKey: "buyer_pub_key",
        },
      },
      {
        _id: sellerObjectId,
        email: "seller@e2e-test.com",
        password: "hashed",
        name: "Test Seller Corp",
        contactName: "Seller Contact",
        phone: "010-0000-0002",
        type: "seller",
        exportItems: [],
        industries: [],
        status: "ACTIVE",
        wallet: {
          address: SELLER_WALLET_ADDR,
          seed: "enc:seller_seed_plain",
          publicKey: "seller_pub_key",
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
    mockXrplService.validateEscrowFunds.mockResolvedValue(undefined);
    mockXrplService.createEscrow.mockResolvedValue({
      txHash: "CREATE_TX_HASH_MOCK",
      sequence: 99999,
    });
    mockXrplService.finishEscrow.mockResolvedValue("FINISH_TX_HASH_MOCK");

    // clearAllMocks는 mock.calls 만 지우고 mockImplementation은 유지되므로
    // OutboxService / mockQueue 구현은 beforeAll 설정이 그대로 살아있음
  });

  // 요청 헤더 헬퍼
  const asBuyer = () => ({
    "x-test-user-id": buyerObjectId.toString(),
    "x-test-user-type": "buyer",
  });
  const asSeller = () => ({
    "x-test-user-id": sellerObjectId.toString(),
    "x-test-user-type": "seller",
  });
  const asNonParticipant = () => ({
    "x-test-user-id": nonParticipantId.toString(),
    "x-test-user-type": "buyer",
  });

  // 에스크로 항목 상태를 폴링해서 expected 상태가 될 때까지 기다림
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

  // 기본 생성 payload 헬퍼
  const baseCreatePayload = (overrides: object = {}) => ({
    buyerId: buyerObjectId.toString(),
    sellerWalletAddress: SELLER_WALLET_ADDR,
    memo: "테스트 메모",
    escrows: [
      {
        label: "초기금",
        amountXrp: 500,
        order: 0,
        requiredEventTypes: ["SHIPMENT_CONFIRMED", "INSPECTION_PASSED"],
      },
    ],
    ...overrides,
  });

  /**
   * 결제 생성 → 양측 승인(APPROVED) → POST /pay(PROCESSING)
   * → 비동기 XRPL 에스크로 생성(ESCROWED) → ACTIVE 까지 진행하는 헬퍼
   */
  async function createActiveEscrowedPayment() {
    const createRes = await request(app.getHttpServer())
      .post("/escrow-payments")
      .set(asBuyer())
      .send(
        baseCreatePayload({
          escrows: [
            {
              label: "초기금",
              amountXrp: 300,
              order: 0,
              requiredEventTypes: ["SHIPMENT_CONFIRMED"],
            },
          ],
        }),
      );
    const paymentId: string = createRes.body._id;
    const escrowItemId: string = createRes.body.escrows[0]._id;

    // buyer는 생성 시 자동 승인되므로 seller만 승인하면 APPROVED
    await request(app.getHttpServer())
      .post(`/escrow-payments/${paymentId}/approve`)
      .set(asSeller());

    // POST /pay → PROCESSING; Outbox → setImmediate → 큐 → createXrplEscrow
    await request(app.getHttpServer())
      .post(`/escrow-payments/${paymentId}/pay`)
      .set(asBuyer())
      .expect(201);

    // 백그라운드 EscrowCreate 완료 대기
    await waitForEscrowStatus(paymentId, escrowItemId, "ESCROWED");

    return { paymentId, escrowItemId };
  }

  // ── 인증 (SessionGuard) ────────────────────────────────────────────────────

  describe("인증 (SessionGuard)", () => {
    it("세션 헤더 없으면 401 반환", async () => {
      await request(app.getHttpServer()).get("/escrow-payments").expect(401);
    });

    it("buyer 세션으로 200 반환", async () => {
      await request(app.getHttpServer())
        .get("/escrow-payments")
        .set(asBuyer())
        .expect(200);
    });

    it("seller 세션으로 200 반환", async () => {
      await request(app.getHttpServer())
        .get("/escrow-payments")
        .set(asSeller())
        .expect(200);
    });
  });

  // ── POST /escrow-payments ─────────────────────────────────────────────────

  describe("POST /escrow-payments", () => {
    it("정상 데이터 → 201, DRAFT 상태로 생성", async () => {
      const res = await request(app.getHttpServer())
        .post("/escrow-payments")
        .set(asBuyer())
        .send(baseCreatePayload())
        .expect(201);

      expect(res.body._id).toBeDefined();
      expect(res.body.status).toBe("DRAFT");
      expect(res.body.totalAmountXrp).toBe(500);
      expect(res.body.buyerApproved).toBe(true);
      expect(res.body.buyerApprovedAt).toBeDefined();
      expect(res.body.sellerApproved).toBe(false);
    });

    it("에스크로 항목 구조 검증", async () => {
      const res = await request(app.getHttpServer())
        .post("/escrow-payments")
        .set(asBuyer())
        .send(
          baseCreatePayload({
            escrows: [
              {
                label: "초기금",
                amountXrp: 300,
                order: 0,
                requiredEventTypes: ["SHIPMENT_CONFIRMED", "INSPECTION_PASSED"],
              },
              {
                label: "잔금",
                amountXrp: 700,
                order: 1,
                requiredEventTypes: ["DELIVERY_CONFIRMED"],
              },
            ],
          }),
        )
        .expect(201);

      expect(res.body.totalAmountXrp).toBe(1000);
      expect(res.body.escrows).toHaveLength(2);

      const first = res.body.escrows[0];
      expect(first.amountXrp).toBe(300);
      expect(first.status).toBe("PENDING_ESCROW");
      expect(first.approvals).toHaveLength(2);
      expect(first.approvals[0].buyerApproved).toBe(false);
      expect(first.approvals[0].sellerApproved).toBe(false);

      const second = res.body.escrows[1];
      expect(second.amountXrp).toBe(700);
    });

    it("buyerId가 유효하지 않은 MongoId → 400", async () => {
      await request(app.getHttpServer())
        .post("/escrow-payments")
        .set(asBuyer())
        .send(baseCreatePayload({ buyerId: "invalid-id" }))
        .expect(400);
    });

    it("amountXrp가 음수 → 400", async () => {
      await request(app.getHttpServer())
        .post("/escrow-payments")
        .set(asBuyer())
        .send(
          baseCreatePayload({
            escrows: [
              {
                label: "초기금",
                amountXrp: -100,
                order: 0,
                requiredEventTypes: [],
              },
            ],
          }),
        )
        .expect(400);
    });

    it("escrows 배열 누락 → 400", async () => {
      const withoutEscrows = { ...baseCreatePayload() } as any;
      delete withoutEscrows.escrows;
      await request(app.getHttpServer())
        .post("/escrow-payments")
        .set(asBuyer())
        .send(withoutEscrows)
        .expect(400);
    });
  });

  // ── GET /escrow-payments(조회) ──────────────────────────────────────────────────

  describe("GET /escrow-payments", () => {
    it("페이지네이션 메타 포함 응답", async () => {
      const res = await request(app.getHttpServer())
        .get("/escrow-payments")
        .set(asBuyer())
        .expect(200);

      expect(res.body).toMatchObject({
        data: expect.any(Array),
        total: expect.any(Number),
        page: 1,
        limit: 5,
      });
    });

    it("group=ongoing → DRAFT/PENDING_APPROVAL/APPROVED/PROCESSING/ACTIVE 만 포함", async () => {
      const res = await request(app.getHttpServer())
        .get("/escrow-payments?group=ongoing")
        .set(asBuyer())
        .expect(200);

      for (const p of res.body.data) {
        expect([
          "DRAFT",
          "PENDING_APPROVAL",
          "APPROVED",
          "PROCESSING",
          "ACTIVE",
        ]).toContain(p.status);
      }
    });

    it("group=done → COMPLETED/CANCELLED 만 포함", async () => {
      const res = await request(app.getHttpServer())
        .get("/escrow-payments?group=done")
        .set(asBuyer())
        .expect(200);

      for (const p of res.body.data) {
        expect(["COMPLETED", "CANCELLED"]).toContain(p.status);
      }
    });

    it("page/limit 파라미터 적용", async () => {
      const res = await request(app.getHttpServer())
        .get("/escrow-payments?page=2&limit=3")
        .set(asBuyer())
        .expect(200);

      expect(res.body.page).toBe(2);
      expect(res.body.limit).toBe(3);
      expect(res.body.data.length).toBeLessThanOrEqual(3);
    });
  });

  // ── GET /escrow-payments/:id(단건 조회) ───────────────────────────────────────────────

  describe("GET /escrow-payments/:id", () => {
    let targetId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post("/escrow-payments")
        .set(asBuyer())
        .send(baseCreatePayload({ memo: "단건 조회 테스트" }));
      targetId = res.body._id;
    });

    it("존재하는 결제 → 200, 정확한 데이터 반환", async () => {
      const res = await request(app.getHttpServer())
        .get(`/escrow-payments/${targetId}`)
        .set(asBuyer())
        .expect(200);

      expect(res.body._id).toBe(targetId);
      expect(res.body.memo).toBe("단건 조회 테스트");
    });

    it("존재하지 않는 id → 404", async () => {
      await request(app.getHttpServer())
        .get(`/escrow-payments/${new Types.ObjectId().toString()}`)
        .set(asBuyer())
        .expect(404);
    });

    it("유효하지 않은 ObjectId → 400", async () => {
      await request(app.getHttpServer())
        .get("/escrow-payments/bad-id")
        .set(asBuyer())
        .expect(400);
    });
  });

  // ── POST /escrow-payments/:id/approve ─────────────────────────────────────

  describe("POST /escrow-payments/:id/approve", () => {
    let paymentId: string;

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post("/escrow-payments")
        .set(asBuyer())
        .send(baseCreatePayload());
      paymentId = res.body._id;
    });

    it("buyer 승인 시도 → 400 (생성 시 자동 승인됨)", async () => {
      await request(app.getHttpServer())
        .post(`/escrow-payments/${paymentId}/approve`)
        .set(asBuyer())
        .expect(400);
    });

    it("seller 승인 → APPROVED (buyer는 생성 시 자동 승인됨)", async () => {
      const res = await request(app.getHttpServer())
        .post(`/escrow-payments/${paymentId}/approve`)
        .set(asSeller())
        .expect(201);

      expect(res.body.status).toBe("APPROVED");
      expect(res.body.buyerApproved).toBe(true);
      expect(res.body.sellerApproved).toBe(true);
    });

    it("seller 승인만으로 APPROVED 전환 (XRPL 미실행)", async () => {
      const res = await request(app.getHttpServer())
        .post(`/escrow-payments/${paymentId}/approve`)
        .set(asSeller())
        .expect(201);

      // buyer 자동 승인 + seller 승인 → APPROVED, 아직 XRPL 에스크로 미실행
      expect(res.body.status).toBe("APPROVED");
      expect(res.body.buyerApproved).toBe(true);
      expect(res.body.sellerApproved).toBe(true);
      expect(res.body.escrows[0].status).toBe("PENDING_ESCROW");
    });

    it("동일 역할 중복 승인 → 400", async () => {
      await request(app.getHttpServer())
        .post(`/escrow-payments/${paymentId}/approve`)
        .set(asSeller())
        .expect(201);

      await request(app.getHttpServer())
        .post(`/escrow-payments/${paymentId}/approve`)
        .set(asSeller())
        .expect(400);
    });

    it("존재하지 않는 결제 → 404", async () => {
      await request(app.getHttpServer())
        .post(`/escrow-payments/${new Types.ObjectId().toString()}/approve`)
        .set(asBuyer())
        .expect(404);
    });

    it("APPROVED 상태에서 승인 시도 → 400", async () => {
      await request(app.getHttpServer())
        .post(`/escrow-payments/${paymentId}/approve`)
        .set(asSeller());
      // seller 승인으로 APPROVED 전환 — 추가 승인 불가

      await request(app.getHttpServer())
        .post(`/escrow-payments/${paymentId}/approve`)
        .set(asSeller())
        .expect(400);
    });
  });

  // ── POST /escrow-payments/:id/pay ─────────────────────────────────────────

  describe("POST /escrow-payments/:id/pay", () => {
    let paymentId: string;
    let escrowItemId: string;

    beforeEach(async () => {
      const createRes = await request(app.getHttpServer())
        .post("/escrow-payments")
        .set(asBuyer())
        .send(
          baseCreatePayload({
            escrows: [
              {
                label: "초기금",
                amountXrp: 300,
                order: 0,
                requiredEventTypes: ["SHIPMENT_CONFIRMED"],
              },
            ],
          }),
        );
      paymentId = createRes.body._id;
      escrowItemId = createRes.body.escrows[0]._id;

      // buyer는 생성 시 자동 승인되므로 seller만 승인하면 APPROVED
      await request(app.getHttpServer())
        .post(`/escrow-payments/${paymentId}/approve`)
        .set(asSeller());
    });

    it("APPROVED 결제 → 201, PROCESSING 상태 반환 후 비동기 ESCROWED", async () => {
      const res = await request(app.getHttpServer())
        .post(`/escrow-payments/${paymentId}/pay`)
        .set(asBuyer())
        .expect(201);

      // 즉시 반환 — PROCESSING 상태, 에스크로는 아직 PENDING_ESCROW
      expect(res.body.status).toBe("PROCESSING");
      expect(res.body.escrows[0].status).toBe("PENDING_ESCROW");

      // 비동기 처리 완료 후 ESCROWED, payment → ACTIVE
      await waitForEscrowStatus(paymentId, escrowItemId, "ESCROWED");

      const statusRes = await request(app.getHttpServer())
        .get(`/escrow-payments/${paymentId}/escrows/${escrowItemId}/status`)
        .set(asBuyer());
      expect(statusRes.body.status).toBe("ESCROWED");
      expect(statusRes.body.amountXrp).toBe(300);
      expect(statusRes.body.txHashCreate).toBe("CREATE_TX_HASH_MOCK");
      expect(statusRes.body.xrplSequence).toBe(99999);

      expect(mockXrplService.createEscrow).toHaveBeenCalledTimes(1);
      expect(mockXrplService.createEscrow).toHaveBeenCalledWith(
        expect.objectContaining({ address: BUYER_WALLET_ADDR }),
        SELLER_WALLET_ADDR,
        300,
        "A02580204ABCDEF",
        "XRP",
      );
    });

    it("seller는 결제 개시 불가 → 403", async () => {
      await request(app.getHttpServer())
        .post(`/escrow-payments/${paymentId}/pay`)
        .set(asSeller())
        .expect(403);
    });

    it("비참여자 결제 개시 시도 → 403", async () => {
      await request(app.getHttpServer())
        .post(`/escrow-payments/${paymentId}/pay`)
        .set(asNonParticipant())
        .expect(403);
    });

    it("APPROVED 아닌 결제(DRAFT) → 400", async () => {
      const draftRes = await request(app.getHttpServer())
        .post("/escrow-payments")
        .set(asBuyer())
        .send(baseCreatePayload());
      const draftId = draftRes.body._id;

      await request(app.getHttpServer())
        .post(`/escrow-payments/${draftId}/pay`)
        .set(asBuyer())
        .expect(400);
    });

    it("존재하지 않는 결제 → 404", async () => {
      await request(app.getHttpServer())
        .post(`/escrow-payments/${new Types.ObjectId().toString()}/pay`)
        .set(asBuyer())
        .expect(404);
    });

    it("잔고 충분 → validateEscrowFunds 통과, 결제 개시 성공 (201)", async () => {
      // beforeEach에서 mockResolvedValue(undefined) 설정 — 잔고 충분 시뮬레이션
      await request(app.getHttpServer())
        .post(`/escrow-payments/${paymentId}/pay`)
        .set(asBuyer())
        .expect(201);

      expect(mockXrplService.validateEscrowFunds).toHaveBeenCalledTimes(1);
      expect(mockXrplService.validateEscrowFunds).toHaveBeenCalledWith(
        BUYER_WALLET_ADDR,
        expect.arrayContaining([expect.objectContaining({ amountXrp: 300 })]),
      );
    });

    it("잔고 부족 → validateEscrowFunds 예외, 400 반환", async () => {
      // 현재 잔고 5 XRP, 필요량 312 XRP(에스크로 300 + reserve + 수수료) 시뮬레이션
      mockXrplService.validateEscrowFunds.mockRejectedValueOnce(
        new InsufficientXrpBalanceException(5, 312),
      );

      const res = await request(app.getHttpServer())
        .post(`/escrow-payments/${paymentId}/pay`)
        .set(asBuyer())
        .expect(400);

      expect(res.body.message.message).toMatch(/Insufficient XRP balance/);
      expect(mockXrplService.validateEscrowFunds).toHaveBeenCalledTimes(1);
    });
  });

  // ── POST /escrow-payments/:id/escrows/:escrowId/create ────────────────────
  // ── POST /.../events/:type/approve ────────────────────────────────────────

  describe("POST /escrow-payments/:id/escrows/:escrowId/events/:type/approve", () => {
    let paymentId: string;
    let escrowItemId: string;

    beforeEach(async () => {
      const res = await createActiveEscrowedPayment();
      paymentId = res.paymentId;
      escrowItemId = res.escrowItemId;
    });

    it("buyer 이벤트 승인 → 201, buyerApproved=true, 미완료 상태 유지", async () => {
      const res = await request(app.getHttpServer())
        .post(
          `/escrow-payments/${paymentId}/escrows/${escrowItemId}/events/SHIPMENT_CONFIRMED/approve`,
        )
        .set(asBuyer())
        .expect(201);

      const escrow = res.body.escrows.find((e: any) => e._id === escrowItemId);
      const approval = escrow.approvals.find(
        (a: any) => a.eventType === "SHIPMENT_CONFIRMED",
      );
      expect(approval.buyerApproved).toBe(true);
      expect(approval.sellerApproved).toBe(false);
      expect(approval.completedAt).toBeUndefined();
      expect(escrow.status).toBe("ESCROWED");
      expect(mockXrplService.finishEscrow).not.toHaveBeenCalled();
    });

    it("buyer + seller 모두 승인 → RELEASED, EscrowFinish 자동 제출", async () => {
      await request(app.getHttpServer())
        .post(
          `/escrow-payments/${paymentId}/escrows/${escrowItemId}/events/SHIPMENT_CONFIRMED/approve`,
        )
        .set(asBuyer());

      const res = await request(app.getHttpServer())
        .post(
          `/escrow-payments/${paymentId}/escrows/${escrowItemId}/events/SHIPMENT_CONFIRMED/approve`,
        )
        .set(asSeller())
        .expect(201);

      const escrow = res.body.escrows.find((e: any) => e._id === escrowItemId);
      expect(escrow.amountXrp).toBe(300);
      expect(escrow.status).toBe("RELEASED");
      expect(escrow.txHashRelease).toBe("FINISH_TX_HASH_MOCK");
      expect(res.body.status).toBe("COMPLETED");

      expect(mockXrplService.finishEscrow).toHaveBeenCalledTimes(1);
      expect(mockXrplService.finishEscrow).toHaveBeenCalledWith(
        expect.objectContaining({ address: BUYER_WALLET_ADDR }),
        BUYER_WALLET_ADDR,
        99999,
        "A02580204ABCDEF",
        expect.any(String),
      );
    });

    it("buyer 이벤트 중복 승인 → 400", async () => {
      await request(app.getHttpServer())
        .post(
          `/escrow-payments/${paymentId}/escrows/${escrowItemId}/events/SHIPMENT_CONFIRMED/approve`,
        )
        .set(asBuyer())
        .expect(201);

      await request(app.getHttpServer())
        .post(
          `/escrow-payments/${paymentId}/escrows/${escrowItemId}/events/SHIPMENT_CONFIRMED/approve`,
        )
        .set(asBuyer())
        .expect(400);
    });

    it("존재하지 않는 이벤트 타입 → 404", async () => {
      await request(app.getHttpServer())
        .post(
          `/escrow-payments/${paymentId}/escrows/${escrowItemId}/events/UNKNOWN_EVENT/approve`,
        )
        .set(asBuyer())
        .expect(404);
    });

    it("PENDING_ESCROW 상태 항목에서 이벤트 승인 시도 → 400", async () => {
      // buyer만 승인(PENDING_APPROVAL) → 에스크로 항목은 여전히 PENDING_ESCROW
      const freshRes = await request(app.getHttpServer())
        .post("/escrow-payments")
        .set(asBuyer())
        .send(
          baseCreatePayload({
            escrows: [
              {
                label: "미에스크로",
                amountXrp: 100,
                order: 0,
                requiredEventTypes: ["DELIVERY_CONFIRMED"],
              },
            ],
          }),
        );
      const freshId = freshRes.body._id;
      const freshEscrowId = freshRes.body.escrows[0]._id;

      // seller 미승인 → 에스크로 항목 PENDING_ESCROW 유지

      await request(app.getHttpServer())
        .post(
          `/escrow-payments/${freshId}/escrows/${freshEscrowId}/events/DELIVERY_CONFIRMED/approve`,
        )
        .set(asBuyer())
        .expect(400);
    });

    it("다중 이벤트 — 모든 이벤트 완료 시에만 자동 해제", async () => {
      const twoEventRes = await request(app.getHttpServer())
        .post("/escrow-payments")
        .set(asBuyer())
        .send(
          baseCreatePayload({
            escrows: [
              {
                label: "복합조건",
                amountXrp: 200,
                order: 0,
                requiredEventTypes: ["SHIPMENT_CONFIRMED", "INSPECTION_PASSED"],
              },
            ],
          }),
        );
      const twoPaymentId = twoEventRes.body._id;
      const twoEscrowId = twoEventRes.body.escrows[0]._id;

      // buyer는 생성 시 자동 승인되므로 seller만 승인하면 APPROVED
      await request(app.getHttpServer())
        .post(`/escrow-payments/${twoPaymentId}/approve`)
        .set(asSeller());
      // POST /pay → 비동기 EscrowCreate → ESCROWED
      await request(app.getHttpServer())
        .post(`/escrow-payments/${twoPaymentId}/pay`)
        .set(asBuyer());
      await waitForEscrowStatus(twoPaymentId, twoEscrowId, "ESCROWED");

      await request(app.getHttpServer())
        .post(
          `/escrow-payments/${twoPaymentId}/escrows/${twoEscrowId}/events/SHIPMENT_CONFIRMED/approve`,
        )
        .set(asBuyer());
      const afterFirstRes = await request(app.getHttpServer())
        .post(
          `/escrow-payments/${twoPaymentId}/escrows/${twoEscrowId}/events/SHIPMENT_CONFIRMED/approve`,
        )
        .set(asSeller());

      const escrowAfterFirst = afterFirstRes.body.escrows.find(
        (e: any) => e._id === twoEscrowId,
      );
      expect(escrowAfterFirst.status).toBe("ESCROWED");
      expect(mockXrplService.finishEscrow).not.toHaveBeenCalled();

      await request(app.getHttpServer())
        .post(
          `/escrow-payments/${twoPaymentId}/escrows/${twoEscrowId}/events/INSPECTION_PASSED/approve`,
        )
        .set(asBuyer());
      const finalRes = await request(app.getHttpServer())
        .post(
          `/escrow-payments/${twoPaymentId}/escrows/${twoEscrowId}/events/INSPECTION_PASSED/approve`,
        )
        .set(asSeller())
        .expect(201);

      const finalEscrow = finalRes.body.escrows.find(
        (e: any) => e._id === twoEscrowId,
      );
      expect(finalEscrow.amountXrp).toBe(200);
      expect(finalEscrow.status).toBe("RELEASED");
      expect(mockXrplService.finishEscrow).toHaveBeenCalledTimes(1);
    });
  });

  // ── GET /escrow-payments/:id/escrows/:escrowId/status ─────────────────────

  describe("GET /escrow-payments/:id/escrows/:escrowId/status", () => {
    let paymentId: string;
    let escrowItemId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post("/escrow-payments")
        .set(asBuyer())
        .send(
          baseCreatePayload({
            memo: "상태조회 테스트",
            escrows: [
              {
                label: "상태조회용",
                amountXrp: 50,
                order: 0,
                requiredEventTypes: ["CUSTOM"],
              },
            ],
          }),
        );
      paymentId = res.body._id;
      escrowItemId = res.body.escrows[0]._id;
    });

    it("PENDING_ESCROW 항목 상태 조회 → 200", async () => {
      const res = await request(app.getHttpServer())
        .get(`/escrow-payments/${paymentId}/escrows/${escrowItemId}/status`)
        .set(asBuyer())
        .expect(200);

      expect(res.body.status).toBe("PENDING_ESCROW");
      expect(res.body.label).toBe("상태조회용");
      expect(res.body.amountXrp).toBe(50);
      expect(res.body.approvals).toHaveLength(1);
    });

    it("존재하지 않는 escrowId → 404", async () => {
      await request(app.getHttpServer())
        .get(
          `/escrow-payments/${paymentId}/escrows/${new Types.ObjectId().toString()}/status`,
        )
        .set(asBuyer())
        .expect(404);
    });

    it("존재하지 않는 paymentId → 404", async () => {
      await request(app.getHttpServer())
        .get(
          `/escrow-payments/${new Types.ObjectId().toString()}/escrows/${escrowItemId}/status`,
        )
        .set(asBuyer())
        .expect(404);
    });
  });

  // ── POST /escrow-payments/:id/escrows/:escrowId/cancel ────────────────────

  describe("POST /escrow-payments/:id/escrows/:escrowId/cancel", () => {
    let paymentId: string;
    let escrowItemId: string;

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post("/escrow-payments")
        .set(asBuyer())
        .send(
          baseCreatePayload({
            escrows: [
              {
                label: "취소 테스트",
                amountXrp: 100,
                order: 0,
                requiredEventTypes: ["CUSTOM"],
              },
            ],
          }),
        );
      paymentId = res.body._id;
      escrowItemId = res.body.escrows[0]._id;
    });

    it("PENDING_ESCROW 항목 취소 → 201, CANCELLED 전환", async () => {
      const res = await request(app.getHttpServer())
        .post(`/escrow-payments/${paymentId}/escrows/${escrowItemId}/cancel`)
        .set(asBuyer())
        .expect(201);

      const escrow = res.body.escrows.find((e: any) => e._id === escrowItemId);
      expect(escrow.status).toBe("CANCELLED");
    });

    it("이미 CANCELLED 항목 재취소 → 400", async () => {
      await request(app.getHttpServer())
        .post(`/escrow-payments/${paymentId}/escrows/${escrowItemId}/cancel`)
        .set(asBuyer())
        .expect(201);

      await request(app.getHttpServer())
        .post(`/escrow-payments/${paymentId}/escrows/${escrowItemId}/cancel`)
        .set(asBuyer())
        .expect(400);
    });

    it("ESCROWED 항목 취소 시도 → 400", async () => {
      await request(app.getHttpServer())
        .post(`/escrow-payments/${paymentId}/approve`)
        .set(asBuyer());
      await request(app.getHttpServer())
        .post(`/escrow-payments/${paymentId}/approve`)
        .set(asSeller());
      // POST /pay → PROCESSING → 비동기 EscrowCreate → ESCROWED
      await request(app.getHttpServer())
        .post(`/escrow-payments/${paymentId}/pay`)
        .set(asBuyer());
      await waitForEscrowStatus(paymentId, escrowItemId, "ESCROWED");

      await request(app.getHttpServer())
        .post(`/escrow-payments/${paymentId}/escrows/${escrowItemId}/cancel`)
        .set(asBuyer())
        .expect(400);
    });

    it("존재하지 않는 paymentId → 404", async () => {
      await request(app.getHttpServer())
        .post(
          `/escrow-payments/${new Types.ObjectId().toString()}/escrows/${escrowItemId}/cancel`,
        )
        .set(asBuyer())
        .expect(404);
    });

    it("존재하지 않는 escrowId → 404", async () => {
      await request(app.getHttpServer())
        .post(
          `/escrow-payments/${paymentId}/escrows/${new Types.ObjectId().toString()}/cancel`,
        )
        .set(asBuyer())
        .expect(404);
    });
  });
});
