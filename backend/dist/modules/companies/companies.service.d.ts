import { Model } from 'mongoose';
import { CompanyDocument } from './schemas/company.schema';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { QueryCompanyDto } from './dto/query-company.dto';
export declare class CompaniesService {
    private readonly companyModel;
    constructor(companyModel: Model<CompanyDocument>);
    private static readonly LIST_PROJECTION;
    findAll(query: QueryCompanyDto): Promise<{
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        data: {
            dartVerified: boolean;
            name: string;
            industry: string;
            offerings: string[];
            needs: string[];
            tags: string[];
            profileText: string;
            videoUrl: string;
            location: {
                city: string;
                state: string;
                country: string;
            };
            address: string;
            sizeBucket: string;
            projectsCount: number;
            revenue: number;
            primaryContact: {
                name: string;
                email: string;
            };
            accuracyScore: number;
            matchAnalysis: {
                label: string;
                score: number;
                description: string;
            }[];
            matchRecommendation: string;
            dataSource: string;
            extractedAt: Date;
            images: {
                url: string;
                caption: string;
                alt: string;
                tags: string[];
                clipEmbedding: number[];
            }[];
            products: {
                name: string;
                description: string;
                imageUrl: string;
                catalogUrl: string;
            }[];
            activities: {
                type: string;
                description: string;
                date: Date;
                url: string;
            }[];
            embedding: number[];
            updatedAt: Date;
            _id: import("mongoose").Types.ObjectId;
            $locals: Record<string, unknown>;
            $op: "save" | "validate" | "remove" | null;
            $where: Record<string, unknown>;
            baseModelName?: string;
            collection: import("mongoose").Collection;
            db: import("mongoose").Connection;
            errors?: import("mongoose").Error.ValidationError;
            isNew: boolean;
            schema: import("mongoose").Schema;
            __v: number;
        }[];
    }>;
    findById(id: string): Promise<CompanyDocument>;
    create(dto: CreateCompanyDto): Promise<CompanyDocument>;
    update(id: string, dto: UpdateCompanyDto): Promise<CompanyDocument>;
    remove(id: string): Promise<void>;
}
