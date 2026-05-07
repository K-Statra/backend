import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import {
  AlreadyApprovedEventException,
  AlreadyApprovedPaymentException,
  EscrowItemMustBeEscrowedException,
  EscrowItemNotFoundException,
  EscrowPaymentNotFoundException,
  EventTypeNotFoundException,
  InsufficientXrpBalanceException,
  InvalidEscrowCancelStatusException,
  InvalidEscrowItemStatusException,
  InvalidPaymentStatusException,
  PaymentInitiationFailedException,
  PaymentNotActiveException,
  PaymentNotApprovedForPayException,
  UnauthorizedPaymentActionException,
  WalletNotAvailableException,
} from "../../common/exceptions";
import { Types } from "mongoose";
import { EscrowPaymentsService } from "./escrow-payments.service";
import { EscrowPayment } from "./schemas/escrow-payment.schema";
import { User } from "../users/schemas/user.schema";
import { XrplService } from "../xrpl/xrpl.service";
import { OutboxService } from "../outbox/outbox.service";

// ── 공통 상수 ─────────────────────────────────────────────────────────────────

const BUYER_ID = new Types.ObjectId();
const SELLER_ID = new Types.ObjectId();
const ESCROW_ID = new Types.ObjectId();
const PAYMENT_ID = new Types.ObjectId();

const ENCRYPTED_SEED = "iv:tag:encryptedSeed";
const DECRYPTED_SEED = "sTestSeed";
const PLAIN_FULFILLMENT = "A02280200".padEnd(72, "0");
const ENCRYPTED_FULFILLMENT = "iv:tag:encryptedFulfillment";
const CONDITION = "A02580200".padEnd(78, "0");
const TX_HASH_CREATE = "CREATE_TX_HASH_ABC";
const TX_HASH_FINISH = "FINISH_TX_HASH_XYZ";
const XRPL_SEQUENCE = 42;

// ── 픽스처 헬퍼 ───────────────────────────────────────────────────────────────

function makeQueryChain(value: any) {
  const promise = Promise.resolve(value);
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(value),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  };
  return chain;
}

function makeApproval(eventType: string, overrides: object = {}) {
  return {
    eventType,
    buyerApproved: false,
    buyerApprovedAt: undefined,
    sellerApproved: false,
    sellerApprovedAt: undefined,
    completedAt: undefined,
    ...overrides,
  };
}

function makeEscrowItem(overrides: object = {}) {
  return {
    _id: ESCROW_ID,
    label: "초기금",
    amountXrp: 300,
    order: 0,
    status: "PENDING_ESCROW",
    requiredEventTypes: ["SHIPMENT_CONFIRMED"],
    approvals: [makeApproval("SHIPMENT_CONFIRMED")],
    xrplSequence: undefined as number | undefined,
    condition: undefined as string | undefined,
    fulfillment: undefined as string | undefined,
    txHashCreate: undefined as string | undefined,
    txHashRelease: undefined as string | undefined,
    escrowedAt: undefined as Date | undefined,
    releasedAt: undefined as Date | undefined,
    ...overrides,
  };
}

function makePayment(overrides: object = {}) {
  const doc: any = {
    _id: PAYMENT_ID,
    buyerId: BUYER_ID,
    sellerId: SELLER_ID,
    totalAmountXrp: 300,
    status: "DRAFT",
    memo: "",
    buyerApproved: false,
    buyerApprovedAt: undefined,
    sellerApproved: false,
    sellerApprovedAt: undefined,
    escrows: [makeEscrowItem()],
    ...overrides,
  };
  doc.save = jest.fn().mockResolvedValue(doc);
  return doc;
}

function makeBuyerUser() {
  return {
    _id: BUYER_ID,
    wallet: {
      address: "rBuyerAddress123",
      seed: ENCRYPTED_SEED,
      publicKey: "buyerPublicKey",
    },
  };
}

function makeSellerUser() {
  return {
    _id: SELLER_ID,
    wallet: { address: "rSellerAddress456", publicKey: "sellerPublicKey" },
  };
}

