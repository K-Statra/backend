const express = require('express');
const { Company } = require('../models/Company');
const { Buyer } = require('../models/Buyer');
const { Payment } = require('../models/Payment');
const { MatchLog } = require('../models/MatchLog');
const { AuditLog } = require('../models/AuditLog');
const { getHttpMetrics, resetHttpMetrics, getRecentEvents } = require('../middleware/metrics');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const [companies, buyers, paymentsTotal, matchLogs, auditLogs, paymentsAgg, paymentsByCurrency, paymentsByCurrencyStatus] = await Promise.all([
      Company.estimatedDocumentCount(),
      Buyer.estimatedDocumentCount(),
      Payment.estimatedDocumentCount(),
      MatchLog.estimatedDocumentCount(),
      AuditLog.estimatedDocumentCount(),
      Payment.aggregate([{ $group: { _id: '$status', c: { $sum: 1 } } }]),
      Payment.aggregate([{ $group: { _id: '$currency', c: { $sum: 1 } } }]),
      Payment.aggregate([{ $group: { _id: { currency: '$currency', status: '$status' }, c: { $sum: 1 } } }]),
    ]);

    const lines = [];
    lines.push('# HELP kstatra_companies_total Total companies');
    lines.push('# TYPE kstatra_companies_total gauge');
    lines.push(`kstatra_companies_total ${companies}`);

    lines.push('# HELP kstatra_buyers_total Total buyers');
    lines.push('# TYPE kstatra_buyers_total gauge');
    lines.push(`kstatra_buyers_total ${buyers}`);

    lines.push('# HELP kstatra_payments_total Total payments');
    lines.push('# TYPE kstatra_payments_total gauge');
    lines.push(`kstatra_payments_total ${paymentsTotal}`);

    lines.push('# HELP kstatra_payments_status_total Payments by status');
    lines.push('# TYPE kstatra_payments_status_total gauge');
    const byStatus = Object.fromEntries((paymentsAgg || []).map((x) => [String(x._id || 'UNKNOWN'), Number(x.c) || 0]));
    for (const [status, count] of Object.entries(byStatus)) {
      lines.push(`kstatra_payments_status_total{status="${status}"} ${count}`);
    }

    // Per-currency totals
    lines.push('# HELP kstatra_payments_currency_total Payments by currency');
    lines.push('# TYPE kstatra_payments_currency_total gauge');
    for (const row of paymentsByCurrency || []) {
      const cur = String(row._id || 'UNKNOWN').toUpperCase();
      const cnt = Number(row.c) || 0;
      lines.push(`kstatra_payments_currency_total{currency="${cur}"} ${cnt}`);
    }

    // Per-currency & status totals (useful for issued currencies like RLUSD)
    lines.push('# HELP kstatra_payments_currency_status_total Payments by currency and status');
    lines.push('# TYPE kstatra_payments_currency_status_total gauge');
    for (const row of paymentsByCurrencyStatus || []) {
      const cur = String(row._id?.currency || 'UNKNOWN').toUpperCase();
      const st = String(row._id?.status || 'UNKNOWN').toUpperCase();
      const cnt = Number(row.c) || 0;
      lines.push(`kstatra_payments_currency_status_total{currency="${cur}",status="${st}"} ${cnt}`);
    }

    lines.push('# HELP kstatra_matchlogs_total Total match logs');
    lines.push('# TYPE kstatra_matchlogs_total gauge');
    lines.push(`kstatra_matchlogs_total ${matchLogs}`);

    lines.push('# HELP kstatra_auditlogs_total Total audit logs');
    lines.push('# TYPE kstatra_auditlogs_total gauge');
    lines.push(`kstatra_auditlogs_total ${auditLogs}`);

    // HTTP request-level metrics
    const { reqTotals, reqDurations } = getHttpMetrics();
    lines.push('# HELP kstatra_http_requests_total HTTP requests total by method/route/status');
    lines.push('# TYPE kstatra_http_requests_total counter');
    for (const r of reqTotals) {
      const method = (r.method || '').toUpperCase();
      const route = String(r.route || '').replace(/"/g, '\\"');
      const status = Number(r.status) || 0;
      lines.push(`kstatra_http_requests_total{method="${method}",route="${route}",status="${status}"} ${r.count}`);
    }
    lines.push('# HELP kstatra_http_request_duration_ms_sum Sum of request durations (ms) by method/route');
    lines.push('# TYPE kstatra_http_request_duration_ms_sum gauge');
    for (const r of reqDurations) {
      const method = (r.method || '').toUpperCase();
      const route = String(r.route || '').replace(/"/g, '\\"');
      lines.push(`kstatra_http_request_duration_ms_sum{method="${method}",route="${route}"} ${r.sumMs.toFixed(3)}`);
    }
    lines.push('# HELP kstatra_http_request_duration_ms_count Count of requests for duration aggregation by method/route');
    lines.push('# TYPE kstatra_http_request_duration_ms_count counter');
    for (const r of reqDurations) {
      const method = (r.method || '').toUpperCase();
      const route = String(r.route || '').replace(/"/g, '\\"');
      lines.push(`kstatra_http_request_duration_ms_count{method="${method}",route="${route}"} ${r.count}`);
    }

    // Status code band totals (global)
    try {
      const { reqTotals: reqTotals2 } = getHttpMetrics();
      const bands = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0, other: 0 };
      for (const r of reqTotals2) {
        const s = Number(r.status) || 0;
        const band = s >= 200 && s < 300 ? '2xx' : s >= 300 && s < 400 ? '3xx' : s >= 400 && s < 500 ? '4xx' : s >= 500 && s < 600 ? '5xx' : 'other';
        bands[band] = (bands[band] || 0) + Number(r.count || 0);
      }
      lines.push('# HELP kstatra_http_requests_band_total HTTP requests total by status code band');
      lines.push('# TYPE kstatra_http_requests_band_total counter');
      for (const [band, cnt] of Object.entries(bands)) {
        lines.push(`kstatra_http_requests_band_total{band="${band}"} ${cnt}`);
      }
    } catch (_) {}

    // Optional per-route bands (guarded by METRICS_ROUTE_BANDS=true)
    try {
      const exposeBands = String(process.env.METRICS_ROUTE_BANDS || 'false').toLowerCase() === 'true';
      if (exposeBands) {
        const { reqTotals: reqTotals3 } = getHttpMetrics();
        const agg = new Map(); // key: method|route|band
        for (const r of reqTotals3) {
          const method = (r.method || '').toUpperCase();
          const route = String(r.route || '').replace(/\"/g, '\\"');
          const s = Number(r.status) || 0;
          const band = s >= 200 && s < 300 ? '2xx' : s >= 300 && s < 400 ? '3xx' : s >= 400 && s < 500 ? '4xx' : s >= 500 && s < 600 ? '5xx' : 'other';
          const key = `${method}|${route}|${band}`;
          agg.set(key, (agg.get(key) || 0) + Number(r.count || 0));
        }
        lines.push('# HELP kstatra_http_requests_band_by_route_total HTTP requests by method/route and status code band');
        lines.push('# TYPE kstatra_http_requests_band_by_route_total counter');
        for (const [key, cnt] of agg.entries()) {
          const [method, route, band] = key.split('|');
          lines.push(`kstatra_http_requests_band_by_route_total{method="${method}",route="${route}",band="${band}"} ${cnt}`);
        }
      }
    } catch (_) {}

    // Average duration (derived)
    try {
      lines.push('# HELP kstatra_http_request_duration_ms_avg Average request duration (ms) by method/route');
      lines.push('# TYPE kstatra_http_request_duration_ms_avg gauge');
      const { reqDurations: reqDurations2 } = getHttpMetrics();
      for (const r of reqDurations2) {
        const method = (r.method || '').toUpperCase();
        const route = String(r.route || '').replace(/\"/g, '\\"');
        const avg = r.count > 0 ? (r.sumMs / r.count) : 0;
        lines.push(`kstatra_http_request_duration_ms_avg{method="${method}",route="${route}"} ${avg.toFixed(3)}`);
      }
    } catch (_) {}

    // Method-level average duration (aggregated across routes)
    try {
      const { reqDurations: reqDurations3 } = getHttpMetrics();
      const agg = new Map(); // method -> { sumMs, count }
      for (const r of reqDurations3) {
        const method = (r.method || '').toUpperCase();
        const prev = agg.get(method) || { sumMs: 0, count: 0 };
        prev.sumMs += Number(r.sumMs || 0);
        prev.count += Number(r.count || 0);
        agg.set(method, prev);
      }
      lines.push('# HELP kstatra_http_request_duration_method_ms_avg Average request duration (ms) by method');
      lines.push('# TYPE kstatra_http_request_duration_method_ms_avg gauge');
      for (const [method, v] of agg.entries()) {
        const avg = v.count > 0 ? (v.sumMs / v.count) : 0;
        lines.push(`kstatra_http_request_duration_method_ms_avg{method="${method}"} ${avg.toFixed(3)}`);
      }
    } catch (_) {}

    res.setHeader('Content-Type', 'text/plain; version=0.0.4');
    return res.send(lines.join('\n') + '\n');
  } catch (err) {
    res.status(500).setHeader('Content-Type', 'text/plain').send(`# error ${err.message}`);
  }
});

module.exports = router;

// Human-friendly help for metrics consumers (dev convenience)
router.get('/help', async (req, res) => {
  const env = {
    allow: process.env.METRICS_ROUTE_ALLOW || '',
    deny: process.env.METRICS_ROUTE_DENY || '',
    bands: process.env.METRICS_ROUTE_BANDS || '',
    alias_json: process.env.METRICS_ROUTE_ALIAS_JSON || '{}',
    alias_rules: process.env.METRICS_ROUTE_ALIAS_RULES || '[]',
  }
  if ((req.query.format || '').toString().toLowerCase() === 'json') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    // Parse helpers for debugging config
    let aliasJsonParsed = null; let aliasJsonError = null;
    let aliasRulesParsed = []; let aliasRulesStatus = []; let aliasRulesError = null;
    try { aliasJsonParsed = JSON.parse(env.alias_json) } catch (e) { aliasJsonError = e?.message || String(e) }
    try {
      const arr = JSON.parse(env.alias_rules)
      if (Array.isArray(arr)) {
        aliasRulesParsed = arr
        aliasRulesStatus = arr.map((r) => {
          try { const re = new RegExp(r.pattern, r.flags || ''); return { ok: true, pattern: r.pattern, flags: r.flags || '', alias: r.alias || '', priority: r.priority || 0 } }
          catch (e) { return { ok: false, pattern: r && r.pattern, error: e?.message || String(e) } }
        })
      }
    } catch (e) { aliasRulesError = e?.message || String(e) }
    // Build sample route labels (top by total count)
    let routeSamples = []
    // Build sample routes by highest average duration
    let avgRouteSamples = []
    // Build methods by error rate (5xx/total)
    let methodsByErrorRate = []
    try {
      const { reqTotals: totals, reqDurations: durs } = getHttpMetrics()
      const agg = new Map()
      for (const r of totals) {
        const key = String(r.route || '')
        agg.set(key, (agg.get(key) || 0) + Number(r.count || 0))
      }
      routeSamples = Array.from(agg.entries())
        .sort((a,b) => b[1]-a[1])
        .slice(0, 20)
        .map(([route, count]) => ({ route, count }))
      // avg duration per route (aggregate all methods)
      const durAgg = new Map() // route -> { sumMs, count }
      for (const r of durs || []) {
        const route = String(r.route || '')
        const prev = durAgg.get(route) || { sumMs: 0, count: 0 }
        prev.sumMs += Number(r.sumMs || 0)
        prev.count += Number(r.count || 0)
        durAgg.set(route, prev)
      }
      const minSamples = Math.max(0, Number(process.env.METRICS_MIN_SAMPLES_FOR_AVG || 5))
      avgRouteSamples = Array.from(durAgg.entries())
        .map(([route, v]) => ({ route, avgMs: v.count > 0 ? v.sumMs / v.count : 0, count: v.count }))
        .filter((r) => r.count >= minSamples)
        .sort((a,b) => b.avgMs - a.avgMs)
        .slice(0, 20)
      // method error rate
      const perMethod = new Map() // method -> { total, err }
      for (const r of totals) {
        const m = String(r.method || '').toUpperCase()
        const t = perMethod.get(m) || { total: 0, err: 0 }
        t.total += Number(r.count || 0)
        const s = Number(r.status) || 0
        if (s >= 500 && s < 600) t.err += Number(r.count || 0)
        perMethod.set(m, t)
      }
      methodsByErrorRate = Array.from(perMethod.entries())
        .map(([method, v]) => ({ method, total: v.total, errors: v.err, errorRate: v.total > 0 ? v.err / v.total : 0 }))
        .filter((x) => x.total > 0)
        .sort((a,b) => b.errorRate - a.errorRate)
        .slice(0, 10)
    } catch (_) {}

    const payload = {
      ok: true,
      env,
      parsed: {
        allow: (env.allow || '').split(',').map((s) => s.trim()).filter(Boolean),
        deny: (env.deny || '').split(',').map((s) => s.trim()).filter(Boolean),
        alias_json: aliasJsonParsed, alias_json_error: aliasJsonError,
        alias_rules_count: Array.isArray(aliasRulesParsed) ? aliasRulesParsed.length : 0,
        alias_rules_status: aliasRulesStatus, alias_rules_error: aliasRulesError,
      },
      samples: { routes: routeSamples, routesByAvgMs: avgRouteSamples, methodsByErrorRate },
      notes: {
        core: ['kstatra_companies_total','kstatra_buyers_total','kstatra_matchlogs_total','kstatra_auditlogs_total','kstatra_payments_total','kstatra_payments_status_total{status}','kstatra_payments_currency_total{currency}','kstatra_payments_currency_status_total{currency,status}'],
        http: ['kstatra_http_requests_total{method,route,status}','kstatra_http_request_duration_ms_sum{method,route}','kstatra_http_request_duration_ms_count{method,route}','kstatra_http_request_duration_ms_avg{method,route}','kstatra_http_request_duration_method_ms_avg{method}','kstatra_http_requests_band_total{band}','kstatra_http_requests_band_by_route_total{method,route,band}'],
      }
    }
    return res.send(JSON.stringify(payload))
  }
  // Build samples for text mode as well
  let slowRoutes = []
  let methodErr = []
  try {
    const { reqTotals, reqDurations } = getHttpMetrics()
    const durAgg = new Map()
    for (const r of reqDurations || []) {
      const route = String(r.route || '')
      const prev = durAgg.get(route) || { sumMs: 0, count: 0 }
      prev.sumMs += Number(r.sumMs || 0)
      prev.count += Number(r.count || 0)
      durAgg.set(route, prev)
    }
    const minSamples = Math.max(0, Number(process.env.METRICS_MIN_SAMPLES_FOR_AVG || 5))
    const slowMs = Math.max(0, Number(process.env.METRICS_SLOW_MS_THRESHOLD || 300))
    slowRoutes = Array.from(durAgg.entries())
      .map(([route, v]) => ({ route, avgMs: v.count > 0 ? v.sumMs / v.count : 0, count: v.count }))
      .filter((x) => x.count >= minSamples && x.avgMs >= slowMs)
      .sort((a,b) => b.avgMs - a.avgMs)
      .slice(0, 5)
    const perMethod = new Map()
    for (const r of reqTotals || []) {
      const m = String(r.method || '').toUpperCase()
      const v = perMethod.get(m) || { total: 0, err: 0 }
      v.total += Number(r.count || 0)
      const s = Number(r.status) || 0
      if (s >= 500 && s < 600) v.err += Number(r.count || 0)
      perMethod.set(m, v)
    }
    const errThresh = Math.max(0, Number(process.env.METRICS_ERROR_RATE_THRESHOLD || 0.1))
    methodErr = Array.from(perMethod.entries())
      .map(([method, v]) => ({ method, total: v.total, errors: v.err, errorRate: v.total > 0 ? v.err / v.total : 0 }))
      .filter((x) => x.total > 0 && x.errorRate >= errThresh)
      .sort((a,b) => b.errorRate - a.errorRate)
      .slice(0, 5)
  } catch (_) {}

  const text = [
    'K-Statra Metrics Help',
    '',
    'Core:',
    '- kstatra_companies_total, kstatra_buyers_total, kstatra_matchlogs_total, kstatra_auditlogs_total',
    '- kstatra_payments_total, kstatra_payments_status_total{status}',
    '- kstatra_payments_currency_total{currency}, kstatra_payments_currency_status_total{currency,status}',
    '',
    'HTTP:',
    '- kstatra_http_requests_total{method,route,status}',
    '- kstatra_http_request_duration_ms_sum{method,route}, ..._count{method,route}, ..._avg{method,route}',
    '- kstatra_http_requests_band_total{band} and optional ..._band_by_route_total{method,route,band}',
    '- method-level avg: kstatra_http_request_duration_method_ms_avg{method}',
    '',
    'Labels:',
    '- route labels use Express templates where possible and sanitize tokens;',
    '  route aliasing via METRICS_ROUTE_ALIAS_RULES (regex) then METRICS_ROUTE_ALIAS_JSON (prefix) is applied.',
    '',
    'PromQL examples:',
    '- Top slow routes (avg > 300ms):',
    '  kstatra_http_request_duration_ms_avg{route!="NOT_FOUND"} > 300',
    '- Error rate (5xx share by route):',
    '  sum by (route) (kstatra_http_requests_total{status=~"5.."}) / sum by (route) (kstatra_http_requests_total)',
    '- Requests per method+route:',
    '  sum by (method,route) (kstatra_http_requests_total)',
    '',
    'Environment:',
    `- METRICS_ROUTE_ALLOW=${env.allow}`,
    `- METRICS_ROUTE_DENY=${env.deny}`,
    `- METRICS_ROUTE_BANDS=${env.bands}`,
    `- METRICS_ROUTE_ALIAS_JSON=${env.alias_json}`,
    `- METRICS_ROUTE_ALIAS_RULES=${env.alias_rules}`,
    `- METRICS_MIN_SAMPLES_FOR_AVG=${process.env.METRICS_MIN_SAMPLES_FOR_AVG || ''}`,
    `- METRICS_SLOW_MS_THRESHOLD=${process.env.METRICS_SLOW_MS_THRESHOLD || ''}`,
    `- METRICS_ERROR_RATE_THRESHOLD=${process.env.METRICS_ERROR_RATE_THRESHOLD || ''}`,
    '',
    'Top slow routes (by avg ms):',
    ...slowRoutes.map((x) => `  - ${x.route} avg=${x.avgMs.toFixed(1)}ms (n=${x.count})`),
    '',
    'Methods by error rate (>= threshold):',
    ...methodErr.map((x) => `  - ${x.method} errRate=${(x.errorRate*100).toFixed(1)}% (errors=${x.errors}, total=${x.total})`),
  ].join('\n');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(text + '\n');
});

