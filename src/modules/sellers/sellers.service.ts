import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Seller, SellerDocument } from "./schemas/seller.schema";
import { QuerySellerDto } from "./dto/query-seller.dto";

@Injectable()
export class SellersService {
  constructor(
    @InjectModel(Seller.name)
    private readonly sellerModel: Model<SellerDocument>,
  ) {}

  private static readonly LIST_PROJECTION = {
    name: 1,
    nameEn: 1,
    industry: 1,
    tags: 1,
    location: 1,
    sizeBucket: 1,
    profileText: 1,
    updatedAt: 1,
  };

  async findAll(query: QuerySellerDto) {
    const {
      q,
      industry,
      tag,
      country,
      size,
      partnership,
      page = 1,
      limit = 10,
      sortBy = "updatedAt",
      order = "desc",
    } = query;

    const filter: Record<string, any> = {};
    if (q) filter.$text = { $search: q };
    if (industry) filter.industry = industry;
    if (tag) filter.tags = tag;
    if (country) filter["location.country"] = country;
    if (size) filter.sizeBucket = size;
    if (partnership) filter.tags = partnership;

    const hasFilter = Object.keys(filter).length > 0;
    const sortField = sortBy === "nameNumeric" ? "name" : sortBy;
    const sort: Record<string, 1 | -1> = {
      [sortField]: order === "asc" ? 1 : -1,
    };
    const skip = (page - 1) * limit;

    let findQuery = this.sellerModel
      .find(filter, SellersService.LIST_PROJECTION)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    if (sortBy === "nameNumeric") {
      findQuery = findQuery.collation({ locale: "en", numericOrdering: true });
    }

    const countQuery = hasFilter
      ? this.sellerModel.countDocuments(filter)
      : this.sellerModel.estimatedDocumentCount();

    const [raw, total] = await Promise.all([findQuery.exec(), countQuery]);

    const items = raw;

    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      data: items,
    };
  }
}
