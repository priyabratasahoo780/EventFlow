'use strict';

const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

let roundRobinIndex = 0;
const transporterCache = new Map();

function hasBrevoConfig() {
  return Boolean(process.env.BREVO_API_KEY && process.env.BREVO_API_KEY.trim());
}

function hasResendConfig() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim());
}

function getConfiguredAccounts() {
  const accounts = [];

  if (process.env.EMAIL_ACCOUNTS) {
    const entries = process.env.EMAIL_ACCOUNTS.split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    for (const entry of entries) {
      const separatorIdx = entry.indexOf(':');
      if (separatorIdx > 0) {
        const user = entry.slice(0, separatorIdx).trim();
        const pass = entry.slice(separatorIdx + 1).replace(/\s+/g, '');
        if (user && pass) {
          accounts.push({ user, pass });
        }
      }
    }
  }

  if (accounts.length === 0 && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    const rawPass = process.env.EMAIL_PASS.replace(/\s+/g, '');
    accounts.push({
      user: process.env.EMAIL_USER.trim(),
      // Google App Passwords are 16 lowercase characters; normalize case if 16-char code
      pass: rawPass.length === 16 ? rawPass.toLowerCase() : rawPass,
    });
  }

  return accounts;
}

function getOrCreateTransporter(account) {
  const cacheKey = `${account.user}:${process.env.SMTP_HOST || 'gmail'}`;
  if (transporterCache.has(cacheKey)) {
    return transporterCache.get(cacheKey);
  }

  const transportConfig = process.env.SMTP_HOST
    ? {
        host: process.env.SMTP_HOST.trim(),
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        family: 4, // Force IPv4 to avoid IPv6 timeouts in Docker/cloud containers
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
        auth: {
          user: account.user,
          pass: account.pass,
        },
      }
    : {
        service: 'gmail',
        family: 4, // Force IPv4 to avoid IPv6 timeouts in Docker/cloud containers
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
        auth: {
          user: account.user,
          pass: account.pass,
        },
      };

  const transporter = nodemailer.createTransport(transportConfig);
  transporterCache.set(cacheKey, transporter);
  return transporter;
}

function getNextAccountAndTransporter() {
  const accounts = getConfiguredAccounts();
  if (accounts.length === 0) {
    return null;
  }

  const account = accounts[roundRobinIndex % accounts.length];
  roundRobinIndex = (roundRobinIndex + 1) % accounts.length;
  return {
    account,
    transporter: getOrCreateTransporter(account),
  };
}

