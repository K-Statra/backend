import { Document, Types } from 'mongoose';
export type ConsultantRequestDocument = ConsultantRequest & Document;
export declare class ConsultantRequest {
    name: string;
    email: string;
    details: string;
    serviceType: string;
    locale: string;
    source: string;
    status: string;
    buyerId: Types.ObjectId;
    buyerName: string;
    searchTerm: string;
    filters: Record<string, any>;
}
export declare const ConsultantRequestSchema: import("mongoose").Schema<ConsultantRequest, import("mongoose").Model<ConsultantRequest, any, any, any, any, any, ConsultantRequest>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, ConsultantRequest, Document<unknown, {}, ConsultantRequest, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<ConsultantRequest & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    name?: import("mongoose").SchemaDefinitionProperty<string, ConsultantRequest, Document<unknown, {}, ConsultantRequest, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ConsultantRequest & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    email?: import("mongoose").SchemaDefinitionProperty<string, ConsultantRequest, Document<unknown, {}, ConsultantRequest, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ConsultantRequest & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    details?: import("mongoose").SchemaDefinitionProperty<string, ConsultantRequest, Document<unknown, {}, ConsultantRequest, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ConsultantRequest & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    serviceType?: import("mongoose").SchemaDefinitionProperty<string, ConsultantRequest, Document<unknown, {}, ConsultantRequest, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ConsultantRequest & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    locale?: import("mongoose").SchemaDefinitionProperty<string, ConsultantRequest, Document<unknown, {}, ConsultantRequest, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ConsultantRequest & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    source?: import("mongoose").SchemaDefinitionProperty<string, ConsultantRequest, Document<unknown, {}, ConsultantRequest, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ConsultantRequest & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    status?: import("mongoose").SchemaDefinitionProperty<string, ConsultantRequest, Document<unknown, {}, ConsultantRequest, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ConsultantRequest & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    buyerId?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, ConsultantRequest, Document<unknown, {}, ConsultantRequest, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ConsultantRequest & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    buyerName?: import("mongoose").SchemaDefinitionProperty<string, ConsultantRequest, Document<unknown, {}, ConsultantRequest, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ConsultantRequest & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    searchTerm?: import("mongoose").SchemaDefinitionProperty<string, ConsultantRequest, Document<unknown, {}, ConsultantRequest, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ConsultantRequest & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    filters?: import("mongoose").SchemaDefinitionProperty<Record<string, any>, ConsultantRequest, Document<unknown, {}, ConsultantRequest, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<ConsultantRequest & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, ConsultantRequest>;
