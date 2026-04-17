import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ConsultantRequest,
  ConsultantRequestDocument,
} from './schemas/consultant-request.schema';
import { CreateConsultantRequestDto } from './dto/create-consultant-request.dto';

@Injectable()
export class ConsultantsService {
  constructor(
    @InjectModel(ConsultantRequest.name)
    private readonly consultantRequestModel: Model<ConsultantRequestDocument>,
  ) {}

  async createRequest(dto: CreateConsultantRequestDto) {
    const doc: Partial<ConsultantRequest> & { buyerId?: Types.ObjectId } = {
      name: dto.name,
      email: dto.email,
      details: dto.details,
      serviceType: dto.serviceType ?? 'matching-assistant',
      locale: dto.locale,
      source: dto.source ?? 'partner-search',
      buyerName: dto.buyerName,
      searchTerm: dto.searchTerm,
      filters: dto.filters ?? {},
    };

    if (dto.buyerId) {
      if (!Types.ObjectId.isValid(dto.buyerId)) {
        throw new BadRequestException('Invalid buyerId');
      }
      doc.buyerId = new Types.ObjectId(dto.buyerId);
    }

    const created = await this.consultantRequestModel.create(doc);
    return {
      id: created._id,
      status: created.status,
      message: 'Request received',
    };
  }
}
