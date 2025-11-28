import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../ui/Button.jsx'
import { useI18n } from '../i18n/I18nProvider.jsx'
import { api } from '../api.js'
import { track } from '../utils/analytics.js'

const statSeed = [
    { id: 'totalPartners', labelKey: 'analytics_total_partners', value: '24', change: '+12%', icon: '👥', tone: 'primary' },
    { id: 'activeDeals', labelKey: 'analytics_active_deals', value: '12', change: '+8%', icon: '🎯', tone: 'warning' },
    { id: 'pendingPayments', labelKey: 'payments_pending', value: '8', change: '-2%', icon: '⏳', tone: 'info' },
    { id: 'completedDeals', labelKey: 'payments_completed', value: '37', change: '+5%', icon: '📈', tone: 'success' },
]

const recentRequestsSeed = [
    { id: 1, company: 'TechFlow Solutions', type: 'Joint Venture', time: '2 hours ago', status: 'Pending' },
    { id: 2, company: 'Global Innovators', type: 'Supplier', time: '5 hours ago', status: 'Under Review' },
    { id: 3, company: 'Smart Manufacturing Co.', type: 'Distributor', time: '1 day ago', status: 'Approved' },
]

const industriesSeed = [
    { rank: 1, name: 'K-Beauty', partners: 8, revenue: '$3.2M', change: '+15%' },
    { rank: 2, name: 'Robotics', partners: 5, revenue: '$2.8M', change: '+22%' },
    { rank: 3, name: 'Bio Medical', partners: 4, revenue: '$2.1M', change: '+8%' },
]

const activitiesSeed = [
    { id: 1, text: 'New partnership established', detail: 'EcoMobility Partners • 2 hours ago', status: 'success' },
    { id: 2, text: 'Contract renewal completed', detail: 'BeautyTech Korea • 1 day ago', status: 'neutral' },
    { id: 3, text: 'Negotiation in progress', detail: 'TechFlow Solutions • 2 days ago', status: 'warning' },
]

export default function Overview() {
    const { t } = useI18n()
    const navigate = useNavigate()
    const [stats, setStats] = useState(statSeed)
    const [industries, setIndustries] = useState(industriesSeed)
    const [transactions, setTransactions] = useState([])
    const [requests, setRequests] = useState(recentRequestsSeed)

    useEffect(() => {
        let mounted = true

        // Fetch Dashboard Stats
        api.analyticsDashboard().then((data) => {
            if (!mounted || !data) return
            setStats((prev) =>
                prev.map((card) => ({
                    ...card,
                    value: String(data[card.id] ?? card.value),
                }))
            )
        })

        // Fetch Top Industries
        api.analyticsTopIndustries().then((data) => {
            if (!mounted || !Array.isArray(data) || data.length === 0) return
            setIndustries(
                data.slice(0, 3).map((item, index) => ({
                    rank: index + 1,
                    name: item.name,
                    partners: item.partners,
                    revenue: item.revenue ? `$${Number(item.revenue).toLocaleString()}` : '$-',
                    change: '',
                }))
            )
        })

        // Fetch Recent Transactions
        api.analyticsRecentTransactions().then((data) => {
            if (!mounted || !Array.isArray(data)) return
            setTransactions(
                data.slice(0, 5).map((item) => ({
                    id: item.id,
                    company: item.company,
                    description: item.memo || item.description || '',
                    date: item.createdAt ? new Date(item.createdAt).toLocaleString() : '',
                    amount: `${item.amount >= 0 ? '+' : '-'}$${Math.abs(item.amount || 0).toLocaleString()}`,
                    xrpl: `${(item.amount || 0).toLocaleString()} ${item.currency || ''}`,
                    status: item.status?.toLowerCase() === 'paid' ? 'completed' : item.status?.toLowerCase() || 'pending',
                }))
            )
        })

        return () => {
            mounted = false
        }
    }, [])

    return (
        <div className="overview container">
            <div className="dashboard-header row space">
                <div>
                    <h1>{t('overview_title_heading')}</h1>
                    <p className="muted">{t('overview_subheading')}</p>
                </div>
                <div className="row gap-2">
                    <Button variant="ghost" onClick={() => navigate('/search')}>
                        {t('dashboard_open_search')}
                    </Button>
                    <Button onClick={() => track('overview_generate_report')}>
                        {t('dashboard_generate_report')}
                    </Button>
                </div>
            </div>

            {/* Top Stats */}
            <section className="stat-grid">
                {stats.map((card) => (
                    <article key={card.id} className={`stat-card ${card.tone}`}>
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

            {/* Middle Section: Split View */}
            <section className="dashboard-panels" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '2rem' }}>
                {/* Left: Market Insights */}
                <div className="panel">
                    <h3>{t('analytics_top_industries')}</h3>
                    <ul className="industry-list">
                        {industries.map((industry) => (
                            <li key={industry.rank}>
                                <div className="industry-rank">{industry.rank}</div>
                                <div className="industry-info">
                                    <strong>{industry.name}</strong>
                                    <div className="muted tiny">
                                        {industry.partners} {t('analytics_partners')}
                                    </div>
                                </div>
                                <div className="industry-value">
                                    <strong>{industry.revenue}</strong>
                                    <span className="muted tiny">{industry.change}</span>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Right: My Activity */}
                <div className="panel">
                    <h3>{t('dashboard_recent_requests')}</h3>
                    <ul className="request-list">
                        {requests.map((item) => (
                            <li key={item.id}>
                                <div>
                                    <strong>{item.company}</strong>
                                    <div className="muted tiny">
                                        {item.type} • {item.time}
                                    </div>
                                </div>
                                <span className="status-pill">{item.status}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </section>

            {/* Bottom Section: Recent Transactions */}
            <section className="panel" style={{ marginTop: '2rem' }}>
                <h3>{t('payments_recent_transactions')}</h3>
                <ul className="activity-list">
                    {transactions.length === 0
                        ? activitiesSeed.map((activity) => (
                            <li key={activity.id} className={`activity ${activity.status}`}>
                                <div className="activity-indicator" />
                                <div>
                                    <strong>{activity.text}</strong>
                                    <div className="muted tiny">{activity.detail}</div>
                                </div>
                            </li>
                        ))
                        : transactions.map((tx) => (
                            <li key={tx.id} className="activity transaction completed">
                                <div>
                                    <strong>{tx.company}</strong>
                                    <div className="muted tiny">{tx.description}</div>
                                    <div className="muted tiny">{tx.date}</div>
                                </div>
                                <div className="transaction-amount">
                                    <strong>{tx.amount}</strong>
                                    <span className="muted tiny">{tx.xrpl}</span>
                                </div>
                            </li>
                        ))}
                </ul>
            </section>
        </div>
    )
}
