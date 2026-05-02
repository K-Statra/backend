import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import * as crypto from "crypto";
import {
  Consultation,
  ConsultationDocument,
  ReqType,
} from "./schemas/consultation.schema";
import { CreateConsultationDto } from "./dto/create-consultation.dto";
import { QueryConsultationDto } from "./dto/query-consultation.dto";
import { UpdateConsultationStatusDto } from "./dto/update-consultation-status.dto";
import {
  UserBuyer,
  UserBuyerDocument,
} from "../users/schemas/user-buyer.schema";
import {
  UserSeller,
  UserSellerDocument,
} from "../users/schemas/user-seller.schema";

@Injectable()
export class ConsultationsService {
  constructor(
    @InjectModel(Consultation.name)
    private readonly consultationModel: Model<ConsultationDocument>,
    @InjectModel(UserBuyer.name)
    private readonly buyerModel: Model<UserBuyerDocument>,
    @InjectModel(UserSeller.name)
    private readonly sellerModel: Model<UserSellerDocument>,
  ) {}

  async create(dto: CreateConsultationDto): Promise<Consultation> {
    const [buyer, seller] = await Promise.all([
      this.buyerModel.findById(dto.buyerId).lean(),
      this.sellerModel.findById(dto.sellerId).lean(),
    ]);

    if (!buyer || !seller) {
      throw new NotFoundException("Buyer or Seller not found");
    }

    const reqType = dto.reqType ?? ReqType.OFFLINE;
    const meetingLink =
      reqType === ReqType.ONLINE
        ? `https://meet.jit.si/K-Statra-Meeting-${crypto.randomBytes(6).toString("hex")}`
        : undefined;
    const boothNumber =
      reqType === ReqType.OFFLINE
        ? `Booth-${Math.floor(Math.random() * 900) + 100}`
        : undefined;

    return this.consultationModel.create({
      buyerId: new Types.ObjectId(dto.buyerId),
      sellerId: new Types.ObjectId(dto.sellerId),
      buyerName: buyer.name,
      sellerName: seller.name,
      reqType,
      date: new Date(dto.date),
      timeSlot: dto.timeSlot,
      message: dto.message,
      meetingLink,
      boothNumber,
    });
  }

  findAll(query: QueryConsultationDto): Promise<Consultation[]> {
    const filter: Record<string, unknown> = {};
    if (query.buyerId) filter.buyerId = new Types.ObjectId(query.buyerId);
    if (query.sellerId) filter.sellerId = new Types.ObjectId(query.sellerId);

    return this.consultationModel
      .find(filter)
      .sort({ date: 1, timeSlot: 1 })
      .lean();
  }

  async updateStatus(
    id: string,
    dto: UpdateConsultationStatusDto,
  ): Promise<Consultation> {
    const doc = await this.consultationModel
      .findByIdAndUpdate(id, { status: dto.status }, { new: true })
      .lean();

    if (!doc) throw new NotFoundException("Consultation not found");
    return doc;
  }
}
