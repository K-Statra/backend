import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import Button from '../ui/Button.jsx'
import { Field, TextArea, TextInput } from '../ui/Input.jsx'
import { useI18n } from '../i18n/I18nProvider.jsx'

const initialState = {
  name: '',
  country: '',
  industries: '',
  needs: '',
  tags: '',
  profileText: '',
}

function toList(value) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export default function BuyerForm() {
  const { t } = useI18n()
  const [values, setValues] = useState(initialState)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const navigate = useNavigate()

  function onChange(e) {
    const { name, value } = e.target
    setValues((prev) => ({ ...prev, [name]: value }))
  }

  async function onSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      if (!values.name.trim()) throw new Error(`${t('buyer_name')} is required`)
      const payload = {
        name: values.name.trim(),
        country: values.country.trim(),
        industries: toList(values.industries),
        needs: toList(values.needs),
        tags: toList(values.tags),
        profileText: values.profileText.trim(),
      }
      const res = await api.createBuyer(payload)
      const id = res?._id
      setSuccess('Saved. Redirecting to matches...')
      setValues(initialState)
      if (id) {
        setTimeout(() => {
          navigate(`/matches?buyerId=${id}`)
        }, 800)
      }
    } catch (err) {
      setError(err.message || 'Failed to save buyer')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2>{t('buyer_title')}</h2>
      <form className="form" onSubmit={onSubmit}>
        <Field label={t('buyer_name')}>
          <TextInput name="name" value={values.name} onChange={onChange} required />
        </Field>
        <Field label={t('buyer_country')}>
          <TextInput name="country" value={values.country} onChange={onChange} />
        </Field>
        <Field label={t('buyer_industries')}>
          <TextInput name="industries" value={values.industries} onChange={onChange} placeholder="Manufacturing, Logistics" />
        </Field>
        <Field label={t('buyer_needs')}>
          <TextInput name="needs" value={values.needs} onChange={onChange} placeholder="OEM partner, Distributor" />
        </Field>
        <Field label={t('buyer_tags')}>
          <TextInput name="tags" value={values.tags} onChange={onChange} placeholder="battery, ai, biotech" />
        </Field>
        <Field label={t('buyer_profile')}>
          <TextArea name="profileText" rows={4} value={values.profileText} onChange={onChange} />
        </Field>
        {error && <div className="error">{error}</div>}
        {success && <div className="muted">{success}</div>}
        <div className="row gap-4">
          <Button type="submit" loading={loading}>
            {t('save')}
          </Button>
        </div>
      </form>
    </div>
  )
}
