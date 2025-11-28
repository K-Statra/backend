// Deterministic mock text embedder for local/dev use only.
// Produces a fixed-length numeric vector from input text.

function hash32(str) {
  let h = 2166136261 >>> 0; // FNV-1a basis
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function embed(text = '', dim = 64) {
  const t = String(text || '');
  const v = new Array(dim).fill(0);
  if (!t) return v;
  // Use sliding windows of characters to distribute signal
  for (let i = 0; i < t.length; i++) {
    const window = t.slice(i, i + 4);
    const h = hash32(window);
    const idx = h % dim;
    // Map to signed small magnitude
    const val = ((h / 0xffffffff) * 2 - 1) * 0.5; // roughly [-0.5, 0.5]
    v[idx] += val;
  }
  // L2 normalize
  let norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  if (!Number.isFinite(norm) || norm === 0) return v;
  for (let i = 0; i < dim; i++) v[i] = v[i] / norm;
  return v;
}

module.exports = { embed };

