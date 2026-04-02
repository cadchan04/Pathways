const { sendPush } = require('./pushService');
const Trip = require('../models/Trip');
const User = require('../models/User');

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Check trips and send notifications
 */
async function checkAndSendNotifications() {
  const now = Date.now();
  const nowTime = new Date();
  const hours = nowTime.getHours();
  const minutes = nowTime.getMinutes();
  const timeNow = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

  // Fetch trips that haven't been notified yet
  const trips = await Trip.aggregate([
    {
      $addFields: {
        // Pick the route with the earliest departure
        firstRouteTime: { $min: '$routes.departAt' },
        firstRoute: {
          $cond: [
            { $gt: [{ $size: "$routes" }, 0] }, // only if routes exist
            {
              $reduce: {
                input: "$routes",
                initialValue: "$routes.0",
                in: {
                  $cond: [
                    { $lt: ["$$this.departAt", "$$value.departAt"] },
                    "$$this",
                    "$$value"
                  ]
                }
              }
            },
            null
          ]
        }
      }
    }
  ]);
  
  // Process all trips in parallel
  await Promise.allSettled(
    trips.map(async (trip) => {
      try {
        // Get user
        let user = await User.findById(trip.owner);
        if (!user || !user.pushSubscription) return;

        const tripStart = new Date(trip.startDate).getTime();
        const routeCheck = new Date(trip.firstRouteTime).getTime();
        const firstRoute = new Date(trip.firstRouteTime)
        const routeHours = firstRoute.getHours();
        const routeMinutes = firstRoute.getMinutes();
        const routeTime = `${routeHours.toString().padStart(2, '0')}:${routeMinutes.toString().padStart(2, '0')}`;

        // 1-week notification
        if (!trip.notifiedWeek && tripStart - now <= ONE_WEEK_MS) {
          await sendPush(user.pushSubscription, {
            title: `${trip.name} in < 1 week`,
            body: `Your trip starts on ${new Date(trip.startDate).toLocaleDateString()}.`,
            url: `/view-trip-details/${trip._id}`
          });

        // 24-hour notification
        if (routeCheck) {
        if (!trip.notifiedDay && timeNow > routeTime) {
          await sendPush(user.pushSubscription, {
            title: `${trip.name} - First route tomorrow`,
            body: `First departure at ${new Date(firstRoute).toLocaleTimeString()}.`,
            url: `/view-trip-details/${trip._id}`
          });
        }
      }
      }
      } catch (err) {
        console.error(`Error processing trip ${trip._id}:`, err);
      }
    })
  );
}

async function checkAndSendPriceChangeNotifications() {
  const trips = await Trip.find({ routes: { $exists: true, $not: { $size: 0 } } });

  await Promise.allSettled(
    trips.map(async (trip) => {
      try {
        const user = await User.findOne({ _id: trip.owner });
        const currentCost = Number(trip.totalCost) || 0;

          if (trip.lastKnownCost === null || trip.lastKnownCost === undefined) {
            trip.lastKnownCost = currentCost;
            await trip.save();
            return;
          }

          if (currentCost === 0 && Number(trip.lastKnownCost) === 0) {
            return;
          }

          const lastCost = Number(trip.lastKnownCost);
          const diff = currentCost - lastCost;
          const absDiff = Math.abs(diff);

          if (absDiff < 1) {
            trip.lastKnownCost = currentCost;
            await trip.save();
            return;
          }

          const direction = diff > 0 ? 'increased' : 'decreased';
          const message = `Trip cost ${direction} by $${absDiff.toFixed(2)} (now $${currentCost.toFixed(2)})`;

          trip.priceAlerts.push({ message });
          trip.lastKnownCost = currentCost;
          await trip.save();

          if (user?.pushSubscription) {
            await sendPush(user.pushSubscription, {
              title: `$ Price change for ${trip.name}`,
              body: message,
              url: `/view-trip-details/${trip._id}`
            });
        }
      } catch (err) {
        console.error(`Error checking price for trip ${trip._id}:`, err);
      }
    })
  );
}

module.exports = { checkAndSendNotifications, checkAndSendPriceChangeNotifications };