import {
  BUYER_ID,
  SELLER_ID,
  makeCrudServiceTestingModule,
  makeQueryChain,
} from "./helpers";
import {
  BuyerWalletNotFoundException,
  SellerWalletNotFoundException,
  UnauthorizedPaymentActionException,
} from "../../../common/exceptions";

const SELLER_WALLET_ADDRESS = "rSellerAddress456";
const BUYER_WALLET_ADDRESS = "rBuyerAddress123";

const makeEscrows = () => [
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
];

describe("EscrowPaymentsCrudService › create", () => {
  let ctx: Awaited<ReturnType<typeof makeCrudServiceTestingModule>>;

  // ── buyer가 생성 ──────────────────────────────────────────────────────────

  describe("buyer가 생성", () => {
    const makeDto = () => ({
      counterpartyWalletAddress: SELLER_WALLET_ADDRESS,
      memo: "수출 대금",
      escrows: makeEscrows(),
    });

    beforeEach(async () => {
      ctx = await makeCrudServiceTestingModule();
      ctx.userModel.findById.mockReturnValue(
        makeQueryChain({ type: "buyer", name: "Buyer Corp" }),
      );
      ctx.userModel.findOne.mockReturnValue(
        makeQueryChain({ _id: SELLER_ID, name: "Seller Corp" }),
      );
    });

    it("totalAmountXrp를 escrow 항목 합산으로 계산", async () => {
      await ctx.service.create(makeDto(), BUYER_ID.toString());

      const constructorArg = ctx.escrowPaymentModel.mock.calls[0][0];
      expect(constructorArg.totalAmountXrp).toBe(1000);
    });

    it("각 escrow 항목의 approvals를 requiredEventTypes로 초기화", async () => {
      await ctx.service.create(makeDto(), BUYER_ID.toString());

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

    it("생성자(buyer)의 buyerApproved를 true로 자동 설정", async () => {
      await ctx.service.create(makeDto(), BUYER_ID.toString());

      const constructorArg = ctx.escrowPaymentModel.mock.calls[0][0];
      expect(constructorArg.buyerApproved).toBe(true);
      expect(constructorArg.buyerApprovedAt).toBeInstanceOf(Date);
      expect(constructorArg.sellerApproved).toBe(false);
    });

    it("상태를 PENDING_APPROVAL로 초기화", async () => {
      await ctx.service.create(makeDto(), BUYER_ID.toString());

      const constructorArg = ctx.escrowPaymentModel.mock.calls[0][0];
      expect(constructorArg.status).toBe("PENDING_APPROVAL");
    });

    it("save() 호출", async () => {
      const instance = { save: jest.fn().mockResolvedValue({}) };
      ctx.escrowPaymentModel.mockReturnValue(instance);

      await ctx.service.create(makeDto(), BUYER_ID.toString());

      expect(instance.save).toHaveBeenCalled();
    });

    it("counterpartyWalletAddress로 seller 조회 후 sellerId를 document에 주입", async () => {
      await ctx.service.create(makeDto(), BUYER_ID.toString());

      expect(ctx.userModel.findOne).toHaveBeenCalledWith(
        { "wallet.address": SELLER_WALLET_ADDRESS, type: "seller" },
        { _id: 1, name: 1 },
      );

      const constructorArg = ctx.escrowPaymentModel.mock.calls[0][0];
      expect(constructorArg.sellerId.toString()).toBe(SELLER_ID.toString());
    });

    it("존재하지 않는 seller 지갑 주소 → SellerWalletNotFoundException", async () => {
      ctx.userModel.findOne.mockReturnValue(makeQueryChain(null));

      await expect(
        ctx.service.create(makeDto(), BUYER_ID.toString()),
      ).rejects.toThrow(SellerWalletNotFoundException);
    });
  });

  // ── seller가 생성 ──────────────────────────────────────────────────────────

  describe("seller가 생성", () => {
    const makeDto = () => ({
      counterpartyWalletAddress: BUYER_WALLET_ADDRESS,
      memo: "수출 대금",
      escrows: makeEscrows(),
    });

    beforeEach(async () => {
      ctx = await makeCrudServiceTestingModule();
      ctx.userModel.findById.mockReturnValue(
        makeQueryChain({ type: "seller", name: "Seller Corp" }),
      );
      ctx.userModel.findOne.mockReturnValue(
        makeQueryChain({ _id: BUYER_ID, name: "Buyer Corp" }),
      );
    });

    it("생성자(seller)의 sellerApproved를 true로 자동 설정", async () => {
      await ctx.service.create(makeDto(), SELLER_ID.toString());

      const constructorArg = ctx.escrowPaymentModel.mock.calls[0][0];
      expect(constructorArg.sellerApproved).toBe(true);
      expect(constructorArg.sellerApprovedAt).toBeInstanceOf(Date);
      expect(constructorArg.buyerApproved).toBe(false);
    });

    it("counterpartyWalletAddress로 buyer 조회 후 buyerId를 document에 주입", async () => {
      await ctx.service.create(makeDto(), SELLER_ID.toString());

      expect(ctx.userModel.findOne).toHaveBeenCalledWith(
        { "wallet.address": BUYER_WALLET_ADDRESS, type: "buyer" },
        { _id: 1, name: 1 },
      );

      const constructorArg = ctx.escrowPaymentModel.mock.calls[0][0];
      expect(constructorArg.buyerId.toString()).toBe(BUYER_ID.toString());
    });

    it("존재하지 않는 buyer 지갑 주소 → BuyerWalletNotFoundException", async () => {
      ctx.userModel.findOne.mockReturnValue(makeQueryChain(null));

      await expect(
        ctx.service.create(makeDto(), SELLER_ID.toString()),
      ).rejects.toThrow(BuyerWalletNotFoundException);
    });
  });

  // ── 공통 ──────────────────────────────────────────────────────────────────

  it("DB에 없는 userId → UnauthorizedPaymentActionException", async () => {
    ctx = await makeCrudServiceTestingModule();
    // findById 기본값: null (makeUserModelMock 참고)

    await expect(
      ctx.service.create(
        {
          counterpartyWalletAddress: SELLER_WALLET_ADDRESS,
          escrows: makeEscrows(),
        },
        "000000000000000000000000",
      ),
    ).rejects.toThrow(UnauthorizedPaymentActionException);
  });
});
