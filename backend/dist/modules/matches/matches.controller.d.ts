import { MatchesService } from './matches.service';
import { FindMatchesDto } from './dto/find-matches.dto';
import { SubmitFeedbackDto } from './dto/submit-feedback.dto';
declare class CompanyIdParam {
    companyId: string;
}
export declare class MatchesController {
    private readonly matchesService;
    constructor(matchesService: MatchesService);
    findMatches(dto: FindMatchesDto): Promise<{
        query: {
            buyerId: string;
            limit: number;
        };
        count: number;
        data: {
            score: number;
            reasons: string[];
            company: any;
        }[];
    }>;
    submitFeedback(params: CompanyIdParam, dto: SubmitFeedbackDto): Promise<{
        message: string;
        id: import("mongoose").Types.ObjectId;
    }>;
}
export {};
