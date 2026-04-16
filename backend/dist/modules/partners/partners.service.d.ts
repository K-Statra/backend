import { Model } from 'mongoose';
import { Company, CompanyDocument } from '../companies/schemas/company.schema';
import { EmbeddingsService } from '../embeddings/embeddings.service';
export interface SearchOptions {
    q?: string;
    limit?: number;
    industry?: string;
    country?: string;
    partnership?: string;
    size?: string;
    buyerId?: string;
}
export interface SearchResult {
    data: any[];
    aiResponse: string;
    provider: string;
    debug: Record<string, any>;
}
export declare class PartnersService {
    private readonly companyModel;
    private readonly embeddingsService;
    private readonly logger;
    constructor(companyModel: Model<CompanyDocument>, embeddingsService: EmbeddingsService);
    search(opts: SearchOptions): Promise<SearchResult>;
    getDebugInfo(): Promise<{
        status: string;
        env: {
            ATLAS_VECTOR_INDEX: string;
            OPENAI_API_KEY_EXISTS: boolean;
            MONGO_URI_CONFIGURED: boolean;
            NODE_ENV: string | undefined;
        };
        db: {
            status: string;
            companyCount: number;
        };
        embedding: {
            status: string;
            error: string | null;
        };
        sampleData: (Company & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        })[];
        industryStats: any[];
        embeddingCount: number;
    }>;
    private searchWeb;
    private extractSearchIntent;
    private getGraphScores;
}
