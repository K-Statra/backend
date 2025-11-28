import { useEffect, useState } from 'react'
import { api } from '../api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function AdminStats() {
    const [token, setToken] = useState(localStorage.getItem('adminToken') || '')
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        if (token) load()
    }, [])

    async function load() {
        if (!token) return
        localStorage.setItem('adminToken', token)
        setLoading(true); setError('')
        try {
            const res = await api.adminGetPaymentStats({ token })
            setStats(res)
        } catch (e) { setError(e.message) } finally { setLoading(false) }
    }

    // Transform data for charts
    const statusData = stats?.byStatus ? Object.entries(stats.byStatus).map(([name, value]) => ({ name, value })) : []
    const currencyData = stats?.byCurrency ? Object.entries(stats.byCurrency).map(([name, value]) => ({ name, value })) : []

    return (
        <div className="container">
            <h2>System Stats</h2>
            <div className="row" style={{ marginBottom: 20 }}>
                <input placeholder="X-Admin-Token" value={token} onChange={(e) => setToken(e.target.value)} />
                <button onClick={load} disabled={!token || loading}>{loading ? 'Loading...' : 'Refresh'}</button>
            </div>
            {error && <div className="error">{error}</div>}

            {stats && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                    {/* Summary Cards */}
                    <div className="row" style={{ gap: 16, flexWrap: 'wrap' }}>
                        <div className="card" style={{ padding: 16, flex: 1, minWidth: 200 }}>
                            <h3>Total Transactions</h3>
                            <div style={{ fontSize: '2em' }}>
                                {statusData.reduce((acc, curr) => acc + curr.value, 0)}
                            </div>
                        </div>
                        <div className="card" style={{ padding: 16, flex: 1, minWidth: 200 }}>
                            <h3>Active Currencies</h3>
                            <div style={{ fontSize: '2em' }}>{currencyData.length}</div>
                        </div>
                    </div>

                    {/* Charts Row */}
                    <div className="row" style={{ gap: 32, flexWrap: 'wrap' }}>
                        {/* Status Bar Chart */}
                        <div className="card" style={{ padding: 16, flex: '1 1 400px', height: 400 }}>
                            <h3>Payments by Status</h3>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={statusData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="value" fill="#8884d8" name="Count" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Currency Pie Chart */}
                        <div className="card" style={{ padding: 16, flex: '1 1 400px', height: 400 }}>
                            <h3>Payments by Currency</h3>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={currencyData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                        outerRadius={120}
                                        fill="#8884d8"
                                        dataKey="value"
                                    >
                                        {currencyData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
