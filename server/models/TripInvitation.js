const mongoose = require("mongoose");

const TripInvitationSchema = new mongoose.Schema(
  {
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Trip",
      required: true,
      index: true,
    },
    inviterId: { type: String, required: true },
    inviteeEmail: { type: String, required: true },
    inviteeUserId: { type: String },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined", "revoked"],
      default: "pending",
      index: true,
    },
    expiresAt: { type: Date },
  },
  { timestamps: true }
);

TripInvitationSchema.index({ inviteeEmail: 1, status: 1 });
TripInvitationSchema.index({ tripId: 1, status: 1 });

module.exports = mongoose.model("TripInvitation", TripInvitationSchema);
