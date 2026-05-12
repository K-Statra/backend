import { Test } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { Types } from "mongoose";
import { EscrowPaymentsCrudService } from "../escrow-payments-crud.service";
import { EscrowPaymentsService } from "../escrow-payments.service";
import { EscrowCreateProcessor } from "../escrow-create.processor";
import { EscrowPayment } from "../schemas/escrow-payment.schema";
import { User } from "../../users/schemas/user.schema";
import { XrplService } from "../../xrpl/xrpl.service";
import { OutboxService } from "../../outbox/outbox.service";

// ── 공통 상수 ──────────────────────────────────────────────────────────────────

export const BUYER_ID = new Types.ObjectId();
export const SELLER_ID = new Types.ObjectId();
export const ESCROW_ID = new Types.ObjectId();
export const PAYMENT_ID = new Types.ObjectId();

export const ENCRYPTED_SEED = "iv:tag:encryptedSeed";
export const DECRYPTED_SEED = "sTestSeed";
export const PLAIN_FULFILLMENT = "A02280200".padEnd(72, "0");
export const ENCRYPTED_FULFILLMENT = "iv:tag:encryptedFulfillment";
export const CONDITION = "A02580200".padEnd(78, "0");
export const TX_HASH_CREATE = "CREATE_TX_HASH_ABC";
export const TX_HASH_FINISH = "FINISH_TX_HASH_XYZ";
export const XRPL_SEQUENCE = 42;

// ── 픽스처 헬퍼 ───────────────────────────────────────────────────────────────

export function makeQueryChain(value: any) {
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

export function makeApproval(eventType: string, overrides: object = {}) {
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

export function makeEscrowItem(overrides: object = {}) {
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
    submittingAt: undefined as Date | undefined,
    txHashCreate: undefined as string | undefined,
    txHashRelease: undefined as string | undefined,
    escrowedAt: undefined as Date | undefined,
    releasedAt: undefined as Date | undefined,
    ...overrides,
  };
}

export function makePayment(overrides: object = {}) {
  const doc: any = {
    _id: PAYMENT_ID,
    buyerId: BUYER_ID,
    buyerName: "Default Buyer Corp",
    buyerWalletAddress: "rBuyerAddress123",
    sellerId: SELLER_ID,
    sellerName: "Default Seller Corp",
    sellerWalletAddress: "rSellerAddress456",
    totalAmountXrp: 300,
    status: "PENDING_APPROVAL",
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

export function makeBuyerUser() {
  return {
    _id: BUYER_ID,
    wallet: {
      address: "rBuyerAddress123",
      seed: ENCRYPTED_SEED,
      publicKey: "buyerPublicKey",
    },
  };
}

export function makeSellerUser() {
  return {
    _id: SELLER_ID,
    wallet: { address: "rSellerAddress456", publicKey: "sellerPublicKey" },
  };
}

// ── 모킹 팩토리 ───────────────────────────────────────────────────────────────

export function makeEscrowPaymentModelMock() {
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
  ModelMock.findOneAndUpdate = jest.fn().mockResolvedValue(null);
  ModelMock.findByIdAndUpdate = jest.fn().mockResolvedValue(null);
  ModelMock.db = { startSession: jest.fn().mockResolvedValue(session) };
  return ModelMock;
}

export function makeUserModelMock() {
  const ModelMock: any = jest.fn();
  ModelMock.findById = jest.fn().mockReturnValue(makeQueryChain(null));
  ModelMock.findOne = jest.fn().mockReturnValue(makeQueryChain(null));
  return ModelMock;
}

export function makeXrplServiceMock() {
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
    findEscrowByCondition: jest.fn().mockResolvedValue(null),
  };
}

export function makeOutboxServiceMock() {
  return {
    createPendingEvent: jest.fn().mockResolvedValue(undefined),
  };
}

// ── NestJS 테스팅 모듈 ────────────────────────────────────────────────────────

export async function makeCrudServiceTestingModule() {
  const escrowPaymentModel = makeEscrowPaymentModelMock();
  const userModel = makeUserModelMock();

  const module = await Test.createTestingModule({
    providers: [
      EscrowPaymentsCrudService,
      {
        provide: getModelToken(EscrowPayment.name),
        useValue: escrowPaymentModel,
      },
      { provide: getModelToken(User.name), useValue: userModel },
    ],
  }).compile();

  return {
    service: module.get<EscrowPaymentsCrudService>(EscrowPaymentsCrudService),
    escrowPaymentModel,
    userModel,
  };
}

export async function makeProcessorTestingModule() {
  const escrowPaymentModel = makeEscrowPaymentModelMock();
  const userModel = makeUserModelMock();
  const xrplService = makeXrplServiceMock();
  const escrowPaymentsService = {
    getEscrowStatus: jest.fn(),
    rollbackAllEscrows: jest.fn().mockResolvedValue(undefined),
  };

  const module = await Test.createTestingModule({
    providers: [
      EscrowCreateProcessor,
      {
        provide: getModelToken(EscrowPayment.name),
        useValue: escrowPaymentModel,
      },
      { provide: getModelToken(User.name), useValue: userModel },
      { provide: XrplService, useValue: xrplService },
      { provide: EscrowPaymentsService, useValue: escrowPaymentsService },
    ],
  }).compile();

  return {
    processor: module.get<EscrowCreateProcessor>(EscrowCreateProcessor),
    escrowPaymentModel,
    userModel,
    xrplService,
    escrowPaymentsService,
  };
}

export async function makeServiceTestingModule() {
  const escrowPaymentModel = makeEscrowPaymentModelMock();
  const userModel = makeUserModelMock();
  const xrplService = makeXrplServiceMock();
  const outboxService = makeOutboxServiceMock();

  const module = await Test.createTestingModule({
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

  return {
    service: module.get<EscrowPaymentsService>(EscrowPaymentsService),
    escrowPaymentModel,
    userModel,
    xrplService,
    outboxService,
  };
}
