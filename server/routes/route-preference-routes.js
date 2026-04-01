const express = require("express");
const Trip = require("../models/Trip");
const {
  RoutePreference,
  ROUTE_PREFERENCE_MODES,
} = require("../models/RoutePreference");
const { canViewTrip, readUserId } = require("../collaboration/tripAccess");

const router = express.Router({ mergeParams: true });

const UNRANKED_POINTS = ROUTE_PREFERENCE_MODES.length + 1;

function normalizeRankByMode(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const normalized = {};
  for (const mode of ROUTE_PREFERENCE_MODES) {
    const raw = input[mode];
    if (raw === "" || raw == null) {
      normalized[mode] = null;
      continue;
    }
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > ROUTE_PREFERENCE_MODES.length) {
      return null;
    }
    normalized[mode] = n;
  }
  return normalized;
}

function rankingFromRankByMode(rankByMode) {
  const selected = ROUTE_PREFERENCE_MODES.filter((mode) =>
    Number.isInteger(rankByMode?.[mode])
  );
  selected.sort((a, b) => rankByMode[a] - rankByMode[b]);
  return selected;
}

function addScoresFromRankingArray(scores, firstChoiceVotes, ranking) {
  const list = Array.isArray(ranking) ? ranking : [];
  const seen = new Set();
  list.forEach((mode, index) => {
    if (!ROUTE_PREFERENCE_MODES.includes(mode)) return;
    seen.add(mode);
    const pts = index + 1;
    scores[mode] = (Number(scores[mode]) || 0) + pts;
    if (index === 0) firstChoiceVotes[mode] += 1;
  });
  for (const mode of ROUTE_PREFERENCE_MODES) {
    if (!seen.has(mode)) {
      scores[mode] = (Number(scores[mode]) || 0) + UNRANKED_POINTS;
    }
  }
}

function computeGroupSummary(preferences) {
  if (!preferences.length) return null;

  const scores = {};
  const firstChoiceVotes = {};

  for (const mode of ROUTE_PREFERENCE_MODES) {
    scores[mode] = 0;
    firstChoiceVotes[mode] = 0;
  }

  for (const pref of preferences) {
    const normalizedRankByMode = normalizeRankByMode(pref.rankByMode);
    let contributedFromRankByMode = false;

    if (normalizedRankByMode) {
      contributedFromRankByMode = true;
      for (const mode of ROUTE_PREFERENCE_MODES) {
        const rank = normalizedRankByMode[mode];
        const r = Number(rank);
        if (Number.isInteger(r) && r >= 1 && r <= ROUTE_PREFERENCE_MODES.length) {
          scores[mode] = (Number(scores[mode]) || 0) + r;
          if (r === 1) firstChoiceVotes[mode] += 1;
        } else {
          scores[mode] = (Number(scores[mode]) || 0) + UNRANKED_POINTS;
        }
      }
    }

    if (!contributedFromRankByMode) {
      addScoresFromRankingArray(scores, firstChoiceVotes, pref.ranking);
    }
  }

  const numeric = {};
  for (const mode of ROUTE_PREFERENCE_MODES) {
    const n = Number(scores[mode]);
    numeric[mode] = Number.isFinite(n) ? n : 0;
    scores[mode] = numeric[mode];
  }

  const bestScore = Math.min(...ROUTE_PREFERENCE_MODES.map((m) => numeric[m]));
  const tiedForBest = ROUTE_PREFERENCE_MODES.filter((m) => numeric[m] === bestScore);
  const tiedModes = [...tiedForBest].sort((a, b) => {
    if (firstChoiceVotes[b] !== firstChoiceVotes[a]) {
      return firstChoiceVotes[b] - firstChoiceVotes[a];
    }
    return a.localeCompare(b);
  });
  const topMode = tiedModes[0];

  return {
    topMode,
    tiedModes,
    scores,
    firstChoiceVotes,
    submissionsCount: preferences.length,
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

// PUT /api/trips/:tripId/route-preferences/me
// body: { rankByMode: { MODE: 1-5 or null } } 
// body: { ranking: [string] }
router.put("/me", async (req, res) => {
  try {
    const access = await loadViewableTrip(req, res);
    if (!access) return;

    const rankByModeInput = req.body?.rankByMode;
    if (rankByModeInput !== undefined) {
      const normalizedRankByMode = normalizeRankByMode(rankByModeInput);
      if (!normalizedRankByMode) {
        return res.status(400).json({
          error: "rankByMode must map each mode to null/empty or integer values from 1 to 5",
        });
      }

      const saved = await RoutePreference.findOneAndUpdate(
        { tripId: access.trip._id, userId: access.userId },
        {
          $set: {
            rankByMode: normalizedRankByMode,
            ranking: rankingFromRankByMode(normalizedRankByMode),
          },
        },
        { upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: true }
      );

      return res.status(200).json(saved);
    }

    const ranking = req.body?.ranking;
    if (!Array.isArray(ranking)) {
      return res
        .status(400)
        .json({ error: "Provide either rankByMode object or ranking array" });
    }

    const sanitizedRanking = ranking.map((mode) => String(mode).trim().toUpperCase());
    const invalidModes = sanitizedRanking.filter(
      (mode) => !ROUTE_PREFERENCE_MODES.includes(mode)
    );

    if (invalidModes.length > 0) {
      return res.status(400).json({
        error: `Invalid transport mode(s): ${[...new Set(invalidModes)].join(", ")}`,
      });
    }

    if (new Set(sanitizedRanking).size !== sanitizedRanking.length) {
      return res.status(400).json({ error: "ranking contains duplicate modes" });
    }

    if (sanitizedRanking.length === 0) {
      return res.status(400).json({ error: "ranking must include at least one mode" });
    }

    const saved = await RoutePreference.findOneAndUpdate(
      { tripId: access.trip._id, userId: access.userId },
      { $set: { ranking: sanitizedRanking, rankByMode: {} } },
      { upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: true }
    );

    res.status(200).json(saved);
  } catch (err) {
    console.error("Error saving route preference:", err);
    res.status(500).json({ error: "Failed to save route preference" });
  }
});

// GET /api/trips/:tripId/route-preferences
router.get("/", async (req, res) => {
  try {
    const access = await loadViewableTrip(req, res);
    if (!access) return;

    const tid = access.trip._id;
    const preferences = await RoutePreference.find({
      $or: [{ tripId: tid }, { tripId: tid != null ? String(tid) : tid }],
    })
      .sort({ updatedAt: -1 })
      .lean();

    const myPreference =
      preferences.find((p) => String(p.userId) === String(access.userId)) || null;

    res.status(200).json({
      myPreference,
      preferences,
      groupSummary: computeGroupSummary(preferences),
    });
  } catch (err) {
    console.error("Error fetching route preferences:", err);
    res.status(500).json({ error: "Failed to fetch route preferences" });
  }
});

module.exports = router;

