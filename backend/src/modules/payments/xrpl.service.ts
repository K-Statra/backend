import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, xrpToDrops } from 'xrpl';
import * as crypto from 'crypto';

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

@Injectable()
export class XrplService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(XrplService.name);
  private client: Client;
  private readonly wsUrl: string;
  private readonly destAddress: string;

  constructor(private readonly config: ConfigService) {
    this.wsUrl = this.config.get<string>('xrpl.wsUrl')!;
    this.destAddress = this.config.get<string>('xrpl.destAddress')!;
  }

  // 서버 시작 시 XRPL 노드에 WebSocket 연결 (상시 유지)
  async onModuleInit() {
    await this.connect();
  }

  // 서버 종료 시 연결 해제
  async onModuleDestroy() {
    await this.disconnect();
  }

  private async connect() {
    try {
      this.client = new Client(this.wsUrl);
      await this.client.connect();
      this.logger.log(`XRPL connected: ${this.wsUrl}`);

      // 연결 끊기면 자동 재연결
      this.client.on('disconnected', async (code) => {
        this.logger.warn(`XRPL disconnected (code: ${code}), reconnecting...`);
        await this.reconnect();
      });
    } catch (err) {
      this.logger.error('XRPL connection failed', err);
    }
  }

  private async reconnect(retries = 5, delayMs = 3000) {
    for (let i = 0; i < retries; i++) {
      try {
        await new Promise((r) => setTimeout(r, delayMs));
        await this.client.connect();
        this.logger.log('XRPL reconnected');
        return;
      } catch {
        this.logger.warn(`Reconnect attempt ${i + 1}/${retries} failed`);
      }
    }
    this.logger.error('XRPL reconnection exhausted');
  }

  private async disconnect() {
    try {
      if (this.client?.isConnected()) {
        await this.client.disconnect();
        this.logger.log('XRPL disconnected');
      }
    } catch (err) {
      this.logger.error('XRPL disconnect error', err);
    }
  }

  isConnected(): boolean {
    return this.client?.isConnected() ?? false;
  }

  // DestinationTag: paymentId를 SHA256 해시해서 uint32로 변환
  deriveDestinationTag(paymentId: string): number {
    const hex = crypto.createHash('sha256').update(paymentId).digest('hex');
    const val = parseInt(hex.slice(0, 8), 16) >>> 0;
    return val === 0 ? 1 : val;
  }

  // 결제 인보이스 생성 (deeplink + QR)
  createInvoice(paymentId: string, amount: number): XrplInvoice {
    if (!this.destAddress) {
      throw new Error('XRPL_DEST_ADDRESS is not configured');
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
      throw new Error('XRPL client is not connected');
    }

    const expectedDrops = BigInt(xrpToDrops(expectedAmountXrp));

    const resp = await this.client.request({
      command: 'account_tx',
      account: this.destAddress,
      ledger_index_min: -1,
      ledger_index_max: -1,
      forward: false,
      limit: 200,
    });

    const matchedTx = (resp.result.transactions ?? []).find((t: any) => {
      const tx = t.tx ?? t.tx_json;
      const meta = t.meta;

      if (!tx || tx.TransactionType !== 'Payment') return false;
      if (tx.Destination !== this.destAddress) return false;
      if (tx.DestinationTag !== destTag) return false;
      if (!t.validated) return false;

      const delivered = meta?.delivered_amount;
      if (typeof delivered !== 'string') return false;

      return BigInt(delivered) >= expectedDrops;
    });

    if (matchedTx) {
      const tx = matchedTx.tx ?? matchedTx.tx_json;
      return { paid: true, txHash: tx?.hash as string | undefined };
    }

    return { paid: false };
  }
}
