const BASE = import.meta?.env?.VITE_API_BASE || 'http://localhost:4000'

async function http(path, { method = 'GET', headers = {}, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    let errData
    try {
      errData = await res.json()
    } catch {
      errData = { message: res.statusText }
    }
    const error = new Error(errData.message || 'Request failed')
    if (errData && errData.details) {
      error.details = errData.details
    }
    error.status = res.status
    throw error
  }
  try {
    return await res.json()
  } catch {
    return {}
  }
}

export const api = {
  listCompanies: (params = {}) => {
    const q = new URLSearchParams({ limit: '10', ...params })
    return http(`/companies?${q.toString()}`)
  },
  getCompany: (id) => http(`/companies/${id}`),
  listBuyers: (params = {}) => {
    const q = new URLSearchParams({ limit: '50', ...params })
    return http(`/buyers?${q.toString()}`)
  },
  createBuyer: (data) => http('/buyers', { method: 'POST', body: data }),
  addImage: (companyId, data) => http(`/companies/${companyId}/images`, { method: 'POST', body: data }),
  deleteImage: (companyId, imageId) => http(`/companies/${companyId}/images/${imageId}`, { method: 'DELETE' }),
  getMatches: (buyerId, limit = 10) => http(`/matches?buyerId=${buyerId}&limit=${limit}`),
  createPayment: (payload, idempotencyKey) =>
    http('/payments', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: payload,
    }),
  getPayment: (id) => http(`/payments/${id}`),
  refreshPayment: (id) => http(`/payments/${id}/refresh`, { method: 'POST' }),
  getPaymentCurrencies: async () => {
    try {
      return await http('/payments/currencies')
    } catch {
      return { currencies: [] }
    }
  },
  listPayments: (params = {}) => {
    const q = new URLSearchParams(params)
    return http(`/payments?${q.toString()}`)
  },
  getPaymentSummary: () => http('/payments/summary'),
  getRecentPayments: () => http('/payments/recent'),
  adminListPayments: ({ token, ...params }) => {
    const q = new URLSearchParams({ limit: '20', ...params })
    return http(`/admin/payments?${q.toString()}`, { headers: { 'X-Admin-Token': token } })
  },
  adminGetPaymentStats: ({ token, from, to, buyerId, companyId }) => {
    const q = new URLSearchParams({})
    if (from) q.set('from', from)
    if (to) q.set('to', to)
    if (buyerId) q.set('buyerId', buyerId)
    if (companyId) q.set('companyId', companyId)
    const qs = q.toString()
    return http(`/admin/payments/stats${qs ? `?${qs}` : ''}`, { headers: { 'X-Admin-Token': token } })
  },
  adminGetStats: ({ token }) => http('/admin/stats', { headers: { 'X-Admin-Token': token } }),
  adminListMatches: ({ token, ...params }) => {
    const q = new URLSearchParams({ limit: '20', ...params })
    return http(`/admin/matches?${q.toString()}`, { headers: { 'X-Admin-Token': token } })
  },
  adminExportPayments: async ({ token, ...params }) => {
    const q = new URLSearchParams({ ...params })
    const res = await fetch(`${BASE}/admin/payments/export?${q.toString()}`, {
      headers: { 'X-Admin-Token': token },
    })
    if (!res.ok) throw new Error('Export failed')
    const blob = await res.blob()
    return blob
  },
  analyticsDashboard: () => http('/analytics/dashboard'),
  analyticsTopIndustries: () => http('/analytics/industries/top'),
  analyticsRecentTransactions: () => http('/analytics/transactions/recent'),
  submitMatchFeedback: (companyId, payload) =>
    http(`/matches/${companyId}/feedback`, { method: 'POST', body: payload }),
  createConsultantRequest: (payload) => http('/consultants/requests', { method: 'POST', body: payload }),
}

export function newIdemKey() {
  if (crypto?.randomUUID) return crypto.randomUUID()
  return Math.random().toString(36).slice(2) + Date.now()
}
