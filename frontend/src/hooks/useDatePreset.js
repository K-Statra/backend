import { useState } from 'react'

// Reusable date preset helper for from/to ISO ranges
// Presets: '24h', '7d', '30d', 'custom'
export function useDatePreset() {
  const [presetSel, setPresetSel] = useState('')

  function computeRange(days) {
    const now = new Date()
    const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    return { from: from.toISOString(), to: now.toISOString() }
  }

  function applyPreset(days, setFilters) {
    const range = computeRange(days)
    if (typeof setFilters === 'function') {
      setFilters((f) => ({ ...f, from: range.from, to: range.to }))
    }
    setPresetSel(days === 1 ? '24h' : days === 7 ? '7d' : days === 30 ? '30d' : '')
    return range
  }

  function markCustom() {
    setPresetSel('custom')
  }

  function resetPreset() { setPresetSel('') }

  return { presetSel, setPresetSel, applyPreset, markCustom, resetPreset }
}
