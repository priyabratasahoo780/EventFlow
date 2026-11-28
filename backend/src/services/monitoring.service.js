'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/User');
const Event = require('../models/Event');
const emailService = require('./email.service');
const cloudinaryConfig = require('../config/cloudinary');

const MAX_LATENCY_SAMPLES = 200;
const MAX_GLITCHES = 50;
const MAX_PROBES = 30;
const ALLOWED_INTERVALS = [5, 10];

const state = {
  startedAt: Date.now(),
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
}

exports.trackRequestMetrics = (req, res, next) => {
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

async function runHealthProbe(trigger = 'auto') {
  const probeStart = Date.now();
  const subsystems = [];

  // 1. MongoDB Ping
  let dbOk = false;
  let dbLatencyMs = 0;
  try {
    const t0 = Date.now();
    if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
      await mongoose.connection.db.admin().ping();
      dbOk = true;
    }
    dbLatencyMs = Date.now() - t0;
  } catch {
    dbOk = false;
  }
  subsystems.push({
    name: 'MongoDB Database',
    status: dbOk ? 'ok' : 'down',
    statusCode: dbOk ? 200 : 503,
    latencyMs: dbLatencyMs,
    critical: true,
    detail: dbOk ? 'Connected & responsive' : 'Database ping failed',
  });

  // 2. Auth & Users Collection
  let authOk = false;
  let authLatencyMs = 0;
  try {
    const t0 = Date.now();
    const hasJwt = Boolean(process.env.JWT_SECRET);
    await User.estimatedDocumentCount();
    authLatencyMs = Date.now() - t0;
    authOk = hasJwt;
  } catch {
    authOk = false;
  }
  subsystems.push({
    name: 'Auth & Security',
    status: authOk ? 'ok' : 'down',
    statusCode: authOk ? 200 : 500,
    latencyMs: authLatencyMs,
    critical: true,
    detail: authOk ? 'JWT & User store healthy' : 'Auth check failed',
  });

  // 3. Events & Alarms Store
  let eventsOk = false;
  let eventsLatencyMs = 0;
  try {
    const t0 = Date.now();
    await Event.estimatedDocumentCount();
    eventsLatencyMs = Date.now() - t0;
    eventsOk = true;
  } catch {
    eventsOk = false;
  }
  subsystems.push({
    name: 'Events & Reminders',
    status: eventsOk ? 'ok' : 'down',
    statusCode: eventsOk ? 200 : 500,
    latencyMs: eventsLatencyMs,
    critical: true,
    detail: eventsOk ? 'Event queries operational' : 'Event store unreachable',
  });

  // 4. Email / 2FA OTP Service
  const emailReady = emailService.isConfigured();
  subsystems.push({
    name: '2FA Email OTP Service',
    status: emailReady ? 'ok' : 'degraded',
    statusCode: emailReady ? 200 : 503,
    latencyMs: 0,
    critical: false,
    detail: emailReady ? 'SMTP/API credentials active' : 'Email service not configured',
  });

  // 5. Cloudinary Media CDN
  const cdnReady = Boolean(cloudinaryConfig.isConfigured);
  subsystems.push({
    name: 'Cloudinary Media CDN',
    status: cdnReady ? 'ok' : 'degraded',
    statusCode: cdnReady ? 200 : 206,
    latencyMs: 0,
    critical: false,
    detail: cdnReady ? 'CDN active for shared media' : 'Using local /uploads fallback',
  });

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
        : 'All systems operational',
  };

  state.lastProbeAt = probeEntry.timestamp;
  state.nextProbeAt = new Date(Date.now() + state.intervalMinutes * 60 * 1000).toISOString();
  state.lastSubsystems = subsystems;
  state.probes.unshift(probeEntry);
  if (state.probes.length > MAX_PROBES) {
    state.probes.length = MAX_PROBES;
  }

  return probeEntry;
}

exports.runHealthProbe = runHealthProbe;

exports.startMonitoringProbe = () => {
  if (state.timer) clearInterval(state.timer);

  const initialTimer = setTimeout(() => {
    runHealthProbe('boot').catch(() => {});
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
  exports.startMonitoringProbe();
  return state.intervalMinutes;
};

exports.clearGlitches = () => {
  state.glitches = [];
};

exports.getMonitoringSnapshot = async () => {
  if (state.probes.length === 0) {
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
      : 100;

  const mem = process.memoryUsage();
  const latestProbe = state.probes[0];

  const modules = Object.entries(state.moduleStats).map(([name, data]) => ({
    name,
    total: data.total,
    errors5xx: data.errors5xx,
    errors4xx: data.errors4xx,
    avgMs: data.avgMs,
  }));

  return {
    overallStatus: latestProbe?.status || 'healthy',
    healthScore: latestProbe?.healthScore ?? 100,
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
