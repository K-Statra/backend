import { Document, Types } from 'mongoose';
export type MatchLogDocument = MatchLog & Document;
declare class MatchResult {
    companyId: Types.ObjectId;
    score: number;
    reasons: string[];
}
export declare class MatchLog {
    buyerId: Types.ObjectId;
    params: {
        limit: number;
    };
    results: MatchResult[];
}
export declare const MatchLogSchema: import("mongoose").Schema<MatchLog, import("mongoose").Model<MatchLog, any, any, any, any, any, MatchLog>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, MatchLog, Document<unknown, {}, MatchLog, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<MatchLog & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    buyerId?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, MatchLog, Document<unknown, {}, MatchLog, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<MatchLog & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    params?: import("mongoose").SchemaDefinitionProperty<{
        limit: number;
    }, MatchLog, Document<unknown, {}, MatchLog, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<MatchLog & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    results?: import("mongoose").SchemaDefinitionProperty<MatchResult[], MatchLog, Document<unknown, {}, MatchLog, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<MatchLog & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, MatchLog>;
export {};
