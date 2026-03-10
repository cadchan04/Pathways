const axios = require('axios');
const { DateTime } = require('luxon');

async function searchFlightsCity(origin, destination, departDate) {
    const cleanOrigin = origin.split(",")[0].trim();
    const cleanDestination = destination.split(",")[0].trim();

    // console.log('Searching flights from', cleanOrigin, 'to', cleanDestination, 'on', departDate);

    const suggestionsOrigin = await getLocations(cleanOrigin);
    const suggestionsDest = await getLocations(cleanDestination);
    if (suggestionsOrigin.length === 0 || suggestionsDest.length === 0) {
        return [];
    }

    try {
        const response = await axios.post('https://api.duffel.com/air/offer_requests',
            {
                data: {
                    slices: [{ origin: suggestionsOrigin[0].iata_code, destination: suggestionsDest[0].iata_code, departure_date: departDate }],
                    passengers: [{ type: 'adult' }]
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.DUFFEL_ACCESS_TOKEN.trim()}`,
                    'Duffel-Version': 'v2',
                    'Content-Type': 'application/json'
                }
            });

        // If we want to get rid of the "fake" offers from api that are there for safety, we can filter them out like this:
        const realOffers = response.data.data.offers.filter(
            offer => offer.owner.iata_code !== 'ZZ'
        );

        return realOffers.map((offer, index) => {
            const segments = offer.slices[0].segments;
            const firstSegment = offer.slices[0].segments[0];
            const lastSegment = offer.slices[0].segments[offer.slices[0].segments.length - 1];
            const departDate = DateTime.fromISO(firstSegment.departing_at, { zone: firstSegment.origin.timezone }).toUTC().toISO();
            const arriveDate = DateTime.fromISO(lastSegment.arriving_at, { zone: lastSegment.destination.timezone }).toUTC().toISO();

            return {
                id: `flight_${index}`,
                isRealData: true,
                name: `${cleanOrigin} to ${cleanDestination} flight`,
                origin: {
                    name: firstSegment.origin.iata_code,
                    address: firstSegment.origin.city_name || firstSegment.origin.name,
                    coordinates: {
                        lat: firstSegment.origin.latitude || 0,
                        lng: firstSegment.origin.longitude || 0
                    }
                },
                destination: {
                    name: lastSegment.destination.iata_code,
                    address: lastSegment.destination.city_name || lastSegment.destination.name,
                    coordinates: {
                        lat: lastSegment.destination.latitude || 0,
                        lng: lastSegment.destination.longitude || 0
                    }
                },
                departAt: departDate,
                arriveAt: arriveDate,
                //         legs: [{
                //             transportationMode: 'Flight',
                //             origin: {
                //                 name: firstSegment.origin.iata_code,
                //                 address: origin,
                //                 coordinates: {
                //                     lat: firstSegment.origin.latitude || 0,
                //                     lng: firstSegment.origin.longitude || 0
                //                 }
                //             },
                //             destination: {
                //                 name: lastSegment.destination.iata_code,
                //                 address: destination,
                //                 coordinates: {
                //                     lat: lastSegment.destination.latitude || 0,
                //                     lng: lastSegment.destination.longitude || 0
                //                 }
                //             },
                //             departAt: departDate,
                //             arriveAt: arriveDate,
                //             segments: offer.slices[0].segments.map(seg => ({
                //                 origin: {
                //                     name: seg.origin.iata_code,
                //                     address: seg.origin.city_name,
                //                     coordinates: {
                //                         lat: seg.origin.latitude || 0,
                //                         lng: seg.origin.longitude || 0
                //                     }
                //                 },
                //                 destination: {
                //                     name: seg.destination.iata_code,
                //                     address: seg.destination.city_name,
                //                     coordinates: {
                //                         lat: seg.destination.latitude || 0,
                //                         lng: seg.destination.longitude || 0
                //                     }
                //                 },
                //                 departAt: DateTime.fromISO(seg.departing_at, { zone: seg.origin.time_zone }).toUTC().toISO(),
                //                 arriveAt: DateTime.fromISO(seg.arriving_at, { zone: seg.destination.time_zone }).toUTC().toISO(),
                //                 duration: convertDurationToMinutes(seg.duration),
                //                 distance: calculateDistance(
                //                     seg.origin.latitude || 0,
                //                     seg.origin.longitude || 0,
                //                     seg.destination.latitude || 0,
                //                     seg.destination.longitude || 0
                //                 ),
                //                 provider: seg.operating_carrier.name
                //             })),
                //             cost: parseFloat(offer.total_amount),
                //             duration: convertDurationToMinutes(offer.slices[0].duration),
                //             distance: offer.slices[0].segments.reduce((sum, seg) => {
                //             const lat1 = seg.origin.latitude || 0;
                //             const lon1 = seg.origin.longitude || 0;
                //             const lat2 = seg.destination.latitude || 0;
                //             const lon2 = seg.destination.longitude || 0;
                //             return sum + calculateDistance(lat1, lon1, lat2, lon2);
                //             }, 0).toFixed(1),
                //             // Extract the carrier name from the nested operating_carrier object
                //             provider: offer.slices[0].segments.map(seg => seg.operating_carrier.name)
                //         }],
                //         totalCost: parseFloat(offer.total_amount),
                //         totalDuration: convertDurationToMinutes(offer.slices[0].duration),
                //         totalDistance: offer.slices[0].segments.reduce((sum, seg) => {
                //             const lat1 = seg.origin.latitude || 0;
                //             const lon1 = seg.origin.longitude || 0;
                //             const lat2 = seg.destination.latitude || 0;
                //             const lon2 = seg.destination.longitude || 0;
                //             return sum + calculateDistance(lat1, lon1, lat2, lon2);
                //         }, 0).toFixed(1)
                //     };
                // });
                legs: segments.map(seg => {
                    const segDepart = DateTime
                        .fromISO(seg.departing_at, { zone: seg.origin.time_zone })
                        .toUTC()
                        .toISO()
                    const segArrive = DateTime
                        .fromISO(seg.arriving_at, { zone: seg.destination.time_zone })
                        .toUTC()
                        .toISO()
                    const distance = calculateDistance(
                        seg.origin.latitude || 0,
                        seg.origin.longitude || 0,
                        seg.destination.latitude || 0,
                        seg.destination.longitude || 0
                    )
                    return {
                        transportationMode: 'Flight',
                        origin: {
                            name: seg.origin.iata_code,
                            address: seg.origin.city_name || seg.origin.name,
                            coordinates: {
                                lat: seg.origin.latitude || 0,
                                lng: seg.origin.longitude || 0
                            }
                        },
                        destination: {
                            name: seg.destination.iata_code,
                            address: seg.destination.city_name || seg.destination.name,
                            coordinates: {
                                lat: seg.destination.latitude || 0,
                                lng: seg.destination.longitude || 0
                            }
                        },
                        departAt: segDepart,
                        arriveAt: segArrive,
                        duration: convertDurationToMinutes(seg.duration),
                        distance,
                        provider: seg.operating_carrier.name,
                        cost: parseFloat(offer.total_amount) / segments.length
                    }
                }),
                totalCost: parseFloat(offer.total_amount),
                totalDuration: convertDurationToMinutes(offer.slices[0].duration),
                totalDistance: segments.reduce((sum, seg) => {
                    const lat1 = seg.origin.latitude || 0
                    const lon1 = seg.origin.longitude || 0
                    const lat2 = seg.destination.latitude || 0
                    const lon2 = seg.destination.longitude || 0
                    return sum + calculateDistance(lat1, lon1, lat2, lon2)
                }, 0).toFixed(1)
            }
        });
    } catch (error) {
        console.error("RAW FETCH FAILED:", error.response?.data || error.message);
        throw error;
    }
}

const getLocations = async (location) => {
    try {
        const response = await axios.get(`https://api.duffel.com/places/suggestions`, {
            params: { query: location },
            headers: {
                'Authorization': `Bearer ${process.env.DUFFEL_ACCESS_TOKEN.trim()}`,
                'Duffel-Version': 'v2',
                'Content-Type': 'application/json'
            }
        });
        const suggestions = response.data.data
        if (suggestions.length === 0) {
            console.warn(`No location suggestions found for query: ${location}`);
            return [];
        }
        return suggestions;
    } catch (error) {
        console.error("Error fetching IATA code:", error.response?.data || error.message);
        throw error;
    }
}

const convertDurationToMinutes = (duration) => {
    if (!duration.includes('H')) {
        duration = duration.substring(2);
        return parseInt(duration.replace('M', ''));
    }
    reformatedDuration = duration.substring(2).toLowerCase().replace('h', ':').replace('m', '');
    const [hours, minutes] = reformatedDuration.split(':').map(Number);
    return hours * 60 + minutes;
}

const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const km = R * c; // Distance in km
    const miles = km * 0.621371; // Convert to miles
    return parseFloat(miles.toFixed(1)); // Round to 1 decimal place
};

module.exports = { searchFlightsCity };