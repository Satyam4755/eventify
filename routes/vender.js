const express = require('express');
const organizerRouter = express.Router();
const multiFileUpload = require('../middleware/multer');

// Organizer controller methods
const {
  addEvent,
  eventList,
  editEvent,
  postAddEvent,
  postEditEvent,
  deleteEvent,
  getBookings,
} = require('../controller/vender');

// ---------- GET ROUTES ----------
organizerRouter.get('/add-event', addEvent);
organizerRouter.get('/events-list', eventList);
organizerRouter.get('/events-list/:eventId', editEvent);
organizerRouter.get('/edit-event/:eventId', editEvent);
organizerRouter.get('/bookings', getBookings);

// ---------- POST ROUTES ----------
organizerRouter.post('/add-event', multiFileUpload, postAddEvent);
organizerRouter.post('/edit-event', multiFileUpload, postEditEvent);
organizerRouter.post('/delete-event/:eventId', deleteEvent);

module.exports = organizerRouter;