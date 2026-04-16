import { PartnersService } from './partners.service';
export declare class PartnersController {
    private readonly partnersService;
    constructor(partnersService: PartnersService);
    search(q?: string, limit?: number, industry?: string, country?: string, partnership?: string, size?: string, buyerId?: string): Promise<import("./partners.service").SearchResult>;
    debug(): Promise<{
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
        sampleData: (import("../companies/schemas/company.schema").Company & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        })[];
        industryStats: any[];
        embeddingCount: number;
    }>;
}
