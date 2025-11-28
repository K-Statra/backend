K-Statra Frontend (Vite + React)

Quick Start
- Prereq: Backend running on `http://localhost:4000` (or set `VITE_API_BASE`)
- Install deps: `npm install`
- Dev: `npm run dev` (opens http://localhost:5173)
- Build: `npm run build` / Preview: `npm run preview`

Env
- Copy `.env.example` to `.env` and set:
  - `VITE_API_BASE=http://localhost:4000`

Routes
- `/companies` Company list + search
- `/buyers/new` Buyer form -> redirects to `/matches?buyerId=...`
- `/matches?buyerId=<24hex>` Shows top matches, create payment per company
- `/payments/checkout/:id` Shows deeplink/QR info from invoice
- `/payments/:id` Payment status + manual refresh
- `/admin/payments` List payments (requires `X-Admin-Token` value)

Notes
- Simple styles in `src/styles.css`
- API client in `src/api.js` using `VITE_API_BASE`
- This skeleton targets the backend API in this repo.

