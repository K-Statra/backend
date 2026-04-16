import { Model } from 'mongoose';
import { CompanyDocument } from '../companies/schemas/company.schema';
import { PaymentDocument } from '../payments/schemas/payment.schema';
export declare class InsightsService {
    private readonly companyModel;
    private readonly paymentModel;
    constructor(companyModel: Model<CompanyDocument>, paymentModel: Model<PaymentDocument>);
    getDashboard(): Promise<{
        totalPartners: number;
        activeDeals: number;
        pendingPayments: number;
        completedDeals: number;
    }>;
    getTopIndustries(): Promise<{
        name: any;
        partners: any;
        revenue: any;
    }[]>;
    getRecentTransactions(): Promise<{
        id: any;
        company: any;
        amount: any;
        currency: any;
        status: any;
        memo: any;
        createdAt: any;
    }[]>;
}
