'use strict';

const bcrypt = require('bcryptjs');
const User = require('../models/User');
const logger = require('../utils/logger');

async function seedAdminAccount() {
  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || '';

  if (!adminEmail || !adminPassword) {
    const existingAdmin = adminEmail
      ? await User.findOne({ email: adminEmail, role: 'admin' }).select('_id email').lean().catch(() => null)
      : await User.findOne({ role: 'admin' }).select('_id email').lean().catch(() => null);

    if (existingAdmin) {
      logger.info(`[AdminSeed] Admin account verified: ${existingAdmin.email}`);
    } else {
      logger.warn('[AdminSeed] ADMIN_EMAIL or ADMIN_PASSWORD not set in environment — admin auto-seed skipped.');
    }
    return;
  }

  try {
    let adminUser = await User.findOne({ email: adminEmail });

    if (!adminUser) {
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(adminPassword, salt);

      adminUser = new User({
        uniqueId: 'ADMIN#01',
        name: 'EventFlow Admin',
        username: 'eventflow_admin',
        email: adminEmail,
        password: hashedPassword,
        role: 'admin',
        isBanned: false,
      });
      await adminUser.save();
      logger.info(`[AdminSeed] Admin account created for ${adminEmail}`);
    } else {
      let dirty = false;
      if (adminUser.role !== 'admin') {
        adminUser.role = 'admin';
        dirty = true;
      }
      if (adminUser.isBanned) {
        adminUser.isBanned = false;
        dirty = true;
      }
      if (process.env.ADMIN_SYNC_PASSWORD === 'true') {
        const salt = await bcrypt.genSalt(12);
        adminUser.password = await bcrypt.hash(adminPassword, salt);
        dirty = true;
      }
      if (dirty) {
        await adminUser.save();
        logger.info(`[AdminSeed] Admin privileges verified for ${adminEmail}`);
      } else {
        logger.info(`[AdminSeed] Admin account ready: ${adminEmail}`);
      }
    }
  } catch (err) {
    logger.error('[AdminSeed] Failed to initialize admin account', err);
  }
}

module.exports = { seedAdminAccount };
