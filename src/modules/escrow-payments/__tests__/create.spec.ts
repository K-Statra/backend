import {
  BUYER_ID,
  SELLER_ID,
  makeCrudServiceTestingModule,
  makeQueryChain,
} from "./helpers";
import {
  SellerWalletNotFoundException,
  UnauthorizedPaymentActionException,
} from "../../../common/exceptions";

const SELLER_WALLET_ADDRESS = "rSellerAddress456";

describe("EscrowPaymentsCrudService › create", () => {
  let ctx: Awaited<ReturnType<typeof makeCrudServiceTestingModule>>;

  const dto = {
    buyerId: BUYER_ID.toString(),
    sellerWalletAddress: SELLER_WALLET_ADDRESS,
    memo: "수출 대금",
    escrows: [
      {
        label: "초기금",
        amountXrp: 300,
        order: 0,
        requiredEventTypes: ["SHIPMENT_CONFIRMED"],
      },
      {
        label: "잔금",
        amountXrp: 700,
        order: 1,
        requiredEventTypes: ["DELIVERY_CONFIRMED", "INSPECTION_PASSED"],
      },
    ],
  };

  beforeEach(async () => {
    ctx = await makeCrudServiceTestingModule();
    // 기본값: 지갑 주소로 seller 조회 성공
    ctx.userModel.findOne.mockReturnValue(makeQueryChain({ _id: SELLER_ID }));
  });

  it("totalAmountXrp를 escrow 항목 합산으로 계산", async () => {
    await ctx.service.create(dto, BUYER_ID.toString());

    const constructorArg = ctx.escrowPaymentModel.mock.calls[0][0];
    expect(constructorArg.totalAmountXrp).toBe(1000);
  });

  it("각 escrow 항목의 approvals를 requiredEventTypes로 초기화", async () => {
    await ctx.service.create(dto, BUYER_ID.toString());

    const constructorArg = ctx.escrowPaymentModel.mock.calls[0][0];
    expect(constructorArg.escrows[0].approvals).toEqual([
      expect.objectContaining({
        eventType: "SHIPMENT_CONFIRMED",
        buyerApproved: false,
        sellerApproved: false,
      }),
    ]);
    expect(constructorArg.escrows[1].approvals).toHaveLength(2);
  });

  it("save() 호출", async () => {
    const instance = { save: jest.fn().mockResolvedValue({}) };
    ctx.escrowPaymentModel.mockReturnValue(instance);

    await ctx.service.create(dto, BUYER_ID.toString());

    expect(instance.save).toHaveBeenCalled();
  });

  it("wallet.address로 seller 조회 후 sellerId를 document에 주입", async () => {
    await ctx.service.create(dto, BUYER_ID.toString());

    expect(ctx.userModel.findOne).toHaveBeenCalledWith(
      { "wallet.address": SELLER_WALLET_ADDRESS, type: "seller" },
      { _id: 1 },
    );

    const constructorArg = ctx.escrowPaymentModel.mock.calls[0][0];
    expect(constructorArg.sellerId.toString()).toBe(SELLER_ID.toString());
  });

  it("존재하지 않는 지갑 주소 → SellerWalletNotFoundException", async () => {
    ctx.userModel.findOne.mockReturnValue(makeQueryChain(null));

    await expect(ctx.service.create(dto, BUYER_ID.toString())).rejects.toThrow(
      SellerWalletNotFoundException,
    );
  });

  it("buyer가 아닌 제3자 → UnauthorizedPaymentActionException", async () => {
    await expect(
      ctx.service.create(dto, "000000000000000000000000"),
    ).rejects.toThrow(UnauthorizedPaymentActionException);
  });
});
