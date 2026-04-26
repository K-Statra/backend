import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Payment, PaymentDocument } from "../payments/schemas/payment.schema";
import { Company, CompanyDocument } from "../companies/schemas/company.schema";
import { Buyer, BuyerDocument } from "../buyers/schemas/buyer.schema";
import {
  MatchLog,
  MatchLogDocument,
} from "../matches/schemas/match-log.schema";
import { AuditLog, AuditLogDocument } from "./schemas/audit-log.schema";
import { ListPaymentsQueryDto } from "./dto/list-payments-query.dto";
import { PaymentStatsQueryDto } from "./dto/payment-stats-query.dto";
import { MatchLogsQueryDto } from "./dto/match-logs-query.dto";
import { AuditLogsQueryDto } from "./dto/audit-logs-query.dto";

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Company.name)
    private readonly companyModel: Model<CompanyDocument>,
    @InjectModel(Buyer.name) private readonly buyerModel: Model<BuyerDocument>,
    @InjectModel(MatchLog.name)
    private readonly matchLogModel: Model<MatchLogDocument>,
    @InjectModel(AuditLog.name)
    private readonly auditLogModel: Model<AuditLogDocument>,
  ) {}

  async getStats() {
    const [companies, buyers, payments, matches] = await Promise.all([
      this.companyModel.countDocuments(),
      this.buyerModel.countDocuments(),
      this.paymentModel.countDocuments(),
      this.matchLogModel.countDocuments(),
    ]);
    return { companies, buyers, payments, matches };
  }

  async getPayments(query: ListPaymentsQueryDto) {
    const {
      status,
      buyerId,
      companyId,
      from,
      to,
      page = 1,
      limit = 20,
    } = query;
    const filter: Record<string, any> = {};
    if (status) filter.status = status;
    if (buyerId) filter.buyerId = buyerId;
    if (companyId) filter.companyId = companyId;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.paymentModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.paymentModel.countDocuments(filter),
    ]);
    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      data: items,
    };
  }

  async getPaymentStats(query: PaymentStatsQueryDto) {
    const { buyerId, companyId } = query;
    const from = query.from
      ? new Date(query.from)
      : new Date(Date.now() - 7 * 86400000);
    const to = query.to ? new Date(query.to) : new Date();

    const match: Record<string, any> = { createdAt: { $gte: from, $lte: to } };
    if (buyerId) match.buyerId = new Types.ObjectId(buyerId);
    if (companyId) match.companyId = new Types.ObjectId(companyId);

    const [byStatusAgg, byCurrencyAgg, byCurrencyStatusAgg] = await Promise.all(
      [
        this.paymentModel.aggregate([
          { $match: match },
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
        this.paymentModel.aggregate([
          { $match: match },
          { $group: { _id: "$currency", count: { $sum: 1 } } },
        ]),
        this.paymentModel.aggregate([
          { $match: match },
          {
            $group: {
              _id: { currency: "$currency", status: "$status" },
              count: { $sum: 1 },
            },
          },
        ]),
      ],
    );

    const byStatus = byStatusAgg.reduce(
      (a, x) => ({ ...a, [String(x._id || "UNKNOWN").toUpperCase()]: x.count }),
      {},
    );
    const byCurrency = byCurrencyAgg.reduce(
      (a, x) => ({ ...a, [String(x._id || "UNKNOWN").toUpperCase()]: x.count }),
      {},
    );
    const byCurrencyStatus: Record<string, Record<string, number>> = {};
    for (const row of byCurrencyStatusAgg) {
      const cur = String(row._id?.currency || "UNKNOWN").toUpperCase();
      const st = String(row._id?.status || "UNKNOWN").toUpperCase();
      byCurrencyStatus[cur] = byCurrencyStatus[cur] ?? {};
      byCurrencyStatus[cur][st] = (byCurrencyStatus[cur][st] ?? 0) + row.count;
    }

    return {
      since: from.toISOString(),
      until: to.toISOString(),
      byStatus,
      byCurrency,
      byCurrencyStatus,
    };
  }

  async exportPaymentsCsv(
    query: Pick<
      ListPaymentsQueryDto,
      "status" | "buyerId" | "companyId" | "from" | "to"
    >,
  ) {
    const filter: Record<string, any> = {};
    if (query.status) filter.status = query.status;
    if (query.buyerId) filter.buyerId = query.buyerId;
    if (query.companyId) filter.companyId = query.companyId;
    if (query.from || query.to) {
      filter.createdAt = {};
      if (query.from) filter.createdAt.$gte = new Date(query.from);
      if (query.to) filter.createdAt.$lte = new Date(query.to);
    }
    const items = await this.paymentModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(5000)
      .exec();
    const header = [
      "_id",
      "buyerId",
      "companyId",
      "amount",
      "currency",
      "status",
      "provider",
      "providerRef",
      "createdAt",
    ];
    const esc = (v: string) => '"' + String(v).replace(/"/g, '""') + '"';
    const lines = [
      header.join(","),
      ...items.map((p) =>
        [
          p._id,
          p.buyerId,
          p.companyId,
          p.amount,
          p.currency,
          p.status,
          p.provider,
          p.providerRef,
          p["createdAt"] ? new Date(p["createdAt"]).toISOString() : "",
        ]
          .map((v) => esc(String(v ?? "")))
          .join(","),
      ),
    ];
    return lines.join("\n") + "\n";
  }

  async getMatchLogs(query: MatchLogsQueryDto) {
    const { buyerId, page = 1, limit = 20 } = query;
    const filter: Record<string, any> = {};
    if (buyerId) filter.buyerId = buyerId;
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.matchLogModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("buyerId", "name")
        .exec(),
      this.matchLogModel.countDocuments(filter),
    ]);
    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      data: items,
    };
  }

  async getAuditLogs(query: AuditLogsQueryDto) {
    const { entityType = "Payment", entityId, page = 1, limit = 50 } = query;
    const skip = (page - 1) * limit;
    const filter = { entityType, entityId };
    const [items, total] = await Promise.all([
      this.auditLogModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.auditLogModel.countDocuments(filter),
    ]);
    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      data: items,
    };
  }

  getEmbeddingStatus() {
    const provider = (process.env.EMBEDDINGS_PROVIDER || "mock").toLowerCase();
    const matchUseEmbedding =
      (process.env.MATCH_USE_EMBEDDING || "false").toLowerCase().trim() ===
      "true";
    const configured =
      provider === "openai"
        ? Boolean(process.env.OPENAI_API_KEY)
        : provider === "huggingface"
          ? Boolean(process.env.HF_API_TOKEN)
          : true;
    return { provider, matchUseEmbedding, configured };
  }
}