function resolveSenderEmail(fallbackUser) {
  const rawFrom = (process.env.EMAIL_FROM || '').trim().replace(/^["']|["']$/g, '');
  const emailMatch = rawFrom.match(/<([^>]+)>/);
  const email = emailMatch ? emailMatch[1].trim() : (rawFrom.includes('@') ? rawFrom : fallbackUser || 'noreply@eventflow.app');
  const nameMatch = rawFrom.match(/^([^<]+)</);
  const name = nameMatch ? nameMatch[1].replace(/^["']|["']$/g, '').trim() : 'EventFlow Security';
  return {
    formatted: rawFrom || `"${name}" <${email}>`,
    name: name || 'EventFlow Security',
    email,
  };
}

let cachedBrevoSenders = null;
let cachedBrevoSendersAt = 0;

async function getBrevoVerifiedSenders(forceRefresh = false) {
  if (!hasBrevoConfig()) return [];
  const now = Date.now();
  if (!forceRefresh && cachedBrevoSenders && now - cachedBrevoSendersAt < 10 * 60 * 1000) {
    return cachedBrevoSenders;
  }
  try {
    const res = await fetch('https://api.brevo.com/v3/senders', {
      headers: { 'api-key': process.env.BREVO_API_KEY.trim(), Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const json = await res.json().catch(() => ({}));
    const list = Array.isArray(json.senders) ? json.senders.filter((s) => s && s.active) : [];
    cachedBrevoSenders = list;
    cachedBrevoSendersAt = now;
    return list;
  } catch {
    return [];
  }
}

async function sendViaBrevo({ toEmail, subject, text, html, sender }) {
  const activeSenders = await getBrevoVerifiedSenders();
  let effectiveSender = sender;

  if (activeSenders.length > 0) {
    const matchesConfigured = activeSenders.some(
      (s) => String(s.email || '').toLowerCase() === String(sender.email || '').toLowerCase()
    );
    if (!matchesConfigured) {
      logger.warn(
        `[EmailService] Configured EMAIL_FROM (${sender.email}) is not a verified active sender in Brevo; falling back to verified sender (${activeSenders[0].email}).`
      );
      effectiveSender = {
        name: sender.name || activeSenders[0].name || 'EventFlow Security',
        email: activeSenders[0].email,
      };
    }
  } else if (getConfiguredAccounts().length > 0) {
    throw new Error('No verified active sender found in Brevo account; falling back to SMTP.');
  }

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY.trim(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: effectiveSender.name, email: effectiveSender.email },
      to: [{ email: toEmail }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Brevo API failed (${res.status}): ${body}`);
  }
  const json = await res.json().catch(() => ({}));
  return {
    success: true,
    messageId: json.messageId || 'brevo-ok',
    provider: 'brevo',
    senderEmail: effectiveSender.email,
  };
}

exports.getBrevoSenderStatus = async () => {
  if (!hasBrevoConfig()) return { configured: false, activeSenders: [] };
  const activeSenders = await getBrevoVerifiedSenders(true);
  const configuredSender = resolveSenderEmail(getConfiguredAccounts()[0]?.user).email;
  const senderVerified = activeSenders.some(
    (s) => String(s.email || '').toLowerCase() === String(configuredSender || '').toLowerCase()
  );
  return {
    configured: true,
    configuredSender,
    senderVerified,
    activeSenders: activeSenders.map((s) => s.email),
  };
};

async function sendViaResend({ toEmail, subject, text, html, sender }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: sender.formatted,
      to: [toEmail],
      subject,
      html,
      text,
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend API failed (${res.status}): ${body}`);
  }
  const json = await res.json().catch(() => ({}));
  return { success: true, messageId: json.id || 'resend-ok', provider: 'resend' };
}

exports.isConfigured = () =>
  hasBrevoConfig() || hasResendConfig() || getConfiguredAccounts().length > 0;

// Verify email delivery connectivity at server startup without crashing.
exports.verifyEmailTransport = async () => {
  if (hasBrevoConfig()) {
    logger.info('[EmailService] HTTPS Email delivery ready via Brevo API (port 443).');
    return true;
  }

  if (hasResendConfig()) {
    logger.info('[EmailService] HTTPS Email delivery ready via Resend API (port 443).');
    return true;
  }

  const accounts = getConfiguredAccounts();
  if (accounts.length === 0) {
    logger.warn(
      '[EmailService] No email provider configured — set BREVO_API_KEY / RESEND_API_KEY (recommended for Render) or EMAIL_USER / EMAIL_PASS.'
    );
    return false;
  }

  try {
    const transporter = getOrCreateTransporter(accounts[0]);
    await transporter.verify();
    logger.info(
      `[EmailService] SMTP connection verified (${accounts.length} account${accounts.length > 1 ? 's' : ''} ready).`
    );
    return true;
  } catch (err) {
    logger.warn(
      `[EmailService] SMTP port blocked or timed out (${err.message}). If hosted on Render Free Tier, set BREVO_API_KEY or RESEND_API_KEY for HTTPS OTP emails.`
    );
    return false;
  }
};

function buildOTPEmailHtml({ otp, purpose, expiryMinutes }) {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 28px 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 22px;">
        <h1 style="color: #FF5722; margin: 0; font-size: 26px; letter-spacing: -0.5px;">EventFlow</h1>
        <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">Focus on the right task at the right time</p>
      </div>

      <div style="padding: 20px 0; border-top: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9;">
        <p style="font-size: 15px; color: #1e293b; margin: 0 0 10px 0;">Hello,</p>
        <p style="font-size: 14px; color: #475569; line-height: 1.5; margin: 0;">
          Use the following verification code for <strong>${purpose}</strong>:
        </p>

        <div style="text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #FF5722; background-color: #FFF3E0; border: 1px solid #FFE0B2; padding: 14px 28px; border-radius: 12px; display: inline-block;">
            ${otp}
          </span>
        </div>

        <p style="font-size: 13px; color: #64748b; text-align: center; margin: 0;">
          This code expires in <strong>${expiryMinutes} minutes</strong>. Never share it with anyone.
        </p>
      </div>

      <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 18px 0 0 0; line-height: 1.4;">
        If you did not try to sign in to EventFlow, you can safely ignore this email or update your password.
      </p>
    </div>
  `;
}

// Send a 6-digit OTP email via HTTPS API (Brevo / Resend) or SMTP fallback.
exports.sendOTPEmail = async (toEmail, otp, options = {}) => {
  const purpose = options.purpose || 'Account Verification';
  const expiryMinutes = options.expiryMinutes || 10;

  const subject = `${otp} is your EventFlow verification code`;
  const text = `Your EventFlow ${purpose} code is: ${otp}\n\nThis code is valid for ${expiryMinutes} minutes. Do not share this code with anyone.\n\nIf you did not request this, please ignore this email.`;
  const html = buildOTPEmailHtml({ otp, purpose, expiryMinutes });

  const accounts = getConfiguredAccounts();
  const sender = resolveSenderEmail(accounts[0]?.user);

  // 1. Prefer HTTPS Email APIs (works on Render Free Tier where SMTP ports are blocked)
  if (hasBrevoConfig()) {
    try {
      const result = await sendViaBrevo({ toEmail, subject, text, html, sender });
      logger.info(`[EmailService] OTP email sent to ${toEmail} via Brevo`, { messageId: result.messageId });
      return result;
    } catch (brevoErr) {
      logger.error(`[EmailService] Brevo delivery failed: ${brevoErr.message}`);
      if (!accounts.length && !hasResendConfig()) throw brevoErr;
    }
  }

  if (hasResendConfig()) {
    try {
      const result = await sendViaResend({ toEmail, subject, text, html, sender });
      logger.info(`[EmailService] OTP email sent to ${toEmail} via Resend`, { messageId: result.messageId });
      return result;
    } catch (resendErr) {
      logger.error(`[EmailService] Resend delivery failed: ${resendErr.message}`);
      if (!accounts.length) throw resendErr;
    }
  }

  // 2. Fallback to Nodemailer SMTP (Gmail / custom SMTP)
  const selected = getNextAccountAndTransporter();
  if (!selected) {
    const err = new Error('Email delivery service is not configured. Set BREVO_API_KEY, RESEND_API_KEY, or EMAIL_USER/EMAIL_PASS.');
    err.code = 'EMAIL_NOT_CONFIGURED';
    throw err;
  }

  const { account, transporter } = selected;
  const smtpSender = resolveSenderEmail(account.user);

  try {
    const info = await transporter.sendMail({
      from: smtpSender.formatted,
      to: toEmail,
      subject,
      text,
      html,
    });
    if (Array.isArray(info.rejected) && info.rejected.length > 0 && (!info.accepted || info.accepted.length === 0)) {
      throw new Error(`SMTP rejected recipient ${toEmail}`);
    }
    logger.info(`[EmailService] OTP email sent to ${toEmail}`, { messageId: info.messageId, accepted: info.accepted });
    return { success: true, messageId: info.messageId, provider: 'smtp', senderEmail: smtpSender.email };
  } catch (err) {
    logger.error(`[EmailService] Failed sending OTP email to ${toEmail}`, err);
    throw err;
  }
};

exports.send2FAEmail = async (toEmail, otp) => {
  return exports.sendOTPEmail(toEmail, otp, {
    purpose: 'Two-Factor Sign-In Verification',
    expiryMinutes: 10,
  });
};
