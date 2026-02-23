const express = require('express');
const router = express.Router();
const axios = require('axios');

// POST transit details for finding train route suggestions
router.post("/search-trains", async (req, res) => {
    const { origin, destination, departureTime } = req.body;

    let formattedDate = departureTime || new Date().toISOString();
    if (!formattedDate.endsWith('Z')) {
        formattedDate += 'Z';
    }
    
    try {
        const response = await axios.post(
            'https://routes.googleapis.com/directions/v2:computeRoutes',
            {
                origin: { address: origin },
                destination: { address: destination },
                travelMode: "TRANSIT",
                computeAlternativeRoutes: true,
                transitPreferences : {
                    allowedTravelModes: ["TRAIN"] // filter for train only
                },
                departureTime: formattedDate
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY,
                    // field mask: only request data needed
                    // 'X-Goog-FieldMask': 'routes.duration,routes.localizedValues.transitFare,routes.legs.steps.transitDetails.stopDetails,routes.legs.steps.transitDetails.transitLine'
                    'X-Goog-FieldMask': 'routes.duration,routes.travelAdvisory.transitFare,routes.localizedValues.transitFare,routes.legs.steps.transitDetails.stopDetails,routes.legs.steps.transitDetails.transitLine'
                }
            }
        );

        res.json(response.data);
    } catch (err) {
        console.error("Google API Error:", err.response?.data || err.message);
        console.error("Google API Detail:", JSON.stringify(err.response?.data, null, 2));
        res.status(500).json({ error: "Failed to find trains "});
    }
})

module.exports = router;