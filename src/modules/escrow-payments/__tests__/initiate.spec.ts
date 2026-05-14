import { Types } from "mongoose";
import {
  BUYER_ID,
  SELLER_ID,
  ESCROW_ID,
  PAYMENT_ID,
  makePayment,
  makeEscrowItem,
  makeBuyerUser,
  makeServiceTestingModule,
} from "./helpers";
import {
  EscrowItemNotFoundException,
  EscrowPaymentNotFoundException,
  InsufficientXrpBalanceException,
  InvalidEscrowCancelStatusException,
  PaymentInitiationFailedException,
  PaymentNotApprovedForPayException,
  UnauthorizedPaymentActionException,
} from "../../../common/exceptions";

// ── initiatePayment ───────────────────────────────────────────────────────────

describe("EscrowPaymentsService › initiatePayment", () => {
  let ctx: Awaited<ReturnType<typeof makeServiceTestingModule>>;

  beforeEach(async () => {
    ctx = await makeServiceTestingModule();
    ctx.userFacade.findById.mockResolvedValue(makeBuyerUser());
  });

  it("APPROVED → markProcessing 원자 전환 + outbox 이벤트 생성", async () => {
    const payment = makePayment({ status: "APPROVED", buyerId: BUYER_ID });
    const processingPayment = makePayment({ status: "PROCESSING" });
    ctx.escrowPaymentRepo.findById.mockResolvedValue(payment);
    ctx.escrowPaymentRepo.markProcessing.mockResolvedValue(processingPayment);

    await ctx.service.initiatePayment(
      PAYMENT_ID.toString(),
      BUYER_ID.toString(),
    );

    expect(ctx.escrowPaymentRepo.markProcessing).toHaveBeenCalledWith(
      PAYMENT_ID.toString(),
      expect.any(Object),
    );
    expect(ctx.outboxService.createPendingEvent).toHaveBeenCalledWith(
      expect.anything(),
      "ESCROW_PAY_INITIATED",
      expect.objectContaining({ paymentId: PAYMENT_ID.toString() }),
    );
  });

  it("APPROVED 아닌 상태 → PaymentNotApprovedForPayException", async () => {
    const payment = makePayment({
      status: "PENDING_APPROVAL",
      buyerId: BUYER_ID,
    });
    ctx.escrowPaymentRepo.findById.mockResolvedValue(payment);

    await expect(
      ctx.service.initiatePayment(PAYMENT_ID.toString(), BUYER_ID.toString()),
    ).rejects.toThrow(PaymentNotApprovedForPayException);
  });

  it("동시 요청으로 race 경쟁 실패(markProcessing null) → PaymentNotApprovedForPayException", async () => {
    const payment = makePayment({ status: "APPROVED", buyerId: BUYER_ID });
    ctx.escrowPaymentRepo.findById.mockResolvedValue(payment);
    ctx.escrowPaymentRepo.markProcessing.mockResolvedValue(null);

    await expect(
      ctx.service.initiatePayment(PAYMENT_ID.toString(), BUYER_ID.toString()),
    ).rejects.toThrow(PaymentNotApprovedForPayException);
  });

  it("seller는 결제 개시 불가 → UnauthorizedPaymentActionException", async () => {
    const payment = makePayment({
      status: "APPROVED",
      buyerId: BUYER_ID,
      sellerId: SELLER_ID,
    });
    ctx.escrowPaymentRepo.findById.mockResolvedValue(payment);

    await expect(
      ctx.service.initiatePayment(PAYMENT_ID.toString(), SELLER_ID.toString()),
    ).rejects.toThrow(UnauthorizedPaymentActionException);
  });

  it("buyer도 seller도 아닌 제3자 → UnauthorizedPaymentActionException", async () => {
    const payment = makePayment({
      status: "APPROVED",
      buyerId: BUYER_ID,
      sellerId: SELLER_ID,
    });
    ctx.escrowPaymentRepo.findById.mockResolvedValue(payment);

    await expect(
      ctx.service.initiatePayment(
        PAYMENT_ID.toString(),
        new Types.ObjectId().toString(),
      ),
    ).rejects.toThrow(UnauthorizedPaymentActionException);
  });

  it("결제 없음 → EscrowPaymentNotFoundException", async () => {
    ctx.escrowPaymentRepo.findById.mockResolvedValue(null);

    await expect(
      ctx.service.initiatePayment(PAYMENT_ID.toString(), BUYER_ID.toString()),
    ).rejects.toThrow(EscrowPaymentNotFoundException);
  });

  it("트랜잭션 내부 DB 오류 → PaymentInitiationFailedException", async () => {
    const payment = makePayment({ status: "APPROVED", buyerId: BUYER_ID });
    ctx.escrowPaymentRepo.findById.mockResolvedValue(payment);
    ctx.escrowPaymentRepo.markProcessing.mockRejectedValue(
      new Error("DB write error"),
    );

    await expect(
      ctx.service.initiatePayment(PAYMENT_ID.toString(), BUYER_ID.toString()),
    ).rejects.toThrow(PaymentInitiationFailedException);
  });

  it("validateEscrowFunds에 buyer 주소와 PENDING_ESCROW 항목 금액을 전달", async () => {
    const payment = makePayment({ status: "APPROVED", buyerId: BUYER_ID });
    const processingPayment = makePayment({ status: "PROCESSING" });
    ctx.escrowPaymentRepo.findById.mockResolvedValue(payment);
    ctx.escrowPaymentRepo.markProcessing.mockResolvedValue(processingPayment);

    await ctx.service.initiatePayment(
      PAYMENT_ID.toString(),
      BUYER_ID.toString(),
    );

    expect(ctx.xrplService.validateEscrowFunds).toHaveBeenCalledWith(
      "rBuyerAddress123",
      [expect.objectContaining({ amountXrp: 300, status: "PENDING_ESCROW" })],
    );
  });

  it("XRP 잔고 부족 → InsufficientXrpBalanceException 전파", async () => {
    const payment = makePayment({ status: "APPROVED", buyerId: BUYER_ID });
    ctx.escrowPaymentRepo.findById.mockResolvedValue(payment);
    ctx.xrplService.validateEscrowFunds.mockRejectedValue(
      new InsufficientXrpBalanceException(5, 312.001),
    );

    await expect(
      ctx.service.initiatePayment(PAYMENT_ID.toString(), BUYER_ID.toString()),
    ).rejects.toThrow(InsufficientXrpBalanceException);
  });
});

