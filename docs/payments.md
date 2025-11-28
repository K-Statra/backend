Payments Overview (XRP, RLUSD, USD)

This project uses a pluggable payments provider model controlled by `PAYMENTS_PROVIDER`.

Providers
- xrpl-testnet (default): Native XRP payments on XRPL testnet. Requires `XRPL_DEST_ADDRESS`.
- xrpl-rlusd (planned): Issued currency RLUSD on XRPL. Requires trust lines and issuer configuration.
- stripe (stub): Fiat USD via Stripe Checkout/PaymentIntents (webhook + secret required).

Environment
- Common
  - `PAYMENTS_PROVIDER= xrpl-testnet | xrpl-rlusd | stripe`
- XRPL (XRP)
  - `XRPL_RPC_URL=wss://s.altnet.rippletest.net:51233`
  - `XRPL_DEST_ADDRESS=r...` (your destination account)
- XRPL (Issued currency e.g., RLUSD)
  - `XRPL_ISSUED_CURRENCY_CODE=RLUSD`
  - `XRPL_ISSUER_ADDRESS=r...` (issuer of RLUSD)
  - `ALLOW_ISSUED_XRPL=true|false` (feature flag)
  - `USE_XUMM_FOR_ISSUED=true|false` (enable payload-based invoice)
  - `XUMM_API_KEY=...`, `XUMM_API_SECRET=...` (required when integrating real XUMM API)
  - Note: Both merchant and payer wallets must establish a trust line to the issuer for RLUSD.
  - Recommended UX: use XUMM/Xaman payload for payment/QR.
- Stripe (USD)
  - `STRIPE_API_KEY=sk_...`
  - `STRIPE_WEBHOOK_SECRET=whsec_...`

Current Status
- XRP on XRPL testnet: Implemented end-to-end (create → invoice deeplink/QR → poll/webhook).
- RLUSD: Not enabled in server yet (UI offers a beta option). Add provider logic + trust line checks when enabling.
- Stripe (USD): Stub only. Replace invoice creation with Checkout Session and implement webhook signature verification.

Frontend UX
- Currency selection exists in Partner Search modal, Company Detail modal, and Matching Detail page.
- If an unsupported currency is selected, backend returns a 400 with a helpful message.

Next Steps (enabling RLUSD)
1) Configure issuer and currency code in `.env`.
   - `ALLOW_ISSUED_XRPL=true`
   - `XRPL_ISSUED_CURRENCY_CODE=RLUSD`
   - `XRPL_ISSUER_ADDRESS=r...`
2) Trust lines
   - Merchant (destination) and payer wallets must add a trust line to `RLUSD` issued by `XRPL_ISSUER_ADDRESS`.
   - XUMM/Xaman or xrpl.js can be used to set the trust line (limit > 0).
3) Payment UX
   - For issued currencies, prefer payload-based UX (XUMM) rather than `ripple:` deeplink.
   - If `USE_XUMM_FOR_ISSUED=true`, server creates a stub payload URL for now; replace with real XUMM API call in production.
4) Webhook/settlement
   - XRPL issued currencies: settlement detection checks `delivered_amount` object (currency/issuer/value), not native drops.
   - Implemented in `src/providers/payments/xrpl.js` (refreshPaymentStatus) with IOU logic.
