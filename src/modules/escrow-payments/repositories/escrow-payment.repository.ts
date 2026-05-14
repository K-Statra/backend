import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { ClientSession, Model, Types } from "mongoose";
import {
  EscrowPayment,
  EscrowPaymentDocument,
} from "../schemas/escrow-payment.schema";

@Injectable()
export class EscrowPaymentRepository {
  constructor(
    @InjectModel(EscrowPayment.name)
    private readonly model: Model<EscrowPaymentDocument>,
  ) {}

  findById(id: string): Promise<EscrowPaymentDocument | null> {
    return this.model.findById(id).exec();
  }

  findByIdWithFulfillment(id: string): Promise<EscrowPaymentDocument | null> {
    return this.model.findById(id).select("+escrows.fulfillment").exec();
  }

  findByIdLean(id: string): Promise<EscrowPayment | null> {
    return this.model.findById(id).lean().exec();
  }

  save(doc: EscrowPaymentDocument): Promise<EscrowPaymentDocument> {
    return doc.save();
  }

  create(data: Record<string, any>): Promise<EscrowPaymentDocument> {
    return new this.model(data).save();
  }

  findMany(
    filter: Record<string, any>,
    skip: number,
    limit: number,
  ): Promise<EscrowPayment[]> {
    return this.model
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();
  }

  countDocuments(filter: Record<string, any>): Promise<number> {
    return this.model.countDocuments(filter).exec();
  }

  findCancelling(): Promise<EscrowPaymentDocument[]> {
    return this.model.find({ "escrows.status": "CANCELLING" }).exec();
  }

  findStuckSubmitting(cutoff: Date): Promise<EscrowPaymentDocument[]> {
    return this.model
      .find({
        escrows: {
          $elemMatch: { status: "SUBMITTING", submittingAt: { $lt: cutoff } },
        },
      })
      .exec();
  }

  startSession(): Promise<ClientSession> {
    return this.model.db.startSession();
  }

  // APPROVED → PROCESSING (트랜잭션 세션 사용)
  markProcessing(
    paymentId: string,
    session: ClientSession,
  ): Promise<EscrowPaymentDocument | null> {
    return this.model
      .findOneAndUpdate(
        { _id: paymentId, status: "APPROVED" },
        { $set: { status: "PROCESSING" } },
        { session, new: true },
      )
      .exec();
  }

  // payment → ACTIVE
  async markActive(paymentId: string): Promise<void> {
    await this.model
      .findByIdAndUpdate(paymentId, { $set: { status: "ACTIVE" } })
      .exec();
  }

  // PENDING_ESCROW → SUBMITTING + condition/fulfillment 원자적 저장
  preflight(
    paymentId: string,
    escrowId: string,
    condition: string,
    fulfillment: string,
  ): Promise<EscrowPaymentDocument | null> {
    return this.model
      .findOneAndUpdate(
        {
          _id: paymentId,
          escrows: {
            $elemMatch: {
              _id: new Types.ObjectId(escrowId),
              status: "PENDING_ESCROW",
            },
          },
        },
        {
          $set: {
            "escrows.$.status": "SUBMITTING",
            "escrows.$.condition": condition,
            "escrows.$.fulfillment": fulfillment,
            "escrows.$.submittingAt": new Date(),
          },
        },
        { new: true },
      )
      .exec();
  }

  // SUBMITTING → PENDING_ESCROW (XRPL 제출 실패 즉시 복구)
  async revertSubmitting(paymentId: string, escrowId: string): Promise<void> {
    await this.model
      .findOneAndUpdate(
        {
          _id: paymentId,
          escrows: {
            $elemMatch: {
              _id: new Types.ObjectId(escrowId),
              status: "SUBMITTING",
            },
          },
        },
        { $set: { "escrows.$.status": "PENDING_ESCROW" } },
      )
      .exec();
  }

  // SUBMITTING → ESCROWED
  markEscrowed(
    paymentId: string,
    escrowId: string,
    sequence: number,
    txHash: string,
  ): Promise<EscrowPaymentDocument | null> {
    return this.model
      .findOneAndUpdate(
        {
          _id: paymentId,
          escrows: {
            $elemMatch: {
              _id: new Types.ObjectId(escrowId),
              status: "SUBMITTING",
            },
          },
        },
        {
          $set: {
            "escrows.$.status": "ESCROWED",
            "escrows.$.xrplSequence": sequence,
            "escrows.$.txHashCreate": txHash,
            "escrows.$.escrowedAt": new Date(),
          },
        },
        { new: true },
      )
      .exec();
  }

  // SUBMITTING → CANCELLED (recovery: XRPL에 에스크로 없음 확정)
  async cancelSubmittingEscrow(
    paymentId: string,
    escrowId: string,
  ): Promise<void> {
    await this.model
      .findOneAndUpdate(
        {
          _id: paymentId,
          escrows: {
            $elemMatch: {
              _id: new Types.ObjectId(escrowId),
              status: "SUBMITTING",
            },
          },
        },
        { $set: { "escrows.$.status": "CANCELLED" } },
      )
      .exec();
  }
}
