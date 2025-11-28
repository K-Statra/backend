import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api'
import { useI18n } from '../i18n/I18nProvider'

export default function PaymentStatus() {
  const { id } = useParams()
  const { t } = useI18n()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true); setError('')
    try {
      const res = await api.getPayment(id)
      setData(res)
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [id])

  async function refresh() {
    try {
      const res = await api.refreshPayment(id)
      setData(res)
    } catch (e) { alert(e.message) }
  }

  return (
    <div>
      <h2>{t('payment_status_title')}</h2>
      {loading && <div>{t('loading')}</div>}
      {error && <div className="error">{error}</div>}
      {data && (
        <div className="card">
          <div>ID: {data._id}</div>
          <div>{t('state')}: <strong>{data.status}</strong></div>
          {data.quote?.expiresAt && <div>{t('quote_expiry')}: {new Date(data.quote.expiresAt).toLocaleString()}</div>}
          <button onClick={refresh}>{t('manual_refresh')}</button>
        </div>
      )}
    </div>
  )
}
