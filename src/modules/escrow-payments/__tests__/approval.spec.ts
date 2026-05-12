import { Types } from "mongoose";
import {
  BUYER_ID,
  SELLER_ID,
  ESCROW_ID,
  PAYMENT_ID,
  CONDITION,
  ENCRYPTED_FULFILLMENT,
  XRPL_SEQUENCE,
  DECRYPTED_SEED,
  TX_HASH_FINISH,
  makePayment,
  makeEscrowItem,
  makeApproval,
  makeBuyerUser,
  makeQueryChain,
  makeServiceTestingModule,
} from "./helpers";
import {
  AlreadyApprovedEventException,
  AlreadyApprovedPaymentException,
  EscrowItemMustBeEscrowedException,
  EscrowPaymentNotFoundException,
  EventTypeNotFoundException,
  InvalidPaymentStatusException,
  UnauthorizedPaymentActionException,
} from "../../../common/exceptions";

// ── approvePayment ────────────────────────────────────────────────────────────

describe("EscrowPaymentsService › approvePayment", () => {
  let ctx: Awaited<ReturnType<typeof makeServiceTestingModule>>;

  beforeEach(async () => {
    ctx = await makeServiceTestingModule();
  });

  // ── buyer가 생성한 결제 (buyerApproved=true 자동 설정) ──────────────────────

  describe("buyer가 생성한 결제", () => {
    it("seller 승인 → APPROVED, sellerApproved=true", async () => {
      const payment = makePayment({
        status: "PENDING_APPROVAL",
        buyerApproved: true,
        buyerApprovedAt: new Date(),
      });
      ctx.escrowPaymentModel.findById.mockReturnValue(makeQueryChain(payment));

      await ctx.service.approvePayment(
        PAYMENT_ID.toString(),
        SELLER_ID.toString(),
      );

      expect(payment.sellerApproved).toBe(true);
      expect(payment.sellerApprovedAt).toBeInstanceOf(Date);
      expect(payment.status).toBe("APPROVED");
      expect(payment.save).toHaveBeenCalled();
    });

    it("buyer 중복 승인 → AlreadyApprovedPaymentException, save 미호출", async () => {
      const payment = makePayment({
        status: "PENDING_APPROVAL",
        buyerApproved: true,
      });
      ctx.escrowPaymentModel.findById.mockReturnValue(makeQueryChain(payment));

      await expect(
        ctx.service.approvePayment(PAYMENT_ID.toString(), BUYER_ID.toString()),
      ).rejects.toThrow(AlreadyApprovedPaymentException);
      expect(payment.save).not.toHaveBeenCalled();
    });
  });

  // ── seller가 생성한 결제 (sellerApproved=true 자동 설정) ────────────────────

  describe("seller가 생성한 결제", () => {
    it("buyer 승인 → APPROVED, buyerApproved=true", async () => {
      const payment = makePayment({
        status: "PENDING_APPROVAL",
        sellerApproved: true,
        sellerApprovedAt: new Date(),
      });
      ctx.escrowPaymentModel.findById.mockReturnValue(makeQueryChain(payment));

      await ctx.service.approvePayment(
        PAYMENT_ID.toString(),
        BUYER_ID.toString(),
      );

      expect(payment.buyerApproved).toBe(true);
      expect(payment.buyerApprovedAt).toBeInstanceOf(Date);
      expect(payment.status).toBe("APPROVED");
      expect(payment.save).toHaveBeenCalled();
    });

    it("seller 중복 승인 → AlreadyApprovedPaymentException, save 미호출", async () => {
      const payment = makePayment({
        status: "PENDING_APPROVAL",
        sellerApproved: true,
      });
      ctx.escrowPaymentModel.findById.mockReturnValue(makeQueryChain(payment));

      await expect(
        ctx.service.approvePayment(PAYMENT_ID.toString(), SELLER_ID.toString()),
      ).rejects.toThrow(AlreadyApprovedPaymentException);
      expect(payment.save).not.toHaveBeenCalled();
    });
  });

  // ── 공통 ────────────────────────────────────────────────────────────────────

  it("ACTIVE 상태에서 승인 시도 → InvalidPaymentStatusException", async () => {
    const payment = makePayment({ status: "ACTIVE" });
    ctx.escrowPaymentModel.findById.mockReturnValue(makeQueryChain(payment));

    await expect(
      ctx.service.approvePayment(PAYMENT_ID.toString(), BUYER_ID.toString()),
    ).rejects.toThrow(InvalidPaymentStatusException);
  });

  it("buyer도 seller도 아닌 제3자 → UnauthorizedPaymentActionException", async () => {
    const payment = makePayment({ status: "PENDING_APPROVAL" });
    ctx.escrowPaymentModel.findById.mockReturnValue(makeQueryChain(payment));

    await expect(
      ctx.service.approvePayment(
        PAYMENT_ID.toString(),
        new Types.ObjectId().toString(),
      ),
    ).rejects.toThrow(UnauthorizedPaymentActionException);
  });

  it("존재하지 않는 결제 → EscrowPaymentNotFoundException", async () => {
    ctx.escrowPaymentModel.findById.mockReturnValue(makeQueryChain(null));

    await expect(
      ctx.service.approvePayment(PAYMENT_ID.toString(), BUYER_ID.toString()),
    ).rejects.toThrow(EscrowPaymentNotFoundException);
  });
});

