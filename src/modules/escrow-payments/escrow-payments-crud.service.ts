import { Injectable } from "@nestjs/common";
import { Types } from "mongoose";
import {
  BuyerWalletNotFoundException,
  EscrowPaymentNotFoundException,
  SellerWalletNotFoundException,
  UnauthorizedPaymentActionException,
  WalletUserNotFoundException,
} from "../../common/exceptions";
import { User } from "../users/schemas/user.schema";
import { CreateEscrowPaymentDto } from "./dto/create-escrow-payment.dto";
import { QueryEscrowPaymentDto } from "./dto/query-escrow-payment.dto";
import {
  EscrowPaymentListResponse,
  EscrowPaymentResponse,
} from "./dto/escrow-payment-response.dto";
import { EscrowPaymentRepository } from "./repositories/escrow-payment.repository";
import { UserFacade } from "./repositories/user.facade";

@Injectable()
export class EscrowPaymentsCrudService {
  constructor(
    private readonly escrowPaymentRepo: EscrowPaymentRepository,
    private readonly userFacade: UserFacade,
  ) {}

  /**
   * 에스크로 결제 내역 생성(xrp 결제 X)
   */
  async create(
    dto: CreateEscrowPaymentDto,
    userId: string,
  ): Promise<EscrowPaymentResponse> {
    const creator = await this.userFacade.findByIdLean(userId);
    if (!creator) throw new UnauthorizedPaymentActionException();

    const now = new Date();
    let buyerId: string;
    let buyerName: string;
    let buyerWalletAddress: string | undefined;
    let sellerId: string;
    let sellerName: string;
    let sellerWalletAddress: string | undefined;
    let buyerApproved = false;
    let buyerApprovedAt: Date | undefined;
    let sellerApproved = false;
    let sellerApprovedAt: Date | undefined;

    if (creator.type === "buyer") {
      const seller = await this.userFacade.findByWalletAddressAndType(
        dto.counterpartyWalletAddress,
        "seller",
      );
      if (!seller)
        throw new SellerWalletNotFoundException(dto.counterpartyWalletAddress);

      buyerId = userId;
      buyerName = creator.name;
      buyerWalletAddress = creator.wallet?.address;
      sellerId = (seller as any)._id.toString();
      sellerName = seller.name;
      sellerWalletAddress = seller.wallet?.address;
      buyerApproved = true;
      buyerApprovedAt = now;
    } else if (creator.type === "seller") {
      const buyer = await this.userFacade.findByWalletAddressAndType(
        dto.counterpartyWalletAddress,
        "buyer",
      );
      if (!buyer)
        throw new BuyerWalletNotFoundException(dto.counterpartyWalletAddress);

      buyerId = (buyer as any)._id.toString();
      buyerName = buyer.name;
      buyerWalletAddress = buyer.wallet?.address;
      sellerId = userId;
      sellerName = creator.name;
      sellerWalletAddress = creator.wallet?.address;
      sellerApproved = true;
      sellerApprovedAt = now;
    } else {
      throw new UnauthorizedPaymentActionException();
    }

    if (!buyerWalletAddress || !sellerWalletAddress) {
      throw new UnauthorizedPaymentActionException();
    }

    const totalAmountXrp = dto.escrows.reduce((sum, e) => sum + e.amountXrp, 0);

    const saved = await this.escrowPaymentRepo.create({
      buyerId: new Types.ObjectId(buyerId),
      buyerName,
      buyerWalletAddress,
      sellerId: new Types.ObjectId(sellerId),
      sellerName,
      sellerWalletAddress,
      totalAmountXrp,
      buyerApproved,
      buyerApprovedAt,
      sellerApproved,
      sellerApprovedAt,
      status: "PENDING_APPROVAL",
      currency: dto.currency ?? "XRP",
      memo: dto.memo ?? "",
      escrows: dto.escrows.map((e) => ({
        label: e.label,
        amountXrp: e.amountXrp,
        order: e.order,
        requiredEventTypes: e.requiredEventTypes,
        approvals: e.requiredEventTypes.map((type) => ({
          eventType: type,
          buyerApproved: false,
          sellerApproved: false,
        })),
      })),
    });

    return this.mapToResponse(saved.toObject(), userId);
  }

  /**
   * 사용자의 모든 결제 내역 조회
   */
  async findAll(
    userId: string,
    dto: QueryEscrowPaymentDto,
  ): Promise<EscrowPaymentListResponse> {
    const { status, group, page = 1, limit = 5 } = dto;
    const uid = new Types.ObjectId(userId);

    const filter: Record<string, any> = {
      $or: [{ buyerId: uid }, { sellerId: uid }],
    };

    if (status) {
      filter.status = status;
    } else if (group === "ongoing") {
      filter.status = {
        $in: ["PENDING_APPROVAL", "APPROVED", "PROCESSING", "ACTIVE"],
      };
    } else if (group === "done") {
      filter.status = { $in: ["COMPLETED", "CANCELLED"] };
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.escrowPaymentRepo.findMany(filter, skip, limit),
      this.escrowPaymentRepo.countDocuments(filter),
    ]);

    return {
      data: data.map((item: any) => this.mapToResponse(item, userId)),
      total,
      page,
      limit,
    };
  }

  async findById(id: string, userId: string): Promise<EscrowPaymentResponse> {
    const doc = await this.escrowPaymentRepo.findByIdLean(id);
    if (!doc) throw new EscrowPaymentNotFoundException();

    const isParticipant =
      (doc as any).buyerId.toString() === userId ||
      (doc as any).sellerId.toString() === userId;
    if (!isParticipant) {
      throw new UnauthorizedPaymentActionException();
    }

    return this.mapToResponse(doc, userId);
  }

  /**
   * XRPL 지갑 주소로 사용자 조회
   */
  async findUserByWalletAddress(walletAddress: string): Promise<User> {
    const user = await this.userFacade.findByWalletAddress(walletAddress);
    if (!user) throw new WalletUserNotFoundException(walletAddress);
    return user;
  }

  private mapToResponse(item: any, userId: string): EscrowPaymentResponse {
    const isBuyer = item.buyerId.toString() === userId;
    const myId = isBuyer ? item.buyerId : item.sellerId;
    const partnerId = isBuyer ? item.sellerId : item.buyerId;
    const myName = isBuyer ? item.buyerName : item.sellerName;
    const partnerName = isBuyer ? item.sellerName : item.buyerName;
    const myWalletAddress = isBuyer
      ? item.buyerWalletAddress
      : item.sellerWalletAddress;
    const partnerWalletAddress = isBuyer
      ? item.sellerWalletAddress
      : item.buyerWalletAddress;

    const rest = { ...item };
    delete rest.buyerId;
    delete rest.sellerId;
    delete rest.buyerName;
    delete rest.sellerName;
    delete rest.buyerWalletAddress;
    delete rest.sellerWalletAddress;

    return {
      ...rest,
      myId,
      partnerId,
      myName,
      myWalletAddress,
      partnerName,
      partnerWalletAddress,
    };
  }
}
