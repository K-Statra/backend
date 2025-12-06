import { useI18n } from '../i18n/I18nProvider.jsx'

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

      {c.dart && c.dart.revenueConsolidated && (
        <div style={{ marginTop: '0.75rem', padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#0f172a' }}>
              📊 {t('financials') || 'Financials'} ({c.dart.fiscalYear})
            </span>
            <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '999px', fontWeight: '600' }}>
              Verified by DART
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.85rem' }}>
            <div>
              <span style={{ color: '#64748b' }}>{t('revenue') || 'Revenue'}:</span>{' '}
              <span style={{ fontWeight: '600', color: '#334155' }}>
                ₩{(c.dart.revenueConsolidated / 1000000000000).toFixed(1)}T
              </span>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>{t('profit') || 'Op. Profit'}:</span>{' '}
              <span style={{ fontWeight: '600', color: c.dart.operatingProfitConsolidated > 0 ? '#16a34a' : '#dc2626' }}>
                ₩{(c.dart.operatingProfitConsolidated / 1000000000000).toFixed(1)}T
              </span>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: '1rem' }}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDetails()
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.4rem 0.8rem',
            fontSize: '0.85rem',
            fontWeight: 600,
            color: '#2563eb',
            backgroundColor: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            width: '100%'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#dbeafe'
            e.currentTarget.style.borderColor = '#93c5fd'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#eff6ff'
            e.currentTarget.style.borderColor = '#bfdbfe'
          }}
        >
          {t('view_details') || '상세 보기'}
        </button>
      </div>
    </article>
  )
}
