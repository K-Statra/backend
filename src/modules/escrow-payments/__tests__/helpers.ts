import { Test } from "@nestjs/testing";
import { Types } from "mongoose";
import { EscrowPaymentsCrudService } from "../escrow-payments-crud.service";
import { EscrowPaymentsService } from "../escrow-payments.service";
import { EscrowCreateProcessor } from "../escrow-create.processor";
import { EscrowPaymentRepository } from "../repositories/escrow-payment.repository";
import { UserFacade } from "../repositories/user.facade";
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
  doc.toObject = jest.fn().mockReturnValue(doc);
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

export function makeEscrowPaymentRepoMock() {
  const session = {
    withTransaction: jest
      .fn()
      .mockImplementation((fn: () => Promise<void>) => fn()),
    endSession: jest.fn().mockResolvedValue(undefined),
  };

  return {
    findById: jest.fn().mockResolvedValue(null),
    findByIdWithFulfillment: jest.fn().mockResolvedValue(null),
    findByIdLean: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockImplementation((doc: any) => Promise.resolve(doc)),
    create: jest.fn().mockResolvedValue(makePayment()),
    findMany: jest.fn().mockResolvedValue([]),
    countDocuments: jest.fn().mockResolvedValue(0),
    findCancelling: jest.fn().mockResolvedValue([]),
    findStuckSubmitting: jest.fn().mockResolvedValue([]),
    startSession: jest.fn().mockResolvedValue(session),
    markProcessing: jest.fn().mockResolvedValue(null),
    markActive: jest.fn().mockResolvedValue(undefined),
    preflight: jest.fn().mockResolvedValue(null),
    revertSubmitting: jest.fn().mockResolvedValue(undefined),
    markEscrowed: jest.fn().mockResolvedValue(null),
    cancelSubmittingEscrow: jest.fn().mockResolvedValue(undefined),
  };
}

export function makeUserFacadeMock() {
  return {
    findById: jest.fn().mockResolvedValue(null),
    findByIdLean: jest.fn().mockResolvedValue(null),
    findByIdWithSeed: jest.fn().mockResolvedValue(null),
    findByWalletAddressAndType: jest.fn().mockResolvedValue(null),
    findByWalletAddress: jest.fn().mockResolvedValue(null),
  };
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
  const escrowPaymentRepo = makeEscrowPaymentRepoMock();
  const userFacade = makeUserFacadeMock();

  const module = await Test.createTestingModule({
    providers: [
      EscrowPaymentsCrudService,
      { provide: EscrowPaymentRepository, useValue: escrowPaymentRepo },
      { provide: UserFacade, useValue: userFacade },
    ],
  }).compile();

  return {
    service: module.get<EscrowPaymentsCrudService>(EscrowPaymentsCrudService),
    escrowPaymentRepo,
    userFacade,
  };
}

export async function makeProcessorTestingModule() {
  const escrowPaymentRepo = makeEscrowPaymentRepoMock();
  const userFacade = makeUserFacadeMock();
  const xrplService = makeXrplServiceMock();
  const escrowPaymentsService = {
    getEscrowStatus: jest.fn(),
    rollbackAllEscrows: jest.fn().mockResolvedValue(undefined),
  };

  const module = await Test.createTestingModule({
    providers: [
      EscrowCreateProcessor,
      { provide: EscrowPaymentRepository, useValue: escrowPaymentRepo },
      { provide: UserFacade, useValue: userFacade },
      { provide: XrplService, useValue: xrplService },
      { provide: EscrowPaymentsService, useValue: escrowPaymentsService },
    ],
  }).compile();

  return {
    processor: module.get<EscrowCreateProcessor>(EscrowCreateProcessor),
    escrowPaymentRepo,
    userFacade,
    xrplService,
    escrowPaymentsService,
  };
}

export async function makeServiceTestingModule() {
  const escrowPaymentRepo = makeEscrowPaymentRepoMock();
  const userFacade = makeUserFacadeMock();
  const xrplService = makeXrplServiceMock();
  const outboxService = makeOutboxServiceMock();

  const module = await Test.createTestingModule({
    providers: [
      EscrowPaymentsService,
      { provide: EscrowPaymentRepository, useValue: escrowPaymentRepo },
      { provide: UserFacade, useValue: userFacade },
      { provide: XrplService, useValue: xrplService },
      { provide: OutboxService, useValue: outboxService },
    ],
  }).compile();

  return {
    service: module.get<EscrowPaymentsService>(EscrowPaymentsService),
    escrowPaymentRepo,
    userFacade,
    xrplService,
    outboxService,
  };
}
