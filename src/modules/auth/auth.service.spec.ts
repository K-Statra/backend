import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { ConflictException } from "@nestjs/common";
import { Types } from "mongoose";
import { AuthService } from "./auth.service";
import { User } from "../users/schemas/user.schema";
import { Company } from "../users/schemas/company.schema";
import { Buyer } from "../users/schemas/buyer.schema";
import { XrplService } from "../payments/xrpl.service";

// ── 공통 픽스처 ──────────────────────────────────────────────────────────────

const MOCK_WALLET = {
  address: "rTestAddress123",
  seed: "sTestSeed",
  publicKey: "pubkey",
  privateKey: "privkey",
};

const ENCRYPTED_SEED = "iv:tag:encrypted";

function makeDoc(fields: object) {
  const obj = {
    _id: new Types.ObjectId(),
    wallet: {
      address: MOCK_WALLET.address,
      seed: ENCRYPTED_SEED,
      publicKey: MOCK_WALLET.publicKey,
    },
    ...fields,
  };
  return {
    ...obj,
    save: jest.fn().mockResolvedValue(obj),
    toObject: jest.fn().mockReturnValue({ ...obj }),
    _id: obj._id,
  };
}

function makeModelMock() {
  const savedDoc = makeDoc({});
  const instance = {
    save: jest
      .fn()
      .mockResolvedValue({ ...savedDoc, toObject: savedDoc.toObject }),
  };
  const ModelMock: any = jest.fn().mockImplementation(() => instance);
  ModelMock.exists = jest.fn().mockResolvedValue(null);
  ModelMock.updateOne = jest.fn().mockResolvedValue({});
  ModelMock.find = jest
    .fn()
    .mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
  ModelMock._instance = instance;
  ModelMock._savedDoc = savedDoc;
  return ModelMock;
}

const makeXrplMock = () => ({
  generateWallet: jest.fn().mockReturnValue(MOCK_WALLET),
  encrypt: jest.fn().mockReturnValue(ENCRYPTED_SEED),
  decrypt: jest.fn().mockReturnValue(MOCK_WALLET.seed),
  fundAccount: jest.fn().mockResolvedValue(undefined),
});

const SELLER_DTO = {
  companyName: "테스트 판매사",
  representativeName: "홍길동",
  representativeEmail: "seller@test.com",
  representativePhone: "010-1234-5678",
  password: "password123",
  exportItems: ["화장품", "식품"],
  companyIntroduction: "회사 소개",
  productIntroduction: "제품 소개",
};

const BUYER_DTO = {
  companyName: "테스트 구매사",
  representativeName: "김철수",
  representativeEmail: "buyer@test.com",
  representativePhone: "010-8765-4321",
  password: "password123",
  needs: ["전자부품"],
  companyIntroduction: "회사 소개",
  productIntroduction: "제품 소개",
};

// ── 테스트 ────────────────────────────────────────────────────────────────────

