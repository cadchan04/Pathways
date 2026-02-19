// models/User.js
const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  auth0Id: { type: String, required: true, unique: true },
  email: { type: String },
  name: { type: String },
  picture: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("User", UserSchema);
