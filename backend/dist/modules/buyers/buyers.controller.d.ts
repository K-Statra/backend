import { BuyersService } from './buyers.service';
import { CreateBuyerDto } from './dto/create-buyer.dto';
import { UpdateBuyerDto } from './dto/update-buyer.dto';
import { QueryBuyerDto } from './dto/query-buyer.dto';
export declare class BuyersController {
    private readonly buyersService;
    constructor(buyersService: BuyersService);
    findAll(query: QueryBuyerDto): Promise<{
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        data: (import("mongoose").Document<unknown, {}, import("./schemas/buyer.schema").BuyerDocument, {}, import("mongoose").DefaultSchemaOptions> & import("./schemas/buyer.schema").Buyer & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        } & {
            id: string;
        })[];
    }>;
    findOne(id: string): Promise<import("./schemas/buyer.schema").BuyerDocument>;
    create(dto: CreateBuyerDto): Promise<import("./schemas/buyer.schema").BuyerDocument>;
    update(id: string, dto: UpdateBuyerDto): Promise<import("./schemas/buyer.schema").BuyerDocument>;
    remove(id: string): Promise<void>;
}
