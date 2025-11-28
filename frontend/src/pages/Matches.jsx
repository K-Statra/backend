import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api, newIdemKey } from '../api.js'
import CurrencySelect from '../ui/CurrencySelect.jsx'
import Button from '../ui/Button.jsx'
import Card from '../ui/Card.jsx'

function isObjectId(value) {
  return /^[a-f0-9]{24}$/i.test(String(value || '').trim())
}

export default function Matches() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [buyerInput, setBuyerInput] = useState(searchParams.get('buyerId') || localStorage.getItem('kstatra_buyer_id') || '')
  const [limitInput, setLimitInput] = useState(() => {
    const raw = Number(searchParams.get('limit') || 5)
    return Number.isFinite(raw) ? Math.min(Math.max(raw, 1), 20) : 5
  })
  const [companyFilter, setCompanyFilter] = useState(searchParams.get('companyId') || '')
  const [currency, setCurrency] = useState('XRP')
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [creatingPayment, setCreatingPayment] = useState('')
  const [activeBuyerId, setActiveBuyerId] = useState(searchParams.get('buyerId') || localStorage.getItem('kstatra_buyer_id') || '')
  const navigate = useNavigate()

  const filteredMatches = useMemo(() => {
    if (!companyFilter) return matches
    return matches.filter((item) => item.company && item.company._id === companyFilter)
  }, [matches, companyFilter])

  const loadMatches = useCallback(
    async (buyerIdValue, limitValue) => {
      if (!isObjectId(buyerIdValue)) {
        setError('Valid buyerId (24 hex) required.')
        return
      }
      setLoading(true)
      setError('')
      setMessage('')
      try {
        const res = await api.getMatches(buyerIdValue, limitValue)
        setMatches(res?.data || [])
        setActiveBuyerId(buyerIdValue)
        if (companyFilter && res && Array.isArray(res.data) && res.data.every((r) => r.company?._id !== companyFilter)) {
          setMessage('Selected company is not in the latest top results.')
        }
      } catch (err) {
        setError(err.message || 'Failed to load matches')
      } finally {
        setLoading(false)
      }
    },
    [companyFilter]
  )

  useEffect(() => {
    const initialBuyerId = searchParams.get('buyerId') || localStorage.getItem('kstatra_buyer_id')
    if (isObjectId(initialBuyerId)) {
      setBuyerInput(initialBuyerId)
      loadMatches(initialBuyerId, limitInput)
    }
  }, [])

  function updateParams(nextBuyerId, nextLimit, nextCompanyId) {
    const next = new URLSearchParams()
    if (nextBuyerId) next.set('buyerId', nextBuyerId)
    if (nextLimit) next.set('limit', String(nextLimit))
    if (nextCompanyId) next.set('companyId', nextCompanyId)
    setSearchParams(next)
  }

  async function onSubmit(e) {
    e.preventDefault()
    if (!isObjectId(buyerInput)) {
      setError('Valid buyerId (24 hex) required.')
      return
    }
    updateParams(buyerInput.trim(), limitInput, companyFilter.trim() || '')
    await loadMatches(buyerInput.trim(), limitInput)
  }

  async function createPayment(companyId) {
    if (!activeBuyerId) return
    setCreatingPayment(companyId)
    setMessage('')
    try {
      const payload = {
        amount: 1,
        currency,
        buyerId: activeBuyerId,
        companyId,
      }
      const res = await api.createPayment(payload, newIdemKey())
      const pid = res?.payment?._id || res?._id
      if (pid) navigate(`/payments/checkout/${pid}`)
    } catch (err) {
      setMessage(err.message || 'Failed to create payment')
    } finally {
      setCreatingPayment('')
    }
  }

  return (
    <div>
      <h2>Matches</h2>
      <form className="form" onSubmit={onSubmit}>
        <div className="row gap-4" style={{ flexWrap: 'wrap' }}>
          <input
            value={buyerInput}
            onChange={(e) => setBuyerInput(e.target.value)}
            placeholder="Buyer ID (Mongo ObjectId)"
          />
          <input
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            placeholder="Optional companyId filter"
          />
          <input
            type="number"
            min="1"
            max="20"
            value={limitInput}
            onChange={(e) => setLimitInput(Math.min(Math.max(Number(e.target.value) || 1, 1), 20))}
          />
          <Button type="submit" loading={loading}>
            Load Matches
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setBuyerInput('')
              setCompanyFilter('')
              setMatches([])
              setActiveBuyerId('')
              updateParams('', '', '')
            }}
            disabled={loading}
          >
            Clear
          </Button>
        </div>
      </form>
      <div className="mt-3">
        Need sample data? Run <code>npm run seed:buyers</code> / <code>npm run seed:companies</code> in the backend.
      </div>

      <div className="mt-4">
        <CurrencySelect value={currency} onChange={setCurrency} />
      </div>

      {error && (
        <div className="error mt-3" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="card mt-3" role="status">
          {message}
        </div>
      )}

      {!loading && filteredMatches.length === 0 && activeBuyerId && !error && (
        <div className="mt-4 muted">No matches yet. Try increasing the limit or updating company data.</div>
      )}

      <div className="grid mt-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        {filteredMatches.map((match) => (
          <Card key={match.company?._id || match.score}>
            <div className="row space">
              <div>
                <strong>{match.company?.name}</strong>
                <div className="muted small">{match.company?.industry}</div>
              </div>
              <span className="badge primary">score {Number(match.score).toFixed(2)}</span>
            </div>
            {match.company?.images?.[0]?.url && (
              <div style={{ marginTop: '1rem', borderRadius: '8px', overflow: 'hidden', maxHeight: '200px' }}>
                <img src={match.company.images[0].url} alt={match.company.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}
            {(match.reasons || []).length > 0 && (
              <ul className="mt-3 small">
                {match.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            )}
            <div className="row gap-4 mt-3" style={{ flexWrap: 'wrap' }}>
              <Button variant="secondary" onClick={() => navigate(`/companies?companyId=${match.company?._id}`)}>
                Details
              </Button>
              {match.company?.videoUrl && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    window.open(match.company.videoUrl, '_blank', 'noopener,noreferrer')
                  }}
                >
                  Watch video
                </Button>
              )}
              <Button
                loading={creatingPayment === match.company?._id}
                onClick={() => createPayment(match.company?._id)}
              >
                Request Payment
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-4">
        <Link to="/buyers/new">Create a new buyer</Link> ·{' '}
        <Link to="/companies">Browse companies</Link>
      </div>
    </div>
  )
}
