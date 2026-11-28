'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const Event = require('../models/Event');
const MonitoringRecord = require('../models/MonitoringRecord');
const emailService = require('./email.service');
const cloudinaryConfig = require('../config/cloudinary');

const MAX_LATENCY_SAMPLES = 200;
const MAX_GLITCHES = 50;
const MAX_PROBES = 30;
const ALLOWED_INTERVALS = [5, 10];
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const state = {
  hydrated: false,
  intervalMinutes: 5,
  timer: null,
  lastProbeAt: null,
  nextProbeAt: null,
  totalRequests: 0,
  statusCounts: {
    s2xx: 0,
    s3xx: 0,
    s4xx: 0,
    s5xx: 0,
  },
  latencies: [],
  moduleStats: {},
  glitches: [],
  probes: [],
  lastSubsystems: [],
};

function resolveModuleLocation(urlPath) {
  if (urlPath.startsWith('/api/auth')) return 'Auth & 2FA';
  if (urlPath.startsWith('/api/events')) return 'Events & Alarms';
  if (urlPath.startsWith('/api/tasks')) return 'Tasks';
  if (urlPath.startsWith('/api/friends')) return 'Friends & Chat';
  if (urlPath.startsWith('/api/upload')) return 'Media & CDN';
  if (urlPath.startsWith('/api/reviews')) return 'Reviews';
  if (urlPath.startsWith('/api/festival')) return 'Festival Cards';
  if (urlPath.startsWith('/api/users')) return 'User Profile';
  if (urlPath.startsWith('/api/analytics')) return 'Analytics';
  if (urlPath.startsWith('/api/admin')) return 'Admin Portal';
  if (urlPath.startsWith('/api/health') || urlPath === '/api') return 'Health Check';
  return 'API Core';
}

function sanitizePath(rawUrl) {
  const clean = String(rawUrl || '/').split('?')[0];
  return clean.slice(0, 120);
}

async function hydrateFromDatabase() {
  if (state.hydrated || mongoose.connection.readyState !== 1) return;
  try {
    const [cfgDoc, probeDocs, glitchDocs] = await Promise.all([
      MonitoringRecord.findOne({ kind: 'config' }).lean(),
      MonitoringRecord.find({ kind: 'probe' }).sort({ createdAt: -1 }).limit(MAX_PROBES).lean(),
      MonitoringRecord.find({ kind: 'glitch' }).sort({ createdAt: -1 }).limit(MAX_GLITCHES).lean(),
    ]);

    if (cfgDoc && ALLOWED_INTERVALS.includes(cfgDoc.intervalMinutes)) {
      state.intervalMinutes = cfgDoc.intervalMinutes;
    }

    if (probeDocs.length > 0 && state.probes.length === 0) {
      state.probes = probeDocs.map((d) => ({
        id: String(d._id),
        timestamp: new Date(d.createdAt).toISOString(),
        trigger: d.trigger || 'auto',
        status: d.status || 'healthy',
        statusCode: d.statusCode || 200,
        healthScore: typeof d.healthScore === 'number' ? d.healthScore : 100,
        latencyMs: d.latencyMs || 0,
        summary: d.summary || 'All systems operational',
      }));
      state.lastProbeAt = state.probes[0].timestamp;
      if (Array.isArray(probeDocs[0].subsystems) && probeDocs[0].subsystems.length > 0) {
        state.lastSubsystems = probeDocs[0].subsystems;
      }
    }

    if (glitchDocs.length > 0 && state.glitches.length === 0) {
      state.glitches = glitchDocs.map((g) => ({
        id: String(g._id),
        timestamp: new Date(g.createdAt).toISOString(),
        method: g.method || 'GET',
        path: g.path || '/api',
        statusCode: g.statusCode || 500,
        severity: g.severity || 'critical',
        durationMs: g.durationMs || 0,
        location: g.location || 'API Core',
        message: g.message || 'Server error',
      }));
    }

    state.hydrated = true;
  } catch {
    // Non-fatal; will retry on next snapshot if needed
  }
}

