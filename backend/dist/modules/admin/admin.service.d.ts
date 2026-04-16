import { Model, Types } from 'mongoose';
import { Payment, PaymentDocument } from '../payments/schemas/payment.schema';
import { CompanyDocument } from '../companies/schemas/company.schema';
import { BuyerDocument } from '../buyers/schemas/buyer.schema';
import { MatchLog, MatchLogDocument } from '../matches/schemas/match-log.schema';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto';
import { PaymentStatsQueryDto } from './dto/payment-stats-query.dto';
import { MatchLogsQueryDto } from './dto/match-logs-query.dto';
import { AuditLogsQueryDto } from './dto/audit-logs-query.dto';
export declare class AdminService {
    private readonly paymentModel;
    private readonly companyModel;
    private readonly buyerModel;
    private readonly matchLogModel;
    private readonly auditLogModel;
    constructor(paymentModel: Model<PaymentDocument>, companyModel: Model<CompanyDocument>, buyerModel: Model<BuyerDocument>, matchLogModel: Model<MatchLogDocument>, auditLogModel: Model<AuditLogDocument>);
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
        data: (import("mongoose").Document<unknown, {}, PaymentDocument, {}, import("mongoose").DefaultSchemaOptions> & Payment & import("mongoose").Document<Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
            _id: Types.ObjectId;
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
    exportPaymentsCsv(query: Pick<ListPaymentsQueryDto, 'status' | 'buyerId' | 'companyId' | 'from' | 'to'>): Promise<string>;
    getMatchLogs(query: MatchLogsQueryDto): Promise<{
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        data: (import("mongoose").Document<unknown, {}, MatchLogDocument, {}, import("mongoose").DefaultSchemaOptions> & MatchLog & import("mongoose").Document<Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
            _id: Types.ObjectId;
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
        data: (import("mongoose").Document<unknown, {}, AuditLogDocument, {}, import("mongoose").DefaultSchemaOptions> & AuditLog & import("mongoose").Document<Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
            _id: Types.ObjectId;
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
