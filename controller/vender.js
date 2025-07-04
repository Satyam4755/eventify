const cloudinary = require('cloudinary').v2;
const Event = require('../models/event');
const { fileUploadInCloudinary } = require('../utils/cloudinary');
const User = require('../models/user');
const EventBooking = require('../models/eventBooking');

exports.addEvent = (req, res, next) => {
  if (!req.isLogedIn || !req.session.user || req.session.user.userType !== 'organizer') {
    return res.status(403).render('error', {
      message: 'Access Denied: Organizer only feature',
      title: 'Unauthorized',
      isLogedIn: req.isLogedIn,
      user: req.session.user || null
    });
  }

  res.render('./admin/editvenders', {
    editing: false,
    title: "Add Event",
    currentPage: 'vender',
    isLogedIn: req.isLogedIn,
    user: req.session.user,
    event: {}, // send empty event so template won't crash
    formattedDates: [],
    eventTimes: []
  });
};

exports.editEvent = (req, res, next) => {
  if (!req.isLogedIn || !req.session.user || req.session.user.userType !== 'organizer') {
    return res.status(403).render('error', {
      messages: 'Access Denied: Organizer only feature',
      title: 'Unauthorized',
      isLogedIn: req.isLogedIn,
      user: req.session.user || null
    });
  }

  const eventId = req.params.eventId;
  const editing = req.query.editing === 'true';

  Event.findById(eventId).then(event => {
    if (!event) return res.redirect('/vender/events-list');

    const formattedDates = event.dates.map(date =>
      new Date(date).toISOString().split('T')[0]
    );

    res.render('./admin/editvenders', {
      event,
      editing,
      title: "Edit Event",
      currentPage: 'vender',
      isLogedIn: req.isLogedIn,
      user: req.session.user,
      formattedDates,
      eventTimes: event.times || []
    });
  });
};

exports.eventList = async (req, res, next) => {
  if (!req.isLogedIn || !req.session.user || req.session.user.userType !== 'organizer') {
    return res.status(403).render('error', {
      messages: 'Access Denied: Organizer only feature',
      title: 'Unauthorized',
      isLogedIn: req.isLogedIn,
      user: req.session.user || null
    });
  }

  const organizerId = req.session.user._id;

  try {
    const events = await Event.find({ organizer: organizerId }).populate('organizer');

    for (const event of events) {
      if (event.reviews && event.reviews.length > 0) {
        const validRatings = event.reviews.filter(r =>
          typeof r.rating === 'number' && !isNaN(r.rating)
        );

        event.averageRating = validRatings.length
          ? parseFloat((validRatings.reduce((sum, r) => sum + r.rating, 0) / validRatings.length).toFixed(1))
          : 0;
      } else {
        event.averageRating = 0;
      }

      if (Array.isArray(event.dates)) {
        event.formattedDates = event.dates.map(date =>
          new Date(date).toLocaleDateString('en-IN')
        );
      } else {
        event.formattedDates = [];
      }
    }

    res.render('./admin/venders_list', {
      events,
      title: "My Events",
      currentPage: 'eventsList',
      isLogedIn: req.isLogedIn,
      user: req.session.user
    });

  } catch (err) {
    console.error("❌ Error loading event list:", err);
    res.redirect('/dashboard');
  }
};

