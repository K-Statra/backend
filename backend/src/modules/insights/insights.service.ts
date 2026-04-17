import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Company, CompanyDocument } from '../companies/schemas/company.schema';
import { Payment, PaymentDocument } from '../payments/schemas/payment.schema';

@Injectable()
export class InsightsService {
  constructor(
    @InjectModel(Company.name)
    private readonly companyModel: Model<CompanyDocument>,
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
  ) {}

  async getDashboard() {
    const [totalPartners, activeDeals, pendingPayments, completedDeals] =
      await Promise.all([
        this.companyModel.countDocuments(),
        this.paymentModel.countDocuments({
          status: { $in: ['CREATED', 'PENDING'] },
        }),
        this.paymentModel.countDocuments({ status: 'PENDING' }),
        this.paymentModel.countDocuments({ status: 'PAID' }),
      ]);
    return { totalPartners, activeDeals, pendingPayments, completedDeals };
  }

  async getTopIndustries() {
    const docs = await this.companyModel.aggregate([
      { $match: { industry: { $exists: true, $ne: '' } } },
      {
        $group: {
          _id: '$industry',
          partners: { $sum: 1 },
          revenue: { $sum: '$revenue' },
        },
      },
      { $sort: { partners: -1 } },
      { $limit: 5 },
    ]);
    return docs.map((d) => ({
      name: d._id,
      partners: d.partners,
      revenue: d.revenue,
    }));
  }

  async getRecentTransactions() {
    const docs = await this.paymentModel
      .find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('amount currency status memo createdAt companyId')
      .populate('companyId', 'name')
      .lean();
    return docs.map((d: any) => ({
      id: d._id,
      company: d.companyId?.name || 'Unknown',
      amount: d.amount,
      currency: d.currency,
      status: d.status,
      memo: d.memo,
      createdAt: d.createdAt,
    }));
  }
}
