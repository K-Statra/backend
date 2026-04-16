import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
export declare class XrplService implements OnModuleInit, OnModuleDestroy {
    private readonly config;
    private readonly logger;
    private client;
    private readonly wsUrl;
    private readonly destAddress;
    constructor(config: ConfigService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    private connect;
    private reconnect;
    private disconnect;
    isConnected(): boolean;
    deriveDestinationTag(paymentId: string): number;
    createInvoice(paymentId: string, amount: number): XrplInvoice;
    checkPayment(destTag: number, expectedAmountXrp: number): Promise<PaymentCheckResult>;
}
