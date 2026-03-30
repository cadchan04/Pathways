const webpush = require('web-push');

webpush.setVapidDetails(
  process.env.VAPID_MAILTO,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

async function sendPush(pushSubscription, payload) {
  try {
    await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
  } catch (err) {
    if (err.statusCode === 410) {
      // Subscription expired — clear it from DB
      return { expired: true };
    } else {
      console.error('Push error for user', err);
    }
    return { expired: false }
  }
}

module.exports = { sendPush };