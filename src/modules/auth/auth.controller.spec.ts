import { Test, TestingModule } from "@nestjs/testing";
import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

const makeAuthServiceMock = () => ({
  registerSeller: jest.fn(),
  registerBuyer: jest.fn(),
  login: jest.fn(),
});

const SELLER_DTO = {
  companyName: "테스트 판매사",
  representativeName: "홍길동",
  representativeEmail: "seller@test.com",
  representativePhone: "010-1234-5678",
  exportItems: ["화장품"],
  companyIntroduction: "회사 소개",
  productIntroduction: "제품 소개",
};

const BUYER_DTO = {
  companyName: "테스트 구매사",
  representativeName: "김철수",
  representativeEmail: "buyer@test.com",
  representativePhone: "010-8765-4321",
  needs: ["전자부품"],
  companyIntroduction: "회사 소개",
  productIntroduction: "제품 소개",
};

describe("AuthController", () => {
  let controller: AuthController;
  let authService: ReturnType<typeof makeAuthServiceMock>;

  beforeEach(async () => {
    authService = makeAuthServiceMock();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe("POST /auth/register/seller", () => {
    it("서비스 결과 그대로 반환", async () => {
      const expected = {
        _id: "id1",
        name: SELLER_DTO.companyName,
        status: "PENDING_ACTIVATION",
      };
      authService.registerSeller.mockResolvedValue(expected);

      const result = await controller.registerSeller(SELLER_DTO as any);

      expect(authService.registerSeller).toHaveBeenCalledWith(SELLER_DTO);
      expect(result).toEqual(expected);
    });

    it("중복 이메일 → ConflictException 전파", async () => {
      authService.registerSeller.mockRejectedValue(new ConflictException());

      await expect(
        controller.registerSeller(SELLER_DTO as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe("POST /auth/register/buyer", () => {
    it("서비스 결과 그대로 반환", async () => {
      const expected = {
        _id: "id2",
        name: BUYER_DTO.companyName,
        status: "PENDING_ACTIVATION",
      };
      authService.registerBuyer.mockResolvedValue(expected);

      const result = await controller.registerBuyer(BUYER_DTO as any);

      expect(authService.registerBuyer).toHaveBeenCalledWith(BUYER_DTO);
      expect(result).toEqual(expected);
    });

    it("중복 이메일 → ConflictException 전파", async () => {
      authService.registerBuyer.mockRejectedValue(new ConflictException());

      await expect(controller.registerBuyer(BUYER_DTO as any)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe("POST /auth/login", () => {
    const LOGIN_DTO = { email: "seller@test.com", password: "password123" };

    it("로그인 성공 → 세션에 userId/type 저장 후 응답 반환", async () => {
      const mockUser = { _id: "uid1", type: "seller", name: "테스트 판매사" };
      authService.login.mockResolvedValue(mockUser);
      const req = { session: {} as any };

      const result = await controller.login(LOGIN_DTO, req);

      expect(authService.login).toHaveBeenCalledWith(LOGIN_DTO);
      expect(req.session.userId).toBe("uid1");
      expect(req.session.type).toBe("seller");
      expect(result).toEqual({ message: "로그인 성공", user: mockUser });
    });

    it("인증 실패 → UnauthorizedException 전파", async () => {
      authService.login.mockRejectedValue(new UnauthorizedException());

      await expect(
        controller.login(LOGIN_DTO as any, { session: {} }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("POST /auth/logout", () => {
    it("세션 파괴 후 로그아웃 메시지 반환", async () => {
      const req = { session: { destroy: jest.fn((cb: () => void) => cb()) } };
      const res = { clearCookie: jest.fn() };
      const result = await controller.logout(req, res as any);

      expect(req.session.destroy).toHaveBeenCalled();
      expect(res.clearCookie).toHaveBeenCalledWith("connect.sid");
      expect(result).toEqual({ message: "Success logout" });
    });

    it("세션 파괴 실패 → InternalServerErrorException", async () => {
      const req = {
        session: {
          destroy: jest.fn((cb: (err: unknown) => void) =>
            cb(new Error("destroy failed")),
          ),
        },
      };
      const res = { clearCookie: jest.fn() };

      await expect(controller.logout(req, res as any)).rejects.toThrow(
        "Failed to destroy session",
      );
      expect(res.clearCookie).not.toHaveBeenCalled();
    });
  });
});
