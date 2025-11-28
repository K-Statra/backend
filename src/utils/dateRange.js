function pad(n){ return n<10 ? '0'+n : String(n) }

function toIso(ms) {
  const d = new Date(ms)
  return new Date(Date.UTC(
    d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(),
    d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds()
  )).toISOString()
}

function computeIsoRange(days, baseMs = Date.now()) {
  const ms = Number(baseMs)
  const dayMs = 24 * 60 * 60 * 1000
  const to = ms
  const from = ms - (Number(days) * dayMs)
  return { from: toIso(from), to: toIso(to) }
}

module.exports = { computeIsoRange }