// JSON windowed metrics for recent events (uses in-memory ring buffer)
router.get('/window', async (req, res) => {
  try {
    const m = Number(req.query.m || req.query.minutes || process.env.METRICS_SAMPLE_WINDOW_MINUTES || 60);
    const minSamples = Math.max(0, Number(process.env.METRICS_MIN_SAMPLES_FOR_AVG || 5));
    const slowMs = Math.max(0, Number(process.env.METRICS_SLOW_MS_THRESHOLD || 300));
    const errThresh = Math.max(0, Number(process.env.METRICS_ERROR_RATE_THRESHOLD || 0.1));
    const limit = Math.max(1, Number(req.query.limit || 20));
    const limitRoutes = Math.max(1, Number(req.query.limit_routes || limit));
    const limitMethods = Math.max(1, Number(req.query.limit_methods || Math.min(limit, 10)));
    // Optional filters
    const methodFilter = (req.query.method || '').toString().toUpperCase();
    const routeQ = (req.query.route || '').toString();
    const routeRegex = (req.query.route_regex || '0').toString() === '1';
    const bandFilter = (req.query.band || '').toString(); // e.g., 2xx|3xx|4xx|5xx|other

    let ev = getRecentEvents(m);
    if (methodFilter) ev = ev.filter((e) => String(e.method).toUpperCase() === methodFilter);
    if (routeQ) {
      if (routeRegex) {
        try { const re = new RegExp(routeQ); ev = ev.filter((e) => re.test(String(e.route || ''))); } catch (_) {}
      } else {
        ev = ev.filter((e) => String(e.route || '').startsWith(routeQ));
      }
    }
    if (bandFilter) {
      ev = ev.filter((e) => {
        const b = e.status >= 500 ? '5xx' : e.status >= 400 ? '4xx' : e.status >= 300 ? '3xx' : e.status >= 200 ? '2xx' : 'other';
        return b === bandFilter;
      });
    }
    const perRoute = new Map(); // route -> { total, sumMs, countsByStatus: { '2xx':n, '4xx':n, ... } }
    const perMethod = new Map(); // method -> { total, err }
    for (const e of ev) {
      const band = e.status >= 500 ? '5xx' : e.status >= 400 ? '4xx' : e.status >= 300 ? '3xx' : e.status >= 200 ? '2xx' : 'other';
      const pr = perRoute.get(e.route) || { total: 0, sumMs: 0, countsByStatus: { '2xx':0,'3xx':0,'4xx':0,'5xx':0, other:0 } };
      pr.total += 1; pr.sumMs += Number(e.ms || 0); pr.countsByStatus[band] = (pr.countsByStatus[band] || 0) + 1; perRoute.set(e.route, pr);
      const pm = perMethod.get(e.method) || { total: 0, err: 0 };
      pm.total += 1; if (e.status >= 500 && e.status < 600) pm.err += 1; perMethod.set(e.method, pm);
    }
    const routes = Array.from(perRoute.entries()).map(([route, v]) => ({ route, total: v.total, avgMs: v.total>0 ? v.sumMs / v.total : 0, countsByStatus: v.countsByStatus }))
      .sort((a,b) => b.total - a.total);
    const routesByAvgMs = routes.filter((r) => r.total >= minSamples && r.avgMs >= slowMs).sort((a,b) => b.avgMs - a.avgMs).slice(0, limitRoutes);
    const methods = Array.from(perMethod.entries()).map(([method, v]) => ({ method, total: v.total, errors: v.err, errorRate: v.total>0 ? v.err / v.total : 0 }))
      .sort((a,b) => b.errorRate - a.errorRate);
    const methodsByErrorRate = methods.filter((x) => x.errorRate >= errThresh).slice(0, limitMethods);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.send(JSON.stringify({ ok: true, windowMinutes: m, limit, limit_routes: limitRoutes, limit_methods: limitMethods, totalEvents: ev.length, method: methodFilter || undefined, route: routeQ || undefined, route_regex: routeRegex || undefined, band: bandFilter || undefined, routes, routesByAvgMs, methodsByErrorRate }));
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Dev-only helpers: reset and JSON snapshot
router.post('/reset', async (req, res) => {
  if (process.env.NODE_ENV === 'production') return res.status(403).json({ message: 'Forbidden' });
  resetHttpMetrics();
  return res.json({ ok: true });
});

router.get('/json', async (req, res) => {
  if (process.env.NODE_ENV === 'production') return res.status(403).json({ message: 'Forbidden' });
  const data = getHttpMetrics();
  return res.json(data);
});

