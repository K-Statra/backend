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
  makeQueryChain,
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

  // post-flight findOneAndUpdate 결과로 사용할 ESCROWED 상태 payment 픽스처
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

    ctx.escrowPaymentModel.findById.mockReturnValue(makeQueryChain(payment));
    ctx.escrowPaymentModel.findOneAndUpdate
      .mockResolvedValueOnce(payment) // pre-flight: PENDING_ESCROW → SUBMITTING
      .mockResolvedValueOnce(escrowedResult); // post-flight: SUBMITTING → ESCROWED

    return { payment, escrowedResult };
  }

  function setupWallets() {
    ctx.userModel.findById
      .mockReturnValueOnce(makeQueryChain(makeBuyerUser()))
      .mockReturnValueOnce(makeQueryChain(makeSellerUser()));
  }

  beforeEach(async () => {
    ctx = await makeProcessorTestingModule();
  });

  // ── 유효성 검사 ──────────────────────────────────────────────────────────────

  it("결제가 PROCESSING이 아니면 → PaymentNotActiveException", async () => {
    const payment = makePayment({ status: "APPROVED" });
    ctx.escrowPaymentModel.findById.mockReturnValue(makeQueryChain(payment));

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
    ctx.escrowPaymentModel.findById.mockReturnValue(makeQueryChain(payment));

    await expect(
      ctx.processor.createXrplEscrow(
        PAYMENT_ID.toString(),
        ESCROW_ID.toString(),
      ),
    ).rejects.toThrow(InvalidEscrowItemStatusException);
  });

  it("존재하지 않는 결제 → EscrowPaymentNotFoundException", async () => {
    ctx.escrowPaymentModel.findById.mockReturnValue(makeQueryChain(null));

    await expect(
      ctx.processor.createXrplEscrow(
        PAYMENT_ID.toString(),
        ESCROW_ID.toString(),
      ),
    ).rejects.toThrow(EscrowPaymentNotFoundException);
  });

  it("buyer 지갑 없으면 → WalletNotAvailableException", async () => {
    setupProcessingPayment();
    ctx.userModel.findById.mockReturnValue(makeQueryChain({ wallet: null }));

    await expect(
      ctx.processor.createXrplEscrow(
        PAYMENT_ID.toString(),
        ESCROW_ID.toString(),
      ),
    ).rejects.toThrow(WalletNotAvailableException);
  });

  it("seller 지갑 없으면 → WalletNotAvailableException", async () => {
    setupProcessingPayment();
    ctx.userModel.findById
      .mockReturnValueOnce(makeQueryChain(makeBuyerUser()))
      .mockReturnValueOnce(makeQueryChain({ wallet: null }));

    await expect(
      ctx.processor.createXrplEscrow(
        PAYMENT_ID.toString(),
        ESCROW_ID.toString(),
      ),
    ).rejects.toThrow(WalletNotAvailableException);
  });

  // ── 정상 동작 ─────────────────────────────────────────────────────────────

  it("pre-flight: PENDING_ESCROW → SUBMITTING + condition/fulfillment 원자적 저장", async () => {
    setupProcessingPayment();
    setupWallets();

    await ctx.processor.createXrplEscrow(
      PAYMENT_ID.toString(),
      ESCROW_ID.toString(),
    );

    expect(ctx.escrowPaymentModel.findOneAndUpdate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        escrows: {
          $elemMatch: expect.objectContaining({ status: "PENDING_ESCROW" }),
        },
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          "escrows.$.status": "SUBMITTING",
          "escrows.$.condition": CONDITION,
          "escrows.$.fulfillment": ENCRYPTED_FULFILLMENT,
          "escrows.$.submittingAt": expect.any(Date),
        }),
      }),
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

  it("post-flight: ESCROWED + xrplSequence + txHashCreate + escrowedAt 저장", async () => {
    setupProcessingPayment();
    setupWallets();

    await ctx.processor.createXrplEscrow(
      PAYMENT_ID.toString(),
      ESCROW_ID.toString(),
    );

    expect(ctx.escrowPaymentModel.findOneAndUpdate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ "escrows._id": ESCROW_ID }),
      expect.objectContaining({
        $set: expect.objectContaining({
          "escrows.$.status": "ESCROWED",
          "escrows.$.xrplSequence": XRPL_SEQUENCE,
          "escrows.$.txHashCreate": TX_HASH_CREATE,
          "escrows.$.escrowedAt": expect.any(Date),
        }),
      }),
      expect.objectContaining({ new: true }),
    );
  });

  it("모든 escrow ESCROWED → findByIdAndUpdate로 payment ACTIVE 전환", async () => {
    setupProcessingPayment();
    setupWallets();

    const result = await ctx.processor.createXrplEscrow(
      PAYMENT_ID.toString(),
      ESCROW_ID.toString(),
    );

    expect(ctx.escrowPaymentModel.findByIdAndUpdate).toHaveBeenCalledWith(
      PAYMENT_ID.toString(),
      { $set: { status: "ACTIVE" } },
    );
    expect(result.status).toBe("ACTIVE");
  });

  it("PENDING_ESCROW 항목이 남아있으면 → payment ACTIVE 미전환", async () => {
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

    ctx.escrowPaymentModel.findById.mockReturnValue(makeQueryChain(payment));
    ctx.escrowPaymentModel.findOneAndUpdate
      .mockResolvedValueOnce(payment)
      .mockResolvedValueOnce(partialResult);
    setupWallets();

    await ctx.processor.createXrplEscrow(
      PAYMENT_ID.toString(),
      ESCROW_ID.toString(),
    );

    expect(ctx.escrowPaymentModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  // ── Case A: XRPL 제출 실패 시 즉시 PENDING_ESCROW 복구 ──────────────────────

  it("XRPL 제출 실패 → SUBMITTING → PENDING_ESCROW 즉시 복구 후 에러 재throw", async () => {
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

    // findOneAndUpdate 호출: 1) pre-flight, 2) revert(SUBMITTING→PENDING_ESCROW)
    expect(ctx.escrowPaymentModel.findOneAndUpdate).toHaveBeenCalledTimes(2);
    expect(ctx.escrowPaymentModel.findOneAndUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        escrows: {
          $elemMatch: expect.objectContaining({ status: "SUBMITTING" }),
        },
      }),
      { $set: { "escrows.$.status": "PENDING_ESCROW" } },
    );
  });

  it("XRPL 실패 후 post-flight는 호출되지 않음", async () => {
    setupProcessingPayment();
    setupWallets();
    ctx.xrplService.createEscrow.mockRejectedValue(new Error("XRPL error"));

    await expect(
      ctx.processor.createXrplEscrow(
        PAYMENT_ID.toString(),
        ESCROW_ID.toString(),
      ),
    ).rejects.toThrow();

    // pre-flight(1) + revert(1) = 2회, post-flight는 없음
    expect(ctx.escrowPaymentModel.findOneAndUpdate).toHaveBeenCalledTimes(2);
  });

  // ── Case B: post-flight DB 저장 실패 시 재시도 ───────────────────────────────

  it("post-flight DB 저장 첫 시도 실패 후 재시도 성공", async () => {
    const payment = makePayment({
      status: "PROCESSING",
      escrows: [makeEscrowItem()],
    });
    const escrowedResult = makeEscrowedResult();

    ctx.escrowPaymentModel.findById.mockReturnValue(makeQueryChain(payment));
    ctx.escrowPaymentModel.findOneAndUpdate
      .mockResolvedValueOnce(payment) // pre-flight
      .mockRejectedValueOnce(new Error("DB write error")) // post-flight 1회 실패
      .mockResolvedValueOnce(escrowedResult); // post-flight 2회 성공
    setupWallets();

    const result = await ctx.processor.createXrplEscrow(
      PAYMENT_ID.toString(),
      ESCROW_ID.toString(),
    );

    expect(result.escrows[0].status).toBe("ESCROWED");
    // pre-flight(1) + post-flight 실패(1) + post-flight 성공(1) = 3회
    expect(ctx.escrowPaymentModel.findOneAndUpdate).toHaveBeenCalledTimes(3);
  }, 10_000);

  it("post-flight DB 저장 3회 모두 실패 → 에러 throw (SUBMITTING 유지)", async () => {
    const payment = makePayment({
      status: "PROCESSING",
      escrows: [makeEscrowItem()],
    });
    const dbError = new Error("DB write error");

    ctx.escrowPaymentModel.findById.mockReturnValue(makeQueryChain(payment));
    ctx.escrowPaymentModel.findOneAndUpdate
      .mockResolvedValueOnce(payment) // pre-flight
      .mockRejectedValue(dbError); // 이후 모든 호출 실패
    setupWallets();

    await expect(
      ctx.processor.createXrplEscrow(
        PAYMENT_ID.toString(),
        ESCROW_ID.toString(),
      ),
    ).rejects.toThrow("DB write error");

    // pre-flight(1) + post-flight 3회 = 총 4회
    expect(ctx.escrowPaymentModel.findOneAndUpdate).toHaveBeenCalledTimes(4);
  }, 10_000);
});