function makeEscrowPaymentModelMock() {
  const session = {
    withTransaction: jest
      .fn()
      .mockImplementation((fn: () => Promise<void>) => fn()),
    endSession: jest.fn().mockResolvedValue(undefined),
  };

  const ModelMock: any = jest.fn().mockImplementation((data: any) => {
    const instance = { ...data };
    instance.save = jest.fn().mockResolvedValue(instance);
    return instance;
  });
  ModelMock.findById = jest.fn().mockReturnValue(makeQueryChain(null));
  ModelMock.find = jest.fn().mockReturnValue(makeQueryChain([]));
  ModelMock.countDocuments = jest.fn().mockResolvedValue(0);
  ModelMock.db = { startSession: jest.fn().mockResolvedValue(session) };
  return ModelMock;
}

function makeOutboxServiceMock() {
  return {
    createPendingEvent: jest.fn().mockResolvedValue(undefined),
  };
}

function makeUserModelMock() {
  const ModelMock: any = jest.fn();
  ModelMock.findById = jest.fn().mockReturnValue(makeQueryChain(null));
  return ModelMock;
}

function makeXrplServiceMock() {
  return {
    decrypt: jest.fn().mockImplementation((text: string) => {
      if (text === ENCRYPTED_SEED) return DECRYPTED_SEED;
      if (text === ENCRYPTED_FULFILLMENT) return PLAIN_FULFILLMENT;
      return text;
    }),
    encrypt: jest.fn().mockReturnValue(ENCRYPTED_FULFILLMENT),
    generateCryptoCondition: jest.fn().mockReturnValue({
      condition: CONDITION,
      fulfillment: PLAIN_FULFILLMENT,
    }),
    createEscrow: jest
      .fn()
      .mockResolvedValue({ txHash: TX_HASH_CREATE, sequence: XRPL_SEQUENCE }),
    finishEscrow: jest.fn().mockResolvedValue(TX_HASH_FINISH),
    validateEscrowFunds: jest.fn().mockResolvedValue(undefined),
  };
}

// ── 테스트 ────────────────────────────────────────────────────────────────────

