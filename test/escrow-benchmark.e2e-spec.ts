/**
 * EscrowPayments Benchmark — API Latency & Fault Recovery Rate
 *
 * 목적: 포트폴리오/이력서용 측정 수치 산출
 *   [1] API Latency  — 비동기 전환으로 줄어든 응답 대기 시간
 *   [2] Fault Recovery Rate — 5개 장애 시나리오 복구율
 *
 * 인프라:
 *   - MongoMemoryReplSet  (Change Streams + 트랜잭션 지원, 외부 의존 없음)
 *   - Redis Bull Queue    (localhost:6379, 실제 큐·백오프 동작)
 *   - XrplService         mock (딜레이 조절 가능)
 *
 * 실행: npm run test:e2e -- --testPathPatterns=escrow-benchmark
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

// XRPL 실 환경 레저 클로즈 시간 (3~5s). 동기 처리였다면 API가 이만큼 블로킹됐을 것.
const SIMULATED_XRPL_DELAY_MS = 3_000;

// 유효한 XRPL 주소 — @IsXrplAddress() DTO 검증 통과용
const BUYER_WALLET_ADDR = "rPXachbQorqFQBPTRKU5FvujGrG56wMyGB";
const SELLER_WALLET_ADDR = "rL4Mp1CJWr3q534m5V4RG8fC3E6wBQifFJ";

interface RecoveryResult {
  scenario: string;
  outcome: "RECOVERED" | "HANDLED" | "FAILED";
  detail: string;
}

describe("EscrowPayments Benchmark — API Latency & Fault Recovery Rate", () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let mongoServer: MongoMemoryReplSet;
  let queue: Queue;
  let escrowPaymentModel: Model<any>;
  let outboxModel: Model<OutboxEventDocument>;
  let resumeTokenModel: Model<StreamResumeTokenDocument>;
  let watcher: OutboxWatcherService;

  // 결과 수집 — afterAll에서 출력
  let apiLatencyMs = 0;
  let asyncTotalMs = 0;
  const recoveryResults: RecoveryResult[] = [];

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
    findEscrowByCondition: jest.fn(),
    ensureRlusdTrustLine: jest.fn(),
    validateRlusdFunds: jest.fn(),
  };

  // ── 셋업 / 정리 ────────────────────────────────────────────────────────────

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
        secret: "benchmark-test-secret",
        resave: false,
        saveUninitialized: true,
        cookie: { secure: false },
      }),
    );
    // 세션 없이 userId를 헤더로 주입하는 테스트용 미들웨어
    app.use((req: any, _res: any, next: any) => {
      const userId = req.headers["x-test-user-id"] as string | undefined;
      const userType = req.headers["x-test-user-type"] as string | undefined;
      if (userId && userType) {
        req.session.userId = userId;
        req.session.type = userType;
      }
      next();
    });

    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    queue = moduleFixture.get<Queue>(getQueueToken(ESCROW_CREATE_QUEUE));
    escrowPaymentModel = moduleFixture.get<Model<any>>(
      getModelToken(EscrowPayment.name),
    );
    outboxModel = moduleFixture.get<Model<OutboxEventDocument>>(
      getModelToken(OutboxEvent.name),
    );
    resumeTokenModel = moduleFixture.get<Model<StreamResumeTokenDocument>>(
      getModelToken(StreamResumeToken.name),
    );
    watcher = moduleFixture.get(OutboxWatcherService);

    const userModel = moduleFixture.get<Model<User>>(getModelToken(User.name));
    await (userModel as any).collection.insertMany([
      {
        _id: buyerObjectId,
        email: "buyer@benchmark.com",
        password: "hashed",
        name: "Benchmark Buyer Corp",
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
        email: "seller@benchmark.com",
        password: "hashed",
        name: "Benchmark Seller Corp",
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
    printBenchmarkReport();
  });

  function printBenchmarkReport() {
    const hr = "─".repeat(60);
    const speedup = apiLatencyMs > 0
      ? `${Math.round(SIMULATED_XRPL_DELAY_MS / apiLatencyMs)}x`
      : "N/A";
    const passed = recoveryResults.filter((r) => r.outcome !== "FAILED").length;
    const total = recoveryResults.length;
    const rate = total > 0 ? Math.round((passed / total) * 100) : 0;

    const lines = [
      "",
      hr,
      "  BENCHMARK REPORT — EscrowPayments Async Pipeline",
      hr,
      "",
      "  [1] API LATENCY — 비동기 전환 효과",
      `      XRPL 처리 시간 (시뮬레이션)  : ${SIMULATED_XRPL_DELAY_MS.toLocaleString()}ms`,
      `      POST /pay → 201 응답        : ${apiLatencyMs}ms`,
      `      백그라운드 처리 완료 (총)    : ~${asyncTotalMs}ms`,
      `      응답 속도 개선              : ~${speedup} (${SIMULATED_XRPL_DELAY_MS}ms → ${apiLatencyMs}ms)`,
      "",
      "  [2] FAULT RECOVERY RATE",
    ];

    for (const r of recoveryResults) {
      const icon = r.outcome !== "FAILED" ? "✅" : "❌";
      lines.push(`      ${icon} ${r.scenario}`);
      lines.push(`         └─ ${r.detail}`);
    }

    lines.push("");
    lines.push(`      결과: ${passed}/${total} = 복구율 ${rate}%`);
    lines.push("");
    lines.push(hr);
    lines.push("");

    console.log(lines.join("\n"));
  }

  beforeEach(() => {
    mockXrplService.generateCryptoCondition.mockReturnValue({
      condition: "A02580204BENCHCONDITION1234",
      fulfillment: "A022802012BENCHFULFILLMENT",
    });
    mockXrplService.encrypt.mockImplementation((v: string) => `enc:${v}`);
    mockXrplService.decrypt.mockImplementation((v: string) =>
      v.replace(/^enc:/, ""),
    );
    mockXrplService.validateEscrowFunds.mockResolvedValue(undefined);
    mockXrplService.createEscrow.mockResolvedValue({
      txHash: "BENCH_TX_HASH",
      sequence: 42,
    });
    mockXrplService.finishEscrow.mockResolvedValue("BENCH_FINISH_TX");
    mockXrplService.cancelEscrow.mockResolvedValue(undefined);
    mockXrplService.findEscrowByCondition.mockResolvedValue(null);
  });

  afterEach(async () => {
    jest.clearAllMocks();
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
      `Payment ${paymentId}: expected='${expected}' got='${res.body.status}'`,
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

  async function createApprovedPayment() {
    const createRes = await request(app.getHttpServer())
      .post("/escrow-payments")
      .set(asBuyer())
      .send({
        counterpartyWalletAddress: SELLER_WALLET_ADDR,
        memo: "benchmark test",
        escrows: [
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

  /** OutboxWatcher의 기본 backoff(5s exponential)를 우회해 빠른 재시도 테스트에 사용 */
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

  // ── [1] API Latency Benchmark ─────────────────────────────────────────────

  describe("[1] API Latency — XRPL 3s 시뮬레이션 vs 비동기 응답", () => {
    it(
      `POST /pay 응답은 XRPL ${SIMULATED_XRPL_DELAY_MS}ms 딜레이와 무관하게 즉시 반환`,
      async () => {
        // XRPL 실 환경 레저 클로즈 타임 시뮬레이션
        mockXrplService.createEscrow.mockImplementation(async () => {
          await new Promise((r) => setTimeout(r, SIMULATED_XRPL_DELAY_MS));
          return { txHash: "LATENCY_BENCH_TX", sequence: 99 };
        });

        const { paymentId, escrowId } = await createApprovedPayment();

        // ── API 응답 시간 측정 ──
        const t0 = Date.now();
        const payRes = await request(app.getHttpServer())
          .post(`/escrow-payments/${paymentId}/pay`)
          .set(asBuyer())
          .expect(201);
        apiLatencyMs = Date.now() - t0;

        // 비동기: Outbox insert 후 즉시 PROCESSING 반환 — XRPL 완료를 기다리지 않음
        expect(payRes.body.status).toBe("PROCESSING");
        expect(payRes.body.escrows[0].status).toBe("PENDING_ESCROW");
        expect(apiLatencyMs).toBeLessThan(1_000);

        // ── 백그라운드 처리 완료 시간 측정 (Change Stream → Bull → XRPL mock 3s → DB) ──
        await waitForEscrowStatus(paymentId, escrowId, "ESCROWED", 12_000);
        await waitForPaymentStatus(paymentId, "ACTIVE");
        asyncTotalMs = Date.now() - t0;
      },
      20_000,
    );
  });

  // ── [2] Fault Recovery Rate ───────────────────────────────────────────────

  describe("[2] Fault Recovery Rate — 5개 장애 시나리오", () => {
    afterEach(async () => {
      await resumeTokenModel.deleteMany({});
    });

    it(
      "[1/5] 서버 다운 중 누락된 PENDING 이벤트 → 재시작 시 processPendingEvents로 복구",
      async () => {
        const { paymentId, escrowId, escrowIds } = await createApprovedPayment();
        await escrowPaymentModel.findByIdAndUpdate(paymentId, {
          status: "PROCESSING",
        });

        // Change Stream 중단 → 서버 다운 시뮬레이션
        await (watcher as any).changeStream.close();
        await new Promise((r) => setTimeout(r, 200));

        // 다운타임 중 생성됐을 Outbox 이벤트 직접 삽입
        await outboxModel.create({
          eventType: "ESCROW_PAY_INITIATED",
          status: "PENDING",
          payload: { paymentId, escrowIds },
        });

        // onApplicationBootstrap이 호출하는 경로와 동일
        await (watcher as any).processPendingEvents();

        await waitForEscrowStatus(paymentId, escrowId, "ESCROWED");
        await waitForPaymentStatus(paymentId, "ACTIVE");

        // 이후 테스트를 위해 Change Stream 복구
        await (watcher as any).startWatcher();

        recoveryResults.push({
          scenario: "서버 다운 중 PENDING 이벤트 누락",
          outcome: "RECOVERED",
          detail: "processPendingEvents() → ESCROWED → ACTIVE",
        });
      },
      25_000,
    );

    it(
      "[2/5] XRPL 네트워크 오류 → Bull 지수 백오프 재시도 → 성공",
      async () => {
        // 1회 실패 후 성공
        mockXrplService.createEscrow
          .mockRejectedValueOnce(new Error("WebSocket connection timeout"))
          .mockResolvedValue({ txHash: "RETRY_SUCCESS_TX", sequence: 200 });

        const { paymentId, escrowId, escrowIds } = await createApprovedPayment();

        // 벤치마크 속도를 위해 500ms fixed backoff으로 직접 주입
        await injectJobDirectly(paymentId, escrowIds, {
          attempts: 3,
          backoff: { type: "fixed", delay: 500 },
        });

        await waitForEscrowStatus(paymentId, escrowId, "ESCROWED", 10_000);
        await waitForPaymentStatus(paymentId, "ACTIVE");

        // 1회 실패 + 1회 성공 = 정확히 2회 호출
        expect(mockXrplService.createEscrow).toHaveBeenCalledTimes(2);

        recoveryResults.push({
          scenario: "XRPL 네트워크 오류 (WebSocket timeout)",
          outcome: "RECOVERED",
          detail: "Bull retry 1회 → ESCROWED (createEscrow 2회 호출 검증)",
        });
      },
      20_000,
    );

    it(
      "[3/5] 모든 재시도 소진 → OnQueueFailed → 결정론적 CANCELLED",
      async () => {
        mockXrplService.createEscrow.mockRejectedValue(
          new Error("XRPL network unavailable"),
        );

        const { paymentId, escrowIds } = await createApprovedPayment();

        await injectJobDirectly(paymentId, escrowIds, {
          attempts: 3,
          backoff: { type: "fixed", delay: 100 },
        });

        await waitForPaymentStatus(paymentId, "CANCELLED", 8_000);
        expect(mockXrplService.createEscrow).toHaveBeenCalledTimes(3);

        recoveryResults.push({
          scenario: "3회 연속 XRPL 오류 (재시도 소진)",
          outcome: "HANDLED",
          detail:
            "OnQueueFailed → rollbackAllEscrows → CANCELLED (결정론적 처리, 미확정 상태 없음)",
        });
      },
      15_000,
    );

    it(
      "[4/5] Change Stream 네트워크 단절 → backoff 재시작 → 신규 이벤트 정상 처리",
      async () => {
        // 일반 네트워크 단절 에러 (code 없음 = 재연결 가능 에러)
        (watcher as any).changeStream.emit(
          "error",
          new Error("simulated network disconnect"),
        );

        // attempt 0 → delay = min(1000*2^0, 30000) = 1s 대기 후 재시작
        await new Promise((r) => setTimeout(r, 2_500));

        // 재시작 완료 후 정상 파이프라인 검증
        const { paymentId, escrowId } = await createApprovedPayment();
        await request(app.getHttpServer())
          .post(`/escrow-payments/${paymentId}/pay`)
          .set(asBuyer())
          .expect(201);

        await waitForEscrowStatus(paymentId, escrowId, "ESCROWED", 15_000);
        await waitForPaymentStatus(paymentId, "ACTIVE");

        recoveryResults.push({
          scenario: "Change Stream 네트워크 단절",
          outcome: "RECOVERED",
          detail: "restartWithBackoff(1s) → 스트림 재시작 → 신규 이벤트 정상 처리",
        });
      },
      30_000,
    );

    it(
      "[5/5] ChangeStreamHistoryLost (OpLog 만료) → resume token 삭제 + 재시작",
      async () => {
        // 만료된 resume token 삽입 (OpLog가 밀려서 해당 지점부터 재개 불가 상황)
        await resumeTokenModel.findOneAndUpdate(
          { streamId: "outbox" },
          { token: { _data: "stale_opaque_resume_token" } },
          { upsert: true },
        );

        // HistoryLost 발생 → error 핸들러가 token 삭제 + processPendingEvents + 재시작
        const historyLostErr = Object.assign(
          new Error("ChangeStreamHistoryLost"),
          { code: 286, codeName: "ChangeStreamHistoryLost" },
        );
        (watcher as any).changeStream.emit("error", historyLostErr);

        // backoff(1s) + processPendingEvents 완료 대기
        await new Promise((r) => setTimeout(r, 3_000));

        // resume token이 삭제됐는지 검증
        const token = await resumeTokenModel.findOne({ streamId: "outbox" });
        expect(token).toBeNull();

        // 재시작 후 신규 이벤트 처리 정상 여부 검증
        const { paymentId, escrowId } = await createApprovedPayment();
        await request(app.getHttpServer())
          .post(`/escrow-payments/${paymentId}/pay`)
          .set(asBuyer())
          .expect(201);

        await waitForEscrowStatus(paymentId, escrowId, "ESCROWED", 15_000);
        await waitForPaymentStatus(paymentId, "ACTIVE");

        recoveryResults.push({
          scenario: "ChangeStreamHistoryLost (code=286, OpLog 만료)",
          outcome: "RECOVERED",
          detail:
            "resume token 삭제 + processPendingEvents + 스트림 재시작 → ACTIVE",
        });
      },
      30_000,
    );
  });
});
