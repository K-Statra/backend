export declare class CreatePaymentDto {
    amount: number;
    currency?: 'XRP' | 'USD' | 'KRW';
    buyerId: string;
    companyId: string;
    memo?: string;
}
