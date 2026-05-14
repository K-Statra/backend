import { Types } from "mongoose";
import {
  ESCROW_ID,
  PAYMENT_ID,
  CONDITION,
  ENCRYPTED_FULFILLMENT,
  DECRYPTED_SEED,
  XRPL_SEQUENCE,
  TX_HASH_CREATE,
  makePayment,
  makeEscrowItem,
  makeBuyerUser,
  makeSellerUser,
  makeProcessorTestingModule,
} from "./helpers";
import {
  EscrowPaymentNotFoundException,
  InvalidEscrowItemStatusException,
  PaymentNotActiveException,
  WalletNotAvailableException,
} from "../../../common/exceptions";

describe("EscrowCreateProcessor › createXrplEscrow", () => {
  let ctx: Awaited<ReturnType<typeof makeProcessorTestingModule>>;

  // post-flight markEscrowed 결과로 사용할 ESCROWED 상태 payment 픽스처
  function makeEscrowedResult(escrowOverrides: object = {}) {
    return makePayment({
      status: "PROCESSING",
      escrows: [
        makeEscrowItem({
          status: "ESCROWED",
          condition: CONDITION,
          fulfillment: ENCRYPTED_FULFILLMENT,
          xrplSequence: XRPL_SEQUENCE,
          txHashCreate: TX_HASH_CREATE,
          escrowedAt: new Date(),
          ...escrowOverrides,
        }),
      ],
    });
  }

  function setupProcessingPayment(escrowOverrides: object = {}) {
    const payment = makePayment({
      status: "PROCESSING",
      escrows: [makeEscrowItem(escrowOverrides)],
    });
    const escrowedResult = makeEscrowedResult();

    ctx.escrowPaymentRepo.findById.mockResolvedValue(payment);
    ctx.escrowPaymentRepo.preflight.mockResolvedValueOnce(payment);
    ctx.escrowPaymentRepo.markEscrowed.mockResolvedValueOnce(escrowedResult);

    return { payment, escrowedResult };
  }

  function setupWallets() {
    ctx.userFacade.findByIdWithSeed.mockResolvedValueOnce(makeBuyerUser());
    ctx.userFacade.findById.mockResolvedValueOnce(makeSellerUser());
  }

  beforeEach(async () => {
    ctx = await makeProcessorTestingModule();
  });

  // ── 유효성 검사 ──────────────────────────────────────────────────────────────

  it("결제가 PROCESSING이 아니면 → PaymentNotActiveException", async () => {
    const payment = makePayment({ status: "APPROVED" });
    ctx.escrowPaymentRepo.findById.mockResolvedValue(payment);

    await expect(
      ctx.processor.createXrplEscrow(
        PAYMENT_ID.toString(),
        ESCROW_ID.toString(),
      ),
    ).rejects.toThrow(PaymentNotActiveException);
  });

  it("에스크로 항목이 PENDING_ESCROW가 아니면 → InvalidEscrowItemStatusException", async () => {
    const payment = makePayment({
      status: "PROCESSING",
      escrows: [makeEscrowItem({ status: "ESCROWED" })],
    });
    ctx.escrowPaymentRepo.findById.mockResolvedValue(payment);

    await expect(
      ctx.processor.createXrplEscrow(
        PAYMENT_ID.toString(),
        ESCROW_ID.toString(),
      ),
    ).rejects.toThrow(InvalidEscrowItemStatusException);
  });

  it("존재하지 않는 결제 → EscrowPaymentNotFoundException", async () => {
    ctx.escrowPaymentRepo.findById.mockResolvedValue(null);

    await expect(
      ctx.processor.createXrplEscrow(
        PAYMENT_ID.toString(),
        ESCROW_ID.toString(),
      ),
    ).rejects.toThrow(EscrowPaymentNotFoundException);
  });

  it("buyer 지갑 없으면 → WalletNotAvailableException", async () => {
    setupProcessingPayment();
    ctx.userFacade.findByIdWithSeed.mockResolvedValue({ wallet: null });

    await expect(
      ctx.processor.createXrplEscrow(
        PAYMENT_ID.toString(),
        ESCROW_ID.toString(),
      ),
    ).rejects.toThrow(WalletNotAvailableException);
  });

  it("seller 지갑 없으면 → WalletNotAvailableException", async () => {
    setupProcessingPayment();
    ctx.userFacade.findByIdWithSeed.mockResolvedValueOnce(makeBuyerUser());
    ctx.userFacade.findById.mockResolvedValueOnce({ wallet: null });

    await expect(
      ctx.processor.createXrplEscrow(
        PAYMENT_ID.toString(),
        ESCROW_ID.toString(),
      ),
    ).rejects.toThrow(WalletNotAvailableException);
  });

  // ── 정상 동작 ─────────────────────────────────────────────────────────────

  it("pre-flight: preflight 호출 — PENDING_ESCROW → SUBMITTING + condition/fulfillment 원자적 저장", async () => {
    setupProcessingPayment();
    setupWallets();

    await ctx.processor.createXrplEscrow(
      PAYMENT_ID.toString(),
      ESCROW_ID.toString(),
    );

    expect(ctx.escrowPaymentRepo.preflight).toHaveBeenCalledWith(
      PAYMENT_ID.toString(),
      ESCROW_ID.toString(),
      CONDITION,
      ENCRYPTED_FULFILLMENT,
    );
  });

  it("성공 → generateCryptoCondition, createEscrow 호출", async () => {
    setupProcessingPayment();
    setupWallets();

    await ctx.processor.createXrplEscrow(
      PAYMENT_ID.toString(),
      ESCROW_ID.toString(),
    );

    expect(ctx.xrplService.generateCryptoCondition).toHaveBeenCalled();
    expect(ctx.xrplService.createEscrow).toHaveBeenCalledWith(
      expect.objectContaining({ address: "rBuyerAddress123" }),
      "rSellerAddress456",
      300,
      CONDITION,
      "XRP",
    );
  });

  it("seed 복호화 후 xrplService에 전달", async () => {
    setupProcessingPayment();
    setupWallets();

    await ctx.processor.createXrplEscrow(
      PAYMENT_ID.toString(),
      ESCROW_ID.toString(),
    );

    expect(ctx.xrplService.decrypt).toHaveBeenCalledWith(
      expect.stringContaining("iv:tag"),
    );
    expect(ctx.xrplService.createEscrow).toHaveBeenCalledWith(
      expect.objectContaining({ seed: DECRYPTED_SEED }),
      expect.any(String),
      expect.any(Number),
      expect.any(String),
      "XRP",
    );
  });

  it("post-flight: markEscrowed 호출 — ESCROWED + xrplSequence + txHashCreate 저장", async () => {
    setupProcessingPayment();
    setupWallets();

    await ctx.processor.createXrplEscrow(
      PAYMENT_ID.toString(),
      ESCROW_ID.toString(),
    );

    expect(ctx.escrowPaymentRepo.markEscrowed).toHaveBeenCalledWith(
      PAYMENT_ID.toString(),
      ESCROW_ID.toString(),
      XRPL_SEQUENCE,
      TX_HASH_CREATE,
    );
  });

  it("모든 escrow ESCROWED → markActive로 payment ACTIVE 전환", async () => {
    setupProcessingPayment();
    setupWallets();

    const result = await ctx.processor.createXrplEscrow(
      PAYMENT_ID.toString(),
      ESCROW_ID.toString(),
    );

    expect(ctx.escrowPaymentRepo.markActive).toHaveBeenCalledWith(
      PAYMENT_ID.toString(),
    );
    expect(result.status).toBe("ACTIVE");
  });

  it("PENDING_ESCROW 항목이 남아있으면 → markActive 미호출", async () => {
    const extraEscrow = makeEscrowItem({
      _id: new Types.ObjectId(),
      status: "PENDING_ESCROW",
    });
    const payment = makePayment({
      status: "PROCESSING",
      escrows: [makeEscrowItem(), extraEscrow],
    });
    const partialResult = makePayment({
      status: "PROCESSING",
      escrows: [makeEscrowItem({ status: "ESCROWED" }), extraEscrow],
    });

    ctx.escrowPaymentRepo.findById.mockResolvedValue(payment);
    ctx.escrowPaymentRepo.preflight.mockResolvedValueOnce(payment);
    ctx.escrowPaymentRepo.markEscrowed.mockResolvedValueOnce(partialResult);
    setupWallets();

    await ctx.processor.createXrplEscrow(
      PAYMENT_ID.toString(),
      ESCROW_ID.toString(),
    );

    expect(ctx.escrowPaymentRepo.markActive).not.toHaveBeenCalled();
  });

  // ── Case A: XRPL 제출 실패 시 즉시 PENDING_ESCROW 복구 ──────────────────────

  it("XRPL 제출 실패 → revertSubmitting 호출 후 에러 재throw", async () => {
    setupProcessingPayment();
    setupWallets();
    ctx.xrplService.createEscrow.mockRejectedValue(
      new Error("XRPL network error"),
    );

    await expect(
      ctx.processor.createXrplEscrow(
        PAYMENT_ID.toString(),
        ESCROW_ID.toString(),
      ),
    ).rejects.toThrow("XRPL network error");

    expect(ctx.escrowPaymentRepo.revertSubmitting).toHaveBeenCalledWith(
      PAYMENT_ID.toString(),
      ESCROW_ID.toString(),
    );
  });

  it("XRPL 실패 후 markEscrowed는 호출되지 않음", async () => {
    setupProcessingPayment();
    setupWallets();
    ctx.xrplService.createEscrow.mockRejectedValue(new Error("XRPL error"));

    await expect(
      ctx.processor.createXrplEscrow(
        PAYMENT_ID.toString(),
        ESCROW_ID.toString(),
      ),
    ).rejects.toThrow();

    expect(ctx.escrowPaymentRepo.markEscrowed).not.toHaveBeenCalled();
  });

  // ── Case B: post-flight DB 저장 실패 시 재시도 ───────────────────────────────

  it("post-flight DB 저장 첫 시도 실패 후 재시도 성공", async () => {
    const payment = makePayment({
      status: "PROCESSING",
      escrows: [makeEscrowItem()],
    });
    const escrowedResult = makeEscrowedResult();

    ctx.escrowPaymentRepo.findById.mockResolvedValue(payment);
    ctx.escrowPaymentRepo.preflight.mockResolvedValueOnce(payment);
    ctx.escrowPaymentRepo.markEscrowed
      .mockRejectedValueOnce(new Error("DB write error"))
      .mockResolvedValueOnce(escrowedResult);
    setupWallets();

    const result = await ctx.processor.createXrplEscrow(
      PAYMENT_ID.toString(),
      ESCROW_ID.toString(),
    );

    expect(result.escrows[0].status).toBe("ESCROWED");
    expect(ctx.escrowPaymentRepo.markEscrowed).toHaveBeenCalledTimes(2);
  }, 10_000);

  it("post-flight DB 저장 3회 모두 실패 → 에러 throw (SUBMITTING 유지)", async () => {
    const payment = makePayment({
      status: "PROCESSING",
      escrows: [makeEscrowItem()],
    });
    const dbError = new Error("DB write error");

    ctx.escrowPaymentRepo.findById.mockResolvedValue(payment);
    ctx.escrowPaymentRepo.preflight.mockResolvedValueOnce(payment);
    ctx.escrowPaymentRepo.markEscrowed.mockRejectedValue(dbError);
    setupWallets();

    await expect(
      ctx.processor.createXrplEscrow(
        PAYMENT_ID.toString(),
        ESCROW_ID.toString(),
      ),
    ).rejects.toThrow("DB write error");

    expect(ctx.escrowPaymentRepo.markEscrowed).toHaveBeenCalledTimes(3);
  }, 10_000);
});
