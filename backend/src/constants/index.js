/**
 * src/constants/index.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Centralised app-wide constants — no magic strings or numbers in the codebase.
 */

'use strict';

// ── HTTP Status Codes ─────────────────────────────────────────────────────────
const HTTP = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
};

// ── Error Messages ────────────────────────────────────────────────────────────
const ERROR_MESSAGES = {
  UNAUTHORIZED: 'Authentication required. Please log in.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  NOT_FOUND: (resource = 'Resource') => `${resource} not found.`,
  VALIDATION_FAILED: 'Validation failed. Please check your input.',
  SERVER_ERROR: 'An unexpected error occurred. Please try again later.',
  DUPLICATE_EMAIL: 'An account with this email already exists.',
  INVALID_CREDENTIALS: 'Invalid email or password.',
  TOKEN_EXPIRED: 'Your session has expired. Please log in again.',
};

// ── Task / Event Statuses ─────────────────────────────────────────────────────
const TASK_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled',
};

// ── Friend Request Statuses ───────────────────────────────────────────────────
const FRIEND_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
};

// ── Priority Levels ───────────────────────────────────────────────────────────
const PRIORITY = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
};

module.exports = { HTTP, ERROR_MESSAGES, TASK_STATUS, FRIEND_STATUS, PRIORITY };
