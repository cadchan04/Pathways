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
            const firstSegment = offer.slices[0].segments[0];
            const lastSegment = offer.slices[0].segments[offer.slices[0].segments.length - 1];
            const departDate = DateTime.fromISO(firstSegment.departing_at, { zone: firstSegment.origin.timezone }).toUTC().toISO();
            const arriveDate = DateTime.fromISO(lastSegment.arriving_at, { zone: lastSegment.destination.timezone }).toUTC().toISO();

            return {
                id: `flight_${index}`,
                name: `${cleanOrigin} to ${cleanDestination} flight`,
                origin: {
                    name: firstSegment.origin.iata_code,
                    address: origin,
                    coordinates: {
                        lat: firstSegment.origin.latitude || 0,
                        lng: firstSegment.origin.longitude || 0
                    }
                },
                destination: {
                    name: lastSegment.destination.iata_code,
                    address: destination,
                    coordinates: {
                        lat: lastSegment.destination.latitude || 0,
                        lng: lastSegment.destination.longitude || 0
                    }
                },
                departAt: departDate,
                arriveAt: arriveDate,
                legs: [{
                    transportationMode: 'Flight',
                    origin: {
                        name: firstSegment.origin.iata_code,
                        address: origin,
                        coordinates: {
                            lat: firstSegment.origin.latitude || 0,
                            lng: firstSegment.origin.longitude || 0
                        }
                    },
                    destination: {
                        name: lastSegment.destination.iata_code,
                        address: destination,
                        coordinates: {
                            lat: lastSegment.destination.latitude || 0,
                            lng: lastSegment.destination.longitude || 0
                        }
                    },
                    departAt: departDate,
                    arriveAt: arriveDate,
                    segments: offer.slices[0].segments.map(seg => ({
                        origin: {
                            name: seg.origin.iata_code,
                            address: seg.origin.city_name,
                            coordinates: {
                                lat: seg.origin.latitude || 0,
                                lng: seg.origin.longitude || 0
                            }
                        },
                        destination: {
                            name: seg.destination.iata_code,
                            address: seg.destination.city_name,
                            coordinates: {
                                lat: seg.destination.latitude || 0,
                                lng: seg.destination.longitude || 0
                            }
                        },
                        departAt: DateTime.fromISO(seg.departing_at, { zone: seg.origin.time_zone }).toUTC().toISO(),
                        arriveAt: DateTime.fromISO(seg.arriving_at, { zone: seg.destination.time_zone }).toUTC().toISO(),
                        duration: convertDurationToMinutes(seg.duration),
                        provider: seg.operating_carrier.name
                    })),
                    cost: parseFloat(offer.total_amount),
                    duration: convertDurationToMinutes(offer.slices[0].duration),
                    distance: 0, 
                    // Extract the carrier name from the nested operating_carrier object
                    provider: offer.slices[0].segments.map(seg => seg.operating_carrier.name)
                }],
                totalCost: parseFloat(offer.total_amount),
                totalDuration: convertDurationToMinutes(offer.slices[0].duration),
                totalDistance: 0 
            };
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

module.exports = { searchFlightsCity };