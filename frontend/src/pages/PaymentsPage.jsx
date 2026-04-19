import { useEffect, useState } from 'react'
import Button from '../ui/Button.jsx'
import { useI18n } from '../i18n/I18nProvider.jsx'
import { track } from '../utils/analytics.js'
import { api } from '../api.js'

const paymentStatSeed = [
  { id: 'total', labelKey: 'payments_total', value: 45, change: '+12% last month', icon: '🧾' },
  { id: 'contracts', labelKey: 'payments_active_contracts', value: 12, change: '+3 new this week', icon: '📄' },
  { id: 'pending', labelKey: 'payments_pending', value: 8, change: '2 due this week', icon: '⏳' },
  { id: 'completed', labelKey: 'payments_completed', value: 37, change: '$2.4M total value', icon: '✅' },
]

const transactionStatSeed = [
  { id: 'totalSent', labelKey: 'payments_total_sent', value: '$50,000.00', change: '85,420.30 XRP', tone: 'warning' },
  { id: 'totalReceived', labelKey: 'payments_total_received', value: '$120,000.00', change: '205,200.70 XRP', tone: 'success' },
  { id: 'pendingTransactions', labelKey: 'payments_pending_tx', value: '1', change: 'Awaiting confirmation', tone: 'warning' },
  { id: 'completedTransactions', labelKey: 'payments_completed_tx', value: '2', change: 'Successful transactions', tone: 'success' },
]

const transactionsSeed = [
  { id: 1, company: 'BeautyTech Korea', description: 'K-Beauty product order - Premium skincare line', date: 'Jan 15, 2024, 07:30 PM', amount: '-$50,000.00', xrpl: '85,420.30 XRP', status: 'completed' },
  { id: 2, company: 'RoboTech Solutions', description: 'Industrial automation system sale', date: 'Jan 15, 2024, 12:45 AM', amount: '+$120,000.00', xrpl: '205,200.70 XRP', status: 'completed' },
]

export default function PaymentsPage() {
  const { t } = useI18n()
  const [paymentStats, setPaymentStats] = useState(paymentStatSeed)
  const [transactionStats, setTransactionStats] = useState(transactionStatSeed)
  const [transactions, setTransactions] = useState(transactionsSeed)

  useEffect(() => {
    let mounted = true
    api.analyticsDashboard().then((data) => {
      if (!mounted || !data) return
      setPaymentStats((prev) =>
        prev.map((card) => {
          if (card.id === 'total' && data.totalPartners !== undefined) return { ...card, value: data.totalPartners }
          if (card.id === 'pending' && data.pendingPayments !== undefined) return { ...card, value: data.pendingPayments }
          if (card.id === 'completed' && data.completedDeals !== undefined) return { ...card, value: data.completedDeals }
          return card
        })
      )
    })
    api.getPaymentSummary().then((data) => {
      if (!mounted || !data) return
      setTransactionStats((prev) =>
        prev.map((card) => {
          if (card.id === 'totalSent' && data.totalAmount !== undefined)
            return { ...card, value: `$${Number(data.totalAmount).toLocaleString()}` }
          if (card.id === 'pendingTransactions' && data.pending !== undefined)
            return { ...card, value: String(data.pending) }
          if (card.id === 'completedTransactions' && data.paid !== undefined)
            return { ...card, value: String(data.paid) }
          return card
        })
      )
    })
    api.getRecentPayments().then((data) => {
      if (!mounted || !Array.isArray(data)) return
      setTransactions(
        data.map((item) => ({
          id: item._id,
          company: item.companyId?.name || 'Unknown',
          description: item.memo || '',
          date: item.createdAt ? new Date(item.createdAt).toLocaleString() : '',
          amount: `${item.amount >= 0 ? '+' : '-'}$${Math.abs(item.amount || 0).toLocaleString()}`,
          xrpl: `${(item.amount || 0).toLocaleString()} ${item.currency || ''}`,
          status: item.status?.toLowerCase() || 'pending',
        }))
      )
    })
    return () => {
      mounted = false
    }
  }, [])

  return (
    <div className="payments container">
      <div className="dashboard-header row space">
        <div>
          <h1>{t('payments_title_heading')}</h1>
          <p className="muted">{t('payments_subheading')}</p>
        </div>
        <Button
          onClick={() => {
            track('payments_new_contract_click')
          }}
        >
          {t('payments_new_contract')}
        </Button>
      </div>

      <section className="stat-grid">
        {paymentStats.map((card) => (
          <article key={card.id} className="stat-card">
            <div className="stat-icon" aria-hidden="true">
              {card.icon}
            </div>
            <div className="stat-content">
              <p className="muted small">{t(card.labelKey)}</p>
              <strong>{card.value}</strong>
              <span className="muted tiny">{card.change}</span>
            </div>
          </article>
        ))}
      </section>

      <div className="tab-row">
        <button className="chip-btn active" type="button" onClick={() => track('payments_tab_select', { tab: 'payments' })}>
          {t('payments_tab_payments')}
        </button>
        <button className="chip-btn" type="button" onClick={() => track('payments_tab_select', { tab: 'contracts' })}>
          {t('payments_tab_contracts')}
        </button>
        <button className="chip-btn" type="button" onClick={() => track('payments_tab_select', { tab: 'activity' })}>
          {t('payments_tab_activity')}
        </button>
      </div>

      <section className="payments-section row space">
        <div>
          <h2>{t('payments_transactions_title')}</h2>
          <p className="muted small">{t('payments_transactions_subheading')}</p>
        </div>
        <Button
          onClick={() => {
            track('payments_new_payment_click')
          }}
        >
          {t('payments_new_payment')}
        </Button>
      </section>

      <div className="tab-row small">
        <button className="chip-btn active" type="button" onClick={() => track('transactions_tab_select', { tab: 'overview' })}>
          {t('payments_tab_overview')}
        </button>
        <button className="chip-btn" type="button" onClick={() => track('transactions_tab_select', { tab: 'history' })}>
          {t('payments_tab_history')}
        </button>
        <button className="chip-btn" type="button" onClick={() => track('transactions_tab_select', { tab: 'analytics' })}>
          {t('payments_tab_analytics')}
        </button>
      </div>

      <section className="stat-grid">
        {transactionStats.map((card) => (
          <article key={card.id} className={`stat-card ${card.tone}`}>
            <div className="stat-content">
              <p className="muted small">{t(card.labelKey)}</p>
              <strong>{card.value}</strong>
              <span className="muted tiny">{card.change}</span>
            </div>
          </article>
        ))}
      </section>

      <section className="panel">
        <h3>{t('payments_recent_transactions')}</h3>
        <ul className="activity-list">
          {transactions.map((tx) => (
            <li key={tx.id} className={`activity transaction ${tx.status}`}>
              <div>
                <strong>{tx.company}</strong>
                <div className="muted tiny">{tx.description}</div>
                <div className="muted tiny">{tx.date}</div>
              </div>
              <div className="transaction-amount">
                <strong>{tx.amount}</strong>
                <span className="muted tiny">{tx.xrpl}</span>
                <span className={`status-pill ${tx.status}`}>{tx.status}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
