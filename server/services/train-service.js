const express = require('express')
const axios = require('axios')

const textToNum = (text) => {
    const numeric = text 
        ? parseFloat(text.replace(/[^0-9.-]+/g, "")) 
        : 0;
    return numeric;
}

// helper function to call train routes api and return train routes data
const getTrainRoutes = async ({ originName, destinationName, departDate }) => {
    try {
        // get real train routes from Google Routes API
        const trainResponse = await axios.post(
            'https://routes.googleapis.com/directions/v2:computeRoutes',
            {
                origin: { address: originName },
                destination: { address: destinationName },
                travelMode: "TRANSIT",
                computeAlternativeRoutes: true,
                transitPreferences : {
                    allowedTravelModes: ["TRAIN"] // filter for train only
                },
                departureTime: new Date(departDate).toISOString()
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': process.env.GOOGLE_ROUTES_API_KEY,
                    'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.travelAdvisory.transitFare,routes.localizedValues.transitFare,routes.legs.steps.transitDetails.stopDetails,routes.legs.steps.transitDetails.transitLine,routes.legs.steps.staticDuration,routes.legs.steps.distanceMeters'
                }
            }
        );

        return (trainResponse.data.routes || []).map((route, index) => {
            // extract all transit steps from first leg
            const transitSteps = route.legs?.[0]?.steps?.filter(s => s.transitDetails) || [];

            if (transitSteps.length === 0) return null;

            // map google steps to our Leg model structure
            const mappedLegs = transitSteps.map(step => {
                const details = step.transitDetails;
                const stepDurationSeconds = parseInt(step.staticDuration?.replace('s', '') || 0);
                const depStr = details.stopDetails.departureTime;
                const arrStr = details.stopDetails.arrivalTime;
                const stepDistanceMiles = step.distanceMeters 
                    ? parseFloat((step.distanceMeters * 0.000621371).toFixed(1)) 
                    : 0;

                return {
                    transportationMode: 'Train',
                    provider: details.transitLine?.name || 'Amtrak',
                    origin: {
                        name: details.stopDetails.departureStop.name,
                        address: details.stopDetails.departureStop.name,
                        coordinates: {
                            lat: details.stopDetails.departureStop.location.latLng.latitude,
                            lng: details.stopDetails.departureStop.location.latLng.longitude
                        }
                    },
                    destination: {
                        name: details.stopDetails.arrivalStop.name,
                        address: details.stopDetails.arrivalStop.name,
                        coordinates: {
                            lat: details.stopDetails.arrivalStop.location.latLng.latitude,
                            lng: details.stopDetails.arrivalStop.location.latLng.longitude
                        }
                    },
                    departAt: depStr ? new Date(depStr) : new Date(),
                    arriveAt: arrStr ? new Date(arrStr) : new Date(),
                    duration: Math.round(stepDurationSeconds / 60),
                    cost: 0, // TODO: google doesn't provide cost per leg
                    distance: stepDistanceMiles // TODO: additional google field masks
                };
            }).filter(Boolean); // remove null entries from final array

            const totalMiles = mappedLegs.reduce((sum, leg) => sum + leg.distance, 0);

            return {
                id: `train_${index}`,
                isRealData: true,
                name: `${originName} to ${destinationName}`,
                origin: mappedLegs[0].origin,
                destination: mappedLegs[mappedLegs.length - 1].destination,
                departAt: mappedLegs[0].departAt,
                arriveAt: mappedLegs[mappedLegs.length - 1].arriveAt,
                legs: mappedLegs,
                totalCost: textToNum(route.localizedValues?.transitFare?.text) || 0,
                localizedFare: route.localizedValues?.transitFare?.text, // using localizedValues.transitFare, text format
                totalDuration: Math.round(parseInt(route.duration.replace('s', '')) / 60),
                totalDistance: parseFloat(totalMiles.toFixed(1)) // TODO: calculate
            };
        });
    } catch (err) {
        console.error("Google Routes API Error:", err.message);
        return [];
    }
}

module.exports = { getTrainRoutes };