function recordGlitch({ method, path, statusCode, durationMs, message }) {
  const severity = statusCode >= 500 ? 'critical' : 'warning';
  const entry = {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    method: String(method || 'GET').toUpperCase(),
    path,
    statusCode,
    severity,
    durationMs,
    location: resolveModuleLocation(path),
    message: String(message || (statusCode >= 500 ? 'Internal server error' : `HTTP ${statusCode} response`)).slice(0, 180),
  };

  state.glitches.unshift(entry);
  if (state.glitches.length > MAX_GLITCHES) {
    state.glitches.length = MAX_GLITCHES;
  }

  if (mongoose.connection.readyState === 1) {
    MonitoringRecord.create({
      kind: 'glitch',
      method: entry.method,
      path: entry.path,
      statusCode: entry.statusCode,
      severity: entry.severity,
      durationMs: entry.durationMs,
      location: entry.location,
      message: entry.message,
      expiresAt: new Date(Date.now() + SEVEN_DAYS_MS),
    }).catch(() => {});
  }
}

exports.trackRequestMetrics = (req, res, next) => {
  // Do not count internal synthetic health probe HTTP pings as user traffic
  if (req.headers['x-monitoring-probe'] === '1') {
    return next();
  }

  const startNs = process.hrtime.bigint();
  const cleanPath = sanitizePath(req.originalUrl || req.url);

  res.on('finish', () => {
    const durationMs = Math.max(1, Math.round(Number(process.hrtime.bigint() - startNs) / 1e6));
    const status = res.statusCode || 200;

    state.totalRequests += 1;
    if (status >= 500) state.statusCounts.s5xx += 1;
    else if (status >= 400) state.statusCounts.s4xx += 1;
    else if (status >= 300) state.statusCounts.s3xx += 1;
    else state.statusCounts.s2xx += 1;

    state.latencies.push(durationMs);
    if (state.latencies.length > MAX_LATENCY_SAMPLES) {
      state.latencies.shift();
    }

    const mod = resolveModuleLocation(cleanPath);
    if (!state.moduleStats[mod]) {
      state.moduleStats[mod] = { total: 0, errors5xx: 0, errors4xx: 0, avgMs: 0, _sumMs: 0 };
    }
    const m = state.moduleStats[mod];
    m.total += 1;
    m._sumMs += durationMs;
    m.avgMs = Math.round(m._sumMs / m.total);
    if (status >= 500) m.errors5xx += 1;
    else if (status >= 400) m.errors4xx += 1;

    if (status >= 400 && !cleanPath.startsWith('/api/admin/monitoring')) {
      recordGlitch({
        method: req.method,
        path: cleanPath,
        statusCode: status,
        durationMs,
        message: res.locals?.errorMessage,
      });
    }
  });

  next();
};

