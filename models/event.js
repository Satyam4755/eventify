const mongoose = require('mongoose');

const eventSchema = mongoose.Schema({
  image: String,
  imagePublicId: String,

  bannerImage: String,
  bannerImagePublicId: String,

  title: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['Music', 'Tech', 'Business', 'Education', 'Health', 'Sports', 'Other'],
    default: 'Other'
  },

  ticketPrice: {     
    type: Number,
    required: true
  },
 
  location: {
    type: String,
    required: true
  },
  description: String,
  rules: String,

  dates: [{
  type: Date,
  required: true
}],
times: [{
  type: String,
  required: true
}],

  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  attendees: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],

  reviews: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rating: {
      type: Number,
      required: true
    },
    comment: {
      type: String,
      required: true
    },
  }]
});

module.exports = mongoose.model('Event', eventSchema, 'events');