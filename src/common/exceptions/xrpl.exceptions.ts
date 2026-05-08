import {
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";

export class XrplConnectionException extends InternalServerErrorException {
  constructor() {
    super("XRPL client is not connected");
  }
}

export class XrplTransactionFailedException extends InternalServerErrorException {
  constructor(txType: string, result: string) {
    super(`${txType} failed: ${result}`);
  }
}

export class InvalidCipherTextException extends InternalServerErrorException {
  constructor() {
    super("Invalid cipher text format");
  }
}

export class WalletNotAvailableException extends BadRequestException {
  constructor(role: "Buyer" | "Seller") {
    super(`${role} wallet not found or not activated`);
  }
}

export class WalletSeedUnavailableException extends InternalServerErrorException {
  constructor() {
    super("Buyer wallet seed not available for EscrowFinish");
  }
}
