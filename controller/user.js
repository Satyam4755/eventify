const { check, validationResult } = require("express-validator");
const Event = require('../models/event');
const User = require('../models/user');
const EventBooking = require('../models/eventBooking');

exports.homePage = async (req, res, next) => {
  let opacity = {};
  const eventQuery = req.query.event || '';
  const locationQuery = req.query.location || '';
  let events = [];
  let user = null;
  let showOptions = false;

  try {
    const filters = {};
    if (eventQuery.trim()) filters.category = { $regex: eventQuery, $options: 'i' };
    if (locationQuery.trim()) filters.location = { $regex: locationQuery, $options: 'i' };

    events = await Event.find(filters);

    for (const event of events) {
      const validRatings = Array.isArray(event.reviews) ? event.reviews.filter(r => typeof r.rating === 'number' && !isNaN(r.rating)) : [];
      event.averageRating = validRatings.length ? parseFloat((validRatings.reduce((sum, r) => sum + r.rating, 0) / validRatings.length).toFixed(1)) : 0;
      event.formattedDates = Array.isArray(event.dates) ? event.dates.map(date => new Date(date).toLocaleDateString('en-IN')) : [];
    }

    if (req.isLogedIn && req.session.user) {
      user = await User.findById(req.session.user._id);
      if (user.userType === 'attendee') {
        showOptions = true;
        const favIds = user.favourites.map(fav => fav.toString());
        events.forEach(event => {
          opacity[event._id.toString()] = favIds.includes(event._id.toString()) ? 10 : 0;
        });
      } else {
        events.forEach(event => {
          opacity[event._id.toString()] = 0;
        });
      }
    } else {
      events.forEach(event => {
        opacity[event._id.toString()] = 0;
      });
    }

    const availableEvents = await Event.distinct("category");
    const availableLocations = await Event.distinct("location");

    res.render('./store/vender.ejs', {
      events,
      title: "Eventify",
      opacity,
      currentPage: 'home',
      isLogedIn: req.isLogedIn,
      user: user || null,
      showOptions,
      searchQuery: eventQuery,
      searchLocation: locationQuery,
      availableEvents,
      availableLocations
    });

  } catch (err) {
    console.error("❌ Error loading home page:", err);
    res.redirect('/');
  }
};

exports.eventDetails = async (req, res, next) => {
  if (!req.isLogedIn || !req.session.user) return res.redirect('/login');
  const eventId = req.params.eventId;
  const user = await User.findById(req.session.user._id);

  const event = await Event.findById(eventId).populate('organizer').populate('reviews.user').populate({ path: 'attendees', populate: { path: 'booked', model: 'EventBooking' } });
  if (!event) return res.redirect('/user/event-details');

  const validRatings = event.reviews.filter(r => typeof r.rating === 'number' && !isNaN(r.rating));
  const averageRating = validRatings.length ? parseFloat((validRatings.reduce((sum, r) => sum + r.rating, 0) / validRatings.length).toFixed(1)) : 0;
  const numberOfBookings = event.attendees?.length || 0;
  const numberOfOrders = await EventBooking.countDocuments({ event: eventId });

  const isFavourite = user.favourites.map(id => id.toString()).includes(event._id.toString());
  const opacity = { [event._id.toString()]: isFavourite ? 10 : 0 };

  res.render('./store/vender-details', {
    event,
    title: "Event Details",
    opacity,
    isLogedIn: req.isLogedIn,
    user,
    showOptions: true,
    numberOfBookings,
    numberOfOrders,
    messages: req.flash(),
    reviews: event.reviews || [],
    averageRating,
    attendees: event.attendees,
    currentPage: ''
  });
};

exports.favouriteList = async (req, res, next) => {
  if (!req.isLogedIn || !req.session.user) return res.redirect('/login');
  const user = await User.findById(req.session.user._id).populate('favourites');
  if (user.userType !== 'attendee') return res.status(403).render('error', { title: 'Access Denied', message: 'Only attendees can access this page.', isLogedIn: req.isLogedIn, user });

  try {
    const favouriteEvents = user.favourites;
    for (const event of favouriteEvents) {
      const validRatings = event.reviews?.filter(r => typeof r.rating === 'number' && !isNaN(r.rating)) || [];
      event.averageRating = validRatings.length ? parseFloat((validRatings.reduce((sum, r) => sum + r.rating, 0) / validRatings.length).toFixed(1)) : 0;
      event.formattedDates = Array.isArray(event.dates) ? event.dates.map(date => new Date(date).toLocaleDateString('en-IN')) : [];
    }

    res.render('./store/favourite_list', {
      events: favouriteEvents,
      title: "Favourite Events",
      currentPage: 'favourite',
      isLogedIn: req.isLogedIn,
      user,
      messages: req.flash(),
    });

  } catch (err) {
    console.error('❌ Favourite List Error:', err);
    req.flash('error', 'Could not load your favourite events.');
    res.redirect('back');
  }
};

