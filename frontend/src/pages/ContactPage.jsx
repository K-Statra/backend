import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, newIdemKey } from '../api'
import CurrencySelect from '../ui/CurrencySelect'
import Button from '../ui/Button'

export default function ContactPage() {
  const [params] = useSearchParams()
  const buyerId = params.get('buyerId') || ''
  const companyId = params.get('companyId') || ''
  const valid = useMemo(() => /^[a-f0-9]{24}$/i.test(buyerId), [buyerId])
  const [data, setData] = useState([])
  const [creating, setCreating] = useState('')
  const [currency, setCurrency] = useState('XRP')
  const [errorMsg, setErrorMsg] = useState('')
  const nav = useNavigate()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function load() {
      if (!valid) return
      setLoading(true)
      try {
        const res = await api.getMatches(buyerId, 50)
        let arr = res?.data || []
        if (companyId && /^[a-f0-9]{24}$/i.test(companyId)) {
          arr = arr.filter((r) => r.company && r.company._id === companyId)
        }
        setData(arr)
      } finally { setLoading(false) }
    }
    load()
  }, [buyerId, companyId, valid])

  return (
    <div>
      <h2>Matching Detail</h2>
      <div className="row gap-4 mb-3">
        <CurrencySelect value={currency} onChange={setCurrency} />
        {errorMsg && <div className="error">{errorMsg}</div>}
      </div>
      {!valid && <div className="error">buyerId is required.</div>}
      {loading && <div>Loading...</div>}
      {data.map((r) => (
        <div key={r.company._id} className="card" style={{ marginBottom: 12 }}>
          <div className="row space"><strong>{r.company.name}</strong><span className="muted">score {r.score.toFixed?.(2) ?? r.score}</span></div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, marginTop: 8 }}>
            <div>
              <div className="muted small">Analysis 1: Tags overlap</div>
              <div>{(r.reasons || []).find((x) => x.includes('tags')) || '-'}</div>
            </div>
            <div>
              <div className="muted small">Analysis 2: Industry match</div>
              <div>{(r.reasons || []).find((x) => x.includes('industry')) || '-'}</div>
            </div>
            <div>
              <div className="muted small">Analysis 3: Needs vs offerings</div>
              <div>{(r.reasons || []).find((x) => x.includes('needs-offerings')) || '-'}</div>
            </div>
            <div>
              <div className="muted small">Analysis 4: Recency</div>
              <div>{(r.reasons || []).find((x) => x.includes('recently')) || '-'}</div>
            </div>
          </div>
          <div style={{ marginTop: 8 }}>
            <label className="muted small">Feedback</label>
            <textarea rows={3} placeholder="Leave your thoughts about this match (not saved yet)." style={{ width: '100%' }} />
          </div>
          <div className="row gap-4 mt-3">
            <Button variant="secondary" onClick={() => nav(`/companies/${r.company._id}`)}>Company Detail</Button>
            <Button
              loading={creating === r.company._id}
              onClick={async () => {
                try {
                  setCreating(r.company._id)
                  const idem = newIdemKey()
                  const targetCompanyId = companyId && /^[a-f0-9]{24}$/i.test(companyId) ? companyId : r.company._id
                  setErrorMsg('')
                  const res = await api.createPayment({ amount: 1, currency, buyerId, companyId: targetCompanyId }, idem)
                  const pid = res?.payment?._id || res?._id
                  if (pid) nav(`/payments/checkout/${pid}`)
                } catch (e) {
                  setErrorMsg(e.message || 'failed')
                } finally { setCreating('') }
              }}
            >Request Payment</Button>
          </div>
        </div>
      ))}
    </div>
  )
}
