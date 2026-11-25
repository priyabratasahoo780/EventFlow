/**
 * email.service.js
 * Production email delivery service using Nodemailer (Gmail SMTP / Custom SMTP / Account Pool).
 */
'use strict';

const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

let roundRobinIndex = 0;
const transporterCache = new Map();

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
        pool: true,
        maxConnections: 3,
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
        pool: true,
        maxConnections: 3,
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

exports.isConfigured = () => getConfiguredAccounts().length > 0;

/**
 * Verify SMTP connectivity at server startup without crashing if credentials are not yet provided.
 */
exports.verifyEmailTransport = async () => {
  const accounts = getConfiguredAccounts();
  if (accounts.length === 0) {
    logger.warn(
      '[EmailService] EMAIL_USER / EMAIL_PASS not set in .env — 2FA OTP emails will fail until configured.'
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
    logger.error('[EmailService] SMTP verification failed', err);
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

/**
 * Send a 6-digit OTP email.
 */
exports.sendOTPEmail = async (toEmail, otp, options = {}) => {
  const purpose = options.purpose || 'Account Verification';
  const expiryMinutes = options.expiryMinutes || 10;

  const selected = getNextAccountAndTransporter();
  if (!selected) {
    const err = new Error('Email delivery service is not configured. Set EMAIL_USER and EMAIL_PASS in .env.');
    err.code = 'EMAIL_NOT_CONFIGURED';
    throw err;
  }

  const { account, transporter } = selected;
  let fromAddress = `"EventFlow Security" <${account.user}>`;
  if (process.env.EMAIL_FROM) {
    let rawFrom = process.env.EMAIL_FROM.trim();
    if (
      (rawFrom.startsWith('"') && rawFrom.endsWith('"')) ||
      (rawFrom.startsWith("'") && rawFrom.endsWith("'"))
    ) {
      rawFrom = rawFrom.slice(1, -1).trim();
    }
    if (rawFrom) fromAddress = rawFrom;
  }

  const mailOptions = {
    from: fromAddress,
    to: toEmail,
    subject: `${otp} is your EventFlow verification code`,
    text: `Your EventFlow ${purpose} code is: ${otp}\n\nThis code is valid for ${expiryMinutes} minutes. Do not share this code with anyone.\n\nIf you did not request this, please ignore this email.`,
    html: buildOTPEmailHtml({ otp, purpose, expiryMinutes }),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info(`[EmailService] OTP email sent to ${toEmail}`, { messageId: info.messageId });
    return { success: true, messageId: info.messageId };
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
