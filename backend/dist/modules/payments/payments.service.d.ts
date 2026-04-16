import { Model } from 'mongoose';
import { Payment, PaymentDocument } from './schemas/payment.schema';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { XrplService } from './xrpl.service';
export declare class PaymentsService {
    private readonly paymentModel;
    private readonly xrplService;
    private readonly logger;
    constructor(paymentModel: Model<PaymentDocument>, xrplService: XrplService);
    private computeRequestHash;
    private canTransition;
    create(dto: CreatePaymentDto, idempotencyKey: string): Promise<PaymentDocument>;
    findById(id: string): Promise<PaymentDocument>;
    refreshStatus(id: string): Promise<PaymentDocument>;
    getSummary(): Promise<any>;
    getRecent(limit?: number): Promise<(Payment & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    })[]>;
}
