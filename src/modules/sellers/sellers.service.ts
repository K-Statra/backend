import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Seller, SellerDocument } from "./schemas/seller.schema";
import { CreateSellerDto } from "./dto/create-seller.dto";
import { UpdateSellerDto } from "./dto/update-seller.dto";
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

  async findById(id: string): Promise<SellerDocument> {
    const doc = await this.sellerModel.findById(id).exec();
    if (!doc) throw new NotFoundException("Seller not found");
    return doc;
  }

  async create(dto: CreateSellerDto): Promise<SellerDocument> {
    return this.sellerModel.create(dto);
  }

  async update(id: string, dto: UpdateSellerDto): Promise<SellerDocument> {
    const fields = Object.fromEntries(
      Object.entries(dto).filter(([, v]) => v !== undefined),
    );
    if (Object.keys(fields).length === 0) {
      throw new BadRequestException("수정할 필드를 하나 이상 제공해야 합니다");
    }
    const doc = await this.sellerModel
      .findByIdAndUpdate(
        id,
        { ...fields, updatedAt: new Date() },
        { new: true, runValidators: true },
      )
      .exec();
    if (!doc) throw new NotFoundException("Seller not found");
    return doc;
  }

  async remove(id: string): Promise<void> {
    const doc = await this.sellerModel.findByIdAndDelete(id).exec();
    if (!doc) throw new NotFoundException("Seller not found");
  }
}
