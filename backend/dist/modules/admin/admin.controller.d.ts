import type { Response } from 'express';
import { AdminService } from './admin.service';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto';
import { PaymentStatsQueryDto } from './dto/payment-stats-query.dto';
import { MatchLogsQueryDto } from './dto/match-logs-query.dto';
import { AuditLogsQueryDto } from './dto/audit-logs-query.dto';
export declare class AdminController {
    private readonly adminService;
    constructor(adminService: AdminService);
    getStats(): Promise<{
        companies: number;
        buyers: number;
        payments: number;
        matches: number;
    }>;
    getPayments(query: ListPaymentsQueryDto): Promise<{
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        data: (import("mongoose").Document<unknown, {}, import("../payments/schemas/payment.schema").PaymentDocument, {}, import("mongoose").DefaultSchemaOptions> & import("../payments/schemas/payment.schema").Payment & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        } & {
            id: string;
        })[];
    }>;
    getPaymentStats(query: PaymentStatsQueryDto): Promise<{
        since: string;
        until: string;
        byStatus: any;
        byCurrency: any;
        byCurrencyStatus: Record<string, Record<string, number>>;
    }>;
    exportPayments(query: ListPaymentsQueryDto, res: Response): Promise<void>;
    getMatchLogs(query: MatchLogsQueryDto): Promise<{
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        data: (import("mongoose").Document<unknown, {}, import("../matches/schemas/match-log.schema").MatchLogDocument, {}, import("mongoose").DefaultSchemaOptions> & import("../matches/schemas/match-log.schema").MatchLog & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        } & {
            id: string;
        })[];
    }>;
    getAuditLogs(query: AuditLogsQueryDto): Promise<{
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        data: (import("mongoose").Document<unknown, {}, import("./schemas/audit-log.schema").AuditLogDocument, {}, import("mongoose").DefaultSchemaOptions> & import("./schemas/audit-log.schema").AuditLog & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        } & {
            id: string;
        })[];
    }>;
    getEmbeddingStatus(): {
        provider: string;
        matchUseEmbedding: boolean;
        configured: boolean;
    };
}
