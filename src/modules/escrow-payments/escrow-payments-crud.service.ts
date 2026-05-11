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

export interface EscrowPaymentWithPartner extends Omit<
  EscrowPayment,
  "buyerId" | "sellerId"
> {
  _id: Types.ObjectId;
  buyerId: Types.ObjectId;
  sellerId: Types.ObjectId;
  partnerName: string;
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

  async create(
    dto: CreateEscrowPaymentDto,
    userId: string,
  ): Promise<EscrowPaymentDocument> {
    const creator = await this.userModel
      .findById(userId, { type: 1, name: 1 })
      .lean();
    if (!creator) throw new UnauthorizedPaymentActionException();

    const now = new Date();
    let buyerId: string;
    let buyerName: string;
    let sellerId: string;
    let sellerName: string;
    let buyerApproved = false;
    let buyerApprovedAt: Date | undefined;
    let sellerApproved = false;
    let sellerApprovedAt: Date | undefined;

    if (creator.type === "buyer") {
      const seller = await this.userModel
        .findOne(
          { "wallet.address": dto.counterpartyWalletAddress, type: "seller" },
          { _id: 1, name: 1 },
        )
        .lean();
      if (!seller)
        throw new SellerWalletNotFoundException(dto.counterpartyWalletAddress);

      buyerId = userId;
      buyerName = creator.name;
      sellerId = seller._id.toString();
      sellerName = seller.name;
      buyerApproved = true;
      buyerApprovedAt = now;
    } else if (creator.type === "seller") {
      const buyer = await this.userModel
        .findOne(
          { "wallet.address": dto.counterpartyWalletAddress, type: "buyer" },
          { _id: 1, name: 1 },
        )
        .lean();
      if (!buyer)
        throw new BuyerWalletNotFoundException(dto.counterpartyWalletAddress);

      buyerId = buyer._id.toString();
      buyerName = buyer.name;
      sellerId = userId;
      sellerName = creator.name;
      sellerApproved = true;
      sellerApprovedAt = now;
    } else {
      throw new UnauthorizedPaymentActionException();
    }

    const totalAmountXrp = dto.escrows.reduce((sum, e) => sum + e.amountXrp, 0);

    const doc = new this.escrowPaymentModel({
      buyerId: new Types.ObjectId(buyerId),
      buyerName,
      sellerId: new Types.ObjectId(sellerId),
      sellerName,
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

  async findAll(
    userId: string,
    dto: QueryEscrowPaymentDto,
  ): Promise<{
    data: EscrowPaymentWithPartner[];
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
      const partnerName = isBuyer ? item.sellerName : item.buyerName;
      return {
        ...item,
        partnerName,
      };
    });

    return {
      data: mappedData,
      total,
      page,
      limit,
    };
  }

  async findById(id: string, userId: string): Promise<EscrowPaymentDocument> {
    const doc = await this.escrowPaymentModel.findById(id).lean();
    if (!doc) throw new EscrowPaymentNotFoundException();

    const isParticipant =
      doc.buyerId.toString() === userId || doc.sellerId.toString() === userId;
    if (!isParticipant) {
      throw new UnauthorizedPaymentActionException();
    }

    return doc;
  }

  async findUserByWalletAddress(walletAddress: string): Promise<UserDocument> {
    const user = await this.userModel
      .findOne({ "wallet.address": walletAddress })
      .lean();
    if (!user) throw new SellerWalletNotFoundException(walletAddress);
    return user;
  }
}
