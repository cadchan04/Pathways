const express = require('express')
const router = express.Router();
const User = require('../models/User');
const { checkAndSendNotifications, checkAndSendPriceChangeNotifications } = require('../services/notifications-service');
const { sendPush } = require('../services/pushService');

// Save push subscription for a user
router.post('/subscribe', async (req, res) => {
  const { userId, subscription } = req.body;
  await User.findOneAndUpdate({ auth0Id: userId }, { pushSubscription: subscription });
  res.json({ success: true });
});

// Remove push subscription for a user
router.post('/unsubscribe', async (req, res) => {
  const { userId } = req.body;
  await User.findOneAndUpdate({ auth0Id: userId }, { $unset: { pushSubscription: '' } });
  res.json({ success: true });
});

// ---- DEV ONLY: test endpoints ----

// Trigger a real notification check right now
router.post('/test/check', async (req, res) => {
  await checkAndSendNotifications();
  res.json({ success: true, message: 'Notification check ran' });
});

router.post('/test/price-check', async (req, res) => {
  await checkAndSendPriceChangeNotifications();
  res.json({ success: true, message: 'Price check ran' });
});

// Send a fake notification immediately to a specific user
router.post('/test/send', async (req, res) => {
  const { userId } = req.body;
  const user = await User.findOne({ auth0Id: userId });
  if (!user?.pushSubscription) {
    return res.status(404).json({ success: false, message: 'No push subscription found for this user' });
  }

  await sendPush(user.pushSubscription, {
    title: 'Test notification',
    body: 'This is what this remidner will look like',
    url: '/'
  });
  res.json({ success: true, message: 'test notification sent to user ${userId}' });
});

module.exports = router;