import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Company, CompanyDocument } from "../users/schemas/company.schema";
import { CreateCompanyDto } from "./dto/create-company.dto";
import { UpdateCompanyDto } from "./dto/update-company.dto";
import { QueryCompanyDto } from "./dto/query-company.dto";

@Injectable()
export class CompaniesService {
  constructor(
    @InjectModel(Company.name)
    private readonly companyModel: Model<CompanyDocument>,
  ) {}

  private static readonly LIST_PROJECTION = {
    name: 1,
    industry: 1,
    tags: 1,
    location: 1,
    sizeBucket: 1,
    companyIntroduction: 1,
    productIntroduction: 1,
    websiteUrl: 1,
    updatedAt: 1,
    contactName: 1,
    email: 1,
  };

  async findAll(query: QueryCompanyDto) {
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

    let findQuery = this.companyModel
      .find(filter, CompaniesService.LIST_PROJECTION)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    if (sortBy === "nameNumeric") {
      findQuery = findQuery.collation({ locale: "en", numericOrdering: true });
    }

    const countQuery = hasFilter
      ? this.companyModel.countDocuments(filter)
      : this.companyModel.estimatedDocumentCount();

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

  async findById(id: string): Promise<CompanyDocument> {
    const doc = await this.companyModel.findById(id).exec();
    if (!doc) throw new NotFoundException("Company not found");
    return doc;
  }

  async create(dto: CreateCompanyDto): Promise<CompanyDocument> {
    return this.companyModel.create(dto);
  }

  async update(id: string, dto: UpdateCompanyDto): Promise<CompanyDocument> {
    const fields = Object.fromEntries(
      Object.entries(dto).filter(([, v]) => v !== undefined),
    );
    if (Object.keys(fields).length === 0) {
      throw new BadRequestException("수정할 필드를 하나 이상 제공해야 합니다");
    }
    const doc = await this.companyModel
      .findByIdAndUpdate(
        id,
        { ...fields, updatedAt: new Date() },
        { new: true, runValidators: true },
      )
      .exec();
    if (!doc) throw new NotFoundException("Company not found");
    return doc;
  }

  async remove(id: string): Promise<void> {
    const doc = await this.companyModel.findByIdAndDelete(id).exec();
    if (!doc) throw new NotFoundException("Company not found");
  }
}
