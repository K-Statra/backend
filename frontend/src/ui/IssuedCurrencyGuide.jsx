import { useI18n } from '../i18n/I18nProvider'

export default function IssuedCurrencyGuide({ currency = 'RLUSD' }) {
  const { t } = useI18n()
  return (
    <div className="card" style={{ marginTop: 12 }}>
      <strong>{t('issued_title')} ({currency})</strong>
      <ul className="mt-2">
        <li>{t('issued_step_trustline')}</li>
        <li>{t('issued_step_payload')}</li>
        <li>{t('issued_step_placeholder')}</li>
        <li>{t('issued_step_retry')}</li>
      </ul>
      <div className="mt-2">
        <span className="muted">{t('issued_docs_hint')}</span>
        <div style={{ marginTop: 6 }}>
          <a href="https://xrpl.org/docs/concepts/decentralized-exchange/trust-lines" target="_blank" rel="noreferrer">XRPL Trust Lines Guide</a>
          {' '}·{' '}
          <code>docs/payments.md</code>
        </div>
      </div>
    </div>
  )
}