// ── approveEvent ──────────────────────────────────────────────────────────────

describe("EscrowPaymentsService › approveEvent", () => {
  let ctx: Awaited<ReturnType<typeof makeServiceTestingModule>>;

  function setupEscrowedPayment(approvalOverrides: object = {}) {
    const payment = makePayment({
      status: "ACTIVE",
      escrows: [
        makeEscrowItem({
          status: "ESCROWED",
          condition: CONDITION,
          fulfillment: ENCRYPTED_FULFILLMENT,
          xrplSequence: XRPL_SEQUENCE,
          approvals: [makeApproval("SHIPMENT_CONFIRMED", approvalOverrides)],
        }),
      ],
    });
    ctx.escrowPaymentModel.findById.mockReturnValue(makeQueryChain(payment));
    return payment;
  }

  beforeEach(async () => {
    ctx = await makeServiceTestingModule();
  });

  it("에스크로가 ESCROWED 상태가 아니면 → EscrowItemMustBeEscrowedException", async () => {
    const payment = makePayment({
      escrows: [makeEscrowItem({ status: "PENDING_ESCROW" })],
    });
    ctx.escrowPaymentModel.findById.mockReturnValue(makeQueryChain(payment));

    await expect(
      ctx.service.approveEvent(
        PAYMENT_ID.toString(),
        ESCROW_ID.toString(),
        "SHIPMENT_CONFIRMED",
        BUYER_ID.toString(),
      ),
    ).rejects.toThrow(EscrowItemMustBeEscrowedException);
  });

  it("존재하지 않는 이벤트 타입 → EventTypeNotFoundException", async () => {
    setupEscrowedPayment();

    await expect(
      ctx.service.approveEvent(
        PAYMENT_ID.toString(),
        ESCROW_ID.toString(),
        "UNKNOWN_EVENT",
        BUYER_ID.toString(),
      ),
    ).rejects.toThrow(EventTypeNotFoundException);
  });

  it("buyer 중복 승인 → AlreadyApprovedEventException", async () => {
    setupEscrowedPayment({ buyerApproved: true });

    await expect(
      ctx.service.approveEvent(
        PAYMENT_ID.toString(),
        ESCROW_ID.toString(),
        "SHIPMENT_CONFIRMED",
        BUYER_ID.toString(),
      ),
    ).rejects.toThrow(AlreadyApprovedEventException);
  });

  it("seller 중복 승인 → AlreadyApprovedEventException", async () => {
    setupEscrowedPayment({ sellerApproved: true });

    await expect(
      ctx.service.approveEvent(
        PAYMENT_ID.toString(),
        ESCROW_ID.toString(),
        "SHIPMENT_CONFIRMED",
        SELLER_ID.toString(),
      ),
    ).rejects.toThrow(AlreadyApprovedEventException);
  });

  it("buyer도 seller도 아닌 제3자 → UnauthorizedPaymentActionException", async () => {
    setupEscrowedPayment();

    await expect(
      ctx.service.approveEvent(
        PAYMENT_ID.toString(),
        ESCROW_ID.toString(),
        "SHIPMENT_CONFIRMED",
        new Types.ObjectId().toString(),
      ),
    ).rejects.toThrow(UnauthorizedPaymentActionException);
  });

  it("buyer 승인 → buyerApproved=true, 미완료 상태 저장", async () => {
    const payment = setupEscrowedPayment();

    await ctx.service.approveEvent(
      PAYMENT_ID.toString(),
      ESCROW_ID.toString(),
      "SHIPMENT_CONFIRMED",
      BUYER_ID.toString(),
    );

    const approval = payment.escrows[0].approvals[0];
    expect(approval.buyerApproved).toBe(true);
    expect(approval.buyerApprovedAt).toBeInstanceOf(Date);
    expect(approval.completedAt).toBeUndefined();
    expect(payment.save).toHaveBeenCalled();
  });

  it("양측 모두 승인 → completedAt 설정, EscrowFinish 자동 제출", async () => {
    const payment = setupEscrowedPayment({
      buyerApproved: true,
      buyerApprovedAt: new Date(),
    });
    ctx.userModel.findById.mockReturnValue(makeQueryChain(makeBuyerUser()));

    await ctx.service.approveEvent(
      PAYMENT_ID.toString(),
      ESCROW_ID.toString(),
      "SHIPMENT_CONFIRMED",
      SELLER_ID.toString(),
    );

    const approval = payment.escrows[0].approvals[0];
    expect(approval.completedAt).toBeInstanceOf(Date);
    expect(ctx.xrplService.finishEscrow).toHaveBeenCalledWith(
      expect.objectContaining({ seed: DECRYPTED_SEED }),
      "rBuyerAddress123",
      XRPL_SEQUENCE,
      CONDITION,
      expect.any(String),
    );
  });

  it("모든 이벤트 완료 → escrow RELEASED, txHashRelease 저장", async () => {
    const payment = setupEscrowedPayment({
      buyerApproved: true,
      buyerApprovedAt: new Date(),
    });
    ctx.userModel.findById.mockReturnValue(makeQueryChain(makeBuyerUser()));

    await ctx.service.approveEvent(
      PAYMENT_ID.toString(),
      ESCROW_ID.toString(),
      "SHIPMENT_CONFIRMED",
      SELLER_ID.toString(),
    );

    const escrow = payment.escrows[0];
    expect(escrow.status).toBe("RELEASED");
    expect(escrow.txHashRelease).toBe(TX_HASH_FINISH);
    expect(escrow.releasedAt).toBeInstanceOf(Date);
  });

  it("모든 escrow RELEASED → payment COMPLETED", async () => {
    const payment = setupEscrowedPayment({
      buyerApproved: true,
      buyerApprovedAt: new Date(),
    });
    ctx.userModel.findById.mockReturnValue(makeQueryChain(makeBuyerUser()));

    await ctx.service.approveEvent(
      PAYMENT_ID.toString(),
      ESCROW_ID.toString(),
      "SHIPMENT_CONFIRMED",
      SELLER_ID.toString(),
    );

    expect(payment.status).toBe("COMPLETED");
  });

  it("EscrowFinish 실패 → escrow 상태 ESCROWED로 롤백", async () => {
    const payment = setupEscrowedPayment({
      buyerApproved: true,
      buyerApprovedAt: new Date(),
    });
    ctx.userModel.findById.mockReturnValue(makeQueryChain(makeBuyerUser()));
    ctx.xrplService.finishEscrow.mockRejectedValue(
      new Error("XRPL network error"),
    );

    await expect(
      ctx.service.approveEvent(
        PAYMENT_ID.toString(),
        ESCROW_ID.toString(),
        "SHIPMENT_CONFIRMED",
        SELLER_ID.toString(),
      ),
    ).rejects.toThrow("XRPL network error");

    expect(payment.escrows[0].status).toBe("ESCROWED");
  });
});
