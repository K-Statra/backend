/**
 * EscrowPayments 인프라 e2e 테스트
 *
 * 실제 인프라:
 *   - MongoMemoryReplSet (트랜잭션 + Change Streams)
 *   - Redis Bull Queue (localhost:6379)
 *   - OutboxService, OutboxWatcherService: 실제 동작 (Change Stream → Bull 파이프라인)
 *
 * Mock: XrplService만 (실제 XRPL 네트워크 미사용)
 *
 * 에러 시나리오 중심으로 테스트합니다:
 *   - Non-retryable 오류 (tecUNFUNDED 등) → 즉시 롤백
 *   - Retryable 오류 → Bull 재시도 → 성공
 *   - 모든 재시도 소진 → @OnQueueFailed → 롤백
 *   - 중복 job 멱등성 (ESCROWED 항목 재처리 시 skip)
 *   - 다중 escrow 부분 실패 → 전체 롤백
 *   - 서버 재시작/Change Stream 단절 복구 (processPendingEvents, backoff, HistoryLost)
 *
 * 실행: npm run test:e2e -- --testPathPatterns=escrow-infra
 */

import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { MongooseModule, getModelToken } from "@nestjs/mongoose";
import { BullModule, getQueueToken } from "@nestjs/bull";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { Model, Types } from "mongoose";
import type { Queue } from "bull";
import session from "express-session";
import { EscrowPaymentsModule } from "../src/modules/escrow-payments/escrow-payments.module";
import { ESCROW_CREATE_QUEUE } from "../src/modules/escrow-payments/escrow-create.constants";
import { XrplService } from "../src/modules/xrpl/xrpl.service";
import { EscrowPayment } from "../src/modules/escrow-payments/schemas/escrow-payment.schema";
import { User } from "../src/modules/users/schemas/user.schema";
import { HttpExceptionFilter } from "../src/common/filters/http-exception.filter";
import { OutboxWatcherService } from "../src/modules/outbox/outbox-watcher.service";
import {
  OutboxEvent,
  OutboxEventDocument,
} from "../src/modules/outbox/schemas/outbox-event.schema";
import {
  StreamResumeToken,
  StreamResumeTokenDocument,
} from "../src/modules/outbox/schemas/stream-resume-token.schema";

