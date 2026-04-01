const mongoose = require("mongoose");

const ROUTE_PREFERENCE_MODES = Object.freeze([
  "RIDESHARE",
  "PERSONAL_VEHICLE",
  "BUS",
  "TRAIN",
  "FLIGHT",
]);

const routePreferenceSchema = new mongoose.Schema(
  {
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Trip",
      required: true,
      index: true,
    },
    userId: { type: String, required: true, index: true },
    ranking: {
      type: [String],
      default: [],
      validate: [
        {
          validator: (arr) => Array.isArray(arr),
          message: "ranking must be an array",
        },
        {
          validator: (arr) =>
            arr.every((mode) => ROUTE_PREFERENCE_MODES.includes(mode)),
          message: `ranking contains an invalid mode (allowed: ${ROUTE_PREFERENCE_MODES.join(
            ", "
          )})`,
        },
        {
          validator: (arr) => new Set(arr).size === arr.length,
          message: "ranking contains duplicate modes",
        },
      ],
    },
    rankByMode: {
      type: Object,
      default: {},
      validate: {
        validator: (obj) => {
          if (obj == null || typeof obj !== "object" || Array.isArray(obj)) return false;
          return Object.entries(obj).every(([mode, rank]) => {
            if (!ROUTE_PREFERENCE_MODES.includes(mode)) return false;
            if (rank === null || rank === undefined || rank === "") return true;
            return Number.isInteger(rank) && rank >= 1 && rank <= ROUTE_PREFERENCE_MODES.length;
          });
        },
        message:
          "rankByMode must map each mode to null/empty or an integer rank between 1 and mode count",
      },
    },
  },
  { timestamps: true }
);

routePreferenceSchema.index({ tripId: 1, userId: 1 }, { unique: true });

const RoutePreference = mongoose.model("RoutePreference", routePreferenceSchema);

module.exports = {
  RoutePreference,
  routePreferenceSchema,
  ROUTE_PREFERENCE_MODES,
};