exports.bookingPage = async (req, res, next) => {
  if (!req.isLogedIn || !req.session.user) return res.redirect('/login');
  const user = await User.findById(req.session.user._id);
  if (user.userType !== 'attendee') return res.status(403).render('error', { title: 'Access Denied', message: 'Only attendees can book events.', isLogedIn: req.isLogedIn, user });

  const eventId = req.params.eventId;
  try {
    const event = await Event.findById(eventId);
    if (!event) return res.redirect('/user/event-details');

    const validRatings = event.reviews?.filter(r => typeof r.rating === 'number' && !isNaN(r.rating)) || [];
    event.averageRating = validRatings.length ? parseFloat((validRatings.reduce((sum, r) => sum + r.rating, 0) / validRatings.length).toFixed(1)) : 0;

    res.render('./store/booking', {
      event,
      title: "Book Event",
      isLogedIn: req.isLogedIn,
      currentPage: '',
      user
    });

  } catch (err) {
    console.error('Error loading booking page:', err);
    res.redirect('/user/event-details');
  }
};

exports.submitBooking = (req, res, next) => {
  if (!req.isLogedIn || !req.session.user) return res.redirect('/login');
  const user = req.session.user;
  if (user.userType !== 'attendee') return res.status(403).render('error', { title: 'Access Denied', message: 'Only attendees can submit bookings.', isLogedIn: req.isLogedIn, user });

  res.render('./store/submitBooking', {
    title: "Booking Confirmed",
    isLogedIn: req.isLogedIn,
    user
  });
};

exports.bookedEvents = async (req, res, next) => {
  if (!req.isLogedIn || !req.session.user) return res.redirect('/login');
  const user = await User.findById(req.session.user._id);
  if (user.userType !== 'attendee') return res.status(403).render('error', { title: 'Access Denied', message: 'Only attendees can view booked events.', isLogedIn: req.isLogedIn, user });

  try {
    const userId = user._id;
    const bookings = await EventBooking.find({ attendee: userId }).populate('event');

    const validBookedEvents = [];

    for (const booking of bookings) {
      const event = booking.event;
      if (event) {
        const validRatings = event.reviews?.filter(r => typeof r.rating === 'number' && !isNaN(r.rating)) || [];
        event.averageRating = validRatings.length ? parseFloat((validRatings.reduce((sum, r) => sum + r.rating, 0) / validRatings.length).toFixed(1)) : 0;

        validBookedEvents.push({
          event,
          preferredDate: booking.preferredDate,
          preferredTime: booking.preferredTime,
          numberOfTickets: booking.numberOfTickets,
          totalAmount: booking.totalAmount,
          paymentStatus: booking.paymentStatus,
          bookingId: booking._id
        });
      }
    }

    res.render('./store/booked', {
      events: validBookedEvents,
      title: "My Booked Events",
      currentPage: 'reserve',
      isLogedIn: req.isLogedIn,
      user,
      messages: req.flash()
    });

  } catch (err) {
    console.error('❌ Error loading booked events:', err);
    req.flash('error', 'Could not load your bookings');
    res.redirect('back');
  }
};

// ADD / REMOVE FAVOURITE
exports.postfavouriteList = async (req, res, next) => {
  if (!req.isLogedIn || !req.session.user) return res.redirect('/login');

  const eventId = req.body.eventId;  // ⬅ changed
  const user = await User.findById(req.session.user._id);

  if (!user.favourites.includes(eventId)) {
    user.favourites.push(eventId);
  } else {
    user.favourites.pull(eventId);
  }

  await user.save();
  res.redirect('/user/favourite_list');
};

