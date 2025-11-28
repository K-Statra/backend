const assert = require('assert')
const { computeIsoRange } = require('../src/utils/dateRange')

;(function test24h() {
  const base = Date.UTC(2025, 0, 10, 12, 0, 0) // 2025-01-10T12:00:00.000Z
  const r = computeIsoRange(1, base)
  assert.strictEqual(r.to, '2025-01-10T12:00:00.000Z')
  assert.strictEqual(r.from, '2025-01-09T12:00:00.000Z')
})()

;(function test7d() {
  const base = Date.UTC(2025, 0, 8, 0, 0, 0)
  const r = computeIsoRange(7, base)
  assert.strictEqual(r.to, '2025-01-08T00:00:00.000Z')
  assert.strictEqual(r.from, '2025-01-01T00:00:00.000Z')
})()

;(function test30d() {
  const base = Date.UTC(2025, 2, 1, 0, 0, 0) // Mar 1
  const r = computeIsoRange(30, base)
  assert.strictEqual(r.to, '2025-03-01T00:00:00.000Z')
  assert.strictEqual(r.from, '2025-01-30T00:00:00.000Z')
})()
