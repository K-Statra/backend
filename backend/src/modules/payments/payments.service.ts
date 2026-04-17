import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import { Payment, PaymentDocument } from './schemas/payment.schema';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { XrplService } from './xrpl.service';

// 허용된 결제 상태 전이
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  CREATED: ['PENDING', 'CANCELLED'],
  PENDING: ['PAID', 'FAILED', 'CANCELLED'],
  PAID: [],
  FAILED: [],
  CANCELLED: [],
};

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
    private readonly xrplService: XrplService,
  ) {}

  private computeRequestHash(body: CreatePaymentDto): string {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(body))
      .digest('hex');
  }

  private canTransition(from: string, to: string): boolean {
    return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
  }

  async create(
    dto: CreatePaymentDto,
    idempotencyKey: string,
  ): Promise<PaymentDocument> {
    const requestHash = this.computeRequestHash(dto);

    // 중복 요청 처리 (idempotency)
    const existing = await this.paymentModel.findOne({ idempotencyKey }).exec();
    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new ConflictException(
          'Idempotency key conflict: different payload',
        );
      }
      return existing;
    }

    // XRP만 지원 (현재)
    if (dto.currency !== 'XRP') {
      throw new BadRequestException('Only XRP is supported at this time');
    }

    // 결제 생성
    const payment = await this.paymentModel.create({
      buyerId: dto.buyerId,
      companyId: dto.companyId,
      amount: dto.amount,
      currency: dto.currency ?? 'XRP',
      memo: dto.memo ?? '',
      idempotencyKey,
      requestHash,
      provider: 'xrpl-testnet',
      status: 'CREATED',
      events: [{ type: 'CREATED', at: new Date(), meta: { source: 'api' } }],
    });

    // XRPL 인보이스 생성 (deeplink/QR)
    const invoice = this.xrplService.createInvoice(
      payment._id.toString(),
      dto.amount,
    );

    payment.providerRef = invoice.providerRef;
    payment.invoice = {
      qr: invoice.qr,
      deeplink: invoice.deeplink,
      expiresAt: invoice.expiresAt,
      destAddress: invoice.destAddress,
      destTag: invoice.destTag,
    };
    payment.status = 'PENDING';
    payment.events.push({
      type: 'PENDING',
      at: new Date(),
      meta: { providerRef: invoice.providerRef },
    });

    await payment.save();
    return payment;
  }

  async findById(id: string): Promise<PaymentDocument> {
    const doc = await this.paymentModel.findById(id).exec();
    if (!doc) throw new NotFoundException('Payment not found');
    return doc;
  }

  async refreshStatus(id: string): Promise<PaymentDocument> {
    const payment = await this.findById(id);

    if (payment.status !== 'PENDING') return payment;

    if (!payment.invoice?.destTag) {
      throw new BadRequestException('No destination tag on invoice');
    }

    const result = await this.xrplService.checkPayment(
      payment.invoice.destTag,
      payment.amount,
    );

    if (result.paid) {
      if (!this.canTransition(payment.status, 'PAID')) {
        throw new ConflictException(
          `Cannot transition from ${payment.status} to PAID`,
        );
      }
      payment.status = 'PAID';
      payment.providerRef = result.txHash ?? payment.providerRef;
      payment.events.push({
        type: 'PAID',
        at: new Date(),
        meta: { txHash: result.txHash, manual: true },
      });
      await payment.save();
    }

    return payment;
  }

  async getSummary() {
    const [result] = await this.paymentModel.aggregate([
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] } },
          paid: { $sum: { $cond: [{ $eq: ['$status', 'PAID'] }, 1, 0] } },
        },
      },
    ]);

    return result ?? { totalAmount: 0, pending: 0, paid: 0 };
  }

  async getRecent(limit = 10) {
    return this.paymentModel
      .find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('amount currency status memo createdAt companyId')
      .populate('companyId', 'name')
      .lean();
  }
}
