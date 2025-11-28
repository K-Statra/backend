import { useI18n } from '../i18n/I18nProvider'

const languageOptions = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'zh-Hans', label: '简体中文' },
  { code: 'zh-Hant', label: '繁體中文' },
  { code: 'de', label: 'Deutsch' },
]

export default function LanguageSwitcher() {
  const { lang, setLang } = useI18n()
  return (
    <select
      className="language-select"
      value={lang}
      onChange={(event) => setLang(event.target.value)}
      aria-label="Select language"
    >
      {languageOptions.map((option) => (
        <option key={option.code} value={option.code}>
          {option.label}
        </option>
      ))}
    </select>
  )
}
