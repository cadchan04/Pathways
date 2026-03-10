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
                transitPreferences: {
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
            const cityFromStopName = (stopName) => {
                if (!stopName) return "";
                const s = String(stopName).trim();
                const beforeDash = s.split(/\s*[-–]\s*/)[0].trim();
                return (beforeDash || s.split(/\s+/)[0] || "").trim();
            };

            const mappedSegments = transitSteps.map(step => {
                const details = step.transitDetails;
                const stepDurationSeconds = parseInt(step.staticDuration?.replace('s', '') || 0);
                const depStr = details.stopDetails.departureTime;
                const arrStr = details.stopDetails.arrivalTime;
                const stepDistanceMiles = step.distanceMeters
                    ? parseFloat((step.distanceMeters * 0.000621371).toFixed(1))
                    : 0;
                const depStopName = details.stopDetails.departureStop?.name || "";
                const arrStopName = details.stopDetails.arrivalStop?.name || "";

                return {
                    provider: details.transitLine?.name || 'Amtrak',
                    origin: {
                        name: depStopName,
                        address: cityFromStopName(depStopName) || originName.split(",")[0].trim(),
                        coordinates: {
                            lat: details.stopDetails.departureStop.location.latLng.latitude,
                            lng: details.stopDetails.departureStop.location.latLng.longitude
                        }
                    },
                    destination: {
                        name: arrStopName,
                        address: cityFromStopName(arrStopName) || destinationName.split(",")[0].trim(),
                        coordinates: {
                            lat: details.stopDetails.arrivalStop.location.latLng.latitude,
                            lng: details.stopDetails.arrivalStop.location.latLng.longitude
                        }
                    },
                    departAt: depStr ? new Date(depStr) : new Date(),
                    arriveAt: arrStr ? new Date(arrStr) : new Date(),
                    duration: Math.round(stepDurationSeconds / 60),
                    distance: stepDistanceMiles // TODO: additional google field masks
                };
            }).filter(Boolean); // remove null entries from final array

            const totalMiles = mappedSegments.reduce((sum, leg) => sum + leg.distance, 0);

            return {
                id: `train_${index}`,
                isRealData: true,
                name: `${originName.split(",")[0].trim()} to ${destinationName.split(",")[0].trim()} train route`,
                origin: mappedSegments[0].origin,
                destination: mappedSegments[mappedSegments.length - 1].destination,
                departAt: mappedSegments[0].departAt,
                arriveAt: mappedSegments[mappedSegments.length - 1].arriveAt,
                // legs: [{
                //     transportationMode: "Train",
                //     origin: mappedSegments[0].origin,
                //     destination: mappedSegments[mappedSegments.length - 1].destination,
                //     departAt: mappedSegments[0].departAt,
                //     arriveAt: mappedSegments[mappedSegments.length - 1].arriveAt,
                //     segments: mappedSegments,
                //     duration: mappedSegments.reduce((sum, seg) => sum + seg.duration, 0),
                //     cost: Number(route.travelAdvisory?.transitFare?.units) + Number(route.travelAdvisory?.transitFare?.nanos / 1000000000),
                //     distance: mappedSegments.reduce((sum, seg) => sum + seg.distance, 0),
                //     provider: mappedSegments.map(s => s.provider)
                //  }],
                legs: mappedSegments.map(seg => ({
                    transportationMode: "Train",
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
                totalCost: Number(route.travelAdvisory?.transitFare?.units) + Number(route.travelAdvisory?.transitFare?.nanos / 1000000000),
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