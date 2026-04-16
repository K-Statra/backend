import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
export declare class PaymentsController {
    private readonly paymentsService;
    constructor(paymentsService: PaymentsService);
    create(dto: CreatePaymentDto, idempotencyKey: string): Promise<import("./schemas/payment.schema").PaymentDocument>;
    getSummary(): Promise<any>;
    getRecent(): Promise<(import("./schemas/payment.schema").Payment & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    })[]>;
    findOne(id: string): Promise<import("./schemas/payment.schema").PaymentDocument>;
    refresh(id: string): Promise<import("./schemas/payment.schema").PaymentDocument>;
}
