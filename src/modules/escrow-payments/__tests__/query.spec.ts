import { Types } from "mongoose";
import {
  BUYER_ID,
  SELLER_ID,
  ESCROW_ID,
  PAYMENT_ID,
  makePayment,
  makeCrudServiceTestingModule,
  makeServiceTestingModule,
} from "./helpers";
import {
  EscrowItemNotFoundException,
  EscrowPaymentNotFoundException,
  UnauthorizedPaymentActionException,
} from "../../../common/exceptions";

describe("EscrowPaymentsCrudService › findAll", () => {
  let ctx: Awaited<ReturnType<typeof makeCrudServiceTestingModule>>;

  beforeEach(async () => {
    ctx = await makeCrudServiceTestingModule();
  });

  it("buyerId OR sellerId 조건으로 조회", async () => {
    await ctx.service.findAll(BUYER_ID.toString(), { page: 1, limit: 5 });

    const [filter] = ctx.escrowPaymentRepo.findMany.mock.calls[0];
    expect(filter).toMatchObject({
      $or: [
        { buyerId: expect.any(Types.ObjectId) },
        { sellerId: expect.any(Types.ObjectId) },
      ],
    });
  });

  it("group=ongoing → PENDING_APPROVAL/APPROVED/PROCESSING/ACTIVE 필터", async () => {
    await ctx.service.findAll(BUYER_ID.toString(), {
      group: "ongoing",
      page: 1,
      limit: 5,
    });

    const [filter] = ctx.escrowPaymentRepo.findMany.mock.calls[0];
    expect(filter.status.$in).toEqual(
      expect.arrayContaining([
        "PENDING_APPROVAL",
        "APPROVED",
        "PROCESSING",
        "ACTIVE",
      ]),
    );
  });

  it("group=done → COMPLETED/CANCELLED 필터", async () => {
    await ctx.service.findAll(BUYER_ID.toString(), {
      group: "done",
      page: 1,
      limit: 5,
    });

    const [filter] = ctx.escrowPaymentRepo.findMany.mock.calls[0];
    expect(filter.status.$in).toEqual(
      expect.arrayContaining(["COMPLETED", "CANCELLED"]),
    );
  });

  it("status 직접 지정 시 해당 상태만 필터", async () => {
    await ctx.service.findAll(BUYER_ID.toString(), {
      status: "ACTIVE",
      page: 1,
      limit: 5,
    });

    const [filter] = ctx.escrowPaymentRepo.findMany.mock.calls[0];
    expect(filter.status).toBe("ACTIVE");
  });

  it("필터 없으면 status 조건 없이 조회", async () => {
    await ctx.service.findAll(BUYER_ID.toString(), { page: 1, limit: 5 });

    const [filter] = ctx.escrowPaymentRepo.findMany.mock.calls[0];
    expect(filter.status).toBeUndefined();
  });

  it("total, page, limit 포함한 응답 반환", async () => {
    const mockDocs = [makePayment(), makePayment()];
    ctx.escrowPaymentRepo.findMany.mockResolvedValue(mockDocs);
    ctx.escrowPaymentRepo.countDocuments.mockResolvedValue(2);

    const result = await ctx.service.findAll(BUYER_ID.toString(), {
      page: 1,
      limit: 5,
    });

    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(5);
    expect(result.data).toHaveLength(2);
  });
});

describe("EscrowPaymentsCrudService › findById", () => {
  let ctx: Awaited<ReturnType<typeof makeCrudServiceTestingModule>>;

  beforeEach(async () => {
    ctx = await makeCrudServiceTestingModule();
  });

  it("존재하는 ID → 결제 내역 반환 (지갑 정보 포함)", async () => {
    const payment = makePayment({
      buyerId: BUYER_ID,
      sellerId: SELLER_ID,
      buyerName: "Buyer Corp",
      sellerName: "Seller Corp",
      buyerWalletAddress: "rBuyer123",
      sellerWalletAddress: "rSeller456",
    });
    ctx.escrowPaymentRepo.findByIdLean.mockResolvedValue(payment);

    const result = await ctx.service.findById(
      PAYMENT_ID.toString(),
      BUYER_ID.toString(),
    );

    expect(result.myId).toEqual(BUYER_ID);
    expect(result.partnerId).toEqual(SELLER_ID);
    expect(result.myName).toBe("Buyer Corp");
    expect(result.partnerName).toBe("Seller Corp");
    expect(result.myWalletAddress).toBe("rBuyer123");
    expect(result.partnerWalletAddress).toBe("rSeller456");

    // 절대적 필드 제외 확인
    expect((result as any).buyerId).toBeUndefined();
    expect((result as any).sellerId).toBeUndefined();
    expect((result as any).buyerName).toBeUndefined();
  });

  it("존재하지 않는 ID → EscrowPaymentNotFoundException", async () => {
    ctx.escrowPaymentRepo.findByIdLean.mockResolvedValue(null);

    await expect(
      ctx.service.findById(PAYMENT_ID.toString(), BUYER_ID.toString()),
    ).rejects.toThrow(EscrowPaymentNotFoundException);
  });

  it("buyer도 seller도 아닌 제3자 → UnauthorizedPaymentActionException", async () => {
    const payment = makePayment();
    ctx.escrowPaymentRepo.findByIdLean.mockResolvedValue(payment);

    await expect(
      ctx.service.findById(
        PAYMENT_ID.toString(),
        new Types.ObjectId().toString(),
      ),
    ).rejects.toThrow(UnauthorizedPaymentActionException);
  });
});

describe("EscrowPaymentsService › getEscrowStatus", () => {
  let ctx: Awaited<ReturnType<typeof makeServiceTestingModule>>;

  beforeEach(async () => {
    ctx = await makeServiceTestingModule();
  });

  it("정상 조회 → escrow 항목 반환", async () => {
    const payment = makePayment();
    ctx.escrowPaymentRepo.findByIdLean.mockResolvedValue(payment);

    const result = await ctx.service.getEscrowStatus(
      PAYMENT_ID.toString(),
      ESCROW_ID.toString(),
    );

    expect(result.label).toBe("초기금");
    expect(result.status).toBe("PENDING_ESCROW");
  });

  it("존재하지 않는 결제 → EscrowPaymentNotFoundException", async () => {
    ctx.escrowPaymentRepo.findByIdLean.mockResolvedValue(null);

    await expect(
      ctx.service.getEscrowStatus(PAYMENT_ID.toString(), ESCROW_ID.toString()),
    ).rejects.toThrow(EscrowPaymentNotFoundException);
  });

  it("존재하지 않는 escrowId → EscrowItemNotFoundException", async () => {
    const payment = makePayment();
    ctx.escrowPaymentRepo.findByIdLean.mockResolvedValue(payment);

    await expect(
      ctx.service.getEscrowStatus(
        PAYMENT_ID.toString(),
        new Types.ObjectId().toString(),
      ),
    ).rejects.toThrow(EscrowItemNotFoundException);
  });
});
