import { Document } from 'mongoose';
export type BuyerDocument = Buyer & Document;
export declare class Buyer {
    name: string;
    country: string;
    industries: string[];
    needs: string[];
    tags: string[];
    profileText: string;
    embedding: number[];
    updatedAt: Date;
}
export declare const BuyerSchema: import("mongoose").Schema<Buyer, import("mongoose").Model<Buyer, any, any, any, any, any, Buyer>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Buyer, Document<unknown, {}, Buyer, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<Buyer & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    name?: import("mongoose").SchemaDefinitionProperty<string, Buyer, Document<unknown, {}, Buyer, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Buyer & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    country?: import("mongoose").SchemaDefinitionProperty<string, Buyer, Document<unknown, {}, Buyer, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Buyer & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    industries?: import("mongoose").SchemaDefinitionProperty<string[], Buyer, Document<unknown, {}, Buyer, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Buyer & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    needs?: import("mongoose").SchemaDefinitionProperty<string[], Buyer, Document<unknown, {}, Buyer, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Buyer & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    tags?: import("mongoose").SchemaDefinitionProperty<string[], Buyer, Document<unknown, {}, Buyer, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Buyer & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    profileText?: import("mongoose").SchemaDefinitionProperty<string, Buyer, Document<unknown, {}, Buyer, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Buyer & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    embedding?: import("mongoose").SchemaDefinitionProperty<number[], Buyer, Document<unknown, {}, Buyer, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Buyer & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    updatedAt?: import("mongoose").SchemaDefinitionProperty<Date, Buyer, Document<unknown, {}, Buyer, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Buyer & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, Buyer>;
