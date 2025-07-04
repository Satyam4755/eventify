require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const flash = require('connect-flash');
const compression = require('compression');

const app = express();

// ✅ Middleware Setup
app.use(flash());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(compression()); // keeps compression enabled

// ✅ Relaxed CSP to allow Cloudinary images and inline scripts
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; " +
    "img-src 'self' https://res.cloudinary.com data:; " +
    "script-src 'self' 'unsafe-inline' https://kit.fontawesome.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com;"
  );
  next();
});

// ✅ Routers
const userRouter = require('./routes/user');
const authRouter = require('./routes/auth');
const organizerRouter = require('./routes/vender');

// ✅ Middleware Imports
const createSession = require('./middleware/session');
const loginFlag = require('./middleware/loginFlag');
const protectUserRoutes = require('./middleware/protectUserRoutes');
const protectvenderRoutes = require('./middleware/protectvenderRoutes');

// ✅ ENV Variables
const dbPath = process.env.MONGO_URI;
const sessionSecret = process.env.SESSION_SECRET;
const PORT = process.env.PORT || 3407;

// ✅ Session & Static Middleware
app.use(createSession(dbPath, sessionSecret));
app.use(loginFlag);
app.use(express.static(path.join(__dirname, 'public')));

// ✅ Protected User Routes
const protectedUserRoutes = [
  '/user/favourite_list',
  '/user/booked',
  '/user/booking/:eventId',
  '/user/submit_booking'
];
app.use(protectedUserRoutes, protectUserRoutes);

// ✅ Routes
app.use(userRouter);
app.use(authRouter);
app.use('/vender', protectvenderRoutes, organizerRouter);

// ✅ View Engine
app.set('view engine', 'ejs');
app.set('views', 'views');

// ✅ 404 Handler
app.use((req, res) => {
  res.status(404).render('error', { title: "error",messages: "not accesseble", isLogedIn: req.isLogedIn });
});

// ✅ MongoDB Connection
mongoose.connect(dbPath).then(async () => {
  console.log('✅ Connected to MongoDB');

  try {
    await mongoose.connection.db.collection('sessions').createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0 }
    );
    console.log('✅ TTL index ensured on sessions collection.');
  } catch (err) {
    console.error('❌ TTL index setup failed for sessions:', err.message);
  }

  // ✅ Start Server
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
});