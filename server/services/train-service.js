const express = require('express')
const axios = require('axios')

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
                    'X-Goog-FieldMask': 'routes.duration,routes.travelAdvisory.transitFare,routes.localizedValues.transitFare,routes.legs.steps.transitDetails.stopDetails,routes.legs.steps.transitDetails.transitLine'
                }
            }
        );

        return (trainResponse.data.routes || []).map((route, index) => {
            // extract all transit steps from first leg
            const transitSteps = route.legs?.[0]?.steps?.filter(s => s.transitDetails) || [];

            // map google steps to our Leg model structure
            const mappedLegs = transitSteps.map(step => {
                const details = step.transitDetails;
                const durationSeconds = parseInt(route.duration.replace('s', ''));
                const depStr = details.stopDetails.departureTime;
                const arrStr = details.stopDetails.arrivalTime;

                return {
                    transportationMode: 'Train',
                    provider: details.transitLine?.name || 'Amtrak',
                    origin: {
                        name: details.stopDetails.departureStop.name,
                        coordinates: {
                            lat: details.stopDetails.departureStop.location.latLng.latitude,
                            lng: details.stopDetails.departureStop.location.latLng.longitude
                        }
                    },
                    destination: {
                        name: details.stopDetails.arrivalStop.name,
                        coordinates: {
                            lat: details.stopDetails.arrivalStop.location.latLng.latitude,
                            lng: details.stopDetails.arrivalStop.location.latLng.longitude
                        }
                    },
                    departAt: depStr ? new Date(depStr) : new Date(),
                    arriveAt: arrStr ? new Date(arrStr) : new Date(),
                    duration: Math.round(durationSeconds / 60),
                    cost: 0, // TODO: google doesn't provide cost per leg
                    distance: 0 // TODO: additional google field masks
                };
            });

            return {
                id: `train_${index}`,
                isRealData: true,
                name: `${originName} to ${destinationName}`,
                origin: mappedLegs[0].origin,
                destination: mappedLegs[mappedLegs.length - 1].destination,
                departAt: mappedLegs[0].departAt,
                arriveAt: mappedLegs[0].arriveAt,
                legs: mappedLegs,
                totalCost: route.localizedValues?.transitFare?.text, // using localizedValues.transitFare
                totalDuration: Math.round(parseInt(route.duration.replace('s', '')) / 60),
                totalDistance: 0 // TODO: calculate
            };
        });
    } catch (err) {
        console.error("Google Routes API Error:", err.message);
        return [];
    }
}

module.exports = { getTrainRoutes };