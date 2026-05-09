import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  EscrowPaymentNotFoundException,
  UnauthorizedPaymentActionException,
} from "../../common/exceptions";
import {
  EscrowPayment,
  EscrowPaymentDocument,
} from "./schemas/escrow-payment.schema";
import { CreateEscrowPaymentDto } from "./dto/create-escrow-payment.dto";
import { QueryEscrowPaymentDto } from "./dto/query-escrow-payment.dto";

@Injectable()
export class EscrowPaymentsCrudService {
  constructor(
    @InjectModel(EscrowPayment.name)
    private readonly escrowPaymentModel: Model<EscrowPaymentDocument>,
  ) {}

  async create(
    dto: CreateEscrowPaymentDto,
    userId: string,
  ): Promise<EscrowPaymentDocument> {
    if (userId !== dto.buyerId && userId !== dto.sellerId) {
      throw new UnauthorizedPaymentActionException();
    }

    const totalAmountXrp = dto.escrows.reduce((sum, e) => sum + e.amountXrp, 0);

    const doc = new this.escrowPaymentModel({
      buyerId: new Types.ObjectId(dto.buyerId),
      sellerId: new Types.ObjectId(dto.sellerId),
      totalAmountXrp,
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
}
