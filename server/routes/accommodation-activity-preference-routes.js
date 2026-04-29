const express = require("express");
const Trip = require("../models/Trip");
const {
  AccommodationActivityPreference,
  ACCOMMODATION_PREFERENCE_CATEGORIES,
  ACTIVITY_PREFERENCE_CATEGORIES,
} = require("../models/AccommodationActivityPreference");
const { canViewTrip, readUserId } = require("../collaboration/tripAccess");

const router = express.Router({ mergeParams: true });

function normalizeRankByCategory(input, categories) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const normalized = {};
  for (const category of categories) {
    const raw = input[category];
    if (raw === "" || raw == null) {
      normalized[category] = null;
      continue;
    }
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > categories.length) {
      return null;
    }
    normalized[category] = n;
  }
  return normalized;
}

function computeCategorySummary(preferences, rankField, categories) {
  const categoryPreferences = preferences.filter(
    (pref) => pref?.[rankField] && Object.keys(pref[rankField]).length > 0
  );
  if (!categoryPreferences.length) return null;

  const unrankedPoints = categories.length + 1;
  const scores = {};
  const firstChoiceVotes = {};

  for (const category of categories) {
    scores[category] = 0;
    firstChoiceVotes[category] = 0;
  }

  for (const pref of categoryPreferences) {
    const rankByCategory = pref[rankField] || {};
    for (const category of categories) {
      const rank = Number(rankByCategory[category]);
      if (Number.isInteger(rank) && rank >= 1 && rank <= categories.length) {
        scores[category] += rank;
        if (rank === 1) firstChoiceVotes[category] += 1;
      } else {
        scores[category] += unrankedPoints;
      }
    }
  }

  const bestScore = Math.min(...categories.map((category) => scores[category]));
  const tiedCategories = categories
    .filter((category) => scores[category] === bestScore)
    .sort((a, b) => {
      if (firstChoiceVotes[b] !== firstChoiceVotes[a]) {
        return firstChoiceVotes[b] - firstChoiceVotes[a];
      }
      return a.localeCompare(b);
    });

  return {
    topCategory: tiedCategories[0],
    tiedCategories,
    scores,
    firstChoiceVotes,
    submissionsCount: categoryPreferences.length,
  };
}

async function loadViewableTrip(req, res) {
  const userId = readUserId(req);
  if (!userId) {
    res.status(401).json({ error: "userId is required" });
    return null;
  }

  const trip = await Trip.findById(req.params.tripId);
  if (!trip) {
    res.status(404).json({ error: "Trip not found" });
    return null;
  }

  if (!canViewTrip(trip, userId)) {
    res.status(403).json({ error: "You do not have access to this trip" });
    return null;
  }

  return { trip, userId };
}

// PUT /api/trips/:tripId/accommodation-activity-preferences/me
// body: {
//   accommodationRankByCategory?: { HOTEL|AIRBNB|HOSTEL|OTHER: 1-4 or null },
//   activityRankByCategory?: { SIGHTSEEING|DINING|ENTERTAINMENT|SHOPPING|OUTDOOR|OTHER: 1-6 or null }
// }
router.put("/me", async (req, res) => {
  try {
    const access = await loadViewableTrip(req, res);
    if (!access) return;

    const accommodationInput = req.body?.accommodationRankByCategory;
    const activityInput = req.body?.activityRankByCategory;

    if (accommodationInput === undefined && activityInput === undefined) {
      return res.status(400).json({
        error:
          "Provide at least one of accommodationRankByCategory or activityRankByCategory",
      });
    }

    const setPayload = {};

    if (accommodationInput !== undefined) {
      const normalizedAccommodation = normalizeRankByCategory(
        accommodationInput,
        ACCOMMODATION_PREFERENCE_CATEGORIES
      );
      if (!normalizedAccommodation) {
        return res.status(400).json({
          error:
            "accommodationRankByCategory must map each category to null/empty or integer values from 1 to 4",
        });
      }
      setPayload.accommodationRankByCategory = normalizedAccommodation;
    }

    if (activityInput !== undefined) {
      const normalizedActivity = normalizeRankByCategory(
        activityInput,
        ACTIVITY_PREFERENCE_CATEGORIES
      );
      if (!normalizedActivity) {
        return res.status(400).json({
          error:
            "activityRankByCategory must map each category to null/empty or integer values from 1 to 6",
        });
      }
      setPayload.activityRankByCategory = normalizedActivity;
    }

    const saved = await AccommodationActivityPreference.findOneAndUpdate(
      { tripId: access.trip._id, userId: access.userId },
      { $set: setPayload },
      {
        upsert: true,
        returnDocument: "after",
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    res.status(200).json(saved);
  } catch (err) {
    console.error("Error saving accommodation/activity preferences:", err);
    res
      .status(500)
      .json({ error: "Failed to save accommodation/activity preferences" });
  }
});

// GET /api/trips/:tripId/accommodation-activity-preferences
router.get("/", async (req, res) => {
  try {
    const access = await loadViewableTrip(req, res);
    if (!access) return;

    const tid = access.trip._id;
    const preferences = await AccommodationActivityPreference.find({
      $or: [{ tripId: tid }, { tripId: tid != null ? String(tid) : tid }],
    })
      .sort({ updatedAt: -1 })
      .lean();

    const myPreference =
      preferences.find((p) => String(p.userId) === String(access.userId)) || null;

    res.status(200).json({
      myPreference,
      preferences,
      groupSummary: {
        accommodation: computeCategorySummary(
          preferences,
          "accommodationRankByCategory",
          ACCOMMODATION_PREFERENCE_CATEGORIES
        ),
        activity: computeCategorySummary(
          preferences,
          "activityRankByCategory",
          ACTIVITY_PREFERENCE_CATEGORIES
        ),
      },
    });
  } catch (err) {
    console.error("Error fetching accommodation/activity preferences:", err);
    res
      .status(500)
      .json({ error: "Failed to fetch accommodation/activity preferences" });
  }
});

module.exports = router;
