import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Buyer, BuyerDocument } from "./schemas/buyer.schema";
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
      page = 1,
      limit = 10,
      sortBy = "updatedAt",
      order = "desc",
    } = query;

    const filter: Record<string, any> = {};
    const andClauses: Record<string, any>[] = [];
    const escapeRegex = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    if (q) {
      const safeQ = escapeRegex(q);
      andClauses.push({
        $or: [
          { name_kr: { $regex: safeQ, $options: "i" } },
          { name_en: { $regex: safeQ, $options: "i" } },
          { intro_kr: { $regex: safeQ, $options: "i" } },
          { intro_en: { $regex: safeQ, $options: "i" } },
        ],
      });
    }
    if (country) filter.country = country;
    if (industry) {
      const safeIndustry = escapeRegex(industry);
      andClauses.push({
        $or: [
          { industry_kr: { $regex: safeIndustry, $options: "i" } },
          { industry_en: { $regex: safeIndustry, $options: "i" } },
        ],
      });
    }

    if (andClauses.length === 1) Object.assign(filter, andClauses[0]);
    if (andClauses.length > 1) filter.$and = andClauses;

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
