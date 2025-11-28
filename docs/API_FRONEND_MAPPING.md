# Frontend ↔ Backend Mapping

This note maps each frontend page or component to the API requests and data contracts it expects. Use it as a checklist while wiring real data and when designing backend changes.

## Partner Search (Home: `/`)

- **List companies:** `GET /companies`
  - Query params: `q`, `industry`, `country`, `size`, `partnership`, `limit`.
  - Response fields used: `_id`, `name`, `industry`, `tags`, `images[].url`, `city/state/country`, `primaryContact.email`, `confidenceScore`, `matchAnalysis` (array of `{ label, score, description }`), `matchRecommendation`.
- **Company detail modal:** currently reuses the same payload; once `/companies/:id` is available we should fetch extra fields (address, dataSource, extractedAt).
- **Feedback submission:** *placeholder*. We plan to `POST /feedback` or extend `/matches` logs. Define schema: `{ companyId, rating, comments, sessionId }`.
- **Analytics events:** sent to `VITE_ANALYTICS_ENDPOINT` (see `frontend/src/utils/analytics.js`).

## Dashboard (`/dashboard`)

- Displays aggregates (active partners, messages, deals, revenue). Needs a single endpoint such as `GET /analytics/dashboard` returning summary metrics and trend deltas.
- CTA buttons currently use placeholders (open partner search, generate report). Decide whether `Generate report` triggers `POST /reports` or downloads from `/admin/payments/export`.

## Analytics (`/analytics`)

- Expects more detailed metrics:
  - `GET /analytics/partners` → totals, active deals, message volume, global reach.
  - `GET /analytics/industries/top` → list with `{ name, partners, revenue, change }`.
  - `GET /analytics/status` → counts per deal status.
  - `GET /analytics/regions` → partner counts per country.
  - `GET /analytics/activities` → recent partnership activities.
- When implementing backend, consider caching to avoid heavy aggregation on every request.

## My Partners (`/partners`)

- List of partner accounts the user manages.
  - Endpoint suggestion: `GET /partners?status=&industry=&q=`.
  - Fields: `name`, `location`, `tags`, `size`, `projectsCount`, `revenue`, `lastContactAt`, `rating`.
- Buttons:
  - `Add new partner` → eventually opens `POST /partners`.
  - `Message` → removed; currently just tracked for analytics.
  - `View details` → consider linking to `/partners/:id` once implemented.

## Payments (`/payments`)

- Uses placeholder stats; backend should provide:
  - `GET /payments/summary` for totals (total payments, active contracts, pending, completed).
  - `GET /payments/transactions?range=30d` for `totalSent`, `totalReceived`, pending/completed counts.
  - `GET /payments/transactions/recent` for the recent transactions list with `{ company, description, date, amount, currency, status }`.
- Buttons:
  - `Create new contract` → `POST /contracts`.
  - `New payment` → `POST /payments`.
- Tabs currently only emit analytics events; when backend supports multiple datasets we can switch the request based on the selected tab.

## About (`/about`)

- Static content today. Future enhancements might hit:
  - `GET /public/milestones`
  - `GET /public/leadership`
  - `GET /public/contact`

## Analytics Integration (Front-end)

- `frontend/src/utils/analytics.js` sends events to `VITE_ANALYTICS_ENDPOINT` via `sendBeacon` or `fetch`.
  - Payload shape:
    ```json
    {
      "event": "string",
      "properties": {},
      "sessionId": "uuid",
      "timestamp": "ISO",
      "path": "/current-path",
      "userAgent": "…"
    }
    ```
  - If no endpoint is set, events are logged to the console.

## Outstanding Backend Tasks

1. Define/implement the API endpoints listed above (`/analytics/*`, `/partners`, `/payments/*`, `/feedback`).
2. Ensure MongoDB schemas cover required fields (e.g., partner size, revenue, last contact).
3. Add seed data scripts for partners, payments, analytics aggregates to support demos.
4. Decide how feedback, analytics, and contract/payment workflows integrate with existing services.

Use this document as the baseline when writing Swagger/OpenAPI updates. As UI evolves, append new sections or mark fields as deprecated. 
