export const ESCROW_CREATE_QUEUE = "escrow-create";

export interface EscrowCreateJobData {
  paymentId: string;
  escrowIds: string[];
}
