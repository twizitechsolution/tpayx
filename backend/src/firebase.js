const admin = require('firebase-admin');
const { getMessaging } = require('firebase-admin/messaging');
const path = require('path');
const fs = require('fs');

const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');

let initialized = false;

if (fs.existsSync(serviceAccountPath)) {
  try {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.cert(serviceAccount)
    });
    initialized = true;
    console.log('[Firebase] Admin SDK initialized successfully.');
  } catch (err) {
    console.error('[Firebase] Failed to initialize Admin SDK:', err.message);
  }
} else {
  console.warn('[Firebase] firebase-service-account.json not found. Push notifications will be mocked.');
}

async function sendPushNotification(user, title, body, data = {}) {
  if (!user) return;
  if (!initialized) {
    console.log(`[Firebase Mock] Push to User ${user.username} (ID: ${user.id}): "${title}" - "${body}"`);
    return;
  }

  if (!user.fcm_tokens || user.fcm_tokens.length === 0) {
    console.log(`[Firebase] No FCM registration tokens found for User ${user.username} (ID: ${user.id}).`);
    return;
  }

  // Filter out empty tokens
  const tokens = user.fcm_tokens.filter(t => t && t.trim().length > 0);
  if (tokens.length === 0) {
    return;
  }

  const message = {
    notification: {
      title,
      body
    },
    data: data,
    tokens: tokens
  };

  try {
    const response = await getMessaging().sendEachForMulticast(message);
    console.log(`[Firebase] Multicast sent: ${response.successCount} success, ${response.failureCount} failed.`);
    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(`[Firebase] Token failed for user ${user.username} (Token: ${tokens[idx]}):`, resp.error);
        }
      });
    }
  } catch (err) {
    console.error('[Firebase] Error sending multicast message:', err);
  }
}

module.exports = {
  admin,
  sendPushNotification
};
