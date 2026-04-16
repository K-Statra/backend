import { Model } from 'mongoose';
import { Buyer, BuyerDocument } from './schemas/buyer.schema';
import { CreateBuyerDto } from './dto/create-buyer.dto';
import { UpdateBuyerDto } from './dto/update-buyer.dto';
import { QueryBuyerDto } from './dto/query-buyer.dto';
export declare class BuyersService {
    private readonly buyerModel;
    constructor(buyerModel: Model<BuyerDocument>);
    findAll(query: QueryBuyerDto): Promise<{
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        data: (import("mongoose").Document<unknown, {}, BuyerDocument, {}, import("mongoose").DefaultSchemaOptions> & Buyer & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        } & {
            id: string;
        })[];
    }>;
    findById(id: string): Promise<BuyerDocument>;
    create(dto: CreateBuyerDto): Promise<BuyerDocument>;
    update(id: string, dto: UpdateBuyerDto): Promise<BuyerDocument>;
    remove(id: string): Promise<void>;
}
