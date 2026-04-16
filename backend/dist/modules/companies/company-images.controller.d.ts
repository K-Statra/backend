import { CompanyImagesService } from './company-images.service';
import { UploadImageDto } from './dto/upload-image.dto';
export declare class CompanyImagesController {
    private readonly companyImagesService;
    constructor(companyImagesService: CompanyImagesService);
    getImages(companyId: string): Promise<{
        url: string;
        caption: string;
        alt: string;
        tags: string[];
        clipEmbedding: number[];
    }[]>;
    addImage(companyId: string, file: Express.Multer.File | undefined, body: UploadImageDto): Promise<{
        url: string;
        caption: string;
        alt: string;
        tags: string[];
        clipEmbedding: number[];
    }>;
    removeImage(companyId: string, imageId: string): Promise<void>;
}
