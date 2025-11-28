import { useI18n } from '../i18n/I18nProvider.jsx'
import { track } from '../utils/analytics.js'

const FALLBACK_LINK = 'mailto:support@k-statra.com?subject=K-Statra%20Feedback'

export default function FeedbackButton() {
  const { t } = useI18n()
  const link = import.meta.env.VITE_FEEDBACK_URL || FALLBACK_LINK
  const isMail = link.startsWith('mailto:')
  return (
    <a
      className="feedback-fab"
      href={link}
      target={isMail ? undefined : '_blank'}
      rel={isMail ? undefined : 'noreferrer'}
      onClick={() => track('feedback_link_click')}
    >
      {t('feedback_button')}
    </a>
  )
}
