import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Buyer, BuyerDocument } from "./schemas/buyer.schema";
import { CreateBuyerDto } from "./dto/create-buyer.dto";
import { UpdateBuyerDto } from "./dto/update-buyer.dto";
import { QueryBuyerDto } from "./dto/query-buyer.dto";

@Injectable()
export class BuyersService {
  constructor(
    @InjectModel(Buyer.name) private readonly buyerModel: Model<BuyerDocument>,
  ) {}

  async findAll(query: QueryBuyerDto) {
    const {
      q,
      country,
      industry,
      tag,
      page = 1,
      limit = 10,
      sortBy = "updatedAt",
      order = "desc",
    } = query;

    const filter: Record<string, any> = {};
    if (q)
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { profileText: { $regex: q, $options: "i" } },
      ];
    if (country) filter.country = country;
    if (industry) filter.industries = industry;
    if (tag) filter.tags = tag;

    const sort = { [sortBy]: order === "asc" ? 1 : -1 };
    const [items, total] = await Promise.all([
      this.buyerModel
        .find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.buyerModel.countDocuments(filter),
    ]);
    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      data: items,
    };
  }

  async findById(id: string): Promise<BuyerDocument> {
    const doc = await this.buyerModel.findById(id).exec();
    if (!doc) throw new NotFoundException("Buyer not found");
    return doc;
  }

  async create(dto: CreateBuyerDto): Promise<BuyerDocument> {
    return this.buyerModel.create(dto);
  }

  async update(id: string, dto: UpdateBuyerDto): Promise<BuyerDocument> {
    const fields = Object.fromEntries(
      Object.entries(dto).filter(([, v]) => v !== undefined),
    );
    if (Object.keys(fields).length === 0) {
      throw new BadRequestException("수정할 필드를 하나 이상 제공해야 합니다");
    }
    const doc = await this.buyerModel
      .findByIdAndUpdate(
        id,
        { ...fields, updatedAt: new Date() },
        { new: true, runValidators: true },
      )
      .exec();
    if (!doc) throw new NotFoundException("Buyer not found");
    return doc;
  }

  async remove(id: string): Promise<void> {
    const doc = await this.buyerModel.findByIdAndDelete(id).exec();
    if (!doc) throw new NotFoundException("Buyer not found");
  }
}
