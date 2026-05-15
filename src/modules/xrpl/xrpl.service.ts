import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  Client,
  xrpToDrops,
  dropsToXrp,
  Wallet,
  unixTimeToRippleTime,
  type EscrowCreate,
  type EscrowFinish,
  type EscrowCancel,
} from "xrpl";
import * as crypto from "crypto";
import {
  InsufficientXrpBalanceException,
  InsufficientRlusdBalanceException,
  InvalidCipherTextException,
  XrplConnectionException,
  XrplTransactionFailedException,
} from "../../common/exceptions";

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
  private readonly wsUrl: string;
  private readonly destAddress: string;
  private readonly iouIssuer: string;
  private readonly iouCurrencyCode: string;
  private readonly encryptionKey: Buffer; // AES-256용 32바이트 키
  private client: Client;
  private connectPromise?: Promise<void>;

  constructor(private readonly config: ConfigService) {
    this.wsUrl = this.config.get<string>("xrpl.wsUrl")!;
    this.destAddress = this.config.get<string>("xrpl.destAddress")!;
    const issuerAddress = this.config.get<string>("xrpl.issuerAddress");
    if (!issuerAddress) {
      throw new Error("XRPL_ISSUER_ADDRESS is not configured");
    }
    this.iouIssuer = issuerAddress;
    this.iouCurrencyCode =
      this.config.get<string>("xrpl.issuedCurrencyCode") || "RLUSD";

    const keyStr = this.config.get<string>("security.encryptionKey");
    if (!keyStr || !/^[0-9a-fA-F]{64}$/.test(keyStr)) {
      throw new Error(
        "security.encryptionKey must be a 64-character hex string (32 bytes)",
      );
    }
    this.encryptionKey = Buffer.from(keyStr, "hex");
  }

  async onModuleInit() {
    try {
      await this.connect();
    } catch (err: any) {
      this.logger.warn(`XRPL initial connect failed: ${err.message}`);
    }
  }

  async onModuleDestroy() {
    if (this.client?.isConnected()) {
      await this.client.disconnect();
    }
  }

  // 중복 websocket 중복 연결 방지 및 재연결 로직
  private async connect() {
    if (this.client?.isConnected()) {
      return;
    }
    if (!this.connectPromise) {
      // 연결이 끊긴 상태에서 재연결 시 기존 Client를 버리고 새로 생성
      // 기존 Client를 재사용하면 "Websocket connection never cleaned up" 에러 발생
      this.client = new Client(this.wsUrl, { connectionTimeout: 3_000 });
      this.logger.log(`[XRPL] Connecting to ${this.wsUrl}`);
      this.connectPromise = this.client
        .connect()
        .then(() => {
          this.logger.log(`[XRPL] Connected to ${this.wsUrl}`);
        })
        .catch((err: Error) => {
          this.logger.error(
            `[XRPL] Connection failed (${this.wsUrl}): ${err.message}`,
          );
          throw err;
        })
        .finally(() => {
          this.connectPromise = undefined;
        });
    }

    await this.connectPromise;
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
      await this.connect();

      const xrplWallet = Wallet.fromSeed(wallet.seed);
      if (xrplWallet.address !== wallet.address) {
        throw new Error(
          "Stored wallet address does not match the decrypted seed",
        );
      }
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
      throw new InvalidCipherTextException();
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

  /**
   * PREIMAGE-SHA-256 crypto-condition 쌍 생성 (DER 인코딩, hex)
   * Condition: A0 25 80 20 {sha256_32B} 81 01 20
   * Fulfillment: A0 22 80 20 {preimage_32B}
   */
  generateCryptoCondition(): { condition: string; fulfillment: string } {
    const preimage = crypto.randomBytes(32);
    const fingerprint = crypto.createHash("sha256").update(preimage).digest();

    const fulfillmentBuf = Buffer.concat([
      Buffer.from([0xa0, 0x22, 0x80, 0x20]),
      preimage,
    ]);

    const conditionBuf = Buffer.concat([
      Buffer.from([0xa0, 0x25, 0x80, 0x20]),
      fingerprint,
      Buffer.from([0x81, 0x01, 0x20]), // cost = 32 (1 byte)
    ]);

    return {
      fulfillment: fulfillmentBuf.toString("hex").toUpperCase(),
      condition: conditionBuf.toString("hex").toUpperCase(),
    };
  }

  /**
   * XRPL EscrowCreate 트랜잭션 제출
   * buyer 지갑이 sellerAddress로 amountXrp를 condition 조건으로 잠금
   * @returns txHash, sequence (EscrowFinish에서 OfferSequence로 사용)
   */
  async createEscrow(
    buyerWallet: XrplWallet,
    sellerAddress: string,
    amount: number,
    condition: string,
    currency: "XRP" | "RLUSD" = "XRP",
  ): Promise<{ txHash: string; sequence: number }> {
    await this.connect();
    const wallet = Wallet.fromSeed(buyerWallet.seed);

    // Condition 기반 에스크로: FinishAfter 없이 fulfillment 제출 즉시 해제 가능
    // CancelAfter = 1년 후 — 분쟁/장애 시 반환 시점 (XRPL 정책상 즉시 취소 불가)
    const cancelAfter = unixTimeToRippleTime(
      Date.now() + 365 * 24 * 60 * 60 * 1_000,
    );
    const tx: EscrowCreate = {
      TransactionType: "EscrowCreate",
      Account: wallet.address,
      Amount: this.buildEscrowAmount(currency, amount),
      Destination: sellerAddress,
      Condition: condition,
      CancelAfter: cancelAfter,
    };
    const prepared = await this.client.autofill(tx);

    const sequence = prepared.Sequence as number;
    const { tx_blob } = wallet.sign(prepared);
    const result = await this.client.submitAndWait(tx_blob);

    const meta = result.result.meta as any;
    if (meta?.TransactionResult !== "tesSUCCESS") {
      throw new XrplTransactionFailedException(
        "EscrowCreate",
        meta?.TransactionResult ?? "unknown",
      );
    }

    return { txHash: result.result.hash, sequence };
  }

  /**
   * XRPL EscrowFinish 트랜잭션 제출 (에스크로 해제)
   * @param submitterWallet - 수수료 지불 지갑 (보통 buyer)
   * @param ownerAddress - EscrowCreate를 제출한 계정 (buyer address)
   * @param offerSequence - EscrowCreate tx의 Sequence 번호
   */
  async finishEscrow(
    submitterWallet: XrplWallet,
    ownerAddress: string,
    offerSequence: number,
    condition: string,
    fulfillment: string,
  ): Promise<string> {
    await this.connect();
    const wallet = Wallet.fromSeed(submitterWallet.seed);

    const tx: EscrowFinish = {
      TransactionType: "EscrowFinish",
      Account: wallet.address,
      Owner: ownerAddress,
      OfferSequence: offerSequence,
      Condition: condition,
      Fulfillment: fulfillment,
    };
    const prepared = await this.client.autofill(tx);

    const { tx_blob } = wallet.sign(prepared);
    const result = await this.client.submitAndWait(tx_blob);

    const meta = result.result.meta as any;
    if (meta?.TransactionResult !== "tesSUCCESS") {
      throw new XrplTransactionFailedException(
        "EscrowFinish",
        meta?.TransactionResult ?? "unknown",
      );
    }

    return result.result.hash;
  }

  /**
   * XRPL EscrowCancel 트랜잭션 제출 (CancelAfter 이후에만 성공)
   */
  async cancelEscrow(
    submitterWallet: XrplWallet,
    ownerAddress: string,
    offerSequence: number,
  ): Promise<string> {
    await this.connect();
    const wallet = Wallet.fromSeed(submitterWallet.seed);

    const tx: EscrowCancel = {
      TransactionType: "EscrowCancel",
      Account: wallet.address,
      Owner: ownerAddress,
      OfferSequence: offerSequence,
    };
    const prepared = await this.client.autofill(tx);

    const { tx_blob } = wallet.sign(prepared);
    const result = await this.client.submitAndWait(tx_blob);

    const meta = result.result.meta as any;
    if (meta?.TransactionResult !== "tesSUCCESS") {
      throw new XrplTransactionFailedException(
        "EscrowCancel",
        meta?.TransactionResult ?? "unknown",
      );
    }

    return result.result.hash;
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
      throw new XrplConnectionException();
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

  /**
   * buyer 계정에서 condition이 일치하는 에스크로 조회
   * SUBMITTING 복구 스케줄러에서 XRPL 제출 여부 확인에 사용
   */
  async findEscrowByCondition(
    buyerAddress: string,
    condition: string,
  ): Promise<{ txHash: string; sequence: number } | null> {
    await this.connect();

    const resp = await this.client.request({
      command: "account_objects",
      account: buyerAddress,
      type: "escrow",
    } as any);

    const escrowObj = ((resp.result as any).account_objects as any[]).find(
      (obj) => obj.Condition === condition,
    );
    if (!escrowObj) return null;

    const txResp = await this.client.request({
      command: "tx",
      transaction: escrowObj.PreviousTxnID,
    } as any);

    return {
      txHash: escrowObj.PreviousTxnID as string,
      sequence: (txResp.result as any).Sequence as number,
    };
  }

  /**
   * 에스크로 생성 전 buyer 잔고 사전 검증
   * 필요 금액 = 에스크로 합계 + 에스크로당 owner reserve(2 XRP) + 수수료 버퍼
   * 현재 계정 reserve(base + 기존 owner) 초과분만 사용 가능
   * 모든 계산은 drops 단위(BigInt)로 수행하여 부동소수점 오차 방지
   */
  async validateEscrowFunds(
    buyerAddress: string,
    escrows: { amountXrp: number }[],
  ): Promise<void> {
    await this.connect();

    const [accountRes, serverRes] = await Promise.all([
      this.client.request({
        command: "account_info",
        account: buyerAddress,
        ledger_index: "validated",
      }),
      this.client.request({ command: "server_info" }),
    ]);

    const accountData = accountRes.result.account_data;
    const balanceDrops = BigInt(accountData.Balance); // Balance는 drops 단위 문자열
    const ownerCount = accountData.OwnerCount;

    const ledger = (serverRes.result.info as any).validated_ledger;
    const baseReserveDrops = BigInt(
      Math.round((ledger?.reserve_base_xrp ?? 10) * 1_000_000),
    );
    const ownerReserveDrops = BigInt(
      Math.round((ledger?.reserve_inc_xrp ?? 2) * 1_000_000),
    );

    // 현재 계정 최소 유지 잔고 (drops)
    const currentReserveDrops =
      baseReserveDrops + BigInt(ownerCount) * ownerReserveDrops;
    // 에스크로 N개 추가 시 reserve 증가분 (drops)
    const additionalReserveDrops = BigInt(escrows.length) * ownerReserveDrops;
    // 에스크로 금액 합계 (drops) — 각각 변환 후 합산하여 부동소수점 누적 오차 방지
    const totalEscrowDrops = escrows.reduce(
      (sum, e) => sum + BigInt(xrpToDrops(e.amountXrp)),
      BigInt(0),
    );
    // 수수료 버퍼: 에스크로당 1,000 drops (= 0.001 XRP)
    const feeBufferDrops = BigInt(escrows.length * 1_000);

    const requiredDrops =
      currentReserveDrops +
      additionalReserveDrops +
      totalEscrowDrops +
      feeBufferDrops;

    if (balanceDrops < requiredDrops) {
      throw new InsufficientXrpBalanceException(
        Number(dropsToXrp(balanceDrops.toString())),
        Number(dropsToXrp(requiredDrops.toString())),
      );
    }

    this.logger.log(
      `Balance check OK: ${balanceDrops} drops available, ${requiredDrops} drops required`,
    );
  }

  /**
   * issuer 계정에 AllowTrustLineLocking 플래그 설정 (asfAllowTrustLineLocking = 17)
   * XLS-85 TokenEscrow: issuer가 이 플래그를 보유해야 IOU EscrowCreate 허용
   * 미설정 시 EscrowCreate 제출 시 tecNO_PERMISSION 반환
   */
  async enableTrustLineLocking(issuerWallet: XrplWallet): Promise<void> {
    await this.connect();
    const wallet = Wallet.fromSeed(issuerWallet.seed);
    const tx = {
      TransactionType: "AccountSet" as const,
      Account: issuerWallet.address,
      SetFlag: 17, // asfAllowTrustLineLocking
    };
    const prepared = await this.client.autofill(tx);
    const { tx_blob } = wallet.sign(prepared);
    const result = await this.client.submitAndWait(tx_blob);

    const meta = result.result.meta as any;
    if (meta?.TransactionResult !== "tesSUCCESS") {
      throw new XrplTransactionFailedException(
        "AccountSet:AllowTrustLineLocking",
        meta?.TransactionResult ?? "unknown",
      );
    }

    this.logger.log(
      `AllowTrustLineLocking enabled for ${issuerWallet.address}`,
    );
  }

  /**
   * RLUSD trust line이 없으면 TrustSet 트랜잭션으로 생성
   * 결제 생성(initiatePayment) pre-flight에서 buyer/seller 양측 호출
   */
  async ensureRlusdTrustLine(
    address: string,
    encryptedSeed: string,
  ): Promise<void> {
    await this.connect();

    const resp = await this.client.request({
      command: "account_lines",
      account: address,
      peer: this.iouIssuer,
    } as any);

    const lines = (resp.result as any).lines as {
      currency: string;
      account: string;
    }[];
    const hasLine = lines.some(
      (l) =>
        l.currency === this.iouCurrencyCode && l.account === this.iouIssuer,
    );
    if (hasLine) return;

    const seed = this.decrypt(encryptedSeed);
    const wallet = Wallet.fromSeed(seed);
    const tx = {
      TransactionType: "TrustSet" as const,
      Account: address,
      LimitAmount: {
        currency: this.iouCurrencyCode,
        issuer: this.iouIssuer,
        value: "1000000000",
      },
    };
    const prepared = await this.client.autofill(tx);
    const { tx_blob } = wallet.sign(prepared);
    const result = await this.client.submitAndWait(tx_blob);

    const meta = result.result.meta as any;
    if (meta?.TransactionResult !== "tesSUCCESS") {
      throw new XrplTransactionFailedException(
        "TrustSet",
        meta?.TransactionResult ?? "unknown",
      );
    }

    this.logger.log(
      `IOU trust line created for ${address} (${this.iouCurrencyCode})`,
    );
  }

  /**
   * buyer의 IOU 잔고 검증
   * trust line의 balance가 총 에스크로 금액 이상인지 확인
   */
  async validateRlusdFunds(
    buyerAddress: string,
    escrows: { amountXrp: number }[],
  ): Promise<void> {
    await this.connect();

    const resp = await this.client.request({
      command: "account_lines",
      account: buyerAddress,
      peer: this.iouIssuer,
    } as any);

    const lines = (resp.result as any).lines as {
      currency: string;
      account: string;
      balance: string;
    }[];
    const line = lines.find(
      (l) =>
        l.currency === this.iouCurrencyCode && l.account === this.iouIssuer,
    );

    const balance = parseFloat(parseFloat(line?.balance ?? "0").toFixed(6));
    const required = parseFloat(
      escrows.reduce((sum, e) => sum + e.amountXrp, 0).toFixed(6),
    );

    if (balance < required) {
      throw new InsufficientRlusdBalanceException(balance, required);
    }

    this.logger.log(
      `IOU balance check OK: ${balance} available, ${required} required (${this.iouCurrencyCode})`,
    );
  }

  /**
   * IOU 결제 전송 — 테스트 issuer가 buyer에게 토큰을 충전할 때 사용
   */
  async sendIssuedCurrencyPayment(
    senderWallet: XrplWallet,
    destAddress: string,
    amount: string,
  ): Promise<string> {
    await this.connect();
    const wallet = Wallet.fromSeed(senderWallet.seed);

    const tx = {
      TransactionType: "Payment" as const,
      Account: senderWallet.address,
      Destination: destAddress,
      Amount: {
        currency: this.iouCurrencyCode,
        issuer: this.iouIssuer,
        value: amount,
      },
    };
    const prepared = await this.client.autofill(tx);
    const { tx_blob } = wallet.sign(prepared);
    const result = await this.client.submitAndWait(tx_blob);

    const meta = result.result.meta as any;
    if (meta?.TransactionResult !== "tesSUCCESS") {
      throw new XrplTransactionFailedException(
        "Payment",
        meta?.TransactionResult ?? "unknown",
      );
    }

    return result.result.hash;
  }

  private buildEscrowAmount(
    currency: "XRP" | "RLUSD",
    amount: number,
  ): string | { value: string; currency: string; issuer: string } {
    if (currency === "XRP") {
      return xrpToDrops(amount);
    }
    return {
      value: amount.toFixed(6),
      currency: this.iouCurrencyCode,
      issuer: this.iouIssuer,
    };
  }
}
