# K-Statra

Backend API for a B2B matching system built with Node.js, Express, and MongoDB.

## Quick Start

- Requirements: Node 18+, MongoDB 6+
- Install deps: `npm install`
- Configure env:
  - Copy `.env.example` to `.env`
  - Set `MONGODB_URI` (e.g., `mongodb://localhost:27017/k_statra`)
  - Run dev server: `npm run dev`
  - API Docs: open `http://localhost:4000/docs`

## Atlas Flex (serverless) Setup

- Connection string:
  - In Atlas, create a database user and allow your IP (or 0.0.0.0/0 for quick local dev).
  - Get the SRV URI from Atlas and set in `.env`: `MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>/<db>?retryWrites=true&w=majority`.
- Driver tuning (defaults included in `.env.example`):
  - `MONGODB_MAX_POOL_SIZE` (default 10), `MONGODB_MIN_POOL_SIZE` (default 0)
  - `MONGODB_MAX_IDLE_TIME_MS` (default 30000)
  - `MONGODB_SERVER_SELECTION_TIMEOUT_MS` (default 10000)
  - `MONGODB_SOCKET_TIMEOUT_MS` (default 45000)
  - These keep connections lean for Flex; raise gradually if you see timeouts.
- Background poller (cost/throughput control):
  - Increase `PAYMENTS_POLL_INTERVAL_MS` (e.g., 30000??0000) and reduce `PAYMENTS_POLL_BATCH` (e.g., 5) on Flex.
- Indexes and retention:
  - Collections create indexes on startup via Mongoose schemas. Consider TTL for verbose logs if storage is tight (e.g., MatchLog/AuditLog).

## Seeding Data

- Seed companies (demo data with locations/contacts/confidence scores): `npm run seed:companies`
- Seed buyers: `npm run seed:buyers`
- Seed payments (requires buyers + companies): `npm run seed:payments`

### Frontend environment

- `VITE_FEEDBACK_URL` (optional): external form or Typeform link for the floating feedback button. Defaults to `mailto:support@k-statra.com`.

- Text embeddings (optional):
  - Provider via `EMBEDDINGS_PROVIDER` (`mock` | `huggingface`)
  - For Hugging Face set `HF_API_TOKEN` and optionally `HF_EMBEDDING_MODEL` (default `intfloat/multilingual-e5-small`)
  - Populate: `npm run embed:text all --limit 0`

## Endpoints (high-level)

- `GET /health` ??health check
- `GET /companies` ??list (q/industry/tag, paging/sort)
- `POST /companies` ??create
- `GET /companies/:id`, `PATCH /companies/:id`, `DELETE /companies/:id`
- `GET /buyers` ??list (q/country/industry/tag, paging/sort)
- `POST /buyers` ??create
- `GET /buyers/:id`, `PATCH /buyers/:id`, `DELETE /buyers/:id`
- `GET /matches?buyerId=<id>&limit=<n>` … rule-based top-N matches for a buyer

### Insights / Analytics

- `GET /analytics/dashboard` — summary metrics (total partners, active/pending/completed deals)
- `GET /analytics/industries/top` — aggregated partner counts and revenue by industry
- `GET /analytics/transactions/recent` — latest payments used in Payments/Analytics UI

See `openapi/openapi.yaml` and `/docs` for full details.

## Errors

- 404 returns `{ message: "Not Found", path }`
- Validation errors return `{ message: "Validation error", details: [...] }`

## Security & Limits

- Uses `helmet` for common security headers
- CORS allowlist via `CORS_ORIGINS` (comma-separated). `*` allows all
- Global rate limit per minute via `RATE_LIMIT_MAX` (default 120)
- Structured logs via `winston` with request id; `LOG_LEVEL` controls verbosity
 - Optional CSP: set `ENABLE_CSP=true` to enable a default Content-Security-Policy. Note this may affect Swagger UI/dev tools.
 - Admin token: set `ADMIN_TOKEN`. Rotate periodically and avoid sharing widely.

## Embeddings Provider

- Default: deterministic local mock (no network).
- Hugging Face Inference API (optional):
  - `EMBEDDINGS_PROVIDER=huggingface`
  - `HF_API_TOKEN` and (optional) `HF_EMBEDDING_MODEL`
