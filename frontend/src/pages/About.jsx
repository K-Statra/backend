import Button from '../ui/Button.jsx'
import { useI18n } from '../i18n/I18nProvider.jsx'
import { track } from '../utils/analytics.js'

const milestones = [
  { year: '2021', title: 'Founded K-Statra', description: 'Started with a mission to connect Korean suppliers with global enterprises.' },
  { year: '2022', title: 'Global Matchmaking', description: 'Launched AI partner search to handle 10K+ curated matches.' },
  { year: '2023', title: 'Cross-border Payments', description: 'Integrated XRP settlement rails and contract tracking.' },
]

const leadership = [
  { name: 'Minseo Park', role: 'CEO & Co-founder', bio: 'Driving global expansion with 15+ years in B2B exports.' },
  { name: 'David Kim', role: 'Head of Partnerships', bio: 'Leads partner operations across APAC, EMEA, and the US.' },
  { name: 'Soojin Lee', role: 'Product Lead', bio: 'Builds AI-powered workflows for sourcing and payments.' },
]

const services = [
  { titleKey: 'about_service_matchmaking_title', copyKey: 'about_service_matchmaking_copy' },
  { titleKey: 'about_service_intelligence_title', copyKey: 'about_service_intelligence_copy' },
  { titleKey: 'about_service_support_title', copyKey: 'about_service_support_copy' },
]

export default function About() {
  const { t } = useI18n()
  return (
    <div className="about container">
      <header className="about-hero">
        <div>
          <h1>{t('about_title_heading')}</h1>
          <p className="muted">{t('about_subheading')}</p>
        </div>
        <Button
          onClick={() => {
            track('about_contact_click')
          }}
        >
          {t('about_contact_button')}
        </Button>
      </header>

      <section className="panel">
        <h3>{t('about_mission_title')}</h3>
        <p>{t('about_mission_copy')}</p>
      </section>

      <section className="panel">
        <h3>{t('about_services_title')}</h3>
        <p>{t('about_services_description')}</p>
        <ul className="service-list">
          {services.map((service) => (
            <li key={service.titleKey}>
              <strong>{t(service.titleKey)}</strong>
              <p>{t(service.copyKey)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel about-grid">
        <div>
          <h3>{t('about_stats_title')}</h3>
          <ul className="about-stats">
            <li>
              <strong>500+</strong>
              <span>{t('about_stats_partners')}</span>
            </li>
            <li>
              <strong>35</strong>
              <span>{t('about_stats_countries')}</span>
            </li>
            <li>
              <strong>$120M</strong>
              <span>{t('about_stats_volume')}</span>
            </li>
          </ul>
        </div>
        <div>
          <h3>{t('about_milestones_title')}</h3>
          <ul className="milestone-list">
            {milestones.map((item) => (
              <li key={item.year}>
                <strong>{item.year}</strong>
                <div>
                  <p className="milestone-title">{item.title}</p>
                  <p className="muted tiny">{item.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="panel">
        <h3>{t('about_innovation_title')}</h3>
        <p>{t('about_innovation_copy')}</p>
      </section>

      <section className="panel">
        <h3>{t('about_leadership_title')}</h3>
        <div className="leadership-grid">
          {leadership.map((member) => (
            <article key={member.name}>
              <strong>{member.name}</strong>
              <div className="muted tiny">{member.role}</div>
              <p>{member.bio}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <h3>{t('about_contact_title')}</h3>
        <p>{t('about_contact_copy')}</p>
        <div className="contact-grid">
          <div>
            <strong>{t('about_contact_sales')}</strong>
            <p>sales@k-statra.com</p>
          </div>
          <div>
            <strong>{t('about_contact_support')}</strong>
            <p>support@k-statra.com</p>
          </div>
          <div>
            <strong>{t('about_contact_address')}</strong>
            <p>220 Samseong-ro, Seoul, Korea</p>
          </div>
        </div>
      </section>
    </div>
  )
}
