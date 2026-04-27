const mongoose = require('mongoose');

const accommodationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: {
    type: String,
    enum: ['Hotel', 'Airbnb', 'Hostel', 'Other'],
    default: 'Hotel',
    required: true
  },

  address: { type: String, required: true },
  phoneNumber: { type: String, required: false },
  email: { type: String, required: false },
  website: { type: String, required: false },

  checkInDate: { type: Date, required: true },
  checkInTime: { type: String, default: '15:00' },
  checkOutDate: { type: Date, required: true },
  checkOutTime: { type: String, default: '10:00' },

  confirmationNumber: { type: String, required: true },

  cost: { type: Number, default: null },
  isPaid: { type: Boolean, default: false },

  notes: { type: String, required: false },

  tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, {
  timestamps: true
});

const Accommodation = mongoose.model('Accommodation', accommodationSchema);

module.exports = Accommodation;