- OpenAI Embeddings (optional):
  - `EMBEDDINGS_PROVIDER=openai`
  - `OPENAI_API_KEY` and (optional) `OPENAI_EMBED_MODEL` (default `text-embedding-3-small`)

Re-run the embedding script after switching providers to (re)populate vectors:
- `npm run embed:text`

Hybrid matching can include vector similarity:
- `MATCH_USE_EMBEDDING=true|false` (default false in example)
- `MATCH_EMBEDDING_WEIGHT=0.3` (mix weight for vector sim)

## Match Logs

- Each `/matches` request is stored in `MatchLog` with buyerId, params, and top results (companyId, score, reasons)

## Payments (stub)

## Payments

- Create with idempotency:
  - `POST /payments` with header `Idempotency-Key: <uuid>`
  - Body: `{ amount, currency?, buyerId, companyId, memo? }`
  - Returns `201` with `Payment` (status `PENDING` after providerRef assignment)
- Get status: `GET /payments/{id}`
- Webhook signature verification:
  - `POST /payments/webhook` with header `X-Signature: sha256=<hex>`
  - HMAC-SHA256 over the raw request body using `PAYMENTS_WEBHOOK_SECRET`
  - For `X-Signature-Version: v1`, compute HMAC over `${X-Signature-Timestamp}.${X-Signature-Nonce}.${SHA256(body)}` (rejects >5min skew)
  - Payload expects `{ paymentId, event: 'PAID' | 'FAILED' | 'CANCELLED', providerRef? }`
- Env:
  - `PAYMENTS_PROVIDER` (default `xrpl-testnet`), `PAYMENTS_WEBHOOK_SECRET`
  - XRPL: `XRPL_RPC_URL` (default testnet), `XRPL_DEST_ADDRESS` (required)
  - Poller: `PAYMENTS_POLL_INTERVAL_MS` (default 15000), `PAYMENTS_POLL_BATCH` (default 10)
  - Issued currencies (optional):
    - `ALLOW_ISSUED_XRPL=true` to enable non-XRP flows
    - `XRPL_ISSUED_CURRENCY_CODE` (e.g., `RLUSD`), `XRPL_ISSUER_ADDRESS`
    - XUMM/Xaman (optional): `USE_XUMM_FOR_ISSUED=true`, `XUMM_API_KEY`, `XUMM_API_SECRET`, `XUMM_WEBHOOK_SECRET`
    - When XUMM is enabled and configured, create payload deeplink and return consistent `{ payment, guide }` response
- Status transitions: `CREATED -> PENDING -> (PAID|FAILED|CANCELLED)`

### Provider (XRPL Testnet stub)

- XRPL provider uses `xrpl` client to verify payments to `XRPL_DEST_ADDRESS` with a per-payment destination tag.
- Invoice includes `destAddress`, `destTag`, and a `ripple:` deeplink suitable for wallets.
- Background poller runs periodically and updates `PENDING` ??`PAID` when on-ledger.
- Manual refresh: `POST /payments/{id}/refresh`.

### XUMM/Xaman (issued currency)

- If `ALLOW_ISSUED_XRPL=true` and `USE_XUMM_FOR_ISSUED=true`, payment creation for non-XRP currencies attempts a XUMM payload.
- If XUMM credentials are missing or call fails, the API falls back to a placeholder invoice and keeps `PENDING`.
- Webhook: `POST /payments/xumm/webhook` with `X-Xumm-Signature: sha256=<hex>` using `XUMM_WEBHOOK_SECRET`.

### Audit Log

- `AuditLog` collection records payment create and state changes with `requestId`

## Admin API

- Requires header `X-Admin-Token` matching `ADMIN_TOKEN` in env
- Endpoints:
  - `GET /admin/payments?status=&page=&limit=`
  - `GET /admin/payments/stats` (counts by status, last 7 days)
  - `GET /admin/audit?entityType=Payment&entityId=<id>&page=&limit=`
  - `GET /admin/payments/export` (CSV export; supports same filters as list)

## Company Images

- Endpoints:
  - `GET /companies/{id}/images` ??list images
  - `POST /companies/{id}/images` ??add by URL/metadata
  - `DELETE /companies/{id}/images/{imageId}` ??remove
- Schema added to `Company.images[]` with `url, caption, alt, tags, clipEmbedding`
## Company Video Links

