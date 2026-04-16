import { Model, Types } from 'mongoose';
import { ConsultantRequestDocument } from './schemas/consultant-request.schema';
import { CreateConsultantRequestDto } from './dto/create-consultant-request.dto';
export declare class ConsultantsService {
    private readonly consultantRequestModel;
    constructor(consultantRequestModel: Model<ConsultantRequestDocument>);
    createRequest(dto: CreateConsultantRequestDto): Promise<{
        id: Types.ObjectId;
        status: string;
        message: string;
    }>;
}
