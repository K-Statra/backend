import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { Types } from "mongoose";
import { EscrowSubmitRecoveryScheduler } from "../escrow-submit-recovery.scheduler";
import { EscrowPayment } from "../schemas/escrow-payment.schema";
import { User } from "../../users/schemas/user.schema";
import { EscrowPaymentsService } from "../escrow-payments.service";
import { XrplService } from "../../xrpl/xrpl.service";
import {
  BUYER_ID,
  SELLER_ID,
  ESCROW_ID,
  PAYMENT_ID,
  CONDITION,
  TX_HASH_CREATE,
  XRPL_SEQUENCE,
  makePayment,
  makeEscrowItem,
  makeBuyerUser,
  makeQueryChain,
  makeEscrowPaymentModelMock,
  makeUserModelMock,
} from "./helpers";

describe("EscrowSubmitRecoveryScheduler › recoverStuckSubmittingEscrows (스케줄링 로직)", () => {
  let scheduler: EscrowSubmitRecoveryScheduler;
  let escrowPaymentModel: ReturnType<typeof makeEscrowPaymentModelMock>;
  let userModel: ReturnType<typeof makeUserModelMock>;
  let recoverSpy: jest.SpyInstance;

  const OLD_DATE = new Date(Date.now() - 10 * 60 * 1000); // 10분 전

  function makeStuckPayment(escrowOverrides: object = {}) {
    return makePayment({
      _id: PAYMENT_ID,
      buyerId: BUYER_ID,
      sellerId: SELLER_ID,
      escrows: [
        makeEscrowItem({
          status: "SUBMITTING",
          submittingAt: OLD_DATE,
          ...escrowOverrides,
        }),
      ],
    });
  }

  beforeEach(async () => {
    escrowPaymentModel = makeEscrowPaymentModelMock();
    userModel = makeUserModelMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscrowSubmitRecoveryScheduler,
        {
          provide: getModelToken(EscrowPayment.name),
          useValue: escrowPaymentModel,
        },
        { provide: getModelToken(User.name), useValue: userModel },
        {
          provide: XrplService,
          useValue: {
            findEscrowByCondition: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: EscrowPaymentsService,
          useValue: {
            getEscrowStatus: jest.fn(),
            rollbackAllEscrows: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    scheduler = module.get<EscrowSubmitRecoveryScheduler>(
      EscrowSubmitRecoveryScheduler,
    );
    recoverSpy = jest
      .spyOn(scheduler, "recoverSubmittingEscrow")
      .mockResolvedValue("recovered");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("SUBMITTING 없으면 → recoverSubmittingEscrow 미호출", async () => {
    escrowPaymentModel.find.mockReturnValue(makeQueryChain([]));

    await scheduler.recoverStuckSubmittingEscrows();

    expect(recoverSpy).not.toHaveBeenCalled();
  });

  it("5분 이상된 SUBMITTING 에스크로 → recoverSubmittingEscrow 호출", async () => {
    const payment = makeStuckPayment();
    escrowPaymentModel.find.mockReturnValue(makeQueryChain([payment]));
    userModel.findById.mockReturnValue(makeQueryChain(makeBuyerUser()));

    await scheduler.recoverStuckSubmittingEscrows();

    expect(recoverSpy).toHaveBeenCalledWith(
      PAYMENT_ID.toString(),
      ESCROW_ID.toString(),
      "rBuyerAddress123",
    );
  });

  it("5분 미만 SUBMITTING → 아직 진행 중으로 판단, 건너뜀", async () => {
    const recentDate = new Date(Date.now() - 2 * 60 * 1000); // 2분 전
    const payment = makeStuckPayment({ submittingAt: recentDate });
    escrowPaymentModel.find.mockReturnValue(makeQueryChain([payment]));
    userModel.findById.mockReturnValue(makeQueryChain(makeBuyerUser()));

    await scheduler.recoverStuckSubmittingEscrows();

    expect(recoverSpy).not.toHaveBeenCalled();
  });

  it("buyer 지갑 없으면 → skip, 다른 payment는 계속 처리", async () => {
    const payment1 = makeStuckPayment();
    const payment2 = makeStuckPayment();
    payment2._id = new Types.ObjectId();

    escrowPaymentModel.find.mockReturnValue(
      makeQueryChain([payment1, payment2]),
    );
    userModel.findById
      .mockReturnValueOnce(makeQueryChain(null)) // payment1: 지갑 없음
      .mockReturnValueOnce(makeQueryChain(makeBuyerUser())); // payment2: 정상

    await scheduler.recoverStuckSubmittingEscrows();

    expect(recoverSpy).toHaveBeenCalledTimes(1);
  });

  it("recovered → 에러 없이 정상 완료", async () => {
    const payment = makeStuckPayment();
    escrowPaymentModel.find.mockReturnValue(makeQueryChain([payment]));
    userModel.findById.mockReturnValue(makeQueryChain(makeBuyerUser()));
    recoverSpy.mockResolvedValue("recovered");

    await expect(
      scheduler.recoverStuckSubmittingEscrows(),
    ).resolves.toBeUndefined();
  });

  it("cancelled → 에러 없이 정상 완료", async () => {
    const payment = makeStuckPayment();
    escrowPaymentModel.find.mockReturnValue(makeQueryChain([payment]));
    userModel.findById.mockReturnValue(makeQueryChain(makeBuyerUser()));
    recoverSpy.mockResolvedValue("cancelled");

    await expect(
      scheduler.recoverStuckSubmittingEscrows(),
    ).resolves.toBeUndefined();
  });

  it("recoverSubmittingEscrow 에러 → 에러 삼키고 다음 항목 계속 처리", async () => {
    const escrow1 = makeEscrowItem({
      _id: new Types.ObjectId(),
      status: "SUBMITTING",
      submittingAt: OLD_DATE,
    });
    const escrow2 = makeEscrowItem({
      _id: new Types.ObjectId(),
      status: "SUBMITTING",
      submittingAt: OLD_DATE,
    });
    const payment = makePayment({ escrows: [escrow1, escrow2] });
    escrowPaymentModel.find.mockReturnValue(makeQueryChain([payment]));
    userModel.findById.mockReturnValue(makeQueryChain(makeBuyerUser()));

    recoverSpy
      .mockRejectedValueOnce(new Error("XRPL connection error"))
      .mockResolvedValueOnce("recovered");

    await expect(
      scheduler.recoverStuckSubmittingEscrows(),
    ).resolves.toBeUndefined();

    expect(recoverSpy).toHaveBeenCalledTimes(2);
  });

  it("$elemMatch로 status=SUBMITTING AND submittingAt<cutoff 조건 조회", async () => {
    escrowPaymentModel.find.mockReturnValue(makeQueryChain([]));

    await scheduler.recoverStuckSubmittingEscrows();

    expect(escrowPaymentModel.find).toHaveBeenCalledWith({
      escrows: {
        $elemMatch: {
          status: "SUBMITTING",
          submittingAt: { $lt: expect.any(Date) },
        },
      },
    });
  });
});

// ── recoverSubmittingEscrow 로직 테스트 ─────────────────────────────────────

describe("EscrowSubmitRecoveryScheduler › recoverSubmittingEscrow", () => {
  let scheduler: EscrowSubmitRecoveryScheduler;
  let escrowPaymentModel: ReturnType<typeof makeEscrowPaymentModelMock>;
  let userModel: ReturnType<typeof makeUserModelMock>;
  let xrplService: { findEscrowByCondition: jest.Mock };
  let escrowPaymentsService: {
    getEscrowStatus: jest.Mock;
    rollbackAllEscrows: jest.Mock;
  };

  const BUYER_ADDRESS = "rBuyerAddress123";

  beforeEach(async () => {
    escrowPaymentModel = makeEscrowPaymentModelMock();
    userModel = makeUserModelMock();
    xrplService = { findEscrowByCondition: jest.fn().mockResolvedValue(null) };
    escrowPaymentsService = {
      getEscrowStatus: jest.fn(),
      rollbackAllEscrows: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscrowSubmitRecoveryScheduler,
        {
          provide: getModelToken(EscrowPayment.name),
          useValue: escrowPaymentModel,
        },
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: XrplService, useValue: xrplService },
        { provide: EscrowPaymentsService, useValue: escrowPaymentsService },
      ],
    }).compile();

    scheduler = module.get<EscrowSubmitRecoveryScheduler>(
      EscrowSubmitRecoveryScheduler,
    );
  });

  it("XRPL에 에스크로 있음 → DB 업데이트 후 recovered 반환", async () => {
    const submittingEscrow = makeEscrowItem({
      status: "SUBMITTING",
      condition: CONDITION,
    });
    escrowPaymentsService.getEscrowStatus.mockResolvedValue(submittingEscrow);
    xrplService.findEscrowByCondition.mockResolvedValue({
      txHash: TX_HASH_CREATE,
      sequence: XRPL_SEQUENCE,
    });
    const escrowedResult = makePayment({
      escrows: [makeEscrowItem({ status: "ESCROWED" })],
    });
    escrowPaymentModel.findOneAndUpdate.mockResolvedValue(escrowedResult);

    const result = await scheduler.recoverSubmittingEscrow(
      PAYMENT_ID.toString(),
      ESCROW_ID.toString(),
      BUYER_ADDRESS,
    );

    expect(result).toBe("recovered");
    expect(xrplService.findEscrowByCondition).toHaveBeenCalledWith(
      BUYER_ADDRESS,
      CONDITION,
    );
    expect(escrowPaymentModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ "escrows._id": expect.any(Types.ObjectId) }),
      expect.objectContaining({
        $set: expect.objectContaining({
          "escrows.$.status": "ESCROWED",
          "escrows.$.xrplSequence": XRPL_SEQUENCE,
          "escrows.$.txHashCreate": TX_HASH_CREATE,
        }),
      }),
      expect.objectContaining({ new: true }),
    );
  });

  it("XRPL에 에스크로 없음 → 결제 취소 후 cancelled 반환", async () => {
    const submittingEscrow = makeEscrowItem({
      status: "SUBMITTING",
      condition: CONDITION,
    });
    escrowPaymentsService.getEscrowStatus.mockResolvedValue(submittingEscrow);
    xrplService.findEscrowByCondition.mockResolvedValue(null);
    escrowPaymentModel.findOneAndUpdate.mockResolvedValue(makePayment());

    const result = await scheduler.recoverSubmittingEscrow(
      PAYMENT_ID.toString(),
      ESCROW_ID.toString(),
      BUYER_ADDRESS,
    );

    expect(result).toBe("cancelled");
    expect(escrowPaymentModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ "escrows.status": "SUBMITTING" }),
      { $set: { "escrows.$.status": "CANCELLED" } },
    );
    expect(escrowPaymentsService.rollbackAllEscrows).toHaveBeenCalledWith(
      PAYMENT_ID.toString(),
    );
  });

  it("condition 미저장 (pre-flight 전 크래시) → XRPL 조회 없이 즉시 취소", async () => {
    const submittingEscrow = makeEscrowItem({
      status: "SUBMITTING",
      condition: undefined,
    });
    escrowPaymentsService.getEscrowStatus.mockResolvedValue(submittingEscrow);
    escrowPaymentModel.findOneAndUpdate.mockResolvedValue(makePayment());

    const result = await scheduler.recoverSubmittingEscrow(
      PAYMENT_ID.toString(),
      ESCROW_ID.toString(),
      BUYER_ADDRESS,
    );

    expect(result).toBe("cancelled");
    expect(xrplService.findEscrowByCondition).not.toHaveBeenCalled();
  });

  it("이미 SUBMITTING 아닌 상태 → 즉시 recovered 반환 (중복 복구 방지)", async () => {
    const escrowedItem = makeEscrowItem({ status: "ESCROWED" });
    escrowPaymentsService.getEscrowStatus.mockResolvedValue(escrowedItem);

    const result = await scheduler.recoverSubmittingEscrow(
      PAYMENT_ID.toString(),
      ESCROW_ID.toString(),
      BUYER_ADDRESS,
    );

    expect(result).toBe("recovered");
    expect(xrplService.findEscrowByCondition).not.toHaveBeenCalled();
    expect(escrowPaymentModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("복구 후 모든 escrow ESCROWED → payment ACTIVE 전환", async () => {
    const submittingEscrow = makeEscrowItem({
      status: "SUBMITTING",
      condition: CONDITION,
    });
    escrowPaymentsService.getEscrowStatus.mockResolvedValue(submittingEscrow);
    xrplService.findEscrowByCondition.mockResolvedValue({
      txHash: TX_HASH_CREATE,
      sequence: XRPL_SEQUENCE,
    });
    const allEscrowedResult = makePayment({
      status: "PROCESSING",
      escrows: [makeEscrowItem({ status: "ESCROWED" })],
    });
    escrowPaymentModel.findOneAndUpdate.mockResolvedValue(allEscrowedResult);

    await scheduler.recoverSubmittingEscrow(
      PAYMENT_ID.toString(),
      ESCROW_ID.toString(),
      BUYER_ADDRESS,
    );

    expect(escrowPaymentModel.findByIdAndUpdate).toHaveBeenCalledWith(
      PAYMENT_ID.toString(),
      { $set: { status: "ACTIVE" } },
    );
  });
});
