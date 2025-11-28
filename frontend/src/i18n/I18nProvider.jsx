import React, { createContext, useContext, useMemo, useState } from 'react'
import { dict } from './dict'

const I18nCtx = createContext({ lang: 'en', t: (k) => k, setLang: () => {} })

function normalize(loc) {
  const l = String(loc || '').toLowerCase()
  if (l.startsWith('ja')) return 'ja'
  if (l.startsWith('zh-hant') || l.startsWith('zh-tw') || l.startsWith('zh-hk')) return 'zh-Hant'
  if (l.startsWith('zh-hans') || l.startsWith('zh-cn') || l.startsWith('zh-sg')) return 'zh-Hans'
  if (l.startsWith('de')) return 'de'
  if (l.startsWith('ko')) return 'ko'
  if (l.startsWith('en')) return 'en'
  if (l.startsWith('zh')) return 'zh-Hans'
  return 'en'
}

export function I18nProvider({ children }) {
  const initial = normalize(localStorage.getItem('lang') || navigator.language)
  const [lang, setLangState] = useState(initial)
  const setLang = (v) => { const l = normalize(v); localStorage.setItem('lang', l); setLangState(l) }
  const t = useMemo(() => {
    const current = dict[lang] || {}
    const fallback = dict.en || {}
    return (key) => current[key] ?? fallback[key] ?? key
  }, [lang])
  const value = useMemo(() => ({ lang, setLang, t }), [lang])
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>
}

export function useI18n() { return useContext(I18nCtx) }
