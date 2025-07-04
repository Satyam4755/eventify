const express = require('express');
const userRouter = express.Router();

const {
  homePage,
  eventDetails,           // renamed from venderDetails
  favouriteList,
  bookingPage,            // renamed from booking
  bookedEvents,           // renamed from booked
  postfavouriteList,
  postUnfavourite,
  postBooking,            // renamed from Postbooking
  submitBooking,
  postCancelBooking,
  postEventReview,        // renamed from postvenderDetails
  postDeleteReview,
  postHomePage
} = require('../controller/user');

// GET routes
userRouter.get('/', homePage);
userRouter.get('/user/event-details/:eventId', eventDetails);
userRouter.get('/user/favourite_list', favouriteList);
userRouter.get('/user/booking/:eventId', bookingPage);
userRouter.get('/user/booked', bookedEvents);
userRouter.get('/user/submit_booking', submitBooking);

// POST routes
userRouter.post('/user/favourite_list', postfavouriteList);
userRouter.post('/user/unfavourite/:eventId', postUnfavourite);
userRouter.post('/user/submit_booking/:eventId', postBooking);
userRouter.post('/user/cancel_booking/:eventId', postCancelBooking);
userRouter.post('/user/event-details/:eventId', postEventReview);
userRouter.post('/user/delete-review/:eventId', postDeleteReview);
userRouter.post('/', postHomePage); // theme update

module.exports = userRouter;