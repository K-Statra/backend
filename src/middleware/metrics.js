// Lightweight in-memory HTTP metrics middleware
// Exposes counters and simple duration aggregates for Prometheus scraping

const counters = new Map(); // key: method|route|status -> count
const durations = new Map(); // key: method|route -> { sumMs, count }
const events = []; // recent events ring buffer: { t, method, route, status, ms }
let aliasMap = null; // route prefix alias map
let aliasRules = null; // regex-based aliasing

function sanitizePath(p) {
  try {
    // Replace common id-like segments with placeholders to reduce cardinality
    return String(p || '/')
      .replace(/\b[0-9a-fA-F]{24}\b/g, ':id') // Mongo ObjectId
      .replace(/\b\d{6,}\b/g, ':num') // long numbers
      .replace(/\b[0-9a-fA-F]{8,}\b/g, ':hex'); // long hex tokens
  } catch (_) {
    return p || '/';
  }
}

function getRouteLabel(req, res) {
  try {
    const base = req.baseUrl || '';
    // Prefer the matched route path template if available (e.g., '/:id')
    const routePath = (req.route && req.route.path) ? req.route.path : null;
    let path = routePath || req.path || req.originalUrl || '/';
    let joined = (base + path) || '/';
    // Normalize and sanitize
    joined = joined.replace(/\/+/, '/');
    joined = routePath ? joined : sanitizePath(joined);
    // Apply alias mapping if configured
    if (!aliasRules) {
      try {
        const raw = process.env.METRICS_ROUTE_ALIAS_RULES || '[]';
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          aliasRules = arr
            .map((r) => {
              try {
                return { re: new RegExp(r.pattern, r.flags || ''), alias: String(r.alias || ''), pr: Number(r.priority || 0) };
              } catch (_) { return null; }
            })
            .filter(Boolean)
            .sort((a, b) => b.pr - a.pr);
        } else aliasRules = [];
      } catch (_) { aliasRules = []; }
    }
    if (aliasRules && aliasRules.length > 0) {
      for (const r of aliasRules) { if (r.re.test(joined)) { joined = r.alias || joined; break; } }
    }

    if (!aliasMap) {
      try {
        aliasMap = JSON.parse(process.env.METRICS_ROUTE_ALIAS_JSON || '{}')
      } catch (_) {
        aliasMap = {}
      }
    }
    if (aliasMap && typeof aliasMap === 'object') {
      for (const [prefix, alias] of Object.entries(aliasMap)) {
        if (prefix && joined.startsWith(prefix)) { joined = String(alias || prefix); break }
      }
    }

    // For 404s with no matched route, label explicitly
    if (!routePath && Number(res?.statusCode || 0) === 404) return 'NOT_FOUND';
    // normalize multiple slashes
    return joined;
  } catch (_) {
    return req.originalUrl?.split('?')[0] || req.url || 'unknown';
  }
}

function metricsMiddleware(req, res, next) {
  const allowList = String(process.env.METRICS_ROUTE_ALLOW || '').split(',').map(s => s.trim()).filter(Boolean);
  const denyRaw = process.env.METRICS_ROUTE_DENY;
  const denyList = (denyRaw && denyRaw.length > 0)
    ? denyRaw.split(',').map(s => s.trim()).filter(Boolean)
    : ['/metrics', '/docs'];
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    try {
      const method = String(req.method || 'GET').toUpperCase();
      const route = getRouteLabel(req, res) || 'unknown';
      // Apply allow/deny filters (prefix match)
      if (allowList.length > 0 && !allowList.some(p => route.startsWith(p))) return;
      if (denyList.length > 0 && denyList.some(p => route.startsWith(p))) return;
      const status = Number(res.statusCode || 0) || 0;
      const end = process.hrtime.bigint();
      const durMs = Number(end - start) / 1e6;

      const cKey = `${method}|${route}|${status}`;
      counters.set(cKey, (counters.get(cKey) || 0) + 1);

      const dKey = `${method}|${route}`;
      const prev = durations.get(dKey) || { sumMs: 0, count: 0 };
      prev.sumMs += durMs;
      prev.count += 1;
      durations.set(dKey, prev);

      // Push to events buffer
      const maxEvents = Math.max(0, Number(process.env.METRICS_EVENTS_MAX || 1000));
      if (maxEvents > 0) {
        events.push({ t: Date.now(), method, route, status, ms: durMs });
        if (events.length > maxEvents) {
          events.splice(0, events.length - maxEvents);
        }
      }
    } catch (_) {}
  });
  next();
}

function getHttpMetrics() {
  const reqTotals = [];
  for (const [key, count] of counters.entries()) {
    const [method, route, status] = key.split('|');
    reqTotals.push({ method, route, status: Number(status), count: Number(count) });
  }
  const reqDurations = [];
  for (const [key, agg] of durations.entries()) {
    const [method, route] = key.split('|');
    reqDurations.push({ method, route, sumMs: agg.sumMs, count: agg.count });
  }
  return { reqTotals, reqDurations };
}

function resetHttpMetrics() {
  counters.clear();
  durations.clear();
}

function getRecentEvents(windowMinutes = 60) {
  const cutoff = Date.now() - Math.max(0, Number(windowMinutes)) * 60 * 1000;
  return events.filter((e) => e.t >= cutoff);
}

module.exports = { metricsMiddleware, getHttpMetrics, resetHttpMetrics, getRecentEvents };