describe("EscrowPaymentsService", () => {
  let service: EscrowPaymentsService;
  let escrowPaymentModel: ReturnType<typeof makeEscrowPaymentModelMock>;
  let userModel: ReturnType<typeof makeUserModelMock>;
  let xrplService: ReturnType<typeof makeXrplServiceMock>;
  let outboxService: ReturnType<typeof makeOutboxServiceMock>;

  beforeEach(async () => {
    escrowPaymentModel = makeEscrowPaymentModelMock();
    userModel = makeUserModelMock();
    xrplService = makeXrplServiceMock();
    outboxService = makeOutboxServiceMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscrowPaymentsService,
        {
          provide: getModelToken(EscrowPayment.name),
          useValue: escrowPaymentModel,
        },
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: XrplService, useValue: xrplService },
        { provide: OutboxService, useValue: outboxService },
      ],
    }).compile();

    service = module.get<EscrowPaymentsService>(EscrowPaymentsService);
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe("create", () => {
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

    it("totalAmountXrp를 escrow 항목 합산으로 계산", async () => {
      await service.create(dto);

      const constructorArg = escrowPaymentModel.mock.calls[0][0];
      expect(constructorArg.totalAmountXrp).toBe(1000);
    });

    it("각 escrow 항목의 approvals를 requiredEventTypes로 초기화", async () => {
      await service.create(dto);

      const constructorArg = escrowPaymentModel.mock.calls[0][0];
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
      escrowPaymentModel.mockReturnValue(instance);

      await service.create(dto);

      expect(instance.save).toHaveBeenCalled();
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe("findAll", () => {
    it("buyerId OR sellerId 조건으로 조회", async () => {
      const userId = BUYER_ID.toString();
      await service.findAll(userId, { page: 1, limit: 5 });

      expect(escrowPaymentModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: [
            { buyerId: expect.any(Types.ObjectId) },
            { sellerId: expect.any(Types.ObjectId) },
          ],
        }),
      );
    });

    it("group=ongoing → DRAFT/PENDING_APPROVAL/APPROVED/PROCESSING/ACTIVE 필터", async () => {
      await service.findAll(BUYER_ID.toString(), {
        group: "ongoing",
        page: 1,
        limit: 5,
      });

      const filter = escrowPaymentModel.find.mock.calls[0][0];
      expect(filter.status.$in).toEqual(
        expect.arrayContaining([
          "DRAFT",
          "PENDING_APPROVAL",
          "APPROVED",
          "PROCESSING",
          "ACTIVE",
        ]),
      );
    });

    it("group=done → COMPLETED/CANCELLED 필터", async () => {
      await service.findAll(BUYER_ID.toString(), {
        group: "done",
        page: 1,
        limit: 5,
      });

      const filter = escrowPaymentModel.find.mock.calls[0][0];
      expect(filter.status.$in).toEqual(
        expect.arrayContaining(["COMPLETED", "CANCELLED"]),
      );
    });

    it("status 직접 지정 시 해당 상태만 필터", async () => {
      await service.findAll(BUYER_ID.toString(), {
        status: "ACTIVE",
        page: 1,
        limit: 5,
      });

      const filter = escrowPaymentModel.find.mock.calls[0][0];
      expect(filter.status).toBe("ACTIVE");
    });

    it("필터 없으면 status 조건 없이 조회", async () => {
      await service.findAll(BUYER_ID.toString(), { page: 1, limit: 5 });

      const filter = escrowPaymentModel.find.mock.calls[0][0];
      expect(filter.status).toBeUndefined();
    });

    it("total, page, limit 포함한 응답 반환", async () => {
      const mockDocs = [makePayment(), makePayment()];
      escrowPaymentModel.find.mockReturnValue(makeQueryChain(mockDocs));
      escrowPaymentModel.countDocuments.mockResolvedValue(2);

      const result = await service.findAll(BUYER_ID.toString(), {
        page: 1,
        limit: 5,
      });

      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(5);
      expect(result.data).toHaveLength(2);
    });
  });

  // ── findById ──────────────────────────────────────────────────────────────

  describe("findById", () => {
    it("존재하는 ID → 결제 내역 반환", async () => {
      const payment = makePayment();
      escrowPaymentModel.findById.mockReturnValue(makeQueryChain(payment));

      const result = await service.findById(PAYMENT_ID.toString());

      expect(result).toEqual(payment);
    });

    it("존재하지 않는 ID → NotFoundException", async () => {
      escrowPaymentModel.findById.mockReturnValue(makeQueryChain(null));

      await expect(service.findById(PAYMENT_ID.toString())).rejects.toThrow(
        EscrowPaymentNotFoundException,
      );
    });
  });

  // ── approvePayment ────────────────────────────────────────────────────────

  describe("approvePayment", () => {
    it("buyer 최초 승인 → PENDING_APPROVAL, buyerApproved=true", async () => {
      const payment = makePayment({ status: "DRAFT" });
      escrowPaymentModel.findById.mockReturnValue(makeQueryChain(payment));

      await service.approvePayment(PAYMENT_ID.toString(), "buyer");

      expect(payment.buyerApproved).toBe(true);
      expect(payment.buyerApprovedAt).toBeInstanceOf(Date);
      expect(payment.status).toBe("PENDING_APPROVAL");
      expect(payment.save).toHaveBeenCalled();
    });

    it("seller 최초 승인 → PENDING_APPROVAL, sellerApproved=true", async () => {
      const payment = makePayment({ status: "DRAFT" });
      escrowPaymentModel.findById.mockReturnValue(makeQueryChain(payment));

      await service.approvePayment(PAYMENT_ID.toString(), "seller");

      expect(payment.sellerApproved).toBe(true);
      expect(payment.status).toBe("PENDING_APPROVAL");
    });

    it("양측 모두 승인 → APPROVED (XRPL 미실행)", async () => {
      const payment = makePayment({
        status: "PENDING_APPROVAL",
        buyerApproved: true,
        buyerApprovedAt: new Date(),
      });
      escrowPaymentModel.findById.mockReturnValue(makeQueryChain(payment));

      await service.approvePayment(PAYMENT_ID.toString(), "seller");

      expect(payment.status).toBe("APPROVED");
    });

    it("buyer 중복 승인 → BadRequestException", async () => {
      const payment = makePayment({
        status: "PENDING_APPROVAL",
        buyerApproved: true,
      });
      escrowPaymentModel.findById.mockReturnValue(makeQueryChain(payment));

      await expect(
        service.approvePayment(PAYMENT_ID.toString(), "buyer"),
      ).rejects.toThrow(AlreadyApprovedPaymentException);
      expect(payment.save).not.toHaveBeenCalled();
    });

    it("seller 중복 승인 → AlreadyApprovedPaymentException", async () => {
      const payment = makePayment({
        status: "PENDING_APPROVAL",
        sellerApproved: true,
      });
      escrowPaymentModel.findById.mockReturnValue(makeQueryChain(payment));

      await expect(
        service.approvePayment(PAYMENT_ID.toString(), "seller"),
      ).rejects.toThrow(AlreadyApprovedPaymentException);
    });

    it("ACTIVE 상태에서 승인 시도 → InvalidPaymentStatusException", async () => {
      const payment = makePayment({ status: "ACTIVE" });
      escrowPaymentModel.findById.mockReturnValue(makeQueryChain(payment));

      await expect(
        service.approvePayment(PAYMENT_ID.toString(), "buyer"),
      ).rejects.toThrow(InvalidPaymentStatusException);
    });

    it("존재하지 않는 결제 → NotFoundException", async () => {
      escrowPaymentModel.findById.mockReturnValue(makeQueryChain(null));

      await expect(
        service.approvePayment(PAYMENT_ID.toString(), "buyer"),
      ).rejects.toThrow(EscrowPaymentNotFoundException);
    });
  });

  // ── initiatePayment ───────────────────────────────────────────────────────

  describe("initiatePayment", () => {
    beforeEach(() => {
      // validateEscrowFunds 호출 전 userModel이 buyer 지갑 정보를 반환해야 함
      userModel.findById.mockReturnValue(makeQueryChain(makeBuyerUser()));
    });

    it("APPROVED → PROCESSING 전환 + outbox 이벤트 생성", async () => {
      const payment = makePayment({
        status: "APPROVED",
        buyerId: BUYER_ID,
      });
      escrowPaymentModel.findById.mockReturnValue(makeQueryChain(payment));

      await service.initiatePayment(PAYMENT_ID.toString(), BUYER_ID.toString());

      expect(payment.status).toBe("PROCESSING");
      expect(outboxService.createPendingEvent).toHaveBeenCalledWith(
        expect.anything(),
        "ESCROW_PAY_INITIATED",
        expect.objectContaining({ paymentId: PAYMENT_ID.toString() }),
      );
    });

    it("APPROVED 아닌 상태 → PaymentNotApprovedForPayException", async () => {
      const payment = makePayment({ status: "DRAFT", buyerId: BUYER_ID });
      escrowPaymentModel.findById.mockReturnValue(makeQueryChain(payment));

      await expect(
        service.initiatePayment(PAYMENT_ID.toString(), BUYER_ID.toString()),
      ).rejects.toThrow(PaymentNotApprovedForPayException);
    });

    it("seller도 결제 개시 가능 (결제 참여자)", async () => {
      const payment = makePayment({
        status: "APPROVED",
        buyerId: BUYER_ID,
        sellerId: SELLER_ID,
      });
      escrowPaymentModel.findById.mockReturnValue(makeQueryChain(payment));

      await service.initiatePayment(
        PAYMENT_ID.toString(),
        SELLER_ID.toString(),
      );

      expect(payment.status).toBe("PROCESSING");
    });

    it("buyer도 seller도 아닌 제3자 → UnauthorizedPaymentActionException", async () => {
      const payment = makePayment({
        status: "APPROVED",
        buyerId: BUYER_ID,
        sellerId: SELLER_ID,
      });
      escrowPaymentModel.findById.mockReturnValue(makeQueryChain(payment));

      await expect(
        service.initiatePayment(
          PAYMENT_ID.toString(),
          new Types.ObjectId().toString(),
        ),
      ).rejects.toThrow(UnauthorizedPaymentActionException);
    });

    it("결제 없음 → EscrowPaymentNotFoundException", async () => {
      escrowPaymentModel.findById.mockReturnValue(makeQueryChain(null));

      await expect(
        service.initiatePayment(PAYMENT_ID.toString(), BUYER_ID.toString()),
      ).rejects.toThrow(EscrowPaymentNotFoundException);
    });

    it("트랜잭션 실패(save 오류) → PaymentInitiationFailedException", async () => {
      const payment = makePayment({
        status: "APPROVED",
        buyerId: BUYER_ID,
        sellerId: SELLER_ID,
      });
      payment.save.mockRejectedValue(new Error("DB write error"));
      escrowPaymentModel.findById.mockReturnValue(makeQueryChain(payment));

      await expect(
        service.initiatePayment(PAYMENT_ID.toString(), BUYER_ID.toString()),
      ).rejects.toThrow(PaymentInitiationFailedException);
    });

    it("validateEscrowFunds에 buyer 주소와 PENDING_ESCROW 항목 금액을 전달", async () => {
      const payment = makePayment({ status: "APPROVED", buyerId: BUYER_ID });
      escrowPaymentModel.findById.mockReturnValue(makeQueryChain(payment));

      await service.initiatePayment(PAYMENT_ID.toString(), BUYER_ID.toString());

      expect(xrplService.validateEscrowFunds).toHaveBeenCalledWith(
        "rBuyerAddress123",
        [expect.objectContaining({ amountXrp: 300, status: "PENDING_ESCROW" })],
      );
    });

    it("XRP 잔고 부족 → InsufficientXrpBalanceException 전파 (reserve 계산은 XrplService 책임)", async () => {
      const payment = makePayment({ status: "APPROVED", buyerId: BUYER_ID });
      escrowPaymentModel.findById.mockReturnValue(makeQueryChain(payment));
      xrplService.validateEscrowFunds.mockRejectedValue(
        new InsufficientXrpBalanceException(5, 312.001),
      );

      await expect(
        service.initiatePayment(PAYMENT_ID.toString(), BUYER_ID.toString()),
      ).rejects.toThrow(InsufficientXrpBalanceException);
    });
  });

  // ── rollbackAllEscrows ────────────────────────────────────────────────────

  describe("rollbackAllEscrows", () => {
    it("PENDING_ESCROW → CANCELLED, ESCROWED → CANCELLING, payment → CANCELLED", async () => {
      const payment = makePayment({
        status: "PROCESSING",
        escrows: [
          makeEscrowItem({ status: "ESCROWED", xrplSequence: 10 }),
          makeEscrowItem({
            _id: new Types.ObjectId(),
            status: "PENDING_ESCROW",
          }),
        ],
      });
      escrowPaymentModel.findById.mockReturnValue(makeQueryChain(payment));

      await service.rollbackAllEscrows(PAYMENT_ID.toString());

      expect(payment.escrows[0].status).toBe("CANCELLING");
      expect(payment.escrows[1].status).toBe("CANCELLED");
      expect(payment.status).toBe("CANCELLED");
      expect(payment.save).toHaveBeenCalled();
    });

    it("이미 CANCELLED → no-op (멱등)", async () => {
      const payment = makePayment({ status: "CANCELLED" });
      escrowPaymentModel.findById.mockReturnValue(makeQueryChain(payment));

      await service.rollbackAllEscrows(PAYMENT_ID.toString());

      expect(payment.save).not.toHaveBeenCalled();
    });

    it("결제 없음 → 오류 없이 종료", async () => {
      escrowPaymentModel.findById.mockReturnValue(makeQueryChain(null));

      await expect(
        service.rollbackAllEscrows(PAYMENT_ID.toString()),
      ).resolves.toBeUndefined();
    });
  });

  // ── createXrplEscrow ──────────────────────────────────────────────────────

  describe("createXrplEscrow", () => {
    function setupProcessingPayment(escrowOverrides: object = {}) {
      const payment = makePayment({
        status: "PROCESSING",
        escrows: [makeEscrowItem(escrowOverrides)],
      });
      escrowPaymentModel.findById.mockReturnValue(makeQueryChain(payment));
      return payment;
    }

    // 하위 호환: setupActivePayment → setupProcessingPayment 별칭
    const setupActivePayment = setupProcessingPayment;

    it("결제가 PROCESSING이 아니면 → PaymentNotActiveException", async () => {
      const payment = makePayment({ status: "APPROVED" });
      escrowPaymentModel.findById.mockReturnValue(makeQueryChain(payment));

      await expect(
        service.createXrplEscrow(PAYMENT_ID.toString(), ESCROW_ID.toString()),
      ).rejects.toThrow(PaymentNotActiveException);
    });

    it("에스크로 항목이 PENDING_ESCROW가 아니면 → InvalidEscrowItemStatusException", async () => {
      setupActivePayment({ status: "ESCROWED" });

      await expect(
        service.createXrplEscrow(PAYMENT_ID.toString(), ESCROW_ID.toString()),
      ).rejects.toThrow(InvalidEscrowItemStatusException);
    });

    it("buyer 지갑 없으면 → WalletNotAvailableException", async () => {
      setupActivePayment();
      userModel.findById.mockReturnValue(makeQueryChain({ wallet: null }));

      await expect(
        service.createXrplEscrow(PAYMENT_ID.toString(), ESCROW_ID.toString()),
      ).rejects.toThrow(WalletNotAvailableException);
    });

    it("seller 지갑 없으면 → WalletNotAvailableException", async () => {
      setupActivePayment();
      userModel.findById
        .mockReturnValueOnce(makeQueryChain(makeBuyerUser()))
        .mockReturnValueOnce(makeQueryChain({ wallet: null }));

      await expect(
        service.createXrplEscrow(PAYMENT_ID.toString(), ESCROW_ID.toString()),
      ).rejects.toThrow(WalletNotAvailableException);
    });

    it("성공 → generateCryptoCondition, createEscrow 호출", async () => {
      setupActivePayment();
      userModel.findById
        .mockReturnValueOnce(makeQueryChain(makeBuyerUser()))
        .mockReturnValueOnce(makeQueryChain(makeSellerUser()));

      await service.createXrplEscrow(
        PAYMENT_ID.toString(),
        ESCROW_ID.toString(),
      );

      expect(xrplService.generateCryptoCondition).toHaveBeenCalled();
      expect(xrplService.createEscrow).toHaveBeenCalledWith(
        expect.objectContaining({ address: "rBuyerAddress123" }),
        "rSellerAddress456",
        300,
        CONDITION,
      );
    });

    it("모든 escrow ESCROWED → payment ACTIVE", async () => {
      const payment = setupProcessingPayment();
      userModel.findById
        .mockReturnValueOnce(makeQueryChain(makeBuyerUser()))
        .mockReturnValueOnce(makeQueryChain(makeSellerUser()));

      await service.createXrplEscrow(
        PAYMENT_ID.toString(),
        ESCROW_ID.toString(),
      );

      expect(payment.status).toBe("ACTIVE");
    });

    it("아직 PENDING_ESCROW 항목이 남아있으면 → payment PROCESSING 유지", async () => {
      const extraEscrow = makeEscrowItem({
        _id: new Types.ObjectId(),
        status: "PENDING_ESCROW",
      });
      const payment = makePayment({
        status: "PROCESSING",
        escrows: [makeEscrowItem(), extraEscrow],
      });
      escrowPaymentModel.findById.mockReturnValue(makeQueryChain(payment));
      userModel.findById
        .mockReturnValueOnce(makeQueryChain(makeBuyerUser()))
        .mockReturnValueOnce(makeQueryChain(makeSellerUser()));

      await service.createXrplEscrow(
        PAYMENT_ID.toString(),
        ESCROW_ID.toString(),
      );

      expect(payment.status).toBe("PROCESSING");
    });

    it("성공 → escrow 상태 ESCROWED, condition/sequence/txHash 저장", async () => {
      const payment = setupActivePayment();
      userModel.findById
        .mockReturnValueOnce(makeQueryChain(makeBuyerUser()))
        .mockReturnValueOnce(makeQueryChain(makeSellerUser()));

      await service.createXrplEscrow(
        PAYMENT_ID.toString(),
        ESCROW_ID.toString(),
      );

      const escrow = payment.escrows[0];
      expect(escrow.status).toBe("ESCROWED");
      expect(escrow.condition).toBe(CONDITION);
      expect(escrow.fulfillment).toBe(ENCRYPTED_FULFILLMENT);
      expect(escrow.xrplSequence).toBe(XRPL_SEQUENCE);
      expect(escrow.txHashCreate).toBe(TX_HASH_CREATE);
      expect(escrow.escrowedAt).toBeInstanceOf(Date);
      expect(payment.save).toHaveBeenCalled();
    });

    it("seed 복호화 후 xrplService에 전달", async () => {
      setupActivePayment();
      userModel.findById
        .mockReturnValueOnce(makeQueryChain(makeBuyerUser()))
        .mockReturnValueOnce(makeQueryChain(makeSellerUser()));

      await service.createXrplEscrow(
        PAYMENT_ID.toString(),
        ESCROW_ID.toString(),
      );

      expect(xrplService.decrypt).toHaveBeenCalledWith(ENCRYPTED_SEED);
      expect(xrplService.createEscrow).toHaveBeenCalledWith(
        expect.objectContaining({ seed: DECRYPTED_SEED }),
        expect.any(String),
        expect.any(Number),
        expect.any(String),
      );
    });
  });

  // ── approveEvent ──────────────────────────────────────────────────────────

  describe("approveEvent", () => {
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
      escrowPaymentModel.findById.mockReturnValue(makeQueryChain(payment));
      return payment;
    }

    it("에스크로가 ESCROWED 상태가 아니면 → EscrowItemMustBeEscrowedException", async () => {
      const payment = makePayment({
        escrows: [makeEscrowItem({ status: "PENDING_ESCROW" })],
      });
      escrowPaymentModel.findById.mockReturnValue(makeQueryChain(payment));

      await expect(
        service.approveEvent(
          PAYMENT_ID.toString(),
          ESCROW_ID.toString(),
          "SHIPMENT_CONFIRMED",
          "buyer",
        ),
      ).rejects.toThrow(EscrowItemMustBeEscrowedException);
    });

    it("존재하지 않는 이벤트 타입 → EventTypeNotFoundException", async () => {
      setupEscrowedPayment();

      await expect(
        service.approveEvent(
          PAYMENT_ID.toString(),
          ESCROW_ID.toString(),
          "UNKNOWN_EVENT",
          "buyer",
        ),
      ).rejects.toThrow(EventTypeNotFoundException);
    });

    it("buyer 중복 승인 → AlreadyApprovedEventException", async () => {
      setupEscrowedPayment({ buyerApproved: true });

      await expect(
        service.approveEvent(
          PAYMENT_ID.toString(),
          ESCROW_ID.toString(),
          "SHIPMENT_CONFIRMED",
          "buyer",
        ),
      ).rejects.toThrow(AlreadyApprovedEventException);
    });

    it("seller 중복 승인 → AlreadyApprovedEventException", async () => {
      setupEscrowedPayment({ sellerApproved: true });

      await expect(
        service.approveEvent(
          PAYMENT_ID.toString(),
          ESCROW_ID.toString(),
          "SHIPMENT_CONFIRMED",
          "seller",
        ),
      ).rejects.toThrow(AlreadyApprovedEventException);
    });

    it("buyer 승인 → buyerApproved=true, 미완료 상태 저장", async () => {
      const payment = setupEscrowedPayment();

      await service.approveEvent(
        PAYMENT_ID.toString(),
        ESCROW_ID.toString(),
        "SHIPMENT_CONFIRMED",
        "buyer",
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
      // releaseEscrow 내부에서 userModel.findById 호출
      userModel.findById.mockReturnValue(makeQueryChain(makeBuyerUser()));

      await service.approveEvent(
        PAYMENT_ID.toString(),
        ESCROW_ID.toString(),
        "SHIPMENT_CONFIRMED",
        "seller",
      );

      const approval = payment.escrows[0].approvals[0];
      expect(approval.completedAt).toBeInstanceOf(Date);
      expect(xrplService.finishEscrow).toHaveBeenCalledWith(
        expect.objectContaining({ seed: DECRYPTED_SEED }),
        "rBuyerAddress123",
        XRPL_SEQUENCE,
        CONDITION,
        PLAIN_FULFILLMENT,
      );
    });

    it("모든 이벤트 완료 → escrow RELEASED, txHashRelease 저장", async () => {
      const payment = setupEscrowedPayment({
        buyerApproved: true,
        buyerApprovedAt: new Date(),
      });
      userModel.findById.mockReturnValue(makeQueryChain(makeBuyerUser()));

      await service.approveEvent(
        PAYMENT_ID.toString(),
        ESCROW_ID.toString(),
        "SHIPMENT_CONFIRMED",
        "seller",
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
      userModel.findById.mockReturnValue(makeQueryChain(makeBuyerUser()));

      await service.approveEvent(
        PAYMENT_ID.toString(),
        ESCROW_ID.toString(),
        "SHIPMENT_CONFIRMED",
        "seller",
      );

      expect(payment.status).toBe("COMPLETED");
    });

    it("EscrowFinish 실패 → escrow 상태 ESCROWED로 롤백", async () => {
      const payment = setupEscrowedPayment({
        buyerApproved: true,
        buyerApprovedAt: new Date(),
      });
      userModel.findById.mockReturnValue(makeQueryChain(makeBuyerUser()));
      xrplService.finishEscrow.mockRejectedValue(
        new Error("XRPL network error"),
      );

      await expect(
        service.approveEvent(
          PAYMENT_ID.toString(),
          ESCROW_ID.toString(),
          "SHIPMENT_CONFIRMED",
          "seller",
        ),
      ).rejects.toThrow("XRPL network error");

      expect(payment.escrows[0].status).toBe("ESCROWED");
    });
  });

  // ── cancelEscrowItem ──────────────────────────────────────────────────────

  describe("cancelEscrowItem", () => {
    it("PENDING_ESCROW 상태 → CANCELLED로 전환", async () => {
      const payment = makePayment();
      escrowPaymentModel.findById.mockReturnValue(makeQueryChain(payment));

      await service.cancelEscrowItem(
        PAYMENT_ID.toString(),
        ESCROW_ID.toString(),
      );

      expect(payment.escrows[0].status).toBe("CANCELLED");
      expect(payment.save).toHaveBeenCalled();
    });

    it("ESCROWED 상태는 취소 불가 → InvalidEscrowCancelStatusException", async () => {
      const payment = makePayment({
        escrows: [makeEscrowItem({ status: "ESCROWED" })],
      });
      escrowPaymentModel.findById.mockReturnValue(makeQueryChain(payment));

      await expect(
        service.cancelEscrowItem(PAYMENT_ID.toString(), ESCROW_ID.toString()),
      ).rejects.toThrow(InvalidEscrowCancelStatusException);
    });

    it("존재하지 않는 결제 → EscrowPaymentNotFoundException", async () => {
      escrowPaymentModel.findById.mockReturnValue(makeQueryChain(null));

      await expect(
        service.cancelEscrowItem(PAYMENT_ID.toString(), ESCROW_ID.toString()),
      ).rejects.toThrow(EscrowPaymentNotFoundException);
    });

    it("존재하지 않는 escrowId → EscrowItemNotFoundException", async () => {
      const payment = makePayment();
      escrowPaymentModel.findById.mockReturnValue(makeQueryChain(payment));

      await expect(
        service.cancelEscrowItem(
          PAYMENT_ID.toString(),
          new Types.ObjectId().toString(),
        ),
      ).rejects.toThrow(EscrowItemNotFoundException);
    });
  });

  // ── getEscrowStatus ───────────────────────────────────────────────────────

  describe("getEscrowStatus", () => {
    it("정상 조회 → escrow 항목 반환", async () => {
      const payment = makePayment();
      escrowPaymentModel.findById.mockReturnValue(makeQueryChain(payment));

      const result = await service.getEscrowStatus(
        PAYMENT_ID.toString(),
        ESCROW_ID.toString(),
      );

      expect(result.label).toBe("초기금");
      expect(result.status).toBe("PENDING_ESCROW");
    });

    it("존재하지 않는 결제 → NotFoundException", async () => {
      escrowPaymentModel.findById.mockReturnValue(makeQueryChain(null));

      await expect(
        service.getEscrowStatus(PAYMENT_ID.toString(), ESCROW_ID.toString()),
      ).rejects.toThrow(EscrowPaymentNotFoundException);
    });

    it("존재하지 않는 escrowId → EscrowItemNotFoundException", async () => {
      const payment = makePayment();
      escrowPaymentModel.findById.mockReturnValue(makeQueryChain(payment));

      await expect(
        service.getEscrowStatus(
          PAYMENT_ID.toString(),
          new Types.ObjectId().toString(),
        ),
      ).rejects.toThrow(EscrowItemNotFoundException);
    });
  });
});
