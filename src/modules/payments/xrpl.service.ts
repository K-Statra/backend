import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Client, xrpToDrops, Wallet } from "xrpl";
import * as crypto from "crypto";

export interface XrplInvoice {
  providerRef: string;
  deeplink: string;
  qr: string;
  destAddress: string;
  destTag: number;
  expiresAt: Date;
}

export interface PaymentCheckResult {
  paid: boolean;
  txHash?: string;
}

export interface XrplWallet {
  address: string;
  seed: string;
  publicKey: string;
  privateKey: string;
}

@Injectable()
export class XrplService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(XrplService.name);
  private client: Client;
  private readonly wsUrl: string;
  private readonly destAddress: string;
  private readonly encryptionKey: Buffer; // AES-256용 32바이트 키

  constructor(private readonly config: ConfigService) {
    this.wsUrl = this.config.get<string>("xrpl.wsUrl")!;
    this.destAddress = this.config.get<string>("xrpl.destAddress")!;

    const keyStr = this.config.get<string>("security.encryptionKey");
    if (!keyStr || keyStr.length !== 64) {
      throw new Error(
        "security.encryptionKey must be a 64-character hex string (32 bytes)",
      );
    }
    this.encryptionKey = Buffer.from(keyStr, "hex");
  }

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    if (this.client?.isConnected()) {
      await this.client.disconnect();
    }
  }

  private async connect() {
    this.client = new Client(this.wsUrl);
    await this.client.connect();
    this.logger.log(`Connected to XRPL: ${this.wsUrl}`);
  }

  // 신규 지갑 생성
  generateWallet(): XrplWallet {
    const wallet = Wallet.generate();
    return {
      address: wallet.address,
      seed: wallet.seed!,
      publicKey: wallet.publicKey,
      privateKey: wallet.privateKey,
    };
  }

  /**
   * 테스트넷에서 계정 활성화 (1 XRP 이상 펀딩)
   */
  async fundAccount(wallet: XrplWallet): Promise<void> {
    try {
      if (!this.client.isConnected()) {
        await this.connect();
      }

      const xrplWallet = Wallet.fromSeed(wallet.seed);
      await this.client.fundWallet(xrplWallet);

      this.logger.log(`Wallet funded and activated: ${wallet.address}`);
    } catch (err) {
      this.logger.error(`Failed to fund wallet: ${wallet.address}`, err);
      throw err;
    }
  }

  /**
   * AES-256-GCM으로 데이터 암호화
   */
  encrypt(text: string): string {
    const iv = crypto.randomBytes(12); // GCM 권장 IV 길이는 12바이트
    const cipher = crypto.createCipheriv("aes-256-gcm", this.encryptionKey, iv);

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag().toString("hex");

    // iv:authTag:encryptedText 형태로 저장
    return `${iv.toString("hex")}:${authTag}:${encrypted}`;
  }

  /**
   * AES-256-GCM 데이터 복호화
   */
  decrypt(cipherText: string): string {
    const [ivHex, authTagHex, encryptedHex] = cipherText.split(":");
    if (!ivHex || !authTagHex || !encryptedHex) {
      throw new Error("Invalid cipher text format");
    }

    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      this.encryptionKey,
      iv,
    );

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }

  // DestinationTag: paymentId를 SHA256 해시해서 uint32로 변환
  deriveDestinationTag(paymentId: string): number {
    const hex = crypto.createHash("sha256").update(paymentId).digest("hex");
    const val = parseInt(hex.slice(0, 8), 16) >>> 0;
    return val === 0 ? 1 : val;
  }

  // 결제 인보이스 생성 (deeplink + QR)
  createInvoice(paymentId: string, amount: number): XrplInvoice {
    if (!this.destAddress) {
      throw new Error("XRPL_DEST_ADDRESS is not configured");
    }

    const destTag = this.deriveDestinationTag(paymentId); // 결제 식별값
    const deeplink = `ripple:${this.destAddress}?amount=${amount}&dt=${destTag}`; // 프론트에서 QR 이미지로 변환해야함

    return {
      providerRef: `xrpl_${paymentId}`,
      deeplink,
      qr: deeplink,
      destAddress: this.destAddress,
      destTag,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15분
    };
  }

  // XRPL 레저에서 결제 확인
  async checkPayment(
    destTag: number,
    expectedAmountXrp: number,
  ): Promise<PaymentCheckResult> {
    if (!this.client?.isConnected()) {
      throw new Error("XRPL client is not connected");
    }

    const expectedDrops = BigInt(xrpToDrops(expectedAmountXrp));

    const resp = await this.client.request({
      command: "account_tx",
      account: this.destAddress,
      ledger_index_min: -1,
      ledger_index_max: -1,
      forward: false,
      limit: 200,
    });

    const matchedTx = (resp.result.transactions ?? []).find((t: any) => {
      const tx = t.tx ?? t.tx_json;
      const meta = t.meta;

      if (!tx || tx.TransactionType !== "Payment") return false;
      if (tx.Destination !== this.destAddress) return false;
      if (tx.DestinationTag !== destTag) return false;
      if (!t.validated) return false;

      const delivered = meta?.delivered_amount;
      if (typeof delivered !== "string") return false;

      return BigInt(delivered) >= expectedDrops;
    });

    if (matchedTx) {
      const tx = matchedTx.tx ?? matchedTx.tx_json;
      return { paid: true, txHash: tx?.hash };
    }

    return { paid: false };
  }
}
