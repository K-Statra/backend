import { BUYER_ID, SELLER_ID, makeServiceTestingModule } from "./helpers";
import { UnauthorizedPaymentActionException } from "../../../common/exceptions";

describe("EscrowPaymentsService › create", () => {
  let ctx: Awaited<ReturnType<typeof makeServiceTestingModule>>;

  const dto = {
    buyerId: BUYER_ID.toString(),
    sellerId: SELLER_ID.toString(),
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
    ctx = await makeServiceTestingModule();
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

  it("참여자가 아닌 제3자 → UnauthorizedPaymentActionException", async () => {
    await expect(
      ctx.service.create(dto, "000000000000000000000000"),
    ).rejects.toThrow(UnauthorizedPaymentActionException);
  });
});
