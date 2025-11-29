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
  const tags = c.tags || c.offerings || c.needs || []

  return (
    <article className="result-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1.5rem', borderBottom: '1px solid #e5e7eb', borderRadius: 0, boxShadow: 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem', color: '#111827' }}>
            <button onClick={onDetails} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 'bold', color: 'inherit', textDecoration: 'underline' }}>
              {c.name || t('company_placeholder_name')}
            </button>
          </h3>
          <div className="muted small" style={{ fontSize: '0.9rem' }}>
            {c.industry} • {location}
          </div>
        </div>
        {website && (
          <a className="result-link" href={website} target="_blank" rel="noreferrer" style={{ fontSize: '0.9rem', color: '#2563eb' }}>
            {t('detail_website')} &rarr;
          </a>
        )}
      </div>

      <p style={{ fontSize: '0.95rem', color: '#4b5563', lineHeight: 1.5, margin: '0.5rem 0' }}>
        {c.profileText ? (c.profileText.length > 200 ? c.profileText.substring(0, 200) + '...' : c.profileText) : t('detail_not_provided')}
      </p>

      {tags.length > 0 && (
        <div className="result-card-tags" style={{ marginTop: '0.5rem' }}>
          {tags.slice(0, 5).map((tag) => (
            <span key={tag} className="result-tag" style={{ background: '#f3f4f6', color: '#374151', fontSize: '0.8rem', padding: '0.2rem 0.6rem', borderRadius: '999px' }}>
              {tag}
            </span>
          ))}
        </div>
      )}
    </article>
  )
}
