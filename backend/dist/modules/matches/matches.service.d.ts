import { Model } from 'mongoose';
import { CompanyDocument } from '../companies/schemas/company.schema';
import { BuyerDocument } from '../buyers/schemas/buyer.schema';
import { MatchLogDocument } from './schemas/match-log.schema';
import { MatchFeedbackDocument } from './schemas/match-feedback.schema';
export declare class MatchesService {
    private readonly companyModel;
    private readonly buyerModel;
    private readonly matchLogModel;
    private readonly feedbackModel;
    private readonly logger;
    constructor(companyModel: Model<CompanyDocument>, buyerModel: Model<BuyerDocument>, matchLogModel: Model<MatchLogDocument>, feedbackModel: Model<MatchFeedbackDocument>);
    findMatches(buyerId: string, limit?: number): Promise<{
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
    submitFeedback(companyId: string, dto: {
        rating: number;
        comments?: string;
        locale?: string;
        source?: string;
    }): Promise<{
        message: string;
        id: import("mongoose").Types.ObjectId;
    }>;
}
