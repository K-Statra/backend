import { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'
import Button from '../ui/Button.jsx'
import { useI18n } from '../i18n/I18nProvider.jsx'
import CompanyResultCard from '../ui/CompanyResultCard.jsx'
import Modal from '../ui/Modal.jsx'
import { track } from '../utils/analytics.js'

const sidebarPresets = {
  partnership: [
    { value: '', label: 'All partnership types' },
    { value: 'Buyer', label: 'Buyer / Distributor' },
    { value: 'Supplier', label: 'Supplier / Vendor' },
    { value: 'Manufacturer', label: 'Manufacturer' },
    { value: 'Technology', label: 'Technology Partner' },
  ],
  industry: [
    { value: '', label: 'All industries' },
    { value: 'AI & Data', label: 'AI & Data' },
    { value: 'Beauty & Lifestyle', label: 'Beauty & Lifestyle' },
    { value: 'Healthcare', label: 'Healthcare' },
    { value: 'Manufacturing', label: 'Manufacturing' },
  ],
  country: [
    { value: '', label: 'All countries' },
    { value: 'South Korea', label: 'South Korea' },
    { value: 'Japan', label: 'Japan' },
    { value: 'United States', label: 'United States' },
    { value: 'Germany', label: 'Germany' },
  ],
  size: [
    { value: '', label: 'Any size' },
    { value: '1-10', label: '1-10' },
    { value: '11-50', label: '11-50' },
    { value: '51-200', label: '51-200' },
    { value: '200+', label: '200+' },
  ],
}

const consultantServices = {
  'matching-assistant': 'Matching assistant',
  'regional-consulting': 'Regional expert consulting',
  'origin-support': 'Certificate of origin support',
  aftercare: 'Deal aftercare',
}

const consultantOptions = [
  { value: 'export-agency', label: '수출대행 에이전트 (Export Agency)' },
  { value: 'regional-consulting', label: '지역전문가 컨설팅 (Regional Expert)' },
  { value: 'trade-document', label: '무역서류 지원 (Trade Documents)' },
]

const SEARCH_PROVIDER = (import.meta.env.VITE_SEARCH_PROVIDER || 'codex').toLowerCase()
const ANTIGRAVITY_BASE =
  import.meta.env.VITE_ANTIGRAVITY_BASE || import.meta.env.VITE_ANTIGRAVITY_URL || ''
const ANTIGRAVITY_KEY = import.meta.env.VITE_ANTIGRAVITY_KEY || ''

function formatCompanyLocation(company = {}) {
  const parts = [company.city, company.state, company.country]
  const loc = company.location
  if (typeof loc === 'string') parts.push(loc)
  else if (loc && typeof loc === 'object') {
    parts.push(loc.city, loc.state, loc.country, loc.label)
  }
  return parts.filter(Boolean).join(', ')
}

function extractWebsite(company = {}) {
  return company.website || company.url || company.site || company.domain || ''
}

function getAccuracyScore(company = {}) {
  const candidates = [
    company.matchAccuracy,
    company.accuracyScore,
    company.confidence,
    company.confidenceScore,
    company.score,
    company.matchScore,
    company.matchingScore,
    company.overallScore,
  ]
  const firstDefined = candidates.find((value) => value !== undefined && value !== null)
  const raw = Number(firstDefined)
  if (!Number.isFinite(raw)) return 82
  if (raw > 1) return Math.max(0, Math.min(100, Math.round(raw)))
  return Math.max(0, Math.min(100, Math.round(raw * 100)))
}

function buildMatchAnalysis(company = {}, t) {
  const sourceList = company.matchAnalysis || company.analysis || []
  if (Array.isArray(sourceList) && sourceList.length > 0) {
    return sourceList.map((item, index) => ({
      label: item.label || `${t('detail_analysis_generic')} ${index + 1}`,
      score:
        typeof item.score === 'number'
          ? item.score > 1
            ? Math.min(100, Math.max(0, Math.round(item.score)))
            : Math.min(100, Math.max(0, Math.round(item.score * 100)))
          : null,
      description: item.description || '',
    }))
  }
  const reasons = company.matchReasons || company.reasons || []
  if (Array.isArray(reasons) && reasons.length > 0) {
    return reasons.map((reason, index) => ({
      label: `${t('detail_analysis_generic')} ${index + 1}`,
      score: null,
      description: reason,
    }))
  }
  return []
}

function getMatchRecommendation(company = {}) {
  return company.matchRecommendation || company.aiRecommendation || company.recommendation || ''
}

function normalizeAntigravityCompany(item = {}) {
  const loc = item.location || {}
  const tags = item.tags || item.capabilities || item.offerings || []
  const reasons = item.analysis || item.reasons || item.matchAnalysis || []
  const rec = item.recommendation || item.summary || item.matchRecommendation || ''
  return {
    _id: item._id || item.id || item.companyId || item.externalId,
    name: item.name || item.companyName || '',
    industry: item.industry || item.vertical || '',
    country: item.country || loc.country || '',
    city: item.city || loc.city || '',
    state: item.state || loc.state || '',
    location: loc,
    tags,
    offerings: item.offerings,
    matchAccuracy:
      item.matchAccuracy || item.accuracyScore || item.score || item.matchScore || item.confidenceScore,
    matchAnalysis: Array.isArray(reasons) ? reasons : [],
    matchRecommendation: rec,
    website: item.website || item.url || item.site || '',
    sizeBucket: item.size || item.employeeCountRange || item.companySize,
    images: item.images || [],
  }
}

async function searchCodex(payload) {
  const res = await api.listCompanies(payload)
  return { provider: 'codex', data: res?.data || [] }
}

async function searchAntigravity(payload) {
  if (!ANTIGRAVITY_BASE) throw new Error('Antigravity base URL not configured')
  const base = ANTIGRAVITY_BASE.replace(/\/$/, '')
  const qs = new URLSearchParams({ limit: '6', ...payload })
  const response = await fetch(`${base}/partners/search?${qs.toString()}`, {
    headers: ANTIGRAVITY_KEY ? { Authorization: `Bearer ${ANTIGRAVITY_KEY}` } : undefined,
  })
  if (!response.ok) {
    const message = response.statusText || 'Antigravity search failed'
    throw new Error(message)
  }
  const json = await response.json()
  const raw = Array.isArray(json?.data) ? json.data : Array.isArray(json?.results) ? json.results : []
  const mapped = raw.map(normalizeAntigravityCompany).filter((c) => c._id && c.name)
  return { provider: 'antigravity', data: mapped }
}

function mergeHybrid(codexResult = [], agResult = []) {
  const combined = []
  const seen = new Set()
  const pushUnique = (item) => {
    const key = item?._id || item?.name
    if (!key || seen.has(key)) return
    seen.add(key)
    combined.push(item)
  }
  agResult.forEach(pushUnique)
  codexResult.forEach(pushUnique)
  return combined
}

async function searchPartners(payload) {
  if (SEARCH_PROVIDER === 'antigravity') {
    return searchAntigravity(payload)
  }
  if (SEARCH_PROVIDER === 'hybrid') {
    try {
      const ag = await searchAntigravity(payload)
      const cx = await searchCodex(payload)
      return { provider: 'hybrid', data: mergeHybrid(cx.data, ag.data) }
    } catch (err) {
      const cx = await searchCodex(payload)
      return { provider: 'codex', data: cx.data, fallback: 'antigravity' }
    }
  }
  return searchCodex(payload)
}

export default function PartnerSearch() {
  const [search, setSearch] = useState('')
  const [preview, setPreview] = useState([])
  const [loadingCompanies, setLoadingCompanies] = useState(false)
  const [companyError, setCompanyError] = useState('')
  const [searchProviderUsed, setSearchProviderUsed] = useState(SEARCH_PROVIDER)

  const [filters, setFilters] = useState({ industry: '', country: '', size: '', partnership: '' })
  const [selectedCompany, setSelectedCompany] = useState(null)
  const [feedback, setFeedback] = useState({ rating: 0, comments: '' })
  const [feedbackStatus, setFeedbackStatus] = useState({ submitting: false, submitted: false, error: '' })
  const [consultModal, setConsultModal] = useState(false)
  const [consultForm, setConsultForm] = useState({ name: '', email: '', details: '', serviceType: 'matching-assistant' })
  const [consultStatus, setConsultStatus] = useState({ submitting: false, success: false, error: '' })
  const [selectedService, setSelectedService] = useState(consultantOptions[0].value)

  const { t, lang } = useI18n()
  const hasRealResults = preview.length > 0
  const displayCompanies = hasRealResults ? preview : []
  const handleCompanyDetails = (company) => {
    setSelectedCompany(company)
    setFeedback({ rating: 0, comments: '' })
    setFeedbackStatus({ submitting: false, submitted: false, error: '' })
    track('partner_detail_opened', { companyId: company?._id, name: company?.name })
  }

  const closeCompanyDetails = () => {
    setSelectedCompany(null)
    setFeedback({ rating: 0, comments: '' })
    setFeedbackStatus({ submitting: false, submitted: false, error: '' })
  }
  const openConsultModal = (serviceType = 'matching-assistant') => {
    setConsultForm((prev) => ({ ...prev, serviceType }))
    setConsultStatus({ submitting: false, success: false, error: '' })
    setConsultModal(true)
  }
  const detailWebsite = selectedCompany ? extractWebsite(selectedCompany) : ''
  const detailLocation = selectedCompany ? formatCompanyLocation(selectedCompany) : ''
  const detailTags = selectedCompany ? selectedCompany.tags || selectedCompany.offerings || [] : []
  const overallConfidence = selectedCompany ? getAccuracyScore(selectedCompany) : null
  const analysisEntries = selectedCompany ? buildMatchAnalysis(selectedCompany, t) : []
  const recommendationText = selectedCompany ? getMatchRecommendation(selectedCompany) : ''
  const recommendationDisplay =
    selectedCompany && (recommendationText || t('detail_recommendation_placeholder'))
  const highlightCards = useMemo(() => {
    if (!selectedCompany) return []
    const fallback = t('detail_not_provided')
    const partnershipValue = (selectedCompany.tags || []).slice(0, 3).join(', ')
    const countryValue = selectedCompany.country || selectedCompany.location?.country || ''
    return [
      { id: 'industry', label: t('filter_industry'), value: selectedCompany.industry || fallback },
      { id: 'partnership', label: t('filter_partnership_type'), value: partnershipValue || fallback },
      { id: 'country', label: t('filter_country'), value: countryValue || fallback },
    ]
  }, [selectedCompany, t])
  const onSubmitFeedback = async (event) => {
    event.preventDefault()
    if (!selectedCompany || !feedback.rating) return
    setFeedbackStatus({ submitting: true, submitted: false, error: '' })
    try {
      await api.submitMatchFeedback(selectedCompany._id, {
        rating: feedback.rating,
        comments: feedback.comments.trim(),
        locale: lang,
        source: 'partner-search',
      })
      track('feedback_submitted', {
        companyId: selectedCompany?._id,
        rating: feedback.rating,
        hasComments: Boolean(feedback.comments?.trim()),
      })
      setFeedbackStatus({ submitting: false, submitted: true, error: '' })
    } catch (err) {
      setFeedbackStatus({
        submitting: false,
        submitted: false,
        error: err?.message || 'Failed to submit feedback',
      })
    }
  }

  async function loadPreview({ term = '', filters: filterValues = {} } = {}) {
    setLoadingCompanies(true)
    setCompanyError('')
    try {
      const sanitizedFilters = Object.fromEntries(
        Object.entries(filterValues || {}).filter(([, value]) => Boolean(value))
      )
      const payload = { q: term.trim(), limit: 6, ...sanitizedFilters }
      const { data, provider, fallback } = await searchPartners(payload)
      setPreview(data || [])
      setSearchProviderUsed(provider || SEARCH_PROVIDER)
      track('search_results_loaded', {
        provider: provider || SEARCH_PROVIDER,
        fallbackProvider: fallback,
        term: term.trim(),
        filters: sanitizedFilters,
        result_count: Array.isArray(data) ? data.length : 0,
      })
    } catch (err) {
      setCompanyError(err.message || 'Failed to load companies')
      setPreview([])
    } finally {
      setLoadingCompanies(false)
    }
  }

  useEffect(() => {
    loadPreview()
  }, [])

  const filterConfig = useMemo(
    () => [
      { key: 'partnership', label: t('filter_partnership_type'), options: sidebarPresets.partnership },
      { key: 'industry', label: t('filter_industry'), options: sidebarPresets.industry },
      { key: 'country', label: t('filter_country'), options: sidebarPresets.country },
      { key: 'size', label: t('filter_company_size'), options: sidebarPresets.size },
    ],
    [t]
  )

  const activeFilters = useMemo(
    () => Object.fromEntries(Object.entries(filters).filter(([, value]) => Boolean(value))),
    [filters]
  )

  function handleFilterChange(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  function resetFilters() {
    setFilters({ industry: '', country: '', size: '', partnership: '' })
  }

  function runSearch() {
    loadPreview({ term: search, filters })
    track('search_submitted', {
      term: search.trim(),
      filters: activeFilters,
      provider: searchProviderUsed || SEARCH_PROVIDER,
    })
  }

  async function handleConsultSubmit(event) {
    event.preventDefault()
    if (!consultForm.name.trim() || !consultForm.email.trim()) {
      setConsultStatus((prev) => ({ ...prev, error: 'Please enter your name and email.' }))
      return
    }
    setConsultStatus({ submitting: true, success: false, error: '' })
    const payload = {
      name: consultForm.name.trim(),
      email: consultForm.email.trim(),
      details: consultForm.details.trim(),
      serviceType: consultForm.serviceType || 'matching-assistant',
      locale: lang,
      source: 'partner-search',
      searchTerm: search.trim(),
      filters: activeFilters,
    }
    try {
      await api.createConsultantRequest(payload)
      track('consultant_help_submit', {
        serviceType: payload.serviceType,
        hasDetails: Boolean(payload.details),
      })
      setConsultStatus({ submitting: false, success: true, error: '' })
    } catch (error) {
      const detailMessage =
        Array.isArray(error?.details) && error.details.length > 0
          ? error.details.map((detail) => detail.message).join(', ')
          : ''
      setConsultStatus({
        submitting: false,
        success: false,
        error: detailMessage || error.message || 'Could not submit the request. Please try again.',
      })
    }
  }

  return (
    <div className="partner-layout">
      <aside className="search-sidebar" aria-label="Search filters">
        <div>
          <h2
            className="sidebar-title"
            style={lang === 'ko' ? { fontSize: '1.05rem', lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden' } : undefined}
            title={t('sidebar_title')}
          >
            {t('sidebar_title')}
          </h2>
          <p className="muted small">{t('sidebar_description')}</p>
        </div>
        <label className="filter-group">
          <span>{t('search_keyword_label')}</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search_keyword_placeholder')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                runSearch()
              }
            }}
          />
        </label>
        <div className="filter-stack">
          {filterConfig.map((filter) => (
            <label className="filter-group" key={filter.key}>
              <span>{filter.label}</span>
              <select value={filters[filter.key]} onChange={(e) => handleFilterChange(filter.key, e.target.value)}>
                {filter.options.map((option) => (
                  <option value={option.value} key={option.label}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <div className="sidebar-actions">
          <Button onClick={runSearch} loading={loadingCompanies}>
            {t('search_button')}
          </Button>
          <button type="button" className="link-btn" onClick={resetFilters}>
            {t('reset_filters')}
          </button>
        </div>
      </aside>

      <section className="search-content">
        <section className="card hero">
          <h1 style={lang === 'ko' ? { fontSize: '1.8rem', lineHeight: 1.3, whiteSpace: 'nowrap' } : undefined}>
            {t('dashboard_title')}
          </h1>
          <p style={lang === 'ko' ? { fontSize: '1rem', lineHeight: 1.4 } : undefined}>{t('dashboard_subtitle')}</p>
        </section>

        <section className="card results-panel">
          <div className="results-header">
            <div>
              <p className="muted small">{t('search_results_title')}</p>
              <div className="results-count" aria-live="polite">
                <span className="results-count-number">{displayCompanies.length}</span>
                <span className="results-count-label">{t('search_results_label')}</span>
              </div>
            </div>
          </div>
          {companyError && (
            <div className="error mt-2" role="alert">
              {companyError}
            </div>
          )}
          {!companyError && !loadingCompanies && displayCompanies.length === 0 && (
            <div className="muted mt-3" role="status">
              {t('quick_lookup_empty')}
            </div>
          )}
          <div className="results-grid">
            {displayCompanies.map((company) => (
              <CompanyResultCard
                key={company._id}
                company={company}
                onDetails={() => handleCompanyDetails(company)}
              />
            ))}
          </div>
        </section>





        <section className="card consultant-card">
          <div className="row space" style={{ alignItems: 'flex-end' }}>
            <div style={{ flex: 1, marginRight: '1rem' }}>
              <h3>{t('assistant_service_title') || '전문가 서비스 (Expert Services)'}</h3>
              <p className="muted small" style={{ marginBottom: '1rem' }}>
                {t('assistant_service_desc') || '원하시는 서비스를 선택하여 전문가에게 도움을 요청하세요.'}
              </p>
              <label className="filter-group" style={{ marginBottom: 0 }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
                  서비스 선택 (Select Service)
                </span>
                <select
                  value={selectedService}
                  onChange={(e) => setSelectedService(e.target.value)}
                  style={{ width: '100%', maxWidth: '400px', padding: '0.6rem' }}
                >
                  {consultantOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <Button
              onClick={() => {
                track('consultant_service_click', { service: selectedService })
                openConsultModal(selectedService)
              }}
              style={{ height: 'fit-content', alignSelf: 'flex-end' }}
            >
              {t('assistant_request_button')}
            </Button>
          </div>
        </section>

        <Modal
          open={!!selectedCompany}
          onClose={closeCompanyDetails}
          title={selectedCompany?.name || t('company_placeholder_name')}
          footer={
            <Button variant="secondary" onClick={closeCompanyDetails}>
              {t('close')}
            </Button>
          }
        >
          {selectedCompany && (
            <div className="company-detail">
              <div className="muted small">{selectedCompany.industry || t('detail_industry_placeholder')}</div>
              <section className="detail-section">
                <h4>{t('detail_company_info')}</h4>
                <div className="detail-line">
                  <strong>{t('detail_location')}</strong>
                  <span>{detailLocation || t('detail_not_provided')}</span>
                </div>
                {selectedCompany.sizeBucket && (
                  <div className="detail-line">
                    <strong>{t('filter_company_size')}</strong>
                    <span>{selectedCompany.sizeBucket}</span>
                  </div>
                )}
                {detailWebsite && (
                  <div className="detail-line">
                    <strong>{t('detail_website')}</strong>
                    <a className="result-link" href={detailWebsite} target="_blank" rel="noreferrer">
                      {detailWebsite}
                    </a>
                  </div>
                )}
              </section>

              {highlightCards.length > 0 && (
                <section className="detail-section">
                  <h4>{t('detail_recommendation')}</h4>
                  <p className="muted small" style={{ marginBottom: '0.5rem' }}>
                    {lang === 'ko'
                      ? 'AI가 중요하게 본 상위 속성입니다.'
                      : 'Top attributes surfaced by the AI scoring model.'}
                  </p>
                  <div className="highlight-grid">
                    {highlightCards.map((item) => (
                      <div key={item.id} className="highlight-card">
                        <div className="muted small">{item.label}</div>
                        <strong>{item.value}</strong>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {detailTags.length > 0 && (
                <section className="detail-section">
                  <h4>{t('detail_products_services')}</h4>
                  <div className="detail-tags">
                    {detailTags.map((tag) => (
                      <span key={tag} className="result-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {analysisEntries.length > 0 && (
                <section className="detail-section matching-analysis">
                  <h4>{t('detail_matching_analysis')}</h4>
                  {overallConfidence !== null && (
                    <div className="analysis-row overall">
                      <div className="row space">
                        <strong>{t('detail_overall_score')}</strong>
                        <span>{overallConfidence}%</span>
                      </div>
                      <div className="analysis-meter" aria-hidden="true">
                        <span className="analysis-meter-fill" style={{ width: `${overallConfidence}%` }} />
                      </div>
                    </div>
                  )}
                  <ul
                    className="detail-list"
                    style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', padding: 0, listStyle: 'none' }}
                  >
                    {analysisEntries.map((entry, index) => (
                      <li
                        key={index}
                        className="analysis-item"
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: '1rem',
                          padding: '0.85rem 1rem',
                          borderRadius: '12px',
                          border: '1px solid #e5e7eb',
                          background: '#fff',
                          alignItems: 'center',
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <strong style={{ display: 'block', marginBottom: entry.description ? '0.25rem' : 0 }}>
                            {entry.label}
                          </strong>
                          {entry.description && <p className="muted small">{entry.description}</p>}
                        </div>
                        {entry.score !== null && (
                          <span
                            className="analysis-score-pill"
                            style={{
                              minWidth: 58,
                              textAlign: 'center',
                              fontWeight: 600,
                              color: '#1d4ed8',
                              background: '#e0e7ff',
                              borderRadius: '999px',
                              padding: '0.35rem 0.75rem',
                            }}
                          >
                            {entry.score}%
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {recommendationDisplay && (
                <section className="recommendation-card">
                  <h4>{t('detail_recommendation')}</h4>
                  <p>{recommendationDisplay}</p>
                </section>
              )}

              {selectedCompany && (
                <section className="detail-section">
                  <h4>{t('detail_feedback_title')}</h4>
                  <div className="rating-row" style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    {[1, 2, 3, 4, 5].map((score) => (
                      <button
                        key={score}
                        type="button"
                        className="rating-star"
                        onClick={() => {
                          setFeedback((prev) => ({ ...prev, rating: score }))
                          setFeedbackStatus((prev) => ({ ...prev, submitted: false, error: '' }))
                        }}
                        aria-label={`${score} ${t('detail_feedback_rating_star')}`}
                        style={{
                          fontSize: '1.4rem',
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          color: score <= feedback.rating ? '#fbbf24' : '#d1d5db',
                        }}
                      >
                        <span aria-hidden="true">{'\u2605'}</span>
                      </button>
                    ))}
                  </div>
                  <textarea
                    className="feedback-textarea"
                    placeholder={t('detail_feedback_placeholder')}
                    value={feedback.comments}
                    onChange={(event) => {
                      setFeedback((prev) => ({ ...prev, comments: event.target.value }))
                      setFeedbackStatus((prev) => ({ ...prev, submitted: false, error: '' }))
                    }}
                    rows={3}
                    disabled={feedbackStatus.submitting}
                  />
                  {feedbackStatus.error && (
                    <div className="error" role="alert" style={{ marginTop: '0.5rem' }}>
                      {feedbackStatus.error}
                    </div>
                  )}
                  <div className="row space" style={{ marginTop: '8px' }}>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={onSubmitFeedback}
                      disabled={!feedback.rating}
                      loading={feedbackStatus.submitting}
                    >
                      {t('detail_feedback_submit')}
                    </Button>
                    {feedbackStatus.submitted && (
                      <span className="muted small">{t('detail_feedback_prompt')}</span>
                    )}
                  </div>
                </section>
              )}
            </div>
          )}
        </Modal>
      </section>

      <Modal
        open={consultModal}
        onClose={() => {
          setConsultModal(false)
          setConsultStatus({ submitting: false, success: false, error: '' })
        }}
        title={
          consultantOptions.find((opt) => opt.value === consultForm.serviceType)?.label ||
          t('assistant_modal_title')
        }
        footer={
          <Button
            variant="secondary"
            onClick={() => {
              setConsultModal(false)
              setConsultStatus({ submitting: false, success: false, error: '' })
            }}
          >
            {t('assistant_modal_close')}
          </Button>
        }
      >
        <form className="consultant-form" onSubmit={handleConsultSubmit}>
          <label className="filter-group">
            <span>{t('assistant_modal_name')}</span>
            <input
              value={consultForm.name}
              onChange={(event) => setConsultForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder={t('assistant_modal_name')}
              disabled={consultStatus.submitting}
            />
          </label>
          <label className="filter-group">
            <span>{t('assistant_modal_email')}</span>
            <input
              type="email"
              value={consultForm.email}
              onChange={(event) => setConsultForm((prev) => ({ ...prev, email: event.target.value }))}
              placeholder={t('assistant_modal_email')}
              disabled={consultStatus.submitting}
            />
          </label>
          <label className="filter-group">
            <span>{t('assistant_modal_details')}</span>
            <textarea
              value={consultForm.details}
              placeholder={t('assistant_modal_details_placeholder')}
              onChange={(event) => setConsultForm((prev) => ({ ...prev, details: event.target.value }))}
              disabled={consultStatus.submitting}
            />
          </label>
          {consultStatus.error && (
            <div className="error" role="alert">
              {consultStatus.error}
            </div>
          )}
          {consultStatus.success && <p className="success small">{t('assistant_modal_success')}</p>}
          <Button type="submit" loading={consultStatus.submitting}>
            {t('assistant_modal_submit')}
          </Button>
        </form>
      </Modal>
    </div>
  )
}
