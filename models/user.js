const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
  profilePicture: String,
  profilePicturePublicId: {
    type: String
  },
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
  },
  lastName: String,


  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    unique: true
  },

  password: {
    type: String,
    required: [true, 'Password is required'],
  },
  userType: {
    type: String,
    enum: ['attendee', 'organizer'],
    default: 'attendee'
  },

  favourites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event'  
  }],

  booked: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event'  
  }],
 
  theme: {
    type: Boolean,
    default: false
  }
});

module.exports = mongoose.model('User', userSchema, 'user');