async function probeEmailService() {
  if (!emailService.isConfigured()) {
    return {
      name: '2FA Email OTP Service',
      status: 'down',
      statusCode: 503,
      latencyMs: 0,
      critical: false,
      detail: 'Email provider credentials not configured',
    };
  }

  const t0 = Date.now();
  try {
    if (process.env.BREVO_API_KEY && process.env.BREVO_API_KEY.trim()) {
      const res = await fetch('https://api.brevo.com/v3/account', {
        headers: { 'api-key': process.env.BREVO_API_KEY.trim(), Accept: 'application/json' },
        signal: AbortSignal.timeout(4000),
      });
      const latencyMs = Math.max(1, Date.now() - t0);
      return {
        name: '2FA Email OTP Service',
        status: res.ok ? 'ok' : 'degraded',
        statusCode: res.status,
        latencyMs,
        critical: false,
        detail: res.ok ? 'Brevo HTTPS API verified live' : `Brevo returned HTTP ${res.status}`,
      };
    }

    if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim()) {
      const res = await fetch('https://api.resend.com/domains', {
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY.trim()}` },
        signal: AbortSignal.timeout(4000),
      });
      const latencyMs = Math.max(1, Date.now() - t0);
      return {
        name: '2FA Email OTP Service',
        status: res.ok ? 'ok' : 'degraded',
        statusCode: res.status,
        latencyMs,
        critical: false,
        detail: res.ok ? 'Resend HTTPS API verified live' : `Resend returned HTTP ${res.status}`,
      };
    }

    const user = (process.env.EMAIL_USER || '').trim();
    const pass = (process.env.EMAIL_PASS || '').replace(/\s+/g, '');
    const transporter = nodemailer.createTransport(
      process.env.SMTP_HOST
        ? {
            host: process.env.SMTP_HOST.trim(),
            port: parseInt(process.env.SMTP_PORT || '587', 10),
            secure: process.env.SMTP_SECURE === 'true',
            connectionTimeout: 4000,
            greetingTimeout: 4000,
            auth: { user, pass: pass.length === 16 ? pass.toLowerCase() : pass },
          }
        : {
            service: 'gmail',
            connectionTimeout: 4000,
            greetingTimeout: 4000,
            auth: { user, pass: pass.length === 16 ? pass.toLowerCase() : pass },
          }
    );
    await transporter.verify();
    const latencyMs = Math.max(1, Date.now() - t0);
    return {
      name: '2FA Email OTP Service',
      status: 'ok',
      statusCode: 200,
      latencyMs,
      critical: false,
      detail: 'SMTP server handshake verified live',
    };
  } catch (err) {
    const latencyMs = Math.max(1, Date.now() - t0);
    return {
      name: '2FA Email OTP Service',
      status: 'degraded',
      statusCode: 503,
      latencyMs,
      critical: false,
      detail: `Email probe failed: ${String(err?.message || 'timeout').slice(0, 80)}`,
    };
  }
}

async function probeCloudinary() {
  if (!cloudinaryConfig.isConfigured) {
    return {
      name: 'Cloudinary Media CDN',
      status: 'degraded',
      statusCode: 206,
      latencyMs: 0,
      critical: false,
      detail: 'Not configured (using /uploads disk storage)',
    };
  }

  const t0 = Date.now();
  try {
    const res = await Promise.race([
      cloudinaryConfig.cloudinary.api.ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Cloudinary ping timeout')), 4500)),
    ]);
    const latencyMs = Math.max(1, Date.now() - t0);
    const ok = res?.status === 'ok';
    return {
      name: 'Cloudinary Media CDN',
      status: ok ? 'ok' : 'degraded',
      statusCode: ok ? 200 : 502,
      latencyMs,
      critical: false,
      detail: ok ? 'Cloudinary Admin API ping verified' : 'Unexpected CDN ping response',
    };
  } catch (err) {
    const latencyMs = Math.max(1, Date.now() - t0);
    return {
      name: 'Cloudinary Media CDN',
      status: 'degraded',
      statusCode: 503,
      latencyMs,
      critical: false,
      detail: `CDN ping error: ${String(err?.message || 'unreachable').slice(0, 80)}`,
    };
  }
}

async function probeExpressLoopback() {
  const port = process.env.PORT || 5000;
  const t0 = Date.now();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, {
      headers: { 'x-monitoring-probe': '1' },
      signal: AbortSignal.timeout(4000),
    });
    const latencyMs = Math.max(1, Date.now() - t0);
    return {
      name: 'HTTP API Gateway',
      status: res.ok ? 'ok' : 'down',
      statusCode: res.status,
      latencyMs,
      critical: true,
      detail: res.ok ? `Loopback /api/health returned ${res.status}` : `Gateway returned HTTP ${res.status}`,
    };
  } catch (err) {
    const latencyMs = Math.max(1, Date.now() - t0);
    return {
      name: 'HTTP API Gateway',
      status: 'down',
      statusCode: 503,
      latencyMs,
      critical: true,
      detail: `HTTP loopback unreachable: ${String(err?.message || 'error').slice(0, 70)}`,
    };
  }
}

async function runHealthProbe(trigger = 'auto') {
  await hydrateFromDatabase();
  const probeStart = Date.now();

  // Run all live subsystem checks concurrently
  const dbCheckPromise = (async () => {
    const t0 = Date.now();
    try {
      if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
        await mongoose.connection.db.admin().ping();
        return {
          name: 'MongoDB Database',
          status: 'ok',
          statusCode: 200,
          latencyMs: Math.max(1, Date.now() - t0),
          critical: true,
          detail: 'Database ping verified live',
        };
      }
      return {
        name: 'MongoDB Database',
        status: 'down',
        statusCode: 503,
        latencyMs: Math.max(1, Date.now() - t0),
        critical: true,
        detail: 'Mongoose connection not ready',
      };
    } catch {
      return {
        name: 'MongoDB Database',
        status: 'down',
        statusCode: 503,
        latencyMs: Math.max(1, Date.now() - t0),
        critical: true,
        detail: 'Database ping failed',
      };
    }
  })();

  const authCheckPromise = (async () => {
    const t0 = Date.now();
    try {
      const hasJwt = Boolean(process.env.JWT_SECRET);
      await User.estimatedDocumentCount();
      return {
        name: 'Auth & Security',
        status: hasJwt ? 'ok' : 'down',
        statusCode: hasJwt ? 200 : 500,
        latencyMs: Math.max(1, Date.now() - t0),
        critical: true,
        detail: hasJwt ? 'JWT signing & User store operational' : 'JWT_SECRET missing',
      };
    } catch {
      return {
        name: 'Auth & Security',
        status: 'down',
        statusCode: 500,
        latencyMs: Math.max(1, Date.now() - t0),
        critical: true,
        detail: 'User collection query failed',
      };
    }
  })();

  const eventsCheckPromise = (async () => {
    const t0 = Date.now();
    try {
      await Event.estimatedDocumentCount();
      return {
        name: 'Events & Reminders',
        status: 'ok',
        statusCode: 200,
        latencyMs: Math.max(1, Date.now() - t0),
        critical: true,
        detail: 'Event queries operational',
      };
    } catch {
      return {
        name: 'Events & Reminders',
        status: 'down',
        statusCode: 500,
        latencyMs: Math.max(1, Date.now() - t0),
        critical: true,
        detail: 'Event store unreachable',
      };
    }
  })();

  const subsystems = await Promise.all([
    probeExpressLoopback(),
    dbCheckPromise,
    authCheckPromise,
    eventsCheckPromise,
    probeEmailService(),
    probeCloudinary(),
  ]);

  const criticalDown = subsystems.some((s) => s.critical && s.status !== 'ok');
  const anyDegraded = subsystems.some((s) => s.status !== 'ok');
  const okCount = subsystems.filter((s) => s.status === 'ok').length;

  const recent5xx = state.glitches.filter(
    (g) => g.severity === 'critical' && Date.now() - new Date(g.timestamp).getTime() < 15 * 60 * 1000
  ).length;

  let healthScore = Math.round((okCount / subsystems.length) * 100);
  if (recent5xx > 0) {
    healthScore = Math.max(0, healthScore - Math.min(30, recent5xx * 10));
  }

  const probeStatus = criticalDown ? 'critical' : anyDegraded || recent5xx > 0 ? 'degraded' : 'healthy';
  const httpStatus = criticalDown ? 503 : anyDegraded ? 207 : 200;
  const totalLatencyMs = Math.max(1, Date.now() - probeStart);

  const probeEntry = {
    id: `${Date.now()}`,
    timestamp: new Date().toISOString(),
    trigger,
    status: probeStatus,
    statusCode: httpStatus,
    healthScore,
    latencyMs: totalLatencyMs,
    summary: criticalDown
      ? 'Critical subsystem failure detected'
      : anyDegraded
        ? 'Core healthy; optional service degraded'
        : 'All 6 live subsystems verified operational',
  };

  state.lastProbeAt = probeEntry.timestamp;
  state.nextProbeAt = new Date(Date.now() + state.intervalMinutes * 60 * 1000).toISOString();
  state.lastSubsystems = subsystems;
  state.probes.unshift(probeEntry);
  if (state.probes.length > MAX_PROBES) {
    state.probes.length = MAX_PROBES;
  }

  if (mongoose.connection.readyState === 1) {
    MonitoringRecord.create({
      kind: 'probe',
      trigger: probeEntry.trigger,
      status: probeEntry.status,
      statusCode: probeEntry.statusCode,
      healthScore: probeEntry.healthScore,
      latencyMs: probeEntry.latencyMs,
      summary: probeEntry.summary,
      subsystems,
      expiresAt: new Date(Date.now() + SEVEN_DAYS_MS),
    })
      .then((doc) => {
        if (doc?._id) probeEntry.id = String(doc._id);
      })
      .catch(() => {});
  }

  return probeEntry;
}

exports.runHealthProbe = runHealthProbe;

exports.startMonitoringProbe = () => {
  if (state.timer) clearInterval(state.timer);

  const initialTimer = setTimeout(async () => {
    await hydrateFromDatabase();
    const lastTs = state.lastProbeAt ? new Date(state.lastProbeAt).getTime() : 0;
    // Skip redundant boot probe if a recent persisted probe ran < 60s ago
    if (!lastTs || Date.now() - lastTs > 60 * 1000) {
      await runHealthProbe('boot').catch(() => {});
    }
  }, 3000);
  if (initialTimer.unref) initialTimer.unref();

  const ms = state.intervalMinutes * 60 * 1000;
  state.nextProbeAt = new Date(Date.now() + ms).toISOString();
  state.timer = setInterval(() => {
    runHealthProbe('auto').catch(() => {});
  }, ms);
  if (state.timer.unref) state.timer.unref();
};

exports.stopMonitoringProbe = () => {
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
};

exports.setProbeInterval = (minutes) => {
  const num = Number(minutes);
  if (!ALLOWED_INTERVALS.includes(num)) {
    throw new Error('Probe interval must be 5 or 10 minutes.');
  }
  state.intervalMinutes = num;
  if (mongoose.connection.readyState === 1) {
    MonitoringRecord.findOneAndUpdate(
      { kind: 'config' },
      { kind: 'config', intervalMinutes: num, expiresAt: null },
      { upsert: true }
    ).catch(() => {});
  }
  exports.startMonitoringProbe();
  return state.intervalMinutes;
};

exports.clearGlitches = () => {
  state.glitches = [];
  if (mongoose.connection.readyState === 1) {
    MonitoringRecord.deleteMany({ kind: 'glitch' }).catch(() => {});
  }
};

exports.getMonitoringSnapshot = async () => {
  await hydrateFromDatabase();

  if (state.probes.length === 0 || state.lastSubsystems.length === 0) {
    await runHealthProbe('initial');
  }

  const sortedLatencies = [...state.latencies].sort((a, b) => a - b);
  const avgLatencyMs =
    sortedLatencies.length > 0
      ? Math.round(sortedLatencies.reduce((acc, v) => acc + v, 0) / sortedLatencies.length)
      : 0;
  const p95LatencyMs =
    sortedLatencies.length > 0
      ? sortedLatencies[Math.min(sortedLatencies.length - 1, Math.floor(sortedLatencies.length * 0.95))]
      : 0;

  const successRate =
    state.totalRequests > 0
      ? Number((((state.totalRequests - state.statusCounts.s5xx) / state.totalRequests) * 100).toFixed(2))
      : null;

  const mem = process.memoryUsage();
  const latestProbe = state.probes[0];

  const modules = Object.entries(state.moduleStats).map(([name, d]) => ({
    name,
    total: d.total,
    errors5xx: d.errors5xx,
    errors4xx: d.errors4xx,
    avgMs: d.avgMs,
  }));

  return {
    overallStatus: latestProbe ? latestProbe.status : 'unknown',
    healthScore: typeof latestProbe?.healthScore === 'number' ? latestProbe.healthScore : 0,
    intervalMinutes: state.intervalMinutes,
    lastProbeAt: state.lastProbeAt,
    nextProbeAt: state.nextProbeAt,
    uptimeSeconds: Math.round(process.uptime()),
    memory: {
      rssMb: Math.round(mem.rss / (1024 * 1024)),
      heapUsedMb: Math.round(mem.heapUsed / (1024 * 1024)),
    },
    stats: {
      totalRequests: state.totalRequests,
      successRate,
      avgLatencyMs,
      p95LatencyMs,
      statusCounts: { ...state.statusCounts },
    },
    subsystems: state.lastSubsystems,
    modules,
    probes: state.probes,
    glitches: state.glitches,
  };
};
