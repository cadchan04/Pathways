const axios = require('axios')

// helper function to call bus routes api and return bus routes data
const getBusRoutes = async ({ originName, destinationName, departDate }) => {
    try {
        // get real bus routes from Google Routes API
        const busResponse = await axios.post(
            'https://routes.googleapis.com/directions/v2:computeRoutes',
            {
                origin: { address: originName },
                destination: { address: destinationName },
                travelMode: "TRANSIT",
                computeAlternativeRoutes: true,
                transitPreferences : {
                    allowedTravelModes: ["BUS"] // filter for bus only
                },
                departureTime: new Date(departDate).toISOString()
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': process.env.GOOGLE_ROUTES_API_KEY,
                    'X-Goog-FieldMask': 'routes.duration,routes.travelAdvisory.transitFare,routes.localizedValues.transitFare,routes.legs.steps.transitDetails.stopDetails,routes.legs.steps.transitDetails.transitLine,routes.legs.steps.staticDuration,routes.legs.steps.distanceMeters'
                }
            }
        );

        return (busResponse.data.routes || []).map((route, index) => {
            // extract all transit steps from first leg
            const transitSteps = route.legs?.[0]?.steps?.filter(s => s.transitDetails) || [];

            // map google steps to our Leg model structure
            const mappedSegments = transitSteps.map(step => {
                const details = step.transitDetails;
                const depStr = details.stopDetails.departureTime;
                const arrStr = details.stopDetails.arrivalTime;
                const stepDistanceMiles = step.distanceMeters ? parseFloat((step.distanceMeters * 0.000621371).toFixed(1)) : 0;
                const stepDurationSeconds = parseInt(step.staticDuration?.replace('s', '') || 0);

                return {
                    origin: {
                        name: details.stopDetails.departureStop.name,
                        address: originName.split(",")[0].trim(),
                        coordinates: {
                            lat: details.stopDetails.departureStop.location.latLng.latitude,
                            lng: details.stopDetails.departureStop.location.latLng.longitude
                        }
                    },
                    destination: {
                        name: details.stopDetails.arrivalStop.name,
                        address: destinationName.split(",")[0].trim(),
                        coordinates: {
                            lat: details.stopDetails.arrivalStop.location.latLng.latitude,
                            lng: details.stopDetails.arrivalStop.location.latLng.longitude
                        }
                    },
                    departAt: depStr ? new Date(depStr) : new Date(),
                    arriveAt: arrStr ? new Date(arrStr) : new Date(),
                    duration: Math.round(stepDurationSeconds / 60),
                    distance: stepDistanceMiles,
                    provider: details.transitLine?.agencies?.[0]?.name ?? 'Local Route',
                };
            });

            return {
                id: `bus_${index}`,
                isRealData: true,
                name: `${originName.split(",")[0].trim()} to ${destinationName.split(",")[0].trim()} bus route`,
                origin: mappedSegments[0].origin,
                destination: mappedSegments[mappedSegments.length - 1].destination,
                departAt: mappedSegments[0].departAt,
                arriveAt: mappedSegments[mappedSegments.length - 1].arriveAt,
                // legs: [{
                //     transportationMode: 'Bus',
                //     provider: mappedSegments.map(seg => seg.provider),
                //     origin: mappedSegments[0].origin,
                //     destination: mappedSegments[mappedSegments.length - 1].destination,
                //     departAt: mappedSegments[0].departAt,
                //     arriveAt: mappedSegments[mappedSegments.length - 1].arriveAt,
                //     segments: mappedSegments,
                //     duration: mappedSegments.reduce((sum, seg) => sum + seg.duration, 0),
                //     cost: Number(route.travelAdvisory?.transitFare?.units) + Number(route.travelAdvisory?.transitFare?.nanos / 1000000000), // TODO: google doesn't provide cost per leg
                //     distance: mappedSegments.reduce((sum, seg) => sum + seg.distance, 0)
                // }],
                legs: mappedSegments.map(seg => ({
                    transportationMode: 'Bus',
                    provider: seg.provider,
                    origin: seg.origin,
                    destination: seg.destination,
                    departAt: seg.departAt,
                    arriveAt: seg.arriveAt,
                    duration: seg.duration,
                    distance: seg.distance,
                    cost: (
                        Number(route.travelAdvisory?.transitFare?.units || 0) +
                        Number((route.travelAdvisory?.transitFare?.nanos || 0) / 1000000000)
                    ) / mappedSegments.length
                })),
                totalCost: Number(route.travelAdvisory?.transitFare?.units) + Number(route.travelAdvisory?.transitFare?.nanos / 1000000000), // using localizedValues.transitFare
                totalDuration: Math.round(parseInt(route.duration.replace('s', '')) / 60),
                totalDistance: parseFloat(mappedSegments.reduce((sum, seg) => sum + seg.distance, 0).toFixed(1)) // TODO: calculate
            };
        });
    } catch (err) {
        console.error("Google Routes API Error:", err.message);
        return [];
    }
}

module.exports = { getBusRoutes };