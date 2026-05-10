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
    const creator = await this.userModel.findById(userId, { type: 1 }).lean();
    if (!creator) throw new UnauthorizedPaymentActionException();

    const now = new Date();
    let buyerId: string;
    let sellerId: string;
    let buyerApproved = false;
    let buyerApprovedAt: Date | undefined;
    let sellerApproved = false;
    let sellerApprovedAt: Date | undefined;

    if (creator.type === "buyer") {
      const seller = await this.userModel
        .findOne(
          { "wallet.address": dto.counterpartyWalletAddress, type: "seller" },
          { _id: 1 },
        )
        .lean();
      if (!seller)
        throw new SellerWalletNotFoundException(dto.counterpartyWalletAddress);

      buyerId = userId;
      sellerId = seller._id.toString();
      buyerApproved = true;
      buyerApprovedAt = now;
    } else if (creator.type === "seller") {
      const buyer = await this.userModel
        .findOne(
          { "wallet.address": dto.counterpartyWalletAddress, type: "buyer" },
          { _id: 1 },
        )
        .lean();
      if (!buyer)
        throw new BuyerWalletNotFoundException(dto.counterpartyWalletAddress);

      buyerId = buyer._id.toString();
      sellerId = userId;
      sellerApproved = true;
      sellerApprovedAt = now;
    } else {
      throw new UnauthorizedPaymentActionException();
    }

    const totalAmountXrp = dto.escrows.reduce((sum, e) => sum + e.amountXrp, 0);

    const doc = new this.escrowPaymentModel({
      buyerId: new Types.ObjectId(buyerId),
      sellerId: new Types.ObjectId(sellerId),
      totalAmountXrp,
      buyerApproved,
      buyerApprovedAt,
      sellerApproved,
      sellerApprovedAt,
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
    data: EscrowPaymentDocument[];
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
        $in: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "PROCESSING", "ACTIVE"],
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

    return {
      data: data as unknown as EscrowPaymentDocument[],
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