exports.getBookings = async (req, res, next) => {
  if (!req.isLogedIn || !req.session.user || req.session.user.userType !== 'organizer') {
    return res.status(403).render('error', {
      messages: 'Access Denied: Organizer only feature',
      title: 'Unauthorized',
      isLogedIn: req.isLogedIn,
      user: req.session.user || null
    });
  }

  try {
    const events = await Event.find({ organizer: req.session.user._id });
    const isOrganizer = events.length > 0;

    const eventIds = events.map(e => e._id);
    const bookings = await EventBooking.find({ event: { $in: eventIds } })
      .populate('attendee')
      .populate('event');

    res.render('./admin/orders', {
      title: "Bookings",
      isLogedIn: req.isLogedIn,
      user: req.session.user,
      orders: bookings,
      currentPage: 'bookings',
      isOrganizer
    });

  } catch (err) {
    console.error('Error fetching event bookings:', err);
    req.flash('error', 'Could not load bookings');
    res.redirect('back');
  }
};
exports.deleteEvent = async (req, res, next) => {
  const eventId = req.params.eventId;

  try {
    const event = await Event.findById(eventId);
    if (!event || event.organizer.toString() !== req.session.user._id.toString()) {
      return res.status(403).send('Unauthorized or not found');
    }

    await User.updateMany({ booked: eventId }, { $pull: { booked: eventId } });
    await EventBooking.deleteMany({ event: eventId });

    const cloudTasks = [];
    if (event.imagePublicId) cloudTasks.push(cloudinary.uploader.destroy(event.imagePublicId));
    if (event.bannerImagePublicId) cloudTasks.push(cloudinary.uploader.destroy(event.bannerImagePublicId));
    await Promise.all(cloudTasks);

    await Event.findByIdAndDelete(eventId);
    res.redirect('/vender/events-list');
  } catch (err) {
    console.error("Delete event error:", err);
    res.redirect('/vender/events-list');
  }
};

exports.postAddEvent = async (req, res) => {
    const { title, category, ticketPrice, location, description, rules, eventDates, eventTimes } = req.body;
    const files = req.files;

    if (!files || !files.image || !files.bannerImage) {
        return res.status(400).send("Missing required event images.");
    }

    try {
        const imageBuffer = files.image[0].buffer;
        const bannerBuffer = files.bannerImage[0].buffer;

        const imageResult = await fileUploadInCloudinary(imageBuffer);
        const bannerResult = await fileUploadInCloudinary(bannerBuffer);

        const event = new Event({
            image: imageResult.secure_url,
            imagePublicId: imageResult.public_id,
            bannerImage: bannerResult.secure_url,
            bannerImagePublicId: bannerResult.public_id,
            title,
            category,
            ticketPrice,
            location,
            description,
            rules,
            dates: Array.isArray(eventDates) ? eventDates : [eventDates],
            times: Array.isArray(eventTimes) ? eventTimes : [eventTimes],
            organizer: req.session.user._id
        });

        await event.save();
        return res.redirect('/vender/events-list');
    } catch (err) {
        console.error("Event creation failed:", err.message);
        return res.status(500).send("Server Error");
    }
};

exports.postEditEvent = async (req, res) => {
    const { title, category, ticketPrice, location, description, rules, eventDates, eventTimes, id: eventId } = req.body;
    const files = req.files;

    try {
        const event = await Event.findById(eventId);
        if (!event || event.organizer.toString() !== req.session.user._id.toString()) {
            return res.status(403).json({ success: false, message: "Unauthorized to edit this event" });
        }

        if (files?.image) {
            if (event.imagePublicId) {
                await cloudinary.uploader.destroy(event.imagePublicId);
            }
            const imgRes = await fileUploadInCloudinary(files.image[0].buffer);
            event.image = imgRes.secure_url;
            event.imagePublicId = imgRes.public_id;
        }

        if (files?.bannerImage) {
            if (event.bannerImagePublicId) {
                await cloudinary.uploader.destroy(event.bannerImagePublicId);
            }
            const bannerRes = await fileUploadInCloudinary(files.bannerImage[0].buffer);
            event.bannerImage = bannerRes.secure_url;
            event.bannerImagePublicId = bannerRes.public_id;
        }

        event.title = title;
        event.category = category;
        event.ticketPrice = ticketPrice;
        event.location = location;
        event.description = description;
        event.rules = rules;
        event.dates = Array.isArray(eventDates) ? eventDates : [eventDates];
        event.times = Array.isArray(eventTimes) ? eventTimes : [eventTimes];

        await event.save();
        return res.redirect('/vender/events-list');

    } catch (err) {
        console.error("Edit event error:", err);
        return res.status(500).send("Server Error");
    }
};