- Optional videoUrl on the company payload stores only a lightweight http(s) link (e.g., YouTube, Vimeo).
- The frontend embeds/links to the external player so no video files live inside this repo or database.

## Docker (dev)

- Build and run API + MongoDB:
  - `docker-compose up --build`
- API: `http://localhost:4000`, Mongo: `mongodb://localhost:27017`

## Observability

- Metrics: `GET /metrics` exports Prometheus-format gauges
  - `kstatra_companies_total`, `kstatra_buyers_total`
  - `kstatra_payments_total`, `kstatra_payments_status_total{status="..."}`
  - `kstatra_payments_currency_total{currency="..."}`
  - `kstatra_payments_currency_status_total{currency="...",status="..."}`
  - `kstatra_matchlogs_total`, `kstatra_auditlogs_total`
  - HTTP (in-memory, dev-friendly):
    - `kstatra_http_requests_total{method,route,status}`
    - `kstatra_http_request_duration_ms_sum{method,route}` + `kstatra_http_request_duration_ms_count{method,route}`
      - Average(ms) per route = sum / count
    - Convenience: `kstatra_http_request_duration_ms_avg{method,route}` also exported
    - Method-level averages: `kstatra_http_request_duration_method_ms_avg{method}`
    - Notes:
      - Route labels prefer Express templates (e.g., `/companies/:id`).
      - Unmatched routes are labeled `NOT_FOUND`.
      - When templates aren?셳 available, common id-like tokens in paths are sanitized to reduce cardinality.
    - Status-band totals:
      - Global: `kstatra_http_requests_band_total{band="2xx|3xx|4xx|5xx|other"}`
      - Optional per-route (enable with `METRICS_ROUTE_BANDS=true`): `kstatra_http_requests_band_by_route_total{method,route,band}`
- Dev-only helpers:
  - Reset: `POST /metrics/reset` (no-op in production)
  - Snapshot JSON: `GET /metrics/json` (no-op in production)
  - Windowed JSON: `GET /metrics/window?minutes=60[&method=GET][&route=/payments][&route_regex=1][&band=5xx][&limit=20][&limit_routes=20][&limit_methods=10]` (recent events ring buffer)
    - Filters: `method` exact (e.g., GET), `route` prefix by default or regex if `route_regex=1`, `band` one of `2xx|3xx|4xx|5xx|other`.
    - `limit` sets a default cap; `limit_routes` and `limit_methods` override per-section caps (routes default 20, methods default 10).
  - Route label filters (dev):
    - `METRICS_ROUTE_ALLOW` (comma-separated prefixes) to include only specific routes
    - `METRICS_ROUTE_DENY` (comma-separated prefixes) to exclude routes
  - Route label aliasing (dev):
    - `METRICS_ROUTE_ALIAS_JSON` JSON object of prefix?뭓lias, example:
      - `{ "/payments/": "/payments", "/companies/": "/companies", "/buyers/": "/buyers" }`
    - First matching prefix is applied to compress noisy dynamic routes into consistent labels
    - `METRICS_ROUTE_ALIAS_RULES` JSON array of regex rules with priority, example:
      - `[{ "pattern": "^/payments/[a-f0-9]{24}$", "flags": "i", "alias": "/payments/:id", "priority": 10 }]`
      - Rules are tested first (desc priority), then prefix aliases as fallback
  - Samples/threshold:
    - `METRICS_MIN_SAMPLES_FOR_AVG` (default 5): minimum sample count to include a route in avg latency samples under `/metrics/help?format=json`.
    - `METRICS_SLOW_MS_THRESHOLD` (default 300): slow route threshold for samples.
    - `METRICS_ERROR_RATE_THRESHOLD` (default 0.1): method error rate threshold.
    - `METRICS_EVENTS_MAX` (default 1000): recent HTTP events kept in memory for windowed metrics.
    - `METRICS_SAMPLE_WINDOW_MINUTES` (default 60): default sample window for `/metrics/window`.

### Timezones

- Admin UI date inputs use the browser?셲 local timezone via `datetime-local`, then convert to ISO for API calls.
- Backend stats endpoints interpret ISO datetimes as absolute instants (UTC timestamps).
- When comparing or visualizing data across systems, be mindful of timezone differences.





