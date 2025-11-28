import { useI18n } from '../i18n/I18nProvider'

export default function CurrencySelect({ value = 'XRP', onChange }) {
  const { t } = useI18n()
  return (
    <label className="field">
      <span>{t('currency_label')}</span>
      <select className="input" value={value} onChange={(e) => onChange?.(e.target.value)}>
        <option value="XRP">{t('currency_xrp')}</option>
        <option value="RLUSD">{t('currency_rlusd_beta')}</option>
        <option value="USD">{t('currency_usd_beta')}</option>
      </select>
      <span className="hint">{t('currency_hint_beta')}</span>
    </label>
  )
}
