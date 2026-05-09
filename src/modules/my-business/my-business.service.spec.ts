import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { NotFoundException } from "@nestjs/common";
import { Types } from "mongoose";
import { MyBusinessService } from "./my-business.service";
import { User } from "../users/schemas/user.schema";
import { Seller } from "../sellers/schemas/seller.schema";
import { Buyer } from "../buyers/schemas/buyer.schema";

const SELLER_ID = new Types.ObjectId();
const BUYER_ID = new Types.ObjectId();
const USER_ID = new Types.ObjectId().toString();

const makeUserModel = (overrides = {}) => ({
  findById: jest.fn(),
  ...overrides,
});

const makeSellerModel = (overrides = {}) => ({
  find: jest.fn(),
  ...overrides,
});

const makeBuyerModel = (overrides = {}) => ({
  find: jest.fn(),
  ...overrides,
});

function buildFindMock(resolvedValue: any) {
  return {
    lean: jest.fn().mockResolvedValue(resolvedValue),
  };
}

describe("MyBusinessService", () => {
  let service: MyBusinessService;
  let userModel: ReturnType<typeof makeUserModel>;
  let sellerModel: ReturnType<typeof makeSellerModel>;
  let buyerModel: ReturnType<typeof makeBuyerModel>;

  beforeEach(async () => {
    userModel = makeUserModel();
    sellerModel = makeSellerModel();
    buyerModel = makeBuyerModel();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MyBusinessService,
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: getModelToken(Seller.name), useValue: sellerModel },
        { provide: getModelToken(Buyer.name), useValue: buyerModel },
      ],
    }).compile();

    service = module.get<MyBusinessService>(MyBusinessService);
  });

  // ── getProfile ────────────────────────────────────────────────────────────────

  describe("getProfile", () => {
    it("프로필 반환 시 undefined 필드 없음", async () => {
      const mockUser = {
        _id: USER_ID,
        email: "test@example.com",
        name: "ABC Corp",
        contactName: "홍길동",
        phone: "010-1234-5678",
        type: "seller",
        wallet: { address: "rXXXXX" },
        status: "ACTIVE",
        industries: ["IT"],
      };
      userModel.findById.mockReturnValue(buildFindMock(mockUser));

      const result = await service.getProfile(USER_ID);

      const undefinedFields = Object.entries(result)
        .filter(([, v]) => v === undefined)
        .map(([k]) => k);
      expect(undefinedFields).toHaveLength(0);
    });

    it("존재하지 않는 userId → NotFoundException", async () => {
      userModel.findById.mockReturnValue(buildFindMock(null));

      await expect(service.getProfile(USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── getPartners ───────────────────────────────────────────────────────────────

  describe("getPartners", () => {
    it("savedPartners 없으면 빈 data 반환", async () => {
      userModel.findById.mockReturnValue(buildFindMock({ savedPartners: [] }));

      const result = await service.getPartners(USER_ID, 1, 10);

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it("페이지네이션 totalPages 올림 계산", async () => {
      const savedPartners = Array.from({ length: 21 }, () => ({
        partnerId: new Types.ObjectId(),
        partnerType: "seller",
      }));
      userModel.findById.mockReturnValue(buildFindMock({ savedPartners }));
      sellerModel.find.mockReturnValue(buildFindMock([]));

      const result = await service.getPartners(USER_ID, 1, 10);

      expect(result.total).toBe(21);
      expect(result.totalPages).toBe(3);
    });

    it("seller/buyer 혼합 파트너 목록 반환 및 partnerType 포함", async () => {
      const savedPartners = [
        { partnerId: SELLER_ID, partnerType: "seller" },
        { partnerId: BUYER_ID, partnerType: "buyer" },
      ];
      userModel.findById.mockReturnValue(buildFindMock({ savedPartners }));

      const mockSeller = { _id: SELLER_ID, name: "Seller Corp" };
      const mockBuyer = { _id: BUYER_ID, name_kr: "바이어사" };
      sellerModel.find.mockReturnValue(buildFindMock([mockSeller]));
      buyerModel.find.mockReturnValue(buildFindMock([mockBuyer]));

      const result = await service.getPartners(USER_ID, 1, 10);

      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toMatchObject({ partnerType: "seller" });
      expect(result.data[1]).toMatchObject({ partnerType: "buyer" });
    });

    it("DB에서 삭제된 기업은 data에서 제외", async () => {
      const deletedId = new Types.ObjectId();
      const savedPartners = [
        { partnerId: SELLER_ID, partnerType: "seller" },
        { partnerId: deletedId, partnerType: "seller" },
      ];
      userModel.findById.mockReturnValue(buildFindMock({ savedPartners }));

      const mockSeller = { _id: SELLER_ID, name: "존재하는 기업" };
      sellerModel.find.mockReturnValue(buildFindMock([mockSeller]));
      buyerModel.find.mockReturnValue(buildFindMock([]));

      const result = await service.getPartners(USER_ID, 1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({ name: "존재하는 기업" });
    });

    it("savedPartners 순서대로 data 반환", async () => {
      const id1 = new Types.ObjectId();
      const id2 = new Types.ObjectId();
      const savedPartners = [
        { partnerId: id2, partnerType: "seller" },
        { partnerId: id1, partnerType: "seller" },
      ];
      userModel.findById.mockReturnValue(buildFindMock({ savedPartners }));

      sellerModel.find.mockReturnValue(
        buildFindMock([
          { _id: id1, name: "첫번째로 가입" },
          { _id: id2, name: "나중에 가입" },
        ]),
      );
      buyerModel.find.mockReturnValue(buildFindMock([]));

      const result = await service.getPartners(USER_ID, 1, 10);

      expect(result.data[0]).toMatchObject({ name: "나중에 가입" });
      expect(result.data[1]).toMatchObject({ name: "첫번째로 가입" });
    });

    it("존재하지 않는 userId → NotFoundException", async () => {
      userModel.findById.mockReturnValue(buildFindMock(null));

      await expect(service.getPartners(USER_ID, 1, 10)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