// ── rollbackAllEscrows ────────────────────────────────────────────────────────

describe("EscrowPaymentsService › rollbackAllEscrows", () => {
  let ctx: Awaited<ReturnType<typeof makeServiceTestingModule>>;

  beforeEach(async () => {
    ctx = await makeServiceTestingModule();
  });

  it("PENDING_ESCROW → CANCELLED, ESCROWED → CANCELLING, payment → CANCELLED", async () => {
    const payment = makePayment({
      status: "PROCESSING",
      escrows: [
        makeEscrowItem({ status: "ESCROWED", xrplSequence: 10 }),
        makeEscrowItem({ _id: new Types.ObjectId(), status: "PENDING_ESCROW" }),
      ],
    });
    ctx.escrowPaymentRepo.findById.mockResolvedValue(payment);

    await ctx.service.rollbackAllEscrows(PAYMENT_ID.toString());

    expect(payment.escrows[0].status).toBe("CANCELLING");
    expect(payment.escrows[1].status).toBe("CANCELLED");
    expect(payment.status).toBe("CANCELLED");
    expect(ctx.escrowPaymentRepo.save).toHaveBeenCalledWith(payment);
  });

  it("SUBMITTING → CANCELLING (XRPL 제출 여부 불명으로 보수적 처리)", async () => {
    const payment = makePayment({
      status: "PROCESSING",
      escrows: [makeEscrowItem({ status: "SUBMITTING" })],
    });
    ctx.escrowPaymentRepo.findById.mockResolvedValue(payment);

    await ctx.service.rollbackAllEscrows(PAYMENT_ID.toString());

    expect(payment.escrows[0].status).toBe("CANCELLING");
    expect(payment.status).toBe("CANCELLED");
  });

  it("이미 CANCELLED → no-op (멱등)", async () => {
    const payment = makePayment({ status: "CANCELLED" });
    ctx.escrowPaymentRepo.findById.mockResolvedValue(payment);

    await ctx.service.rollbackAllEscrows(PAYMENT_ID.toString());

    expect(ctx.escrowPaymentRepo.save).not.toHaveBeenCalled();
  });

  it("결제 없음 → 오류 없이 종료", async () => {
    ctx.escrowPaymentRepo.findById.mockResolvedValue(null);

    await expect(
      ctx.service.rollbackAllEscrows(PAYMENT_ID.toString()),
    ).resolves.toBeUndefined();
  });
});

// ── cancelEscrowItem ──────────────────────────────────────────────────────────

describe("EscrowPaymentsService › cancelEscrowItem", () => {
  let ctx: Awaited<ReturnType<typeof makeServiceTestingModule>>;

  beforeEach(async () => {
    ctx = await makeServiceTestingModule();
  });

  it("PENDING_ESCROW 상태 → CANCELLED로 전환", async () => {
    const payment = makePayment();
    ctx.escrowPaymentRepo.findById.mockResolvedValue(payment);

    await ctx.service.cancelEscrowItem(
      PAYMENT_ID.toString(),
      ESCROW_ID.toString(),
    );

    expect(payment.escrows[0].status).toBe("CANCELLED");
    expect(ctx.escrowPaymentRepo.save).toHaveBeenCalledWith(payment);
  });

  it("ESCROWED 상태는 취소 불가 → InvalidEscrowCancelStatusException", async () => {
    const payment = makePayment({
      escrows: [makeEscrowItem({ status: "ESCROWED" })],
    });
    ctx.escrowPaymentRepo.findById.mockResolvedValue(payment);

    await expect(
      ctx.service.cancelEscrowItem(PAYMENT_ID.toString(), ESCROW_ID.toString()),
    ).rejects.toThrow(InvalidEscrowCancelStatusException);
  });

  it("존재하지 않는 결제 → EscrowPaymentNotFoundException", async () => {
    ctx.escrowPaymentRepo.findById.mockResolvedValue(null);

    await expect(
      ctx.service.cancelEscrowItem(PAYMENT_ID.toString(), ESCROW_ID.toString()),
    ).rejects.toThrow(EscrowPaymentNotFoundException);
  });

  it("존재하지 않는 escrowId → EscrowItemNotFoundException", async () => {
    const payment = makePayment();
    ctx.escrowPaymentRepo.findById.mockResolvedValue(payment);

    await expect(
      ctx.service.cancelEscrowItem(
        PAYMENT_ID.toString(),
        new Types.ObjectId().toString(),
      ),
    ).rejects.toThrow(EscrowItemNotFoundException);
  });
});
