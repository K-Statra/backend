import { useEffect, useMemo, useState } from 'react'
import Button from '../ui/Button.jsx'
import Modal from '../ui/Modal.jsx'
import { useI18n } from '../i18n/I18nProvider.jsx'
import { track } from '../utils/analytics.js'
import { api } from '../api.js'

function formatLocation(company = {}) {
  const loc = company.location || {}
  return [loc.city, loc.state, loc.country].filter(Boolean).join(', ') || '위치 정보 없음'
}

function formatRevenue(company = {}) {
  if (!company.revenue) return '정보 없음'
  const numeric = Number(company.revenue)
  if (Number.isFinite(numeric)) return `${numeric.toLocaleString()} USD`
  return company.revenue
}

function getAccuracyPercent(match) {
  const score = Number(match?.score)
  if (!Number.isFinite(score)) return null
  if (score > 1) return Math.min(100, Math.max(0, Math.round(score)))
  return Math.min(100, Math.max(0, Math.round(score * 100)))
}

export default function Partners() {
  const { t } = useI18n()
  const [buyers, setBuyers] = useState([])
  const [selectedBuyerId, setSelectedBuyerId] = useState('')
  const [matches, setMatches] = useState([])
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [loadingBuyers, setLoadingBuyers] = useState(true)
  const [loadingMatches, setLoadingMatches] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    api
      .listBuyers({ limit: 5 })
      .then((res) => {
        if (cancelled) return
        const items = res?.data || []
        setBuyers(items)
        if (items.length > 0) setSelectedBuyerId(items[0]._id)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err?.message || '바이어 정보를 불러오지 못했습니다.')
      })
      .finally(() => {
        if (!cancelled) setLoadingBuyers(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const selectedBuyer = useMemo(
    () => buyers.find((buyer) => buyer._id === selectedBuyerId),
    [buyers, selectedBuyerId]
  )

  useEffect(() => {
    if (!selectedBuyerId) {
      setMatches([])
      return
    }
    let cancelled = false
    setLoadingMatches(true)
    api
      .getMatches(selectedBuyerId, 6)
      .then((res) => {
        if (cancelled) return
        setMatches(res?.data || [])
      })
      .catch((err) => {
        if (cancelled) return
        setError(err?.message || '추천 파트너를 불러오지 못했습니다.')
      })
      .finally(() => {
        if (!cancelled) setLoadingMatches(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedBuyerId])

  const handleBuyerChange = (event) => {
    setSelectedBuyerId(event.target.value)
    track('partners_buyer_change', { buyerId: event.target.value })
  }

  const handleViewDetails = (match) => {
    setSelectedMatch(match)
    track('partners_view_details_click', { partnerId: match?.company?._id })
  }

  const closeDetails = () => setSelectedMatch(null)

  const renderPartnerCard = (match) => {
    const company = match?.company || {}
    const tags = company.tags || []
    const locationLabel = formatLocation(company)
    const sizeLabel = company.sizeBucket || '규모 정보 없음'
    const projects = company.projectsCount ?? '-'
    const revenue = formatRevenue(company)
    const accuracyValue = getAccuracyPercent(match)
    const accuracy = accuracyValue !== null ? `${accuracyValue}%` : '점수 없음'

    return (
      <article key={company._id || match.companyId} className="partner-card">
        <div className="partner-card-main">
          <div>
            <h3>{company.name || '이름 미상'}</h3>
            <div className="partner-tags">
              {tags.length === 0 ? <span>태그 없음</span> : tags.map((tag) => <span key={tag}>{tag}</span>)}
            </div>
            <div className="partner-meta">
              <span>📍 {locationLabel}</span>
              <span>🏢 {sizeLabel}</span>
              <span>
                {t('partners_projects')}: {projects}
              </span>
              <span>
                {t('partners_revenue')}: <strong>{revenue}</strong>
              </span>
            </div>
            <div className="muted tiny">
              {selectedBuyer ? selectedBuyer.name : '바이어 정보 없음'} ·{' '}
              {company.updatedAt ? new Date(company.updatedAt).toLocaleDateString() : '업데이트 정보 없음'}
            </div>
          </div>
          <div className="partner-actions">
            <div className="partner-rating">
              {accuracy}
              <span className="tiny muted"> 매칭 정확도</span>
            </div>
            <Button
              variant="secondary"
              onClick={() => track('partners_message_click', { partnerId: company._id })}
            >
              {t('partners_message')}
            </Button>
            <Button
              variant="ghost"
              onClick={() => handleViewDetails(match)}
            >
              {t('partners_view_details')}
            </Button>
          </div>
        </div>
      </article>
    )
  }

  return (
    <div className="partners container">
      <div className="partners-header row space">
        <div>
          <h1>{t('partners_title_heading')}</h1>
          <p className="muted">{t('partners_subheading')}</p>
        </div>
        <Button
          onClick={() => {
            track('partners_add_click')
          }}
        >
          {t('partners_add_button')}
        </Button>
      </div>

      <div className="partner-filter-bar">
        <select value={selectedBuyerId} onChange={handleBuyerChange} disabled={loadingBuyers || buyers.length === 0}>
          {loadingBuyers ? (
            <option>바이어 목록 불러오는 중...</option>
          ) : buyers.length === 0 ? (
            <option>바이어 정보가 없습니다</option>
          ) : (
            buyers.map((buyer) => (
              <option key={buyer._id} value={buyer._id}>
                {buyer.name}
              </option>
            ))
          )}
        </select>
        <Button variant="ghost" disabled>
          {t('partners_filter_more')}
        </Button>
      </div>

      <div className="partner-card-list">
        {error && <div className="error">{error}</div>}
        {loadingMatches && <p>추천 파트너를 불러오는 중입니다...</p>}
        {!loadingMatches && matches.length === 0 && <p>표시할 추천 파트너가 없습니다.</p>}
        {!loadingMatches && matches.map((match) => renderPartnerCard(match))}
      </div>

      <Modal
        open={!!selectedMatch}
        onClose={closeDetails}
        title={selectedMatch?.company?.name || t('company_placeholder_name')}
        footer={
          <Button variant="secondary" onClick={closeDetails}>
            {t('close')}
          </Button>
        }
      >
        {selectedMatch && (
          <div className="company-detail">
            <div className="muted small">{selectedMatch.company?.industry || t('detail_industry_placeholder')}</div>
            <section className="detail-section">
              <h4>{t('detail_company_info')}</h4>
              <div className="detail-line">
                <strong>{t('detail_location')}</strong>
                <span>{formatLocation(selectedMatch.company)}</span>
              </div>
              <div className="detail-line">
                <strong>{t('partners_revenue')}</strong>
                <span>{formatRevenue(selectedMatch.company)}</span>
              </div>
              {selectedMatch.company?.sizeBucket && (
                <div className="detail-line">
                  <strong>{t('filter_company_size')}</strong>
                  <span>{selectedMatch.company.sizeBucket}</span>
                </div>
              )}
            </section>

            {selectedMatch.company?.tags?.length > 0 && (
              <section className="detail-section">
                <h4>{t('detail_products_services')}</h4>
                <div className="detail-tags">
                  {selectedMatch.company.tags.map((tag) => (
                    <span key={tag} className="result-tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </section>
            )}

            <section className="detail-section matching-analysis">
              <h4>{t('detail_matching_analysis')}</h4>
              {getAccuracyPercent(selectedMatch) !== null && (
                <div className="analysis-row overall">
                  <div className="row space">
                    <strong>{t('detail_overall_score')}</strong>
                    <span>{getAccuracyPercent(selectedMatch)}%</span>
                  </div>
                  <div className="analysis-meter" aria-hidden="true">
                    <span className="analysis-meter-fill" style={{ width: `${getAccuracyPercent(selectedMatch)}%` }} />
                  </div>
                </div>
              )}
              {Array.isArray(selectedMatch.reasons) && selectedMatch.reasons.length > 0 && (
                <ul className="detail-list">
                  {selectedMatch.reasons.map((reason, index) => (
                    <li key={index} className="muted small">
                      {reason}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {selectedMatch.company?.matchRecommendation && (
              <section className="recommendation-card">
                <h4>{t('detail_recommendation')}</h4>
                <p>{selectedMatch.company.matchRecommendation}</p>
              </section>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
