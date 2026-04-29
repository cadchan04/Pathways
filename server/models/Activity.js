const mongoose = require('mongoose');

const User = require('./User');

const activitySchema = new mongoose.Schema({
  name: { type: String, required: true },
  activityType: {
    type: String,
    enum: ['Sightseeing', 'Dining', 'Entertainment', 'Shopping', 'Outdoor', 'Other'],
    default: 'Other',
    required: true
  },
  
  address: { type: String, required: true },
  phoneNumber: { type: String, required: false },
  email: { type: String, required: false },
  website: { type: String, required: false },
  
  activityDate: { type: Date, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  
  cost: { type: Number, default: null },
  attending: [{ type: String, ref: User, required: false }],
  notes: { type: String, required: false },
  
  tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, {
  timestamps: true
});

const Activity = mongoose.model('Activity', activitySchema);

module.exports = Activity;