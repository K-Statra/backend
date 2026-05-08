import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { Types } from "mongoose";
import { EscrowSubmitRecoveryScheduler } from "../escrow-submit-recovery.scheduler";
import { EscrowPayment } from "../schemas/escrow-payment.schema";
import { User } from "../../users/schemas/user.schema";
import { EscrowPaymentsService } from "../escrow-payments.service";
import {
  BUYER_ID,
  SELLER_ID,
  ESCROW_ID,
  PAYMENT_ID,
  makePayment,
  makeEscrowItem,
  makeBuyerUser,
  makeQueryChain,
  makeEscrowPaymentModelMock,
  makeUserModelMock,
} from "./helpers";

describe("EscrowSubmitRecoveryScheduler", () => {
  let scheduler: EscrowSubmitRecoveryScheduler;
  let escrowPaymentModel: ReturnType<typeof makeEscrowPaymentModelMock>;
  let userModel: ReturnType<typeof makeUserModelMock>;
  let escrowPaymentsService: jest.Mocked<
    Pick<EscrowPaymentsService, "recoverSubmittingEscrow">
  >;

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
    escrowPaymentsService = {
      recoverSubmittingEscrow: jest.fn().mockResolvedValue("recovered"),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscrowSubmitRecoveryScheduler,
        {
          provide: getModelToken(EscrowPayment.name),
          useValue: escrowPaymentModel,
        },
        { provide: getModelToken(User.name), useValue: userModel },
        {
          provide: EscrowPaymentsService,
          useValue: escrowPaymentsService,
        },
      ],
    }).compile();

    scheduler = module.get<EscrowSubmitRecoveryScheduler>(
      EscrowSubmitRecoveryScheduler,
    );
  });

  it("SUBMITTING 없으면 → recoverSubmittingEscrow 미호출", async () => {
    escrowPaymentModel.find.mockReturnValue(makeQueryChain([]));

    await scheduler.recoverStuckSubmittingEscrows();

    expect(
      escrowPaymentsService.recoverSubmittingEscrow,
    ).not.toHaveBeenCalled();
  });

  it("5분 이상된 SUBMITTING 에스크로 → recoverSubmittingEscrow 호출", async () => {
    const payment = makeStuckPayment();
    escrowPaymentModel.find.mockReturnValue(makeQueryChain([payment]));
    userModel.findById.mockReturnValue(makeQueryChain(makeBuyerUser()));

    await scheduler.recoverStuckSubmittingEscrows();

    expect(escrowPaymentsService.recoverSubmittingEscrow).toHaveBeenCalledWith(
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

    expect(
      escrowPaymentsService.recoverSubmittingEscrow,
    ).not.toHaveBeenCalled();
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

    expect(escrowPaymentsService.recoverSubmittingEscrow).toHaveBeenCalledTimes(
      1,
    );
  });

  it("recovered → 에러 없이 정상 완료", async () => {
    const payment = makeStuckPayment();
    escrowPaymentModel.find.mockReturnValue(makeQueryChain([payment]));
    userModel.findById.mockReturnValue(makeQueryChain(makeBuyerUser()));
    escrowPaymentsService.recoverSubmittingEscrow.mockResolvedValue(
      "recovered",
    );

    await expect(
      scheduler.recoverStuckSubmittingEscrows(),
    ).resolves.toBeUndefined();
  });

  it("cancelled → 에러 없이 정상 완료", async () => {
    const payment = makeStuckPayment();
    escrowPaymentModel.find.mockReturnValue(makeQueryChain([payment]));
    userModel.findById.mockReturnValue(makeQueryChain(makeBuyerUser()));
    escrowPaymentsService.recoverSubmittingEscrow.mockResolvedValue(
      "cancelled",
    );

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

    escrowPaymentsService.recoverSubmittingEscrow
      .mockRejectedValueOnce(new Error("XRPL connection error"))
      .mockResolvedValueOnce("recovered");

    await expect(
      scheduler.recoverStuckSubmittingEscrows(),
    ).resolves.toBeUndefined();

    expect(escrowPaymentsService.recoverSubmittingEscrow).toHaveBeenCalledTimes(
      2,
    );
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
