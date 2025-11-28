import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api'

export default function AdminMatches() {
    const [token, setToken] = useState(localStorage.getItem('adminToken') || '')
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [searchParams, setSearchParams] = useSearchParams()
    const [buyerId, setBuyerId] = useState(searchParams.get('buyerId') || '')

    useEffect(() => {
        if (token) load(1)
    }, [])

    async function load(p = 1) {
        if (!token) return
        localStorage.setItem('adminToken', token)
        setLoading(true); setError('')
        try {
            const res = await api.adminListMatches({ token, page: p, buyerId })
            setItems(res?.data || [])
            setTotalPages(res?.totalPages || 1)
            setPage(res?.page || p)
        } catch (e) { setError(e.message) } finally { setLoading(false) }
    }

    return (
        <div>
            <h2>Admin Match Logs</h2>
            <div className="row">
                <input placeholder="X-Admin-Token" value={token} onChange={(e) => setToken(e.target.value)} />
                <input placeholder="Buyer ID" value={buyerId} onChange={(e) => setBuyerId(e.target.value)} />
                <button onClick={() => load(1)} disabled={!token || loading}>{loading ? 'Loading...' : 'Load'}</button>
            </div>
            {error && <div className="error">{error}</div>}
            <table className="table">
                <thead><tr><th>Time</th><th>Buyer</th><th>Results</th></tr></thead>
                <tbody>
                    {items.map((m) => (
                        <tr key={m._id}>
                            <td>{new Date(m.createdAt).toLocaleString()}</td>
                            <td>{m.buyerId?.name || m.buyerId}</td>
                            <td>
                                {m.results.slice(0, 3).map((r, i) => (
                                    <div key={i} style={{ fontSize: '0.9em' }}>
                                        {r.score.toFixed(1)}: {r.reasons.join(', ')}
                                    </div>
                                ))}
                                {m.results.length > 3 && <div>...</div>}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <div className="row" style={{ gap: 8, marginTop: 8 }}>
                <button disabled={page <= 1 || loading} onClick={() => load(page - 1)}>Prev</button>
                <span>Page {page} / {totalPages}</span>
                <button disabled={page >= totalPages || loading} onClick={() => load(page + 1)}>Next</button>
            </div>
        </div>
    )
}
