const mongoose = require('mongoose');

const EventBookingSchema = new mongoose.Schema({
  attendee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },

  name: String,
  phone: Number,
  email: String,

  numberOfTickets: {
    type: Number,
    default: 1
  },

  totalAmount:{
    type:Number,
    default:0
  },

  payment: {
    type: String,
    enum: ['credit_card', 'debit_card', 'paypal','cash'],
    default: 'pending'
  },

  bookingDate: {
    type: Date,
    default: Date.now
  },

  preferredDate: {          // 🆕 User-selected preferred date
    type: Date,
    required: true
  },

  preferredTime: {          // 🆕 User-selected preferred time (as string)
    type: String,
    required: true
  },

  expireAt: {
    type: Date,
    required: true
  },
});

// ✅ TTL index: Deletes expired bookings automatically
EventBookingSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('EventBooking', EventBookingSchema, 'event_bookings');