const fs = require('fs');
const path = require('path');
const User = require('../models/User');

let admin = null;
let getMessaging = null;
let isInitialized = false;

try {
  admin = require('firebase-admin');
  const messagingModule = require('firebase-admin/messaging');
  getMessaging = messagingModule.getMessaging;

  const existingApps = admin.getApps ? admin.getApps() : [];
  if (existingApps.length === 0) {
    let credential = null;

    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        const raw = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
        const parsed = raw.startsWith('{')
          ? JSON.parse(raw)
          : JSON.parse(fs.readFileSync(path.resolve(raw), 'utf8'));
        credential = admin.cert ? admin.cert(parsed) : admin.credential.cert(parsed);
      } catch (err) {
        console.warn('[FCM] Failed to parse FIREBASE_SERVICE_ACCOUNT:', err.message);
      }
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      try {
        credential = admin.applicationDefault
          ? admin.applicationDefault()
          : admin.credential.applicationDefault();
      } catch (err) {
        console.warn('[FCM] Failed to load GOOGLE_APPLICATION_CREDENTIALS:', err.message);
      }
    }

    if (credential) {
      admin.initializeApp({ credential });
      isInitialized = true;
      console.log('[FCM] Firebase Admin SDK initialized successfully');
    } else {
      console.warn('[FCM] No Firebase service account credentials found. Push notifications will run in dev/log mode.');
    }
  } else {
    isInitialized = true;
  }
} catch (loadErr) {
  console.warn('[FCM] firebase-admin package not loaded or unavailable:', loadErr.message);
}

/**
 * Sends a push notification to specific users via Firebase Cloud Messaging.
 * 
 * @param {Object} options
 * @param {Array<string|ObjectId>} options.userIds - Recipient user IDs
 * @param {string} options.title - Notification title
 * @param {string} options.body - Notification body
 * @param {Object} [options.data] - Key-value metadata payload for deep linking
 * @param {string} [options.prefKey] - notificationPrefs property to gate delivery (e.g. 'taskAssignments', 'groupActivity')
 */
const sendPushNotification = async ({ userIds, title, body, data = {}, prefKey = null }) => {
  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    return { sent: 0, failed: 0 };
  }

  try {
    const stringUserIds = userIds.map((id) => (id?._id ? id._id.toString() : id.toString()));
    const users = await User.find({ _id: { $in: stringUserIds } }).select('_id name pushTokens notificationPrefs');

    const tokenToUserMap = new Map();

    for (const user of users) {
      // Check notification preference gate if specified
      if (prefKey && user.notificationPrefs && user.notificationPrefs[prefKey] === false) {
        continue;
      }

      if (Array.isArray(user.pushTokens)) {
        for (const token of user.pushTokens) {
          if (token && typeof token === 'string' && token.trim()) {
            tokenToUserMap.set(token.trim(), user._id.toString());
          }
        }
      }
    }

    const tokens = Array.from(tokenToUserMap.keys());
    if (tokens.length === 0) {
      return { sent: 0, failed: 0 };
    }

    // Ensure all data payload values are strings (required by FCM protocol)
    const stringData = {};
    for (const [key, value] of Object.entries(data)) {
      stringData[key] = value !== undefined && value !== null ? String(value) : '';
    }

    if (isInitialized && getMessaging) {
      const messaging = getMessaging();
      const messagePayload = {
        tokens,
        data: stringData,
      };

      if (data.type !== 'call') {
        messagePayload.notification = {
          title: title || 'TaskChat',
          body: body || '',
        };
        messagePayload.android = {
          priority: 'high',
          notification: {
            channelId: 'high-priority-messages',
            sound: 'default',
          }
        };
        messagePayload.apns = {
          payload: {
            aps: {
              sound: 'default',
            }
          }
        };
      } else {
        // High priority data-only for VoIP/Calls
        messagePayload.android = { priority: 'high' };
        messagePayload.apns = { headers: { 'apns-priority': '10', 'apns-push-type': 'voip' } };
      }

      const response = await messaging.sendEachForMulticast(messagePayload);

      let failed = 0;
      const invalidTokens = [];

      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failed++;
          const errorCode = resp.error?.code;
          const token = tokens[idx];
          if (
            errorCode === 'messaging/registration-token-not-registered' ||
            errorCode === 'messaging/invalid-registration-token' ||
            errorCode === 'messaging/invalid-argument'
          ) {
            invalidTokens.push(token);
          }
        }
      });

      // Automatically prune dead/invalid tokens from MongoDB
      if (invalidTokens.length > 0) {
        await User.updateMany(
          { pushTokens: { $in: invalidTokens } },
          { $pull: { pushTokens: { $in: invalidTokens } } }
        ).catch((cleanupErr) => {
          console.warn('[FCM] Error pruning invalid push tokens:', cleanupErr.message);
        });
      }

      return { sent: response.successCount, failed, invalidPruned: invalidTokens.length };
    } else {
      // Fallback dev mode logging
      console.log(
        `[FCM Dev Mode] Sending notification to ${tokens.length} token(s) (Users: ${users.map((u) => u.name).join(', ')}):\n  Title: ${title}\n  Body: ${body}\n  Data:`,
        stringData
      );
      return { sent: tokens.length, failed: 0, devMode: true };
    }
  } catch (err) {
    console.error('[FCM] sendPushNotification error:', err);
    return { sent: 0, failed: 0, error: err.message };
  }
};

module.exports = {
  sendPushNotification,
  getAdmin: () => admin,
  isFCMInitialized: () => isInitialized,
};