describe("AuthService", () => {
  let service: AuthService;
  let userModel: ReturnType<typeof makeModelMock>;
  let companyModel: ReturnType<typeof makeModelMock>;
  let buyerModel: ReturnType<typeof makeModelMock>;
  let xrplService: ReturnType<typeof makeXrplMock>;

  beforeEach(async () => {
    userModel = makeModelMock();
    companyModel = makeModelMock();
    buyerModel = makeModelMock();
    xrplService = makeXrplMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: getModelToken(Company.name), useValue: companyModel },
        { provide: getModelToken(Buyer.name), useValue: buyerModel },
        { provide: XrplService, useValue: xrplService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ── registerSeller ────────────────────────────────────────────────────────

  describe("registerSeller", () => {
    it("정상 가입 → 저장 후 응답 반환", async () => {
      const result = await service.registerSeller(SELLER_DTO);

      expect(companyModel).toHaveBeenCalled();
      expect(companyModel._instance.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it("지갑 생성 및 seed 암호화 호출", async () => {
      await service.registerSeller(SELLER_DTO);

      expect(xrplService.generateWallet).toHaveBeenCalled();
      expect(xrplService.encrypt).toHaveBeenCalledWith(MOCK_WALLET.seed);
    });

    it("contactName에 representativeName 사용", async () => {
      await service.registerSeller(SELLER_DTO);

      const constructorCall = companyModel.mock.calls[0][0];
      expect(constructorCall.contactName).toBe(SELLER_DTO.representativeName);
    });

    it("응답에 wallet.seed 없음", async () => {
      const savedObj = {
        _id: new Types.ObjectId(),
        wallet: {
          address: MOCK_WALLET.address,
          seed: ENCRYPTED_SEED,
          publicKey: MOCK_WALLET.publicKey,
        },
        name: SELLER_DTO.companyName,
      };
      companyModel._instance.save.mockResolvedValue({
        _id: savedObj._id,
        toObject: jest.fn().mockReturnValue({ ...savedObj }),
      });

      const result = await service.registerSeller(SELLER_DTO);

      expect(result.wallet?.seed).toBeUndefined();
    });

    it("status가 PENDING_ACTIVATION으로 저장", async () => {
      await service.registerSeller(SELLER_DTO);

      const constructorCall = companyModel.mock.calls[0][0];
      expect(constructorCall.status).toBe("PENDING_ACTIVATION");
    });

    it("중복 이메일 → ConflictException", async () => {
      userModel.exists.mockResolvedValue({ _id: new Types.ObjectId() });

      await expect(service.registerSeller(SELLER_DTO as any)).rejects.toThrow(
        ConflictException,
      );
      expect(companyModel._instance.save).not.toHaveBeenCalled();
    });
  });

  // ── registerBuyer ─────────────────────────────────────────────────────────

  describe("registerBuyer", () => {
    it("정상 가입 → 저장 후 응답 반환", async () => {
      const result = await service.registerBuyer(BUYER_DTO);

      expect(buyerModel).toHaveBeenCalled();
      expect(buyerModel._instance.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it("응답에 wallet.seed 없음", async () => {
      const savedObj = {
        _id: new Types.ObjectId(),
        wallet: {
          address: MOCK_WALLET.address,
          seed: ENCRYPTED_SEED,
          publicKey: MOCK_WALLET.publicKey,
        },
        name: BUYER_DTO.companyName,
      };
      buyerModel._instance.save.mockResolvedValue({
        _id: savedObj._id,
        toObject: jest.fn().mockReturnValue({ ...savedObj }),
      });

      const result = await service.registerBuyer(BUYER_DTO);

      expect(result.wallet?.seed).toBeUndefined();
    });

    it("중복 이메일 → ConflictException", async () => {
      userModel.exists.mockResolvedValue({ _id: new Types.ObjectId() });

      await expect(service.registerBuyer(BUYER_DTO as any)).rejects.toThrow(
        ConflictException,
      );
      expect(buyerModel._instance.save).not.toHaveBeenCalled();
    });
  });

  // ── retryFailedActivations ────────────────────────────────────────────────

  describe("retryFailedActivations", () => {
    it("FAILED_ACTIVATION 계정 없으면 fundAccount 호출 안 함", async () => {
      companyModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      });
      buyerModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      });

      await service.retryFailedActivations();

      expect(xrplService.fundAccount).not.toHaveBeenCalled();
    });

    it("FAILED seller → fundAccount 호출 후 ACTIVE 업데이트", async () => {
      const failedSeller = {
        _id: new Types.ObjectId(),
        wallet: {
          address: MOCK_WALLET.address,
          seed: ENCRYPTED_SEED,
          publicKey: MOCK_WALLET.publicKey,
        },
      };
      companyModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([failedSeller]),
      });
      buyerModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      });

      await service.retryFailedActivations();

      expect(xrplService.decrypt).toHaveBeenCalledWith(ENCRYPTED_SEED);
      expect(xrplService.fundAccount).toHaveBeenCalledTimes(1);
      expect(companyModel.updateOne).toHaveBeenCalledWith(
        { _id: failedSeller._id },
        { status: "ACTIVE" },
      );
    });

    it("FAILED buyer → fundAccount 호출 후 ACTIVE 업데이트", async () => {
      const failedBuyer = {
        _id: new Types.ObjectId(),
        wallet: {
          address: MOCK_WALLET.address,
          seed: ENCRYPTED_SEED,
          publicKey: MOCK_WALLET.publicKey,
        },
      };
      companyModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      });
      buyerModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([failedBuyer]),
      });

      await service.retryFailedActivations();

      expect(xrplService.fundAccount).toHaveBeenCalledTimes(1);
      expect(buyerModel.updateOne).toHaveBeenCalledWith(
        { _id: failedBuyer._id },
        { status: "ACTIVE" },
      );
    });

    it("일부 계정 펀딩 실패해도 나머지 계정 재시도 계속", async () => {
      const failedSeller1 = {
        _id: new Types.ObjectId(),
        wallet: { address: "addr1", seed: ENCRYPTED_SEED, publicKey: "pk1" },
      };
      const failedSeller2 = {
        _id: new Types.ObjectId(),
        wallet: { address: "addr2", seed: ENCRYPTED_SEED, publicKey: "pk2" },
      };

      companyModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([failedSeller1, failedSeller2]),
      });
      buyerModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      });

      xrplService.fundAccount
        .mockRejectedValueOnce(new Error("네트워크 오류"))
        .mockResolvedValueOnce(undefined);

      await service.retryFailedActivations();

      expect(xrplService.fundAccount).toHaveBeenCalledTimes(2);
      // 두 번째는 성공 → ACTIVE
      expect(companyModel.updateOne).toHaveBeenCalledWith(
        { _id: failedSeller2._id },
        { status: "ACTIVE" },
      );
      // 첫 번째는 실패 → updateOne 호출 안 됨
      expect(companyModel.updateOne).not.toHaveBeenCalledWith(
        { _id: failedSeller1._id },
        { status: "ACTIVE" },
      );
    });

    it("seller와 buyer 동시에 재시도", async () => {
      const failedSeller = {
        _id: new Types.ObjectId(),
        wallet: { address: "addr1", seed: ENCRYPTED_SEED, publicKey: "pk1" },
      };
      const failedBuyer = {
        _id: new Types.ObjectId(),
        wallet: { address: "addr2", seed: ENCRYPTED_SEED, publicKey: "pk2" },
      };

      companyModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([failedSeller]),
      });
      buyerModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([failedBuyer]),
      });

      await service.retryFailedActivations();

      expect(xrplService.fundAccount).toHaveBeenCalledTimes(2);
      expect(companyModel.updateOne).toHaveBeenCalledWith(
        { _id: failedSeller._id },
        { status: "ACTIVE" },
      );
      expect(buyerModel.updateOne).toHaveBeenCalledWith(
        { _id: failedBuyer._id },
        { status: "ACTIVE" },
      );
    });
  });
});
