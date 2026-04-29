const mongoose = require("mongoose");

const ACCOMMODATION_PREFERENCE_CATEGORIES = Object.freeze([
  "HOTEL",
  "AIRBNB",
  "HOSTEL",
  "OTHER",
]);

const ACTIVITY_PREFERENCE_CATEGORIES = Object.freeze([
  "SIGHTSEEING",
  "DINING",
  "ENTERTAINMENT",
  "SHOPPING",
  "OUTDOOR",
  "OTHER",
]);

function isValidRankObject(obj, categories) {
  if (obj == null || typeof obj !== "object" || Array.isArray(obj)) return false;
  return Object.entries(obj).every(([category, rank]) => {
    if (!categories.includes(category)) return false;
    if (rank === null || rank === undefined || rank === "") return true;
    return Number.isInteger(rank) && rank >= 1 && rank <= categories.length;
  });
}

const accommodationActivityPreferenceSchema = new mongoose.Schema(
  {
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Trip",
      required: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    accommodationRankByCategory: {
      type: Object,
      default: {},
      validate: {
        validator: (obj) =>
          isValidRankObject(obj, ACCOMMODATION_PREFERENCE_CATEGORIES),
        message:
          "accommodationRankByCategory must map each category to null/empty or an integer rank between 1 and category count",
      },
    },
    activityRankByCategory: {
      type: Object,
      default: {},
      validate: {
        validator: (obj) => isValidRankObject(obj, ACTIVITY_PREFERENCE_CATEGORIES),
        message:
          "activityRankByCategory must map each category to null/empty or an integer rank between 1 and category count",
      },
    },
  },
  { timestamps: true }
);

accommodationActivityPreferenceSchema.index(
  { tripId: 1, userId: 1 },
  { unique: true }
);

const AccommodationActivityPreference = mongoose.model(
  "AccommodationActivityPreference",
  accommodationActivityPreferenceSchema
);

module.exports = {
  AccommodationActivityPreference,
  accommodationActivityPreferenceSchema,
  ACCOMMODATION_PREFERENCE_CATEGORIES,
  ACTIVITY_PREFERENCE_CATEGORIES,
};
