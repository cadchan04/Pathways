// models/User.js
const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  auth0Id: { type: String, required: true, unique: true },
  email: { type: String },
  name: { type: String },
  picture: { type: String },
  notificationEnabled: {
    type: Boolean,
    default: true
  },
  pushSubscription: { type: Object, default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("User", UserSchema);