// UNFAVOURITE FROM FAV PAGE
exports.postUnfavourite = async (req, res, next) => {
  if (!req.isLogedIn || !req.session.user) return res.redirect('/login');

  const eventId = req.params.eventId; // ⬅ updated
  const user = await User.findById(req.session.user._id);

  user.favourites.pull(eventId);
  await user.save();
  req.flash('success', 'Event removed from favourites successfully!');
  res.redirect('/user/favourite_list');
};
// ✅ POST BOOKING
exports.postBooking = [
  check('phone')
    .isNumeric().withMessage('Phone number must be numeric')
    .isLength({ min: 10, max: 10 }).withMessage('Phone number must be 10 digits'),

  async (req, res, next) => {
    if (!req.isLogedIn || !req.session.user) {
      return res.redirect('/login');
    }

    const eventId = req.params.eventId;
    const {
      name,
      phone,
      email,
      numberOfTickets,
      totalAmount,
      payment,
      eventDate,     // from input#bookingDate (YYYY-MM-DD)
      eventTime      // from input#bookingTime (HH:MM)
    } = req.body;

    if (!eventDate || !eventTime) {
      req.flash('error', 'Both date and time must be selected.');
      return res.redirect(req.get("Referrer") || "/");
    }

    try {
      const user = await User.findById(req.session.user._id);
      const event = await Event.findById(eventId);
      if (!event) {
        req.flash('error', 'Event not found.');
        return res.redirect(req.get("Referrer") || "/");
      }

      // ⏰ Convert preferredDate string to Date and set expireAt to end of that day
      const preferredDate = new Date(eventDate);
      const expireAt = new Date(preferredDate);
      expireAt.setHours(23, 59, 59, 999);  // Automatically delete after that day ends

      // ✅ Validate selected date exists in event.dates
      const isValidDate = event.dates.some(date =>
        new Date(date).toISOString().split('T')[0] === eventDate
      );

      if (!isValidDate) {
        req.flash('error', 'Selected date is not valid for this event.');
        return res.redirect(req.get("Referrer") || "/");
      }

      const newBooking = new EventBooking({
        attendee: user._id,
        event: eventId,
        name,
        phone,
        email,
        numberOfTickets,
        totalAmount,
        payment: payment || 'pending',
        preferredDate,
        preferredTime: eventTime,
        expireAt // ✅ This enables automatic TTL deletion
      });

      await newBooking.save();

      // Add to user's booked list
      if (!user.booked.includes(eventId)) {
        user.booked.push(eventId);
        await user.save();
      }

      // Add to event's attendees
      if (!event.attendees.includes(user._id)) {
        event.attendees.push(user._id);
        await event.save();
      }

      res.redirect('/user/submit_booking');
    } catch (err) {
      console.error('❌ Booking Error:', err);
      req.flash('error', 'Something went wrong while booking the event.');
      res.redirect(req.get("Referrer") || "/");
    }
  }
];
// ✅ CANCEL BOOKING
// ✅ CANCEL BOOKING
exports.postCancelBooking = async (req, res, next) => {
  if (!req.isLogedIn || !req.session.user) return res.redirect('/login');

  const bookingId = req.params.eventId;

  try {
    // Find booking first
    const booking = await EventBooking.findById(bookingId);
    if (!booking) {
      req.flash('error', 'Booking not found');
      return res.redirect('/user/booked');
    }

    // Remove event ID from user's booked list
    await User.findByIdAndUpdate(req.session.user._id, {
      $pull: { booked: booking.event }
    });

    // Remove user from event's attendees
    await Event.findByIdAndUpdate(booking.event, {
      $pull: { attendees: req.session.user._id }
    });

    // Delete the actual booking
    await EventBooking.findByIdAndDelete(bookingId);

    req.flash('success', 'Booking cancelled successfully');
    res.redirect('/user/booked');
  } catch (err) {
    console.error('❌ Cancel booking error:', err);
    req.flash('error', 'Something went wrong during cancellation');
    res.redirect('/user/booked');
  }
};


exports.postEventReview = async (req, res, next) => {
  if (!req.isLogedIn || !req.session.user) return res.redirect('/login');

  try {
    const user = await User.findById(req.session.user._id);
    const { eventId } = req.params;
    const { Review, Rating } = req.body;

    const event = await Event.findById(eventId);
    if (!event) {
      req.flash('error', 'Invalid event.');
      return res.redirect('/user/event-details');
    }

    event.reviews.push({
      user: user._id,
      rating: parseInt(Rating, 10),
      comment: Review
    });

    await event.save();
    req.flash('success', 'Review submitted successfully!');
    res.redirect('/user/event-details/' + eventId);
  } catch (err) {
    console.error('Error submitting review:', err);
    req.flash('error', 'Could not submit review');
    res.redirect(req.get('Referrer') || '/');
  }
};


exports.postDeleteReview = async (req, res, next) => {
  if (!req.isLogedIn || !req.session.user) return res.redirect('/login');

  const { eventId } = req.params;
  const { reviewId } = req.body;

  try {
    const event = await Event.findById(eventId);
    if (!event) {
      req.flash('error', 'Event not found.');
      return res.redirect('/user/event-details');
    }

    const review = event.reviews.find(
      (rev) =>
        rev._id.toString() === reviewId &&
        rev.user.toString() === req.session.user._id.toString()
    );

    if (!review) {
      req.flash('error', 'Unauthorized or review not found.');
      return res.redirect('/user/event-details/' + eventId);
    }

    // Remove review
    event.reviews = event.reviews.filter(
      (rev) => rev._id.toString() !== reviewId
    );

    await event.save();

    req.flash('success', 'Your review has been deleted successfully.');
    res.redirect('/user/event-details/' + eventId);
  } catch (err) {
    console.error('Error deleting review:', err);
    req.flash('error', 'An error occurred while deleting the review.');
    res.redirect('/user/event-details/' + eventId);
  }
};


// ✅ Controller: postHomePage
exports.postHomePage = async (req, res, next) => {
  if (!req.isLogedIn || !req.session.user) return res.redirect('/login');

  const userId = req.session.user._id;
  const themeValue = req.body.theme === 'true'; // convert to boolean

  try {
    await User.findByIdAndUpdate(userId, { theme: themeValue });
    req.session.user.theme = themeValue; // update session also
    res.redirect('/');
  } catch (err) {
    console.error('Theme update failed:', err);
    res.status(500).send('Internal Server Error');
  }
};
