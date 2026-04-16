import { Model } from 'mongoose';
import { CompanyDocument } from './schemas/company.schema';
export declare class CompanyImagesService {
    private readonly companyModel;
    constructor(companyModel: Model<CompanyDocument>);
    getImages(companyId: string): Promise<{
        url: string;
        caption: string;
        alt: string;
        tags: string[];
        clipEmbedding: number[];
    }[]>;
    addImage(companyId: string, data: {
        url: string;
        caption?: string;
        alt?: string;
        tags?: string[];
    }): Promise<{
        url: string;
        caption: string;
        alt: string;
        tags: string[];
        clipEmbedding: number[];
    }>;
    removeImage(companyId: string, imageId: string): Promise<void>;
}
