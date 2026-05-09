import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { BullModule } from "@nestjs/bull";
import { EscrowPaymentsController } from "./escrow-payments.controller";
import { EscrowPaymentsCrudService } from "./escrow-payments-crud.service";
import { EscrowPaymentsService } from "./escrow-payments.service";
import {
  EscrowPayment,
  EscrowPaymentSchema,
} from "./schemas/escrow-payment.schema";
import { XrplModule } from "../xrpl/xrpl.module";
import { UsersModule } from "../users/users.module";
import { ESCROW_CREATE_QUEUE } from "./escrow-create.constants";
import { EscrowCreateProcessor } from "./escrow-create.processor";
import { EscrowCancelScheduler } from "./escrow-cancel.scheduler";
import { EscrowSubmitRecoveryScheduler } from "./escrow-submit-recovery.scheduler";
import { OutboxModule } from "../outbox/outbox.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EscrowPayment.name, schema: EscrowPaymentSchema },
    ]),
    BullModule.registerQueue({ name: ESCROW_CREATE_QUEUE }),
    XrplModule,
    UsersModule,
    OutboxModule,
  ],
  controllers: [EscrowPaymentsController],
  providers: [
    EscrowPaymentsCrudService,
    EscrowPaymentsService,
    EscrowCreateProcessor,
    EscrowCancelScheduler,
    EscrowSubmitRecoveryScheduler,
  ],
})
export class EscrowPaymentsModule {}
