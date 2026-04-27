import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Buyer, BuyerDocument } from "../users/schemas/buyer.schema";
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

    const sort: Record<string, 1 | -1> = { [sortBy]: order === "asc" ? 1 : -1 };
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
}
