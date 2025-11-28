import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api.js'
import CompanyCard from '../ui/CompanyCard.jsx'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import Badge from '../ui/Badge.jsx'

const PAGE_SIZE = 9

function getVideoEmbedUrl(url = '') {
  const trimmed = url.trim()
  if (!trimmed) return ''
  const yt = trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/i)
  if (yt) {
    return `https://www.youtube.com/embed/${yt[1]}`
  }
  const embed = trimmed.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{6,})/i)
  if (embed) return trimmed
  return ''
}

export default function CompanyList() {
  const [form, setForm] = useState({ q: '', industry: '', tag: '', sortBy: 'updatedAt', order: 'desc' })
  const [filters, setFilters] = useState(form)
  const [page, setPage] = useState(1)
  const [companies, setCompanies] = useState([])
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [pendingHighlight, setPendingHighlight] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    const highlight = searchParams.get('companyId') || ''
    if (highlight) setPendingHighlight(highlight)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const res = await api.listCompanies({
          ...filters,
          page,
          limit: PAGE_SIZE,
        })
        if (cancelled) return
        setCompanies(res?.data || [])
        setMeta({
          total: Number(res?.total || 0),
          totalPages: Math.max(1, Number(res?.totalPages || 1)),
        })
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load companies')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [filters, page])

  useEffect(() => {
    if (!pendingHighlight) return
    const match = companies.find((c) => c._id === pendingHighlight)
    if (match) {
      setSelected(match)
      setPendingHighlight('')
    }
  }, [companies, pendingHighlight])

  function onSubmit(e) {
    e.preventDefault()
    setFilters({
      q: form.q.trim(),
      industry: form.industry.trim(),
      tag: form.tag.trim(),
      sortBy: form.sortBy,
      order: form.order,
    })
    setPage(1)
  }

  function resetFilters() {
    const next = { q: '', industry: '', tag: '', sortBy: 'updatedAt', order: 'desc' }
    setForm(next)
    setFilters(next)
    setPage(1)
  }

  const totalLabel = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE + 1
    const end = Math.min(meta.total, page * PAGE_SIZE)
    if (meta.total === 0) return 'No companies yet.'
    return `Showing ${start}-${end} of ${meta.total}`
  }, [meta.total, page])

  function openDetails(company) {
    setSelected(company)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('companyId', company._id)
      return next
    })
  }

  function closeDetails() {
    setSelected(null)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('companyId')
      return next
    })
  }

  const selectedVideoEmbed = useMemo(() => getVideoEmbedUrl(selected?.videoUrl || ''), [selected?.videoUrl])

  return (
    <div>
      <h2>Companies</h2>
      <form className="form" onSubmit={onSubmit}>
        <div className="row gap-4" style={{ flexWrap: 'wrap' }}>
          <input
            placeholder="Search name or profile"
            value={form.q}
            onChange={(e) => setForm((f) => ({ ...f, q: e.target.value }))}
          />
          <input
            placeholder="Industry"
            value={form.industry}
            onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
          />
          <input
            placeholder="Tag"
            value={form.tag}
            onChange={(e) => setForm((f) => ({ ...f, tag: e.target.value }))}
          />
          <select value={form.sortBy} onChange={(e) => setForm((f) => ({ ...f, sortBy: e.target.value }))}>
            <option value="updatedAt">Recently updated</option>
            <option value="name">Name (A-Z)</option>
            <option value="nameNumeric">Name (numeric aware)</option>
          </select>
          <select value={form.order} onChange={(e) => setForm((f) => ({ ...f, order: e.target.value }))}>
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
          </select>
        </div>
        <div className="row gap-4">
          <Button type="submit" loading={loading}>
            Search
          </Button>
          <Button type="button" variant="ghost" onClick={resetFilters} disabled={loading}>
            Reset
          </Button>
        </div>
      </form>

      {loading && <div className="mt-3">Loading companies...</div>}
      {error && (
        <div className="error mt-3" role="alert">
          {error}
        </div>
      )}

      {!loading && companies.length === 0 && !error && (
        <div className="mt-3 muted">No companies match the filters.</div>
      )}

      <div className="grid grid-3 mt-3">
        {companies.map((company) => (
          <CompanyCard
            key={company._id}
            company={company}
            onDetails={() => openDetails(company)}
            onRequestPayment={() => navigate(`/matches?companyId=${company._id}`)}
          />
        ))}
      </div>

      <div className="row space mt-3">
        <div className="muted small">{totalLabel}</div>
        <div className="row gap-4">
          <Button
            variant="secondary"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </Button>
          <Button
            variant="secondary"
            disabled={page >= meta.totalPages || loading}
            onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
          >
            Next
          </Button>
        </div>
      </div>

      <Modal open={!!selected} onClose={closeDetails} title={selected?.name}>
        {selected && (
          <div>
            <div className="muted mb-2">{selected.industry || 'Industry TBD'}</div>
            {selected.images && selected.images.length > 0 && (
              <div className="row gap-2 mb-3" style={{ overflowX: 'auto' }}>
                {selected.images.map((img, i) => (
                  <img key={i} src={img.url} alt={img.alt || selected.name} style={{ height: 150, borderRadius: 8 }} />
                ))}
              </div>
            )}
            {selected.profileText && <p>{selected.profileText}</p>}
            <section className="mt-3">
              <strong>Offerings</strong>
              <ul>
                {(selected.offerings || []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
            <section className="mt-3">
              <strong>Needs</strong>
              <ul>
                {(selected.needs || []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
            {(selected.tags || []).length > 0 && (
              <section className="mt-3">
                <strong>Tags</strong>
                <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
                  {selected.tags.map((tag) => (
                    <Badge key={tag} tone="primary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </section>
            )}
            {selected.videoUrl && (
              <section className="mt-3">
                <strong>Intro video</strong>
                {selectedVideoEmbed ? (
                  <div className="video-frame mt-2">
                    <iframe
                      src={selectedVideoEmbed}
                      title={`${selected.name} intro video`}
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : null}
                <div className="mt-2">
                  <a href={selected.videoUrl} target="_blank" rel="noreferrer">
                    Watch on original site
                  </a>
                </div>
              </section>
            )}
            <div className="row gap-4 mt-4">
              <Button onClick={() => navigate(`/matches?companyId=${selected._id}`)}>See matches</Button>
              <Button variant="secondary" onClick={closeDetails}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
