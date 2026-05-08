import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";

export class InsufficientXrpBalanceException extends BadRequestException {
  constructor(available: number, required: number) {
    super(
      `Insufficient XRP balance: available ${available.toFixed(6)} XRP, required ${required.toFixed(6)} XRP (escrow amounts + reserve + fees)`,
    );
  }
}

export class EscrowPaymentNotFoundException extends NotFoundException {
  constructor() {
    super("EscrowPayment not found");
  }
}

export class EscrowItemNotFoundException extends NotFoundException {
  constructor() {
    super("EscrowItem not found");
  }
}

export class EventTypeNotFoundException extends NotFoundException {
  constructor(eventType: string) {
    super(`Event type "${eventType}" not found in this escrow`);
  }
}

export class InvalidPaymentStatusException extends BadRequestException {
  constructor(current: string) {
    super(`Cannot approve payment in status ${current}`);
  }
}

export class PaymentNotActiveException extends BadRequestException {
  constructor(current: string) {
    super(
      `Payment must be ACTIVE to execute escrow (current: ${current}). Both buyer and seller must approve first.`,
    );
  }
}

export class InvalidEscrowItemStatusException extends BadRequestException {
  constructor(expected: string, current: string) {
    super(`EscrowItem status must be ${expected}, got ${current}`);
  }
}

export class InvalidEscrowCancelStatusException extends BadRequestException {
  constructor(current: string) {
    super(`Cannot cancel escrow in status ${current}`);
  }
}

export class AlreadyApprovedPaymentException extends BadRequestException {
  constructor(role: "Buyer" | "Seller") {
    super(`${role} already approved this payment`);
  }
}

export class AlreadyApprovedEventException extends BadRequestException {
  constructor(role: "Buyer" | "Seller") {
    super(`${role} already approved this event`);
  }
}

export class EscrowItemMustBeEscrowedException extends BadRequestException {
  constructor(current: string) {
    super(`EscrowItem must be ESCROWED to approve events, got ${current}`);
  }
}

export class PaymentNotApprovedForPayException extends BadRequestException {
  constructor(current: string) {
    super(`Payment must be APPROVED to initiate payment (current: ${current})`);
  }
}

export class UnauthorizedPaymentActionException extends ForbiddenException {
  constructor() {
    super(
      "Only participants (buyer or seller) of this payment can initiate it",
    );
  }
}

export class PaymentInitiationFailedException extends InternalServerErrorException {
  constructor() {
    super("Failed to initiate payment. Please try again.");
  }
}
