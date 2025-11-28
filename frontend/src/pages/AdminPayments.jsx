import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/I18nProvider'
import { useDatePreset } from '../hooks/useDatePreset'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api'

export default function AdminPayments() {
  const { t } = useI18n()
  const [token, setToken] = useState(localStorage.getItem('adminToken') || '')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [filters, setFilters] = useState({ status: '', buyerId: '', companyId: '', from: '', to: '' })
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [stats, setStats] = useState({ since: '', byStatus: {}, byCurrency: {}, byCurrencyStatus: {} })
  const { presetSel, applyPreset, markCustom, resetPreset } = useDatePreset()
  const [customPreset, setCustomPreset] = useState('') // e.g., '90m'
  const [tzMode, setTzMode] = useState('local') // 'local' | 'utc'
  const [searchParams, setSearchParams] = useSearchParams()
  const [clearUrlOnReset, setClearUrlOnReset] = useState(false)

  // Restore tzMode from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('admin_tz_mode')
      if (saved === 'utc' || saved === 'local') setTzMode(saved)
    } catch (_) { }
    // Initialize filters from URL query if present
    try {
      const p = Object.fromEntries([...searchParams])
      const f = { ...filters }
      if (p.status) f.status = p.status
      if (p.buyerId) f.buyerId = p.buyerId
      if (p.companyId) f.companyId = p.companyId
      if (p.from && p.to) {
        f.from = p.from
        f.to = p.to
        setFilters(f)
        markCustom()
      } else if (p.preset) {
        if (p.preset === '24h') applyPreset(1, setFilters)
        else if (p.preset === '7d') applyPreset(7, setFilters)
        else if (p.preset === '30d') applyPreset(30, setFilters)
        else setFilters(f)
      } else {
        setFilters(f)
      }
      if (p.tz === 'utc' || p.tz === 'local') setTzMode(p.tz)
    } catch (_) { }
  }, [])

  async function load(p = page) {
    if (!token) return
    localStorage.setItem('adminToken', token)
    setLoading(true); setError('')
    try {
      const res = await api.adminListPayments({ token, page: p, limit: 20, ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v)) })
      setItems(res?.data || [])
      setTotalPages(res?.totalPages || 1)
      setPage(res?.page || p)
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  useEffect(() => { /* noop */ }, [])

  async function exportCsv() {
    if (!token) return
    try {
      const blob = await api.adminExportPayments({ token, ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v)) })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'payments.csv'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e.message || 'Export failed')
    }
  }

  function isValidIso(s) {
    if (!s) return true
    const d = new Date(s)
    return !isNaN(d.getTime())
  }

  function isValidRange(from, to) {
    if (!from || !to) return true
    return new Date(from).getTime() <= new Date(to).getTime()
  }

  function updateQuery(extra = {}) {
    try {
      const base = { ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v)), tz: tzMode, ...extra }
      if (base.preset) { delete base.from; delete base.to } else { delete base.preset }
      const params = new URLSearchParams(base)
      setSearchParams(params)
    } catch (_) { }
  }

  function preset(days) {
    const range = applyPreset(days, setFilters)
    updateQuery({ preset: days === 1 ? '24h' : days === 7 ? '7d' : '30d' })
    return range
  }

  // Keep URL query in sync when filters/tz/preset change (debounced)
  useEffect(() => {
    const t = setTimeout(() => {
      updateQuery({ preset: presetSel })
    }, 300)
    return () => clearTimeout(t)
  }, [filters.status, filters.buyerId, filters.companyId, filters.from, filters.to, tzMode, presetSel])

  // Helpers: ISO <-> datetime-local
  function isoToLocalInput(v) {
    if (!v) return ''
    const d = new Date(v)
    if (isNaN(d.getTime())) return ''
    const pad = (n) => (n < 10 ? '0' + n : String(n))
    const yyyy = d.getFullYear()
    const mm = pad(d.getMonth() + 1)
    const dd = pad(d.getDate())
    const hh = pad(d.getHours())
    const mi = pad(d.getMinutes())
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
  }
  function localInputToIso(v) {
    if (!v) return ''
    const d = new Date(v)
    if (isNaN(d.getTime())) return ''
    return d.toISOString()
  }
  // For UTC mode: represent/edit as UTC digits
  function isoToUtcInput(v) {
    if (!v) return ''
    const d = new Date(v)
    if (isNaN(d.getTime())) return ''
    const pad = (n) => (n < 10 ? '0' + n : String(n))
    const yyyy = d.getUTCFullYear()
    const mm = pad(d.getUTCMonth() + 1)
    const dd = pad(d.getUTCDate())
    const hh = pad(d.getUTCHours())
    const mi = pad(d.getUTCMinutes())
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
  }
  function utcInputToIso(v) {
    if (!v) return ''
    // Parse as UTC components and build ISO
    const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)
    if (!m) return ''
    const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), 0, 0)
    return new Date(ms).toISOString()
  }

  return (
    <div>
      <h2>Admin Payments</h2>
      {stats && (
        <div className="row" style={{ gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
          <div className="card" style={{ padding: 8 }}>
            <strong>{t('admin_by_status_7d')}</strong>
            <div className="muted">{t('since')} {stats.since ? new Date(stats.since).toLocaleString() : '-'}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {Object.entries(stats.byStatus || {}).map(([k, v]) => (
                <span key={k} className="badge">{k}: {v}</span>
              ))}
            </div>
          </div>
          <div className="card" style={{ padding: 8 }}>
            <strong>{t('admin_by_currency_7d')}</strong>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {Object.entries(stats.byCurrency || {}).map(([k, v]) => (
                <span key={k} className="badge">{k}: {v}</span>
              ))}
            </div>
          </div>
          <div className="card" style={{ padding: 8, flex: '1 1 100%' }}>
            <strong>{t('admin_by_currency_status_7d')}</strong>
            <table className="table" style={{ marginTop: 8 }}>
              <thead>
                <tr>
                  <th>{t('currency_label')}</th>
                  {['CREATED', 'PENDING', 'PAID', 'FAILED', 'CANCELLED'].map((s) => (
                    <th key={s}>{s}</th>
                  ))}
                  <th>{t('total')}</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(stats.byCurrencyStatus || {}).map(([cur, map]) => {
                  const rowTotal = ['CREATED', 'PENDING', 'PAID', 'FAILED', 'CANCELLED'].reduce((acc, s) => acc + (map?.[s] ?? 0), 0)
                  return (
                    <tr key={cur}>
                      <td>{cur}</td>
                      {['CREATED', 'PENDING', 'PAID', 'FAILED', 'CANCELLED'].map((s) => (
                        <td key={s}>{map?.[s] ?? 0}</td>
                      ))}
                      <td>{rowTotal}</td>
                    </tr>
                  )
                })}
                {(() => {
                  const totals = { CREATED: 0, PENDING: 0, PAID: 0, FAILED: 0, CANCELLED: 0 }
                  Object.values(stats.byCurrencyStatus || {}).forEach((map) => {
                    for (const s of Object.keys(totals)) totals[s] += (map?.[s] ?? 0)
                  })
                  const grand = Object.values(totals).reduce((a, b) => a + b, 0)
                  return (
                    <tr>
                      <td><strong>{t('total')}</strong></td>
                      {['CREATED', 'PENDING', 'PAID', 'FAILED', 'CANCELLED'].map((s) => (
                        <td key={s}><strong>{totals[s]}</strong></td>
                      ))}
                      <td><strong>{grand}</strong></td>
                    </tr>
                  )
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div className="row">
        <input placeholder="X-Admin-Token" value={token} onChange={(e) => setToken(e.target.value)} />
        <button title={t('copy_current_link')} onClick={async () => {
          setError('')
          if (!isValidIso(filters.from) || !isValidIso(filters.to)) { setError(t('invalid_iso')); return }
          if (!isValidRange(filters.from, filters.to)) { setError(t('range_invalid')); return }
          updateQuery({ preset: presetSel })
          await load(1)
          try { const s = await api.adminGetPaymentStats({ token, from: filters.from, to: filters.to, buyerId: filters.buyerId, companyId: filters.companyId }); setStats(s) } catch { }
        }} disabled={!token || loading}>{loading ? t('loading') : t('load')}</button>
        <button onClick={async () => {
          setError('')
          if (!isValidIso(filters.from) || !isValidIso(filters.to)) { setError(t('invalid_iso')); return }
          if (!isValidRange(filters.from, filters.to)) { setError(t('range_invalid')); return }
          updateQuery({ preset: presetSel })
          await exportCsv()
        }} disabled={!token}>{t('export_csv')}</button>
      </div>
      <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <button disabled={loading} style={presetSel === '24h' ? { fontWeight: 'bold', textDecoration: 'underline' } : {}} onClick={async () => { setCustomPreset(''); const r = preset(1); await load(1); try { const s = await api.adminGetPaymentStats({ token, from: r.from, to: r.to, buyerId: filters.buyerId, companyId: filters.companyId }); setStats(s) } catch { } }}>{t('last_24h')}</button>
        <button disabled={loading} style={presetSel === '7d' ? { fontWeight: 'bold', textDecoration: 'underline' } : {}} onClick={async () => { setCustomPreset(''); const r = preset(7); await load(1); try { const s = await api.adminGetPaymentStats({ token, from: r.from, to: r.to, buyerId: filters.buyerId, companyId: filters.companyId }); setStats(s) } catch { } }}>{t('last_7d')}</button>
        <button disabled={loading} style={presetSel === '30d' ? { fontWeight: 'bold', textDecoration: 'underline' } : {}} onClick={async () => { setCustomPreset(''); const r = preset(30); await load(1); try { const s = await api.adminGetPaymentStats({ token, from: r.from, to: r.to, buyerId: filters.buyerId, companyId: filters.companyId }); setStats(s) } catch { } }}>{t('last_30d')}</button>
        <button disabled={loading} style={customPreset === '90m' ? { fontWeight: 'bold', textDecoration: 'underline' } : {}} onClick={async () => {
          // Last 90 minutes (custom)
          const now = new Date();
          const from = new Date(now.getTime() - 90 * 60 * 1000).toISOString();
          const to = now.toISOString();
          setFilters((f) => ({ ...f, from, to }));
          markCustom();
          setCustomPreset('90m');
          updateQuery({});
          await load(1);
          try { const s = await api.adminGetPaymentStats({ token, from, to, buyerId: filters.buyerId, companyId: filters.companyId }); setStats(s) } catch { }
        }}>{t('last_90m')}</button>
        {presetSel === 'custom' && <span className="muted">{t('custom_range')}</span>}
      </div>
      {presetSel && presetSel !== 'custom' && (
        <div className="muted" style={{ marginTop: 4 }}>{t('link_preset_hint')}</div>
      )}
      <div className="row" style={{ gap: 8, marginTop: 8 }}>
        <button onClick={async () => {
          try {
            const params = new URLSearchParams({ ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v)), tz: tzMode, preset: presetSel || '' })
            if (presetSel) { params.delete('from'); params.delete('to') }
            const url = `${window.location.origin}${window.location.pathname}?${String(params)}`
            await navigator.clipboard.writeText(url)
            setMsg(t('link_copied'))
            setTimeout(() => setMsg(''), 1500)
          } catch (e) { setError(e?.message || 'copy failed') }
        }}>{t('copy_current_link')}</button>
        <button title={t('open_current_link')} onClick={() => {
          try {
            const params = new URLSearchParams({ ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v)), tz: tzMode, preset: presetSel || '' })
            if (presetSel) { params.delete('from'); params.delete('to') }
            const url = `${window.location.origin}${window.location.pathname}?${String(params)}`
            window.open(url, '_blank')
          } catch (e) { setError(e?.message || 'open failed') }
        }}>{t('open_current_link')}</button>
        <button onClick={() => {
          setFilters({ status: '', buyerId: '', companyId: '', from: '', to: '' })
          resetPreset()
          setCustomPreset('')
          if (clearUrlOnReset) {
            try { setSearchParams(new URLSearchParams()) } catch (_) { }
          } else {
            updateQuery({})
          }
          setMsg(t('filters_reset'))
          setTimeout(() => setMsg(''), 1200)
        }}>{t('reset_filters')}</button>
      </div>
      <div className="row" style={{ gap: 8, marginTop: 4, alignItems: 'center' }}>
        <label className="row" style={{ alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={clearUrlOnReset} onChange={(e) => setClearUrlOnReset(e.target.checked)} />
          <span className="muted">{t('clear_url_on_reset')}</span>
        </label>
      </div>
      <div className="muted" style={{ marginTop: 4 }}>{t('link_excludes_token')}</div>
      <div className="row" style={{ gap: 8, marginTop: 8 }}>
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">status: any</option>
          <option value="CREATED">CREATED</option>
          <option value="PENDING">PENDING</option>
          <option value="PAID">PAID</option>
          <option value="FAILED">FAILED</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>
        <input placeholder="buyerId" value={filters.buyerId} onChange={(e) => setFilters({ ...filters, buyerId: e.target.value })} />
        <input placeholder="companyId" value={filters.companyId} onChange={(e) => setFilters({ ...filters, companyId: e.target.value })} />
        <label className="row" style={{ alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={tzMode === 'utc'} onChange={(e) => { const mode = e.target.checked ? 'utc' : 'local'; setTzMode(mode); try { localStorage.setItem('admin_tz_mode', mode) } catch (_) { }; try { const params = new URLSearchParams({ ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v)), tz: mode }); setSearchParams(params) } catch (_) { } }} />
          <span className="muted">{t('tz_use_utc')}</span>
        </label>
        <input
          type="datetime-local"
          placeholder={`${t('from')} (ISO)`}
          title={presetSel !== 'custom' ? `${t('from')} (${presetSel})` : ''}
          readOnly={presetSel !== 'custom'}
          onFocus={() => markCustom()}
          value={tzMode === 'utc' ? isoToUtcInput(filters.from) : isoToLocalInput(filters.from)}
          onChange={(e) => { setFilters({ ...filters, from: tzMode === 'utc' ? utcInputToIso(e.target.value) : localInputToIso(e.target.value) }); markCustom() }}
        />
        <input
          type="datetime-local"
          placeholder={`${t('to')} (ISO)`}
          title={presetSel !== 'custom' ? `${t('to')} (${presetSel})` : ''}
          readOnly={presetSel !== 'custom'}
          onFocus={() => markCustom()}
          value={tzMode === 'utc' ? isoToUtcInput(filters.to) : isoToLocalInput(filters.to)}
          onChange={(e) => { setFilters({ ...filters, to: tzMode === 'utc' ? utcInputToIso(e.target.value) : localInputToIso(e.target.value) }); markCustom() }}
        />
      </div>
      <div className="muted" style={{ marginTop: 4 }}>
        {t('tz_hint')} · <strong>{t('tz_label_local')}</strong> → <strong>{t('tz_label_server')}</strong>
      </div>
      {error && <div className="error">{error}</div>}
      {msg && <div className="info">{msg}</div>}
      <table className="table">
        <thead><tr><th>ID</th><th>Status</th><th>Amount</th><th>Currency</th></tr></thead>
        <tbody>
          {items.map((p) => (
            <tr key={p._id}>
              <td><a href={`/payments/${p._id}`}>{p._id}</a></td>
              <td>{p.status}</td>
              <td>{p.amount}</td>
              <td>{p.currency}</td>
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

