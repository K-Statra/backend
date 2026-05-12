import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  BuyerWalletNotFoundException,
  EscrowPaymentNotFoundException,
  SellerWalletNotFoundException,
  UnauthorizedPaymentActionException,
} from "../../common/exceptions";
import {
  EscrowPayment,
  EscrowPaymentDocument,
} from "./schemas/escrow-payment.schema";
import { User, UserDocument } from "../users/schemas/user.schema";
import { CreateEscrowPaymentDto } from "./dto/create-escrow-payment.dto";
import { QueryEscrowPaymentDto } from "./dto/query-escrow-payment.dto";

export interface EscrowPaymentResponse extends Omit<
  EscrowPayment,
  | "buyerId"
  | "sellerId"
  | "buyerName"
  | "sellerName"
  | "buyerWalletAddress"
  | "sellerWalletAddress"
> {
  _id: Types.ObjectId;
  myId: Types.ObjectId;
  partnerId: Types.ObjectId;
  myName: string;
  myWalletAddress: string;
  partnerName: string;
  partnerWalletAddress: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class EscrowPaymentsCrudService {
  constructor(
    @InjectModel(EscrowPayment.name)
    private readonly escrowPaymentModel: Model<EscrowPaymentDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  /**
   * 에스크로 결제 내역 생성(xrp 결제 X)
   */
  async create(
    dto: CreateEscrowPaymentDto,
    userId: string,
  ): Promise<EscrowPaymentDocument> {
    const creator = await this.userModel
      .findById(userId, { type: 1, name: 1, wallet: 1 })
      .lean();
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
      const seller = await this.userModel
        .findOne(
          { "wallet.address": dto.counterpartyWalletAddress, type: "seller" },
          { _id: 1, name: 1, wallet: 1 },
        )
        .lean();
      if (!seller)
        throw new SellerWalletNotFoundException(dto.counterpartyWalletAddress);

      buyerId = userId;
      buyerName = creator.name;
      buyerWalletAddress = creator.wallet?.address;
      sellerId = seller._id.toString();
      sellerName = seller.name;
      sellerWalletAddress = seller.wallet?.address;
      buyerApproved = true;
      buyerApprovedAt = now;
    } else if (creator.type === "seller") {
      const buyer = await this.userModel
        .findOne(
          { "wallet.address": dto.counterpartyWalletAddress, type: "buyer" },
          { _id: 1, name: 1, wallet: 1 },
        )
        .lean();
      if (!buyer)
        throw new BuyerWalletNotFoundException(dto.counterpartyWalletAddress);

      buyerId = buyer._id.toString();
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
      throw new UnauthorizedPaymentActionException(); // Or a more specific exception if wallet is missing
    }

    const totalAmountXrp = dto.escrows.reduce((sum, e) => sum + e.amountXrp, 0);

    const doc = new this.escrowPaymentModel({
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

    return doc.save();
  }

  /**
   * 사용자의 모든 결제 내역 조회
   */
  async findAll(
    userId: string,
    dto: QueryEscrowPaymentDto,
  ): Promise<{
    data: EscrowPaymentResponse[];
    total: number;
    page: number;
    limit: number;
  }> {
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
      this.escrowPaymentModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.escrowPaymentModel.countDocuments(filter),
    ]);

    const mappedData = data.map((item: any) => {
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
    });

    return {
      data: mappedData,
      total,
      page,
      limit,
    };
  }

  async findById(id: string, userId: string): Promise<EscrowPaymentResponse> {
    const doc = await this.escrowPaymentModel.findById(id).lean();
    if (!doc) throw new EscrowPaymentNotFoundException();

    const isParticipant =
      doc.buyerId.toString() === userId || doc.sellerId.toString() === userId;
    if (!isParticipant) {
      throw new UnauthorizedPaymentActionException();
    }

    const isBuyer = doc.buyerId.toString() === userId;
    const myId = isBuyer ? doc.buyerId : doc.sellerId;
    const partnerId = isBuyer ? doc.sellerId : doc.buyerId;
    const myName = isBuyer ? doc.buyerName : doc.sellerName;
    const partnerName = isBuyer ? doc.sellerName : doc.buyerName;
    const myWalletAddress = isBuyer
      ? doc.buyerWalletAddress
      : doc.sellerWalletAddress;
    const partnerWalletAddress = isBuyer
      ? doc.sellerWalletAddress
      : doc.buyerWalletAddress;

    const rest = { ...(doc as any) };
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

  /**
   * XRPL 지갑 주소로 사용자 조회
   */
  async findUserByWalletAddress(walletAddress: string): Promise<UserDocument> {
    const user = await this.userModel
      .findOne({ "wallet.address": walletAddress })
      .lean();
    if (!user) throw new SellerWalletNotFoundException(walletAddress);
    return user;
  }
}
