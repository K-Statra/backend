import { Document } from 'mongoose';
export type CompanyDocument = Company & Document;
declare class MatchAnalysisItem {
    label: string;
    score: number;
    description: string;
}
declare class CompanyImage {
    url: string;
    caption: string;
    alt: string;
    tags: string[];
    clipEmbedding: number[];
}
declare class Product {
    name: string;
    description: string;
    imageUrl: string;
    catalogUrl: string;
}
declare class Activity {
    type: string;
    description: string;
    date: Date;
    url: string;
}
declare class DartInfo {
    corpCode: string;
    bizRegistrationNum: string;
    fiscalYear: string;
    reportDate: Date;
    reportType: string;
    isIFRS: boolean;
    revenueConsolidated: number;
    operatingProfitConsolidated: number;
    netIncomeConsolidated: number;
    revenueSeparate: number;
    operatingProfitSeparate: number;
    netIncomeSeparate: number;
    source: string;
    lastUpdated: Date;
}
export declare class Company {
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
    matchAnalysis: MatchAnalysisItem[];
    matchRecommendation: string;
    dataSource: string;
    extractedAt: Date;
    images: CompanyImage[];
    products: Product[];
    activities: Activity[];
    dart: DartInfo;
    embedding: number[];
    updatedAt: Date;
}
export declare const CompanySchema: import("mongoose").Schema<Company, import("mongoose").Model<Company, any, any, any, any, any, Company>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Company, Document<unknown, {}, Company, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<Company & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    name?: import("mongoose").SchemaDefinitionProperty<string, Company, Document<unknown, {}, Company, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Company & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    industry?: import("mongoose").SchemaDefinitionProperty<string, Company, Document<unknown, {}, Company, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Company & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    offerings?: import("mongoose").SchemaDefinitionProperty<string[], Company, Document<unknown, {}, Company, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Company & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    needs?: import("mongoose").SchemaDefinitionProperty<string[], Company, Document<unknown, {}, Company, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Company & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    tags?: import("mongoose").SchemaDefinitionProperty<string[], Company, Document<unknown, {}, Company, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Company & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    profileText?: import("mongoose").SchemaDefinitionProperty<string, Company, Document<unknown, {}, Company, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Company & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    videoUrl?: import("mongoose").SchemaDefinitionProperty<string, Company, Document<unknown, {}, Company, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Company & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    location?: import("mongoose").SchemaDefinitionProperty<{
        city: string;
        state: string;
        country: string;
    }, Company, Document<unknown, {}, Company, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Company & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    address?: import("mongoose").SchemaDefinitionProperty<string, Company, Document<unknown, {}, Company, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Company & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    sizeBucket?: import("mongoose").SchemaDefinitionProperty<string, Company, Document<unknown, {}, Company, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Company & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    projectsCount?: import("mongoose").SchemaDefinitionProperty<number, Company, Document<unknown, {}, Company, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Company & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    revenue?: import("mongoose").SchemaDefinitionProperty<number, Company, Document<unknown, {}, Company, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Company & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    primaryContact?: import("mongoose").SchemaDefinitionProperty<{
        name: string;
        email: string;
    }, Company, Document<unknown, {}, Company, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Company & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    accuracyScore?: import("mongoose").SchemaDefinitionProperty<number, Company, Document<unknown, {}, Company, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Company & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    matchAnalysis?: import("mongoose").SchemaDefinitionProperty<MatchAnalysisItem[], Company, Document<unknown, {}, Company, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Company & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    matchRecommendation?: import("mongoose").SchemaDefinitionProperty<string, Company, Document<unknown, {}, Company, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Company & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    dataSource?: import("mongoose").SchemaDefinitionProperty<string, Company, Document<unknown, {}, Company, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Company & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    extractedAt?: import("mongoose").SchemaDefinitionProperty<Date, Company, Document<unknown, {}, Company, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Company & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    images?: import("mongoose").SchemaDefinitionProperty<CompanyImage[], Company, Document<unknown, {}, Company, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Company & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    products?: import("mongoose").SchemaDefinitionProperty<Product[], Company, Document<unknown, {}, Company, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Company & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    activities?: import("mongoose").SchemaDefinitionProperty<Activity[], Company, Document<unknown, {}, Company, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Company & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    dart?: import("mongoose").SchemaDefinitionProperty<DartInfo, Company, Document<unknown, {}, Company, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Company & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    embedding?: import("mongoose").SchemaDefinitionProperty<number[], Company, Document<unknown, {}, Company, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Company & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    updatedAt?: import("mongoose").SchemaDefinitionProperty<Date, Company, Document<unknown, {}, Company, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Company & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, Company>;
export {};
