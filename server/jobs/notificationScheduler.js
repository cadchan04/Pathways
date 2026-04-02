const cron = require('node-cron');
const { checkAndSendNotifications, checkAndSendPriceChangeNotifications } = require('../services/notifications-service');

// Run immediately on server start to catch anything missed while down
console.log('Running notification check on startup...');
checkAndSendNotifications();

// Then run every hour
cron.schedule('0 * * * *', async () => {
  console.log('Running scheduled notification check...');
  try {
    await checkAndSendNotifications();
    await checkAndSendPriceChangeNotifications();
  } catch (err) {
    console.error('Error in notification check:', err);
  }
});