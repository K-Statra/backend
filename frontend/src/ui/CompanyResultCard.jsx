import Button from './Button.jsx'
import Badge from './Badge.jsx'
import { useI18n } from '../i18n/I18nProvider.jsx'

const PLACEHOLDER_IMAGE = 'https://placehold.co/360x200?text=K-Statra'

function getLocation(company) {
  const parts = [company.city, company.state, company.country, company.location]
  return parts.filter(Boolean).join(', ')
}

function getWebsite(company) {
  return company.website || company.url || company.site || company.domain || ''
}

function getPrimaryContact(company) {
  if (company.primaryContact?.name) return company.primaryContact.name
  if (company.contact?.name) return company.contact.name
  return company.contactName || ''
}

function getContactEmail(company) {
  return (
    company.primaryContact?.email ||
    company.contact?.email ||
    company.email ||
    company.contactEmail ||
    ''
  )
}

function getAccuracyScore(company) {
  const candidates = [
    company.matchAccuracy,
    company.accuracyScore,
    company.confidence,
    company.confidenceScore,
    company.score,
    company.matchScore,
    company.matchingScore,
  ]
  const first = candidates.find((value) => value !== undefined && value !== null)
  const raw = Number(first)
  if (!Number.isFinite(raw)) return 82
  if (raw > 1) return Math.max(0, Math.min(100, Math.round(raw)))
  return Math.max(0, Math.min(100, Math.round(raw * 100)))
}

function getHeroImage(company) {
  if (Array.isArray(company.images) && company.images.length > 0) return company.images[0]
  if (company.coverImage) return company.coverImage
  if (company.heroImage) return company.heroImage
  return { url: PLACEHOLDER_IMAGE, alt: 'K-Statra default image' }
}

export default function CompanyResultCard({ company, onDetails }) {
  const c = company || {}
  const { t } = useI18n()
  const location = getLocation(c)
  const website = getWebsite(c)
  const contactName = getPrimaryContact(c)
  const contactEmail = getContactEmail(c)
  const confidenceScore = getAccuracyScore(c)
  const tags = c.tags || c.offerings || c.needs || []
  const heroImage = getHeroImage(c)
  const heroUrl = typeof heroImage === 'string' ? heroImage : heroImage.url
  const heroAlt = typeof heroImage === 'string' ? c.name || 'K-Statra company image' : heroImage.alt || c.name

  return (
    <article className="result-card">
      <div className="result-hero">
        <img src={heroUrl} alt={heroAlt} loading="lazy" />
      </div>
      <div className="result-card-head">
        <div>
          <h3>{c.name || t('company_placeholder_name')}</h3>
          <div className="muted small">{location || c.industry || t('company_placeholder_industry')}</div>
        </div>
        <div className="result-card-badges">
          {c.country && (
            <Badge tone="primary" key="country">
              {c.country}
            </Badge>
          )}
          {c.industry && (
            <Badge tone="muted" key="industry">
              {c.industry}
            </Badge>
          )}
        </div>
      </div>

      {website && (
        <a className="result-link" href={website} target="_blank" rel="noreferrer">
          {website.replace(/^https?:\/\//i, '')}
        </a>
      )}

      <div className="result-contact">
        {contactName && (
          <div>
            <div className="muted small">{t('primary_contact')}</div>
            <div>{contactName}</div>
          </div>
        )}
        {contactEmail && (
          <div>
            <div className="muted small">{t('contact_email')}</div>
            <a className="result-link" href={`mailto:${contactEmail}`}>
              {contactEmail}
            </a>
          </div>
        )}
      </div>

      {tags.length > 0 && (
        <div className="result-card-tags">
          {tags.slice(0, 6).map((tag) => (
            <span key={tag} className="result-tag">
              {tag}
            </span>
          ))}
        </div>
      )}

      {confidenceScore !== null && (
        <div className="confidence-block">
          <div className="row space">
            <span className="muted small">{t('confidence_score')}</span>
            <strong>{confidenceScore}%</strong>
          </div>
          <div className="confidence-meter" aria-hidden="true">
            <span className="confidence-meter-fill" style={{ width: `${confidenceScore}%` }} />
          </div>
        </div>
      )}

      <div className="result-card-actions">
        <Button onClick={onDetails}>{t('cta_view_details')}</Button>
      </div>
    </article>
  )
}