describe("EscrowPayments 인프라 e2e (real Redis+MongoDB, mock XRPL)", () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let mongoServer: MongoMemoryReplSet;
  let queue: Queue;
  let escrowPaymentModel: Model<any>;

  const buyerObjectId = new Types.ObjectId();
  const sellerObjectId = new Types.ObjectId();
  const BUYER_WALLET_ADDR = "rPXachbQorqFQBPTRKU5FvujGrG56wMyGB";
  const SELLER_WALLET_ADDR = "rL4Mp1CJWr3q534m5V4RG8fC3E6wBQifFJ";

  const mockXrplService = {
    generateCryptoCondition: jest.fn(),
    encrypt: jest.fn(),
    decrypt: jest.fn(),
    createEscrow: jest.fn(),
    finishEscrow: jest.fn(),
    cancelEscrow: jest.fn(),
    validateEscrowFunds: jest.fn(),
    findEscrowByCondition: jest.fn(),
    ensureRlusdTrustLine: jest.fn(),
    validateRlusdFunds: jest.fn(),
  };

  beforeAll(async () => {
    mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    const mongoUri = mongoServer.getUri();

    moduleFixture = await Test.createTestingModule({
      imports: [
        BullModule.forRoot({ redis: { host: "localhost", port: 6379 } }),
        MongooseModule.forRoot(mongoUri),
        EscrowPaymentsModule,
      ],
    })
      .overrideProvider(XrplService)
      .useValue(mockXrplService)
      .compile();

    app = moduleFixture.createNestApplication();

    app.use(
      session({
        secret: "infra-test-secret",
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

    queue = moduleFixture.get<Queue>(getQueueToken(ESCROW_CREATE_QUEUE));
    escrowPaymentModel = moduleFixture.get<Model<any>>(
      getModelToken(EscrowPayment.name),
    );

    const userModel = moduleFixture.get<Model<User>>(getModelToken(User.name));
    await (userModel as any).collection.insertMany([
      {
        _id: buyerObjectId,
        email: "buyer@infra-test.com",
        password: "hashed",
        name: "Infra Buyer Corp",
        contactName: "Buyer",
        phone: "010-0000-0001",
        type: "buyer",
        needs: [],
        industries: [],
        status: "ACTIVE",
        wallet: {
          address: BUYER_WALLET_ADDR,
          seed: "enc:buyer_seed",
          publicKey: "buyer_pub",
        },
      },
      {
        _id: sellerObjectId,
        email: "seller@infra-test.com",
        password: "hashed",
        name: "Infra Seller Corp",
        contactName: "Seller",
        phone: "010-0000-0002",
        type: "seller",
        exportItems: [],
        industries: [],
        status: "ACTIVE",
        wallet: { address: SELLER_WALLET_ADDR, publicKey: "seller_pub" },
      },
    ]);
  }, 60_000);

  afterAll(async () => {
    await app.close();
    await mongoServer.stop();
  });

  beforeEach(() => {
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
      txHash: "MOCK_TX_HASH",
      sequence: 42,
    });
    mockXrplService.finishEscrow.mockResolvedValue("MOCK_FINISH_TX");
    mockXrplService.cancelEscrow.mockResolvedValue(undefined);
    mockXrplService.findEscrowByCondition.mockResolvedValue(null);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    // 대기 중인 job 제거 (active job은 완료될 때까지 대기)
    await queue.empty();
    await queue.clean(0, "completed");
    await queue.clean(0, "failed");
  });

  // ── 헬퍼 ──────────────────────────────────────────────────────────────────

  const asBuyer = () => ({
    "x-test-user-id": buyerObjectId.toString(),
    "x-test-user-type": "buyer",
  });
  const asSeller = () => ({
    "x-test-user-id": sellerObjectId.toString(),
    "x-test-user-type": "seller",
  });

  async function waitForPaymentStatus(
    paymentId: string,
    expected: string,
    timeoutMs = 15_000,
  ): Promise<any> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const res = await request(app.getHttpServer())
        .get(`/escrow-payments/${paymentId}`)
        .set(asBuyer());
      if (res.body.status === expected) return res.body;
      await new Promise((r) => setTimeout(r, 150));
    }
    const res = await request(app.getHttpServer())
      .get(`/escrow-payments/${paymentId}`)
      .set(asBuyer());
    throw new Error(
      `Payment ${paymentId}: expected '${expected}', got '${res.body.status}'`,
    );
  }

  async function waitForEscrowStatus(
    paymentId: string,
    escrowId: string,
    expected: string,
    timeoutMs = 15_000,
  ): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const res = await request(app.getHttpServer())
        .get(`/escrow-payments/${paymentId}/escrows/${escrowId}/status`)
        .set(asBuyer());
      if (res.body.status === expected) return;
      await new Promise((r) => setTimeout(r, 150));
    }
    throw new Error(
      `Escrow ${escrowId} did not reach '${expected}' within ${timeoutMs}ms`,
    );
  }

  /** HTTP 생성 + 양측 승인까지만 진행 (APPROVED 상태) */
  async function createApprovedPayment(escrows?: object[]) {
    const createRes = await request(app.getHttpServer())
      .post("/escrow-payments")
      .set(asBuyer())
      .send({
        counterpartyWalletAddress: SELLER_WALLET_ADDR,
        memo: "인프라 테스트",
        escrows: escrows ?? [
          {
            label: "초기금",
            amountXrp: 100,
            order: 0,
            requiredEventTypes: ["SHIPMENT_CONFIRMED"],
          },
        ],
      })
      .expect(201);

    const paymentId: string = createRes.body._id;
    await request(app.getHttpServer())
      .post(`/escrow-payments/${paymentId}/approve`)
      .set(asSeller())
      .expect(201);

    const escrowIds: string[] = createRes.body.escrows.map((e: any) => e._id);
    return { paymentId, escrowId: escrowIds[0], escrowIds };
  }

  /**
   * DB를 직접 PROCESSING으로 전환한 뒤 지정된 옵션으로 Bull job을 주입합니다.
   * OutboxWatcher의 기본 backoff(5s exponential)를 우회해 빠른 재시도 테스트에 사용합니다.
   */
  async function injectJobDirectly(
    paymentId: string,
    escrowIds: string[],
    bullOpts: object,
  ): Promise<void> {
    await escrowPaymentModel.findByIdAndUpdate(paymentId, {
      status: "PROCESSING",
    });
    await queue.add({ paymentId, escrowIds }, bullOpts);
  }

  // ── 정상 흐름 ────────────────────────────────────────────────────────────────

  describe("정상 흐름 — 실제 Change Stream → Bull → Processor 파이프라인", () => {
    it("POST /pay → Outbox insert → Change Stream 감지 → Bull job → ESCROWED → ACTIVE", async () => {
      const { paymentId, escrowId } = await createApprovedPayment();

      const payRes = await request(app.getHttpServer())
        .post(`/escrow-payments/${paymentId}/pay`)
        .set(asBuyer())
        .expect(201);

      // 응답은 즉시 반환 — PROCESSING 상태
      expect(payRes.body.status).toBe("PROCESSING");
      expect(payRes.body.escrows[0].status).toBe("PENDING_ESCROW");

      // OutboxWatcherService가 Change Stream으로 감지 → Bull job 추가 → Processor 실행
      await waitForEscrowStatus(paymentId, escrowId, "ESCROWED");
      await waitForPaymentStatus(paymentId, "ACTIVE");

      expect(mockXrplService.createEscrow).toHaveBeenCalledTimes(1);
      expect(mockXrplService.createEscrow).toHaveBeenCalledWith(
        expect.objectContaining({ address: BUYER_WALLET_ADDR }),
        SELLER_WALLET_ADDR,
        100,
        "A02580204ABCDEF",
        "XRP",
      );
    }, 20_000);
  });

  // ── 에러 시나리오 ─────────────────────────────────────────────────────────────

  describe("Non-retryable 오류 — Bull 재시도 없이 즉시 롤백", () => {
    it("tecUNFUNDED → 1회 시도 후 job completed, payment CANCELLED", async () => {
      mockXrplService.createEscrow.mockRejectedValue(
        new Error("tecUNFUNDED: insufficient XRP balance"),
      );

      const { paymentId } = await createApprovedPayment();

      await request(app.getHttpServer())
        .post(`/escrow-payments/${paymentId}/pay`)
        .set(asBuyer())
        .expect(201);

      // non-retryable → processor가 throw하지 않고 return → job completed
      // rollbackAllEscrows() 호출 → payment CANCELLED
      await waitForPaymentStatus(paymentId, "CANCELLED");

      // 재시도 없이 정확히 1회만 호출
      expect(mockXrplService.createEscrow).toHaveBeenCalledTimes(1);
    }, 20_000);

    it("tecINSUF_RESERVE → 즉시 롤백", async () => {
      mockXrplService.createEscrow.mockRejectedValue(
        new Error("tecINSUF_RESERVE"),
      );

      const { paymentId } = await createApprovedPayment();
      await request(app.getHttpServer())
        .post(`/escrow-payments/${paymentId}/pay`)
        .set(asBuyer());

      await waitForPaymentStatus(paymentId, "CANCELLED");
      expect(mockXrplService.createEscrow).toHaveBeenCalledTimes(1);
    }, 20_000);

    it("temBAD_AMOUNT → 즉시 롤백", async () => {
      mockXrplService.createEscrow.mockRejectedValue(
        new Error("temBAD_AMOUNT"),
      );

      const { paymentId } = await createApprovedPayment();
      await request(app.getHttpServer())
        .post(`/escrow-payments/${paymentId}/pay`)
        .set(asBuyer());

      await waitForPaymentStatus(paymentId, "CANCELLED");
      expect(mockXrplService.createEscrow).toHaveBeenCalledTimes(1);
    }, 20_000);
  });

  describe("Retryable 오류 — Bull이 재시도 후 성공", () => {
    it("1회 네트워크 오류 → Bull 재시도 → ESCROWED", async () => {
      // 첫 번째 호출만 실패, 두 번째부터 성공
      mockXrplService.createEscrow
        .mockRejectedValueOnce(new Error("WebSocket connection failed"))
        .mockResolvedValue({ txHash: "RETRY_SUCCESS_TX", sequence: 777 });

      const { paymentId, escrowId } = await createApprovedPayment();

      await request(app.getHttpServer())
        .post(`/escrow-payments/${paymentId}/pay`)
        .set(asBuyer())
        .expect(201);

      // 재시도 포함 대기 (첫 실패 후 Bull exponential backoff 5s)
      await waitForEscrowStatus(paymentId, escrowId, "ESCROWED", 20_000);
      await waitForPaymentStatus(paymentId, "ACTIVE");

      // 정확히 2회: 1회 실패 + 1회 성공
      expect(mockXrplService.createEscrow).toHaveBeenCalledTimes(2);
    }, 30_000);
  });

  describe("모든 재시도 소진 → @OnQueueFailed → 롤백", () => {
    it("3회 모두 실패 → OnQueueFailed → payment CANCELLED", async () => {
      mockXrplService.createEscrow.mockRejectedValue(
        new Error("XRPL network timeout"),
      );

      const { paymentId, escrowIds } = await createApprovedPayment();

      // OutboxWatcher의 기본 backoff(5s exponential) 대신 100ms fixed로 직접 주입
      await injectJobDirectly(paymentId, escrowIds, {
        attempts: 3,
        backoff: { type: "fixed", delay: 100 },
      });

      // 3회 모두 실패 → OnQueueFailed → rollbackAllEscrows → CANCELLED
      await waitForPaymentStatus(paymentId, "CANCELLED", 5_000);
      expect(mockXrplService.createEscrow).toHaveBeenCalledTimes(3);
    }, 15_000);

    it("2회 실패 후 3회째도 실패 → CANCELLED (attempts 경계 검증)", async () => {
      let callCount = 0;
      mockXrplService.createEscrow.mockImplementation(() => {
        callCount++;
        throw new Error(`attempt ${callCount} failed`);
      });

      const { paymentId, escrowIds } = await createApprovedPayment();
      await injectJobDirectly(paymentId, escrowIds, {
        attempts: 3,
        backoff: { type: "fixed", delay: 100 },
      });

      await waitForPaymentStatus(paymentId, "CANCELLED", 5_000);
      expect(callCount).toBe(3);
    }, 15_000);
  });

  describe("멱등성 — 중복 job 처리", () => {
    it("ESCROWED 항목에 중복 job 주입 → skip, 상태 유지", async () => {
      const { paymentId, escrowId, escrowIds } = await createApprovedPayment();

      // 정상 경로로 ESCROWED까지 진행
      await request(app.getHttpServer())
        .post(`/escrow-payments/${paymentId}/pay`)
        .set(asBuyer())
        .expect(201);
      await waitForEscrowStatus(paymentId, escrowId, "ESCROWED");

      const callsAfterFirstProcess =
        mockXrplService.createEscrow.mock.calls.length;

      // 동일 paymentId/escrowId로 중복 job 직접 주입
      await queue.add({ paymentId, escrowIds }, { attempts: 1 });

      // 처리 완료 대기 (skip이므로 빠름)
      await new Promise((r) => setTimeout(r, 1_500));

      // escrow 상태 변화 없는지 확인
      const statusRes = await request(app.getHttpServer())
        .get(`/escrow-payments/${paymentId}/escrows/${escrowId}/status`)
        .set(asBuyer());
      expect(statusRes.body.status).toBe("ESCROWED");

      // 중복 job에서 createEscrow 추가 호출 없음
      expect(mockXrplService.createEscrow).toHaveBeenCalledTimes(
        callsAfterFirstProcess,
      );
    }, 20_000);

    it("동일 paymentId job 두 번 동시 주입 → preflight 경쟁, 중복 XRPL 제출 없음", async () => {
      const { paymentId, escrowId, escrowIds } = await createApprovedPayment();
      await escrowPaymentModel.findByIdAndUpdate(paymentId, {
        status: "PROCESSING",
      });

      // 두 job 동시에 주입 — preflight의 원자적 update가 하나만 통과시킴
      await Promise.all([
        queue.add({ paymentId, escrowIds }, { attempts: 1 }),
        queue.add({ paymentId, escrowIds }, { attempts: 1 }),
      ]);

      await waitForEscrowStatus(paymentId, escrowId, "ESCROWED", 10_000);

      // XRPL 제출은 정확히 1회
      expect(mockXrplService.createEscrow).toHaveBeenCalledTimes(1);
    }, 20_000);
  });

  describe("다중 escrow — 부분 실패 → 전체 롤백", () => {
    it("2개 escrow 중 두 번째 non-retryable → rollbackAllEscrows → payment CANCELLED", async () => {
      let callCount = 0;
      mockXrplService.createEscrow.mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          throw new Error("tecUNFUNDED");
        }
        return { txHash: `TX_${callCount}`, sequence: callCount * 10 };
      });

      const { paymentId } = await createApprovedPayment([
        {
          label: "1차금",
          amountXrp: 100,
          order: 0,
          requiredEventTypes: ["EVENT_1"],
        },
        {
          label: "2차금",
          amountXrp: 200,
          order: 1,
          requiredEventTypes: ["EVENT_2"],
        },
      ]);

      await request(app.getHttpServer())
        .post(`/escrow-payments/${paymentId}/pay`)
        .set(asBuyer())
        .expect(201);

      const payment = await waitForPaymentStatus(
        paymentId,
        "CANCELLED",
        20_000,
      );
      expect(payment.status).toBe("CANCELLED");

      // 1번 성공 + 2번 실패 = 2회 호출
      expect(mockXrplService.createEscrow).toHaveBeenCalledTimes(2);
    }, 30_000);
  });

  describe("서버 재시작 / Change Stream 단절 복구", () => {
    let outboxModel: Model<OutboxEventDocument>;
    let resumeTokenModel: Model<StreamResumeTokenDocument>;
    let watcher: OutboxWatcherService;

    beforeAll(() => {
      outboxModel = moduleFixture.get<Model<OutboxEventDocument>>(
        getModelToken(OutboxEvent.name),
      );
      resumeTokenModel = moduleFixture.get<Model<StreamResumeTokenDocument>>(
        getModelToken(StreamResumeToken.name),
      );
      watcher = moduleFixture.get(OutboxWatcherService);
    });

    afterEach(async () => {
      await resumeTokenModel.deleteMany({});
    });

    it("서버 다운 중 쌓인 PENDING 이벤트 — 재시작 시 processPendingEvents로 복구", async () => {
      const { paymentId, escrowId, escrowIds } = await createApprovedPayment();
      await escrowPaymentModel.findByIdAndUpdate(paymentId, {
        status: "PROCESSING",
      });

      // Change Stream 중단 (서버 다운 시뮬레이션)
      await (watcher as any).changeStream.close();
      await new Promise((r) => setTimeout(r, 200));

      // 서버 다운 중 생성됐을 Outbox 이벤트 직접 삽입
      await outboxModel.create({
        eventType: "ESCROW_PAY_INITIATED",
        status: "PENDING",
        payload: { paymentId, escrowIds },
      });

      // 재시작 시 processPendingEvents 실행 (onApplicationBootstrap과 동일 경로)
      await (watcher as any).processPendingEvents();

      await waitForEscrowStatus(paymentId, escrowId, "ESCROWED");
      await waitForPaymentStatus(paymentId, "ACTIVE");

      // 이후 테스트를 위해 Change Stream 복구
      await (watcher as any).startWatcher();
    }, 20_000);

    it("Change Stream 에러 → backoff 재시작 후 신규 이벤트 정상 처리", async () => {
      // non-fatal 에러 (코드 없음 = 일반 네트워크 단절) emit
      (watcher as any).changeStream.emit(
        "error",
        new Error("simulated network disconnect"),
      );

      // attempt 0 → delay 1s, +여유 시간
      await new Promise((r) => setTimeout(r, 2_500));

      // 재시작 후 신규 이벤트 처리 확인
      const { paymentId, escrowId } = await createApprovedPayment();
      await request(app.getHttpServer())
        .post(`/escrow-payments/${paymentId}/pay`)
        .set(asBuyer())
        .expect(201);

      await waitForEscrowStatus(paymentId, escrowId, "ESCROWED");
      await waitForPaymentStatus(paymentId, "ACTIVE");
    }, 30_000);

    it("ChangeStreamHistoryLost (code 286) → resume token 삭제 후 재시작", async () => {
      // 더미 resume token 삽입 (OpLog가 만료돼 스트림 재개 불가 상황)
      await resumeTokenModel.findOneAndUpdate(
        { streamId: "outbox" },
        { token: { _data: "stale_opaque_token" } },
        { upsert: true },
      );

      const err = Object.assign(new Error("ChangeStreamHistoryLost"), {
        code: 286,
        codeName: "ChangeStreamHistoryLost",
      });
      (watcher as any).changeStream.emit("error", err);

      await new Promise((r) => setTimeout(r, 2_500));

      // token이 삭제됐는지 확인
      const token = await resumeTokenModel.findOne({ streamId: "outbox" });
      expect(token).toBeNull();

      // 재시작 후 신규 이벤트 정상 처리
      const { paymentId, escrowId } = await createApprovedPayment();
      await request(app.getHttpServer())
        .post(`/escrow-payments/${paymentId}/pay`)
        .set(asBuyer())
        .expect(201);

      await waitForEscrowStatus(paymentId, escrowId, "ESCROWED");
      await waitForPaymentStatus(paymentId, "ACTIVE");
    }, 30_000);
  });

  describe("XRPL 제출 후 DB 저장 실패 (SUBMITTING stuck)", () => {
    it("SUBMITTING 상태 재처리 시 skip — 수동 복구 필요 로그 확인", async () => {
      // XRPL 제출은 성공하지만 DB에는 SUBMITTING만 남긴 상황 시뮬레이션:
      // preflight → SUBMITTING 전환 후 에스크로 항목을 강제로 SUBMITTING으로 세팅
      const { paymentId, escrowId, escrowIds } = await createApprovedPayment();
      await escrowPaymentModel.findByIdAndUpdate(
        paymentId,
        {
          status: "PROCESSING",
          "escrows.$[e].status": "SUBMITTING",
        },
        {
          arrayFilters: [{ "e._id": new Types.ObjectId(escrowId) }],
        },
      );

      // SUBMITTING 상태에서 job 주입 → processor가 skip하고 정상 완료
      await queue.add({ paymentId, escrowIds }, { attempts: 1 });

      // job이 처리될 시간 대기 (skip이므로 빠름)
      await new Promise((r) => setTimeout(r, 1_500));

      // XRPL 호출 없음 (skip 처리)
      expect(mockXrplService.createEscrow).not.toHaveBeenCalled();

      // 상태는 여전히 SUBMITTING (수동 복구 대상)
      const statusRes = await request(app.getHttpServer())
        .get(`/escrow-payments/${paymentId}/escrows/${escrowId}/status`)
        .set(asBuyer());
      expect(statusRes.body.status).toBe("SUBMITTING");
    }, 15_000);
  });
});
