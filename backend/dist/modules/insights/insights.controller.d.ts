import { InsightsService } from './insights.service';
export declare class InsightsController {
    private readonly insightsService;
    constructor(insightsService: InsightsService);
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
