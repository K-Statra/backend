import { ConsultantsService } from './consultants.service';
import { CreateConsultantRequestDto } from './dto/create-consultant-request.dto';
export declare class ConsultantsController {
    private readonly consultantsService;
    constructor(consultantsService: ConsultantsService);
    createRequest(dto: CreateConsultantRequestDto): Promise<{
        id: import("mongoose").Types.ObjectId;
        status: string;
        message: string;
    }>;
}
