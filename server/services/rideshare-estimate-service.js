const round = (value, places = 2) => {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

const addMinutes = (isoString, minutesToAdd) => {
  const date = new Date(isoString)
  date.setMinutes(date.getMinutes() + minutesToAdd)
  return date.toISOString()
}

const estimateFare = ({ distanceMiles, durationMinutes, pricing }) => {
  const subtotal =
    pricing.baseFare +
    pricing.bookingFee +
    distanceMiles * pricing.perMile +
    durationMinutes * pricing.perMinute

  return round(subtotal * pricing.surgeMultiplier)
}

const RIDESHARE_PRODUCTS = [
  {
    suffix: 'economy',
    provider: 'UberX',
    rideClass: 'Economy',
    pricing: {
      baseFare: 3.5,
      bookingFee: 2.0,
      perMile: 1.35,
      perMinute: 0.32,
      surgeMultiplier: 1.0
    },
    waitMinutes: 4
  },
  {
    suffix: 'xl',
    provider: 'UberXL',
    rideClass: 'XL',
    pricing: {
      baseFare: 6.0,
      bookingFee: 2.75,
      perMile: 2.1,
      perMinute: 0.45,
      surgeMultiplier: 1.05
    },
    waitMinutes: 6
  }
]

const buildRideshareRouteFromDriving = (drivingRoute, product) => {
  const drivingLeg = drivingRoute?.legs?.[0]
  if (!drivingLeg) return null

  const tripDurationMinutes = Number(drivingRoute.totalDuration)
  const distanceMiles = Number(drivingRoute.totalDistance)
  if (!Number.isFinite(tripDurationMinutes) || !Number.isFinite(distanceMiles)) return null

  const waitMinutes = product.waitMinutes
  const totalDuration = Math.max(1, tripDurationMinutes + waitMinutes)
  const totalCost = estimateFare({
    distanceMiles,
    durationMinutes: tripDurationMinutes,
    pricing: product.pricing
  })

  const departAt = drivingRoute.departAt
  const arriveAt = addMinutes(departAt, totalDuration)

  const leg = {
    ...drivingLeg,
    transportationMode: 'Rideshare',
    provider: product.provider,
    departAt,
    arriveAt,
    duration: totalDuration,
    distance: distanceMiles,
    cost: totalCost,
    details: {
      rideClass: product.rideClass,
      estimatedWaitMinutes: waitMinutes,
      estimatedDriveMinutes: tripDurationMinutes,
      surgeMultiplier: product.pricing.surgeMultiplier,
      isEstimated: true
    }
  }

  return {
    ...drivingRoute,
    id: `${drivingRoute.id}_${product.suffix}`,
    name: `${drivingRoute.origin?.name || 'Origin'} to ${drivingRoute.destination?.name || 'Destination'} ${product.rideClass.toLowerCase()} rideshare`,
    category: 'rideshare',
    routeType: 'rideshare',
    departAt,
    arriveAt,
    legs: [leg],
    totalDuration,
    totalDistance: distanceMiles,
    totalCost,
    isEstimated: true
  }
}

const getEstimatedRideshareRoutes = ({ drivingRoutes = [] }) => {
  if (!Array.isArray(drivingRoutes) || drivingRoutes.length === 0) return []

  // Use the first driving route as the base path for rideshare estimates.
  const baseDrivingRoute = drivingRoutes[0]

  return RIDESHARE_PRODUCTS.map((product) =>
    buildRideshareRouteFromDriving(baseDrivingRoute, product)
  ).filter(Boolean)
}

module.exports = {
  getEstimatedRideshareRoutes
}
