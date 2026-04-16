import { Document, Types } from 'mongoose';
export type MatchFeedbackDocument = MatchFeedback & Document;
export declare class MatchFeedback {
    companyId: Types.ObjectId;
    rating: number;
    comments: string;
    locale: string;
    source: string;
}
export declare const MatchFeedbackSchema: import("mongoose").Schema<MatchFeedback, import("mongoose").Model<MatchFeedback, any, any, any, any, any, MatchFeedback>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, MatchFeedback, Document<unknown, {}, MatchFeedback, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<MatchFeedback & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    companyId?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, MatchFeedback, Document<unknown, {}, MatchFeedback, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<MatchFeedback & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    rating?: import("mongoose").SchemaDefinitionProperty<number, MatchFeedback, Document<unknown, {}, MatchFeedback, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<MatchFeedback & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    comments?: import("mongoose").SchemaDefinitionProperty<string, MatchFeedback, Document<unknown, {}, MatchFeedback, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<MatchFeedback & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    locale?: import("mongoose").SchemaDefinitionProperty<string, MatchFeedback, Document<unknown, {}, MatchFeedback, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<MatchFeedback & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    source?: import("mongoose").SchemaDefinitionProperty<string, MatchFeedback, Document<unknown, {}, MatchFeedback, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<MatchFeedback & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, MatchFeedback>;
